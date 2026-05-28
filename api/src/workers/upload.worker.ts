import { Worker } from 'bullmq'
import { Upload } from '@aws-sdk/lib-storage'
import { createReadStream } from 'fs'
import { unlink } from 'fs/promises'
import { r2, R2_MUSIC_BUCKET, R2_ZIPS_BUCKET } from '../lib/r2.js'
import { redis } from '../lib/redis.js'

// Generic upload worker — caller specifies bucket via job.data.bucket
export const uploadWorker = new Worker(
  'upload',
  async (job) => {
    const { localPath, r2Key, contentType, bucket } = job.data

    const Bucket = bucket === 'zips' ? R2_ZIPS_BUCKET : R2_MUSIC_BUCKET

    const upload = new Upload({
      client: r2,
      params: {
        Bucket,
        Key: r2Key,
        Body: createReadStream(localPath),
        ContentType: contentType,
      },
    })

    upload.on('httpUploadProgress', (progress) => {
      const pct = Math.round(((progress.loaded ?? 0) / (progress.total ?? 1)) * 100)
      job.updateProgress(pct)
    })

    await upload.done()
    await unlink(localPath)

    return { r2Key, bucket: Bucket }
  },
  { connection: redis, concurrency: 3 }
)
