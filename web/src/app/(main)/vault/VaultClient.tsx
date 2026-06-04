'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api, type VaultGenre } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function formatBytes(b: string | null): string {
  if (!b) return '—'
  const n = Number(b)
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

type CardState = 'new' | 'updated' | 'current'

function GenreCard({ g, index, onDownload }: {
  g: VaultGenre & { downloadedAt?: string }
  index: number
  onDownload: (genre: string) => Promise<void>
}) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState('')

  const builtAt = g.builtAt ? new Date(g.builtAt).getTime() : 0
  const dlTime = g.downloadedAt ? new Date(g.downloadedAt).getTime() : 0

  let state: CardState = 'new'
  if (dlTime > 0) state = builtAt > dlTime ? 'updated' : 'current'

  const badge: Record<CardState, { cls: string; text: string }> = {
    new: { cls: 'badge-new', text: 'New Genre' },
    updated: { cls: 'badge-updated', text: 'New Stems' },
    current: { cls: 'badge-current', text: 'Up To Date' },
  }

  const btnLabel = state === 'updated' ? 'Download Update' : state === 'current' ? 'Re-download ZIP' : 'Download ZIP'
  const isUpdate = state === 'updated'

  async function handleClick() {
    if (running) return
    setRunning(true)
    setProgress(0)
    setLabel('0%')

    // Fake progress
    let p = 0
    const iv = setInterval(() => {
      p = Math.min(92, p + Math.random() * 12 + 3)
      setProgress(Math.round(p))
      setLabel(`${Math.round(p)}%`)
      if (p >= 92) {
        clearInterval(iv)
        setLabel('⏳ Getting link...')
        onDownload(g.genre).then(() => {
          setProgress(100)
          setLabel('✓ Downloaded')
          setTimeout(() => { setRunning(false); setProgress(0); setLabel('') }, 3000)
        }).catch(() => {
          setLabel('Error')
          setRunning(false)
          setProgress(0)
        })
      }
    }, 110)
  }

  return (
    <div className="gc" style={{ animationDelay: `${index * 45}ms` }}>
      {/* Status badge */}
      <div className={`gc-badge ${badge[state].cls}`}>
        <div className="gc-badge-dot" />
        {badge[state].text}
      </div>

      {/* Header */}
      <div className="gc-header-row">
        <div className="gc-name">{g.genre}</div>
        <div className="gc-meta">
          <div className="gc-meta-stems">{g.stemCount.toLocaleString()} stems</div>
          <div className="gc-meta-size">{formatBytes(g.fileSizeBytes)}</div>
        </div>
      </div>

      {/* Description */}
      <div className="gc-desc">{g.description ?? `${g.genre} stems collection.`}</div>

      {/* Tags */}
      {Array.isArray(g.tags) && g.tags.length > 0 && (
        <div className="gc-tags">
          {(g.tags as string[]).map((t) => <span key={t} className="gc-tag">{t}</span>)}
        </div>
      )}

      <div className="gc-rule" />

      {/* Download button */}
      {g.status === 'building' ? (
        <button className="gc-dl" disabled>
          <div className="gc-inner">
            <span style={{ animation: 'pulse 1.2s ease-in-out infinite', display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', marginRight: 6 }} />
            Building…
          </div>
        </button>
      ) : (
        <button
          className={`gc-dl${isUpdate ? ' is-update' : ''}`}
          disabled={running || g.status === 'failed'}
          onClick={handleClick}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div className="gc-prog" style={{ width: `${progress}%` }} />
          <div className="gc-inner">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 13, height: 13, flexShrink: 0 }}>
              <path d="M8 2v8M5 7l3 3 3-3M2 13h12" />
            </svg>
            <span>{running ? label : btnLabel}</span>
          </div>
        </button>
      )}
    </div>
  )
}

export function VaultClient() {
  const { me } = useAuth()
  const tier = me?.tier ?? 'free'

  const [genres, setGenres] = useState<VaultGenre[]>([])
  const [loading, setLoading] = useState(true)
  const [totalStems, setTotalStems] = useState(0)

  useEffect(() => {
    api.vault.genres().then((d) => {
      setGenres(d.genres ?? [])
      setTotalStems(d.genres?.reduce((a, g) => a + g.stemCount, 0) ?? 0)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleDownload(genre: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      const res = await fetch(`${API}/api/vault/genres/${genre}/download`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const { url } = await res.json()
        // Append token as query parameter so browser navigation is authorized
        window.location.href = `${url}&token=${session.access_token}`
      }
    } catch (e) {
      console.error('Download request failed', e)
    }
  }

  const totalSize = genres.reduce((a, g) => a + Number(g.fileSizeBytes ?? 0), 0)

  return (
    <>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes holoShift{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.85)}}
        .v-stats-bar{display:flex;background:var(--pb);border:1px solid var(--di);border-radius:11px;overflow:hidden;margin-bottom:36px;animation:fadeUp .35s ease .07s both;}
        .v-sc{flex:1;text-align:center;padding:14px 8px;border-right:1px solid var(--di);}
        .v-sc:last-child{border-right:none;}
        .v-sv{font-family:'Exo 2',sans-serif;font-size:1.3rem;font-weight:300;color:var(--tx);}
        .v-sk{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--mu);margin-top:2px;}
        .v-genre-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
        @media(max-width:800px){.v-genre-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:500px){.v-genre-grid{grid-template-columns:1fr;}}
        .gc{background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:22px 20px 20px;display:flex;flex-direction:column;transition:border-color .2s,transform .18s;animation:fadeUp .38s ease both;position:relative;overflow:hidden;}
        .gc:hover{border-color:rgba(96,116,255,.3);transform:translateY(-2px);}
        .gc-header-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;}
        .gc-name{font-family:'Exo 2',sans-serif;font-weight:300;font-size:1.2rem;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;color:var(--tx);}
        .gc-meta{display:flex;flex-direction:column;align-items:flex-end;gap:1px;flex-shrink:0;margin-top:1px;}
        .gc-meta-stems{font-family:'Exo 2',sans-serif;font-size:1.1rem;font-weight:300;color:var(--tx);letter-spacing:.02em;line-height:1.1;}
        .gc-meta-size{font-family:'Exo 2',sans-serif;font-size:.9rem;font-weight:300;color:var(--mu);letter-spacing:.03em;text-align:right;margin-top:2px;}
        .gc-badge{position:absolute;top:0;right:0;border-left:1px solid;border-bottom:1px solid;border-top-right-radius:13px;border-bottom-left-radius:9px;padding:5px 11px;display:flex;align-items:center;gap:5px;font-size:8.5px;font-family:'Exo 2',sans-serif;letter-spacing:.14em;text-transform:uppercase;font-weight:600;backdrop-filter:blur(4px);}
        .gc-badge-dot{width:5px;height:5px;border-radius:50%;animation:pulse 2s ease-in-out infinite;flex-shrink:0;}
        .badge-new{background:linear-gradient(135deg,rgba(30,185,145,.25),rgba(20,140,110,.15));border-color:rgba(30,185,145,.45);color:#23c99a;}
        .badge-new .gc-badge-dot{background:#23c99a;box-shadow:0 0 6px rgba(30,185,145,.9);}
        .badge-updated{background:linear-gradient(135deg,rgba(96,116,255,.28),rgba(60,80,220,.18));border-color:rgba(96,116,255,.4);color:#8097ff;}
        .badge-updated .gc-badge-dot{background:#6074ff;box-shadow:0 0 6px rgba(96,116,255,.9);}
        .badge-current{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.1);color:rgba(160,170,190,.55);}
        .badge-current .gc-badge-dot{background:rgba(160,170,190,.5);}
        .gc-desc{font-size:13px;color:var(--mu);line-height:1.72;flex:1;margin-bottom:16px;}
        .gc-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;}
        .gc-tag{font-size:10px;font-family:'Exo 2',sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--mu2);background:var(--pb);border:1px solid var(--di);border-radius:5px;padding:3px 8px;}
        .gc-rule{height:1px;background:var(--di);margin-bottom:16px;}
        .gc-dl{width:100%;height:40px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--me);color:var(--tx);font-size:13px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px;position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s,background .15s,border-color .15s;cursor:pointer;font-family:inherit;}
        .gc-dl:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(120,160,255,.3);}
        .gc-dl:disabled{cursor:default;opacity:.7;}
        .gc-dl.is-update{border-color:rgba(96,116,255,.5)!important;color:#8097ff!important;background:rgba(96,116,255,.08)!important;}
        .gc-dl.is-update:hover:not(:disabled){border-color:rgba(96,116,255,.75)!important;color:#a0b0ff!important;box-shadow:0 0 14px rgba(96,116,255,.3)!important;}
        .gc-prog{position:absolute;top:0;left:0;bottom:0;background:rgba(255,255,255,.08);transition:width .11s linear;pointer-events:none;}
        .gc-inner{position:relative;z-index:1;display:flex;align-items:center;gap:8px;}
        .v-sync-bar{display:flex;align-items:center;gap:10px;margin-top:36px;padding:13px 17px;background:var(--pb);border:1px solid var(--di);border-radius:10px;font-size:12.5px;color:var(--mu);}
        .v-sync-dot{width:7px;height:7px;border-radius:50%;background:#23c99a;flex-shrink:0;animation:pulse 2.2s ease-in-out infinite;}
        @media(max-width:768px){.v-vault-wrap{padding:20px 16px 60px!important;}.gc-name{font-size:1rem!important;}.gc-desc{font-size:12px!important;}}
        @media(max-width:480px){.gc{padding:16px 14px!important;}.gc-name{font-size:.9rem!important;}}
      `}</style>

      <div className="v-vault-wrap" style={{ maxWidth: 1060, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 32, animation: 'fadeUp .35s ease both' }}>
          <h1 style={{ fontFamily: 'var(--font-exo2)', fontSize: 'clamp(28px,4vw,46px)', fontWeight: 200, letterSpacing: '.02em', margin: '0 0 12px', lineHeight: 1.1, color: 'var(--tx)' }}>
            The Vault
          </h1>
          <p style={{ fontSize: 14, color: 'var(--mu)', maxWidth: 620, lineHeight: 1.6, fontWeight: 300 }}>
            The complete stem library, organized by genre for fast, streamlined access. Browse downloadable genre packs sorted by artist, album, and song. Each track folder includes five stem parts labeled with BPM and key. New update packs can be downloaded separately without re-downloading the full library.
          </p>
          {tier !== 'paid' && tier !== 'admin' && (
            <div style={{ marginTop: 14, padding: '10px 16px', background: 'rgba(96,116,255,.08)', border: '1px solid rgba(96,116,255,.22)', borderRadius: 10, display: 'inline-block' }}>
              <span style={{ fontSize: 13, color: '#8097ff' }}>
                🔒 Full Access required to download.{' '}
                <Link href="/pricing" style={{ color: 'var(--acc)', textDecoration: 'underline' }}>Unlock for $35 →</Link>
              </span>
            </div>
          )}
          {(tier === 'paid' || tier === 'admin') && (
            <div style={{ marginTop: 14, padding: '10px 16px', background: 'rgba(35,201,154,.12)', border: '1px solid rgba(35,201,154,.25)', borderRadius: 10, display: 'inline-block' }}>
              <span style={{ fontSize: 13, color: '#23c99a' }}>
                ✨ Premium Account Active — Enjoy your downloads!
              </span>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="v-stats-bar">
          <div className="v-sc">
            <div className="v-sv">{totalStems.toLocaleString()}</div>
            <div className="v-sk">Total Stems</div>
          </div>
          <div className="v-sc">
            <div className="v-sv">{genres.length}</div>
            <div className="v-sk">Genres</div>
          </div>
          <div className="v-sc">
            <div className="v-sv">{formatBytes(String(totalSize))}</div>
            <div className="v-sk">Library Size</div>
          </div>
        </div>

        {/* Genre grid */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>Loading…</div>
        )}

        {!loading && genres.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>No genres found.</div>
        )}

        {!loading && (
          <div className="v-genre-grid">
            {genres.filter(g => !g.tags?.includes?.('hidden')).map((g, i) => (
              <GenreCard key={g.genre} g={g} index={i} onDownload={handleDownload} />
            ))}
          </div>
        )}

        {/* Sync bar */}
        <div className="v-sync-bar">
          <div className="v-sync-dot" />
          <span><strong style={{ color: 'var(--tx)', fontWeight: 500 }}>Live sync.</strong> The Vault updates in real time as new stems are added.</span>
        </div>

      </div>
    </>
  )
}
