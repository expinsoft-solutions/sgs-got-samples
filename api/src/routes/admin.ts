import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { deleteAudio, masterKey } from '../lib/storage.js'
import { shouldRebuildZip, shouldDeleteStem, executeStemDelete, processPendingDeletes, markGenreStale } from '../services/vault.service.js'
import { enqueueZip } from '../workers/zip.worker.js'

export async function adminRoutes(app: FastifyInstance) {
  // ── Stats ─────────────────────────────────────────────────────────────────

  app.get('/admin/stats', async (_req, reply) => {
    const [totalStems, totalUsers, recentUploads] = await Promise.all([
      prisma.stem.count({ where: { isVisible: true } }),
      prisma.user.count(),
      prisma.stem.findMany({
        where: { isVisible: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, artist: true, genre: true, createdAt: true },
      }),
    ])
    return reply.send({ totalStems, totalUsers, recentUploads })
  })

  // ── Stems ─────────────────────────────────────────────────────────────────

  app.get('/admin/stems', async (req, reply) => {
    const q = req.query as Record<string, string>
    const page = Math.max(1, parseInt(q.page ?? '1'))
    const limit = Math.min(200, parseInt(q.limit ?? '50'))

    const where: Record<string, unknown> = {}
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { artist: { contains: q.search, mode: 'insensitive' } },
      ]
    }
    if (q.genre) where.genre = q.genre
    if (q.visible !== undefined) where.isVisible = q.visible === 'true'

    const [stems, total] = await Promise.all([
      prisma.stem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stem.count({ where }),
    ])

    return reply.send({ stems, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  })

  // GET /api/admin/stems/review — pending stems for review board
  app.get('/admin/stems/review', async (req, reply) => {
    const q = req.query as { job_id?: string }
    const where = {
      isPendingPublish: true,
      ...(q.job_id ? { uploadedFromJobId: q.job_id } : {}),
    }
    const stems = await prisma.stem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, artist: true, stemType: true,
        bpm: true, musicalKey: true, duration: true,
        playlistOrder: true, uploadedFromJobId: true, createdAt: true,
        genres: { select: { genre: { select: { id: true, name: true } } } },
      },
    })
    return reply.send({
      stems: stems.map((s) => ({ ...s, genres: s.genres.map((g) => g.genre) })),
    })
  })

  // PUT /api/admin/stems/:id/genres — replace genres for a stem
  app.put('/admin/stems/:id/genres', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { genreIds } = req.body as { genreIds: string[] }
    await prisma.stemGenre.deleteMany({ where: { stemId: id } })
    await prisma.stemGenre.createMany({
      data: genreIds.map((genreId) => ({ stemId: id, genreId })),
    })
    const genres = await prisma.genre.findMany({
      where: { id: { in: genreIds } },
      select: { id: true, name: true },
    })
    return reply.send({ genres })
  })

  // GET /api/admin/genres — all genres for genre picker
  app.get('/admin/genres', async (_req, reply) => {
    const genres = await prisma.genre.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    })
    return reply.send({ genres })
  })

  app.get('/admin/stems/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const stem = await prisma.stem.findUnique({ where: { id } })
    if (!stem) return reply.code(404).send({ error: 'Not found' })
    return reply.send(stem)
  })

  app.put('/admin/stems/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>
    const stem = await prisma.stem.update({ where: { id }, data: body })
    return reply.send(stem)
  })

  app.post('/admin/stems/:id/toggle-visibility', async (req, reply) => {
    const { id } = req.params as { id: string }
    const stem = await prisma.stem.findUnique({ where: { id }, select: { isVisible: true } })
    if (!stem) return reply.code(404).send({ error: 'Not found' })
    const updated = await prisma.stem.update({
      where: { id },
      data: {
        isVisible: !stem.isVisible,
        ...((!stem.isVisible) ? { isPendingPublish: false, vaultPublishedAt: new Date() } : {}),
      },
    })
    return reply.send({ isVisible: updated.isVisible })
  })

  app.post('/admin/stems/bulk-visibility', async (req, reply) => {
    const { ids, visible } = req.body as { ids: string[]; visible: boolean }
    await prisma.stem.updateMany({ where: { id: { in: ids } }, data: { isVisible: visible } })
    return reply.send({ updated: ids.length })
  })

  app.post('/admin/stems/bulk-delete', async (req, reply) => {
    const { ids } = req.body as { ids: string[] }

    const stems = await prisma.stem.findMany({
      where: { id: { in: ids } },
      select: { id: true, storagePath: true, genre: true },
    })

    // Soft delete + queue R2 cleanup
    await prisma.stem.updateMany({
      where: { id: { in: ids } },
      data: { isVisible: false, pendingDelete: true },
    })

    // Queue R2 deletes + zip rebuilds per genre
    const genres = [...new Set(stems.map((s) => s.genre))]
    for (const genre of genres) {
      await markGenreStale(genre)
      await enqueueZip(genre)
    }

    // Fire-and-forget R2 deletes
    for (const stem of stems) {
      deleteAudio(masterKey(stem.storagePath)).catch(() => {})
    }

    await prisma.stem.deleteMany({ where: { id: { in: ids }, pendingDelete: true } })

    return reply.send({ deleted: ids.length })
  })

  // ── Customers ────────────────────────────────────────────────────────────

  app.get('/admin/customers', async (req, reply) => {
    const q = req.query as Record<string, string>
    const page = Math.max(1, parseInt(q.page ?? '1'))
    const limit = Math.min(200, parseInt(q.limit ?? '50'))

    const where: Record<string, unknown> = {}
    if (q.search) {
      where.OR = [
        { email: { contains: q.search, mode: 'insensitive' } },
        { name: { contains: q.search, mode: 'insensitive' } },
      ]
    }
    if (q.tier) where.tier = q.tier

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  })

  app.get('/admin/customers/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await prisma.user.findUnique({
      where: { id },
      include: { purchases: true, _count: { select: { downloads: true } } },
    })
    if (!user) return reply.code(404).send({ error: 'Not found' })
    return reply.send(user)
  })

  app.put('/admin/customers/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>
    const user = await prisma.user.update({ where: { id }, data: body })
    return reply.send(user)
  })

  app.post('/admin/customers/:id/tier', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { tier } = req.body as { tier: string }
    const user = await prisma.user.update({ where: { id }, data: { tier } })
    return reply.send({ tier: user.tier })
  })

  app.post('/admin/customers/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { isActive } = req.body as { isActive: boolean }
    const user = await prisma.user.update({ where: { id }, data: { isActive } })
    return reply.send({ isActive: user.isActive })
  })

  app.delete('/admin/customers/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.user.delete({ where: { id } })
    return reply.send({ deleted: true })
  })

  // ── Vault Operations ──────────────────────────────────────────────────────

  app.get('/admin/vault/status', async (_req, reply) => {
    const statuses = await prisma.vaultZipStatus.findMany({
      orderBy: { genre: { name: 'asc' } },
      include: { genre: { select: { name: true, slug: true } } },
    })
    return reply.send({ statuses })
  })

  app.post('/admin/vault/:genreId/rebuild', async (req, reply) => {
    const { genreId } = req.params as { genreId: string }
    const { decision, reason } = await shouldRebuildZip(genreId)
    if (decision === 'already_building') {
      return reply.send({ queued: false, reason })
    }
    await markGenreStale(genreId)
    await enqueueZip(genreId)
    return reply.send({ queued: true, genreId, reason })
  })

  app.post('/admin/stems/process-deletes', async (_req, reply) => {
    const result = await processPendingDeletes()
    return reply.send(result)
  })

  // ── Audit Logs ────────────────────────────────────────────────────────────

  app.get('/admin/audit-logs', async (req, reply) => {
    const q = req.query as Record<string, string>
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: parseInt(q.limit ?? '50'),
      skip: parseInt(q.offset ?? '0'),
    })
    return reply.send({ logs })
  })

  // ── Downloads Report ──────────────────────────────────────────────────────

  app.get('/admin/downloads-report', async (_req, reply) => {
    const report = await prisma.download.groupBy({
      by: ['stemId'],
      _count: { stemId: true },
      orderBy: { _count: { stemId: 'desc' } },
      take: 50,
    })
    return reply.send({ report })
  })
}
