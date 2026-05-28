import Link from 'next/link'

export function Footer() {
  return (
    <footer style={{
      height: 52,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 9, padding: '0 24px',
      borderTop: '1px solid var(--di)',
      fontSize: 12, color: 'var(--mu2)',
      flexWrap: 'wrap',
    }}>
      <span>© Son Got Samples 2026</span>
      <span style={{ opacity: 0.4 }}>•</span>
      <Link href="/pricing" style={{ color: 'var(--mu2)', transition: '.2s' }}>Privacy Policy</Link>
      <span style={{ opacity: 0.4 }}>•</span>
      <Link href="/pricing" style={{ color: 'var(--mu2)', transition: '.2s' }}>Terms of Service</Link>
    </footer>
  )
}
