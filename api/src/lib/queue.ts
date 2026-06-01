import { Queue } from 'bullmq'

// Lazy — only connects to Redis when zip phase is enabled.
export function getZipQueue(): Queue {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('ioredis')
  const redis = new createClient({ host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379), maxRetriesPerRequest: null })
  return new Queue('zip', { connection: redis as never })
}
