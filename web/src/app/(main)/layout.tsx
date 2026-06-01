import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SpaceBg } from '@/components/layout/SpaceBg'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SpaceBg />
      <Header />
      <main style={{ marginTop: 'var(--hh)', flex: 1 }}>
        {children}
      </main>
      <Footer />
    </>
  )
}
