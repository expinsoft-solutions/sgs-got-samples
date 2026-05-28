import { S3Client } from '@aws-sdk/client-s3'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// sgs-music  — individual audio stems (vault-master/...)
export const R2_MUSIC_BUCKET = process.env.R2_BUCKET_MUSIC ?? 'sgs-music'

// sgs-zips   — full genre ZIPs + delta update ZIPs
export const R2_ZIPS_BUCKET = process.env.R2_BUCKET_ZIPS ?? 'sgs-zips'
