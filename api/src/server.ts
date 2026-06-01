import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { stemRoutes } from './routes/stems.js'
import { meRoutes } from './routes/me.js'
import { uploadRoutes } from './routes/upload.js'
import { vaultRoutes } from './routes/vault.js'
import { adminRoutes } from './routes/admin.js'
import { getBoss } from './lib/boss.js'
import { startZipWorker } from './workers/zip.worker.js'

const isDev = process.env.NODE_ENV !== 'production'

const server = Fastify({
  logger: isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{msg} {reqId}',
          },
        },
      }
    : true, // JSON in production
})

const allowedOrigins = (process.env.WEB_URL ?? 'http://localhost:6626')
  .split(',').map(o => o.trim()).filter(Boolean)

await server.register(cors, {
  // Allow browser origins from allowedOrigins + non-browser clients (no Origin header)
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS origin not allowed: ${origin}`), false)
  },
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
await server.register(meRoutes, { prefix: '/api' })
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
