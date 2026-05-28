import { SpaceBg } from '@/components/layout/SpaceBg'
import Link from 'next/link'

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/stems', label: 'Stems' },
  { href: '/admin/upload', label: 'Upload' },
  { href: '/admin/review', label: 'Review' },
  { href: '/admin/vault', label: 'Vault Ops' },
  { href: '/admin/customers', label: 'Customers' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SpaceBg />
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside style={{
          width: 220, flexShrink: 0,
          background: 'rgba(0,5,18,.97)', borderRight: '1px solid var(--di)',
          padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <Link href="/" style={{
            fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.8rem',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--acc)', padding: '0 20px', marginBottom: 20, display: 'block',
          }}>
            ← SGS Admin
          </Link>
          {ADMIN_NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                fontFamily: 'var(--font-exo2)', fontSize: '0.82rem',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--mu)', padding: '10px 20px',
                transition: 'color 0.1s, background 0.1s',
              }}
            >
              {n.label}
            </Link>
          ))}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, padding: '32px 28px', minWidth: 0, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </>
  )
}
