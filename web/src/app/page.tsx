import Link from 'next/link'
import { SpaceBg } from '@/components/layout/SpaceBg'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export default function HomePage() {
  return (
    <>
      <SpaceBg />
      <Header />
      <main style={{ marginTop: 'var(--hh)', flex: 1 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '80px 32px 60px' }}>
          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h1 style={{
              fontFamily: 'var(--font-exo2)', fontWeight: 200,
              fontSize: 'clamp(2.2rem, 6vw, 4rem)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--tx)', lineHeight: 1.15, marginBottom: 20,
            }}>
              Son Got Samples
            </h1>
            <p style={{
              fontFamily: 'var(--font-poppins)', fontWeight: 300, fontSize: '1.1rem',
              color: 'var(--mu)', maxWidth: 480, margin: '0 auto 36px', lineHeight: 1.7,
            }}>
              Premium stems and samples. Acapellas, drums, bass, melody, instrumentals — ready for your project.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/library" className="btn-acc">Browse Library</Link>
              <Link href="/vault" className="btn-ghost">Download Packs</Link>
            </div>
          </div>

          {/* Feature cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}>
            {[
              { icon: '♪', title: 'Stems Library', desc: 'Search and stream individual stems by BPM, key, genre, and type.' },
              { icon: '⬇', title: 'Vault Packs', desc: 'Download entire genre packs as ZIP files, rebuilt with every update.' },
              { icon: '↺', title: 'Always Fresh', desc: 'New stems added regularly. Download only what changed since your last pack.' },
            ].map((f) => (
              <div key={f.title} className="card">
                <div style={{
                  fontFamily: 'var(--font-share-tech-mono)', fontSize: '1.4rem',
                  color: 'var(--acc)', marginBottom: 12,
                }}>{f.icon}</div>
                <h3 style={{
                  fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.9rem',
                  letterSpacing: '0.09em', textTransform: 'uppercase',
                  color: 'var(--tx)', marginBottom: 8,
                }}>{f.title}</h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--mu)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
