// Queue connections are lazy — Redis only required when zip phase is enabled.
// Import and use getZipQueue() only when REDIS_ENABLED=true.

import { Queue } from 'bullmq'
import { redis } from './redis.js'

export function getZipQueue(): Queue {
  return new Queue('zip', { connection: redis })
}
