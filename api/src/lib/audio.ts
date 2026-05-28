import { parseFile } from 'music-metadata'

export interface AudioMeta {
  durationSeconds: number
  bpm: number | null
  key: string | null
}

export async function extractAudioMeta(filePath: string): Promise<AudioMeta> {
  try {
    const meta = await parseFile(filePath, { duration: true })
    const duration = Math.round(meta.format.duration ?? 180)

    const bpmRaw = meta.common.bpm
    const bpm = bpmRaw && bpmRaw >= 40 && bpmRaw <= 220 ? Math.round(bpmRaw * 10) / 10 : null

    const keyRaw = meta.common.key
    const key = keyRaw ? formatKey(keyRaw) : null

    return { durationSeconds: duration, bpm, key }
  } catch {
    return { durationSeconds: 180, bpm: null, key: null }
  }
}

function formatKey(raw: string): string {
  const k = raw.trim().toUpperCase().replace(/^KEY[_ ]?/, '')
  const map: Record<string, string> = {
    'C': 'C Maj', 'CM': 'C Maj', 'C#': 'C# Maj', 'DB': 'Db Maj',
    'D': 'D Maj', 'DM': 'D Maj', 'D#': 'D# Maj', 'EB': 'Eb Maj',
    'E': 'E Maj', 'EM': 'E Maj', 'F': 'F Maj', 'FM': 'F Maj',
    'F#': 'F# Maj', 'GB': 'Gb Maj', 'G': 'G Maj', 'GM': 'G Maj',
    'G#': 'G# Maj', 'AB': 'Ab Maj', 'A': 'A Maj', 'AM': 'A Maj',
    'A#': 'A# Maj', 'BB': 'Bb Maj', 'B': 'B Maj', 'BM': 'B Maj',
    'CM': 'C Min', 'C#M': 'C# Min', 'DM': 'D Min', 'D#M': 'D# Min',
    'EM': 'E Min', 'FM': 'F Min', 'F#M': 'F# Min', 'GM': 'G Min',
    'G#M': 'G# Min', 'AM': 'A Min', 'A#M': 'A# Min', 'BM': 'B Min',
  }
  return map[k] ?? raw
}
