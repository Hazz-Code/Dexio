import { useState, useEffect } from 'react'
import { StickerCard } from './StickerCard'

export function PackReveal({ stickers, onDone }) {
  const [shown, setShown] = useState([])

  useEffect(() => {
    stickers.forEach((s, i) =>
      setTimeout(() => setShown(p => [...p, s.id]), i * 500)
    )
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '20px 0' }}>
      <div style={{ fontSize: 13, color: '#94A3B8', letterSpacing: 2, fontWeight: 700 }}>PACK OPENED! 🎉</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
        {stickers.map(s => (
          <div key={s.id} style={{
            opacity: shown.includes(s.id) ? 1 : 0,
            transform: shown.includes(s.id) ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(20px)',
            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <StickerCard sticker={s} owned />
          </div>
        ))}
      </div>
      {shown.length === stickers.length && (
        <button onClick={onDone} style={{
          background: 'linear-gradient(135deg, #7C3AED, #DB2777)',
          border: 'none', borderRadius: 30, padding: '12px 40px',
          color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
          letterSpacing: 1, boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
        }}>
          Add to Collection →
        </button>
      )}
    </div>
  )
}
