'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Stem = {
  id: string; title: string; artist: string; stemType: string
  genre: string; bpm: number | null; musicalKey: string | null
  isVisible: boolean; isLocked: boolean; createdAt: string
}

type Genre = { id: string; name: string; slug: string }

// ── Genre editor modal ──────────────────────────────────────────────────────
function GenreModal({
  stem, onClose, onSaved,
}: {
  stem: Stem
  onClose: () => void
  onSaved: () => void
}) {
  const [genres, setGenres] = useState<Genre[]>([])
  const [selected, setSelected] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [newGenreName, setNewGenreName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/api/admin/genres`)
      .then((r) => r.json())
      .then((d) => {
        setGenres(d.genres ?? [])
        // Pre-select the current genre by name
        const current = (d.genres ?? []).find((g: Genre) => g.name === stem.genre)
        if (current) setSelected(current.id)
      })
  }, [stem.genre])

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
      // Add new genre and sort them by name
      setGenres((prev) => [...prev, newG].sort((a, b) => a.name.localeCompare(b.name)))
      setSelected(newG.id)
      setNewGenreName('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function save() {
    if (!selected) return
    setSaving(true)
    await fetch(`${API}/api/admin/stems/${stem.id}/genres`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genreIds: [selected] }),
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 100, backdropFilter: 'blur(2px)',
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 101, background: 'var(--pb2)',
        border: '1px solid var(--di)', borderRadius: 10,
        padding: '24px 28px', minWidth: 340,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <p style={{
          fontFamily: 'var(--font-exo2)', fontSize: '0.68rem',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--mu2)', marginBottom: 4,
        }}>
          Edit Genre
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--tx)', marginBottom: 18, fontWeight: 500 }}>
          {stem.title}
          <span style={{ color: 'var(--mu)', fontWeight: 400, fontSize: '0.8rem' }}> · {stem.artist}</span>
        </p>

        <select
          className="input"
          style={{ width: '100%', marginBottom: 12 }}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">— pick a genre —</option>
          {genres.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        {/* Direct Genre Creation */}
        <div style={{ display: 'flex', gap: 8, marginBottom: error ? 8 : 18 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Or create new genre..."
            value={newGenreName}
            onChange={(e) => setNewGenreName(e.target.value)}
          />
          <button
            className="btn-ghost"
            style={{ padding: '0 12px', fontSize: '0.75rem', borderColor: 'var(--acc)', color: 'var(--acc)' }}
            disabled={!newGenreName.trim() || creating}
            onClick={createGenre}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>

        {error && (
          <p style={{ color: '#ef4444', fontSize: '0.72rem', marginBottom: 18, marginTop: -4 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" style={{ padding: '7px 16px', fontSize: '0.78rem' }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-ghost"
            style={{ padding: '7px 16px', fontSize: '0.78rem', color: 'var(--acc)', borderColor: 'var(--acc)', opacity: saving ? 0.5 : 1 }}
            disabled={!selected || saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function AdminStems() {
  const [stems, setStems] = useState<Stem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [editStem, setEditStem] = useState<Stem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), limit: '50' })
    if (search) qs.set('search', search)
    const res = await fetch(`${API}/api/admin/stems?${qs}`)
    const data = await res.json()
    setStems(data.stems ?? [])
    setTotal(data.pagination?.total ?? 0)
    setPages(data.pagination?.pages ?? 1)
    setLoading(false)
  }, [page, search])

  useEffect(() => { load() }, [load])

  async function toggleVisibility(id: string) {
    await fetch(`${API}/api/admin/stems/${id}/toggle-visibility`, { method: 'POST' })
    load()
  }

  async function bulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} stems?`)) return
    await fetch(`${API}/api/admin/stems/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    setSelected(new Set())
    load()
  }

  function toggleSelect(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    if (selected.size === stems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(stems.map((s) => s.id)))
    }
  }

  return (
    <div>
      {editStem && (
        <GenreModal
          stem={editStem}
          onClose={() => setEditStem(null)}
          onSaved={load}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{
          fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1.4rem',
          letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1,
        }}>
          Stems <span style={{ fontSize: '0.75rem', color: 'var(--mu)' }}>({total})</span>
        </h1>
        <input
          className="input" style={{ width: 220 }}
          placeholder="Search stems…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        {selected.size > 0 && (
          <button className="btn-ghost" style={{ color: '#ef4444', borderColor: '#ef4444', padding: '8px 16px', fontSize: '0.78rem' }}
            onClick={bulkDelete}>
            Delete {selected.size}
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--di)', background: 'var(--pb2)' }}>
              <th style={{ padding: '10px 12px', width: 40 }}>
                <input type="checkbox" checked={selected.size === stems.length && stems.length > 0}
                  onChange={toggleAll} />
              </th>
              {['Title', 'Artist', 'Type', 'Genre', 'BPM', 'Key', 'Visible', 'Actions'].map((h) => (
                <th key={h} style={{
                  padding: '10px 12px', textAlign: 'left',
                  fontFamily: 'var(--font-exo2)', fontSize: '0.7rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--mu2)', fontWeight: 400,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--mu)' }}>Loading…</td></tr>
            )}
            {stems.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--di)' }}>
                <td style={{ padding: '8px 12px' }}>
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
                </td>
                <td style={{ padding: '8px 12px', fontSize: '0.84rem', color: 'var(--tx)' }}>{s.title}</td>
                <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--mu)' }}>{s.artist}</td>
                <td style={{ padding: '8px 12px', fontSize: '0.72rem', color: 'var(--acc)' }}>{s.stemType}</td>
                <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--mu)' }}>{s.genre}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.75rem', color: 'var(--mu)' }}>
                  {s.bpm ?? '—'}
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font-share-tech-mono)', fontSize: '0.72rem', color: 'var(--mu)' }}>
                  {s.musicalKey ?? '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    fontFamily: 'var(--font-exo2)', fontSize: '0.65rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: s.isVisible ? '#4caf82' : 'var(--mu2)',
                    background: s.isVisible ? 'rgba(76,175,130,.1)' : 'var(--pb)',
                    padding: '2px 7px', borderRadius: 4,
                  }}>
                    {s.isVisible ? 'Visible' : 'Hidden'}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
                  <button
                    className="btn-ghost"
                    style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                    onClick={() => toggleVisibility(s.id)}
                  >
                    Toggle
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ padding: '4px 10px', fontSize: '0.7rem', color: 'var(--acc)', borderColor: 'var(--acc)' }}
                    onClick={() => setEditStem(s)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
          <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'var(--mu)', padding: '0 8px' }}>
            {page} / {pages}
          </span>
          <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            disabled={page === pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
