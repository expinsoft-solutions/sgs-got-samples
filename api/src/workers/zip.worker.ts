import type { JobWithMetadata } from 'pg-boss'
import { prisma } from '../lib/prisma.js'
import { getBoss, ZIP_QUEUE } from '../lib/boss.js'
import { buildVersionZip } from '../services/version-zip.service.js'

export type ZipJobData = {
  genreId: string
  jobId?: string
}

async function handleZipJob(job: JobWithMetadata<ZipJobData>): Promise<void> {
  const { genreId } = job.data

  const genre = await prisma.genre.findUnique({
    where: { id: genreId },
    select: { slug: true },
  })
  if (!genre) return

  const windowMs = parseInt(process.env.VAULT_WINDOW_MONTHS ?? '3') * 30 * 24 * 60 * 60 * 1000
  const fromVersion = new Date(Date.now() - windowMs)
  const toVersion = new Date()

  await buildVersionZip(genreId, genre.slug, fromVersion, toVersion)
}

export async function startZipWorker(): Promise<void> {
  const boss = await getBoss()
  await boss.createQueue(ZIP_QUEUE)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (boss as any).work(ZIP_QUEUE, { localConcurrency: 5 }, handleZipJob)
  console.log('[zip-worker] listening on queue:', ZIP_QUEUE)
}

export async function enqueueZip(genreId: string, jobId?: string): Promise<void> {
  const boss = await getBoss()
  await boss.createQueue(ZIP_QUEUE)
  await boss.send(ZIP_QUEUE, { genreId, jobId }, {
    singletonKey: genreId,
    retryLimit: 3,
    retryDelay: 30,
  })
}
