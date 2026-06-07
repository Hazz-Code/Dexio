import { useState, useEffect } from 'react'
import { sb } from './supabase'
import { ALL_STICKERS, RARITY } from './data'
import { STICKER_ICONS } from './icons'

export function TradeMarket({ userId, ownedIds, onOffer }) {
  const [listings, setListings] = useState([])

  useEffect(() => {
    sb.from('sv_collection')
      .select('*, profile:sv_profiles(id, username)')
      .eq('for_trade', true)
      .neq('user_id', userId)
      .then(({ data }) => setListings(data || []))
  }, [userId])

  if (listings.length === 0) return (
    <div style={{ textAlign: 'center', color: '#1E3A5F', padding: 20, fontSize: 12 }}>
      No community listings yet. Be the first!
    </div>
  )

  return listings.map(item => {
    const sticker = ALL_STICKERS.find(s => s.id === item.sticker_id)
    if (!sticker) return null
    const r = RARITY[sticker.rarity]
    const alreadyOwned = ownedIds.has(sticker.id)
    return (
      <div key={item.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ background: sticker.bg, borderRadius: 10, padding: '6px 8px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, imageRendering: 'pixelated' }} dangerouslySetInnerHTML={{ __html: STICKER_ICONS[sticker.id] || sticker.emoji }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 700 }}>{sticker.name}</div>
          <div style={{ fontSize: 10, color: r.color, fontWeight: 700, marginTop: 2 }}>{r.label}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>by @{item.profile?.username}</div>
        </div>
        <button onClick={() => !alreadyOwned && onOffer(item.profile, sticker)} style={{ background: alreadyOwned ? 'rgba(255,255,255,0.05)' : 'rgba(124,58,237,0.15)', border: `1px solid ${alreadyOwned ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.3)'}`, borderRadius: 10, padding: '6px 10px', color: alreadyOwned ? '#334155' : '#A78BFA', fontSize: 11, fontWeight: 800, cursor: alreadyOwned ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {alreadyOwned ? 'Owned' : 'Offer →'}
        </button>
      </div>
    )
  })
}
