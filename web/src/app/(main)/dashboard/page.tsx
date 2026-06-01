'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type Panel = 'email' | 'password' | null

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<Panel>(null)
  const [toast, setToast] = useState('')

  // Email panel state
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  // Password panel state
  const [newPassword, setNewPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      setLoading(false)
    })
  }, [router])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function updateEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailLoading(true); setEmailMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) { setEmailMsg(error.message) } else { setEmailMsg('Confirmation sent to new email.') }
    setEmailLoading(false)
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwLoading(true); setPwMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPwMsg(error.message) } else { setPwMsg('Password updated.'); showToast('Password updated.') }
    setPwLoading(false)
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--mu)' }}>Loading…</div>

  const tier: string = 'free' // TODO: fetch from /api/me once needed

  const tierBadge = tier === 'paid'
    ? { label: 'Full Access', bg: 'rgba(35,201,154,.15)', border: '#23c99a', color: '#23c99a' }
    : { label: 'Free Access', bg: 'rgba(96,116,255,.18)', border: 'transparent', color: '#a0adff' }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, color: 'var(--tx)', fontSize: 13, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, textTransform: 'uppercase',
    letterSpacing: '.1em', color: 'var(--mu)', marginBottom: 7, fontWeight: 600,
  }

  return (
    <>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'var(--font-exo2)', fontSize: 22, fontWeight: 300,
            letterSpacing: '.1em', color: 'var(--tx)', marginBottom: 6,
          }}>
            User Settings
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>
            Welcome back, <span style={{ color: 'var(--acc)', fontWeight: 600 }}>{user?.user_metadata?.name ?? user?.email}</span>.
          </p>
        </div>

        {/* Account card */}
        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--mu)', margin: 0 }}>
              ACCOUNT
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                padding: '3px 10px', background: tierBadge.bg,
                color: tierBadge.color, borderRadius: 20,
                fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
              }}>
                {tierBadge.label}
              </span>
            </div>
          </div>

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: 8, padding: '14px 14px 0', flexWrap: 'wrap' }}>
            {[
              { key: 'email' as Panel, label: 'Update Email' },
              { key: 'password' as Panel, label: 'Change Password' },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => setPanel(panel === btn.key ? null : btn.key)}
                style={{
                  padding: '9px 18px', background: panel === btn.key ? 'rgba(96,116,255,.14)' : 'transparent',
                  border: `1px solid ${panel === btn.key ? 'var(--acc)' : 'rgba(255,255,255,.12)'}`,
                  borderRadius: 8, color: panel === btn.key ? 'var(--acc)' : 'var(--tx)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .18s',
                }}
              >
                {btn.label}
              </button>
            ))}
            <button
              onClick={signOut}
              style={{
                padding: '9px 18px', background: 'transparent',
                border: '1px solid rgba(255,255,255,.12)',
                borderRadius: 8, color: 'var(--mu)',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Sign Out
            </button>
          </div>

          {/* Inline panel — Update Email */}
          {panel === 'email' && (
            <form onSubmit={updateEmail} style={{ padding: '16px 14px', borderTop: '1px solid rgba(255,255,255,.07)', marginTop: 14 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>New Email</label>
                <input style={inputStyle} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="new@email.com" />
              </div>
              {emailMsg && <p style={{ fontSize: 12, color: emailMsg.includes('Confirm') ? '#4ade80' : '#f87171', marginBottom: 10 }}>{emailMsg}</p>}
              <button type="submit" disabled={emailLoading} style={{
                width: '100%', padding: 11, background: 'linear-gradient(135deg,var(--acc),#4a5ee8)',
                border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', opacity: emailLoading ? 0.5 : 1,
              }}>
                {emailLoading ? 'Sending…' : 'Send Confirmation'}
              </button>
            </form>
          )}

          {/* Inline panel — Change Password */}
          {panel === 'password' && (
            <form onSubmit={updatePassword} style={{ padding: '16px 14px', borderTop: '1px solid rgba(255,255,255,.07)', marginTop: 14 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>New Password</label>
                <input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Min 8 characters" minLength={8} />
              </div>
              {pwMsg && <p style={{ fontSize: 12, color: pwMsg.includes('updated') ? '#4ade80' : '#f87171', marginBottom: 10 }}>{pwMsg}</p>}
              <button type="submit" disabled={pwLoading} style={{
                width: '100%', padding: 11, background: 'linear-gradient(135deg,var(--acc),#4a5ee8)',
                border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', opacity: pwLoading ? 0.5 : 1,
              }}>
                {pwLoading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}

          {/* Delete account */}
          <div style={{ margin: '14px', background: 'rgba(180,30,30,.18)', border: '1px solid rgba(220,60,60,.22)', borderRadius: 8, padding: '13px 18px', textAlign: 'center' }}>
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)} style={{ background: 'transparent', border: 'none', color: '#f08080', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                Delete Account
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 7, color: 'var(--mu)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button style={{ flex: 1, padding: '8px', background: 'rgba(180,30,30,.4)', border: '1px solid rgba(220,60,60,.5)', borderRadius: 7, color: '#f08080', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm Delete</button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: '#22c55e', color: '#fff', padding: '10px 22px',
          borderRadius: 8, fontSize: 13, zIndex: 500, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </>
  )
}
