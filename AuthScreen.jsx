import { useState } from 'react'
import { sb } from './supabase'

const inp = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '12px 14px',
  color: '#F1F5F9',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
}

export function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setLoading(true)
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
        // Give 3 starter stickers
        await sb.from('sv_collection').insert(
          [3, 8, 14].map(sid => ({ user_id: data.user.id, sticker_id: sid }))
        )
        onAuth(data.user)
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F0A1E',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>✦</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#F1F5F9', letterSpacing: -1, fontFamily: 'Syne, sans-serif' }}>
        StickerVault
      </div>
      <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700, letterSpacing: 3, marginBottom: 36 }}>
        DIGITAL COLLECTIBLES
      </div>

      <div style={{
        width: '100%', maxWidth: 380,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24, padding: 28,
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1,
              background: mode === m ? 'rgba(124,58,237,0.25)' : 'transparent',
              border: `1px solid ${mode === m ? '#7C3AED' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '8px 0',
              color: mode === m ? '#A78BFA' : '#475569',
              fontSize: 12, fontWeight: 800, cursor: 'pointer',
              letterSpacing: 1, textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}>
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <input style={inp} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          )}
          <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input
            style={inp} type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
          {error && <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{
            background: loading ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7C3AED, #DB2777)',
            border: 'none', borderRadius: 14, padding: '13px 0',
            color: '#fff', fontSize: 14, fontWeight: 800,
            cursor: loading ? 'wait' : 'pointer', marginTop: 4,
            boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
            fontFamily: 'inherit',
          }}>
            {loading ? '...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </div>

        {mode === 'signup' && (
          <div style={{ marginTop: 16, fontSize: 11, color: '#334155', textAlign: 'center' }}>
            You'll start with 150 🪙 coins and 3 starter stickers!
          </div>
        )}
      </div>
    </div>
  )
}
