const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json() as T
}

export type Stem = {
  id: string
  title: string
  artist: string
  stemType: string
  bpm: number | null
  musicalKey: string | null
  genre: string
  albumName: string | null
  duration: number | null
  coverArtUrl: string | null
  isLocked: boolean
  isFree: boolean
  createdAt: string
}

export type StemsResponse = {
  stems: Stem[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export type FilterOptions = {
  genres: string[]
  keys: string[]
  stemTypes: string[]
  bpmRanges: { label: string; min: number; max: number }[]
}

export type VaultGenre = {
  genre: string
  status: 'building' | 'stale' | 'ready' | 'failed'
  stemCount: number
  fileSizeBytes: string | null
  builtAt: string | null
  description: string | null
  tags: string[]
}

export const api = {
  stems: {
    list: (params: Record<string, string>) => {
      const qs = new URLSearchParams(params).toString()
      return req<StemsResponse>(`/api/stems?${qs}`)
    },
    get: (id: string) => req<Stem>(`/api/stems/${id}`),
    preview: (id: string) => req<{ url: string }>(`/api/stems/${id}/preview`),
    download: (id: string) => req<{ url: string }>(`/api/stems/${id}/download`),
    filterOptions: () => req<FilterOptions>('/api/stems/filter-options'),
  },
  vault: {
    genres: () => req<{ genres: VaultGenre[] }>('/api/vault/genres'),
    download: (genre: string) => req<{ url: string; stemCount: number }>(`/api/vault/genres/${genre}/download`),
    updates: (genre?: string) =>
      req<{ updates: unknown[] }>(`/api/vault/updates${genre ? `?genre=${genre}` : ''}`),
  },
}
