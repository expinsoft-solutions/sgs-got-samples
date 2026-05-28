'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/library')
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
          Create Account
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input className="input" type="text" placeholder="Name" value={name}
          onChange={(e) => setName(e.target.value)} />
        <input className="input" type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password (min 8 chars)" value={password}
          onChange={(e) => setPassword(e.target.value)} required minLength={8} />

        {error && (
          <p style={{ fontSize: '0.82rem', color: '#ef4444' }}>{error}</p>
        )}

        <button type="submit" className="btn-acc"
          style={{ justifyContent: 'center', marginTop: 4 }} disabled={loading}>
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.82rem', color: 'var(--mu)' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--acc)' }}>Sign in</Link>
      </div>
    </div>
  )
}
