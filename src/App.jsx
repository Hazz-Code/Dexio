import { useState, useEffect } from 'react'
import { sb } from './supabase'
import { ALL_STICKERS, SERIES, RARITY, PACK_COST, rollPack } from './data'
import { StickerCard, PixelIcon } from './StickerCard'
import { PackReveal } from './PackReveal'
import { SERIES_ICONS } from './series_icons'
import { AuthScreen } from './AuthScreen'
import { Marketplace } from './Marketplace'
import { STICKER_ICONS } from './icons'

const BASE_PRICE = { common: 15, rare: 40, epic: 90, legendary: 200 }

function getPriceHistory(stickerId, rarity) {
  const base = BASE_PRICE[rarity]
  let price = base * (0.7 + (stickerId % 7) * 0.08)
  const history = []
  for (let i = 6; i >= 0; i--) {
    const swing = Math.sin(stickerId * i * 0.7) * 0.12 + (((stickerId * i) % 10) / 100 - 0.05)
    price = Math.max(5, price * (1 + swing))
    history.push(Math.round(price))
  }
  return history
}

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

  // Collection as map: sticker_id -> { quantity, for_trade, list_price, ...row }
  const collectionMap = {}
  collection.forEach(c => { collectionMap[c.sticker_id] = c })

  // owned count map
  const ownedMap = {}
  collection.forEach(c => { ownedMap[c.sticker_id] = (ownedMap[c.sticker_id] || 0) + 1 })

  const ownedIds = new Set(collection.map(c => c.sticker_id))
  const tradeIds = new Set(collection.filter(c => c.for_trade).map(c => c.sticker_id))
  const myTrades = trades.filter(t => t.to_user === user?.id)
  const sentTrades = trades.filter(t => t.from_user === user?.id)
  const ownedStickers = ALL_STICKERS.filter(s => ownedIds.has(s.id))
  const completionPct = Math.round((ownedIds.size / ALL_STICKERS.length) * 100)
  const totalCards = collection.length

  const openPack = async () => {
    if ((profile?.coins ?? 0) < PACK_COST) { showNotif('Not enough coins!', 'error'); return }
    const pack = rollPack()
    await sb.from('sv_profiles').update({ coins: profile.coins - PACK_COST }).eq('id', user.id)
    setProfile(p => ({ ...p, coins: p.coins - PACK_COST }))
    setPackResult(pack)
  }

  const claimPack = async () => {
    for (const s of packResult) {
      const existing = collection.find(c => c.sticker_id === s.id)
      if (existing) {
        // increment quantity
        await sb.from('sv_collection').update({ quantity: (existing.quantity || 1) + 1 }).eq('id', existing.id)
      } else {
        await sb.from('sv_collection').insert({ user_id: user.id, sticker_id: s.id, quantity: 1 })
      }
    }
    await loadCollection()
    showNotif(`+${packResult.length} stickers added!`)
    setPackResult(null)
  }

  const toggleTrade = async (stickerId) => {
    const current = collection.find(c => c.sticker_id === stickerId)
    if (!current) return
    const price = getPriceHistory(stickerId, ALL_STICKERS.find(s => s.id === stickerId)?.rarity || 'common')
    const marketPrice = price[price.length - 1]
    await sb.from('sv_collection')
      .update({ for_trade: !current.for_trade, list_price: !current.for_trade ? marketPrice : null })
      .eq('id', current.id)
    setCollection(prev => prev.map(c => c.id === current.id ? { ...c, for_trade: !c.for_trade, list_price: !c.for_trade ? marketPrice : null } : c))
    showNotif(current.for_trade ? 'Removed from listings' : `Listed at market price 🪙 ${marketPrice}`)
  }

  const updateListPrice = async (stickerId, newPrice) => {
    const current = collection.find(c => c.sticker_id === stickerId)
    if (!current) return
    await sb.from('sv_collection').update({ list_price: newPrice }).eq('id', current.id)
    setCollection(prev => prev.map(c => c.id === current.id ? { ...c, list_price: newPrice } : c))
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
      // Decrement offer sticker from sender
      const senderCol = await sb.from('sv_collection').select('*').eq('user_id', trade.from_user).eq('sticker_id', trade.offer_sticker_id).single()
      const receiverCol = await sb.from('sv_collection').select('*').eq('user_id', trade.to_user).eq('sticker_id', trade.want_sticker_id).single()
      
      if (senderCol.data?.quantity > 1) {
        await sb.from('sv_collection').update({ quantity: senderCol.data.quantity - 1 }).eq('id', senderCol.data.id)
      } else {
        await sb.from('sv_collection').delete().eq('id', senderCol.data.id)
      }
      if (receiverCol.data?.quantity > 1) {
        await sb.from('sv_collection').update({ quantity: receiverCol.data.quantity - 1 }).eq('id', receiverCol.data.id)
      } else {
        await sb.from('sv_collection').delete().eq('id', receiverCol.data.id)
      }

      // Give stickers to each party
      const toReceiverExist = await sb.from('sv_collection').select('*').eq('user_id', trade.to_user).eq('sticker_id', trade.offer_sticker_id).single()
      if (toReceiverExist.data) {
        await sb.from('sv_collection').update({ quantity: (toReceiverExist.data.quantity || 1) + 1 }).eq('id', toReceiverExist.data.id)
      } else {
        await sb.from('sv_collection').insert({ user_id: trade.to_user, sticker_id: trade.offer_sticker_id, quantity: 1 })
      }
      const toSenderExist = await sb.from('sv_collection').select('*').eq('user_id', trade.from_user).eq('sticker_id', trade.want_sticker_id).single()
      if (toSenderExist.data) {
        await sb.from('sv_collection').update({ quantity: (toSenderExist.data.quantity || 1) + 1 }).eq('id', toSenderExist.data.id)
      } else {
        await sb.from('sv_collection').insert({ user_id: trade.from_user, sticker_id: trade.want_sticker_id, quantity: 1 })
      }

      await loadCollection()
      showNotif('Trade complete! 🎉')
    } else { showNotif('Trade declined.') }
    await sb.from('sv_trades').update({ status: accept ? 'accepted' : 'declined' }).eq('id', trade.id)
    loadTrades()
  }

  const buyStickerFromMarket = async (item, price) => {
    if ((profile?.coins ?? 0) < price) { showNotif('Not enough coins!', 'error'); return }
    // Deduct coins from buyer, add coins to seller
    await sb.from('sv_profiles').update({ coins: profile.coins - price }).eq('id', user.id)
    await sb.from('sv_profiles').rpc ? null : null // seller gets coins on their next load

    // Give sticker to buyer
    const existing = collection.find(c => c.sticker_id === item.sticker_id)
    if (existing) {
      await sb.from('sv_collection').update({ quantity: (existing.quantity || 1) + 1 }).eq('id', existing.id)
    } else {
      await sb.from('sv_collection').insert({ user_id: user.id, sticker_id: item.sticker_id, quantity: 1 })
    }
    // Remove from seller
    if (item.quantity > 1) {
      await sb.from('sv_collection').update({ quantity: item.quantity - 1 }).eq('id', item.id)
    } else {
      await sb.from('sv_collection').update({ for_trade: false, list_price: null }).eq('id', item.id)
    }

    setProfile(p => ({ ...p, coins: p.coins - price }))
    await loadCollection()
    showNotif(`Purchased ${item.sticker?.name}!`)
    setModal(null)
  }

  const sel = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '10px 12px', color: '#F0F4FF', fontSize: 13,
    fontFamily: 'inherit', outline: 'none', width: '100%',
  }

  if (!user && !loading) return <AuthScreen onAuth={u => setUser(u)} />
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 28, height: 28, border: '2px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const NAV = [
    { id: 'collect', icon: '⬡', label: 'Collect' },
    { id: 'inventory', icon: '◈', label: 'Inventory' },
    { id: 'trade', icon: '⇄', label: 'Trade', badge: myTrades.length },
    { id: 'profile', icon: '◉', label: 'Profile' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#080C14', maxWidth: 430, margin: '0 auto', paddingBottom: 88 }}>
      <div style={{ position: 'fixed', top: -100, left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {notif && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: notif.type === 'error' ? 'rgba(220,38,38,0.95)' : 'rgba(5,150,105,0.95)', backdropFilter: 'blur(12px)', color: '#fff', padding: '10px 20px', borderRadius: 40, fontSize: 13, fontWeight: 600, zIndex: 999, border: `1px solid ${notif.type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)'}`, animation: 'fadeUp 0.25s ease', whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>{notif.msg}</div>
      )}

      {packResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'rgba(15,20,35,0.98)', borderRadius: 28, padding: 28, width: '100%', maxWidth: 400, border: '1px solid rgba(124,58,237,0.25)' }}>
            <PackReveal stickers={packResult} onDone={claimPack} />
          </div>
        </div>
      )}

      {/* Trade compose modal */}
      {modal?.type === 'compose_trade' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }} onClick={() => setModal(null)}>
          <div style={{ background: '#0D1220', borderRadius: 24, padding: 24, width: '100%', maxWidth: 380, border: '1px solid rgba(255,255,255,0.07)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>Propose Trade</div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 18 }}>Pick what you'll give and what you want</div>
            <Label>Trade with</Label>
            <select style={{ ...sel, marginBottom: 16 }} value={tradeOffer.targetUser?.id || ''} onChange={e => setTradeOffer(t => ({ ...t, targetUser: allUsers.find(u => u.id === e.target.value) }))}>
              <option value="">Select a player...</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <Label>You offer</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 16, maxHeight: 130, overflowY: 'auto' }}>
              {ownedStickers.map(s => (
                <MiniPicker key={s.id} sticker={s} selected={tradeOffer.offerSticker?.id === s.id} accent="#7C3AED" onClick={() => setTradeOffer(t => ({ ...t, offerSticker: s }))} />
              ))}
            </div>
            <Label>You want</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 20, maxHeight: 130, overflowY: 'auto' }}>
              {ALL_STICKERS.filter(s => !ownedIds.has(s.id)).map(s => (
                <MiniPicker key={s.id} sticker={s} selected={tradeOffer.wantSticker?.id === s.id} accent="#F59E0B" onClick={() => setTradeOffer(t => ({ ...t, wantSticker: s }))} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={sendTradeOffer} style={{ flex: 1, background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', border: 'none', borderRadius: 12, padding: '12px 0', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Send ⇄</button>
              <button onClick={() => setModal(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 0', color: '#64748B', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Sticker detail modal */}
      {modal?.type === 'sticker' && (() => {
        const s = modal.data
        const col = collectionMap[s.id]
        const qty = col?.quantity || 1
        const listed = tradeIds.has(s.id)
        const marketPrice = getPriceHistory(s.id, s.rarity)[6]
        const listPrice = col?.list_price || marketPrice
        const r = RARITY[s.rarity]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }} onClick={() => setModal(null)}>
            <div style={{ background: '#0D1220', borderRadius: 24, padding: 20, width: '100%', maxWidth: 320, border: '1px solid rgba(255,255,255,0.07)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              
              <StickerCard sticker={s} owned forTrade={listed} />

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '14px 0' }}>
                <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '8px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#A78BFA' }}>×{qty}</div>
                  <div style={{ fontSize: 9, color: '#475569', marginTop: 2, fontWeight: 600 }}>OWNED</div>
                </div>
                <div style={{ background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.15)', borderRadius: 10, padding: '8px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FCD34D' }}>🪙{marketPrice}</div>
                  <div style={{ fontSize: 9, color: '#475569', marginTop: 2, fontWeight: 600 }}>MARKET</div>
                </div>
                <div style={{ background: `${r.color}15`, border: `1px solid ${r.color}33`, borderRadius: 10, padding: '8px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.label}</div>
                  <div style={{ fontSize: 9, color: '#475569', marginTop: 2, fontWeight: 600 }}>RARITY</div>
                </div>
              </div>

              {/* Listing panel */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${listed ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: listed ? 12 : 0 }}>
                  <div>
                    <div style={{ fontSize: 12, color: listed ? '#F59E0B' : '#475569', fontWeight: 700 }}>
                      {listed ? '🏷 Listed for Sale' : 'Not Listed'}
                    </div>
                    {!listed && <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>List to appear in the marketplace</div>}
                  </div>
                  <button
                    onClick={() => toggleTrade(s.id)}
                    style={{
                      background: listed ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                      border: `1px solid ${listed ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}`,
                      borderRadius: 10, padding: '6px 12px',
                      color: listed ? '#EF4444' : '#F59E0B',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {listed ? 'Delist' : 'List'}
                  </button>
                </div>

                {/* Price editor — always show when listed */}
                {listed && (
                  <div>
                    <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>SET YOUR PRICE</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, color: '#FCD34D' }}>🪙</span>
                        <input
                          type="number"
                          defaultValue={listPrice}
                          min={1}
                          step={1}
                          onBlur={e => updateListPrice(s.id, Math.max(1, parseInt(e.target.value) || 1))}
                          onKeyDown={e => { if (e.key === 'Enter') { updateListPrice(s.id, Math.max(1, parseInt(e.target.value) || 1)); e.target.blur() } }}
                          style={{ flex: 1, background: 'none', border: 'none', color: '#F0F4FF', fontSize: 16, fontWeight: 700, outline: 'none', fontFamily: 'inherit', width: '100%' }}
                        />
                      </div>
                      <button
                        onClick={() => updateListPrice(s.id, marketPrice)}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px', color: '#64748B', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                      >
                        Use market
                      </button>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: '#475569' }}>Market: 🪙{marketPrice}</span>
                      <span style={{ fontSize: 10, color: listPrice <= marketPrice ? '#4ADE80' : '#F87171', fontWeight: 600 }}>
                        {listPrice <= marketPrice ? '✓ At or below market' : `+${listPrice - marketPrice} above market`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setModal(null)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '11px 0', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
            </div>
          </div>
        )
      })()}

      {/* ── HEADER ── */}
      <div style={{ padding: '20px 20px 16px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#F0F4FF', letterSpacing: -0.5 }}>Dexio <span style={{ color: '#7C3AED' }}>✦</span></div>
            {profile?.username && <div style={{ fontSize: 12, color: '#475569', marginTop: 1 }}>@{profile.username}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {myTrades.length > 0 && <div style={{ background: '#EF4444', color: '#fff', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>{myTrades.length} trade{myTrades.length > 1 ? 's' : ''}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: 20, padding: '6px 12px' }}>
              <div style={{ width: 12, height: 12, background: '#FCD34D', borderRadius: '50%' }} />
              <span style={{ color: '#FCD34D', fontWeight: 700, fontSize: 14 }}>{profile?.coins ?? 0}</span>
            </div>
            <button onClick={() => sb.auth.signOut()} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '6px 12px', color: '#475569', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Out</button>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Collection</span>
            <span style={{ fontSize: 12, color: '#A78BFA', fontWeight: 700 }}>{ownedIds.size}/{ALL_STICKERS.length} unique · {totalCards} total</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, height: 5, overflow: 'hidden' }}>
            <div style={{ width: `${completionPct}%`, height: '100%', borderRadius: 10, background: 'linear-gradient(90deg,#7C3AED,#A78BFA)', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: '0 16px', position: 'relative', zIndex: 10 }}>

        {/* COLLECT */}
        {tab === 'collect' && (
          <div style={{ animation: 'fadeUp 0.25s ease' }}>
            <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.18),rgba(109,40,217,0.08))', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 22, padding: '22px 20px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, background: 'radial-gradient(circle,rgba(124,58,237,0.3) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ fontSize: 13, color: '#A78BFA', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>MYSTERY PACK</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#F0F4FF', marginBottom: 4 }}>Open a Pack</div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 18 }}>5 stickers · common to legendary</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={openPack} disabled={(profile?.coins ?? 0) < PACK_COST} style={{ background: (profile?.coins ?? 0) >= PACK_COST ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 14, padding: '12px 22px', color: (profile?.coins ?? 0) >= PACK_COST ? '#fff' : '#475569', fontSize: 14, fontWeight: 700, cursor: (profile?.coins ?? 0) >= PACK_COST ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: (profile?.coins ?? 0) >= PACK_COST ? '0 4px 20px rgba(124,58,237,0.4)' : 'none' }}>🎁 Open — {PACK_COST} coins</button>
                <button onClick={earnCoins} style={{ background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: 14, padding: '12px 16px', color: '#FCD34D', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ 25</button>
              </div>
            </div>

            <SectionLabel>Series</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {SERIES.map(ser => {
                const total = ALL_STICKERS.filter(s => s.series === ser.id).length
                const owned = ALL_STICKERS.filter(s => s.series === ser.id && ownedIds.has(s.id)).length
                return (
                  <div key={ser.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '14px 14px 12px' }}>
                    <div style={{ width: 40, height: 40, marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: SERIES_ICONS[ser.id] }} />
                    <div style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 700, marginBottom: 2 }}>{ser.name}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>{owned}/{total} collected</div>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(owned / total) * 100}%`, height: '100%', background: ser.color, borderRadius: 6 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <SectionLabel>Latest Drops</SectionLabel>
            {ownedStickers.length === 0
              ? <EmptyState icon="🎁" text="Open your first pack to start!" />
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {ownedStickers.slice(-9).reverse().map((s, i) => (
                    <div key={s.id} style={{ animation: `fadeUp 0.3s ease ${i * 0.04}s both`, position: 'relative' }}>
                      <StickerCard sticker={s} mini owned forTrade={tradeIds.has(s.id)} onClick={() => setModal({ type: 'sticker', data: s })} />
                      {(collectionMap[s.id]?.quantity || 1) > 1 && (
                        <div style={{ position: 'absolute', top: 4, left: 4, background: '#7C3AED', color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 8 }}>×{collectionMap[s.id].quantity}</div>
                      )}
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* INVENTORY */}
        {tab === 'inventory' && (
          <div style={{ animation: 'fadeUp 0.25s ease' }}>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 20 }}>
              {[
                { label: 'Unique', value: ownedIds.size, color: '#A78BFA' },
                { label: 'Total', value: totalCards, color: '#60A5FA' },
                { label: 'Listed', value: tradeIds.size, color: '#F59E0B' },
                { label: 'Missing', value: ALL_STICKERS.length - ownedIds.size, color: '#475569' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 9, color: '#475569', marginTop: 3, fontWeight: 600 }}>{stat.label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            {/* Per-series breakdown */}
            {SERIES.map(ser => {
              const seriesStickers = ALL_STICKERS.filter(s => s.series === ser.id)
              const ownedInSeries = seriesStickers.filter(s => ownedIds.has(s.id))
              if (ownedInSeries.length === 0) return null
              return (
                <div key={ser.id} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 3, height: 16, background: ser.color, borderRadius: 2 }} />
                    <div style={{ fontSize: 14, color: '#E2E8F0', fontWeight: 700 }}>{ser.name}</div>
                    <div style={{ fontSize: 11, color: '#334155', marginLeft: 'auto' }}>{ownedInSeries.length}/{seriesStickers.length}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {ownedInSeries.map(s => {
                      const qty = collectionMap[s.id]?.quantity || 1
                      const listed = tradeIds.has(s.id)
                      const marketPrice = getPriceHistory(s.id, s.rarity)[6]
                      const r = RARITY[s.rarity]
                      return (
                        <div key={s.id} style={{ position: 'relative' }}>
                          <StickerCard sticker={s} mini owned forTrade={listed} onClick={() => setModal({ type: 'sticker', data: s })} />
                          {qty > 1 && <div style={{ position: 'absolute', top: 4, left: 4, background: '#7C3AED', color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 8 }}>×{qty}</div>}
                          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
                            <span style={{ fontSize: 9, color: '#334155' }}>🪙 {marketPrice}</span>
                            {listed && <span style={{ fontSize: 9, color: '#F59E0B', fontWeight: 600 }}>listed</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {ownedStickers.length === 0 && <EmptyState icon="📦" text="Your inventory is empty — open some packs!" />}
          </div>
        )}

        {/* TRADE */}
        {tab === 'trade' && (
          <div style={{ animation: 'fadeUp 0.25s ease' }}>
            {/* Tabs within trade */}
            <TradeSubTabs
              myTrades={myTrades}
              sentTrades={sentTrades}
              ownedStickers={ownedStickers}
              collectionMap={collectionMap}
              tradeIds={tradeIds}
              ownedMap={ownedMap}
              coins={profile?.coins ?? 0}
              userId={user?.id}
              allUsers={allUsers}
              onRespond={respondTrade}
              onCompose={() => setModal({ type: 'compose_trade' })}
              onOffer={(targetUser, wantSticker) => { setTradeOffer(t => ({ ...t, targetUser, wantSticker })); setModal({ type: 'compose_trade' }) }}
              onBuy={buyStickerFromMarket}
              getPriceHistory={getPriceHistory}
              ALL_STICKERS={ALL_STICKERS}
              STICKER_ICONS={STICKER_ICONS}
            />
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div style={{ animation: 'fadeUp 0.25s ease' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 22, padding: 20, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#7C3AED,#DB2777)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👾</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F0F4FF' }}>@{profile?.username}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{completionPct}% complete · {totalCards} cards total</div>
              </div>
            </div>
            <SectionLabel>Rarity Breakdown</SectionLabel>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 18, padding: 16, marginBottom: 16 }}>
              {Object.entries(RARITY).reverse().map(([key, meta]) => {
                const count = ALL_STICKERS.filter(s => s.rarity === key && ownedIds.has(s.id)).length
                const total = ALL_STICKERS.filter(s => s.rarity === key).length
                const qty = collection.filter(c => {
                  const s = ALL_STICKERS.find(st => st.id === c.sticker_id)
                  return s?.rarity === key
                }).reduce((sum, c) => sum + (c.quantity || 1), 0)
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 70, fontSize: 11, color: meta.color, fontWeight: 600 }}>{meta.label}</div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(count / total) * 100}%`, height: '100%', background: meta.color, borderRadius: 6 }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textAlign: 'right', minWidth: 50 }}>{count}/{total} <span style={{ color: '#334155' }}>({qty})</span></div>
                  </div>
                )
              })}
            </div>
            <button onClick={earnCoins} style={{ width: '100%', background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.15)', borderRadius: 16, padding: 14, color: '#FCD34D', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>Daily Reward — +25 coins</button>
            {allUsers.length > 0 && (
              <>
                <SectionLabel>Other Collectors</SectionLabel>
                {allUsers.map(u => (
                  <div key={u.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, background: 'rgba(124,58,237,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                    <div style={{ flex: 1, fontSize: 14, color: '#E2E8F0', fontWeight: 600 }}>@{u.username}</div>
                    <button onClick={() => { setTradeOffer(t => ({ ...t, targetUser: u })); setModal({ type: 'compose_trade' }) }} style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '5px 12px', color: '#A78BFA', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Trade</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: 'rgba(8,12,20,0.96)', borderTop: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '8px 0 20px', zIndex: 50 }}>
        {NAV.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'none', border: 'none', padding: '8px 0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', position: 'relative', fontFamily: 'inherit' }}>
            <div style={{ fontSize: 18, color: tab === t.id ? '#A78BFA' : '#334155', transition: 'color 0.2s', filter: tab === t.id ? 'drop-shadow(0 0 6px #7C3AED88)' : 'none' }}>{t.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: tab === t.id ? '#A78BFA' : '#334155', transition: 'color 0.2s' }}>{t.label}</div>
            {tab === t.id && <div style={{ position: 'absolute', bottom: 0, width: 20, height: 2, background: '#7C3AED', borderRadius: 2 }} />}
            {t.badge > 0 && <div style={{ position: 'absolute', top: 4, right: '18%', background: '#EF4444', borderRadius: '50%', width: 15, height: 15, fontSize: 8, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</div>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: 1, marginBottom: 10, marginTop: 4, textTransform: 'uppercase' }}>{children}</div>
}
function Label({ children }) {
  return <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' }}>{children}</div>
}
function EmptyState({ icon, text }) {
  return <div style={{ textAlign: 'center', padding: '32px 20px', color: '#1E3A5F', fontSize: 13, background: 'rgba(255,255,255,0.02)', borderRadius: 18, border: '1px dashed rgba(255,255,255,0.05)' }}><div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>{text}</div>
}
function MiniPicker({ sticker, selected, accent, onClick }) {
  return (
    <div onClick={onClick} style={{ background: selected ? `${accent}33` : sticker.bg + '99', borderRadius: 10, padding: '6px 4px', textAlign: 'center', cursor: 'pointer', border: `2px solid ${selected ? accent : 'transparent'}`, transition: 'border-color 0.15s' }}>
      <div style={{ width: 28, height: 28, imageRendering: 'pixelated', margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: STICKER_ICONS[sticker.id] || '' }} />
    </div>
  )
}
function PriceInput({ value, onChange }) {
  const [v, setV] = useState(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#FCD34D' }}>🪙</span>
      <input
        type="number" value={v} min={1}
        onChange={e => setV(e.target.value)}
        onBlur={() => onChange(Number(v))}
        style={{ width: 60, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 8px', color: '#F0F4FF', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
      />
    </div>
  )
}

// ── Trade sub-tabs ────────────────────────────────────────────────────────
function TradeSubTabs({ myTrades, sentTrades, ownedStickers, collectionMap, tradeIds, ownedMap, coins, userId, allUsers, onRespond, onCompose, onOffer, onBuy, getPriceHistory, ALL_STICKERS, STICKER_ICONS }) {
  const [subTab, setSubTab] = useState('market')

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 4 }}>
        {[['market', 'Market'], ['offers', `Offers${myTrades.length > 0 ? ` (${myTrades.length})` : ''}`], ['sent', 'Sent']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ flex: 1, background: subTab === id ? 'rgba(124,58,237,0.25)' : 'transparent', border: subTab === id ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent', borderRadius: 10, padding: '8px 0', color: subTab === id ? '#A78BFA' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>{label}</button>
        ))}
      </div>

      {subTab === 'market' && (
        <div>
          <button onClick={onCompose} style={{ width: '100%', background: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(124,58,237,0.3)', borderRadius: 16, padding: 16, color: '#A78BFA', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' }}>⇄ Propose a Trade</button>
          <Marketplace userId={userId} ownedMap={ownedMap} onOffer={onOffer} onBuy={onBuy} coins={coins} />
        </div>
      )}

      {subTab === 'offers' && (
        <div>
          {myTrades.length === 0 ? <EmptyState icon="📨" text="No incoming trade offers" /> : myTrades.map(trade => {
            const offerS = ALL_STICKERS.find(s => s.id === trade.offer_sticker_id)
            const wantS = ALL_STICKERS.find(s => s.id === trade.want_sticker_id)
            return (
              <div key={trade.id} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 18, padding: 16, marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>from <span style={{ color: '#A78BFA', fontWeight: 700 }}>@{trade.from_profile?.username}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <TradeItem sticker={offerS} label="They offer" STICKER_ICONS={STICKER_ICONS} />
                  <div style={{ color: '#334155', fontSize: 18 }}>⇄</div>
                  <TradeItem sticker={wantS} label="They want" STICKER_ICONS={STICKER_ICONS} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => onRespond(trade, true)} style={{ flex: 1, background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 0', color: '#34D399', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Accept</button>
                  <button onClick={() => onRespond(trade, false)} style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 0', color: '#F87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Decline</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {subTab === 'sent' && (
        <div>
          {sentTrades.length === 0 ? <EmptyState icon="📤" text="No outgoing offers" /> : sentTrades.map(trade => {
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
                  <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, marginTop: 2 }}>Pending...</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TradeItem({ sticker, label, STICKER_ICONS }) {
  if (!sticker) return null
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ background: sticker.bg, borderRadius: 12, padding: 8, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52 }}>
        <div style={{ width: 36, height: 36, imageRendering: 'pixelated' }} dangerouslySetInnerHTML={{ __html: STICKER_ICONS[sticker.id] || '' }} />
      </div>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{sticker.name}</div>
      <div style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

