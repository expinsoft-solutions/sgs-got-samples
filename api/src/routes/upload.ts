import type { FastifyInstance } from 'fastify'
import { uploadStem, completeJob, cancelJob } from '../services/upload.service.js'
import { prisma } from '../lib/prisma.js'
import { getBoss } from '../lib/boss.js'
import { ZIP_QUEUE } from '../lib/boss.js'

const STEM_TYPES = ['Acapella', 'Drums', 'Bass', 'Melody', 'Instrumental'] as const

function parseGenres(raw: string): string[] {
  // Accepts: "Hip-Hop" | "Hip-Hop,R&B" | '["Hip-Hop","R&B"]'
  if (!raw) return []
  try { return JSON.parse(raw) } catch { /* not JSON */ }
  return raw.split(',').map((g) => g.trim()).filter(Boolean)
}

export async function uploadRoutes(app: FastifyInstance) {
  // POST /api/upload/single
  app.post('/upload/single', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ success: false, message: 'No file provided' })

    const fields = data.fields as Record<string, { value: string }>
    const get = (k: string) => fields[k]?.value ?? ''

    const title = get('title')
    const artist = get('artist')
    const stemType = get('stem_type')
    const genres = parseGenres(get('genres') || get('genre'))

    if (!title || !artist || !genres.length) {
      return reply.code(400).send({ success: false, message: 'title, artist, genres required' })
    }
    if (stemType && !STEM_TYPES.includes(stemType as typeof STEM_TYPES[number])) {
      return reply.code(400).send({ success: false, message: `stem_type must be one of: ${STEM_TYPES.join(', ')}` })
    }

    const fileBuffer = await data.toBuffer()

    const result = await uploadStem({
      title,
      artist,
      stemType: stemType || 'Instrumental',
      bpm: get('bpm') ? parseFloat(get('bpm')) : null,
      key: get('key') || null,
      genres,
      albumName: get('album_name') || null,
      albumType: get('album_type') || 'single',
      releaseDate: get('release_date') || null,
      coverArtUrl: get('cover_art_url') || null,
      playlistOrder: get('playlist_order') ? parseInt(get('playlist_order')) : 0,
      jobId: get('job_id') || null,
      fileBuffer,
      originalName: data.filename,
    })

    if (result.duplicate) {
      return reply.code(409).send({
        success: false,
        error: 'duplicate',
        message: `Duplicate: ${result.existing!.artist} - ${result.existing!.title} (${result.existing!.stemType}) already exists.`,
        existingId: result.existingId,
      })
    }

    return reply.code(201).send({ success: true, message: 'Stem uploaded', stem: result.stem })
  })

  // POST /api/upload/bulk
  app.post('/upload/bulk', async (req, reply) => {
    const parts = req.files()
    const uploaded: unknown[] = []
    const skipped: unknown[] = []
    const jobId = (req.body as Record<string, string>)?.job_id ?? null

    for await (const part of parts) {
      if (part.type !== 'file') continue

      const fields = part.fields as Record<string, { value: string }>
      const get = (k: string) => fields[k]?.value ?? ''
      const genres = parseGenres(get('genres') || get('genre'))
      const fileBuffer = await part.toBuffer()

      const result = await uploadStem({
        title: get('title'),
        artist: get('artist'),
        stemType: get('stem_type') || 'Instrumental',
        bpm: get('bpm') ? parseFloat(get('bpm')) : null,
        key: get('key') || null,
        genres,
        albumName: get('album_name') || null,
        albumType: get('album_type') || 'single',
        releaseDate: get('release_date') || null,
        coverArtUrl: get('cover_art_url') || null,
        playlistOrder: get('playlist_order') ? parseInt(get('playlist_order')) : 0,
        jobId,
        fileBuffer,
        originalName: part.filename,
      })

      if (result.duplicate) {
        skipped.push({ title: get('title'), existingId: result.existingId, reason: 'duplicate' })
      } else {
        uploaded.push(result.stem)
      }
    }

    return reply.code(201).send({
      success: true,
      message: `${uploaded.length} stems uploaded`,
      uploaded,
      skipped,
    })
  })

  // POST /api/vault/jobs/:jobId/complete
  // Client sends total_queued so we can report queue depth
  app.post('/vault/jobs/:jobId/complete', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const body = req.body as { total_queued?: number } | null
    const totalQueued = body?.total_queued ?? 0

    // Update job with total count client reported
    await prisma.uploadJob.updateMany({
      where: { jobId },
      data: { totalQueued },
    })

    const result = await completeJob(jobId)
    if (!result.found) return reply.code(404).send({ success: false, message: 'No staged stems for this job' })

    // Report zip queue depth
    const boss = await getBoss()
    const queueStats = await boss.getQueueStats(ZIP_QUEUE).catch(() => null)
    const queueSize = (queueStats as Record<string, number> | null)?.createdOn ?? null

    return reply.send({
      success: true,
      ...result,
      queue: {
        depth: queueSize,
        zipJobsJustQueued: result.zipJobsQueued,
      },
    })
  })

  // POST /api/vault/jobs/:jobId/cancel
  app.post('/vault/jobs/:jobId/cancel', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const result = await cancelJob(jobId)
    if (!result.found) return reply.code(404).send({ success: false, message: 'No staged stems for this job' })
    return reply.send({ success: true, ...result })
  })
}
