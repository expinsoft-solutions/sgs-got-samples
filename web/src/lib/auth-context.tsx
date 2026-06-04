'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7626'

export type Me = { email: string; tier: string; isAdmin: boolean; name?: string | null }

type AuthCtx = {
  me: Me | null
  authLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  me: null,
  authLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setMe(null)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setMe(null); setAuthLoading(false); return }
      try {
        const res = await fetch(`${API}/api/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) setMe(await res.json())
      } catch { /* api not reachable */ }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) { setMe(null); setAuthLoading(false); return }
      try {
        const res = await fetch(`${API}/api/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) setMe(await res.json())

        if (event === 'SIGNED_IN') {
          fetch(`${API}/api/vault/prepare-download`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch(() => {})
        }
      } catch { /* api not reachable */ }
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ me, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
