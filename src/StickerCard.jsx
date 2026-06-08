import { RARITY } from './data'
import { STICKER_ICONS } from './icons'

export function PixelIcon({ id, size = 48 }) {
  const svg = STICKER_ICONS[id]
  if (!svg) return <div style={{ width: size, height: size, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }} />
  return (
    <div
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function RarityParticles({ rarity, small }) {
  if (rarity === 'common') return null
  const count = rarity === 'legendary' ? 10 : rarity === 'epic' ? 6 : 3
  const color = RARITY[rarity].color
  const sz = small ? 3 : 4
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 'inherit' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: sz,
          height: sz,
          background: color,
          borderRadius: '50%',
          left: `${8 + (i * 13) % 82}%`,
          bottom: `${10 + (i * 19) % 60}%`,
          animation: `particleDrift ${1.4 + i * 0.35}s ease-out infinite`,
          animationDelay: `${i * 0.28}s`,
          boxShadow: `0 0 ${sz + 2}px ${color}`,
        }} />
      ))}
    </div>
  )
}

function RarityBadge({ rarity }) {
  const r = RARITY[rarity]
  const styles = {
    legendary: { bg: 'linear-gradient(90deg,#F59E0B,#FCD34D,#F59E0B)', color: '#000', bgSize: '200% auto', anim: 'shimmer 2s linear infinite' },
    epic:      { bg: 'linear-gradient(90deg,#7C3AED,#A78BFA,#7C3AED)', color: '#fff', bgSize: '200% auto', anim: 'shimmer 2.5s linear infinite' },
    rare:      { bg: 'linear-gradient(90deg,#1D4ED8,#60A5FA,#1D4ED8)', color: '#fff', bgSize: '200% auto', anim: 'shimmer 3s linear infinite' },
    common:    { bg: 'rgba(148,163,184,0.2)',                            color: '#94A3B8' },
  }
  const st = styles[rarity]
  return (
    <div style={{
      background: st.bg,
      backgroundSize: st.bgSize,
      animation: st.anim,
      color: st.color,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: 1.5,
      padding: '3px 9px',
      borderRadius: 20,
      display: 'inline-block',
      textTransform: 'uppercase',
    }}>{r.label}</div>
  )
}

export function StickerCard({ sticker, mini, owned = true, forTrade, onClick }) {
  const r = RARITY[sticker.rarity]
  const isLegendary = sticker.rarity === 'legendary'
  const isEpic = sticker.rarity === 'epic'
  const isRare = sticker.rarity === 'rare'

  const glowAnim = isLegendary
    ? { animation: 'legendaryPulse 2s ease-in-out infinite, legendaryFloat 3s ease-in-out infinite' }
    : isEpic
    ? { animation: 'epicPulse 2.5s ease-in-out infinite, epicFloat 3.5s ease-in-out infinite' }
    : isRare
    ? { animation: 'rarePulse 3s ease-in-out infinite' }
    : {}

  /* ── MINI CARD ── */
  if (mini) return (
    <div
      onClick={onClick}
      style={{
        background: `linear-gradient(155deg, ${sticker.bg}ee, ${sticker.bg}88)`,
        borderRadius: 16,
        padding: '10px 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: onClick ? 'pointer' : 'default',
        border: `1.5px solid ${r.color}${isLegendary ? 'ff' : isEpic ? 'cc' : '66'}`,
        opacity: owned ? 1 : 0.28,
        transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
        position: 'relative',
        overflow: 'hidden',
        ...glowAnim,
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)' }}
    >
      {/* Legendary shimmer */}
      {isLegendary && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg,transparent 35%,rgba(252,211,77,0.18) 50%,transparent 65%)', backgroundSize: '200% auto', animation: 'shimmer 2.5s linear infinite', pointerEvents: 'none', borderRadius: 'inherit' }} />
      )}
      {isEpic && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg,transparent 35%,rgba(167,139,250,0.12) 50%,transparent 65%)', backgroundSize: '200% auto', animation: 'shimmer 3s linear infinite', pointerEvents: 'none', borderRadius: 'inherit' }} />
      )}

      {forTrade && (
        <div style={{ position: 'absolute', top: 4, right: 4, background: '#F59E0B', color: '#000', fontSize: 7, fontWeight: 800, padding: '1px 5px', borderRadius: 8, letterSpacing: 0.5, zIndex: 2 }}>SALE</div>
      )}

      <RarityParticles rarity={sticker.rarity} small />

      {/* Icon — bigger at 48px in mini card */}
      <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {isLegendary && (
          <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: `conic-gradient(${r.color}, transparent, ${r.color})`, animation: 'spin 3s linear infinite', opacity: 0.4 }} />
        )}
        <PixelIcon id={sticker.id} size={44} />
      </div>

      <div style={{ fontSize: 9, color: '#CBD5E1', fontWeight: 600, textAlign: 'center', lineHeight: 1.3, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }}>
        {sticker.name}
      </div>
      <RarityBadge rarity={sticker.rarity} />
    </div>
  )

  /* ── FULL CARD ── */
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 22,
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        cursor: onClick ? 'pointer' : 'default',
        border: `2px solid ${r.color}${isLegendary ? 'ff' : 'aa'}`,
        background: `linear-gradient(155deg, ${sticker.bg}dd 0%, #080C14 100%)`,
        opacity: owned ? 1 : 0.28,
        transition: 'transform 0.2s',
        position: 'relative',
        overflow: 'hidden',
        animation: 'pop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        ...glowAnim,
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'scale(1.03)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {isLegendary && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg,transparent 28%,rgba(252,211,77,0.14) 50%,transparent 72%)', backgroundSize: '200% auto', animation: 'shimmer 2s linear infinite', pointerEvents: 'none' }} />
      )}
      {isEpic && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg,transparent 28%,rgba(167,139,250,0.1) 50%,transparent 72%)', backgroundSize: '200% auto', animation: 'shimmer 2.8s linear infinite', pointerEvents: 'none' }} />
      )}

      <RarityParticles rarity={sticker.rarity} />

      {/* Icon container — 96px with animated border for legendary */}
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        {isLegendary && (
          <div style={{ position: 'absolute', inset: -3, borderRadius: 22, background: `conic-gradient(${r.color}, transparent, ${r.color})`, animation: 'spin 3s linear infinite', opacity: 0.5 }} />
        )}
        <div style={{
          position: 'relative',
          width: 96,
          height: 96,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${r.color}33`,
          overflow: 'hidden',
        }}>
          <PixelIcon id={sticker.id} size={80} />
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: '#F0F4FF', fontWeight: 700, marginBottom: 6 }}>{sticker.name}</div>
        <RarityBadge rarity={sticker.rarity} />
      </div>

      {forTrade && (
        <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B', fontSize: 10, fontWeight: 700, padding: '4px 14px', borderRadius: 20, letterSpacing: 1 }}>
          FOR SALE
        </div>
      )}
    </div>
  )
}
