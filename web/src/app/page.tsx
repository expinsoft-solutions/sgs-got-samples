import Link from 'next/link'
import { SpaceBg } from '@/components/layout/SpaceBg'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { HomeStats, FeatureCard } from './HomeStats'

export default function HomePage() {
  return (
    <>
      <SpaceBg />
      <Header />
      <main style={{ marginTop: 'var(--hh)', flex: 1 }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 32px' }}>

          {/* ── Hero ── */}
          <div style={{ minHeight: 'calc(30vh - var(--hh))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: '50px 20px 30px', maxWidth: 680 }}>

              {/* Title */}
              <h1 style={{
                fontFamily: 'var(--font-exo2)', fontWeight: 200,
                fontSize: 'clamp(32px,5vw,60px)',
                lineHeight: 1.08, letterSpacing: '-0.01em', margin: '0 0 16px',
              }}>
                Access <em style={{ color: 'var(--acc)', fontStyle: 'normal', fontWeight: 300 }}>20,000+</em> Stems Instantly
              </h1>

              {/* Subtitle */}
              <p style={{
                fontSize: 15, color: '#c8d2ea', maxWidth: 430,
                margin: '0 auto 28px', lineHeight: 1.65, fontWeight: 300,
              }}>
                Browse stems by genre, BPM, key, and stem type. Built for producers, DJs, and creatives.
              </p>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
                <Link href="/library" style={{
                  position: 'relative', overflow: 'hidden',
                  height: 46, padding: '0 30px', borderRadius: 9, fontSize: 14, fontWeight: 600,
                  background: 'linear-gradient(135deg,var(--acc),#4a5ee8)',
                  border: '1px solid rgba(130,148,255,.5)', color: '#fff',
                  boxShadow: '0 0 12px rgba(96,116,255,.18)',
                  display: 'inline-flex', alignItems: 'center',
                  transition: 'transform .15s',
                }}>
                  Start Free
                </Link>
                <Link href="/pricing" style={{
                  height: 46, padding: '0 30px', borderRadius: 9,
                  fontSize: 14, fontWeight: 500,
                  background: 'rgba(255,255,255,.04)', border: '1px solid var(--me)', color: 'var(--tx)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform .15s',
                }}>
                  Full Access
                </Link>
              </div>

              {/* Stats bar */}
              <HomeStats />
            </div>
          </div>

          {/* ── What's Inside ── */}
          <div style={{ padding: '1px 0', borderTop: '1px solid var(--di)' }}>
            <div style={{ textAlign: 'center', padding: '10px 0 24px' }}>
              <h2 style={{
                fontFamily: 'var(--font-exo2)', fontWeight: 300,
                fontSize: 'clamp(16px,2vw,21px)', textTransform: 'uppercase',
                letterSpacing: '0.08em', margin: '0 0 7px',
              }}>
                What&apos;s Inside
              </h2>
              <p style={{ fontSize: 13.5, color: '#c8d2ea', maxWidth: 400, margin: '0 auto' }}>
                Organized, labeled, and instantly searchable for music creators.
              </p>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
              gap: 13, marginBottom: 48,
            }}>
              {[
                { icon: '◈', title: '5 Stem Types', desc: 'Acapellas, drums, bass, melody, and instrumentals — labeled for fast discovery.' },
                { icon: '◉', title: 'BPM & Key Search', desc: 'Filter the entire library by tempo, musical key, genre, or stem type in seconds.' },
                { icon: '▷', title: 'Preview Before Download', desc: "Listen in-browser before committing. Know exactly what you're getting." },
                { icon: '⬡', title: '8+ Genres', desc: 'Hip-hop, R&B, house, trap, lo-fi, soul, afrobeats, and more.' },
                { icon: '⊕', title: 'Built for Producers', desc: 'For beatmakers, DJs, editors, and samplers who need clean, usable stems.' },
                { icon: '◎', title: 'One-Time Payment', desc: 'No subscriptions. Pay once, access the library permanently on your terms.' },
              ].map((card) => (
                <FeatureCard key={card.title} icon={card.icon} title={card.title} desc={card.desc} />
              ))}
            </div>
          </div>

        </div>
      </main>
      <Footer />

      <style>{`
        @keyframes hePulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @media(max-width:768px) {
          .feat-grid-wrap { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
