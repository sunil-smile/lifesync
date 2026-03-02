# LifeSync — Runbook 📋

Operations guide for starting, stopping, and maintaining the LifeSync Dashboard.

---

## Prerequisites

Ensure these are installed on your Mac:

| Tool | Version | Check |
|------|---------|-------|
| Node.js | v20+ | `node --version` |
| npm | v10+ | `npm --version` |
| PostgreSQL | v16 | `psql --version` |
| Git | Any | `git --version` |

> **Homebrew paths:** All tools are installed via Homebrew at `/usr/local/opt/`. If commands aren't found, prefix with:
> ```bash
> export PATH="/usr/local/opt/node@20/bin:/usr/local/opt/postgresql@16/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
> ```

---

## 🚀 First-Time Setup (one time only)

```bash
# 1. Navigate to the app folder
cd ~/Desktop/App_CodeBase/lifesync_app

# 2. Set PATH (required for Homebrew installs)
export PATH="/usr/local/opt/node@20/bin:/usr/local/opt/postgresql@16/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# 3. Install dependencies
npm install

# 4. Start PostgreSQL (if not already running)
brew services start postgresql@16

# 5. Run database migrations (creates all tables)
npx prisma migrate dev --name init

# 6. Seed the database (creates Sunil & Vidhya accounts + sample data)
npm run db:seed

# 7. Start the development server
npm run dev
```

Then open: **http://localhost:3000**

---

## 🟢 Start the App

### Option A: Development mode (with hot reload)
```bash
cd ~/Desktop/App_CodeBase/lifesync_app
export PATH="/usr/local/opt/node@20/bin:/usr/local/opt/postgresql@16/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Ensure PostgreSQL is running
brew services start postgresql@16

# Start Next.js
npm run dev
```

Visit: http://localhost:3000

### Option B: Production mode
```bash
cd ~/Desktop/App_CodeBase/lifesync_app
export PATH="/usr/local/opt/node@20/bin:/usr/local/opt/postgresql@16/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

npm run build
npm run start
```

### Option C: Claude Code Preview (recommended)
From Claude Code, select:
- **"LifeSync — Next.js Dev Server"** for development
- **"LifeSync — Next.js Production Server"** for production

---

## 🔴 Stop the App

Press `Ctrl + C` in the terminal running the server.

To also stop PostgreSQL:
```bash
brew services stop postgresql@16
```

---

## 🔑 Login Credentials

| User | Email | Password |
|------|-------|----------|
| Sunil | sunil@lifesync.app | `sunil123` |
| Vidhya | vidhya@lifesync.app | `vidhya123` |

---

## 🗄️ Database Operations

### Connect to database
```bash
export PATH="/usr/local/opt/postgresql@16/bin:$PATH"
PGPASSWORD=lifesync_pass_3 psql -h localhost -U lifesync_user -d lifesync_db
```

### Open Prisma Studio (visual DB browser)
```bash
cd ~/Desktop/App_CodeBase/lifesync_app
export PATH="/usr/local/opt/node@20/bin:$PATH"
npx prisma studio
# Opens at http://localhost:5555
```

### Reset database (⚠️ deletes all data)
```bash
npm run db:reset
```

### Re-seed with sample data
```bash
npm run db:seed
```

### Create new migration (after schema change)
```bash
npx prisma migrate dev --name your_migration_name
```

---

## 📊 Export Data to Excel

```bash
cd ~/Desktop/App_CodeBase/lifesync_app
export PATH="/usr/local/opt/node@20/bin:$PATH"
npm run export:excel
```

Creates: `lifesync-export-YYYY-MM-DD.xlsx` in the project root with sheets:
Users, Expenses, Income, Investments, Habits, Workouts, Sleep, Tasks, Goals.

---

## 🔄 Update the App

```bash
cd ~/Desktop/App_CodeBase/lifesync_app
git pull origin main
export PATH="/usr/local/opt/node@20/bin:$PATH"
npm install
npx prisma migrate dev
npm run dev
```

---

## 🔌 Google Calendar Setup

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable **Google Calendar API**
3. Credentials → OAuth 2.0 → Web Application
4. Redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
   ```
6. Restart app → Settings → Preferences → Google Calendar → Connect

---

## 🏦 Bank Transaction Upload

### Manual upload (in app)
1. Go to **Finance → Expenses**
2. Scroll to **Bank Upload** section
3. Click **"Upload CSV/Excel"** for ABN AMRO, ING, or Credit Card
4. Select your exported bank file

### CSV format accepted
```
Date,Description,Category,Amount
2026-02-15,Albert Heijn,Food,-45.50
2026-02-16,NS Treinkaart,Transport,-89.00
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `command not found: node` | Run `export PATH="/usr/local/opt/node@20/bin:$PATH"` |
| `command not found: psql` | Run `export PATH="/usr/local/opt/postgresql@16/bin:$PATH"` |
| `ECONNREFUSED` (DB error) | Run `brew services start postgresql@16` |
| Port 3000 already in use | `lsof -ti:3000 | xargs kill -9` |
| Prisma schema errors | `npx prisma generate` |
| Build errors | `rm -rf .next && npm run build` |
| Module not found | `rm -rf node_modules && npm install` |

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `.env` | Database URL, NextAuth secrets, Google OAuth |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Sample data for Sunil & Vidhya |
| `scripts/export-to-excel.ts` | Excel export script |
| `src/lib/auth.ts` | Authentication config (credentials + Google) |
| `src/lib/prisma.ts` | Prisma client singleton |
| `docs/README.md` | Application overview |
| `docs/RUNBOOK.md` | This file |
