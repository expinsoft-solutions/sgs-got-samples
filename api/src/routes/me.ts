import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function meRoutes(app: FastifyInstance) {
  // GET /api/me — returns current user info from DB using Bearer token
  app.get('/me', async (req, reply) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token' })
    }

    const token = auth.slice(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return reply.code(401).send({ error: 'Invalid token' })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, tier: true, webAccess: true, name: true, avatarUrl: true },
    })

    return reply.send({
      id: user.id,
      email: user.email,
      tier: dbUser?.tier ?? 'free',
      webAccess: dbUser?.webAccess ?? false,
      name: dbUser?.name ?? user.user_metadata?.name ?? null,
      avatarUrl: dbUser?.avatarUrl ?? user.user_metadata?.avatar_url ?? null,
      isAdmin: dbUser?.tier === 'admin',
    })
  })
}
