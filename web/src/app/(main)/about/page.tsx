import Link from 'next/link'

export const metadata = { title: 'About — Son Got Samples' }

const HR = () => <div style={{ height: 1, background: 'var(--di)', margin: '0 0 38px' }} />

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1rem',
  textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 10px', color: 'var(--acc)',
}

const pStyle: React.CSSProperties = {
  color: 'var(--mu)', fontSize: 14, lineHeight: 1.75, margin: 0,
}

export default function AboutPage() {
  return (
    <>
      <style>{`
        .aitem{transition:transform .2s,border-color .2s;}
        .aitem:hover{transform:translateY(-2px);border-color:rgba(96,116,255,.3)!important;}
        @media(max-width:768px){
          .aw{padding:40px 16px 60px!important;}
          .about-grid{grid-template-columns:1fr!important;gap:12px!important;}
          .aitem{padding:12px!important;}
        }
        @media(max-width:480px){.aw{padding:30px 12px 50px!important;}}
      `}</style>

      <div className="aw" style={{ maxWidth: 800, margin: '0 auto', padding: '62px 24px 82px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 50 }}>
          <h1 style={{
            fontFamily: 'var(--font-exo2)', fontWeight: 200,
            fontSize: 'clamp(26px,4.5vw,44px)', textTransform: 'uppercase',
            letterSpacing: '.04em', margin: '0 0 12px',
          }}>
            About Son Got Samples
          </h1>
          <p style={{ color: 'var(--mu)', fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: '0 auto', fontWeight: 300 }}>
            A premium stem library for music creators. Organized. Searchable. Built to move fast.
          </p>
        </div>

        <HR />

        {/* What We Are */}
        <div style={{ marginBottom: 38 }}>
          <h2 style={h2Style}>What We Are</h2>
          <p style={{ ...pStyle, marginBottom: 9 }}>
            Son Got Samples is a curated stem library giving producers, DJs, editors, and samplers direct access to thousands of organized, searchable stems. No complicated workflows. Browse, preview, and download.
          </p>
          <p style={pStyle}>
            Acapella for a remix, a drum loop for a beat, or a full instrumental to chop. It&apos;s here, labeled and ready.
          </p>
        </div>

        <HR />

        {/* What You Can Access */}
        <div style={{ marginBottom: 38 }}>
          <h2 style={h2Style}>What You Can Access</h2>
          <div className="about-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            {[
              { title: 'Acapellas', desc: 'Isolated vocal stems spanning hip-hop, R&B, soul, pop, and beyond.' },
              { title: 'Drums', desc: 'Clean drum stems, trap rolls, house kicks, live feel across all genres.' },
              { title: 'Bass', desc: 'Isolated bass lines ready for sampling, layering, or direct use.' },
              { title: 'Melody & Instrumentals', desc: 'Chord progressions, synth leads, piano, guitar, plus full instrumentals.' },
            ].map((item) => (
              <div
                key={item.title}
                className="aitem"
                style={{ background: 'var(--pb)', border: '1px solid var(--di)', borderRadius: 10, padding: 15 }}
              >
                <h4 style={{
                  fontFamily: 'var(--font-exo2)', fontSize: '.74rem',
                  textTransform: 'uppercase', letterSpacing: '.09em',
                  margin: '0 0 6px', color: 'var(--tx)',
                }}>
                  {item.title}
                </h4>
                <p style={{ fontSize: 12.5, color: 'var(--mu)', margin: 0, lineHeight: 1.58 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <HR />

        {/* How It's Organized */}
        <div style={{ marginBottom: 38 }}>
          <h2 style={h2Style}>How It&apos;s Organized</h2>
          <p style={pStyle}>
            Every stem is tagged and searchable by genre, BPM, key, and type. Filter in seconds, preview inline, download without friction. Organized the way producers actually search — by function, not release.
          </p>
        </div>

        <HR />

        {/* Access & Ownership */}
        <div style={{ marginBottom: 38 }}>
          <h2 style={h2Style}>Access &amp; Ownership</h2>
          <p style={{ ...pStyle, marginBottom: 20 }}>
            All tiers are one-time purchases, no subscriptions. The Full Download Package delivers the complete library permanently. Pay once and own 20,000+ stems outright.
          </p>
          <Link href="/library" style={{
            display: 'inline-flex', alignItems: 'center',
            height: 42, padding: '0 24px', borderRadius: 9,
            background: 'linear-gradient(135deg,var(--acc),#4a5ee8)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            transition: 'all .15s',
          }}>
            Browse the Library
          </Link>
        </div>

      </div>
    </>
  )
}
