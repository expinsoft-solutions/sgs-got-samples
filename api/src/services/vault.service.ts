import { unlink } from 'fs/promises'
import { join } from 'path'
import { prisma } from '../lib/prisma.js'
import { deleteAudio, masterKey } from '../lib/storage.js'
import { stemDir, invalidateGenreZips } from './version-zip.service.js'

export type ZipDecision = 'rebuild' | 'skip' | 'already_building'

export async function shouldRebuildZip(genreId: string): Promise<{ decision: ZipDecision; reason: string }> {
  const status = await prisma.vaultZipStatus.findUnique({ where: { genreId } })

  if (!status) return { decision: 'rebuild', reason: 'no zip exists yet' }
  if (status.status === 'building') return { decision: 'already_building', reason: 'rebuild already in progress' }
  if (status.status === 'stale') return { decision: 'rebuild', reason: 'stems changed since last build' }
  if (status.status === 'failed') return { decision: 'rebuild', reason: 'previous build failed' }

  const liveCount = await prisma.stem.count({
    where: { genres: { some: { genreId } }, isVisible: true, pendingDelete: false },
  })

  if (liveCount !== status.stemCount) {
    return { decision: 'rebuild', reason: `stem count changed (${status.stemCount} → ${liveCount})` }
  }

  return { decision: 'skip', reason: 'zip is current' }
}

export async function markGenreStale(genreId: string): Promise<void> {
  await prisma.vaultZipStatus.updateMany({
    where: { genreId, status: 'ready' },
    data: { status: 'stale' },
  })
}

export type DeleteDecision = 'proceed' | 'skip' | 'soft_only'

export async function shouldDeleteStem(stemId: string): Promise<{ decision: DeleteDecision; reason: string }> {
  const stem = await prisma.stem.findUnique({
    where: { id: stemId },
    select: { id: true, pendingDelete: true, isVisible: true, storagePath: true, deletedAt: true },
  })

  if (!stem) return { decision: 'skip', reason: 'stem not found' }
  if (stem.deletedAt) return { decision: 'skip', reason: 'already soft-deleted' }
  if (!stem.pendingDelete) return { decision: 'soft_only', reason: 'not marked for deletion — soft delete first' }

  const recentDownload = await prisma.download.findFirst({
    where: { stemId, downloadedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })

  if (recentDownload) return { decision: 'skip', reason: 'downloaded in last 24h — defer deletion' }

  return { decision: 'proceed', reason: 'safe to delete' }
}

export async function executeStemDelete(stemId: string): Promise<void> {
  const stem = await prisma.stem.findUnique({
    where: { id: stemId },
    select: { storagePath: true, genres: { select: { genreId: true, genre: { select: { slug: true } } } } },
  })

  if (!stem) return

  // Soft delete — R2 + local files kept until purge cron (3 days)
  await prisma.stem.update({
    where: { id: stemId },
    data: { isVisible: false, pendingDelete: false, deletedAt: new Date() },
  })

  // Invalidate version zip cache immediately — next login rebuilds clean zips
  for (const { genreId, genre } of stem.genres) {
    await markGenreStale(genreId)
    await invalidateGenreZips(genreId, genre.slug)
  }
}

// Called by cron — hard-deletes stems soft-deleted more than `days` ago
export async function purgeOldDeletes(days = 3): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const stems = await prisma.stem.findMany({
    where: { deletedAt: { not: null, lte: cutoff } },
    select: {
      id: true,
      storagePath: true,
      genres: { select: { genreId: true, genre: { select: { slug: true } } } },
    },
  })

  if (stems.length === 0) return { purged: 0 }

  const affectedGenres = new Set<{ id: string; slug: string }>()

  for (const stem of stems) {
    // Delete from R2
    deleteAudio(masterKey(stem.storagePath)).catch(() => {})

    // Delete local VM file
    const fileName = stem.storagePath.split('/').pop()
    if (fileName) {
      for (const { genre, genreId } of stem.genres) {
        affectedGenres.add({ id: genreId, slug: genre.slug })
        unlink(join(stemDir(genre.slug), fileName)).catch(() => {})
      }
    }
  }

  // Hard-delete DB records
  await prisma.stem.deleteMany({
    where: { id: { in: stems.map((s: { id: string }) => s.id) } },
  })

  // Invalidate cached version zips for affected genres
  for (const { id, slug } of affectedGenres) {
    await invalidateGenreZips(id, slug)
  }

  return { purged: stems.length }
}

export async function processPendingDeletes(): Promise<{ deleted: number; deferred: number }> {
  const pending = await prisma.stem.findMany({ where: { pendingDelete: true }, select: { id: true } })

  let deleted = 0
  let deferred = 0

  for (const { id } of pending) {
    const { decision } = await shouldDeleteStem(id)
    if (decision === 'proceed') { await executeStemDelete(id); deleted++ }
    else deferred++
  }

  return { deleted, deferred }
}
