import type { JobWithMetadata } from 'pg-boss'
import { prisma } from '../lib/prisma.js'
import { getBoss, ZIP_QUEUE } from '../lib/boss.js'
import { buildVersionZip } from '../services/version-zip.service.js'

export type ZipJobData = {
  genreId: string
  jobId?: string
  fromVersion?: string // ISO format string
  toVersion?: string   // ISO format string
}

async function handleZipJob(jobOrJobs: JobWithMetadata<ZipJobData> | JobWithMetadata<ZipJobData>[]): Promise<void> {
  const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs]

  for (const job of jobs) {
    const { genreId, fromVersion: fv, toVersion: tv } = job.data

    const genre = await prisma.genre.findUnique({
      where: { id: genreId },
      select: { slug: true },
    })
    if (!genre) continue

    let fromVersion: Date
    let toVersion: Date

    if (fv && tv) {
      fromVersion = new Date(fv)
      toVersion = new Date(tv)
    } else {
      const windowMs = parseInt(process.env.VAULT_WINDOW_MONTHS ?? '3') * 30 * 24 * 60 * 60 * 1000
      fromVersion = new Date(Date.now() - windowMs)
      toVersion = new Date()
    }

    await buildVersionZip(genreId, genre.slug, fromVersion, toVersion)
  }
}

export async function startZipWorker(): Promise<void> {
  const boss = await getBoss()
  await boss.createQueue(ZIP_QUEUE)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (boss as any).work(ZIP_QUEUE, { localConcurrency: 5 }, handleZipJob)
  console.log('[zip-worker] listening on queue:', ZIP_QUEUE)
}

export async function enqueueZip(
  genreId: string,
  jobId?: string,
  fromVersion?: Date,
  toVersion?: Date
): Promise<void> {
  const boss = await getBoss()
  await boss.createQueue(ZIP_QUEUE)

  const data: ZipJobData = { genreId, jobId }
  if (fromVersion) data.fromVersion = fromVersion.toISOString()
  if (toVersion) data.toVersion = toVersion.toISOString()

  const singletonKey = fromVersion && toVersion
    ? `${genreId}-${fromVersion.getTime()}-${toVersion.getTime()}`
    : genreId

  await boss.send(ZIP_QUEUE, data, {
    singletonKey,
    retryLimit: 3,
    retryDelay: 30,
  })
}
