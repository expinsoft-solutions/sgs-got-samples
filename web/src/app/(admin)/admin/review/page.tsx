'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7626'

type Genre = { id: string; name: string }

type ReviewStem = {
  id: string
  title: string
  artist: string
  stemType: string
  bpm: number | null
  musicalKey: string | null
  duration: number | null
  playlistOrder: number
  uploadedFromJobId: string | null
  createdAt: string
  genres: Genre[]
}

function formatDuration(s: number | null): string {
  if (!s) return '—'
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ── Genre picker popover ───────────────────────────────────────────────────────

function GenrePicker({
  stemId,
  current,
  allGenres,
  onChange,
  onAddNewGenre,
}: {
  stemId: string
  current: Genre[]
  allGenres: Genre[]
  onChange: (genres: Genre[]) => void
  onAddNewGenre: (newGenre: Genre) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(current.map((g) => g.id)))
  const [saving, setSaving] = useState(false)
  const [newGenreName, setNewGenreName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function createGenre() {
    if (!newGenreName.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/genres`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGenreName }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create genre')
      }
      const newG = await res.json()
      onAddNewGenre(newG)
      setSelected((prev) => {
        const next = new Set(prev)
        next.add(newG.id)
        return next
      })
      setNewGenreName('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function save() {
    setSaving(true)
    const ids = [...selected]
    const res = await fetch(`${API}/api/admin/stems/${stemId}/genres`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genreIds: ids }),
    })
    const data = await res.json()
    onChange(data.genres)
    setSaving(false)
    setOpen(false)
  }

  function toggle(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Genre pills */}
      <div
        style={{ display: 'flex', gap: 4, flexWrap: 'wrap', cursor: 'pointer', minWidth: 60 }}
        onClick={() => { setSelected(new Set(current.map((g) => g.id))); setOpen(true) }}
      >
        {current.length === 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--mu2)' }}>— add</span>
        )}
        {current.map((g) => (
          <span key={g.id} style={{
            fontFamily: 'var(--font-exo2)', fontSize: '0.68rem',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            background: 'rgba(104,120,255,.1)', color: 'var(--acc)',
            padding: '2px 7px', borderRadius: 4,
          }}>
            {g.name}
          </span>
        ))}
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 50,
            background: '#000c24', border: '1px solid var(--me)',
            borderRadius: 8, padding: 8, minWidth: 180,
            boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          }}>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
              {allGenres.map((g) => (
                <label
                  key={g.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', cursor: 'pointer', borderRadius: 4,
                    background: selected.has(g.id) ? 'rgba(104,120,255,.1)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(g.id)}
                    onChange={() => toggle(g.id)}
                    style={{ accentColor: 'var(--acc)' }}
                  />
                  <span style={{
                    fontFamily: 'var(--font-exo2)', fontSize: '0.78rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: selected.has(g.id) ? 'var(--acc)' : 'var(--mu)',
                  }}>
                    {g.name}
                  </span>
                </label>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--di)', margin: '8px 0' }} />

            {/* Direct Genre Creation */}
            <div style={{ display: 'flex', gap: 6, marginBottom: error ? 4 : 8 }}>
              <input
                className="input"
                style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', height: 28 }}
                placeholder="New genre..."
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
              />
              <button
                className="btn-ghost"
                style={{ padding: '0 8px', fontSize: '0.68rem', height: 28, borderColor: 'var(--acc)', color: 'var(--acc)' }}
                disabled={!newGenreName.trim() || creating}
                onClick={createGenre}
              >
                {creating ? '…' : '+'}
              </button>
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.68rem', marginBottom: 8, wordBreak: 'break-word' }}>{error}</p>
            )}

            <button
              className="btn-acc"
              style={{ width: '100%', justifyContent: 'center', padding: '6px', fontSize: '0.72rem' }}
              disabled={saving}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Review table ──────────────────────────────────────────────────────────────

function StemRow({
  stem,
  allGenres,
  selected,
  onSelect,
  onPublish,
  onDelete,
  onGenreChange,
  onAddNewGenre,
}: {
  stem: ReviewStem
  allGenres: Genre[]
  selected: boolean
  onSelect: () => void
  onPublish: () => void
  onDelete: () => void
  onGenreChange: (genres: Genre[]) => void
  onAddNewGenre: (newGenre: Genre) => void
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
        }}>
          {stem.stemType}
        </span>
      </td>
      <td style={{ padding: '8px 12px' }}>
        <GenrePicker
          stemId={stem.id}
          current={stem.genres}
          allGenres={allGenres}
          onChange={onGenreChange}
          onAddNewGenre={onAddNewGenre}
        />
      </td>
      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.75rem', color: 'var(--mu)', textAlign: 'center' }}>
        {stem.bpm ? Number(stem.bpm).toFixed(1) : '—'}
      </td>
      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.72rem', color: 'var(--mu)', textAlign: 'center' }}>
        {stem.musicalKey ?? '—'}
      </td>
      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.72rem', color: 'var(--mu)', textAlign: 'center' }}>
        {formatDuration(stem.duration)}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn-acc"
            style={{ padding: '4px 12px', fontSize: '0.72rem' }}
            onClick={onPublish}
          >
            Publish
          </button>
          <button
            className="btn-ghost"
            style={{ padding: '4px 10px', fontSize: '0.72rem', color: '#ef4444', borderColor: '#ef4444' }}
            onClick={onDelete}
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  )
}

function StemsTable({
  stems,
  allGenres,
  selected,
  onSelect,
  onSelectAll,
  onPublish,
  onDelete,
  onGenreChange,
  onAddNewGenre,
}: {
  stems: ReviewStem[]
  allGenres: Genre[]
  selected: Set<string>
  onSelect: (id: string) => void
  onSelectAll: (ids: string[]) => void
  onPublish: (id: string) => void
  onDelete: (id: string) => void
  onGenreChange: (id: string, genres: Genre[]) => void
  onAddNewGenre: (newGenre: Genre) => void
}) {
  const allSelected = stems.length > 0 && stems.every((s) => selected.has(s.id))

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--di)', background: 'var(--pb2)' }}>
          <th style={{ padding: '8px 12px', width: 40 }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onSelectAll(allSelected ? [] : stems.map((s) => s.id))}
            />
          </th>
          {['Title', 'Type', 'Genres', 'BPM', 'Key', 'Duration', 'Actions'].map((h) => (
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
          <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--mu)' }}>
            No pending stems
          </td></tr>
        )}
        {stems.map((stem) => (
          <StemRow
            key={stem.id}
            stem={stem}
            allGenres={allGenres}
            selected={selected.has(stem.id)}
            onSelect={() => onSelect(stem.id)}
            onPublish={() => onPublish(stem.id)}
            onDelete={() => onDelete(stem.id)}
            onGenreChange={(genres) => onGenreChange(stem.id, genres)}
            onAddNewGenre={onAddNewGenre}
          />
        ))}
      </tbody>
    </table>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const [stems, setStems] = useState<ReviewStem[]>([])
  const [allGenres, setAllGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const [stemRes, genreRes] = await Promise.all([
      fetch(`${API}/api/admin/stems/review`).then((r) => r.json()),
      fetch(`${API}/api/admin/genres`).then((r) => r.json()),
    ])
    setStems(stemRes.stems ?? [])
    setAllGenres(genreRes.genres ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function toggleSelect(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function setSelectAll(ids: string[]) {
    setSelected(new Set(ids))
  }

  function updateGenres(stemId: string, genres: Genre[]) {
    setStems((prev) => prev.map((s) => s.id === stemId ? { ...s, genres } : s))
  }

  const handleAddNewGenre = useCallback((newG: Genre) => {
    setAllGenres((prev) => {
      if (prev.some((g) => g.id === newG.id)) return prev
      return [...prev, newG].sort((a, b) => a.name.localeCompare(b.name))
    })
  }, [])

  async function publishStem(id: string) {
    await fetch(`${API}/api/admin/stems/${id}/toggle-visibility`, { method: 'POST' })
    setStems((prev) => prev.filter((s) => s.id !== id))
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  async function deleteStem(id: string) {
    if (!confirm('Delete this stem?')) return
    await fetch(`${API}/api/admin/stems/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setStems((prev) => prev.filter((s) => s.id !== id))
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  async function bulkPublish() {
    const ids = [...selected]
    await Promise.all(ids.map((id) =>
      fetch(`${API}/api/admin/stems/${id}/toggle-visibility`, { method: 'POST' })
    ))
    setStems((prev) => prev.filter((s) => !selected.has(s.id)))
    setSelected(new Set())
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} stems?`)) return
    await fetch(`${API}/api/admin/stems/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    setStems((prev) => prev.filter((s) => !selected.has(s.id)))
    setSelected(new Set())
  }

  // Group by uploadedFromJobId
  const grouped = stems.reduce<Record<string, ReviewStem[]>>((acc, s) => {
    const key = s.uploadedFromJobId ?? 'no-job'
    acc[key] = [...(acc[key] ?? []), s]
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{
          fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1.4rem',
          letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1,
        }}>
          Review{' '}
          <span style={{ fontSize: '0.75rem', color: 'var(--mu)' }}>({stems.length} pending)</span>
        </h1>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--di)', borderRadius: 6, overflow: 'hidden' }}>
          {(['flat', 'grouped'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 14px',
                fontFamily: 'var(--font-exo2)', fontSize: '0.72rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                border: 'none', cursor: 'pointer',
                background: viewMode === mode ? 'var(--acc)' : 'transparent',
                color: viewMode === mode ? '#fff' : 'var(--mu)',
              }}
            >
              {mode === 'flat' ? 'Flat' : 'By Playlist'}
            </button>
          ))}
        </div>

        <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: '0.78rem' }} onClick={load}>
          ↺ Refresh
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(104,120,255,.06)', border: '1px solid rgba(104,120,255,.2)',
          borderRadius: 7, padding: '8px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--mu)', flex: 1 }}>
            {selected.size} selected
          </span>
          <button className="btn-acc" style={{ padding: '5px 14px', fontSize: '0.75rem' }} onClick={bulkPublish}>
            Publish {selected.size}
          </button>
          <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: '0.75rem', color: '#ef4444', borderColor: '#ef4444' }} onClick={bulkDelete}>
            Delete {selected.size}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--mu)' }}>Loading…</div>
      )}

      {/* Flat view */}
      {!loading && viewMode === 'flat' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <StemsTable
            stems={stems}
            allGenres={allGenres}
            selected={selected}
            onSelect={toggleSelect}
            onSelectAll={setSelectAll}
            onPublish={publishStem}
            onDelete={deleteStem}
            onGenreChange={updateGenres}
            onAddNewGenre={handleAddNewGenre}
          />
        </div>
      )}

      {/* Grouped by playlist (uploadedFromJobId) */}
      {!loading && viewMode === 'grouped' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(grouped).map(([jobId, jobStems]) => (
            <div key={jobId} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Group header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderBottom: '1px solid var(--di)',
                background: 'var(--pb2)',
              }}>
                <span style={{
                  fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.75rem',
                  color: 'var(--acc)',
                }}>
                  {jobId === 'no-job' ? 'No Job ID' : jobId}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--mu)' }}>
                  {jobStems.length} stem{jobStems.length !== 1 ? 's' : ''}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button
                    className="btn-acc"
                    style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                    onClick={() => Promise.all(jobStems.map((s) => publishStem(s.id)))}
                  >
                    Publish All
                  </button>
                </div>
              </div>
              <StemsTable
                stems={jobStems}
                allGenres={allGenres}
                selected={selected}
                onSelect={toggleSelect}
                onSelectAll={setSelectAll}
                onPublish={publishStem}
                onDelete={deleteStem}
                onGenreChange={updateGenres}
                onAddNewGenre={handleAddNewGenre}
              />
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--mu)' }}>
              No pending stems
            </div>
          )}
        </div>
      )}
    </div>
  )
}
