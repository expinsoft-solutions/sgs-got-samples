import { PgBoss } from 'pg-boss'

let _boss: PgBoss | null = null

export async function getBoss(): Promise<PgBoss> {
  if (_boss) return _boss

  _boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    max: 5,
    retryLimit: 3,
    retryDelay: 30,
    expireInHours: 24,
    deleteAfterDays: 7,
  })

  _boss.on('error', (err: Error) => console.error('[pg-boss]', err))

  await _boss.start()
  return _boss
}

export const ZIP_QUEUE = 'zip-rebuild'
