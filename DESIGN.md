# SGS — New App Design Spec

## App Name
**Son Got Samples** (SGS)

---

## Design System (mirror from sgs-webapp exactly)

### Colors
```css
/* Dark mode (default) */
--bg:   #000510      /* main background */
--bg2:  #00030a      /* secondary bg */
--acc:  #6878ff      /* accent — blue-purple */
--tx:   #e8ecff      /* primary text */
--mu:   #8f9abf      /* muted text */
--mu2:  #5a6488      /* more muted */
--di:   rgba(255,255,255,.07)   /* dividers */
--me:   rgba(255,255,255,.12)   /* borders */
--hg:   rgba(120,160,255,.22)   /* highlights */
--in:   rgba(255,255,255,.18)   /* input borders */

/* Light mode toggle supported */
--bg:  #e2e5ec
--acc: #4a5ee8
--tx:  #1a1d2e
```

### Fonts
- **Exo 2** — nav, headings, labels (weight 200/300/400/600)
- **Poppins** — body text (weight 300/400/500/600)
- **Share Tech Mono** — BPM/key tags, mono data

### Background
Animated space background: fixed gradient + radial blobs + `@keyframes drift/waves`
Header: `rgba(0,5,18,.95)` + `backdrop-filter: blur(14px)` + bottom border

---

## Pages

### `/` — Home
- Hero with brand name, tagline
- CTA buttons: Browse Library, See Pricing
- Feature cards

### `/library` — Stems Library
- Access strip (free vs locked indicator)
- Top bar: search input + sort dropdown + "Unlock" CTA
- Stem type pills: **All / Acapella / Drums / Bass / Melody / Instrumental**
- Filter strip: BPM range, Key, Genre
- Desktop: table view (play button | Title | Time | Type | BPM | Key | Genre | Download)
- Mobile: card list view
- Pagination (top + bottom)
- Locked stems shown but greyed — paywall prompt on click

### `/vault` — Genre ZIP Downloads
- Genre cards grid
- Each card: genre name, stem count, file size, last built date
- Status badge: `ready` (green) / `building` (yellow pulse) / `stale` (blue — old zip available, new stems incoming) / `failed` (red)
- Download button → presigned R2 URL for genre ZIP
- Delta downloads section: list of update zips (per job batch) with date + stem count

### `/pricing` — Pricing
- Tier cards with Stripe checkout

### `/login` + `/register` — Auth
- Supabase Auth (email/password + Google OAuth)
- Same styled forms as current app

### `/dashboard` — User Dashboard
- Download history
- Account settings (email update, password)

### `/{ADMIN_SECRET_PREFIX}` — Admin (hidden URL, env var)

#### Admin: Dashboard
- Stats: total stems, total users, recent uploads

#### Admin: Stems Manager
- Full stems table with edit / toggle visibility / bulk delete
- Bulk visibility toggle
- Search + filter same as library

#### Admin: Upload
- Single upload form: Title, Artist, Stem Type, BPM, Key, Genre, Album, Cover Art URL, File
- Bulk upload: multiple files with per-file metadata
- Job mode: group uploads under a `job_id` → commit or cancel batch
- Progress indicators per file

#### Admin: Vault Operations
- Per-genre ZIP status cards
- Manual rebuild trigger per genre
- Job history list

#### Admin: Customers
- User table: email, tier, status, download count
- Edit user tier / status / reset password / delete

#### Admin: Email
- Send email to user(s)
- Email job history

---

## Data Models (Prisma)

### Stem
```
id, title, artist, stem_type (Acapella|Drums|Bass|Melody|Instrumental)
bpm (Decimal), musical_key, genre, specific_genre
album_name, album_type (album|single), release_date
cover_art_url, cover_art_path
storage_path (R2 key — full file)
preview_path (R2 key — 30s preview, optional)
duration (seconds)
is_visible, is_pending_publish, is_locked, is_free, is_duplicate, pending_delete
uploaded_from_job_id
playlist_order
vault_published_at
created_at, updated_at
```

### UploadJob
```
id (UUID), job_id (string — from upload client)
status: pending | uploading | complete | cancelled | failed
stem_count, genre
created_at, completed_at
```

### VaultZipStatus
```
id, genre (unique)
status: building | stale | ready | failed
r2_key (current full-genre ZIP)
file_size_bytes, stem_count
built_at, error_message
created_at, updated_at
```

### VaultUpdateZip  ← NEW (delta zips per job batch)
```
id, job_id (FK → UploadJob)
genre, r2_key
stem_count, file_size_bytes
built_at
```

### VaultGenreMeta
```
id, genre (unique), description, tags (json), is_hidden
```

### User
```
id (UUID — matches Supabase auth UID)
email (unique), name, avatar_url
tier: free | paid | admin
web_access (bool)
is_active (bool)
download_count, last_download_at
download_cooldown_until
created_at, updated_at
```

### Download
```
id, stem_id (FK), user_id (FK)
ip_address, downloaded_at
```

### UserDownloadTracking
```
id, user_id, stem_id, downloaded_at, ip_address
```

### Purchase
```
id, user_id (FK)
stripe_id (unique), amount (cents), currency, status
created_at
```

---

## API Routes (Fastify)

### Public
```
GET  /api/stems                    — paginated list, filterable
GET  /api/stems/:id                — single stem
GET  /api/stems/:id/preview        — presigned R2 URL (15min TTL) for preview
GET  /api/stems/:id/download       — presigned R2 URL (auth check, locked check)
GET  /api/stems/filter-options     — genres, keys, bpm ranges for filter UI
GET  /api/vault/genres             — genre stats with zip status
```

### Auth
```
POST /api/auth/update-email
POST /api/forgot-password/send-otp
POST /api/forgot-password/verify-otp
POST /api/forgot-password/reset
```

### Upload (admin, no auth middleware for now — secured by network/secret header)
```
POST /api/upload/single            — single stem upload
POST /api/upload/bulk              — bulk stems upload
POST /api/vault/jobs/:jobId/complete
POST /api/vault/jobs/:jobId/cancel
```

### Admin API (auth + admin tier check)
```
GET    /api/admin/stats
GET    /api/admin/stems            — full table
GET    /api/admin/stems/:id
PUT    /api/admin/stems/:id
POST   /api/admin/stems/:id/toggle-visibility
POST   /api/admin/stems/bulk-visibility
POST   /api/admin/stems/bulk-delete

GET    /api/admin/customers
POST   /api/admin/customers/import-csv
GET    /api/admin/customers/:id
PUT    /api/admin/customers/:id
POST   /api/admin/customers/:id/status
POST   /api/admin/customers/:id/tier
DELETE /api/admin/customers/:id

POST   /api/admin/email/send
GET    /api/admin/email/jobs

GET    /api/admin/vault/status     — all genre zip statuses
POST   /api/admin/vault/:genre/rebuild  — trigger manual rebuild
GET    /api/admin/audit-logs
GET    /api/admin/downloads-report
```

---

## Upload + Zip Flow

### Single / Bulk Upload (from machine)
```
Client (upload tool / admin UI)
  → POST /api/upload/single (or /bulk)
  → Fastify: validate metadata, create Stem record (is_pending_publish=true, is_visible=false)
  → Save file to VM temp disk (/tmp/sgs-uploads/)
  → Mirror to R2 master: vault-master/{storage_path}
  → Extract audio metadata (music-metadata npm) → update BPM/key/duration
  → Return { success, stem_id }

With job_id:
  → All stems staged under that job_id
  → POST /api/vault/jobs/:jobId/complete
      → flip is_pending_publish=false, is_visible=true for all job stems
      → queue zip rebuild per affected genre (BullMQ zipQueue)
      → queue delta zip build for this job (VaultUpdateZip)
  → POST /api/vault/jobs/:jobId/cancel
      → delete staged stems + cleanup files
```

### Zip Worker (BullMQ)
```
zipQueue job received:
  1. Query all visible stems for genre from DB
  2. For each stem: download from R2 master to VM temp
  3. archiver → zip all files → /tmp/sgs-zips/{genre}-{timestamp}.zip
  4. uploadQueue job: multipart upload ZIP to R2 at vault-zips/{genre}-latest.zip
  5. VaultZipStatus.markReady(genre, r2_key, fileSize, stemCount)
  6. Cleanup temp files

deltaZipQueue job (per job_id):
  1. Query stems uploaded under this job_id
  2. Download from R2 master
  3. archiver → /tmp/sgs-zips/delta-{jobId}.zip
  4. Upload to R2 at vault-updates/{jobId}.zip
  5. Create VaultUpdateZip record
```

### Deletion Flow
```
Admin deletes stem:
  → Set pending_delete=true (soft delete, immediate hide)
  → Queue: delete from R2 master, delete file
  → Mark genre zip stale → queue rebuild
```

---

## File Storage Structure (R2)

```
vault-master/
  {genre}/{letter}/{artist}/{Albums|Singles}/{song}/stems/
    Artist - Title StemType [BPM key].mp3

vault-zips/
  {genre}-latest.zip          ← current full genre ZIP
  
vault-updates/
  {jobId}.zip                 ← delta zip per upload batch

vault-previews/
  {stem_id}-preview.mp3       ← 30s preview clips
```

---

## Stem File Naming Convention (preserved from Laravel)
```
{Artist} - {Title} {StemType} [BPM {bpm} {key}].mp3
Example: Drake - Rich Flex Drums [BPM 140.0 A Minor].mp3
```

---

## Queues (BullMQ)
| Queue | Purpose | Concurrency |
|-------|---------|------------|
| `upload` | Multipart upload file to R2 | 3 |
| `zip` | Build full genre ZIP | 2 |
| `delta-zip` | Build job-batch delta ZIP | 3 |
| `delete` | Remove files from R2 + disk | 5 |

Zipping + deletion out of scope for first phase but **tables designed now** (VaultUpdateZip, pending_delete on Stem).

---

## Theme Toggle
- `localStorage.sgs_theme = 'light'` → adds `.theme-light` to `<html>`
- Default: dark
- Toggle button in nav header
