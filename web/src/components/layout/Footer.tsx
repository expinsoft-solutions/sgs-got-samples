import Link from 'next/link'

export function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--di)',
      padding: '20px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 12,
    }}>
      <span style={{ fontFamily: 'var(--font-exo2)', fontSize: '0.75rem', color: 'var(--mu2)', letterSpacing: '0.08em' }}>
        © {new Date().getFullYear()} Son Got Samples
      </span>
      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { href: '/library', label: 'Library' },
          { href: '/vault', label: 'Vault' },
          { href: '/pricing', label: 'Pricing' },
          { href: '/about', label: 'About' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              fontFamily: 'var(--font-exo2)', fontSize: '0.75rem',
              letterSpacing: '0.08em', color: 'var(--mu2)',
              textTransform: 'uppercase',
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </footer>
  )
}
