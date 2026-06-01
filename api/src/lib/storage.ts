import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import { createReadStream } from 'fs'
import { r2, R2_MUSIC_BUCKET, R2_ZIPS_BUCKET } from './r2.js'

// ── Key prefixes (within their respective buckets) ────────────────────────────
export const MASTER_PREFIX        = 'vault-master'    // sgs-music/vault-master/...
export const PREVIEW_PREFIX       = 'vault-previews'  // sgs-music/vault-previews/...
export const GENRE_ZIP_PREFIX     = 'genre'           // sgs-zips/genre/{name}-latest.zip
export const UPDATE_ZIP_PREFIX    = 'updates'         // sgs-zips/updates/{jobId}.zip
export const VERSION_ZIP_PREFIX   = 'version-zips'    // sgs-zips/version-zips/{slug}/{from}-{to}.zip

// ── Key builders ──────────────────────────────────────────────────────────────
export function masterKey(storagePath: string): string {
  return `${MASTER_PREFIX}/${storagePath}`
}

export function previewKey(stemId: string): string {
  return `${PREVIEW_PREFIX}/${stemId}-preview.mp3`
}

export function genreZipKey(genre: string): string {
  return `${GENRE_ZIP_PREFIX}/${genre}-latest.zip`
}

export function updateZipKey(jobId: string): string {
  return `${UPDATE_ZIP_PREFIX}/${jobId}.zip`
}

export function versionZipKey(genreSlug: string, fromVersion: Date, toVersion: Date): string {
  const from = fromVersion.getTime()
  const to   = toVersion.getTime()
  return `${VERSION_ZIP_PREFIX}/${genreSlug}/${from}-${to}.zip`
}

// ── Presigned URLs ────────────────────────────────────────────────────────────
export async function getAudioUrl(key: string, expiresIn = 900): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: R2_MUSIC_BUCKET, Key: key })
  return getSignedUrl(r2, cmd, { expiresIn })
}

export async function getZipUrl(key: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: R2_ZIPS_BUCKET, Key: key })
  return getSignedUrl(r2, cmd, { expiresIn })
}

// ── Uploads ───────────────────────────────────────────────────────────────────
export async function uploadAudio(localPath: string, r2Key: string, contentType = 'audio/mpeg'): Promise<void> {
  const upload = new Upload({
    client: r2,
    params: { Bucket: R2_MUSIC_BUCKET, Key: r2Key, Body: createReadStream(localPath), ContentType: contentType },
  })
  await upload.done()
}

export async function uploadZip(localPath: string, r2Key: string): Promise<void> {
  const upload = new Upload({
    client: r2,
    params: { Bucket: R2_ZIPS_BUCKET, Key: r2Key, Body: createReadStream(localPath), ContentType: 'application/zip' },
  })
  await upload.done()
}

// ── Deletes ───────────────────────────────────────────────────────────────────
export async function deleteAudio(r2Key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_MUSIC_BUCKET, Key: r2Key }))
}

// ── R2 download (for zip worker) ──────────────────────────────────────────────
export async function downloadAudio(r2Key: string): Promise<NodeJS.ReadableStream> {
  const res = await r2.send(new GetObjectCommand({ Bucket: R2_MUSIC_BUCKET, Key: r2Key }))
  return res.Body as NodeJS.ReadableStream
}
