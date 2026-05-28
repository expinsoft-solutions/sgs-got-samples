'use client'

import { useEffect, useState } from 'react'

export function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--pb)', border: `1px solid ${hovered ? 'rgba(96,116,255,.3)' : 'var(--di)'}`,
        borderRadius: 11, padding: '20px 16px',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform .2s, border-color .2s',
      }}
    >
      <span style={{ fontSize: 15, marginBottom: 9, display: 'block', opacity: 0.75 }}>{icon}</span>
      <div style={{
        fontFamily: 'var(--font-exo2)', fontSize: '0.75rem',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        margin: '0 0 6px', color: 'var(--tx)',
      }}>
        {title}
      </div>
      <p style={{ fontSize: 12.5, color: '#c8d2ea', lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  )
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7626'

export function HomeStats() {
  const [genreCount, setGenreCount] = useState<string>('—')

  useEffect(() => {
    fetch(`${API}/api/vault/genres`)
      .then((r) => r.json())
      .then((d) => {
        const count = d.genres?.length
        if (count) setGenreCount(String(count))
      })
      .catch(() => setGenreCount('8'))
  }, [])

  const stats = [
    { value: genreCount, label: 'Genres' },
    { value: '5', label: 'Stem Types' },
    { value: 'Lifetime', label: 'Access' },
    { value: 'One-Time', label: 'Payment' },
  ]

  return (
    <div style={{
      display: 'flex',
      background: 'var(--pb)', border: '1px solid var(--di)',
      borderRadius: 11, overflow: 'hidden',
      marginTop: 28, maxWidth: 640, width: '100%',
      marginLeft: 'auto', marginRight: 'auto',
    }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{
          flex: 1, textAlign: 'center', padding: '18px 8px',
          borderRight: i < stats.length - 1 ? '1px solid var(--di)' : 'none',
        }}>
          <div style={{
            fontFamily: 'var(--font-exo2)', fontSize: '1.25rem',
            fontWeight: 300, color: 'var(--tx)', letterSpacing: '-0.01em', lineHeight: 1.2,
          }}>
            {s.value}
          </div>
          <div style={{
            fontSize: 10, textTransform: 'uppercase',
            letterSpacing: '0.09em', color: '#c8d2ea', marginTop: 3,
          }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}
