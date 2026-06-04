'use client'

import { useAuth } from '@/lib/auth-context'

function LoadingGate({ children }: { children: React.ReactNode }) {
  const { authLoading } = useAuth()

  if (authLoading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgb(0,5,18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <span style={{
            fontFamily: 'var(--font-exo2)', fontWeight: 400, fontSize: '0.88rem',
            letterSpacing: '0.11em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
          }}>
            Son Got Samples
          </span>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2px solid rgba(104,120,255,0.2)',
            borderTopColor: 'var(--acc)',
            animation: 'spin 0.75s linear infinite',
          }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return <>{children}</>
}

export function MainLayoutClient({ children }: { children: React.ReactNode }) {
  return <LoadingGate>{children}</LoadingGate>
}
