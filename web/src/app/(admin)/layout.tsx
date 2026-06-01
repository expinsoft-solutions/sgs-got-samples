'use client'

import { SpaceBg } from '@/components/layout/SpaceBg'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABS: { href: string; label: string; exact?: boolean }[] = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/stems', label: 'Stems' },
  { href: '/admin/review', label: 'Review' },
  { href: '/admin/upload', label: 'Upload' },
  { href: '/admin/vault', label: 'Vault Ops' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  return (
    <>
      <SpaceBg />

      {/* Top header */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 68,
        background: 'rgba(0,5,18,.95)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-exo2)', fontSize: '.88rem',
            letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--tx)',
          }}>
            Son Got Samples
          </span>
          <span style={{
            fontSize: '.6rem', letterSpacing: '.12em', textTransform: 'uppercase',
            background: 'rgba(96,116,255,.15)', border: '1px solid rgba(96,116,255,.3)',
            color: 'var(--acc)', borderRadius: 4, padding: '2px 8px',
          }}>
            Admin
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" style={{
            height: 32, padding: '0 14px', borderRadius: 7,
            background: 'rgba(255,255,255,.04)', border: '1px solid var(--me)',
            color: 'var(--mu)', fontSize: 12, fontFamily: 'var(--font-exo2)',
            textTransform: 'uppercase', letterSpacing: '.06em',
            display: 'inline-flex', alignItems: 'center',
          }}>
            ← Site
          </Link>
        </div>
      </header>

      {/* Content */}
      <div style={{ paddingTop: 68 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 24px 60px' }}>

          {/* Title */}
          <div style={{
            fontFamily: 'var(--font-exo2)', fontWeight: 200,
            fontSize: 'clamp(22px,3vw,34px)', letterSpacing: '.02em',
            margin: '0 0 4px', color: 'var(--tx)',
          }}>
            Admin Dashboard
          </div>
          <div style={{ fontSize: 13, color: 'var(--mu)', margin: '0 0 24px' }}>
            Manage customers and stem library
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0,
            borderBottom: '1px solid var(--di)',
            marginBottom: 22, flexWrap: 'wrap',
          }}>
            {TABS.map((t) => {
              const active = t.exact ? path === t.href : path.startsWith(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  style={{
                    height: 40, padding: '0 20px',
                    background: active ? 'var(--pb)' : 'transparent',
                    border: active ? '1px solid var(--di)' : '1px solid transparent',
                    borderBottom: active ? '1px solid var(--bg)' : '1px solid transparent',
                    color: active ? 'var(--tx)' : 'var(--mu)',
                    fontSize: '.75rem', fontFamily: 'var(--font-exo2)',
                    letterSpacing: '.09em', textTransform: 'uppercase',
                    display: 'inline-flex', alignItems: 'center',
                    position: 'relative', bottom: -1,
                    borderRadius: '7px 7px 0 0',
                    transition: 'color .15s',
                  }}
                >
                  {t.label}
                </Link>
              )
            })}
          </div>

          {/* Page content */}
          {children}
        </div>
      </div>
    </>
  )
}
