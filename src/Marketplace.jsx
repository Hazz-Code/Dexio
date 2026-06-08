import { useState, useEffect } from 'react'
import { sb } from './supabase'
import { ALL_STICKERS, RARITY } from './data'
import { PixelIcon } from './StickerCard'
import { STICKER_ICONS } from './icons'

// Base prices by rarity
const BASE_PRICE = { common: 15, rare: 40, epic: 90, legendary: 200 }

// Generate fake price history for a sticker (seeded by id so consistent)
function getPriceHistory(stickerId, rarity) {
  const base = BASE_PRICE[rarity]
  const history = []
  let price = base * (0.7 + (stickerId % 7) * 0.08)
  for (let i = 6; i >= 0; i--) {
    const swing = (Math.sin(stickerId * i * 0.7) * 0.12 + (Math.random() * 0.1 - 0.05))
    price = Math.max(5, price * (1 + swing))
    history.push(Math.round(price))
  }
  return history
}

function MiniSparkline({ history, color }) {
  if (!history || history.length < 2) return null
  const min = Math.min(...history)
  const max = Math.max(...history)
  const range = max - min || 1
  const w = 60, h = 24
  const points = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  const trend = history[history.length - 1] >= history[0]
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={trend ? '#4ADE80' : '#F87171'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PriceBadge({ current, prev }) {
  const pct = prev ? Math.round(((current - prev) / prev) * 100) : 0
  const up = pct >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#F0F4FF' }}>🪙 {current}</span>
      {pct !== 0 && (
        <span style={{ fontSize: 10, fontWeight: 700, color: up ? '#4ADE80' : '#F87171', background: up ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', padding: '2px 5px', borderRadius: 8 }}>
          {up ? '▲' : '▼'} {Math.abs(pct)}%
        </span>
      )}
    </div>
  )
}

export function Marketplace({ userId, ownedMap, onOffer, onBuy, coins }) {
  const [listings, setListings] = useState([])
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('rarity')
  const [selectedCard, setSelectedCard] = useState(null)

  useEffect(() => {
    loadListings()
    const ch = sb.channel('market')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sv_collection' }, loadListings)
      .subscribe()
    return () => sb.removeChannel(ch)
  }, [userId])

  const loadListings = async () => {
    const { data } = await sb.from('sv_collection')
      .select('*, profile:sv_profiles(id, username, coins)')
      .eq('for_trade', true)
      .neq('user_id', userId)
    setListings(data || [])
  }

  // Enrich listings with price data
  const enriched = listings.map(item => {
    const sticker = ALL_STICKERS.find(s => s.id === item.sticker_id)
    if (!sticker) return null
    const history = getPriceHistory(sticker.id, sticker.rarity)
    const marketPrice = history[history.length - 1]
    const listPrice = item.list_price || marketPrice
    return { ...item, sticker, history, marketPrice, listPrice }
  }).filter(Boolean)

  // Filter + sort
  const filtered = enriched
    .filter(e => filter === 'all' || e.sticker.rarity === filter)
    .sort((a, b) => {
      if (sortBy === 'rarity') {
        const order = { legendary: 0, epic: 1, rare: 2, common: 3 }
        return order[a.sticker.rarity] - order[b.sticker.rarity]
      }
      if (sortBy === 'price_low') return a.listPrice - b.listPrice
      if (sortBy === 'price_high') return b.listPrice - a.listPrice
      return 0
    })

  const FILTERS = ['all', 'legendary', 'epic', 'rare', 'common']
  const SORTS = [
    { id: 'rarity', label: 'Rarity' },
    { id: 'price_low', label: 'Price ↑' },
    { id: 'price_high', label: 'Price ↓' },
  ]

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {FILTERS.map(f => {
          const r = f !== 'all' ? RARITY[f] : null
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f ? '#7C3AED' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit',
              color: filter === f ? (r ? r.color : '#A78BFA') : '#475569',
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {SORTS.map(s => (
          <button key={s.id} onClick={() => setSortBy(s.id)} style={{
            background: sortBy === s.id ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${sortBy === s.id ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
            color: sortBy === s.id ? '#A78BFA' : '#475569',
            fontSize: 10, fontWeight: 600,
          }}>{s.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#1E3A5F', padding: '28px 0', fontSize: 13 }}>
          No listings in this category
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => {
            const r = RARITY[item.sticker.rarity]
            const alreadyOwned = ownedMap[item.sticker.id] > 0
            const canAfford = coins >= item.listPrice
            const trend = item.history[item.history.length - 1] >= item.history[0]

            return (
              <div key={item.id}
                onClick={() => setSelectedCard(selectedCard?.id === item.id ? null : item)}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selectedCard?.id === item.id ? r.color + '55' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 16, padding: '12px 14px', cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Icon */}
                  <div style={{ background: item.sticker.bg, borderRadius: 10, padding: '6px', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PixelIcon id={item.sticker.id} size={32} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 700, marginBottom: 2 }}>{item.sticker.name}</div>
                    <div style={{ fontSize: 10, color: r.color, fontWeight: 600, marginBottom: 4 }}>{r.label} · by @{item.profile?.username}</div>
                    <PriceBadge current={item.listPrice} prev={item.history[item.history.length - 2]} />
                  </div>

                  {/* Sparkline */}
                  <div style={{ flexShrink: 0 }}>
                    <MiniSparkline history={item.history} />
                    <div style={{ fontSize: 9, color: trend ? '#4ADE80' : '#F87171', textAlign: 'right', marginTop: 2, fontWeight: 600 }}>
                      {trend ? '▲ trending' : '▼ falling'}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {selectedCard?.id === item.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', animation: 'fadeUp 0.2s ease' }}>
                    {/* Price chart */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>7-DAY PRICE HISTORY</div>
                      <FullChart history={item.history} color={trend ? '#4ADE80' : '#F87171'} />
                    </div>

                    {/* Market stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                      <Stat label="Market" value={`🪙 ${item.marketPrice}`} />
                      <Stat label="Listed" value={`🪙 ${item.listPrice}`} color={item.listPrice <= item.marketPrice ? '#4ADE80' : '#F87171'} />
                      <Stat label="7d High" value={`🪙 ${Math.max(...item.history)}`} />
                    </div>

                    {/* vs market */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#475569' }}>vs. market price</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: item.listPrice <= item.marketPrice ? '#4ADE80' : '#F87171' }}>
                        {item.listPrice <= item.marketPrice ? '✓ Good deal' : `+${item.listPrice - item.marketPrice} above market`}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={e => { e.stopPropagation(); onBuy(item, item.listPrice) }}
                        disabled={!canAfford || alreadyOwned}
                        style={{
                          flex: 1,
                          background: canAfford && !alreadyOwned ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'rgba(255,255,255,0.04)',
                          border: 'none', borderRadius: 10, padding: '10px 0',
                          color: canAfford && !alreadyOwned ? '#fff' : '#334155',
                          fontSize: 12, fontWeight: 700, cursor: canAfford && !alreadyOwned ? 'pointer' : 'not-allowed',
                          fontFamily: 'inherit',
                        }}
                      >
                        {alreadyOwned ? 'Already Owned' : !canAfford ? 'Not enough coins' : `Buy — 🪙 ${item.listPrice}`}
                      </button>
                      {!alreadyOwned && (
                        <button
                          onClick={e => { e.stopPropagation(); onOffer(item.profile, item.sticker) }}
                          style={{ flex: 1, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 0', color: '#F59E0B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Offer Trade ⇄
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FullChart({ history, color }) {
  const min = Math.min(...history)
  const max = Math.max(...history)
  const range = max - min || 1
  const w = 280, h = 60, pad = 4
  const pts = history.map((v, i) => {
    const x = pad + (i / (history.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / range) * (h - pad * 2)
    return [x, y]
  })
  const polyline = pts.map(p => p.join(',')).join(' ')
  // Fill area
  const area = `${pts[0][0]},${h} ` + polyline + ` ${pts[pts.length - 1][0]},${h}`
  const days = ['6d', '5d', '4d', '3d', '2d', '1d', 'Now']

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad_${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#grad_${color})`} />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3 : 2} fill={color} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {days.map((d, i) => (
          <div key={i} style={{ fontSize: 8, color: '#334155', textAlign: 'center' }}>
            <div>{d}</div>
            <div style={{ color: '#475569' }}>{history[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: '#475569', fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 12, color: color || '#E2E8F0', fontWeight: 700 }}>{value}</div>
    </div>
  )
}
