# Finance Analyzer

Upload credit-card PDF statements (Chase, Bank of America, Amex), categorize spending with optional OpenAI help, and view monthly insights. **Designed to run on your own machine**: data stays in **your** Postgres database; you supply **your** API keys. There is no vendor-hosted copy of your statements unless you choose to deploy the app somewhere.

**New to GitHub, terminals, or databases?** This repo is not a one-click installer. See **[docs/USER_GUIDE.md — If you are not technical](docs/USER_GUIDE.md#if-you-are-not-technical)** for a plain-English explanation of PostgreSQL, what `DATABASE_URL` means, and where to get help.

## Run locally (recommended)

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ (LTS)
- [PostgreSQL](https://www.postgresql.org/) 14+ running locally (or a DB you control)

### Setup

1. Clone or download this repository.

2. Create a database (example):

   ```bash
   createdb finance_analyzer
   ```

3. Copy environment template and edit:

   ```bash
   cp .env.example .env.local
   ```

   Set at least `DATABASE_URL`, `ENABLE_DB_WRITE=true` for uploads, and `OPENAI_API_KEY` if you use AI features. See [Environment variables](#environment-variables).

4. Install and start:

   ```bash
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and upload PDFs (no account required; intended for local use only).

Schema creation runs automatically on server start when `DATABASE_URL` and `ENABLE_DB_WRITE=true` are set.

### Production build (local)

```bash
npm run build
npm start
```

Default port is `3000`, or set `PORT`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string. |
| `OPENAI_API_KEY` | For AI | Categorization and advisor insights. |
| `ENABLE_DB_WRITE` | For uploads | Set to `true` to allow saving transactions and schema init on startup. |

Format: `postgresql://USER:PASSWORD@HOST:PORT/DB_NAME` (omit `:PASSWORD` if your local Postgres uses no password). Step-by-step examples: [docs/USER_GUIDE.md](docs/USER_GUIDE.md) → *How to set `DATABASE_URL`*.

Do not commit real secrets; use `.env.local` (gitignored).

## Security notes

- **Local-only by design**: There is no built-in login. Anyone who can reach the app in a browser can use the API. Run on **localhost** (default for `npm run dev` / `next start`) and do not expose the process to untrusted networks.
- **If you ignore that and deploy publicly**: add your own access control (reverse proxy, VPN, etc.); this repo does not ship authentication.
- Debug routes under `/api/debug/*` are for development; do not expose them on the internet.

## Health check

`GET /api/health` returns `{ ok: true, hasDb: ... }` without exposing secrets.

---

## Deploy on DigitalOcean App Platform

- **Build command:** `next build`
- **Run command:** `npm start` (uses `next start -p ${PORT:-3000}`; App Platform sets `PORT`)

Set the same environment variables in the platform UI. For managed Postgres on DigitalOcean, `DATABASE_URL` often needs TLS (`sslmode=require`); the app adjusts SSL for DigitalOcean hosts.

---

## Deploy on Vercel

See [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying). You will need a compatible Postgres provider and the env vars above.

---

This project uses [Next.js](https://nextjs.org).
