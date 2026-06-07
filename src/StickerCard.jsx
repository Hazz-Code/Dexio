import { RARITY } from './data'
import { STICKER_ICONS } from './icons'

export function PixelIcon({ id, size = 40 }) {
  const svg = STICKER_ICONS[id]
  if (!svg) return <div style={{ width: size, height: size, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }} />
  return (
    <div
      style={{ width: size, height: size, imageRendering: 'pixelated', flexShrink: 0, display: 'flex' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function RarityParticles({ rarity }) {
  if (rarity === 'common') return null
  const count = rarity === 'legendary' ? 8 : rarity === 'epic' ? 5 : 3
  const color = RARITY[rarity].color
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 'inherit' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: rarity === 'legendary' ? 4 : 3,
          height: rarity === 'legendary' ? 4 : 3,
          background: color,
          borderRadius: '50%',
          left: `${10 + (i * 12) % 80}%`,
          bottom: `${15 + (i * 17) % 50}%`,
          animation: `particleDrift ${1.5 + i * 0.4}s ease-out infinite`,
          animationDelay: `${i * 0.3}s`,
          boxShadow: `0 0 4px ${color}`,
        }} />
      ))}
    </div>
  )
}

function RarityBadge({ rarity }) {
  const r = RARITY[rarity]
  const badges = {
    legendary: { label: 'LEGENDARY', bg: 'linear-gradient(90deg, #F59E0B, #FCD34D, #F59E0B)', color: '#000' },
    epic:      { label: 'EPIC',      bg: 'linear-gradient(90deg, #7C3AED, #A78BFA, #7C3AED)', color: '#fff' },
    rare:      { label: 'RARE',      bg: 'linear-gradient(90deg, #1D4ED8, #60A5FA, #1D4ED8)', color: '#fff' },
    common:    { label: 'COMMON',    bg: 'rgba(148,163,184,0.2)', color: '#94A3B8' },
  }
  const b = badges[rarity]
  return (
    <div style={{
      background: b.bg,
      backgroundSize: rarity !== 'common' ? '200% auto' : undefined,
      animation: rarity === 'legendary' ? 'shimmer 2s linear infinite' : undefined,
      color: b.color,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: 1.5,
      padding: '3px 8px',
      borderRadius: 20,
      display: 'inline-block',
    }}>{b.label}</div>
  )
}

export function StickerCard({ sticker, mini, owned = true, forTrade, onClick }) {
  const r = RARITY[sticker.rarity]
  const isLegendary = sticker.rarity === 'legendary'
  const isEpic = sticker.rarity === 'epic'
  const isRare = sticker.rarity === 'rare'

  const animStyle = isLegendary
    ? { animation: 'legendaryPulse 2s ease-in-out infinite, legendaryFloat 3s ease-in-out infinite' }
    : isEpic
    ? { animation: 'epicPulse 2.5s ease-in-out infinite, epicFloat 3.5s ease-in-out infinite' }
    : isRare
    ? { animation: 'rarePulse 3s ease-in-out infinite' }
    : {}

  if (mini) {
    return (
      <div
        onClick={onClick}
        style={{
          background: `linear-gradient(160deg, ${sticker.bg}ee, ${sticker.bg}99)`,
          borderRadius: 16,
          padding: '10px 8px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          cursor: onClick ? 'pointer' : 'default',
          border: `1.5px solid ${r.color}${isLegendary ? 'ff' : isEpic ? 'cc' : '77'}`,
          opacity: owned ? 1 : 0.3,
          transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s',
          position: 'relative',
          overflow: 'hidden',
          ...animStyle,
        }}
        onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)' }}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1) translateY(0)'}
      >
        {/* Shimmer overlay for legendary */}
        {isLegendary && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit',
            background: 'linear-gradient(105deg, transparent 40%, rgba(252,211,77,0.15) 50%, transparent 60%)',
            backgroundSize: '200% auto',
            animation: 'shimmer 2.5s linear infinite',
            pointerEvents: 'none',
          }} />
        )}
        {forTrade && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            background: '#F59E0B', color: '#000',
            fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 8,
            letterSpacing: 0.5,
          }}>TRADE</div>
        )}
        <RarityParticles rarity={sticker.rarity} />
        <PixelIcon id={sticker.id} size={40} />
        <div style={{
          fontSize: 9, color: '#CBD5E1', fontWeight: 600,
          textAlign: 'center', lineHeight: 1.3, width: '100%',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          padding: '0 2px',
        }}>{sticker.name}</div>
        <RarityBadge rarity={sticker.rarity} />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 24,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        cursor: onClick ? 'pointer' : 'default',
        border: `2px solid ${r.color}${isLegendary ? 'ff' : 'aa'}`,
        background: `linear-gradient(160deg, ${sticker.bg}dd 0%, #080C14 100%)`,
        opacity: owned ? 1 : 0.3,
        transition: 'transform 0.2s',
        position: 'relative',
        overflow: 'hidden',
        animation: 'pop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        ...animStyle,
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'scale(1.03)' }}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {isLegendary && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(105deg, transparent 30%, rgba(252,211,77,0.12) 50%, transparent 70%)',
          backgroundSize: '200% auto',
          animation: 'shimmer 2s linear infinite',
          pointerEvents: 'none',
        }} />
      )}
      <RarityParticles rarity={sticker.rarity} />

      {/* Icon container */}
      <div style={{
        width: 96, height: 96,
        background: 'rgba(0,0,0,0.35)',
        borderRadius: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${r.color}33`,
        position: 'relative',
      }}>
        {isLegendary && (
          <div style={{
            position: 'absolute', inset: -2, borderRadius: 20,
            background: `conic-gradient(${r.color}, transparent, ${r.color})`,
            animation: 'spin 3s linear infinite',
            opacity: 0.4,
          }} />
        )}
        <PixelIcon id={sticker.id} size={72} />
      </div>

      <div>
        <div style={{ fontSize: 16, color: '#F0F4FF', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{sticker.name}</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <RarityBadge rarity={sticker.rarity} />
        </div>
      </div>

      {forTrade && (
        <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #F59E0B', color: '#F59E0B', fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, letterSpacing: 1 }}>
          FOR TRADE
        </div>
      )}
    </div>
  )
}
