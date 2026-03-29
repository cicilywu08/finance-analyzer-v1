# Finance Analyzer

Upload credit-card PDF statements (Chase, Bank of America, Amex), categorize spending with optional OpenAI help, and view monthly insights. **Designed to run on your own machine**: data stays in **your** Postgres database; you supply **your** API keys.

> **No coding background?** Read [If you are not technical](#if-you-are-not-technical) first. This project is **not** a one-click app from an app store—you install a few tools and paste commands into a terminal. That is normal for many GitHub projects.

---

## If you are not technical

### What you are actually doing

Downloading from GitHub gives you **source code**: instructions your computer follows after you install helper software (Node.js, PostgreSQL). That is different from buying an app that already contains everything.

**You do not “find” a website URL to paste in.** The `DATABASE_URL` is **not** something you look up in Google like `facebook.com`. It is **one line of text you assemble** (or copy from an example) that means: “connect to the database **on this computer**, as this user, to this named storage box.” Think of it as an **internal address** between two programs on your PC—not a link you open in a browser.

### What is PostgreSQL, and where do you get it?

**PostgreSQL** is free database software. This app stores your transactions there so they persist when you close the browser. You install it once, like installing Office or a game, but it has no window you use every day—it just runs in the background.

- **Official downloads (pick your system):** [PostgreSQL download page](https://www.postgresql.org/download/)
- **Windows:** Use the installer from EnterpriseDB or the page above. During setup it will ask for a **password** for the default superuser, often named `postgres`. **Write that password down**—you will need it inside `DATABASE_URL`.
- **Mac:** Common paths are the same download page or **Postgres.app**—follow their “getting started” to start the server.

After installing, you still follow the steps below to **create an empty database** (one command like `createdb finance_analyzer`) and then put the matching `DATABASE_URL` in `.env.local`.

### Then what is `DATABASE_URL`?

It is a **single configuration line** in a file named `.env.local` in the project folder. It looks like an address with pieces:

`postgresql://` + **username** + optional `:` + **password** + `@` + **localhost** + `:` + **5432** + `/` + **database name**

You are not expected to memorize this. You:

1. Use the **username** and **password** Postgres gave you at install (or your Mac username if your setup uses no password).
2. Use the **database name** you created (e.g. `finance_analyzer`).
3. Copy an **example** from this guide and swap in your real values.

If the installer only created user `postgres` with password `hunter2`, a typical line is:

`DATABASE_URL=postgresql://postgres:hunter2@localhost:5432/finance_analyzer`

### If this still feels impossible

That is understandable. Options:

- Ask a technical friend or IT helper for **30–60 minutes** to install Node + Postgres, create the database, and fill `.env.local` once.
- Pay for a short session with a local tech-support service—bring this README.
- **This repository does not yet ship a single packaged “double-click” app**; removing Postgres would require a different version of the software (future work).

---

## What this app does

- **Upload** credit card statement PDFs (supported issuers include Chase and American Express).
- **Review** transactions by month: amounts, merchants, and categories.
- **Optional AI**: OpenAI can suggest categories and generate advisor-style insights. If you skip the API key, parts of the app that need the model will not work; everything else that only needs your database still can.
- **Plan context**: You can set rent and income defaults (and overrides per month) to support summaries and planning views.

The app does **not** send your PDFs to a service we operate. When you use AI features, requests go from **your** running app to **OpenAI** using **your** key, under OpenAI’s terms and retention policies.

---

## What you need before you start

1. **A computer** with [Node.js](https://nodejs.org/) version **20 or newer** installed.
2. **PostgreSQL** (version 14 or newer) installed and running locally, or a Postgres database you control and can connect to from your machine.
3. **An OpenAI API key** (optional but recommended if you want automatic categorization and advisor insights). Create one in your OpenAI account billing/API settings.
4. **Basic comfort** with a terminal: copy-paste commands, edit a text file for configuration. If that is new to you, read **[If you are not technical](#if-you-are-not-technical)** above.

If you only download a ZIP from GitHub instead of using `git clone`, unpack it somewhere you remember and use that folder in the terminal steps below.

---

## Quick start

### 1. Install dependencies

Open a terminal, go to the project folder, then run:

```bash
npm install
```

### 2. Create a database

Using PostgreSQL’s tools (names may vary on your system), create an empty database, for example:

```bash
createdb finance_analyzer
```

Or create a database named whatever you prefer and use that name in the connection string in the next step.

### 3. Configure environment variables

In the project root:

1. Copy the example file:

   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` in a text editor and set:

   | Setting | What to put |
   |--------|----------------|
   | `DATABASE_URL` | Connection string for Postgres (see below). |
   | `ENABLE_DB_WRITE` | `true` so uploads and saves work, and so tables are created on startup |
   | `OPENAI_API_KEY` | Your OpenAI secret key (if you use AI features) |

#### How to set `DATABASE_URL`

Put **one line** in `.env.local` (in the project root, same folder as `package.json`):

```bash
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

| Part | What it is |
|------|------------|
| `USERNAME` | Your Postgres login. On many Mac/Linux dev setups it matches your computer username (`whoami` in a terminal). Installers sometimes use `postgres` instead. |
| `PASSWORD` | If your server asks for a password, put it here after a colon. If **no password** (common for local `trust` auth), **omit** `:PASSWORD` entirely—go straight from username to `@`. |
| `HOST` | Almost always `localhost` when Postgres runs on the same PC. |
| `PORT` | Usually `5432` unless you changed Postgres’s port. |
| `DATABASE_NAME` | The empty database you created in step 2 (e.g. `finance_analyzer`). |

**Examples**

```bash
# You chose user postgres + password mysecret (e.g. Docker or Windows installer)
DATABASE_URL=postgresql://postgres:mysecret@localhost:5432/finance_analyzer

# No password, local user "alex" (typical some Homebrew / dev installs)
DATABASE_URL=postgresql://alex@localhost:5432/finance_analyzer
```

If your password contains special characters (`@`, `:`, `/`, `#`, space, etc.), you must **percent-encode** them in the URL (e.g. `@` → `%40`). Tools like “URL encode” in a search engine can help for the password segment only.

**Sanity check:** If you can connect with `psql`, use the same host, port, user, and database name in `DATABASE_URL`:

```bash
psql -h localhost -p 5432 -U YOUR_USER -d finance_analyzer
```

3. Save the file. **Never** share `.env.local` or commit it to git; it contains secrets.

### 4. Start the app

```bash
npm run dev
```

In your browser, open **http://localhost:3000**.

The first time the server starts with `DATABASE_URL` and `ENABLE_DB_WRITE=true`, it prepares the database tables automatically.

### 5. Upload statements

Go to **Upload**, select one or more supported **PDF** statements, and submit. The app parses text-based PDFs; scanned image-only PDFs are not supported.

After a successful upload, you can open **Dashboard** (months list) and drill into a month to see transactions, categories, and insights.

---

## Environment variables (summary)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (see [How to set `DATABASE_URL`](#how-to-set-database_url)). |
| `OPENAI_API_KEY` | For AI | Categorization and advisor insights. |
| `ENABLE_DB_WRITE` | For uploads | Set to `true` to allow saving transactions and schema init on startup. |

Do not commit real secrets; use `.env.local` (gitignored).

---

## Everyday use

- **Dashboard / months**: Pick a statement month to see detail.
- **Summary**: Higher-level views across your data (when configured).
- **Settings (rent & income)**: Defaults apply to months unless you override a specific month.
- **Language**: Use the EN / 中文 toggle in the navigation if available.

Keep the terminal window open while using `npm run dev`. To stop the server, press `Ctrl+C` in that terminal.

---

## Production build (local)

For a closer-to-production run (optimized build):

```bash
npm run build
npm start
```

Default port is `3000`, or set `PORT`. Still use `http://localhost:3000` (or the port shown in the terminal) unless you change `PORT`.

---

## Security notes

- **Local-only by design**: There is no built-in login. Anyone who can reach the app in a browser can use the API. Run on **localhost** (default for `npm run dev` / `next start`) and do not expose the process to untrusted networks.
- If you put the app on the public internet, add your own access control (reverse proxy, VPN, etc.); this repo does not ship authentication.
- Debug routes under `/api/debug/*` are for development; do not expose them on the internet.

---

## Privacy checklist

- Run the app on **your** computer and use **localhost** only. There is no login screen: anyone who can open the app URL in a browser can use it.
- If your Postgres user **has** a password (common with Docker images, cloud DBs, or explicit installs), use a **strong** one and remember that `DATABASE_URL` embeds it—treat `.env.local` as secret. Purely local “no password” setups are fine for personal use; the URL just omits the password segment.
- **Rotate** your OpenAI API key if it is ever exposed.
- Do **not** put `.env.local` in cloud drives or chat apps if those are shared.
- This build is intended for **personal local use**, not a public website. Putting it on the internet without extra protection would be unsafe.

---

## Troubleshooting

| Problem | What to try |
|--------|----------------|
| “Database” or connection errors on startup | Confirm Postgres is running and `DATABASE_URL` matches how **your** Postgres is set up: database name, user, host/port (often `localhost:5432`). **A password is not always required on a local install**—many setups use “trust” or “peer” auth on `localhost`, so the URL may look like `postgresql://YOUR_OS_USERNAME@localhost:5432/finance_analyzer` with no `:password` part. If your installer or Docker image assigned a password, include it in the URL. |
| Upload succeeds but nothing saves | Set `ENABLE_DB_WRITE=true` in `.env.local` and restart the server. |
| AI features fail or say missing key | Set `OPENAI_API_KEY` in `.env.local` and restart. Check your OpenAI account has access and billing if required. |
| “Scanned PDF not supported” | The PDF has no extractable text; use the issuer’s download that is text-based, or export from the issuer’s site in a supported format if available. |

---

## Health check

`GET /api/health` returns `{ ok: true, hasDb: ... }` without exposing secrets.

---

## Getting help

Problems that depend on your OS, Postgres install, or network are easiest to debug with the exact error message from the terminal or browser.

---

Built with [Next.js](https://nextjs.org). Features and supported banks may change.
