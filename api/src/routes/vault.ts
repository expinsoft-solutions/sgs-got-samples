import type { FastifyInstance } from 'fastify'
import { createReadStream, existsSync } from 'fs'
import { prisma } from '../lib/prisma.js'
import { getZipUrl } from '../lib/storage.js'
import { createClient } from '@supabase/supabase-js'
import {
  getFromVersion,
  getLatestVersion,
  getOrBuildVersionZip,
  invalidateGenreZips,
} from '../services/version-zip.service.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromRequest(req: { headers: { authorization?: string } }) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  const { data: { user } } = await supabase.auth.getUser(auth.slice(7))
  return user
}

export async function vaultRoutes(app: FastifyInstance) {
  // GET /api/vault/genres — public genre stats
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

  // POST /api/vault/prepare-download — called on login, returns per-genre version info
  app.post('/vault/prepare-download', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorised' })

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastDownloadVersion: true, tier: true },
    })
    if (!dbUser) return reply.code(404).send({ error: 'User not found' })
    if (dbUser.tier === 'free') return reply.code(403).send({ error: 'Upgrade required' })

    const fromVersion = getFromVersion(dbUser.lastDownloadVersion)

    // All visible genres
    const genres = await prisma.genre.findMany({
      where: {
        isHidden: false,
        stems: { some: { stem: { isVisible: true, deletedAt: null } } },
      },
      select: { id: true, name: true, slug: true },
    })

    const downloads: unknown[] = []
    const upToDate: string[] = []
    let maxToVersion: Date | null = null

    for (const genre of genres) {
      const toVersion = await getLatestVersion(genre.id)
      if (!toVersion || fromVersion >= toVersion) {
        upToDate.push(genre.name)
        continue
      }

      if (!maxToVersion || toVersion > maxToVersion) maxToVersion = toVersion

      downloads.push({
        genreId: genre.id,
        genre: genre.name,
        slug: genre.slug,
        fromVersion: fromVersion.toISOString(),
        toVersion: toVersion.toISOString(),
        ready: existsSync(
          (await prisma.vaultVersionZip.findUnique({
            where: { genreId_fromVersion_toVersion: { genreId: genre.id, fromVersion, toVersion } },
          }))?.localPath ?? ''
        ),
      })
    }

    // Update user's last download version to latest
    if (maxToVersion) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastDownloadVersion: maxToVersion },
      })
    }

    return reply.send({ downloads, upToDate })
  })

  // GET /api/vault/download/:slug?from=<ts>&to=<ts> — stream zip file
  app.get('/vault/download/:slug', async (req, reply) => {
    const user = await getUserFromRequest(req)
    if (!user) return reply.code(401).send({ error: 'Unauthorised' })

    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { tier: true } })
    if (!dbUser || dbUser.tier === 'free') return reply.code(403).send({ error: 'Upgrade required' })

    const { slug } = req.params as { slug: string }
    const q = req.query as { from?: string; to?: string }

    if (!q.from || !q.to) return reply.code(400).send({ error: 'from and to timestamps required' })

    const genre = await prisma.genre.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } })
    if (!genre) return reply.code(404).send({ error: 'Genre not found' })

    const fromVersion = new Date(parseInt(q.from))
    const toVersion = new Date(parseInt(q.to))

    if (isNaN(fromVersion.getTime()) || isNaN(toVersion.getTime())) {
      return reply.code(400).send({ error: 'Invalid timestamps' })
    }

    try {
      const localPath = await getOrBuildVersionZip(genre.id, genre.slug, fromVersion, toVersion)

      const fileName = `${genre.slug}-${fromVersion.getTime()}-${toVersion.getTime()}.zip`
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`)
      reply.header('Content-Type', 'application/zip')

      return reply.send(createReadStream(localPath))
    } catch (e) {
      return reply.code(500).send({ error: (e as Error).message })
    }
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
}
