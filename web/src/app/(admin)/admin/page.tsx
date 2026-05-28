'use client'

import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ totalStems: number; totalUsers: number; recentUploads: unknown[] } | null>(null)

  useEffect(() => {
    fetch(`${API}/api/admin/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  return (
    <div>
      <h1 style={{
        fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1.4rem',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 28,
      }}>
        Dashboard
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Stems', value: stats?.totalStems ?? '—' },
          { label: 'Total Users', value: stats?.totalUsers ?? '—' },
        ].map((s) => (
          <div key={s.label} className="card">
            <div style={{
              fontFamily: 'var(--font-share-tech-mono)', fontSize: '2rem',
              color: 'var(--acc)', marginBottom: 4,
            }}>
              {s.value}
            </div>
            <div style={{
              fontFamily: 'var(--font-exo2)', fontSize: '0.72rem',
              letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mu)',
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{
        fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.85rem',
        letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mu)',
        marginBottom: 12,
      }}>
        Recent Uploads
      </h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {(stats?.recentUploads as { id: string; title: string; artist: string; genre: string; createdAt: string }[] ?? []).map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--di)' }}>
                <td style={{ padding: '10px 16px', fontSize: '0.84rem', color: 'var(--tx)' }}>{s.title}</td>
                <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: 'var(--mu)' }}>{s.artist}</td>
                <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: 'var(--mu)' }}>{s.genre}</td>
                <td style={{ padding: '10px 16px', fontSize: '0.72rem', color: 'var(--mu2)' }}>
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
