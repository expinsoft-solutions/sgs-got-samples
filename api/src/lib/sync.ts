import { mkdir } from 'fs/promises'
import { existsSync, createWriteStream } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { prisma } from './prisma.js'
import { downloadAudio, masterKey } from './storage.js'
import { stemDir } from '../services/version-zip.service.js'

const CONCURRENCY = 8

/**
 * On startup: walk every visible stem in the DB, ensure the file exists
 * locally under VAULT_LOCAL_DIR/stems/{genreSlug}/{filename}.
 * Skips files already present — safe to run on every start.
 */
export async function syncStemsFromR2(log: (msg: string) => void = console.log): Promise<void> {
  log('[sync] Starting R2 → local stem sync…')

  const stems = await prisma.stem.findMany({
    where: { isVisible: true, deletedAt: null, storagePath: { not: '' } },
    select: {
      storagePath: true,
      genres: { select: { genre: { select: { slug: true } } } },
    },
  })

  // Flatten to (storagePath, genreSlug) pairs — a stem in N genres needs N local copies
  const tasks: { storagePath: string; genreSlug: string }[] = []
  for (const stem of stems) {
    for (const g of stem.genres) {
      if (g.genre?.slug) tasks.push({ storagePath: stem.storagePath, genreSlug: g.genre.slug })
    }
  }

  log(`[sync] ${stems.length} stems → ${tasks.length} file placements to verify`)

  let downloaded = 0, skipped = 0, failed = 0

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    await Promise.all(tasks.slice(i, i + CONCURRENCY).map(async ({ storagePath, genreSlug }) => {
      const fileName = storagePath.split('/').pop()
      if (!fileName) return

      const dir = stemDir(genreSlug)
      const localPath = join(dir, fileName)

      if (existsSync(localPath)) { skipped++; return }

      await mkdir(dir, { recursive: true })

      try {
        const stream = await downloadAudio(masterKey(storagePath))
        await new Promise<void>((res, rej) => {
          const ws = createWriteStream(localPath)
          ;(stream as Readable).pipe(ws)
          ws.on('finish', res)
          ws.on('error', rej)
        })
        downloaded++
      } catch (err) {
        log(`[sync] WARN: failed to download ${storagePath} — ${(err as Error).message}`)
        failed++
      }
    }))
  }

  log(`[sync] Done — downloaded: ${downloaded}, skipped: ${skipped}, failed: ${failed}`)
}
