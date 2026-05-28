'use client'

import { useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const STEM_TYPES = ['Acapella', 'Drums', 'Bass', 'Melody', 'Instrumental']

type UploadStatus = { name: string; status: 'pending' | 'uploading' | 'done' | 'error' | 'duplicate'; message?: string }

export default function AdminUpload() {
  const [files, setFiles] = useState<File[]>([])
  const [statuses, setStatuses] = useState<UploadStatus[]>([])

  // Shared metadata for batch
  const [stemType, setStemType] = useState('Instrumental')
  const [genre, setGenre] = useState('')
  const [artist, setArtist] = useState('')
  const [jobId, setJobId] = useState('')
  const [uploading, setUploading] = useState(false)

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setFiles(picked)
    setStatuses(picked.map((f) => ({ name: f.name, status: 'pending' })))
  }

  function updateStatus(i: number, patch: Partial<UploadStatus>) {
    setStatuses((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  async function uploadAll() {
    if (!genre || !artist) { alert('Genre and artist required'); return }
    setUploading(true)

    const batchJobId = jobId || `job-${Date.now()}`

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      updateStatus(i, { status: 'uploading' })

      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', file.name.replace(/\.[^.]+$/, ''))
      fd.append('artist', artist)
      fd.append('stem_type', stemType)
      fd.append('genre', genre)
      fd.append('job_id', batchJobId)

      try {
        const res = await fetch(`${API}/api/upload/single`, { method: 'POST', body: fd })
        const data = await res.json()
        if (res.status === 409) {
          updateStatus(i, { status: 'duplicate', message: data.message })
        } else if (!data.success) {
          updateStatus(i, { status: 'error', message: data.message })
        } else {
          updateStatus(i, { status: 'done', message: `ID: ${data.stem?.id}` })
        }
      } catch (e) {
        updateStatus(i, { status: 'error', message: String(e) })
      }
    }

    setUploading(false)
  }

  async function completeJob() {
    if (!jobId) return
    const res = await fetch(`${API}/api/vault/jobs/${jobId}/complete`, { method: 'POST' })
    const data = await res.json()
    alert(data.message ?? 'Done')
  }

  async function cancelJob() {
    if (!jobId) return
    if (!confirm('Cancel and delete all staged stems for this job?')) return
    const res = await fetch(`${API}/api/vault/jobs/${jobId}/cancel`, { method: 'POST' })
    const data = await res.json()
    alert(data.message ?? 'Cancelled')
  }

  const statusColor: Record<string, string> = {
    pending: 'var(--mu2)',
    uploading: '#f59e0b',
    done: '#4caf82',
    error: '#ef4444',
    duplicate: '#f59e0b',
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{
        fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1.4rem',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 28,
      }}>
        Upload Stems
      </h1>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: 'var(--font-exo2)', fontSize: '0.8rem', letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 16,
        }}>Batch Metadata</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--mu2)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-exo2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Artist *</label>
            <input className="input" placeholder="Artist name" value={artist} onChange={(e) => setArtist(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--mu2)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-exo2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Genre *</label>
            <input className="input" placeholder="e.g. Hip-Hop" value={genre} onChange={(e) => setGenre(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--mu2)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-exo2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Stem Type</label>
            <select className="input" value={stemType} onChange={(e) => setStemType(e.target.value)}>
              {STEM_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--mu2)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-exo2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Job ID</label>
            <input className="input" placeholder="Optional batch ID" value={jobId} onChange={(e) => setJobId(e.target.value)} />
          </div>
        </div>
      </div>

      {/* File picker */}
      <div className="card" style={{ marginBottom: 20 }}>
        <label
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10, padding: '28px 20px', border: '2px dashed var(--di)',
            borderRadius: 8, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>♪</span>
          <span style={{ fontFamily: 'var(--font-exo2)', fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mu)' }}>
            {files.length > 0 ? `${files.length} file(s) selected` : 'Click to select MP3/WAV files'}
          </span>
          <input type="file" multiple accept=".mp3,.wav,.ogg" style={{ display: 'none' }} onChange={onFilesChange} />
        </label>
      </div>

      {/* File list with status */}
      {statuses.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          {statuses.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 14px', borderBottom: '1px solid var(--di)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: statusColor[s.status], flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--mu2)' }}>{s.message}</span>
              <span style={{
                fontFamily: 'var(--font-exo2)', fontSize: '0.65rem',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: statusColor[s.status],
              }}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="btn-acc"
          disabled={files.length === 0 || uploading}
          onClick={uploadAll}
        >
          {uploading ? 'Uploading…' : `Upload ${files.length} File(s)`}
        </button>
        {jobId && (
          <>
            <button className="btn-ghost" style={{ color: '#4caf82', borderColor: '#4caf82' }} onClick={completeJob}>
              Complete Job
            </button>
            <button className="btn-ghost" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={cancelJob}>
              Cancel Job
            </button>
          </>
        )}
      </div>
    </div>
  )
}
