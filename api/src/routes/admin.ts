import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { deleteAudio, masterKey } from '../lib/storage.js'
import { shouldRebuildZip, shouldDeleteStem, executeStemDelete, processPendingDeletes, markGenreStale, purgeOldDeletes } from '../services/vault.service.js'
import { invalidateGenreZips as invalidateVersionZips } from '../services/version-zip.service.js'
import { enqueueZip } from '../workers/zip.worker.js'

export async function adminRoutes(app: FastifyInstance) {
  // ── Stats ─────────────────────────────────────────────────────────────────

  app.get('/admin/stats', async (_req, reply) => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const [
      totalStems, visibleStems, hiddenStems, pendingStems,
      totalUsers, freeUsers, paidUsers, adminUsers,
      downloadsToday, recentUploads,
    ] = await Promise.all([
      prisma.stem.count(),
      prisma.stem.count({ where: { isVisible: true } }),
      prisma.stem.count({ where: { isVisible: false, isPendingPublish: false } }),
      prisma.stem.count({ where: { isPendingPublish: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { tier: 'free' } }),
      prisma.user.count({ where: { tier: 'paid' } }),
      prisma.user.count({ where: { tier: 'admin' } }),
      prisma.download.count({ where: { downloadedAt: { gte: todayStart } } }),
      prisma.stem.findMany({
        where: { isVisible: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, artist: true, genres: { select: { genre: { select: { name: true } } } }, createdAt: true },
      }),
    ])

    return reply.send({
      stems: { total: totalStems, visible: visibleStems, hidden: hiddenStems, pending: pendingStems },
      users: { total: totalUsers, free: freeUsers, paid: paidUsers, admin: adminUsers },
      downloadsToday,
      recentUploads: recentUploads.map(s => ({
        ...s,
        genre: s.genres[0]?.genre?.name ?? '—',
      })),
    })
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
    if (q.genre) where.genres = { some: { genre: { name: q.genre } } }
    if (q.visible !== undefined) where.isVisible = q.visible === 'true'

    const [stems, total] = await Promise.all([
      prisma.stem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          genres: { select: { genre: { select: { name: true } } }, take: 1 },
        },
      }),
      prisma.stem.count({ where }),
    ])

    return reply.send({
      stems: stems.map((s) => ({ ...s, genre: s.genres[0]?.genre?.name ?? '—', genres: undefined })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
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

  // PUT /api/admin/stems/:id/genres — replace genres for a stem + invalidate caches
  app.put('/admin/stems/:id/genres', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { genreIds } = req.body as { genreIds: string[] }

    // Get old genres before replacing (for cache invalidation)
    const oldGenres = await prisma.stemGenre.findMany({
      where: { stemId: id },
      include: { genre: { select: { id: true, slug: true } } },
    })

    await prisma.stemGenre.deleteMany({ where: { stemId: id } })
    await prisma.stemGenre.createMany({
      data: genreIds.map((genreId) => ({ stemId: id, genreId })),
    })

    const genres = await prisma.genre.findMany({
      where: { id: { in: genreIds } },
      select: { id: true, name: true, slug: true },
    })

    // Invalidate version zip caches for old + new genres
    const allAffected = [
      ...oldGenres.map(g => ({ id: g.genre.id, slug: g.genre.slug })),
      ...genres.map(g => ({ id: g.id, slug: g.slug })),
    ]
    for (const { id: gId, slug } of allAffected) {
      invalidateVersionZips(gId, slug).catch(() => {})
    }

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

  // POST /api/admin/genres — create a new genre directly
  app.post('/admin/genres', async (req, reply) => {
    const { name } = req.body as { name: string }
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Genre name is required' })
    }

    const trimmedName = name.trim()
    const slug = trimmedName
      .toLowerCase()
      .replace(/[&]/g, '-and-')
      .replace(/[\s/]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    try {
      const genre = await prisma.genre.upsert({
        where: { name: trimmedName },
        create: { name: trimmedName, slug },
        update: {},
        select: { id: true, name: true, slug: true },
      })
      return reply.send(genre)
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message })
    }
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
      select: { id: true, storagePath: true, genres: { select: { genreId: true } } },
    })

    // Soft delete + queue R2 cleanup
    await prisma.stem.updateMany({
      where: { id: { in: ids } },
      data: { isVisible: false, pendingDelete: true },
    })

    // Queue zip rebuilds per genre
    const genreIds = [...new Set(stems.flatMap((s) => s.genres.map((g) => g.genreId)))]
    for (const genreId of genreIds) {
      await markGenreStale(genreId)
      await enqueueZip(genreId)
    }

    // Fire-and-forget R2 deletes
    for (const stem of stems) {
      deleteAudio(masterKey(stem.storagePath)).catch(() => {})
    }

    await prisma.stem.deleteMany({ where: { id: { in: ids }, pendingDelete: true } })

    return reply.send({ deleted: ids.length })
  })

  // ── Customers ────────────────────────────────────────────────────────────

  // POST /api/admin/customers/import-csv
  app.post('/admin/customers/import-csv', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ success: false, message: 'No file provided' })

    const ext = data.filename.split('.').pop()?.toLowerCase()
    if (!['csv', 'txt'].includes(ext ?? '')) {
      return reply.code(422).send({ success: false, message: 'Please upload a .csv file' })
    }

    const buffer = await data.toBuffer()
    // Strip UTF-8 BOM
    const text = buffer.toString('utf-8').replace(/^﻿/, '')
    const lines = text.split(/\r?\n/).filter(l => l.trim())

    if (lines.length < 2) {
      return reply.code(422).send({ success: false, message: 'CSV has no data rows' })
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const emailIdx = headers.indexOf('email')
    if (emailIdx === -1) {
      return reply.code(422).send({ success: false, message: `CSV must have an "email" column. Found: ${headers.join(', ')}` })
    }

    const nameIdx   = headers.indexOf('name')
    const tierIdx   = headers.findIndex(h => h === 'tier' || h === 'plan_tier')
    const statusIdx = headers.indexOf('status')

    const VALID_TIERS = ['free', 'paid', 'admin']

    let imported = 0, skipped = 0, failed = 0
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''))
      if (!cols.some(Boolean)) continue

      const email = (cols[emailIdx] ?? '').toLowerCase().trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        failed++; errors.push(`Row ${i + 1}: invalid email '${email}'`); continue
      }

      const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      if (exists) { skipped++; continue }

      const name  = nameIdx >= 0 ? (cols[nameIdx] || email.split('@')[0]) : email.split('@')[0]
      let   tier  = tierIdx >= 0 ? (cols[tierIdx] ?? 'free').toLowerCase() : 'free'
      const isActive = statusIdx >= 0 ? (cols[statusIdx] ?? 'active').toLowerCase() !== 'banned' : true

      if (!VALID_TIERS.includes(tier)) tier = 'free'

      try {
        await prisma.user.create({
          data: { id: `csv-${Date.now()}-${Math.random().toString(36).slice(2)}`, email, name, tier, isActive },
        })
        imported++
      } catch (e) {
        failed++; errors.push(`Row ${i + 1} (${email}): ${(e as Error).message}`)
      }
    }

    return reply.send({ success: true, imported, skipped, failed, errors: errors.slice(0, 10) })
  })

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

  // POST /api/admin/stems/purge-deleted — hard-delete stems soft-deleted > N days ago
  app.post('/admin/stems/purge-deleted', async (req, reply) => {
    const { days } = (req.body ?? {}) as { days?: number }
    const { purged } = await purgeOldDeletes(days ?? 3)
    return reply.send({ purged })
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
