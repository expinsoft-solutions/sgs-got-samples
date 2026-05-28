import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getAudioUrl, masterKey, previewKey } from '../lib/storage.js'

export async function stemRoutes(app: FastifyInstance) {
  // GET /api/stems
  app.get('/stems', async (req, reply) => {
    const q = req.query as Record<string, string>
    const page = Math.max(1, parseInt(q.page ?? '1'))
    const limit = Math.min(100, parseInt(q.limit ?? '50'))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { isVisible: true, pendingDelete: false }

    if (q.genre) where.genre = q.genre
    if (q.stem_type) where.stemType = q.stem_type
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { artist: { contains: q.search, mode: 'insensitive' } },
        { genre: { contains: q.search, mode: 'insensitive' } },
      ]
    }
    if (q.bpm_min || q.bpm_max) {
      where.bpm = {
        ...(q.bpm_min ? { gte: parseFloat(q.bpm_min) } : {}),
        ...(q.bpm_max ? { lte: parseFloat(q.bpm_max) } : {}),
      }
    }
    if (q.key) where.musicalKey = { contains: q.key, mode: 'insensitive' }

    const orderByMap: Record<string, unknown> = {
      recent: { createdAt: 'desc' },
      genre: { genre: 'asc' },
      key: { musicalKey: 'asc' },
      bpmAsc: { bpm: 'asc' },
      bpmDesc: { bpm: 'desc' },
      title: { title: 'asc' },
    }
    const orderBy = orderByMap[q.sort ?? 'recent'] ?? { createdAt: 'desc' }

    const [stems, total] = await Promise.all([
      prisma.stem.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true, title: true, artist: true, stemType: true,
          bpm: true, musicalKey: true, genre: true, specificGenre: true,
          albumName: true, duration: true, coverArtUrl: true,
          isLocked: true, isFree: true, createdAt: true,
        },
      }),
      prisma.stem.count({ where }),
    ])

    return reply.send({
      stems,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  })

  // GET /api/stems/filter-options
  app.get('/stems/filter-options', async (_req, reply) => {
    const [genres, keys] = await Promise.all([
      prisma.stem.findMany({
        where: { isVisible: true },
        select: { genre: true },
        distinct: ['genre'],
        orderBy: { genre: 'asc' },
      }),
      prisma.stem.findMany({
        where: { isVisible: true, musicalKey: { not: null } },
        select: { musicalKey: true },
        distinct: ['musicalKey'],
        orderBy: { musicalKey: 'asc' },
      }),
    ])

    return reply.send({
      genres: genres.map((g) => g.genre).filter(Boolean),
      keys: keys.map((k) => k.musicalKey).filter(Boolean),
      stemTypes: ['Acapella', 'Drums', 'Bass', 'Melody', 'Instrumental'],
      bpmRanges: [
        { label: 'Under 70', min: 0, max: 69 },
        { label: '70 – 79', min: 70, max: 79 },
        { label: '80 – 89', min: 80, max: 89 },
        { label: '90 – 99', min: 90, max: 99 },
        { label: '100 – 109', min: 100, max: 109 },
        { label: '110 – 119', min: 110, max: 119 },
        { label: '120+', min: 120, max: 999 },
      ],
    })
  })

  // GET /api/stems/:id
  app.get('/stems/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const stem = await prisma.stem.findFirst({
      where: { id, isVisible: true, pendingDelete: false },
      select: {
        id: true, title: true, artist: true, stemType: true,
        bpm: true, musicalKey: true, genre: true, specificGenre: true,
        albumName: true, albumType: true, duration: true, coverArtUrl: true,
        isLocked: true, isFree: true, releaseDate: true, createdAt: true,
      },
    })
    if (!stem) return reply.code(404).send({ error: 'Not found' })
    return reply.send(stem)
  })

  // GET /api/stems/:id/preview  — short presigned URL
  app.get('/stems/:id/preview', async (req, reply) => {
    const { id } = req.params as { id: string }
    const stem = await prisma.stem.findFirst({
      where: { id, isVisible: true },
      select: { previewPath: true, storagePath: true },
    })
    if (!stem) return reply.code(404).send({ error: 'Not found' })

    const key = stem.previewPath
      ? previewKey(stem.id)
      : masterKey(stem.storagePath)

    const url = await getAudioUrl(key, 900)
    return reply.send({ url })
  })

  // GET /api/stems/:id/download  — full file presigned URL (auth + lock check)
  app.get('/stems/:id/download', async (req, reply) => {
    const { id } = req.params as { id: string }
    const stem = await prisma.stem.findFirst({
      where: { id, isVisible: true, pendingDelete: false },
      select: { id: true, storagePath: true, isLocked: true, isFree: true },
    })
    if (!stem) return reply.code(404).send({ error: 'Not found' })

    // TODO: auth check from Supabase JWT — for now allow all
    if (stem.isLocked) {
      return reply.code(403).send({ error: 'locked', message: 'Upgrade to access this stem' })
    }

    const url = await getAudioUrl(masterKey(stem.storagePath), 900)
    return reply.send({ url })
  })
}
