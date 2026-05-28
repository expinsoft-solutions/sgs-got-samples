// Mirrors Laravel Stem::getStoragePath() and Stem::getFileName()

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9\s\-.]/g, '')
}

function artistLetterCategory(artist: string): string {
  const first = artist.charAt(0).toUpperCase()
  return /[0-9]/.test(first) ? '0-9' : first
}

export function stemStoragePath(stem: {
  genre: string
  artist: string
  albumType: string
  albumName: string | null
  title: string
}): string {
  const genre = stem.genre ?? 'Unknown'
  const category = artistLetterCategory(stem.artist ?? 'Unknown')
  const artist = sanitize(stem.artist ?? 'Unknown Artist')
  const albumTypeFolder = stem.albumType === 'album' ? 'Albums' : 'Singles'
  const songFolder = sanitize(
    stem.albumType === 'album' ? (stem.albumName ?? stem.title) : stem.title
  )
  return `${genre}/${category}/${artist}/${albumTypeFolder}/${songFolder}/stems`
}

export function stemFileName(stem: {
  artist: string
  title: string
  stemType: string
  bpm: number | null
  musicalKey: string | null
}): string {
  const artist = sanitize(stem.artist ?? 'Unknown Artist')
  const title = sanitize(stem.title ?? 'Unknown')
  const bpm = stem.bpm ?? 0
  const key = stem.musicalKey ?? ''
  const raw = `${artist} - ${title} ${stem.stemType} [BPM ${bpm} ${key}].mp3`
  return raw.replace(/\s+/g, ' ').trim()
}

export function fullStemPath(stem: Parameters<typeof stemStoragePath>[0] & Parameters<typeof stemFileName>[0]): string {
  return `${stemStoragePath(stem)}/${stemFileName(stem)}`
}
