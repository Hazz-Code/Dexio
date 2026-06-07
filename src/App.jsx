import { useState, useEffect } from 'react'
import { sb } from './supabase'
import { ALL_STICKERS, SERIES, RARITY, PACK_COST, rollPack } from './data'
import { StickerCard } from './StickerCard'
import { STICKER_ICONS } from './icons'
import { PackReveal } from './PackReveal'
import { AuthScreen } from './AuthScreen'
import { TradeMarket } from './TradeMarket'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [collection, setCollection] = useState([])
  const [trades, setTrades] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [tab, setTab] = useState('collect')
  const [packResult, setPackResult] = useState(null)
  const [modal, setModal] = useState(null)
  const [notif, setNotif] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tradeOffer, setTradeOffer] = useState({ offerSticker: null, wantSticker: null, targetUser: null })

  const showNotif = (msg, type = 'success') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif(null), 3000)
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (data.session) setUser(data.session.user)
      else setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session) { setProfile(null); setCollection([]); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    loadProfile()
    loadCollection()
    loadTrades()
    loadAllUsers()
    const channel = sb.channel('trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sv_trades' }, () => loadTrades())
      .subscribe()
    return () => sb.removeChannel(channel)
  }, [user])

  const loadProfile = async () => {
    let { data } = await sb.from("sv_profiles").select("*").eq("id", user.id).single()
    if (!data) {
      const res = await sb.from("sv_profiles").insert({ id: user.id, username: user.email.split("@")[0], coins: 150 }).select().single()
      data = res.data
    }
    setProfile(data)
    setLoading(false)
  }
  const loadCollection = async () => {
    const { data } = await sb.from('sv_collection').select('*').eq('user_id', user.id)
    setCollection(data || [])
  }
  const loadTrades = async () => {
    const { data } = await sb.from('sv_trades')
      .select('*, from_profile:sv_profiles!sv_trades_from_user_fkey(username), to_profile:sv_profiles!sv_trades_to_user_fkey(username)')
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
      .eq('status', 'pending')
    setTrades(data || [])
  }
  const loadAllUsers = async () => {
    const { data } = await sb.from('sv_profiles').select('id, username')
    setAllUsers((data || []).filter(u => u.id !== user.id))
  }

  const ownedIds = new Set(collection.map(c => c.sticker_id))
  const tradeIds = new Set(collection.filter(c => c.for_trade).map(c => c.sticker_id))
  const myTrades = trades.filter(t => t.to_user === user?.id)
  const sentTrades = trades.filter(t => t.from_user === user?.id)
  const ownedStickers = ALL_STICKERS.filter(s => ownedIds.has(s.id))
  const completionPct = Math.round((ownedIds.size / ALL_STICKERS.length) * 100)

  const openPack = async () => {
    if ((profile?.coins ?? 0) < PACK_COST) { showNotif('Not enough coins!', 'error'); return }
    const pack = rollPack()
    await sb.from('sv_profiles').update({ coins: profile.coins - PACK_COST }).eq('id', user.id)
    setProfile(p => ({ ...p, coins: p.coins - PACK_COST }))
    setPackResult(pack)
  }

  const claimPack = async () => {
    const newOnes = packResult.filter(s => !ownedIds.has(s.id))
    if (newOnes.length > 0) {
      const { error } = await sb.from('sv_collection')
        .upsert(
          newOnes.map(s => ({ user_id: user.id, sticker_id: s.id })),
          { onConflict: 'user_id,sticker_id' }
        )
      if (error) {
        console.error('claimPack error:', error)
        showNotif('Error saving stickers: ' + error.message, 'error')
        return
      }
      await loadCollection()
    }
    showNotif(`+${packResult.length} stickers added!`)
    setPackResult(null)
  }

  const toggleTrade = async (stickerId) => {
    const current = collection.find(c => c.sticker_id === stickerId)
    await sb.from('sv_collection').update({ for_trade: !current.for_trade })
      .eq('user_id', user.id).eq('sticker_id', stickerId)
    setCollection(prev => prev.map(c => c.sticker_id === stickerId ? { ...c, for_trade: !c.for_trade } : c))
    showNotif(current.for_trade ? 'Removed from listings' : 'Listed for trade!')
  }

  const earnCoins = async () => {
    const newCoins = (profile?.coins ?? 0) + 25
    await sb.from('sv_profiles').update({ coins: newCoins }).eq('id', user.id)
    setProfile(p => ({ ...p, coins: newCoins }))
    showNotif('+25 coins!')
  }

  const sendTradeOffer = async () => {
    const { offerSticker, wantSticker, targetUser } = tradeOffer
    if (!offerSticker || !wantSticker || !targetUser) { showNotif('Fill in all fields', 'error'); return }
    await sb.from('sv_trades').insert({ from_user: user.id, to_user: targetUser.id, offer_sticker_id: offerSticker.id, want_sticker_id: wantSticker.id })
    setTradeOffer({ offerSticker: null, wantSticker: null, targetUser: null })
    setModal(null)
    showNotif('Trade offer sent!')
  }

  const respondTrade = async (trade, accept) => {
    if (accept) {
      await sb.from('sv_collection').delete().eq('user_id', trade.from_user).eq('sticker_id', trade.offer_sticker_id)
      await sb.from('sv_collection').delete().eq('user_id', trade.to_user).eq('sticker_id', trade.want_sticker_id)
      await sb.from('sv_collection').upsert([
        { user_id: trade.to_user, sticker_id: trade.offer_sticker_id },
        { user_id: trade.from_user, sticker_id: trade.want_sticker_id },
      ])
      await loadCollection()
      showNotif('Trade accepted! Stickers swapped!')
    } else {
      showNotif('Trade declined.')
    }
    await sb.from('sv_trades').update({ status: accept ? 'accepted' : 'declined' }).eq('id', trade.id)
    loadTrades()
  }

  const inp = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#F1F5F9', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }

  if (!user && !loading) return <AuthScreen onAuth={u => setUser(u)} />
  if (loading) return <div style={{ minHeight: '100vh', background: '#0F0A1E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', fontSize: 32 }}>✦</div>

  return (
    <div style={{ minHeight: '100vh', background: '#0F0A1E', fontFamily: 'Nunito, sans-serif', maxWidth: 430, margin: '0 auto', paddingBottom: 80 }}>

      {notif && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: notif.type === 'error' ? '#DC2626' : '#059669', color: '#fff', padding: '10px 24px', borderRadius: 30, fontSize: 13, fontWeight: 700, zIndex: 999, whiteSpace: 'nowrap' }}>{notif.msg}</div>}

      {packResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#1E1040', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400, border: '1px solid rgba(124,58,237,0.3)' }}>
            <PackReveal stickers={packResult} onDone={claimPack} />
          </div>
        </div>
      )}

      {modal?.type === 'compose_trade' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModal(null)}>
          <div style={{ background: '#1A1035', borderRadius: 24, padding: 24, width: '100%', maxWidth: 380, border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#F1F5F9', marginBottom: 16 }}>Send Trade Offer</div>
            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>TRADE WITH</div>
            <select style={{ ...inp, marginBottom: 14 }} value={tradeOffer.targetUser?.id || ''} onChange={e => setTradeOffer(t => ({ ...t, targetUser: allUsers.find(u => u.id === e.target.value) }))}>
              <option value="">Select a player...</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>YOU OFFER</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14, maxHeight: 140, overflowY: 'auto' }}>
              {ownedStickers.map(s => (
                <div key={s.id} onClick={() => setTradeOffer(t => ({ ...t, offerSticker: s }))} style={{ background: tradeOffer.offerSticker?.id === s.id ? 'rgba(124,58,237,0.4)' : s.bg, borderRadius: 10, padding: '8px 4px', textAlign: 'center', cursor: 'pointer', border: `2px solid ${tradeOffer.offerSticker?.id === s.id ? '#7C3AED' : 'transparent'}` }}>
                  <div style={{ width:24, height:24, imageRendering:'pixelated' }} dangerouslySetInnerHTML={{ __html: STICKER_ICONS[s.id] || s.emoji }} />
                  <div style={{ fontSize: 8, color: '#E2E8F0', fontWeight: 700 }}>{s.name.split(' ')[0]}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>YOU WANT</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 16, maxHeight: 140, overflowY: 'auto' }}>
              {ALL_STICKERS.filter(s => !ownedIds.has(s.id)).map(s => (
                <div key={s.id} onClick={() => setTradeOffer(t => ({ ...t, wantSticker: s }))} style={{ background: tradeOffer.wantSticker?.id === s.id ? 'rgba(245,158,11,0.4)' : s.bg, borderRadius: 10, padding: '8px 4px', textAlign: 'center', cursor: 'pointer', border: `2px solid ${tradeOffer.wantSticker?.id === s.id ? '#F59E0B' : 'transparent'}` }}>
                  <div style={{ width:24, height:24, imageRendering:'pixelated' }} dangerouslySetInnerHTML={{ __html: STICKER_ICONS[s.id] || s.emoji }} />
                  <div style={{ fontSize: 8, color: '#E2E8F0', fontWeight: 700 }}>{s.name.split(' ')[0]}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={sendTradeOffer} style={{ flex: 1, background: 'linear-gradient(135deg,#7C3AED,#DB2777)', border: 'none', borderRadius: 12, padding: '12px 0', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Send 🤝</button>
              <button onClick={() => setModal(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 0', color: '#64748B', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'sticker' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModal(null)}>
          <div style={{ background: '#1A1035', borderRadius: 24, padding: 24, width: '100%', maxWidth: 320, border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <StickerCard sticker={modal.data} owned forTrade={tradeIds.has(modal.data.id)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => { toggleTrade(modal.data.id); setModal(null) }} style={{ flex: 1, background: tradeIds.has(modal.data.id) ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${tradeIds.has(modal.data.id) ? '#EF4444' : '#F59E0B'}`, borderRadius: 12, padding: '10px 0', color: tradeIds.has(modal.data.id) ? '#EF4444' : '#F59E0B', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                {tradeIds.has(modal.data.id) ? 'Remove Trade' : 'List for Trade'}
              </button>
              <button onClick={() => setModal(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 0', color: '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '20px 20px 16px', background: 'linear-gradient(180deg,#1E1040 0%,#0F0A1E 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Syne, sans-serif', color: '#F1F5F9', letterSpacing: -0.5 }}>✦ StickerVault</div>
            <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, letterSpacing: 2, marginTop: 1 }}>{profile?.username ? `@${profile.username}` : 'DIGITAL COLLECTIBLES'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: 'rgba(252,211,77,0.12)', border: '1px solid rgba(252,211,77,0.3)', borderRadius: 20, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>🪙</span><span style={{ color: '#FCD34D', fontWeight: 800, fontSize: 14 }}>{profile?.coins ?? 0}</span>
            </div>
            {myTrades.length > 0 && <div style={{ background: '#DC2626', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{myTrades.length}</div>}
            <button onClick={() => sb.auth.signOut()} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 10px', color: '#475569', fontSize: 11, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>OUT</button>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, letterSpacing: 1 }}>COLLECTION</span>
            <span style={{ fontSize: 10, color: '#7C3AED', fontWeight: 800 }}>{ownedIds.size}/{ALL_STICKERS.length} · {completionPct}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${completionPct}%`, height: '100%', borderRadius: 10, background: 'linear-gradient(90deg,#7C3AED,#DB2777,#F59E0B)', transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: '16px 16px 0' }}>

        {tab === 'collect' && (
          <div>
            <div style={{ background: 'linear-gradient(135deg,#2D1B69,#1E1040)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 20, padding: 20, marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>🎁</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#F1F5F9', fontFamily: 'Syne, sans-serif' }}>MYSTERY PACK</div>
              <div style={{ fontSize: 11, color: '#7C6AB0', marginTop: 4, marginBottom: 16 }}>5 random stickers · chance of legendaries</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={openPack} style={{ background: (profile?.coins ?? 0) >= PACK_COST ? 'linear-gradient(135deg,#7C3AED,#DB2777)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 30, padding: '13px 30px', color: (profile?.coins ?? 0) >= PACK_COST ? '#fff' : '#475569', fontSize: 14, fontWeight: 800, cursor: (profile?.coins ?? 0) >= PACK_COST ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>🪙 {PACK_COST} · Open Pack</button>
                <button onClick={earnCoins} style={{ background: 'rgba(252,211,77,0.1)', border: '1px solid rgba(252,211,77,0.25)', borderRadius: 30, padding: '13px 18px', color: '#FCD34D', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+25 🪙</button>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>SERIES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {SERIES.map(ser => {
                const total = ALL_STICKERS.filter(s => s.series === ser.id).length
                const owned = ALL_STICKERS.filter(s => s.series === ser.id && ownedIds.has(s.id)).length
                return (
                  <div key={ser.id} style={{ background: `linear-gradient(135deg,${ser.color}22,${ser.color}11)`, border: `1px solid ${ser.color}44`, borderRadius: 16, padding: '14px 12px' }}>
                    <div style={{ fontSize: 28 }}>{ser.emoji}</div>
                    <div style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 800, marginTop: 6 }}>{ser.name}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{owned}/{total}</div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 4, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(owned / total) * 100}%`, height: '100%', background: ser.color, borderRadius: 6 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>MY STICKERS</div>
            {ownedStickers.length === 0
              ? <div style={{ textAlign: 'center', color: '#334155', padding: 30, fontSize: 13 }}>Open your first pack!</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {ownedStickers.map(s => <StickerCard key={s.id} sticker={s} mini owned forTrade={tradeIds.has(s.id)} onClick={() => setModal({ type: 'sticker', data: s })} />)}
                </div>
            }
          </div>
        )}

        {tab === 'browse' && (
          <div>
            {SERIES.map(ser => (
              <div key={ser.id} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: ser.color, fontWeight: 800, marginBottom: 8 }}>{ser.emoji} {ser.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {ALL_STICKERS.filter(s => s.series === ser.id).map(s => (
                    <div key={s.id}>
                      <StickerCard sticker={s} mini owned={ownedIds.has(s.id)} forTrade={tradeIds.has(s.id)} onClick={ownedIds.has(s.id) ? () => setModal({ type: 'sticker', data: s }) : undefined} />
                      {!ownedIds.has(s.id) && <div style={{ textAlign: 'center', fontSize: 8, color: '#1E3A5F', marginTop: 2, fontWeight: 700 }}>LOCKED</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'trade' && (
          <div>
            {myTrades.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>🔔 INCOMING ({myTrades.length})</div>
                {myTrades.map(trade => {
                  const offerS = ALL_STICKERS.find(s => s.id === trade.offer_sticker_id)
                  const wantS = ALL_STICKERS.find(s => s.id === trade.want_sticker_id)
                  return (
                    <div key={trade.id} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: 14, marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>from <span style={{ color: '#A78BFA', fontWeight: 700 }}>@{trade.from_profile?.username}</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 28, background: offerS?.bg, borderRadius: 10, padding: '6px 8px' }}>{offerS?.emoji}</div>
                          <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 3 }}>{offerS?.name}</div>
                          <div style={{ fontSize: 8, color: '#60A5FA', fontWeight: 700 }}>THEY OFFER</div>
                        </div>
                        <div style={{ fontSize: 20, color: '#334155' }}>⇄</div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 28, background: wantS?.bg, borderRadius: 10, padding: '6px 8px' }}>{wantS?.emoji}</div>
                          <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 3 }}>{wantS?.name}</div>
                          <div style={{ fontSize: 8, color: '#F59E0B', fontWeight: 700 }}>THEY WANT</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => respondTrade(trade, true)} style={{ flex: 1, background: 'rgba(5,150,105,0.2)', border: '1px solid #059669', borderRadius: 10, padding: '8px 0', color: '#34D399', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Accept</button>
                        <button onClick={() => respondTrade(trade, false)} style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 0', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Decline</button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
            {sentTrades.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: 2, margin: '16px 0 10px' }}>SENT OFFERS</div>
                {sentTrades.map(trade => {
                  const offerS = ALL_STICKERS.find(s => s.id === trade.offer_sticker_id)
                  const wantS = ALL_STICKERS.find(s => s.id === trade.want_sticker_id)
                  return (
                    <div key={trade.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 22, background: offerS?.bg, borderRadius: 8, padding: '4px 6px' }}>{offerS?.emoji}</div>
                      <div style={{ color: '#475569', fontSize: 16 }}>→</div>
                      <div style={{ fontSize: 22, background: wantS?.bg, borderRadius: 8, padding: '4px 6px' }}>{wantS?.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: '#64748B' }}>to <span style={{ color: '#A78BFA' }}>@{trade.to_profile?.username}</span></div>
                        <div style={{ fontSize: 9, color: '#F59E0B', fontWeight: 700, marginTop: 2 }}>PENDING...</div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: 2, margin: '16px 0 10px' }}>NEW TRADE</div>
            <button onClick={() => setModal({ type: 'compose_trade' })} style={{ width: '100%', background: 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(219,39,119,0.2))', border: '1px dashed rgba(124,58,237,0.4)', borderRadius: 16, padding: 20, color: '#A78BFA', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'inherit' }}>
              🤝 Propose a Trade
            </button>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: 2, margin: '20px 0 10px' }}>COMMUNITY MARKET</div>
            <TradeMarket userId={user?.id} ownedIds={ownedIds} onOffer={(targetUser, wantSticker) => { setTradeOffer(t => ({ ...t, targetUser, wantSticker })); setModal({ type: 'compose_trade' }) }} />
          </div>
        )}

        {tab === 'profile' && (
          <div>
            <div style={{ textAlign: 'center', padding: '10px 0 24px' }}>
              <div style={{ fontSize: 52 }}>👾</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#F1F5F9', fontFamily: 'Syne, sans-serif', marginTop: 8 }}>@{profile?.username}</div>
              <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700, letterSpacing: 2, marginTop: 4 }}>COLLECTOR</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[{ label: 'Owned', value: ownedIds.size, emoji: '📦' }, { label: 'Missing', value: ALL_STICKERS.length - ownedIds.size, emoji: '🔍' }, { label: 'Trading', value: tradeIds.size, emoji: '🔄' }].map(stat => (
                <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22 }}>{stat.emoji}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#F1F5F9', marginTop: 4 }}>{stat.value}</div>
                  <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: 1 }}>{stat.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>RARITY BREAKDOWN</div>
            {Object.entries(RARITY).reverse().map(([key, meta]) => {
              const count = ALL_STICKERS.filter(s => s.rarity === key && ownedIds.has(s.id)).length
              const total = ALL_STICKERS.filter(s => s.rarity === key).length
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 72, fontSize: 10, color: meta.color, fontWeight: 700 }}>{meta.label}</div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / total) * 100}%`, height: '100%', background: meta.color, borderRadius: 6, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ width: 32, fontSize: 10, color: '#64748B', fontWeight: 700, textAlign: 'right' }}>{count}/{total}</div>
                </div>
              )
            })}
            <div style={{ marginTop: 20 }}>
              <button onClick={earnCoins} style={{ width: '100%', background: 'rgba(252,211,77,0.1)', border: '1px solid rgba(252,211,77,0.25)', borderRadius: 14, padding: 14, color: '#FCD34D', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>🪙 Daily Reward (+25 coins)</button>
            </div>
            {allUsers.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: 2, margin: '20px 0 10px' }}>OTHER COLLECTORS</div>
                {allUsers.map(u => (
                  <div key={u.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 24 }}>👤</div>
                    <div style={{ flex: 1, fontSize: 13, color: '#E2E8F0', fontWeight: 700 }}>@{u.username}</div>
                    <button onClick={() => { setTradeOffer(t => ({ ...t, targetUser: u })); setModal({ type: 'compose_trade' }) }} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, padding: '5px 12px', color: '#A78BFA', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Trade</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: 'rgba(15,10,30,0.96)', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', backdropFilter: 'blur(20px)' }}>
        {[{ id: 'collect', emoji: '🎁', label: 'Collect' }, { id: 'browse', emoji: '🔍', label: 'Browse' }, { id: 'trade', emoji: '🔄', label: 'Trade', badge: myTrades.length }, { id: 'profile', emoji: '👤', label: 'Profile' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'none', border: 'none', padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', position: 'relative', fontFamily: 'inherit' }}>
            <div style={{ fontSize: 20 }}>{t.emoji}</div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? '#A78BFA' : '#334155' }}>{t.label.toUpperCase()}</div>
            {tab === t.id && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#7C3AED' }} />}
            {t.badge > 0 && <div style={{ position: 'absolute', top: 6, right: '20%', background: '#EF4444', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</div>}
          </button>
        ))}
      </div>
    </div>
  )
}
