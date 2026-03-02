This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on DigitalOcean App Platform

- **Build command:** `next build`
- **Run command:** `npm start` (uses `next start -p ${PORT:-3000}`; App Platform sets `PORT`)

**Environment variables** — set in App Platform (App → Settings → App-Level Environment Variables):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (e.g. DigitalOcean Managed Database). Use `?sslmode=require` for TLS. |
| `OPENAI_API_KEY` | Yes (for AI) | OpenAI API key for categorization and advisor insights. |
| `ENABLE_DB_WRITE` | No | Set to `true` to allow uploading and saving transactions. Omit or `false` for read-only. |
| `NEXTAUTH_SECRET` | Yes (for auth) | Random secret for session signing (e.g. `openssl rand -base64 32`). |
| `NEXTAUTH_URL` | Yes (for auth) | Full app URL (e.g. `https://your-app.ondigitalocean.app`). |

Do not commit these values; configure them in the platform only.

**Health check:** After deploy, `GET /api/health` returns `{ ok: true, hasDb: true }` when the app and DB config are correct. It does not expose secrets.

**Database:** The app uses a single shared Postgres pool (created at startup, reused for all requests). Safe for App Platform’s managed runtime.

---

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
