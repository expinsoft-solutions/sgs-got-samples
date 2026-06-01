import { Worker } from 'bullmq'
import { Upload } from '@aws-sdk/lib-storage'
import { createReadStream } from 'fs'
import { unlink } from 'fs/promises'
import { r2, R2_MUSIC_BUCKET, R2_ZIPS_BUCKET } from '../lib/r2.js'

// Generic upload worker — only used if Redis is available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _worker: any = null

export function getUploadWorker() {
  if (_worker) return _worker
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require('ioredis')
    const redis = new IORedis({ host: process.env.REDIS_HOST ?? 'localhost', port: 6379, maxRetriesPerRequest: null })

    _worker = new Worker(
      'upload',
      async (job: { data: { localPath: string; r2Key: string; contentType: string; bucket?: string }; updateProgress: (n: number) => void }) => {
        const { localPath, r2Key, contentType, bucket } = job.data
        const Bucket = bucket === 'zips' ? R2_ZIPS_BUCKET : R2_MUSIC_BUCKET

        const upload = new Upload({
          client: r2,
          params: { Bucket, Key: r2Key, Body: createReadStream(localPath), ContentType: contentType },
        })

        upload.on('httpUploadProgress', (progress) => {
          const pct = Math.round(((progress.loaded ?? 0) / (progress.total ?? 1)) * 100)
          job.updateProgress(pct)
        })

        await upload.done()
        await unlink(localPath)
        return { r2Key, bucket: Bucket }
      },
      { connection: redis as never, concurrency: 3 }
    )
  } catch {
    // Redis not available — upload worker disabled
  }
  return _worker
}
