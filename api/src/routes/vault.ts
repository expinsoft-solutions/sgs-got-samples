import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getZipUrl } from '../lib/storage.js'

export async function vaultRoutes(app: FastifyInstance) {
  // GET /api/vault/genres  — public genre stats + zip statuses
  app.get('/vault/genres', async (_req, reply) => {
    const statuses = await prisma.vaultZipStatus.findMany({
      orderBy: { genre: 'asc' },
    })

    const meta = await prisma.vaultGenreMeta.findMany({
      where: { isHidden: false },
    })
    const metaMap = Object.fromEntries(meta.map((m) => [m.genre, m]))

    const genres = statuses.map((s) => ({
      genre: s.genre,
      status: s.status,
      stemCount: s.stemCount,
      fileSizeBytes: s.fileSizeBytes?.toString(),
      builtAt: s.builtAt,
      description: metaMap[s.genre]?.description ?? null,
      tags: metaMap[s.genre]?.tags ?? [],
    }))

    return reply.send({ genres })
  })

  // GET /api/vault/genres/:genre/download  — presigned URL for genre ZIP
  app.get('/vault/genres/:genre/download', async (req, reply) => {
    const { genre } = req.params as { genre: string }

    const status = await prisma.vaultZipStatus.findUnique({ where: { genre } })
    if (!status || !status.r2Key || status.status === 'building') {
      return reply.code(404).send({ error: 'ZIP not available yet' })
    }

    const url = await getZipUrl(status.r2Key, 3600) // 1h for large downloads
    return reply.send({ url, fileSizeBytes: status.fileSizeBytes?.toString(), stemCount: status.stemCount })
  })

  // GET /api/vault/updates  — list delta zips (all or by genre)
  app.get('/vault/updates', async (req, reply) => {
    const q = req.query as { genre?: string; limit?: string }
    const updates = await prisma.vaultUpdateZip.findMany({
      where: q.genre ? { genre: q.genre } : undefined,
      orderBy: { builtAt: 'desc' },
      take: parseInt(q.limit ?? '20'),
      include: { uploadJob: { select: { jobId: true, completedAt: true } } },
    })
    return reply.send({ updates })
  })

  // GET /api/vault/updates/:jobId/download  — presigned URL for delta zip
  app.get('/vault/updates/:jobId/download', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const update = await prisma.vaultUpdateZip.findFirst({ where: { jobId } })
    if (!update) return reply.code(404).send({ error: 'Update zip not found' })

    const url = await getZipUrl(update.r2Key, 3600)
    return reply.send({ url, stemCount: update.stemCount, fileSizeBytes: update.fileSizeBytes?.toString() })
  })
}
