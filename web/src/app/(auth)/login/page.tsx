'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/library')
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/library` },
    })
  }

  return (
    <div className="card" style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.88rem',
          letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--tx)',
          display: 'block', marginBottom: 20,
        }}>
          Son Got Samples
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1.2rem',
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx)',
        }}>
          Sign In
        </h1>
      </div>

      {/* Google */}
      <button
        onClick={handleGoogle}
        disabled={googleLoading}
        style={{
          width: '100%', height: 42, borderRadius: 9, marginBottom: 16,
          background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
          color: 'var(--tx)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          transition: 'border-color .15s',
          fontFamily: 'inherit',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--di)' }} />
        <span style={{ fontSize: 11, color: 'var(--mu2)', letterSpacing: '.06em', textTransform: 'uppercase' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--di)' }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input className="input" type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />

        {error && <p style={{ fontSize: '0.82rem', color: '#ef4444' }}>{error}</p>}

        <button type="submit" className="btn-acc"
          style={{ justifyContent: 'center', marginTop: 4 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.82rem', color: 'var(--mu)' }}>
        No account?{' '}
        <Link href="/register" style={{ color: 'var(--acc)' }}>Register</Link>
        {' · '}
        <Link href="/forgot-password" style={{ color: 'var(--mu)' }}>Forgot password?</Link>
      </div>

      {/* Admin section */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--di)' }}>
        <p style={{
          fontFamily: 'var(--font-exo2)', fontSize: '0.65rem', letterSpacing: '.12em',
          textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: 10, textAlign: 'center',
        }}>Admin</p>
        <Link href="/admin" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', height: 36, borderRadius: 7,
          background: 'rgba(96,116,255,.07)', border: '1px solid rgba(96,116,255,.22)',
          color: '#8097ff', fontSize: 12, fontFamily: 'var(--font-exo2)',
          letterSpacing: '.07em', textTransform: 'uppercase', transition: 'border-color .15s',
        }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="5" r="3" />
            <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" />
          </svg>
          Quick Admin Login
        </Link>
      </div>
    </div>
  )
}
