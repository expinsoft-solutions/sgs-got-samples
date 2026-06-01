import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { extractAudioMeta } from '../lib/audio.js'
import { uploadAudio, masterKey } from '../lib/storage.js'
import { stemStoragePath, stemFileName } from '../lib/stem-path.js'
import { markGenreStale } from './vault.service.js'
import { enqueueZip } from '../workers/zip.worker.js'
import { saveToLocal } from './version-zip.service.js'

const TMP_DIR = process.env.TMP_DIR ?? '/tmp/sgs-uploads'

const VERSION_WORDS = ['remix', 'live', 'demo', 'acoustic', 'instrumental', 'feat', 'ft', 'version', 'edit']

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isVersion(title: string): boolean {
  const lower = title.toLowerCase()
  return VERSION_WORDS.some((w) => lower.includes(w))
}

// Upsert genre by name, return its id
async function resolveGenre(name: string): Promise<string> {
  const slug = name.toLowerCase().replace(/[&]/g, '-and-').replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')
  const genre = await prisma.genre.upsert({
    where: { name },
    create: { name, slug },
    update: {},
    select: { id: true },
  })
  return genre.id
}

export interface StemInput {
  title: string
  artist: string
  stemType: string
  bpm?: number | null
  key?: string | null
  genres: string[]          // array of genre names
  albumName?: string | null
  albumType?: string | null
  releaseDate?: string | null
  coverArtUrl?: string | null
  playlistOrder?: number
  jobId?: string | null
  fileBuffer: Buffer
  originalName: string
}

export async function uploadStem(input: StemInput) {
  if (!input.genres?.length) throw new Error('At least one genre required')

  // Duplicate check against first genre
  if (!isVersion(input.title)) {
    const titleNorm = normalize(input.title)
    const existing = await prisma.stem.findFirst({
      where: {
        artist: input.artist,
        stemType: input.stemType,
        isVisible: true,
        genres: { some: { genre: { name: input.genres[0] } } },
      },
    })
    if (existing && normalize(existing.title) === titleNorm) {
      return { duplicate: true, existingId: existing.id, existing }
    }
  }

  // Save to temp disk
  await mkdir(TMP_DIR, { recursive: true })
  const tmpPath = join(TMP_DIR, `${randomUUID()}.mp3`)
  await writeFile(tmpPath, input.fileBuffer)

  const meta = await extractAudioMeta(tmpPath)
  const bpm = input.bpm ?? meta.bpm
  const musicalKey = input.key ?? meta.key ?? 'C Maj'

  // Ensure UploadJob record exists before creating stem (FK constraint)
  if (input.jobId) {
    await prisma.uploadJob.upsert({
      where: { jobId: input.jobId },
      create: { jobId: input.jobId, status: 'uploading' },
      update: {},
    })
  }

  // Resolve all genre IDs
  const genreIds = await Promise.all(input.genres.map(resolveGenre))

  const stem = await prisma.stem.create({
    data: {
      title: input.title,
      artist: input.artist,
      stemType: input.stemType,
      bpm: bpm ?? 120,
      musicalKey,
      albumName: input.albumName ?? input.title,
      albumType: input.albumType ?? 'single',
      releaseDate: input.releaseDate ? new Date(input.releaseDate) : null,
      coverArtUrl: input.coverArtUrl,
      storagePath: '',
      duration: meta.durationSeconds,
      isVisible: false,
      isPendingPublish: true,
      isLocked: false,
      uploadedFromJobId: input.jobId,
      playlistOrder: input.playlistOrder ?? 0,
      genres: {
        create: genreIds.map((genreId) => ({ genreId })),
      },
    },
  })

  const storagePath = `${stemStoragePath({
    genre: input.genres[0],
    artist: stem.artist,
    albumType: stem.albumType,
    albumName: stem.albumName,
    title: stem.title,
  })}/${stemFileName({ artist: stem.artist, title: stem.title, stemType: stem.stemType, bpm: Number(stem.bpm), musicalKey: stem.musicalKey })}`

  // Upload to R2 (sgs-music)
  await uploadAudio(tmpPath, masterKey(storagePath))

  // Copy to VM local dir for fast zip building (genre-slugified)
  const genreSlug = input.genres[0].toLowerCase().replace(/[&]/g, '-and-').replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')
  const localFileName = storagePath.split('/').pop() ?? `${randomUUID()}.mp3`
  await saveToLocal(tmpPath, genreSlug, localFileName).catch(() => {}) // non-fatal

  await unlink(tmpPath).catch(() => {})

  await prisma.stem.update({
    where: { id: stem.id },
    data: { storagePath },
  })

  return { duplicate: false, stem: { ...stem, storagePath, genres: input.genres } }
}

export async function completeJob(jobId: string) {
  const reviewMode = process.env.REVIEW_MODE === 'true'

  const stems = await prisma.stem.findMany({
    where: { uploadedFromJobId: jobId, isPendingPublish: true },
    include: { genres: { select: { genreId: true } } },
  })

  if (stems.length === 0) return { found: false }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const genreIds: string[] = [...new Set((stems as any[]).flatMap((s: any) => s.genres.map((g: any) => g.genreId as string)))]

  let zipJobsQueued = 0

  if (reviewMode) {
    // Staged for admin review — hidden until approved in /admin/review
    await prisma.stem.updateMany({
      where: { uploadedFromJobId: jobId, isPendingPublish: true },
      data: { isPendingPublish: false, isVisible: false },
    })
  } else {
    // Auto-publish
    await prisma.stem.updateMany({
      where: { uploadedFromJobId: jobId, isPendingPublish: true },
      data: { isPendingPublish: false, isVisible: true, vaultPublishedAt: new Date() },
    })
    for (const genreId of genreIds) {
      await markGenreStale(genreId)
      await enqueueZip(genreId, jobId)
      zipJobsQueued++
    }
  }

  await prisma.uploadJob.updateMany({
    where: { jobId },
    data: { status: 'complete', completedAt: new Date(), stemCount: stems.length },
  })

  return {
    found: true,
    stemCount: stems.length,
    genreCount: genreIds.length,
    zipJobsQueued,
    reviewMode,
  }
}

export async function cancelJob(jobId: string) {
  const stems = await prisma.stem.findMany({
    where: { uploadedFromJobId: jobId, isVisible: false },
  })

  if (stems.length === 0) return { found: false }

  await prisma.stem.deleteMany({ where: { uploadedFromJobId: jobId, isVisible: false } })
  await prisma.uploadJob.updateMany({
    where: { jobId },
    data: { status: 'cancelled', completedAt: new Date() },
  })

  return { found: true, count: stems.length }
}
