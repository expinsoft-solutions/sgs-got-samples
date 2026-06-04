'use client'

import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7626'

type Stats = {
  stems: { total: number; visible: number; pending: number }
  users: { total: number; free: number; paid: number; admin: number }
  downloadsToday: number
  recentUploads: { id: string; title: string; artist: string; genre: string; createdAt: string }[]
}

function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      background: 'var(--pb)', border: '1px solid var(--di)',
      borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 130,
    }}>
      <div style={{
        fontFamily: 'var(--font-exo2)', fontSize: '1.6rem', fontWeight: 300,
        color: accent ? '#4ade80' : 'var(--acc)',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--mu)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch(`${API}/api/admin/stats`).then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  const s = stats

  return (
    <div>
      {/* Stems stats */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--font-exo2)', fontSize: '0.7rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: 8 }}>
          Stems
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MiniStat label="Total" value={s?.stems.total ?? '—'} />
          <MiniStat label="Published" value={s?.stems.visible ?? '—'} accent />
          <MiniStat label="Pending Review" value={s?.stems.pending ?? '—'} />
        </div>
      </div>

      {/* Users stats */}
      <div style={{ marginBottom: 8, marginTop: 20 }}>
        <div style={{ fontFamily: 'var(--font-exo2)', fontSize: '0.7rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: 8 }}>
          Users
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MiniStat label="Total" value={s?.users.total ?? '—'} />
          <MiniStat label="Free" value={s?.users.free ?? '—'} />
          <MiniStat label="Paid" value={s?.users.paid ?? '—'} accent />
          <MiniStat label="Downloads Today" value={s?.downloadsToday ?? '—'} />
        </div>
      </div>

      {/* Recent uploads */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontFamily: 'var(--font-exo2)', fontSize: '0.7rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: 10 }}>
          Recent Uploads
        </div>
        <div style={{ border: '1px solid var(--di)', borderRadius: 11, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.025)' }}>
                {['Title', 'Artist', 'Genre', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '11px 14px', textAlign: 'left',
                    fontFamily: 'var(--font-exo2)', fontSize: '.65rem',
                    letterSpacing: '.1em', textTransform: 'uppercase',
                    color: 'var(--mu)', borderBottom: '1px solid var(--di)', fontWeight: 400,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!s && (
                <tr><td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'var(--mu)' }}>Loading…</td></tr>
              )}
              {s?.recentUploads.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--di)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', color: 'var(--tx)' }}>{u.title}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--mu)' }}>{u.artist}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--mu)' }}>{u.genre}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--mu2)', fontSize: 12 }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
