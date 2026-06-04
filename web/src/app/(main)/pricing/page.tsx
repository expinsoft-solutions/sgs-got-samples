'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function PricingPage() {
  const router = useRouter()
  const { me } = useAuth()
  const hasFull = me?.tier === 'paid' || me?.tier === 'admin'

  const dot = (
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acc)', opacity: 0.6, flexShrink: 0, display: 'inline-block' }} />
  )

  function li(text: string) {
    return (
      <li style={{ fontSize: 12, color: 'var(--mu)', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {dot}{text}
      </li>
    )
  }

  return (
    <>
      <style>{`
        @keyframes pmspin{to{transform:rotate(360deg)}}
        .price-card{background:linear-gradient(180deg,var(--pb),var(--pb2));border:1px solid rgba(96,116,255,.08);border-radius:14px;padding:26px 20px 22px;display:flex;flex-direction:column;position:relative;overflow:hidden;transition:all .3s ease;}
        .price-card.feat{background:linear-gradient(180deg,rgba(96,116,255,.07),rgba(96,116,255,.025));border:1px solid rgba(96,116,255,.15);}
        .price-card:hover{transform:translateY(-4px);border-color:rgba(96,116,255,.5)!important;box-shadow:0 8px 30px rgba(96,116,255,.15);}
        .price-card.feat:hover{border-color:rgba(96,116,255,.6)!important;box-shadow:0 8px 35px rgba(96,116,255,.2);}
        .price-btn{width:100%;height:40px;border-radius:9px;font-size:13px;font-weight:600;border:1px solid rgba(96,116,255,.2);background:rgba(96,116,255,.08);color:var(--tx);cursor:pointer;transition:all .3s ease;font-family:inherit;}
        .price-btn:hover{background:rgba(96,116,255,.2)!important;border-color:rgba(96,116,255,.5)!important;transform:translateY(-2px);box-shadow:0 4px 15px rgba(96,116,255,.2);}
        .price-card.feat .price-btn{background:var(--acc);border:1px solid var(--acc);color:#fff;}
        .price-card.feat .price-btn:hover{background:#7083ff!important;border-color:#7083ff!important;}
        @media(max-width:640px){.pricing-grid{grid-template-columns:1fr!important;max-width:400px;margin-left:auto;margin-right:auto;}}
        @media(max-width:768px){.pw{padding:0 16px 40px!important;}.phero{padding:16px 16px 14px!important;}}
      `}</style>

      <div className="pw" style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px 60px' }}>

        {/* Hero */}
        <div className="phero" style={{ textAlign: 'center', padding: '24px 20px 20px' }}>
          <div style={{
            display: 'inline-block', fontFamily: 'var(--font-exo2)', fontSize: '.65rem',
            letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--acc)',
            border: '1px solid rgba(96,116,255,.22)', borderRadius: 20,
            padding: '5px 16px', background: 'rgba(96,116,255,.07)', marginBottom: 14,
          }}>
            Choose Your Access
          </div>
          <h1 style={{
            fontFamily: 'var(--font-exo2)', fontWeight: 200,
            fontSize: 'clamp(22px,3vw,36px)', letterSpacing: '.02em', margin: '0 0 6px', color: 'var(--tx)',
          }}>
            One-Time Access. No Subscriptions.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mu)', maxWidth: 400, margin: '0 auto', fontWeight: 300 }}>
            Pay once, no renewals. Get into the library your way.
          </p>
        </div>

        {/* Already owned banner */}
        {hasFull && (
          <div style={{
            maxWidth: 720, margin: '0 auto 20px', padding: '12px 18px',
            background: 'rgba(76,175,130,.08)', border: '1px solid rgba(76,175,130,.25)',
            borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <span style={{ fontSize: 13, color: '#4caf82', fontWeight: 500 }}>
              You already have Full Access — enjoy the complete library!
            </span>
            <Link href="/library" style={{
              marginLeft: 'auto', fontSize: 12, color: '#4caf82',
              borderBottom: '1px solid rgba(76,175,130,.4)', whiteSpace: 'nowrap',
            }}>
              Go to Library →
            </Link>
          </div>
        )}

        {/* Cards */}
        <div className="pricing-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16,
          marginBottom: 24, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto',
          alignItems: 'stretch',
        }}>

          {/* Free */}
          <div className="price-card">
            <div style={{ fontFamily: 'var(--font-exo2)', fontSize: '.6rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--acc)', marginBottom: 7 }}>FREE ACCESS</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, margin: '6px 0 2px', color: 'var(--tx)', letterSpacing: '-.02em' }}>
              $0 <sub style={{ fontSize: '.85rem', fontWeight: 400, color: 'var(--mu)', letterSpacing: 0 }}>/ forever</sub>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--mu)', lineHeight: 1.6, margin: '6px 0 10px' }}>
              Explore a curated selection with no commitment required.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
              {li('Limited stem library preview')}
              {li('Browse selected free stems')}
              {li('Filter by genre, BPM, key & stem type')}
              {li('Stream and preview available stems')}
            </ul>
            <div style={{ flex: 1 }} />
            <Link href="/library" className="price-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Explore Free Access
            </Link>
          </div>

          {/* Full */}
          <div className="price-card feat">
            {/* Best Value ribbon */}
            <div style={{
              position: 'absolute', top: 14, right: -26,
              background: 'var(--acc)', color: '#fff',
              fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
              padding: '4px 30px', transform: 'rotate(45deg)', fontWeight: 700,
            }}>
              Best Value
            </div>

            <div style={{ fontFamily: 'var(--font-exo2)', fontSize: '.6rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--acc)', marginBottom: 7 }}>FULL ACCESS</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, margin: '6px 0 2px', color: 'var(--tx)', letterSpacing: '-.02em' }}>
              $35 <sub style={{ fontSize: '.85rem', fontWeight: 400, color: 'var(--mu)', letterSpacing: 0 }}>/ one-time</sub>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--mu)', lineHeight: 1.6, margin: '6px 0 10px', flex: 1 }}>
              Web access plus the complete library. Own 20,000+ stems permanently.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
              {li('Full library access')}
              {li('Unlimited browsing across all stems')}
              {li('Full stem downloads')}
              {li('Vault access')}
              {li('Bulk download packs')}
              {li('Lifetime access')}
              {li('Future library updates included')}
              {li('One-time payment — no subscription')}
            </ul>
            {hasFull ? (
              <div style={{
                width: '100%', height: 40, borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: 'rgba(76,175,130,.12)', border: '1px solid rgba(76,175,130,.35)',
                color: '#4caf82', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                ✓ Active
              </div>
            ) : (
              <button
                className="price-btn"
                onClick={() => router.push('/register?plan=full')}
              >
                Get Full Access
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
