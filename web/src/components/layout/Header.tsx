'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'

const NAV = [
  { href: '/library', label: 'Library' },
  { href: '/vault', label: 'Vault' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
]

export function Header() {
  const path = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const { me, authLoading, signOut: ctxSignOut } = useAuth()

  async function signOut() {
    await ctxSignOut()
    router.push('/')
  }

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
            <Link key={n.href} href={n.href} style={{
              fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.88rem',
              letterSpacing: '0.11em', textTransform: 'uppercase',
              color: path.startsWith(n.href) ? 'var(--acc)' : 'var(--tx)',
              opacity: path.startsWith(n.href) ? 1 : 0.68,
            }}>
              {n.label}
            </Link>
          ))}
          {me?.isAdmin && (
            <Link href="/admin" style={{
              fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.88rem',
              letterSpacing: '0.11em', textTransform: 'uppercase',
              color: path.startsWith('/admin') ? 'var(--acc)' : 'var(--acc)',
              opacity: 0.7,
            }}>
              Admin
            </Link>
          )}
        </nav>

        {/* Auth area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {authLoading ? (
            <div style={{ width: 80, height: 20, borderRadius: 4, background: 'rgba(255,255,255,.06)' }} />
          ) : me ? (
            <div style={{ position: 'relative' }}>
              {/* Email button */}
              <button
                onClick={() => setDropOpen(o => !o)}
                style={{
                  fontFamily: 'var(--font-exo2)', fontSize: '0.8rem',
                  letterSpacing: '0.08em', color: 'var(--mu)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {me.name ?? me.email}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5 5 6.5 8 3.5" />
                </svg>
              </button>

              {/* Dropdown */}
              {dropOpen && (
                <>
                  <div onClick={() => setDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 50,
                    background: '#000c24', border: '1px solid var(--me)',
                    borderRadius: 9, minWidth: 180, overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,.5)',
                  }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--di)', fontSize: 11, color: 'var(--mu2)', fontFamily: 'var(--font-exo2)', letterSpacing: '.06em' }}>
                      {me.email}
                    </div>
                    <Link href="/dashboard" onClick={() => setDropOpen(false)} style={{
                      display: 'block', padding: '10px 14px', fontSize: '0.8rem',
                      fontFamily: 'var(--font-exo2)', letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: 'var(--mu)', transition: 'color .1s',
                    }}>
                      User Settings
                    </Link>
                    <button onClick={() => { setDropOpen(false); signOut() }} style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 14px', fontSize: '0.8rem',
                      fontFamily: 'var(--font-exo2)', letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer',
                      borderTop: '1px solid var(--di)',
                    }}>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}

          {/* Mobile toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            display: 'none', background: 'transparent', border: 'none',
            cursor: 'pointer', padding: 10,
          }} className="menu-toggle" aria-label="Menu">
            <span style={{ display: 'block', width: 25, height: 2, background: 'white', margin: '5px 0' }} />
            <span style={{ display: 'block', width: 25, height: 2, background: 'white', margin: '5px 0' }} />
            <span style={{ display: 'block', width: 25, height: 2, background: 'white', margin: '5px 0' }} />
          </button>
        </div>
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
          <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} style={{
            color: 'var(--tx)', fontSize: '1rem', padding: '12px 0',
            borderBottom: '1px solid var(--di)',
            fontFamily: 'var(--font-exo2)', letterSpacing: '0.1em',
          }}>
            {n.label}
          </Link>
        ))}
        {me?.isAdmin && (
          <Link href="/admin" onClick={() => setMenuOpen(false)} style={{
            color: 'var(--acc)', fontSize: '1rem', padding: '12px 0',
            borderBottom: '1px solid var(--di)',
            fontFamily: 'var(--font-exo2)', letterSpacing: '0.1em',
          }}>
            Admin
          </Link>
        )}
        {me ? (
          <button onClick={signOut} style={{
            background: 'none', border: 'none', color: 'var(--mu)',
            textAlign: 'left', fontSize: '0.9rem', cursor: 'pointer', padding: '12px 0',
            fontFamily: 'var(--font-exo2)',
          }}>Sign Out</button>
        ) : (
          <Link href="/login" onClick={() => setMenuOpen(false)} style={{
            color: 'var(--acc)', padding: '12px 0',
            fontFamily: 'var(--font-exo2)', letterSpacing: '0.1em',
          }}>Sign In</Link>
        )}
      </div>

      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 98,
        }} />
      )}
    </>
  )
}
