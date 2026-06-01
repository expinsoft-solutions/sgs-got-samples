// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — music-metadata types differ between ESM/CJS builds
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

const KEY_MAP: Record<string, string> = {
  'C': 'C Maj', 'CM': 'C Maj', 'C#': 'C# Maj', 'DB': 'Db Maj',
  'D': 'D Maj', 'DM': 'D Maj', 'D#': 'D# Maj', 'EB': 'Eb Maj',
  'E': 'E Maj', 'EM': 'E Maj', 'F': 'F Maj', 'FM': 'F Maj',
  'F#': 'F# Maj', 'GB': 'Gb Maj', 'G': 'G Maj', 'GM': 'G Maj',
  'G#': 'G# Maj', 'AB': 'Ab Maj', 'A': 'A Maj', 'AM': 'A Maj',
  'A#': 'A# Maj', 'BB': 'Bb Maj', 'B': 'B Maj', 'BM': 'B Maj',
  'CM_MINOR': 'C Min', 'C#M': 'C# Min', 'DM_MINOR': 'D Min', 'D#M': 'D# Min',
  'EM_MINOR': 'E Min', 'FM_MINOR': 'F Min', 'F#M': 'F# Min', 'GM_MINOR': 'G Min',
  'G#M': 'G# Min', 'AM_MINOR': 'A Min', 'A#M': 'A# Min', 'BM_MINOR': 'B Min',
}

function formatKey(raw: string): string {
  const k = raw.trim().toUpperCase().replace(/^KEY[_ ]?/, '')
  return KEY_MAP[k] ?? raw
}
