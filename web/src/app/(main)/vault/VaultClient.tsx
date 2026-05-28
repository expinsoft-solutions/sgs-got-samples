'use client'

import { useState, useEffect } from 'react'
import { api, type VaultGenre } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  ready: '#4caf82',
  stale: '#6878ff',
  building: '#f59e0b',
  failed: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  ready: 'Ready',
  stale: 'Updating',
  building: 'Building…',
  failed: 'Failed',
}

function formatBytes(b: string | null): string {
  if (!b) return '—'
  const n = Number(b)
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function VaultClient() {
  const [genres, setGenres] = useState<VaultGenre[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    api.vault.genres().then((d) => { setGenres(d.genres); setLoading(false) })
  }, [])

  async function handleDownload(genre: string) {
    setDownloading(genre)
    try {
      const { url } = await api.vault.download(genre)
      window.open(url, '_blank')
    } catch {
      alert('Download not available yet')
    }
    setDownloading(null)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 20px 60px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1.6rem',
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx)',
          marginBottom: 8,
        }}>
          Vault
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--mu)' }}>
          Download full genre packs as ZIP files. Updated automatically when new stems are added.
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>Loading genres…</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {genres.map((g) => (
          <div key={g.genre} className="card" style={{ position: 'relative' }}>
            {/* Status badge */}
            <div style={{
              position: 'absolute', top: 14, right: 14,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: STATUS_COLORS[g.status] ?? 'var(--mu2)',
                display: 'inline-block',
                ...(g.status === 'building' ? { animation: 'pulse 1.2s ease-in-out infinite' } : {}),
              }} />
              <span style={{
                fontFamily: 'var(--font-exo2)', fontSize: '0.68rem',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: STATUS_COLORS[g.status] ?? 'var(--mu2)',
              }}>
                {STATUS_LABELS[g.status] ?? g.status}
              </span>
            </div>

            {/* Genre name */}
            <h2 style={{
              fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '1.1rem',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--tx)', marginBottom: 10, paddingRight: 80,
            }}>
              {g.genre}
            </h2>

            {/* Meta */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--mu)' }}>
                <strong style={{ color: 'var(--tx)', fontFamily: 'var(--font-share-tech-mono)' }}>{g.stemCount}</strong> stems
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--mu)' }}>
                <strong style={{ color: 'var(--tx)', fontFamily: 'var(--font-share-tech-mono)' }}>{formatBytes(g.fileSizeBytes)}</strong>
              </span>
            </div>

            {g.description && (
              <p style={{ fontSize: '0.8rem', color: 'var(--mu)', marginBottom: 16, lineHeight: 1.5 }}>
                {g.description}
              </p>
            )}

            {/* Download button */}
            <button
              className="btn-acc"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={g.status === 'building' || downloading === g.genre}
              onClick={() => handleDownload(g.genre)}
            >
              {downloading === g.genre ? 'Preparing…' : '↓ Download ZIP'}
            </button>

            {g.status === 'stale' && (
              <p style={{ fontSize: '0.72rem', color: 'var(--mu2)', marginTop: 8, textAlign: 'center' }}>
                New stems incoming — pack updating soon
              </p>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
