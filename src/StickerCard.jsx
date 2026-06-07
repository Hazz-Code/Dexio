import { RARITY } from './data'
import { STICKER_ICONS } from './icons'

function PixelIcon({ id, size = 40 }) {
  const svg = STICKER_ICONS[id]
  if (!svg) return <span style={{ fontSize: size * 0.7 }}>❓</span>
  return (
    <div
      style={{ width: size, height: size, imageRendering: 'pixelated', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export function StickerCard({ sticker, mini, owned = true, forTrade, onClick }) {
  const r = RARITY[sticker.rarity]
  const stars = '★'.repeat(r.stars) + '☆'.repeat(4 - r.stars)

  if (mini) return (
    <div
      onClick={onClick}
      style={{
        background: sticker.bg,
        borderRadius: 14,
        padding: '8px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: onClick ? 'pointer' : 'default',
        border: `2px solid ${r.color}`,
        boxShadow: `0 0 10px ${r.color}44`,
        opacity: owned ? 1 : 0.35,
        transition: 'transform 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'scale(1.08)' }}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {forTrade && (
        <div style={{ position: 'absolute', top: -5, right: -5, background: '#F59E0B', color: '#000', fontSize: 8, fontWeight: 700, padding: '2px 4px', borderRadius: 10 }}>TRADE</div>
      )}
      <PixelIcon id={sticker.id} size={32} />
      <div style={{ fontSize: 9, color: '#E2E8F0', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{sticker.name}</div>
      <div style={{ fontSize: 8, color: r.color }}>{stars}</div>
    </div>
  )

  return (
    <div
      onClick={onClick}
      style={{
        background: `linear-gradient(145deg, ${sticker.bg}, #1E1B4B)`,
        borderRadius: 20,
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        cursor: onClick ? 'pointer' : 'default',
        border: `2px solid ${r.color}`,
        boxShadow: `0 0 24px ${r.color}44, 0 4px 20px rgba(0,0,0,0.5)`,
        opacity: owned ? 1 : 0.35,
        transition: 'transform 0.2s',
        animation: 'pop 0.4s ease',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'scale(1.04)' }}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 10 }}>
        <PixelIcon id={sticker.id} size={64} />
      </div>
      <div style={{ fontSize: 15, color: '#F1F5F9', fontWeight: 800, textAlign: 'center' }}>{sticker.name}</div>
      <div style={{ fontSize: 11, color: r.color, fontWeight: 700, letterSpacing: 2 }}>{stars} {r.label.toUpperCase()}</div>
      {forTrade && (
        <div style={{ background: '#F59E0B', color: '#000', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>FOR TRADE</div>
      )}
    </div>
  )
}
