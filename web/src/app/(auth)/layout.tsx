import { SpaceBg } from '@/components/layout/SpaceBg'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SpaceBg />
      <main style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}>
        {children}
      </main>
    </>
  )
}
