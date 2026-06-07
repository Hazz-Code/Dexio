import { useState, useEffect } from 'react'
import { sb } from './supabase'
import { ALL_STICKERS, SERIES, RARITY, PACK_COST, rollPack } from './data'
import { StickerCard, PixelIcon } from './StickerCard'
import { PackReveal } from './PackReveal'
import { AuthScreen } from './AuthScreen'
import { TradeMarket } from './TradeMarket'
import { STICKER_ICONS } from './icons'

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
    loadProfile(); loadCollection(); loadTrades(); loadAllUsers()
    const ch = sb.channel('trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sv_trades' }, () => loadTrades())
      .subscribe()
    return () => sb.removeChannel(ch)
  }, [user])

  const loadProfile = async () => {
    let { data } = await sb.from('sv_profiles').select('*').eq('id', user.id).single()
    if (!data) {
      const res = await sb.from('sv_profiles').insert({ id: user.id, username: user.email.split('@')[0], coins: 150 }).select().single()
      data = res.data
    }
    setProfile(data); setLoading(false)
  }
  const loadCollection = async () => {
    const { data } = await sb.from('sv_collection').select('*').eq('user_id', user.id)
    setCollection(data || [])
  }
  const loadTrades = async () => {
    const { data } = await sb.from('sv_trades')
      .select('*, from_profile:sv_profiles!sv_trades_from_user_fkey(username), to_profile:sv_profiles!sv_trades_to_user_fkey(username)')
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`).eq('status', 'pending')
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
        .upsert(newOnes.map(s => ({ user_id: user.id, sticker_id: s.id })), { onConflict: 'user_id,sticker_id' })
      if (error) { showNotif('Error: ' + error.message, 'error'); return }
      await loadCollection()
    }
    showNotif(`+${packResult.length} stickers added!`)
    setPackResult(null)
  }

  const toggleTrade = async (stickerId) => {
    const current = collection.find(c => c.sticker_id === stickerId)
    await sb.from('sv_collection').update({ for_trade: !current.for_trade }).eq('user_id', user.id).eq('sticker_id', stickerId)
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
    setModal(null); showNotif('Trade offer sent!')
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
      showNotif('Trade complete! 🎉')
    } else { showNotif('Trade declined.') }
    await sb.from('sv_trades').update({ status: accept ? 'accepted' : 'declined' }).eq('id', trade.id)
    loadTrades()
  }

  const sel = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#F0F4FF', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }

  if (!user && !loading) return <AuthScreen onAuth={u => setUser(u)} />
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 32, height: 32, border: '2px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: 12, color: '#475569', letterSpacing: 2 }}>LOADING</div>
    </div>
  )

  const NAV = [
    { id: 'collect', icon: '⬡', label: 'Collect' },
    { id: 'browse',  icon: '◈',  label: 'Browse' },
    { id: 'trade',   icon: '⇄',  label: 'Trade', badge: myTrades.length },
    { id: 'profile', icon: '◉',  label: 'Profile' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#080C14', maxWidth: 430, margin: '0 auto', paddingBottom: 88, position: 'relative' }}>

      {/* Global ambient glow */}
      <div style={{ position: 'fixed', top: -100, left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Notification */}
      {notif && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: notif.type === 'error' ? 'rgba(220,38,38,0.95)' : 'rgba(5,150,105,0.95)',
          backdropFilter: 'blur(12px)',
          color: '#fff', padding: '10px 20px', borderRadius: 40,
          fontSize: 13, fontWeight: 600, zIndex: 999,
          border: `1px solid ${notif.type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)'}`,
          animation: 'fadeUp 0.25s ease', whiteSpace: 'nowrap',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>{notif.msg}</div>
      )}

      {/* Pack reveal overlay */}
      {packResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'rgba(15,20,35,0.98)', borderRadius: 28, padding: 28, width: '100%', maxWidth: 400, border: '1px solid rgba(124,58,237,0.25)', boxShadow: '0 0 80px rgba(124,58,237,0.2)' }}>
            <PackReveal stickers={packResult} onDone={claimPack} />
          </div>
        </div>
      )}

      {/* Trade compose modal */}
      {modal?.type === 'compose_trade' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }} onClick={() => setModal(null)}>
          <div style={{ background: '#0D1220', borderRadius: 24, padding: 24, width: '100%', maxWidth: 380, border: '1px solid rgba(255,255,255,0.07)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>Propose Trade</div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 18 }}>Select what you'll offer and what you want</div>

            <Label>Trade with</Label>
            <select style={{ ...sel, marginBottom: 16 }} value={tradeOffer.targetUser?.id || ''} onChange={e => setTradeOffer(t => ({ ...t, targetUser: allUsers.find(u => u.id === e.target.value) }))}>
              <option value="">Select a player...</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>

            <Label>You offer</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 16, maxHeight: 130, overflowY: 'auto' }}>
              {ownedStickers.map(s => (
                <MiniPicker key={s.id} sticker={s} selected={tradeOffer.offerSticker?.id === s.id} accent="#7C3AED"
                  onClick={() => setTradeOffer(t => ({ ...t, offerSticker: s }))} />
              ))}
            </div>

            <Label>You want</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 20, maxHeight: 130, overflowY: 'auto' }}>
              {ALL_STICKERS.filter(s => !ownedIds.has(s.id)).map(s => (
                <MiniPicker key={s.id} sticker={s} selected={tradeOffer.wantSticker?.id === s.id} accent="#F59E0B"
                  onClick={() => setTradeOffer(t => ({ ...t, wantSticker: s }))} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={sendTradeOffer} style={{ flex: 1, background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', border: 'none', borderRadius: 12, padding: '12px 0', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Send Offer</button>
              <button onClick={() => setModal(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 0', color: '#64748B', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Sticker detail modal */}
      {modal?.type === 'sticker' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }} onClick={() => setModal(null)}>
          <div style={{ background: '#0D1220', borderRadius: 24, padding: 24, width: '100%', maxWidth: 300, border: '1px solid rgba(255,255,255,0.07)' }} onClick={e => e.stopPropagation()}>
            <StickerCard sticker={modal.data} owned forTrade={tradeIds.has(modal.data.id)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => { toggleTrade(modal.data.id); setModal(null) }} style={{
                flex: 1,
                background: tradeIds.has(modal.data.id) ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${tradeIds.has(modal.data.id) ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                borderRadius: 12, padding: '11px 0',
                color: tradeIds.has(modal.data.id) ? '#EF4444' : '#F59E0B',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {tradeIds.has(modal.data.id) ? 'Remove Trade' : 'List for Trade'}
              </button>
              <button onClick={() => setModal(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '11px 0', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ padding: '20px 20px 16px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#F0F4FF', letterSpacing: -0.5 }}>
              Dexio <span style={{ color: '#7C3AED' }}>✦</span>
            </div>
            {profile?.username && <div style={{ fontSize: 12, color: '#475569', marginTop: 1 }}>@{profile.username}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {myTrades.length > 0 && (
              <div style={{ background: '#EF4444', color: '#fff', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                {myTrades.length} trade{myTrades.length > 1 ? 's' : ''}
              </div>
            )}
            {/* Coin chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: 20, padding: '6px 12px' }}>
              <div style={{ width: 14, height: 14, background: '#FCD34D', borderRadius: '50%', boxShadow: '0 0 8px #FCD34D88' }} />
              <span style={{ color: '#FCD34D', fontWeight: 700, fontSize: 14 }}>{profile?.coins ?? 0}</span>
            </div>
            <button onClick={() => sb.auth.signOut()} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '6px 12px', color: '#475569', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Sign out</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: 0.5 }}>Collection</span>
            <span style={{ fontSize: 12, color: '#A78BFA', fontWeight: 700 }}>{ownedIds.size} / {ALL_STICKERS.length}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, height: 5, overflow: 'hidden' }}>
            <div style={{ width: `${completionPct}%`, height: '100%', borderRadius: 10, background: 'linear-gradient(90deg, #7C3AED, #A78BFA)', transition: 'width 0.6s ease', boxShadow: '0 0 8px #7C3AED88' }} />
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: '0 16px', position: 'relative', zIndex: 10 }}>

        {/* COLLECT */}
        {tab === 'collect' && (
          <div style={{ animation: 'fadeUp 0.25s ease' }}>
            {/* Pack card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(109,40,217,0.1) 100%)',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 22, padding: '22px 20px', marginBottom: 20,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ fontSize: 13, color: '#A78BFA', fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>MYSTERY PACK</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>Open a Pack</div>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 18 }}>5 random stickers · common to legendary</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={openPack} disabled={(profile?.coins ?? 0) < PACK_COST} style={{
                  background: (profile?.coins ?? 0) >= PACK_COST ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : 'rgba(255,255,255,0.05)',
                  border: (profile?.coins ?? 0) >= PACK_COST ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '12px 22px',
                  color: (profile?.coins ?? 0) >= PACK_COST ? '#fff' : '#334155',
                  fontSize: 14, fontWeight: 700, cursor: (profile?.coins ?? 0) >= PACK_COST ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', transition: 'opacity 0.2s',
                  boxShadow: (profile?.coins ?? 0) >= PACK_COST ? '0 4px 20px rgba(124,58,237,0.4)' : 'none',
                }}>🎁 Open — {PACK_COST} coins</button>
                <button onClick={earnCoins} style={{ background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: 14, padding: '12px 16px', color: '#FCD34D', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ 25</button>
              </div>
            </div>

            {/* Series grid */}
            <SectionLabel>Series</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {SERIES.map(ser => {
                const total = ALL_STICKERS.filter(s => s.series === ser.id).length
                const owned = ALL_STICKERS.filter(s => s.series === ser.id && ownedIds.has(s.id)).length
                const pct = Math.round((owned / total) * 100)
                return (
                  <div key={ser.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '14px 14px 12px', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = `${ser.color}55`}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{ser.emoji}</div>
                    <div style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 700, marginBottom: 2 }}>{ser.name}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>{owned}/{total} collected</div>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: ser.color, borderRadius: 6, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* My stickers */}
            <SectionLabel>{ownedStickers.length > 0 ? `My Stickers — ${ownedStickers.length}` : 'My Stickers'}</SectionLabel>
            {ownedStickers.length === 0
              ? <EmptyState icon="🎁" text="Open your first pack to start collecting!" />
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {ownedStickers.map((s, i) => (
                    <div key={s.id} style={{ animation: `fadeUp 0.3s ease ${i * 0.04}s both` }}>
                      <StickerCard sticker={s} mini owned forTrade={tradeIds.has(s.id)} onClick={() => setModal({ type: 'sticker', data: s })} />
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* BROWSE */}
        {tab === 'browse' && (
          <div style={{ animation: 'fadeUp 0.25s ease' }}>
            {SERIES.map(ser => (
              <div key={ser.id} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 3, height: 16, background: ser.color, borderRadius: 2 }} />
                  <div style={{ fontSize: 14, color: '#E2E8F0', fontWeight: 700 }}>{ser.name}</div>
                  <div style={{ fontSize: 11, color: '#334155', marginLeft: 'auto' }}>
                    {ALL_STICKERS.filter(s => s.series === ser.id && ownedIds.has(s.id)).length}/{ALL_STICKERS.filter(s => s.series === ser.id).length}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {ALL_STICKERS.filter(s => s.series === ser.id).map(s => (
                    <div key={s.id} style={{ position: 'relative' }}>
                      <StickerCard sticker={s} mini owned={ownedIds.has(s.id)} forTrade={tradeIds.has(s.id)}
                        onClick={ownedIds.has(s.id) ? () => setModal({ type: 'sticker', data: s }) : undefined} />
                      {!ownedIds.has(s.id) && (
                        <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#334155', fontWeight: 700, letterSpacing: 1 }}>LOCKED</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TRADE */}
        {tab === 'trade' && (
          <div style={{ animation: 'fadeUp 0.25s ease' }}>
            {myTrades.length > 0 && (
              <>
                <SectionLabel style={{ color: '#EF4444' }}>Incoming Offers</SectionLabel>
                {myTrades.map(trade => {
                  const offerS = ALL_STICKERS.find(s => s.id === trade.offer_sticker_id)
                  const wantS = ALL_STICKERS.find(s => s.id === trade.want_sticker_id)
                  return (
                    <div key={trade.id} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 18, padding: 16, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>from <span style={{ color: '#A78BFA', fontWeight: 700 }}>@{trade.from_profile?.username}</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <TradeSticker sticker={offerS} label="They offer" />
                        <div style={{ color: '#334155', fontSize: 18, fontWeight: 300 }}>⇄</div>
                        <TradeSticker sticker={wantS} label="They want" />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => respondTrade(trade, true)} style={{ flex: 1, background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 0', color: '#34D399', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Accept</button>
                        <button onClick={() => respondTrade(trade, false)} style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 0', color: '#F87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Decline</button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {sentTrades.length > 0 && (
              <>
                <SectionLabel>Sent Offers</SectionLabel>
                {sentTrades.map(trade => {
                  const offerS = ALL_STICKERS.find(s => s.id === trade.offer_sticker_id)
                  const wantS = ALL_STICKERS.find(s => s.id === trade.want_sticker_id)
                  return (
                    <div key={trade.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ background: offerS?.bg, borderRadius: 10, padding: '5px 6px', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 24, height: 24, imageRendering: 'pixelated' }} dangerouslySetInnerHTML={{ __html: STICKER_ICONS[offerS?.id] || '' }} />
                      </div>
                      <div style={{ color: '#334155' }}>→</div>
                      <div style={{ background: wantS?.bg, borderRadius: 10, padding: '5px 6px', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 24, height: 24, imageRendering: 'pixelated' }} dangerouslySetInnerHTML={{ __html: STICKER_ICONS[wantS?.id] || '' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: '#475569' }}>to <span style={{ color: '#A78BFA', fontWeight: 600 }}>@{trade.to_profile?.username}</span></div>
                        <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, marginTop: 2 }}>Pending</div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            <button onClick={() => setModal({ type: 'compose_trade' })} style={{
              width: '100%', background: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(124,58,237,0.3)', borderRadius: 18, padding: 18, color: '#A78BFA', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 24, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>⇄ Propose a Trade</button>

            <SectionLabel>Community Market</SectionLabel>
            <TradeMarket userId={user?.id} ownedIds={ownedIds} onOffer={(targetUser, wantSticker) => {
              setTradeOffer(t => ({ ...t, targetUser, wantSticker }))
              setModal({ type: 'compose_trade' })
            }} />
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div style={{ animation: 'fadeUp 0.25s ease' }}>
            {/* Avatar card */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 22, padding: 20, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #7C3AED, #DB2777)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👾</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F0F4FF' }}>@{profile?.username}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Collector · {completionPct}% complete</div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Owned', value: ownedIds.size, color: '#A78BFA' },
                { label: 'Missing', value: ALL_STICKERS.length - ownedIds.size, color: '#64748B' },
                { label: 'Trading', value: tradeIds.size, color: '#F59E0B' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '14px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 3, fontWeight: 500 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Rarity breakdown */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 18, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 14, letterSpacing: 0.5 }}>RARITY BREAKDOWN</div>
              {Object.entries(RARITY).reverse().map(([key, meta]) => {
                const count = ALL_STICKERS.filter(s => s.rarity === key && ownedIds.has(s.id)).length
                const total = ALL_STICKERS.filter(s => s.rarity === key).length
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 68, fontSize: 11, color: meta.color, fontWeight: 600 }}>{meta.label}</div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(count / total) * 100}%`, height: '100%', background: meta.color, borderRadius: 6, transition: 'width 0.6s ease', boxShadow: `0 0 6px ${meta.color}88` }} />
                    </div>
                    <div style={{ width: 30, fontSize: 11, color: '#475569', fontWeight: 600, textAlign: 'right' }}>{count}/{total}</div>
                  </div>
                )
              })}
            </div>

            <button onClick={earnCoins} style={{ width: '100%', background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.15)', borderRadius: 16, padding: 14, color: '#FCD34D', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
              Claim Daily Reward — +25 coins
            </button>

            {allUsers.length > 0 && (
              <>
                <SectionLabel>Other Collectors</SectionLabel>
                {allUsers.map(u => (
                  <div key={u.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, background: 'rgba(124,58,237,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
                    <div style={{ flex: 1, fontSize: 14, color: '#E2E8F0', fontWeight: 600 }}>@{u.username}</div>
                    <button onClick={() => { setTradeOffer(t => ({ ...t, targetUser: u })); setModal({ type: 'compose_trade' }) }} style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '6px 14px', color: '#A78BFA', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Trade</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        background: 'rgba(8,12,20,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        padding: '8px 0 20px',
        zIndex: 50,
      }}>
        {NAV.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'none', border: 'none', padding: '8px 0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', position: 'relative', fontFamily: 'inherit' }}>
            <div style={{
              fontSize: 18, lineHeight: 1,
              color: tab === t.id ? '#A78BFA' : '#334155',
              transition: 'color 0.2s',
              filter: tab === t.id ? 'drop-shadow(0 0 6px #7C3AED88)' : 'none',
            }}>{t.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3, color: tab === t.id ? '#A78BFA' : '#334155', transition: 'color 0.2s' }}>{t.label}</div>
            {tab === t.id && <div style={{ position: 'absolute', bottom: 0, width: 20, height: 2, background: '#7C3AED', borderRadius: 2, boxShadow: '0 0 8px #7C3AED' }} />}
            {t.badge > 0 && <div style={{ position: 'absolute', top: 4, right: '18%', background: '#EF4444', borderRadius: '50%', width: 15, height: 15, fontSize: 8, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</div>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────
function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: 1, marginBottom: 10, marginTop: 4, textTransform: 'uppercase' }}>{children}</div>
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' }}>{children}</div>
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 20px', color: '#1E3A5F', fontSize: 13, background: 'rgba(255,255,255,0.02)', borderRadius: 18, border: '1px dashed rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      {text}
    </div>
  )
}

function MiniPicker({ sticker, selected, accent, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: selected ? `${accent}33` : sticker.bg + '99',
      borderRadius: 10, padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
      border: `2px solid ${selected ? accent : 'transparent'}`,
      transition: 'border-color 0.15s',
    }}>
      <div style={{ width: 28, height: 28, imageRendering: 'pixelated', margin: '0 auto' }}
        dangerouslySetInnerHTML={{ __html: STICKER_ICONS[sticker.id] || sticker.emoji }} />
    </div>
  )
}

function TradeSticker({ sticker, label }) {
  if (!sticker) return null
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ background: sticker.bg, borderRadius: 12, padding: '8px', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52 }}>
        <div style={{ width: 36, height: 36, imageRendering: 'pixelated' }} dangerouslySetInnerHTML={{ __html: STICKER_ICONS[sticker.id] || '' }} />
      </div>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{sticker.name}</div>
      <div style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>{label}</div>
    </div>
  )
}
