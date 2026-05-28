import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getZipUrl } from '../lib/storage.js'

export async function vaultRoutes(app: FastifyInstance) {
  // GET /api/vault/genres
  app.get('/vault/genres', async (_req, reply) => {
    const statuses = await prisma.vaultZipStatus.findMany({
      orderBy: { genre: { name: 'asc' } },
      include: { genre: { select: { name: true, slug: true, description: true, tags: true } } },
    })

    const genres = statuses.map((s) => ({
      genreId: s.genreId,
      genre: s.genre.name,
      slug: s.genre.slug,
      status: s.status,
      stemCount: s.stemCount,
      fileSizeBytes: s.fileSizeBytes?.toString(),
      builtAt: s.builtAt,
      description: s.genre.description ?? null,
      tags: s.genre.tags ?? [],
    }))

    return reply.send({ genres })
  })

  // GET /api/vault/genres/:genre/download  — genre = slug or name
  app.get('/vault/genres/:genre/download', async (req, reply) => {
    const { genre } = req.params as { genre: string }

    const status = await prisma.vaultZipStatus.findFirst({
      where: { genre: { OR: [{ name: genre }, { slug: genre }] } },
    })
    if (!status || !status.r2Key || status.status === 'building') {
      return reply.code(404).send({ error: 'ZIP not available yet' })
    }

    const url = await getZipUrl(status.r2Key, 3600)
    return reply.send({ url, fileSizeBytes: status.fileSizeBytes?.toString(), stemCount: status.stemCount })
  })

  // GET /api/vault/updates
  app.get('/vault/updates', async (req, reply) => {
    const q = req.query as { genreId?: string; limit?: string }
    const updates = await prisma.vaultUpdateZip.findMany({
      where: q.genreId ? { genreId: q.genreId } : undefined,
      orderBy: { builtAt: 'desc' },
      take: parseInt(q.limit ?? '20'),
      include: {
        genre: { select: { name: true } },
        uploadJob: { select: { jobId: true, completedAt: true } },
      },
    })
    return reply.send({ updates })
  })

  // GET /api/vault/updates/:jobId/download
  app.get('/vault/updates/:jobId/download', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const update = await prisma.vaultUpdateZip.findFirst({ where: { jobId } })
    if (!update) return reply.code(404).send({ error: 'Update zip not found' })

    const url = await getZipUrl(update.r2Key, 3600)
    return reply.send({ url, stemCount: update.stemCount, fileSizeBytes: update.fileSizeBytes?.toString() })
  })
}
