import { useState } from 'react'
import { sb } from './supabase'

const inp = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, padding: '13px 16px',
  color: '#F0F4FF', fontSize: 14,
  fontFamily: 'inherit', outline: 'none', width: '100%',
  transition: 'border-color 0.2s',
}

export function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { data, error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuth(data.user)
      } else {
        if (username.length < 3) throw new Error('Username must be at least 3 characters')
        const { data, error } = await sb.auth.signUp({ email, password })
        if (error) throw error
        await sb.from('sv_profiles').insert({ id: data.user.id, username, coins: 150 })
        await sb.from('sv_collection').insert([3, 8, 14].map(sid => ({ user_id: data.user.id, sticker_id: sid })))
        onAuth(data.user)
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#F0F4FF', letterSpacing: -1, marginBottom: 4 }}>
            Dexio <span style={{ color: '#7C3AED' }}>✦</span>
          </div>
          <div style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>Digital Collectibles</div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 24 }}>
          {/* Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 3, marginBottom: 22 }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, background: mode === m ? 'rgba(124,58,237,0.25)' : 'transparent',
                border: mode === m ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                borderRadius: 10, padding: '9px 0', color: mode === m ? '#A78BFA' : '#475569',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
              }}>
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mode === 'signup' && <input style={inp} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />}
            <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
            <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
            {error && <div style={{ fontSize: 12, color: '#F87171', fontWeight: 500, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>{error}</div>}
            <button onClick={submit} disabled={loading} style={{
              background: loading ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              border: 'none', borderRadius: 13, padding: '14px 0', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', marginTop: 4,
              fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 20px rgba(124,58,237,0.35)',
              transition: 'opacity 0.2s',
            }}>
              {loading ? '...' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </div>

          {mode === 'signup' && (
            <div style={{ marginTop: 14, fontSize: 12, color: '#334155', textAlign: 'center' }}>
              Start with 150 coins + 3 free stickers
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
