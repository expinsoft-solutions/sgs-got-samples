'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7626'

type VaultStatus = {
  id: string; genreId: string; genre: { name: string; slug: string }; status: string
  stemCount: number; fileSizeBytes: string | null
  builtAt: string | null; errorMessage: string | null
}

const STATUS_COLOR: Record<string, string> = {
  ready: '#4caf82', stale: '#6878ff', building: '#f59e0b', failed: '#ef4444',
}

function formatBytes(b: string | null): string {
  if (!b) return '—'
  const n = Number(b)
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function AdminVault() {
  const [statuses, setStatuses] = useState<VaultStatus[]>([])
  const [rebuilding, setRebuilding] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`${API}/api/admin/vault/status`)
    const data = await res.json()
    setStatuses(data.statuses ?? [])
  }

  useEffect(() => { load() }, [])

  async function rebuild(genreId: string) {
    setRebuilding(genreId)
    await fetch(`${API}/api/admin/vault/${encodeURIComponent(genreId)}/rebuild`, { method: 'POST' })
    await load()
    setRebuilding(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1.4rem',
          letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1,
        }}>
          Vault Operations
        </h1>
        <button className="btn-ghost" style={{ padding: '7px 16px', fontSize: '0.78rem' }} onClick={load}>
          ↺ Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {statuses.map((s) => (
          <div key={s.genreId} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s.status] ?? 'var(--mu2)', flexShrink: 0 }} />
              <h3 style={{
                fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.9rem',
                letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1,
              }}>
                {s.genre?.name ?? s.genreId}
              </h3>
              <span style={{
                fontFamily: 'var(--font-exo2)', fontSize: '0.65rem',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: STATUS_COLOR[s.status] ?? 'var(--mu2)',
              }}>
                {s.status}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--mu)' }}>
                <strong style={{ color: 'var(--tx)', fontFamily: 'var(--font-share-tech-mono)' }}>{s.stemCount}</strong> stems
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--mu)' }}>
                <strong style={{ color: 'var(--tx)', fontFamily: 'var(--font-share-tech-mono)' }}>{formatBytes(s.fileSizeBytes)}</strong>
              </span>
            </div>

            {s.builtAt && (
              <div style={{ fontSize: '0.72rem', color: 'var(--mu2)', marginBottom: 12 }}>
                Built: {new Date(s.builtAt).toLocaleString()}
              </div>
            )}

            {s.errorMessage && (
              <div style={{ fontSize: '0.72rem', color: '#ef4444', marginBottom: 12, wordBreak: 'break-word' }}>
                {s.errorMessage}
              </div>
            )}

            <button
              className="btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.76rem' }}
              disabled={rebuilding === s.genreId}
              onClick={() => rebuild(s.genreId)}
            >
              {rebuilding === s.genreId ? 'Queued…' : '↺ Rebuild ZIP'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
