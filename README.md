# SGS — Son Got Samples

A monorepo for an automated music-content pipeline: it splits tracks into
stems, renders branded videos from them, and schedules uploads across
YouTube and TikTok.

## What it does

- Ingests and processes audio tracks, splitting them into stems (vocals,
  drums, bass, melody) with **Demucs**
- Renders branded MP4 videos from the resulting stems
- Schedules and manages uploads across multiple YouTube channels (and
  optionally TikTok), with checkpointing/recovery for long-running jobs
- Serves a web dashboard for managing content and monitoring pipeline runs

## Tech stack

| Component | Stack |
|---|---|
| `web/` | Next.js, TypeScript |
| `api/` | Node.js, TypeScript, Prisma |
| `uploader/` | Python, FastAPI, Demucs, Playwright |

## Project structure

```
.
├── api/        # Backend API (Node.js + Prisma)
├── web/        # Web dashboard (Next.js)
├── uploader/   # Stem-splitting & upload scheduling service (Python/FastAPI)
├── deploy.sh
├── ecosystem.config.js   # PM2 process config
└── nginx.conf
```

## Getting started

Each subproject is set up independently.

**Web dashboard**
```bash
cd web
npm install
npm run dev
```

**API**
```bash
cd api
npm install
cp .env.example .env   # fill in your database and service credentials
npx prisma migrate deploy
npm run dev
```

**Uploader service**
```bash
cd uploader
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your API tokens and credentials
python tk.py
```

## Accessibility

The `web/` dashboard is built with accessibility best practices in mind,
targeting WCAG 2.1 AA.

## License

MIT — see [LICENSE](./LICENSE).
