# Finance Analyzer

Run this on **your own computer**. Upload credit-card PDFs (Chase, Bank of America, Amex), see spending by month, and optionally use **your** OpenAI key for categories and insights. Your data stays on your machine.

This is **not** a one-click app from an app store. Follow the steps below in order. If a step fails, jump to [If something went wrong](#if-something-went-wrong).

---

## Step-by-step: first-time setup

Do these in order. Skip nothing unless the step says “optional.”

### Step 1 — Install Node.js (runs the app)

1. Open **[https://nodejs.org](https://nodejs.org)** in your browser.
2. Download the **LTS** version (recommended for most users).
3. Run the installer. Accept the defaults unless you know you need something different. Finish until it says the install is complete.
4. **Close and reopen** your terminal (Command Prompt, PowerShell, or Terminal on Mac), then check:

   ```bash
   node -v
   ```

   You should see a version number like `v20.x` or `v22.x`. If the command is “not found,” restart the computer and try again, or re-run the Node installer.

---

### Step 2 — Install PostgreSQL (stores your data)

PostgreSQL is a small database program. The app uses it to remember your transactions after you close the browser.

1. Open **[https://www.postgresql.org/download/](https://www.postgresql.org/download/)**.
2. Pick **your operating system** (Windows, macOS, etc.) and follow the link to an installer.
3. Run the installer:
   - **Windows:** Use the guided installer. When it asks for a **password** for the database superuser (often named `postgres`), **type a password you will remember and write it down**. You will need it in Step 7.
   - **Mac:** You can use the same download page or **[Postgres.app](https://postgresapp.com/)**. If an app asks you to start the server, start it once so it runs in the background.

4. Finish the installation. You do **not** need to open a special window every day—PostgreSQL just needs to be installed and the service running (installers usually turn it on automatically).

---

### Step 3 — Get this project on your computer

**Option A — Git (if you use Git)**  

```bash
git clone https://github.com/cicilywu08/finance-analyzer-v1.git
cd finance-analyzer-v1
```

**Option B — ZIP (no Git)**  

1. On GitHub, open this repository.
2. Click the green **Code** button → **Download ZIP**.
3. Unzip the folder somewhere easy to find, e.g. `Documents/finance-analyzer-v1`.
4. Remember that folder path—you need it in the next step.

---

### Step 4 — Open a terminal **inside** the project folder

The “terminal” is a text window where you type commands.

- **Windows:** Open **PowerShell** or **Command Prompt**. Go to the folder:

  ```bat
  cd C:\Users\YOUR_NAME\Documents\finance-analyzer-v1
  ```

  Replace the path with **your** real folder (you can copy the path from File Explorer’s address bar).

- **Mac:** Open **Terminal** (Spotlight: search “Terminal”). Type `cd ` (with a space), then **drag the project folder** into the window and press Enter. That pastes the path for you.

Check that you are in the right place:

```bash
dir
```

on Windows, or:

```bash
ls
```

on Mac. You should see files like `package.json` and a folder named `app`.

---

### Step 5 — Create an empty database

The app needs a **named empty database** (like an empty drawer) to store data.

**Mac / Linux (if `createdb` works):**

```bash
createdb finance_analyzer
```

If nothing prints, that usually means it worked.

**Windows (if `createdb` is not recognized):**

1. Open **SQL Shell (psql)** from the Start menu (installed with PostgreSQL).
2. Press Enter to accept default server, database, port, and username until it asks for **password** (use the password you set in Step 2).
3. Type exactly (then Enter):

   ```sql
   CREATE DATABASE finance_analyzer;
   ```

4. Type `\q` and Enter to quit.

You can use another database name, but then use **that** same name in Step 7 instead of `finance_analyzer`.

---

### Step 6 — Create your local config file

Still in the project folder in the terminal:

**Mac / Linux:**

```bash
cp .env.example .env.local
```

**Windows (PowerShell):**

```powershell
copy .env.example .env.local
```

This creates `.env.local`. Open it in **Notepad**, **TextEdit**, or any plain text editor (not Word).

---

### Step 7 — Tell the app how to connect to PostgreSQL (`DATABASE_URL`)

Add **one line** (or edit the empty one) so the app can talk to the database you created. This is **not** a website link you open in Chrome—it is **settings text** the app reads.

Use **one** of the patterns below and replace the parts in **ALL CAPS** with your real values.

**If Step 2 gave you user `postgres` and a password:**

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/finance_analyzer
```

- Replace `YOUR_PASSWORD_HERE` with the password you wrote down.  
- If your password has special characters like `@` or `:`, see [Password with special characters](#password-with-special-characters) below.

**If you are on Mac/Linux and your setup uses **no** database password** (common on some dev machines):

1. In the terminal, run `whoami` and note the name it prints (e.g. `alex`).
2. Use (replace `alex` with your name from `whoami`):

   ```bash
   DATABASE_URL=postgresql://alex@localhost:5432/finance_analyzer
   ```

**Parts in plain language (only what you need to edit):**

| Piece | What to put |
|--------|-------------|
| After the second `//` | Your Postgres **username** (often `postgres` on Windows, or your Mac login name) |
| After `:` and before `@` | Your **password**, if the installer required one—otherwise skip `:` and password entirely |
| `localhost` | Keep this if the database is on the same computer |
| `5432` | Keep unless you changed PostgreSQL’s port during install |
| `finance_analyzer` | The database name from Step 5 |

#### Password with special characters

If the password contains `@`, `:`, `/`, `#`, or spaces, you must **encode** them for the URL (e.g. `@` → `%40`). Search the web for “URL encode password” and encode **only** the password part, then paste that into the line above.

---

### Step 8 — Turn on saving and (optional) AI

In the same `.env.local` file:

1. Set:

   ```bash
   ENABLE_DB_WRITE=true
   ```

2. **Optional:** If you want AI categories and insights, add your OpenAI key from **[OpenAI API keys](https://platform.openai.com/api-keys)**:

   ```bash
   OPENAI_API_KEY=sk-...your-key...
   ```

Save `.env.local`. **Do not** upload this file to GitHub or share it—it contains secrets.

---

### Step 9 — Install the app’s dependencies

In the project folder:

```bash
npm install
```

Wait until it finishes (may take a few minutes the first time). If you see errors, copy the **full** message and check [If something went wrong](#if-something-went-wrong).

---

### Step 10 — Start the app

```bash
npm run dev
```

Leave this window open. When it says the server is ready, go to the next step.

---

### Step 11 — Use the app in your browser

1. Open your browser.
2. Go to: **[http://localhost:3000](http://localhost:3000)**
3. Click **Upload** in the navigation, choose your PDF statements, and upload.

The first successful start with `ENABLE_DB_WRITE=true` creates the needed tables in your database automatically.

**To stop the app:** click the terminal window and press **Ctrl+C** (Windows/Linux) or **Ctrl+C** (Mac).

---

## What this app does

- **Upload** PDF statements (text-based PDFs; scanned-only PDFs are not supported).
- **Browse** months, transactions, categories, and summaries.
- **Optional AI** (with `OPENAI_API_KEY`): categorization and advisor-style text via OpenAI’s API under their terms.

---

## Environment variables (quick reference)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Connects to your PostgreSQL database (set in Step 7). |
| `ENABLE_DB_WRITE` | Yes for uploads | Must be `true` to save data and create tables. |
| `OPENAI_API_KEY` | Optional | Needed for AI features. |

---

## Everyday use

- **Dashboard / months** — pick a month to see details.
- **Summary**, **FIRE**, **Rent & income** — optional views and settings.
- **EN / 中文** — language toggle in the nav.

Start the app anytime with `npm run dev` from the project folder.

---

## Production-style run (local)

```bash
npm run build
npm start
```

Default URL is still `http://localhost:3000` unless you change `PORT`.

---

## If something went wrong

| What you see | What to try |
|----------------|-------------|
| `node` or `npm` not found | Reinstall Node from [nodejs.org](https://nodejs.org), restart the terminal, try `node -v` again. |
| `createdb` not found (Mac/Linux) | PostgreSQL’s `bin` folder may not be on your PATH. Use the installer’s docs, or create the database with **SQL Shell / psql** like Step 5 (Windows). |
| Database connection errors | Check PostgreSQL is running. Re-read Step 7: username, password, and database name must match what you installed. Many local setups use **no** password—then your URL has **no** `:password` part. |
| Upload does nothing / no save | Ensure `ENABLE_DB_WRITE=true` in `.env.local` and restart `npm run dev`. |
| AI errors | Set `OPENAI_API_KEY` and restart; check billing/API access on OpenAI’s site. |
| Scanned PDF not supported | Download a **text-based** PDF from your bank’s website if possible. |

---

## Understanding what you installed (optional read)

- **GitHub** gave you **source code**, not a finished “.exe” product. **Node.js** runs that code. **PostgreSQL** holds your saved data. The **terminal** is where you run `npm install` and `npm run dev`.
- **`DATABASE_URL`** is one configuration line so the app knows **which database on this computer** to use. It is not something you “search Google for”—you build it from your Postgres username, password (if any), and the database name `finance_analyzer` (or whatever you chose).
- If all of this is still too much, ask someone technical for **one short session** with this README open—or use a local tech-support service. This repo does not include a double-click installer yet.

---

## Security & privacy (short)

- **No login.** Anyone who can open `http://localhost:3000` on **your** machine can use the app. Use **localhost** only; do not expose the app to the public internet without extra protection.
- Treat **`.env.local`** as private (it can hold passwords and API keys).
- **`/api/debug/*`** is for development—do not expose it on the internet.

---

## Health check

While the app is running, open **[http://localhost:3000/api/health](http://localhost:3000/api/health)** in your browser. You should see JSON like `{ ok: true, hasDb: ... }` (no secrets in the response).

---

Built with [Next.js](https://nextjs.org). Features and supported banks may change.
