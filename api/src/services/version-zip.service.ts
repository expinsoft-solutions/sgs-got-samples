import archiver from 'archiver'
import { createWriteStream } from 'fs'
import { mkdir, unlink, stat, copyFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { prisma } from '../lib/prisma.js'
import { downloadAudio, masterKey } from '../lib/storage.js'

const VAULT_LOCAL_DIR = process.env.VAULT_LOCAL_DIR ?? '/tmp/vault'
const VAULT_WINDOW_MONTHS = parseInt(process.env.VAULT_WINDOW_MONTHS ?? '3')

export function stemDir(genreSlug: string): string {
  return join(VAULT_LOCAL_DIR, 'stems', genreSlug)
}

export function zipDir(genreSlug: string): string {
  return join(VAULT_LOCAL_DIR, 'zips', genreSlug)
}

export function zipPath(genreSlug: string, fromVersion: Date, toVersion: Date): string {
  return join(zipDir(genreSlug), `${fromVersion.getTime()}-${toVersion.getTime()}.zip`)
}

// ── Save uploaded stem file to VM local dir ────────────────────────────────────

export async function saveToLocal(tmpPath: string, genreSlug: string, stemFileName: string): Promise<void> {
  const dir = stemDir(genreSlug)
  await mkdir(dir, { recursive: true })
  await copyFile(tmpPath, join(dir, stemFileName))
}

// ── Build a version zip from VM-local stem files ───────────────────────────────

export async function buildVersionZip(
  genreId: string,
  genreSlug: string,
  fromVersion: Date,
  toVersion: Date,
): Promise<string> {
  const stems = await prisma.stem.findMany({
    where: {
      genres: { some: { genreId } },
      isVisible: true,
      deletedAt: null,
      vaultPublishedAt: { gte: fromVersion, lte: toVersion },
    },
    select: { storagePath: true },
  })

  if (stems.length === 0) throw new Error(`No stems found for ${genreSlug} in window`)

  const outDir = zipDir(genreSlug)
  await mkdir(outDir, { recursive: true })

  const tmpFiles: string[] = []
  const outPath = zipPath(genreSlug, fromVersion, toVersion)

  await new Promise<void>(async (resolve, reject) => {
    const output = createWriteStream(outPath)
    const archive = archiver('zip', { zlib: { level: 0 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)

    for (const stem of stems) {
      const fileName = stem.storagePath.split('/').pop() ?? 'stem.mp3'
      const localFile = join(stemDir(genreSlug), fileName)

      if (existsSync(localFile)) {
        archive.file(localFile, { name: fileName })
      } else {
        // Fallback: download from R2 if local file missing
        const tmpFile = join(outDir, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)
        tmpFiles.push(tmpFile)
        try {
          const stream = await downloadAudio(masterKey(stem.storagePath))
          await new Promise<void>((res, rej) => {
            const ws = createWriteStream(tmpFile)
            ;(stream as Readable).pipe(ws)
            ws.on('finish', res)
            ws.on('error', rej)
          })
          archive.file(tmpFile, { name: fileName })
        } catch {
          // skip missing
        }
      }
    }

    await archive.finalize()
  })

  for (const f of tmpFiles) unlink(f).catch(() => {})

  const { size } = await stat(outPath)

  await prisma.vaultVersionZip.upsert({
    where: { genreId_fromVersion_toVersion: { genreId, fromVersion, toVersion } },
    create: { genreId, fromVersion, toVersion, localPath: outPath, stemCount: stems.length, fileSizeBytes: size },
    update: { localPath: outPath, stemCount: stems.length, fileSizeBytes: size, builtAt: new Date() },
  })

  return outPath
}

// ── Get or build version zip ───────────────────────────────────────────────────

export async function getOrBuildVersionZip(
  genreId: string,
  genreSlug: string,
  fromVersion: Date,
  toVersion: Date,
): Promise<string> {
  const cached = await prisma.vaultVersionZip.findUnique({
    where: { genreId_fromVersion_toVersion: { genreId, fromVersion, toVersion } },
  })

  if (cached && existsSync(cached.localPath)) {
    return cached.localPath
  }

  return buildVersionZip(genreId, genreSlug, fromVersion, toVersion)
}

// ── Invalidate cached zips when genre stems change ────────────────────────────

export async function invalidateGenreZips(genreId: string, genreSlug: string): Promise<void> {
  const zips = await prisma.vaultVersionZip.findMany({
    where: { genreId },
    select: { id: true, localPath: true },
  })

  for (const z of zips) {
    unlink(z.localPath).catch(() => {})
  }

  await prisma.vaultVersionZip.deleteMany({ where: { genreId } })
}

// ── Compute version window for a user ─────────────────────────────────────────

export function getFromVersion(lastDownloadVersion: Date | null): Date {
  const windowMs = VAULT_WINDOW_MONTHS * 30 * 24 * 60 * 60 * 1000
  const windowStart = new Date(Date.now() - windowMs)
  if (!lastDownloadVersion) return windowStart
  return lastDownloadVersion > windowStart ? lastDownloadVersion : windowStart
}

// ── Get latest published version for a genre ─────────────────────────────────

export async function getLatestVersion(genreId: string): Promise<Date | null> {
  const latest = await prisma.stem.findFirst({
    where: { genres: { some: { genreId } }, isVisible: true, deletedAt: null, vaultPublishedAt: { not: null } },
    orderBy: { vaultPublishedAt: 'desc' },
    select: { vaultPublishedAt: true },
  })
  return latest?.vaultPublishedAt ?? null
}
