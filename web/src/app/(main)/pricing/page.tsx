export const metadata = { title: 'Pricing — Son Got Samples' }

export default function PricingPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 20px' }}>
      <h1 style={{
        fontFamily: 'var(--font-exo2)', fontWeight: 300, fontSize: '1.6rem',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        textAlign: 'center', marginBottom: 8,
      }}>Pricing</h1>
      <p style={{ textAlign: 'center', color: 'var(--mu)', fontSize: '0.88rem', marginBottom: 48 }}>
        Choose your plan
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {[
          {
            name: 'Free',
            price: '$0',
            period: 'forever',
            features: ['Browse limited library', 'Stream previews', 'Download free stems'],
            cta: 'Get Started',
            accent: false,
          },
          {
            name: 'Full Access',
            price: '$19',
            period: '/month',
            features: ['Full stems library', 'Download everything', 'Vault ZIP packs', 'Update delta ZIPs'],
            cta: 'Upgrade Now',
            accent: true,
          },
        ].map((plan) => (
          <div
            key={plan.name}
            className="card"
            style={{
              border: plan.accent ? '1px solid var(--acc)' : '1px solid var(--di)',
              background: plan.accent ? 'rgba(104,120,255,.05)' : 'var(--pb)',
            }}
          >
            <h2 style={{
              fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.9rem',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: plan.accent ? 'var(--acc)' : 'var(--mu)',
              marginBottom: 16,
            }}>
              {plan.name}
            </h2>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontFamily: 'var(--font-exo2)', fontSize: '2.2rem', fontWeight: 300, color: 'var(--tx)' }}>
                {plan.price}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--mu)' }}>{plan.period}</span>
            </div>
            <ul style={{ listStyle: 'none', marginBottom: 24 }}>
              {plan.features.map((f) => (
                <li key={f} style={{ fontSize: '0.84rem', color: 'var(--mu)', padding: '5px 0', borderBottom: '1px solid var(--di)' }}>
                  <span style={{ color: 'var(--acc)', marginRight: 8 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button
              className={plan.accent ? 'btn-acc' : 'btn-ghost'}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
