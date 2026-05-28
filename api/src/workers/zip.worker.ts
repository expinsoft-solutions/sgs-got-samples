import type { JobWithMetadata } from 'pg-boss'
import archiver from 'archiver'
import { createWriteStream } from 'fs'
import { mkdir, unlink } from 'fs/promises'
import { statSync } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { prisma } from '../lib/prisma.js'
import { getBoss, ZIP_QUEUE } from '../lib/boss.js'
import { downloadAudio, uploadZip, masterKey, genreZipKey, updateZipKey } from '../lib/storage.js'

const TMP_DIR = process.env.TMP_DIR ?? '/tmp/sgs-uploads'

async function downloadToTmp(r2Key: string, destPath: string): Promise<void> {
  const stream = await downloadAudio(r2Key)
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(destPath)
    ;(stream as Readable).pipe(ws)
    ws.on('finish', resolve)
    ws.on('error', reject)
  })
}

async function buildZip(storagePaths: string[], outputPath: string): Promise<void> {
  const tmpFiles: string[] = []

  await new Promise<void>(async (resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 6 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)

    for (const storagePath of storagePaths) {
      const tmpFile = join(TMP_DIR, `stem-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)
      tmpFiles.push(tmpFile)
      try {
        await downloadToTmp(masterKey(storagePath), tmpFile)
        archive.file(tmpFile, { name: storagePath.split('/').pop() ?? 'stem.mp3' })
      } catch {
        // skip missing file, continue zip
      }
    }

    await archive.finalize()
  })

  for (const f of tmpFiles) unlink(f).catch(() => {})
}

export type ZipJobData = {
  genre: string
  jobId?: string  // present for delta zip
}

async function handleZipJob(job: JobWithMetadata<ZipJobData>): Promise<void> {
  const { genre, jobId } = job.data

  await mkdir(TMP_DIR, { recursive: true })

  // ── Full genre rebuild → sgs-zips/genre/{genre}-latest.zip ────────────────
  await prisma.vaultZipStatus.upsert({
    where: { genre },
    create: { genre, status: 'building' },
    update: { status: 'building', errorMessage: null },
  })

  try {
    const stems = await prisma.stem.findMany({
      where: { genre, isVisible: true, pendingDelete: false },
      select: { storagePath: true },
    })

    const zipPath = join(TMP_DIR, `${genre}-${Date.now()}.zip`)
    const r2Key = genreZipKey(genre)

    await buildZip(stems.map((s) => s.storagePath), zipPath)

    const fileSize = statSync(zipPath).size
    await uploadZip(zipPath, r2Key)
    unlink(zipPath).catch(() => {})

    await prisma.vaultZipStatus.update({
      where: { genre },
      data: { status: 'ready', r2Key, fileSizeBytes: fileSize, stemCount: stems.length, builtAt: new Date(), errorMessage: null },
    })

    // ── Delta zip → sgs-zips/updates/{jobId}.zip ──────────────────────────
    if (jobId) {
      const jobStems = await prisma.stem.findMany({
        where: { uploadedFromJobId: jobId, isVisible: true },
        select: { storagePath: true },
      })

      if (jobStems.length > 0) {
        const deltaPath = join(TMP_DIR, `delta-${jobId}.zip`)
        const deltaKey = updateZipKey(jobId)

        await buildZip(jobStems.map((s) => s.storagePath), deltaPath)

        const deltaSize = statSync(deltaPath).size
        await uploadZip(deltaPath, deltaKey)
        unlink(deltaPath).catch(() => {})

        await prisma.vaultUpdateZip.upsert({
          where: { jobId_genre: { jobId, genre } },
          create: { jobId, genre, r2Key: deltaKey, stemCount: jobStems.length, fileSizeBytes: deltaSize, builtAt: new Date() },
          update: { r2Key: deltaKey, stemCount: jobStems.length, fileSizeBytes: deltaSize, builtAt: new Date() },
        })
      }
    }
  } catch (err) {
    await prisma.vaultZipStatus.updateMany({
      where: { genre },
      data: { status: 'failed', errorMessage: (err as Error).message },
    })
    throw err // let pg-boss retry
  }
}

export async function startZipWorker(): Promise<void> {
  const boss = await getBoss()

  await boss.createQueue(ZIP_QUEUE)

  // Up to 5 genres zipping in parallel
  await boss.work<ZipJobData>(ZIP_QUEUE, { teamSize: 5, teamConcurrency: 5 }, handleZipJob)

  console.log('[zip-worker] listening on queue:', ZIP_QUEUE)
}

export async function enqueueZip(genre: string, jobId?: string): Promise<void> {
  const boss = await getBoss()
  await boss.createQueue(ZIP_QUEUE)
  await boss.send(ZIP_QUEUE, { genre, jobId }, {
    singletonKey: genre,     // deduplicate — one pending job per genre at a time
    retryLimit: 3,
    retryDelay: 30,
  })
}
