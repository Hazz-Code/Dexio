import { useState, useEffect } from 'react'
import { StickerCard } from './StickerCard'

export function PackReveal({ stickers, onDone }) {
  const [shown, setShown] = useState([])

  useEffect(() => {
    stickers.forEach((s, i) => setTimeout(() => setShown(p => [...p, s.id]), i * 500))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#F0F4FF', textAlign: 'center' }}>Pack Opened!</div>
        <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', marginTop: 2 }}>Here's what you got</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
        {stickers.map((s, i) => (
          <div key={s.id} style={{
            opacity: shown.includes(s.id) ? 1 : 0,
            transform: shown.includes(s.id) ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(16px)',
            transition: 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <StickerCard sticker={s} owned />
          </div>
        ))}
      </div>
      {shown.length === stickers.length && (
        <button onClick={onDone} style={{
          background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
          border: 'none', borderRadius: 14, padding: '13px 36px',
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
          animation: 'fadeUp 0.3s ease',
        }}>Add to Collection →</button>
      )}
    </div>
  )
}
