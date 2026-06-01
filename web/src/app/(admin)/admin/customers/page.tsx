'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7626'

type Customer = {
  id: string; email: string; name: string | null
  tier: string; isActive: boolean; createdAt: string
  downloadCount: number
}

type EditState = { open: boolean; user: Customer | null; name: string; email: string; tier: string; status: string }

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, { bg: string; border: string; color: string; label: string }> = {
    free:  { bg: 'rgba(255,255,255,.06)', border: 'rgba(255,255,255,.1)', color: 'var(--mu)', label: 'Free' },
    paid:  { bg: 'rgba(30,185,145,.13)', border: '#1eb991', color: '#23c99a', label: 'Full Download' },
    admin: { bg: 'rgba(96,116,255,.14)', border: 'rgba(96,116,255,.3)', color: '#8097ff', label: 'Admin' },
  }
  const s = map[tier] ?? map.free
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
      borderRadius: 5, fontSize: 10, fontFamily: 'var(--font-exo2)',
      letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 600,
      border: `1px solid ${s.border}`, background: s.bg, color: s.color,
    }}>{s.label}</span>
  )
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', marginLeft: 6,
      borderRadius: 5, fontSize: 10, fontFamily: 'var(--font-exo2)',
      letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 600,
      background: isActive ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
      border: `1px solid ${isActive ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
      color: isActive ? '#4ade80' : '#f87171',
    }}>{isActive ? 'Active' : 'Banned'}</span>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,.35)',
  border: '1px solid rgba(255,255,255,.1)', borderRadius: 8,
  color: 'var(--tx)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<EditState>({ open: false, user: null, name: '', email: '', tier: 'free', status: 'active' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), limit: '25' })
    if (search) qs.set('search', search)
    if (tier) qs.set('tier', tier)
    const res = await fetch(`${API}/api/admin/customers?${qs}`)
    const data = await res.json()
    setCustomers(data.users ?? [])
    setTotal(data.pagination?.total ?? 0)
    setPages(data.pagination?.pages ?? 1)
    setLoading(false)
  }, [page, search, tier])

  useEffect(() => { load() }, [load])

  function toggleSelect(id: string) {
    const n = new Set(selected)
    n.has(id) ? n.delete(id) : n.add(id)
    setSelected(n)
  }

  function toggleAll() {
    setSelected(selected.size === customers.length ? new Set() : new Set(customers.map(c => c.id)))
  }

  function openEdit(c: Customer) {
    setEdit({ open: true, user: c, name: c.name ?? '', email: c.email, tier: c.tier, status: c.isActive ? 'active' : 'banned' })
  }

  async function saveEdit() {
    if (!edit.user) return
    setSaving(true)
    await fetch(`${API}/api/admin/customers/${edit.user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: edit.name,
        email: edit.email,
        tier: edit.tier,
        isActive: edit.status === 'active',
      }),
    })
    setEdit(e => ({ ...e, open: false }))
    setSaving(false)
    showToast('Saved')
    load()
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv') { showToast('Please upload a .csv file'); return }
    setCsvLoading(true)
    showToast('Uploading CSV…')
    const fd = new FormData()
    fd.append('csv', file)
    const res = await fetch(`${API}/api/admin/customers/import-csv`, { method: 'POST', body: fd })
    const data = await res.json()
    setCsvLoading(false)
    e.target.value = ''
    if (!res.ok) { showToast(data.message ?? 'Import failed'); return }
    showToast(`✓ ${data.imported} imported · ${data.skipped} skipped · ${data.failed} failed`)
    load()
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    await fetch(`${API}/api/admin/customers/${deleteConfirm.id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    showToast('Deleted')
    load()
  }

  const thStyle: React.CSSProperties = {
    padding: '11px 14px', textAlign: 'left',
    fontFamily: 'var(--font-exo2)', fontSize: '.65rem',
    letterSpacing: '.1em', textTransform: 'uppercase',
    color: 'var(--mu)', borderBottom: '1px solid var(--di)', fontWeight: 400,
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search by email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{
            flex: 1, minWidth: 200, height: 40,
            background: 'rgba(255,255,255,.05)', border: '1px solid var(--me)',
            borderRadius: 9, padding: '0 12px 0 36px', color: 'var(--tx)',
            fontSize: 13, outline: 'none', fontFamily: 'inherit',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' fill='none' viewBox='0 0 24 24' stroke='%238f9abf' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: '12px center',
          }}
        />
        <select
          value={tier} onChange={e => { setTier(e.target.value); setPage(1) }}
          style={{ height: 40, padding: '0 10px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--me)', borderRadius: 9, color: 'var(--tx)', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <option value="">All Tiers</option>
          <option value="free">Free</option>
          <option value="paid">Full Download</option>
          <option value="admin">Admin</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--mu)', marginLeft: 4 }}>{total} users</span>

        {/* Import CSV */}
        <label style={{
          height: 40, padding: '0 14px', borderRadius: 9,
          background: 'rgba(255,255,255,.04)', border: '1px solid var(--me)',
          color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 7,
          cursor: 'pointer', whiteSpace: 'nowrap',
          opacity: csvLoading ? 0.6 : 1,
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 2v8M5 7l3 3 3-3M3 12h10"/>
          </svg>
          {csvLoading ? 'Importing…' : 'Import CSV'}
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} disabled={csvLoading} />
        </label>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--di)', borderRadius: 11, overflow: 'hidden', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,.025)' }}>
              <th style={{ ...thStyle, width: 36 }}>
                <input type="checkbox" checked={selected.size === customers.length && customers.length > 0} onChange={toggleAll} />
              </th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Tier</th>
              <th style={thStyle}>Downloads</th>
              <th style={thStyle}>Joined</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--mu2)' }}>Loading…</td></tr>}
            {!loading && customers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--mu2)' }}>No customers found</td></tr>}
            {customers.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--di)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '12px 14px' }}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--tx)' }}>
                  {c.email}
                  <StatusBadge isActive={c.isActive} />
                </td>
                <td style={{ padding: '12px 14px' }}><TierBadge tier={c.tier} /></td>
                <td style={{ padding: '12px 14px', color: 'var(--mu)', fontFamily: 'var(--font-share-tech-mono)', fontSize: 12 }}>
                  {c.downloadCount}
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--mu)', fontSize: 12 }}>
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    {/* Edit */}
                    <button onClick={() => openEdit(c)} style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,.04)', border: '1px solid var(--me)', color: 'var(--mu)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Edit">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11.5 2.5a2.12 2.12 0 0 1 3 3L5 15H1v-4z"/></svg>
                    </button>
                    {/* Delete */}
                    <button onClick={() => setDeleteConfirm(c)} style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,.04)', border: '1px solid var(--me)', color: 'var(--mu)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Delete">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="3 6 4.5 14 11.5 14 13 6"/><path d="M1 4h14M6 4V2h4v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <button className="btn-ghost" style={{ width: 32, height: 32, padding: 0, fontSize: 12 }} disabled={page === 1} onClick={() => setPage(page - 1)}>←</button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setPage(n)} style={{
              width: 32, height: 32, borderRadius: 6, border: `1px solid ${n === page ? 'var(--acc)' : 'var(--di)'}`,
              background: n === page ? 'rgba(96,116,255,.2)' : 'rgba(255,255,255,.04)',
              color: n === page ? 'var(--acc)' : 'var(--mu)', fontSize: 12, cursor: 'pointer',
            }}>{n}</button>
          ))}
          <button className="btn-ghost" style={{ width: 32, height: 32, padding: 0, fontSize: 12 }} disabled={page === pages} onClick={() => setPage(page + 1)}>→</button>
        </div>
      )}

      {/* Edit modal */}
      {edit.open && (
        <>
          <div onClick={() => setEdit(e => ({ ...e, open: false }))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 301, width: '100%', maxWidth: 400,
            background: 'linear-gradient(160deg,#0c1535,#080f26)',
            border: '1px solid rgba(96,116,255,.22)', borderRadius: 16, padding: '28px 24px',
            boxShadow: '0 24px 60px rgba(0,0,0,.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-exo2)', fontSize: 14, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tx)', margin: 0 }}>Edit Customer</h3>
              <button onClick={() => setEdit(e => ({ ...e, open: false }))} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Name', value: edit.name, key: 'name' as const, type: 'text' },
                { label: 'Email', value: edit.email, key: 'email' as const, type: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--mu)', marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e => setEdit(prev => ({ ...prev, [f.key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--mu)', marginBottom: 6, fontWeight: 600 }}>Tier</label>
                <select value={edit.tier} onChange={e => setEdit(prev => ({ ...prev, tier: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="free">Free</option>
                  <option value="paid">Full Download</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--mu)', marginBottom: 6, fontWeight: 600 }}>Status</label>
                <select value={edit.status} onChange={e => setEdit(prev => ({ ...prev, status: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="active">Active</option>
                  <option value="banned">Banned</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEdit(e => ({ ...e, open: false }))} style={{ flex: 1, height: 40, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--mu)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{ flex: 1, height: 40, borderRadius: 9, background: 'linear-gradient(135deg,var(--acc),#4a5ee8)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <>
          <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 301, width: '100%', maxWidth: 360,
            background: 'linear-gradient(160deg,#0c1535,#080f26)',
            border: '1px solid rgba(239,68,68,.3)', borderRadius: 16, padding: '28px 24px', textAlign: 'center',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#ef4444" strokeWidth="1.6"><polyline points="3 6 4.5 14 11.5 14 13 6"/><path d="M1 4h14M6 4V2h4v2"/></svg>
            </div>
            <h3 style={{ fontFamily: 'var(--font-exo2)', fontSize: 16, color: 'var(--tx)', margin: '0 0 8px' }}>Delete Customer</h3>
            <p style={{ fontSize: 13, color: 'var(--mu)', margin: '0 0 22px' }}>Delete <strong style={{ color: 'var(--tx)' }}>{deleteConfirm.email}</strong>? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: 40, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--mu)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex: 1, height: 40, borderRadius: 9, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', padding: '10px 22px', borderRadius: 8, fontSize: 13, zIndex: 500, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
