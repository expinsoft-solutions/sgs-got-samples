'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV = [
  { href: '/library', label: 'Library' },
  { href: '/vault', label: 'Vault' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
]

export function Header() {
  const path = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 'var(--hh)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 32px', zIndex: 50,
        background: 'rgba(0,5,18,.95)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,.055)',
      }}>
        {/* Brand */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.88rem',
            letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--tx)',
          }}>
            Son Got Samples
          </span>
        </Link>

        {/* Desktop nav */}
        <nav style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.88rem',
                letterSpacing: '0.11em', textTransform: 'uppercase',
                color: path.startsWith(n.href) ? 'var(--acc)' : 'var(--tx)',
                opacity: path.startsWith(n.href) ? 1 : 0.68,
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Auth area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/login" style={{
            fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.88rem',
            letterSpacing: '0.11em', textTransform: 'uppercase',
            color: 'var(--tx)', opacity: 0.8,
          }}>
            Login
          </Link>
          <span style={{ width: 1, height: 16, background: 'var(--me)' }} />
          <Link href="/register" className="btn-acc" style={{ padding: '7px 16px', fontSize: '0.78rem' }}>
            Sign Up
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'none', background: 'transparent', border: 'none',
            cursor: 'pointer', padding: 10,
          }}
          className="menu-toggle"
          aria-label="Menu"
        >
          <span style={{ display: 'block', width: 25, height: 2, background: 'white', margin: '5px 0' }} />
          <span style={{ display: 'block', width: 25, height: 2, background: 'white', margin: '5px 0' }} />
          <span style={{ display: 'block', width: 25, height: 2, background: 'white', margin: '5px 0' }} />
        </button>
      </header>

      {/* Mobile nav */}
      <div style={{
        position: 'fixed', top: 0, right: menuOpen ? 0 : '-100%',
        width: '70%', maxWidth: 280, height: '100vh',
        background: 'rgba(5,12,35,.98)', backdropFilter: 'blur(14px)',
        zIndex: 99, padding: '80px 25px 30px', transition: '0.3s',
        display: 'flex', flexDirection: 'column', gap: 20,
        borderLeft: '1px solid var(--di)',
      }}>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setMenuOpen(false)}
            style={{
              color: 'var(--tx)', fontSize: '1rem', padding: '12px 0',
              borderBottom: '1px solid var(--di)',
              fontFamily: 'var(--font-exo2)', letterSpacing: '0.1em',
            }}
          >
            {n.label}
          </Link>
        ))}
      </div>

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 98,
          }}
        />
      )}
    </>
  )
}
