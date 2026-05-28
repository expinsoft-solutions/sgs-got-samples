import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { stemRoutes } from './routes/stems.js'
import { uploadRoutes } from './routes/upload.js'
import { vaultRoutes } from './routes/vault.js'
import { adminRoutes } from './routes/admin.js'
import { getBoss } from './lib/boss.js'
import { startZipWorker } from './workers/zip.worker.js'

const server = Fastify({ logger: true })

await server.register(cors, {
  origin: process.env.WEB_URL ?? 'http://localhost:3000',
  credentials: true,
})

await server.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 * 1024 }, // 10 GB
})

await server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
})

// Routes
await server.register(stemRoutes, { prefix: '/api' })
await server.register(uploadRoutes, { prefix: '/api' })
await server.register(vaultRoutes, { prefix: '/api' })
await server.register(adminRoutes, { prefix: '/api' })

server.get('/health', async () => ({ status: 'ok' }))

// Start pg-boss + zip worker
await getBoss()
await startZipWorker()

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'

try {
  await server.listen({ port: PORT, host: HOST })
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
