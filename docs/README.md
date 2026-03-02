# LifeSync Dashboard 📊

A unified personal dashboard for **Sunil & Vidhya** — tracking habits, finance, investments, goals, and motivation, all in one place.

---

## ✨ Features

### 🏃 Activity Tracking
- **Habits** — daily/weekly habit tracker with streak system and week-dot visualization
- **Workouts** — log runs, gym, yoga, cycling, swimming with intensity and calorie tracking
- **Sleep** — bedtime/wake-time logger with quality rating and 7-day trend chart

### 💰 Finance Tracking
- **Expenses** — categorized expense logging (Food, Transport, Health, etc.)
- **Income** — salary, freelance, and recurring income tracking
- **Budget** — monthly budget categories with alert thresholds and progress bars
- **Bank Upload** — upload ABN AMRO (Sunil), ING (Vidhya), and Credit Card CSV/Excel files
  - Automatic 15-minute reminder to stay up-to-date

### 📈 Investment Portfolio
- **India Stocks** (NSE) and **Mutual Funds**
- **US Stocks** via BUX Netherlands
- Sector-wise allocation (Technology, Finance, Healthcare, Energy, Consumer, FMCG, Auto)
- P&L tracking per investment with overall portfolio return

### ✅ Productivity
- **Tasks** — Kanban board (TODO → IN_PROGRESS → DONE), priority levels, assignees
- **Goals** — Life → Long-term → Short-term → Milestone hierarchy
- **Notes** — Personal/shared notes with tags and full-text search

### 🎯 Motivation System
- **XP Points** — earn XP for every action (habits +10, workouts +10-30, tasks +15, goals +100)
- **10 Levels** — Beginner → Starter → Consistent → Motivated → Committed → Determined → Consistent Achiever → High Performer → Life Champion → Master
- **Weekly Report Card** — graded scores for Habits, Workouts, Sleep, Finance, and Tasks
- **Partner Comparison** — compare XP and streaks between Sunil and Vidhya

### 📅 Google Calendar
- OAuth 2.0 integration — connect Sunil's and Vidhya's Google Calendars
- View events on dashboard

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (Node.js) |
| Database | PostgreSQL 16 via Prisma ORM |
| Auth | NextAuth.js (credentials + Google OAuth) |
| Charts | Recharts |
| Excel Export | xlsx |
| State Management | TanStack React Query + Axios |

---

## 👥 Users

| User | Email |
|------|-------|
| Sunil | sunil@lifesync.app |
| Vidhya | vidhya@lifesync.app |

---

## 📦 Project Structure

```
lifesync_app/
├── src/
│   ├── app/
│   │   ├── (auth)/login/        # Login page
│   │   ├── (dashboard)/         # All dashboard pages
│   │   │   ├── dashboard/       # Main overview
│   │   │   ├── activity/        # Habits, Workouts, Sleep
│   │   │   ├── finance/         # Expenses, Income, Budget, Bank Upload
│   │   │   ├── investments/     # Portfolio, India, US Stocks
│   │   │   ├── tasks/           # Kanban task board
│   │   │   ├── goals/           # Goal hierarchy tree
│   │   │   ├── notes/           # Note editor
│   │   │   ├── motivation/      # XP, streaks, report card
│   │   │   └── settings/        # Profile, preferences, data export
│   │   └── api/                 # All REST API routes
│   ├── components/
│   │   ├── layout/              # Sidebar, Header, MobileNav
│   │   └── ui/                  # Card, Modal, Badge, ProgressBar, etc.
│   ├── lib/                     # prisma.ts, auth.ts, utils.ts
│   └── types/                   # TypeScript type definitions
├── prisma/
│   ├── schema.prisma            # Database schema (16 models)
│   └── seed.ts                  # Sample data for Sunil & Vidhya
├── scripts/
│   └── export-to-excel.ts       # Export all data to .xlsx
├── docs/
│   ├── README.md                # This file
│   └── RUNBOOK.md               # How to start/stop/maintain
└── .env                         # Environment variables
```

---

## 🗄️ Database Schema

16 Prisma models:
`User`, `Habit`, `HabitLog`, `Workout`, `SleepLog`, `Expense`, `Income`, `BudgetCategory`, `Investment`, `Task`, `Goal`, `Milestone`, `TimeEntry`, `Note`, `XpLog`, `Quote`, `BankUploadLog`

---

## 📊 XP System

| Action | XP Earned |
|--------|-----------|
| Habit logged | +10 |
| Workout (LOW intensity) | +10 |
| Workout (MEDIUM intensity) | +20 |
| Workout (HIGH intensity) | +30 |
| Sleep logged (≥7h) | +10 |
| Sleep logged (<7h) | +5 |
| Expense logged | +5 |
| Income logged | +3 |
| Investment added | +5 |
| Task created | +5 |
| Task completed | +15 |
| Goal created | +20 |
| Goal completed | +100 |
| Milestone completed | +25 |

---

## 🔌 Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Calendar API**
4. Go to **Credentials** → **Create OAuth 2.0 Client ID**
5. Application type: **Web Application**
6. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Client Secret to your `.env`:
   ```
   GOOGLE_CLIENT_ID="your-client-id"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```
8. Restart the app (`npm run dev`)
9. Go to Settings → Preferences → Google Calendar → Connect

---

## 💳 Bank Upload Format

The app accepts CSV files exported from:
- **ABN AMRO** — standard export (Date, Description, Amount columns)
- **ING** — standard export format
- **Credit Card** — any CSV with date, description, amount

Columns parsed: `date` (col 0), `description` (col 1), `amount` (col 3).
