'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, type Stem, type FilterOptions } from '@/lib/api'

const STEM_TYPES = ['All', 'Acapella', 'Drums', 'Bass', 'Melody', 'Instrumental']
const LIMIT = 50

function formatDuration(s: number | null): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatBpm(bpm: number | null): string {
  return bpm ? bpm.toFixed(1) : '—'
}

export function LibraryClient() {
  const [stems, setStems] = useState<Stem[]>([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })
  const [filters, setFilters] = useState<FilterOptions | null>(null)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [stemType, setStemType] = useState('All')
  const [genre, setGenre] = useState('')
  const [key, setKey] = useState('')
  const [bpmRange, setBpmRange] = useState('')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)

  const [playingId, setPlayingId] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    api.stems.filterOptions().then(setFilters).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = { page: String(page), limit: String(LIMIT), sort }
    if (search) params.search = search
    if (stemType !== 'All') params.stem_type = stemType
    if (genre) params.genre = genre
    if (key) params.key = key
    if (bpmRange) {
      const [min, max] = bpmRange.split('-')
      params.bpm_min = min
      params.bpm_max = max
    }
    const data = await api.stems.list(params)
    setStems(data.stems)
    setPagination(data.pagination)
    setLoading(false)
  }, [page, sort, search, stemType, genre, key, bpmRange])

  useEffect(() => { load() }, [load])

  async function handlePlay(id: string) {
    if (playingId === id) { setPlayingId(null); return }
    if (!previewUrls[id]) {
      const { url } = await api.stems.preview(id)
      setPreviewUrls((prev) => ({ ...prev, [id]: url }))
    }
    setPlayingId(id)
  }

  async function handleDownload(id: string) {
    try {
      const { url } = await api.stems.download(id)
      window.open(url, '_blank')
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('locked')) {
        alert('Upgrade to access this stem')
      }
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>

      {/* Access strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(96,116,255,.055)', border: '1px solid rgba(96,116,255,.13)',
        borderRadius: 7, padding: '7px 14px', marginBottom: 14, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, color: 'var(--mu)', flex: 1 }}>
          <strong style={{ color: 'var(--tx)' }}>Free Access.</strong> Browse a limited selection. Locked stems require upgrade.
        </span>
        <button className="btn-acc" style={{ padding: '5px 14px', fontSize: '0.75rem' }}
          onClick={() => window.location.href = '/pricing'}>
          Unlock Full Access
        </button>
      </div>

      {/* Top bar: search + sort */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search stems, artists, genres…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <select className="input" style={{ width: 180 }} value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}>
          <option value="recent">Most Recent</option>
          <option value="genre">Sort by Genre</option>
          <option value="key">Sort by Key</option>
          <option value="bpmAsc">BPM: Low → High</option>
          <option value="bpmDesc">BPM: High → Low</option>
          <option value="title">Title A → Z</option>
        </select>
      </div>

      {/* Stem type pills + filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        {STEM_TYPES.map((t) => (
          <button
            key={t}
            className={`pill ${stemType === t ? 'active' : ''}`}
            onClick={() => { setStemType(t); setPage(1) }}
          >
            {t}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="input" style={{ width: 130, padding: '5px 10px', fontSize: '0.8rem' }}
            value={bpmRange} onChange={(e) => { setBpmRange(e.target.value); setPage(1) }}>
            <option value="">BPM</option>
            {filters?.bpmRanges.map((r) => (
              <option key={r.label} value={`${r.min}-${r.max}`}>{r.label}</option>
            ))}
          </select>
          <select className="input" style={{ width: 130, padding: '5px 10px', fontSize: '0.8rem' }}
            value={key} onChange={(e) => { setKey(e.target.value); setPage(1) }}>
            <option value="">Key</option>
            {filters?.keys.map((k) => <option key={k!}>{k}</option>)}
          </select>
          <select className="input" style={{ width: 130, padding: '5px 10px', fontSize: '0.8rem' }}
            value={genre} onChange={(e) => { setGenre(e.target.value); setPage(1) }}>
            <option value="">Genre</option>
            {filters?.genres.map((g) => <option key={g}>{g}</option>)}
          </select>
          {(bpmRange || key || genre) && (
            <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: '0.78rem' }}
              onClick={() => { setBpmRange(''); setKey(''); setGenre(''); setPage(1) }}>
              × Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--di)' }}>
              {['', 'Title', 'Time', 'Type', 'BPM', 'Key', 'Genre', '', 'DL'].map((h, i) => (
                <th key={i} style={{
                  padding: '8px 10px', textAlign: i >= 7 ? 'right' : 'center',
                  fontFamily: 'var(--font-exo2)', fontSize: '0.72rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--mu2)', fontWeight: 400,
                  ...(i === 1 ? { textAlign: 'left', minWidth: 190 } : {}),
                  ...(i === 0 ? { width: 52 } : {}),
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--mu)' }}>Loading stems…</td></tr>
            )}
            {!loading && stems.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--mu)' }}>No stems found</td></tr>
            )}
            {stems.map((stem) => (
              <tr key={stem.id} style={{
                borderBottom: '1px solid var(--di)',
                opacity: stem.isLocked ? 0.5 : 1,
                transition: 'background 0.1s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pb)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Play button */}
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <button
                    onClick={() => handlePlay(stem.id)}
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: playingId === stem.id ? 'var(--acc)' : 'var(--di)',
                      border: 'none', color: 'var(--tx)', fontSize: '0.7rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0, margin: '0 auto',
                    }}
                  >
                    {playingId === stem.id ? '■' : '▶'}
                  </button>
                </td>
                {/* Title + Artist */}
                <td style={{ padding: '10px' }}>
                  <div style={{ fontSize: '0.88rem', color: 'var(--tx)', fontWeight: 500 }}>{stem.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--mu)' }}>{stem.artist}</div>
                </td>
                <td style={{ padding: '10px', textAlign: 'center', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.78rem', color: 'var(--mu)' }}>
                  {formatDuration(stem.duration)}
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-exo2)', fontSize: '0.68rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: 'var(--acc)', background: 'rgba(104,120,255,.1)',
                    padding: '2px 7px', borderRadius: 4,
                  }}>
                    {stem.stemType.charAt(0)}
                  </span>
                </td>
                <td style={{ padding: '10px', textAlign: 'center', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.78rem', color: 'var(--mu)' }}>
                  {formatBpm(stem.bpm)}
                </td>
                <td style={{ padding: '10px', textAlign: 'center', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.75rem', color: 'var(--mu)' }}>
                  {stem.musicalKey ?? '—'}
                </td>
                <td style={{ padding: '10px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--mu)' }}>
                  {stem.genre}
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  {stem.isLocked && (
                    <span style={{ fontSize: '0.75rem' }}>🔒</span>
                  )}
                </td>
                {/* Download */}
                <td style={{ padding: '10px', textAlign: 'right', paddingRight: 16 }}>
                  <button
                    onClick={() => handleDownload(stem.id)}
                    style={{
                      background: 'transparent', border: 'none',
                      color: stem.isLocked ? 'var(--mu2)' : 'var(--acc)',
                      cursor: 'pointer', fontSize: '1rem',
                    }}
                    title={stem.isLocked ? 'Upgrade to download' : 'Download'}
                  >
                    ↓
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'var(--mu)', padding: '0 8px' }}>
            {page} / {pagination.pages} &nbsp;·&nbsp; {pagination.total} stems
          </span>
          <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            disabled={page === pagination.pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}

      {/* Hidden audio element for preview */}
      {playingId && previewUrls[playingId] && (
        <audio
          key={playingId}
          src={previewUrls[playingId]}
          autoPlay
          onEnded={() => setPlayingId(null)}
          style={{ display: 'none' }}
        />
      )}
    </div>
  )
}
