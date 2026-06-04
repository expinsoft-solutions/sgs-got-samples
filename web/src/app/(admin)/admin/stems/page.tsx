'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Genre = { id: string; name: string }

type PublishedStem = {
  id: string; title: string; artist: string; stemType: string
  genres: Genre[]; bpm: number | null; musicalKey: string | null
  isLocked: boolean; createdAt: string
}

type ReviewStem = {
  id: string; title: string; artist: string; stemType: string
  bpm: number | null; musicalKey: string | null; duration: number | null
  playlistOrder: number; uploadedFromJobId: string | null
  createdAt: string; genres: Genre[]
}

type DeleteTarget =
  | { type: 'single'; id: string; title: string }
  | { type: 'bulk'; ids: string[]; count: number }

function fmt(s: number | null): string {
  if (!s) return '—'
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ── Genre picker ──────────────────────────────────────────────────────────────

function GenrePicker({
  stemId, current, allGenres, onChange, onAddNewGenre,
}: {
  stemId: string
  current: Genre[]
  allGenres: Genre[]
  onChange: (genres: Genre[]) => void
  onAddNewGenre: (g: Genre) => void
}) {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set(current.map((g) => g.id)))
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function createGenre() {
    if (!newName.trim()) return
    setCreating(true); setError('')
    try {
      const res = await fetch(`${API}/api/admin/genres`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const g = await res.json()
      onAddNewGenre(g)
      setSel((prev) => { const n = new Set(prev); n.add(g.id); return n })
      setNewName('')
    } catch (e) { setError((e as Error).message) }
    finally { setCreating(false) }
  }

  async function save() {
    setSaving(true)
    const res = await fetch(`${API}/api/admin/stems/${stemId}/genres`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genreIds: [...sel] }),
    })
    const data = await res.json()
    onChange(data.genres)
    setSaving(false); setOpen(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{ display: 'flex', gap: 4, flexWrap: 'wrap', cursor: 'pointer', minWidth: 60 }}
        onClick={() => { setSel(new Set(current.map((g) => g.id))); setOpen(true) }}
      >
        {current.length === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--mu2)' }}>— add</span>}
        {current.map((g) => (
          <span key={g.id} style={{
            fontFamily: 'var(--font-exo2)', fontSize: '0.68rem',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            background: 'rgba(104,120,255,.1)', color: 'var(--acc)',
            padding: '2px 7px', borderRadius: 4,
          }}>{g.name}</span>
        ))}
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 50,
            background: '#000c24', border: '1px solid var(--me)',
            borderRadius: 8, padding: 8, minWidth: 180,
            boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          }}>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
              {allGenres.map((g) => (
                <label key={g.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px', cursor: 'pointer', borderRadius: 4,
                  background: sel.has(g.id) ? 'rgba(104,120,255,.1)' : 'transparent',
                }}>
                  <input type="checkbox" checked={sel.has(g.id)}
                    onChange={() => setSel((prev) => { const n = new Set(prev); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })}
                    style={{ accentColor: 'var(--acc)' }} />
                  <span style={{
                    fontFamily: 'var(--font-exo2)', fontSize: '0.78rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: sel.has(g.id) ? 'var(--acc)' : 'var(--mu)',
                  }}>{g.name}</span>
                </label>
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--di)', margin: '8px 0' }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: error ? 4 : 8 }}>
              <input className="input"
                style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', height: 28 }}
                placeholder="New genre..." value={newName}
                onChange={(e) => setNewName(e.target.value)} />
              <button className="btn-ghost"
                style={{ padding: '0 8px', fontSize: '0.68rem', height: 28, borderColor: 'var(--acc)', color: 'var(--acc)' }}
                disabled={!newName.trim() || creating} onClick={createGenre}>
                {creating ? '…' : '+'}
              </button>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '0.68rem', marginBottom: 8, wordBreak: 'break-word' }}>{error}</p>}
            <button className="btn-acc"
              style={{ width: '100%', justifyContent: 'center', padding: '6px', fontSize: '0.72rem' }}
              disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Shared stem row ───────────────────────────────────────────────────────────

function StemRow({
  stem, allGenres, selected, onSelect, onDelete, onGenreChange, onAddNewGenre,
}: {
  stem: PublishedStem | ReviewStem
  allGenres: Genre[]
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onGenreChange: (genres: Genre[]) => void
  onAddNewGenre: (g: Genre) => void
}) {
  return (
    <tr style={{ borderBottom: '1px solid var(--di)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pb)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '8px 12px' }}>
        <input type="checkbox" checked={selected} onChange={onSelect} />
      </td>
      <td style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: '0.84rem', color: 'var(--tx)', fontWeight: 500 }}>{stem.title}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--mu)' }}>{stem.artist}</div>
      </td>
      <td style={{ padding: '8px 12px' }}>
        <span style={{
          fontFamily: 'var(--font-exo2)', fontSize: '0.68rem',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--acc)', background: 'rgba(104,120,255,.1)',
          padding: '2px 7px', borderRadius: 4,
        }}>{stem.stemType}</span>
      </td>
      <td style={{ padding: '8px 12px' }}>
        <GenrePicker stemId={stem.id} current={stem.genres}
          allGenres={allGenres} onChange={onGenreChange} onAddNewGenre={onAddNewGenre} />
      </td>
      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.75rem', color: 'var(--mu)', textAlign: 'center' }}>
        {stem.bpm ? Number(stem.bpm).toFixed(1) : '—'}
      </td>
      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.72rem', color: 'var(--mu)', textAlign: 'center' }}>
        {stem.musicalKey ?? '—'}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <button className="btn-ghost"
          style={{ padding: '4px 10px', fontSize: '0.72rem', color: '#ef4444', borderColor: '#ef4444' }}
          onClick={onDelete}>✕</button>
      </td>
    </tr>
  )
}

function StemsTable({
  stems, allGenres, selected, onSelect, onSelectAll, onDelete, onGenreChange, onAddNewGenre, emptyMsg,
}: {
  stems: (PublishedStem | ReviewStem)[]
  allGenres: Genre[]
  selected: Set<string>
  onSelect: (id: string) => void
  onSelectAll: (ids: string[]) => void
  onDelete: (id: string, title: string) => void
  onGenreChange: (id: string, genres: Genre[]) => void
  onAddNewGenre: (g: Genre) => void
  emptyMsg?: string
}) {
  const allSel = stems.length > 0 && stems.every((s) => selected.has(s.id))
  const cols = ['Title', 'Type', 'Genres', 'BPM', 'Key', 'Actions']

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--di)', background: 'var(--pb2)' }}>
          <th style={{ padding: '8px 12px', width: 40 }}>
            <input type="checkbox" checked={allSel}
              onChange={() => onSelectAll(allSel ? [] : stems.map((s) => s.id))} />
          </th>
          {cols.map((h) => (
            <th key={h} style={{
              padding: '8px 12px', textAlign: 'left',
              fontFamily: 'var(--font-exo2)', fontSize: '0.7rem',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--mu2)', fontWeight: 400,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stems.length === 0 && (
          <tr><td colSpan={cols.length + 1} style={{ padding: '40px', textAlign: 'center', color: 'var(--mu)' }}>
            {emptyMsg ?? 'No stems'}
          </td></tr>
        )}
        {stems.map((s) => (
          <StemRow key={s.id} stem={s} allGenres={allGenres}
            selected={selected.has(s.id)}
            onSelect={() => onSelect(s.id)}
            onDelete={() => onDelete(s.id, s.title)}
            onGenreChange={(genres) => onGenreChange(s.id, genres)}
            onAddNewGenre={onAddNewGenre} />
        ))}
      </tbody>
    </table>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminStems() {
  const [tab, setTab] = useState<'published' | 'review'>('published')

  // Published
  const [pubStems, setPubStems] = useState<PublishedStem[]>([])
  const [pubTotal, setPubTotal] = useState(0)
  const [pubPage, setPubPage] = useState(1)
  const [pubPages, setPubPages] = useState(1)
  const [pubSearch, setPubSearch] = useState('')
  const [pubSel, setPubSel] = useState<Set<string>>(new Set())
  const [pubLoading, setPubLoading] = useState(true)

  // Review
  const [revStems, setRevStems] = useState<ReviewStem[]>([])
  const [revSel, setRevSel] = useState<Set<string>>(new Set())
  const [revLoading, setRevLoading] = useState(true)
  const [revViewMode, setRevViewMode] = useState<'flat' | 'grouped'>('flat')
  const [reviewEnabled, setReviewEnabled] = useState(false)
  const [togglingReview, setTogglingReview] = useState(false)

  // Shared
  const [allGenres, setAllGenres] = useState<Genre[]>([])
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadPublished = useCallback(async () => {
    setPubLoading(true)
    const qs = new URLSearchParams({ page: String(pubPage), limit: '50' })
    if (pubSearch) qs.set('search', pubSearch)
    qs.set('pendingPublish', 'false')
    const data = await fetch(`${API}/api/admin/stems?${qs}`).then((r) => r.json())
    setPubStems(data.stems ?? [])
    setPubTotal(data.pagination?.total ?? 0)
    setPubPages(data.pagination?.pages ?? 1)
    setPubLoading(false)
  }, [pubPage, pubSearch])

  const loadReview = useCallback(async () => {
    setRevLoading(true)
    const [stemRes, settingsRes] = await Promise.all([
      fetch(`${API}/api/admin/stems/review`).then((r) => r.json()),
      fetch(`${API}/api/admin/settings`).then((r) => r.json()),
    ])
    setRevStems(stemRes.stems ?? [])
    setReviewEnabled(settingsRes.reviewEnabled ?? false)
    setRevLoading(false)
  }, [])

  useEffect(() => {
    fetch(`${API}/api/admin/genres`).then((r) => r.json()).then((d) => setAllGenres(d.genres ?? []))
  }, [])

  useEffect(() => { loadPublished() }, [loadPublished])
  useEffect(() => { loadReview() }, [loadReview])

  // ── Genre helpers ──────────────────────────────────────────────────────────

  const addGenre = useCallback((g: Genre) => {
    setAllGenres((prev) => prev.some((x) => x.id === g.id) ? prev : [...prev, g].sort((a, b) => a.name.localeCompare(b.name)))
  }, [])

  function updatePubGenres(id: string, genres: Genre[]) {
    setPubStems((prev) => prev.map((s) => s.id === id ? { ...s, genres } : s))
  }

  function updateRevGenres(id: string, genres: Genre[]) {
    setRevStems((prev) => prev.map((s) => s.id === id ? { ...s, genres } : s))
  }

  // ── Delete (shared modal) ──────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return
    const ids = deleteTarget.type === 'single' ? [deleteTarget.id] : deleteTarget.ids
    await fetch(`${API}/api/admin/stems/bulk-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setPubStems((prev) => prev.filter((s) => !ids.includes(s.id)))
    setRevStems((prev) => prev.filter((s) => !ids.includes(s.id)))
    setPubSel((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n })
    setRevSel((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n })
    setDeleteTarget(null)
  }

  // ── Published tab helpers ──────────────────────────────────────────────────

  function pubToggleSel(id: string) {
    setPubSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function pubBulkDelete() {
    const ids = [...pubSel]
    setDeleteTarget({ type: 'bulk', ids, count: ids.length })
  }

  // ── Review tab helpers ─────────────────────────────────────────────────────

  async function toggleReview() {
    setTogglingReview(true)
    const next = !reviewEnabled
    await fetch(`${API}/api/admin/settings`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewEnabled: next }),
    })
    setReviewEnabled(next); setTogglingReview(false)
  }

  function revToggleSel(id: string) {
    setRevSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function revBulkPublish() {
    const ids = [...revSel]
    await fetch(`${API}/api/admin/stems/bulk-publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setRevStems((prev) => prev.filter((s) => !revSel.has(s.id)))
    setRevSel(new Set())
  }

  function revBulkDelete() {
    const ids = [...revSel]
    setDeleteTarget({ type: 'bulk', ids, count: ids.length })
  }

  const grouped = revStems.reduce<Record<string, ReviewStem[]>>((acc, s) => {
    const key = s.uploadedFromJobId ?? 'no-job'
    acc[key] = [...(acc[key] ?? []), s]
    return acc
  }, {})

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header + subtabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{
          fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1.4rem',
          letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1,
        }}>
          Stems <span style={{ fontSize: '0.75rem', color: 'var(--mu)' }}>({pubTotal})</span>
        </h1>

        {/* Subtab switcher */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--di)', borderRadius: 6, overflow: 'hidden' }}>
          {(['published', 'review'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 16px',
              fontFamily: 'var(--font-exo2)', fontSize: '0.72rem',
              letterSpacing: '0.07em', textTransform: 'uppercase',
              border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--acc)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--mu)',
            }}>
              {t === 'published' ? 'Published' : `Review${revStems.length > 0 ? ` (${revStems.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Published tab ─────────────────────────────────────────────────── */}
      {tab === 'published' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 220 }}
              placeholder="Search stems…" value={pubSearch}
              onChange={(e) => { setPubSearch(e.target.value); setPubPage(1) }} />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: '0.78rem' }} onClick={loadPublished}>
                ↺ Refresh
              </button>
            </div>
          </div>

          {pubSel.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(104,120,255,.06)', border: '1px solid rgba(104,120,255,.2)',
              borderRadius: 7, padding: '8px 14px', marginBottom: 12,
            }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--mu)', flex: 1 }}>{pubSel.size} selected</span>
              <button className="btn-ghost"
                style={{ padding: '5px 12px', fontSize: '0.75rem', color: '#ef4444', borderColor: '#ef4444' }}
                onClick={pubBulkDelete}>
                Delete {pubSel.size}
              </button>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {pubLoading
              ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--mu)' }}>Loading…</div>
              : <StemsTable
                  stems={pubStems} allGenres={allGenres} selected={pubSel}
                  onSelect={pubToggleSel}
                  onSelectAll={(ids) => setPubSel(new Set(ids))}
                  onDelete={(id, title) => setDeleteTarget({ type: 'single', id, title })}
                  onGenreChange={updatePubGenres} onAddNewGenre={addGenre}
                  emptyMsg="No published stems"
                />
            }
          </div>

          {pubPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
              <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                disabled={pubPage === 1} onClick={() => setPubPage(pubPage - 1)}>← Prev</button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'var(--mu)', padding: '0 8px' }}>
                {pubPage} / {pubPages}
              </span>
              <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                disabled={pubPage === pubPages} onClick={() => setPubPage(pubPage + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* ── Review tab ────────────────────────────────────────────────────── */}
      {tab === 'review' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {/* View mode */}
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--di)', borderRadius: 6, overflow: 'hidden' }}>
              {(['flat', 'grouped'] as const).map((m) => (
                <button key={m} onClick={() => setRevViewMode(m)} style={{
                  padding: '6px 14px',
                  fontFamily: 'var(--font-exo2)', fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  border: 'none', cursor: 'pointer',
                  background: revViewMode === m ? 'var(--acc)' : 'transparent',
                  color: revViewMode === m ? '#fff' : 'var(--mu)',
                }}>
                  {m === 'flat' ? 'Flat' : 'By Playlist'}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Review required toggle */}
              <button onClick={toggleReview} disabled={togglingReview} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', border: '1px solid var(--di)', borderRadius: 6,
                background: 'transparent', cursor: 'pointer', opacity: togglingReview ? 0.5 : 1,
              }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-exo2)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mu)' }}>
                  Review required
                </span>
                <span style={{
                  display: 'inline-block', width: 32, height: 18, borderRadius: 9,
                  background: reviewEnabled ? 'var(--acc)' : 'var(--di)',
                  position: 'relative', transition: 'background 0.2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: reviewEnabled ? 16 : 3,
                    width: 12, height: 12, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s',
                  }} />
                </span>
              </button>

              {revStems.length > 0 && (
                <button className="btn-acc" style={{ padding: '7px 16px', fontSize: '0.78rem' }}
                  onClick={async () => {
                    await fetch(`${API}/api/admin/stems/bulk-publish`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ids: revStems.map((s) => s.id) }),
                    })
                    setRevStems([]); setRevSel(new Set())
                  }}>
                  Publish All ({revStems.length})
                </button>
              )}

              <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: '0.78rem' }} onClick={loadReview}>
                ↺ Refresh
              </button>
            </div>
          </div>

          {revSel.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(104,120,255,.06)', border: '1px solid rgba(104,120,255,.2)',
              borderRadius: 7, padding: '8px 14px', marginBottom: 12,
            }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--mu)', flex: 1 }}>{revSel.size} selected</span>
              <button className="btn-acc" style={{ padding: '5px 14px', fontSize: '0.75rem' }} onClick={revBulkPublish}>
                Publish {revSel.size}
              </button>
              <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: '0.75rem', color: '#ef4444', borderColor: '#ef4444' }} onClick={revBulkDelete}>
                Delete {revSel.size}
              </button>
            </div>
          )}

          {revLoading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--mu)' }}>Loading…</div>}

          {!revLoading && revViewMode === 'flat' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <StemsTable
                stems={revStems} allGenres={allGenres} selected={revSel}
                onSelect={revToggleSel}
                onSelectAll={(ids) => setRevSel(new Set(ids))}
                onDelete={(id, title) => setDeleteTarget({ type: 'single', id, title })}
                onGenreChange={updateRevGenres} onAddNewGenre={addGenre}
                emptyMsg="No pending stems"
              />
            </div>
          )}

          {!revLoading && revViewMode === 'grouped' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(grouped).map(([jobId, jobStems]) => (
                <div key={jobId} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderBottom: '1px solid var(--di)', background: 'var(--pb2)',
                  }}>
                    <span style={{ fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.75rem', color: 'var(--acc)' }}>
                      {jobId === 'no-job' ? 'No Job ID' : jobId}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--mu)' }}>
                      {jobStems.length} stem{jobStems.length !== 1 ? 's' : ''}
                    </span>
                    <div style={{ marginLeft: 'auto' }}>
                      <button className="btn-acc" style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                        onClick={async () => {
                          await fetch(`${API}/api/admin/stems/bulk-publish`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ids: jobStems.map((s) => s.id) }),
                          })
                          setRevStems((prev) => prev.filter((s) => !jobStems.some((j) => j.id === s.id)))
                        }}>
                        Publish All
                      </button>
                    </div>
                  </div>
                  <StemsTable
                    stems={jobStems} allGenres={allGenres} selected={revSel}
                    onSelect={revToggleSel}
                    onSelectAll={(ids) => setRevSel(new Set(ids))}
                    onDelete={(id, title) => setDeleteTarget({ type: 'single', id, title })}
                    onGenreChange={updateRevGenres} onAddNewGenre={addGenre}
                    emptyMsg="No pending stems"
                  />
                </div>
              ))}
              {Object.keys(grouped).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--mu)' }}>No pending stems</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Delete modal (shared) ──────────────────────────────────────────── */}
      {deleteTarget && (
        <>
          <div onClick={() => setDeleteTarget(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 301, width: '100%', maxWidth: 360,
            background: 'linear-gradient(160deg,#0c1535,#080f26)',
            border: '1px solid rgba(239,68,68,.3)', borderRadius: 16, padding: '28px 24px', textAlign: 'center',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#ef4444" strokeWidth="1.6"><polyline points="3 6 4.5 14 11.5 14 13 6"/><path d="M1 4h14M6 4V2h4v2"/></svg>
            </div>
            <h3 style={{ fontFamily: 'var(--font-exo2)', fontSize: 16, color: 'var(--tx)', margin: '0 0 8px' }}>
              Delete Stem{deleteTarget.type === 'bulk' ? 's' : ''}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--mu)', margin: '0 0 22px' }}>
              {deleteTarget.type === 'single'
                ? <><strong style={{ color: 'var(--tx)' }}>{deleteTarget.title}</strong> will be permanently removed.</>
                : <><strong style={{ color: 'var(--tx)' }}>{deleteTarget.count} stems</strong> will be permanently removed.</>
              }
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, height: 40, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--mu)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex: 1, height: 40, borderRadius: 9, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
