'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Stem = {
  id: string; title: string; artist: string; stemType: string
  genre: string; bpm: number | null; musicalKey: string | null
  isVisible: boolean; isLocked: boolean; createdAt: string
}

export default function AdminStems() {
  const [stems, setStems] = useState<Stem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

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
                <td style={{ padding: '8px 12px' }}>
                  <button
                    className="btn-ghost"
                    style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                    onClick={() => toggleVisibility(s.id)}
                  >
                    Toggle
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
