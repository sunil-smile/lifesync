# LifeSync — Claude Context Guide

> This file is intended for Claude AI sessions to quickly understand the LifeSync application — its purpose, architecture, features, conventions, and development environment. Read this before making any code changes.

---

## 1. Project Overview

**LifeSync** is a personal life management dashboard built for a two-person household (Sunil & Vidhya). It centralises habits, finances, tasks, goals, investments, screen time, workouts, and motivational progress in one dark-themed web application.

- **Live URL (local):** http://localhost:3000
- **GitHub remote:** https://github.com/sunil-smile/lifesync.git (branch: `main`)
- **Root path:** `/Users/sunil/Desktop/App_CodeBase/lifesync_app`

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.5 (App Router) |
| Language | TypeScript |
| Auth | NextAuth 4.24.7 (CredentialsProvider + optional Google OAuth for Calendar) |
| ORM | Prisma 5 + PostgreSQL |
| Data fetching | TanStack React Query v5 (`useQuery`, `useMutation`, `useQueryClient`) |
| HTTP client | Axios |
| Charts | Recharts 2 |
| Icons | lucide-react |
| Excel parsing | xlsx 0.18 |
| Date utilities | date-fns 3 |
| Styling | Tailwind CSS (dark slate design system) |
| Utilities | clsx |

### Node / npm
- **Node binary path:** `/usr/local/opt/node@20/bin/`
- Always prefix CLI tools: `PATH=/usr/local/opt/node@20/bin:$PATH npx ...`
- TypeScript check: `npx tsc --noEmit`
- Dev server: `npm run dev` (port 3000)

---

## 3. Project Structure

```
src/
├── app/
│   ├── (auth)/               # Login / Register pages
│   ├── (dashboard)/          # All authenticated pages
│   │   ├── layout.tsx        # Sidebar + QueryClientProvider wrapper
│   │   ├── dashboard/        # Main dashboard overview
│   │   ├── finance/          # Finance page (expenses, income, budget, investments)
│   │   ├── tasks/            # Kanban task board
│   │   ├── goals/            # Goals with Gantt view & milestones
│   │   ├── activity/         # Habits, workouts, screen time
│   │   ├── motivation/       # XP, levels, quotes
│   │   ├── notes/            # Personal notes
│   │   ├── settings/         # User settings, password change
│   │   ├── investments/      # Investment portfolio
│   │   └── calendar/         # Google Calendar integration
│   └── api/                  # All Next.js API routes (see §6)
├── lib/
│   ├── auth.ts               # NextAuth authOptions
│   └── prisma.ts             # Prisma client singleton
└── components/               # Shared UI components (if any)
prisma/
└── schema.prisma             # Full DB schema (see §5)
```

---

## 4. Pages & Features

### 4.1 Dashboard (`/dashboard`)
Two tabs: **Weekly Overview** and **Daily Overview**. Greeting + XP card + Global Overdue Alert are always visible above the tabs.

#### Tab: Weekly Overview
- **Weekly Strip:** 7 colour-coded day cards (great/good/mixed/missed/today/future) with prev/next week navigation.
- **Day Drill-Down:** Click a day to expand. Shows missed habits (strikethrough, red), overdue tasks (red badge), and completed items.

#### Tab: Daily Overview
- **Today's Habit Progress Bar:** Inline bar showing X / N habits completed today.
- **DayDrillDown locked to today:** Full breakdown of today's habits (toggleable), tasks due, and screen time.
- **Screen Time Widget:** Today's total / productive / wasted hours + productivity %.
- **Finance Snapshot:** Month-to-date income, expenses, savings, top budget warnings.
- **Motivational Quote:** Latest quote from DB.
- **Recent XP Activity:** Last 5 XP events.

#### Always Visible
- **Global Overdue Alert Banner:** Shown if any tasks are overdue (past due date, not DONE).
- **Greeting + XP card:** User name, current level, XP progress bar.

**Habit toggle:** Uses `POST /api/habit-logs` (toggles completed state). Dashboard reads live log status from `GET /api/habit-logs?days=60`. After toggle, invalidate `['dashboard']`, `['habits']`, and `['habit-logs']` query caches.

### 4.2 Finance (`/finance`)
Three **parent tabs**:

#### YTD Overview
- **5-card banner:** Total YTD Income | Total YTD Expenses | Marked Savings | Net Balance | Savings Rate
- **3 Donut Pie Charts:** Expenses by Category | Income by Category | Savings Allocation
  - All dark-themed with custom `PieTip` tooltip (bg-slate-800, visible text)
  - `innerRadius={40}`, `outerRadius={100}`, no inline label, uses `<Legend>`

#### Monthly Overview
Sub-tabs: **Transactions** | **Income** | **Expenses** | **Budget** | **Savings**
- **Transactions tab:**
  - Column filters row (second `<tr>` in thead): dateFrom, dateTo, category, expenseType, txType (Credit/Debit), account (paidBy/receivedBy), amtMin, amtMax
  - PiggyBank icon on Debit rows → marks `expenseType = 'Savings'` via `PUT /api/expenses/[id]`
  - All columns sortable client-side
- **Income/Expenses tabs:** Similar table with column filters + mark-as-savings on expenses
- **Budget tab:** Monthly category limits, spend %, warning/danger colour bands
- **Savings tab:** Aggregated view of all transactions marked as Savings

#### Excel Upload
- Upload bank statement Excel files (Sunil / Vidhya)
- Parses xlsx, maps columns to Expense/Income schema
- Deduplication + import confirmation
- Upload history log

#### Global Account Filter
A filter bar **above all three parent tabs** with four buttons:
- **All Accounts** — no filter
- **👤 Sunil** — filters by `paidBy === 'sunil'` / `receivedBy === 'sunil'`
- **👤 Vidhya** — filters by `paidBy === 'vidhya'` / `receivedBy === 'vidhya'`
- **🤝 Shared** — filters by `paidBy === 'shared'` / `receivedBy === 'shared'`

The filter is applied at the data source via `useMemo` so all downstream charts, totals, and tables cascade automatically without extra code.

### 4.3 Tasks (`/tasks`)
Two views: **Board** and **Week**.

#### Board View
- 4 Kanban columns: **TODO | IN_PROGRESS | HOLD | DONE** (always all 4 shown)
- Quick status advance button (→) on each card; hover to reveal edit/advance/delete
- Overdue tasks highlighted in red

#### Week View
- 7-column grid for Mon–Sun of the selected week with prev/next navigation
- Overdue tasks (past due, not in current week, not DONE) shown in a red banner above the grid
- Tasks with no due date shown in a "No Due Date" section below the grid
- Click any task card to open the edit modal
- Each day column shows task count badge; today column highlighted in blue

#### Common
- Task fields: title, notes, dueDate, priority (HIGH/MEDIUM/LOW), assignee (sunil/vidhya), goalId (linked goal)
- TaskUpdate log: per-task comment/update history in the edit modal
- Filters: Priority, Assignee (no status filter — board always shows all 4 columns)
- No status filter tabs — removed to keep the UI clean

### 4.4 Goals (`/goals`)
- Goal hierarchy: LIFE → LONG_TERM → SHORT_TERM
- Fields: title, description, whyMotivation, type, category, targetDate, assignee, progress, progressType (PERCENTAGE / MILESTONE_BASED), targetValue/targetUnit, parentGoalId
- Gantt-style timeline view
- Milestones (sub-goals) within each goal
- Linked tasks shown per goal

### 4.5 Activity (`/activity`)
Three sub-sections:
- **Habits:** Create/edit habits with frequency (DAILY/WEEKLY/BIWEEKLY/MONTHLY/CUSTOM), icon, color, scheduledDays. Weekly dot view. Creating a habit gives +3 XP.
- **Workouts:** Log workouts (type, duration, distance, intensity, calories). Types: RUNNING/GYM/YOGA/CYCLING/SWIMMING/OTHER
- **Screen Time:** Daily log of total hours and productive hours. Weekly trend chart.

### 4.6 Investments (`/investments`)
- Portfolio tracker for India Stocks, India MF, US Stocks, Other
- Fields: name, ticker, platform, sector, fundType, units, buyPrice, currentPrice, investedAmount, currentValue, purchaseDate, currency, notes
- Sector allocation pie, overall return %
- Currency default: EUR

### 4.7 Motivation (`/motivation`)
- XP system: earn XP for completing habits (+10), creating habits (+3), etc.
- Level thresholds: [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000]
- Level names: Beginner → Starter → Consistent → Motivated → Committed → Determined → Consistent Achiever → High Performer → Life Champion → Master
- Daily motivational quotes (stored in DB)
- Recent XP activity log

### 4.8 Notes (`/notes`)
- Create/edit personal notes with tags and visibility (PERSONAL / SHARED)

### 4.9 Settings (`/settings`)
- Update name, email, avatar, bankName
- Change password (bcryptjs hashing)

### 4.10 Calendar (`/calendar`)
- Google Calendar integration (requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars)
- Shows upcoming events

---

## 5. Database Schema (Prisma + PostgreSQL)

**Key models:**

| Model | Purpose | Key fields |
|---|---|---|
| `User` | Auth + XP system | id, name, email, password, avatar, bankName, xp, level, levelName |
| `Habit` | Habit definitions | name, icon, color, frequency, targetDays, scheduledDays[], userId |
| `HabitLog` | Daily completion log | habitId, userId, date, completed — `@@unique([habitId, date])` |
| `Workout` | Exercise log | type, durationMinutes, distanceKm, intensityLevel, caloriesBurned, loggedAt |
| `SleepLog` | Sleep tracking | bedtime, wakeTime, totalHours, qualityRating |
| `ScreenTime` | Screen time daily | date, totalHours, productiveHours — `@@unique([userId, date])` |
| `Expense` | Spending records | amount, category, description, date, paidBy, bankAccount, isFixed, expenseType, notes |
| `Income` | Income records | amount, source, category, date, receivedBy, recurring, expenseType, notes |
| `BudgetCategory` | Monthly limits | name, monthlyLimit, alertAt (%), isYearly, month, year |
| `Investment` | Portfolio holdings | name, ticker, platform, sector, units, buyPrice, currentPrice, investedAmount, currentValue, currency |
| `Task` | Task management | title, notes, dueDate, priority, assignee, status, goalId |
| `TaskUpdate` | Task comments | taskId, text |
| `Goal` | Goal hierarchy | title, type, category, progress, progressType, targetDate, assignee, parentGoalId, status |
| `Milestone` | Goal sub-steps | goalId, title, completed, dueDate |
| `TimeEntry` | Time tracking | description, startTime, endTime, durationMinutes, category |
| `Note` | Notes | title, content, tags[], visibility |
| `XpLog` | XP history | userId, action, xpEarned |
| `Quote` | Motivational quotes | text, author, category, isFavorite |
| `BankUploadLog` | Upload history | accountType, uploadedAt, transactionCount, dateFrom, dateTo |
| `SavingsGoal` | Savings targets | name, targetAmount, startMonth/Year, endMonth/Year |

**Important DB conventions:**
- Use `prisma db push` (NOT `prisma migrate`) for schema changes
- ID format: `cuid()` for all models
- Cascade deletes on userId foreign keys
- `HabitLog.@@unique([habitId, date])` — prevents duplicate logs per day

### Account Users
- **Sunil** → expenses: `paidBy = 'sunil'`, income: `receivedBy = 'sunil'`
- **Vidhya** → expenses: `paidBy = 'vidhya'`, income: `receivedBy = 'vidhya'`
- **Shared** → `paidBy = 'shared'` / `receivedBy = 'shared'`
- Excel upload assigns `paidBy`/`receivedBy` based on which account file is uploaded

### Savings Tracking
- Expenses marked as savings use `expenseType = 'Savings'`
- No separate table — reuses `Expense.expenseType` field
- Toggle via `PUT /api/expenses/[id]` with `{ expenseType: 'Savings' }` or `{ expenseType: '' }`

---

## 6. API Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | POST | NextAuth (login, session, logout) |
| `/api/users` | GET, POST | User management |
| `/api/dashboard` | GET | Aggregated dashboard data (habits, finance, tasks, portfolio, screen time, quote) |
| `/api/habits` | GET, POST | List habits with weekDots + currentStreak; create habit |
| `/api/habits/[id]` | GET, PUT, DELETE | Single habit CRUD |
| `/api/habit-logs` | GET, POST | GET: fetch logs by date range; POST: toggle habit completion for a date |
| `/api/expenses` | GET, POST | List/create expenses |
| `/api/expenses/[id]` | GET, PUT, DELETE | Single expense CRUD (supports partial PUT) |
| `/api/income` | GET, POST | List/create income records |
| `/api/income/[id]` | GET, PUT, DELETE | Single income CRUD |
| `/api/budgets` | GET, POST, PUT, DELETE | Budget category management |
| `/api/bank-upload` | POST | Parse Excel, import transactions, log upload |
| `/api/investments` | GET, POST, PUT, DELETE | Portfolio CRUD |
| `/api/tasks` | GET, POST | List/create tasks |
| `/api/tasks/[id]` | GET, PUT, DELETE | Single task CRUD |
| `/api/goals` | GET, POST | Goals CRUD |
| `/api/goals/[id]` | GET, PUT, DELETE | Single goal CRUD |
| `/api/savings-goals` | GET, POST, PUT, DELETE | Savings goal targets |
| `/api/screen-time` | GET, POST, PUT | Screen time logging |
| `/api/workouts` | GET, POST, DELETE | Workout logging |
| `/api/sleep-logs` | GET, POST | Sleep tracking |
| `/api/notes` | GET, POST, PUT, DELETE | Notes CRUD |
| `/api/time-entries` | GET, POST, PUT, DELETE | Time tracking |
| `/api/quotes` | GET, POST | Motivational quotes |
| `/api/motivation` | GET | XP + level info + recent activity |
| `/api/export` | GET | Export data as JSON/CSV |

---

## 7. Key Code Patterns

### Authentication Check (all API routes)
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const userId = session.user.id;
```

### TanStack Query (client components)
```typescript
// Always use 'use client' directive
const { data, isLoading } = useQuery({
  queryKey: ['habits'],
  queryFn: () => axios.get('/api/habits').then(r => r.data),
});

const qc = useQueryClient();
const mutation = useMutation({
  mutationFn: (body) => axios.post('/api/endpoint', body),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
});
```

### Habit Toggle Pattern
```typescript
// POST to /api/habit-logs with { habitId, date } — server toggles completed state
// Always invalidate both ['habits'] and ['habit-logs'] after toggle
const toggleHabit = useMutation({
  mutationFn: ({ habitId }) => axios.post('/api/habit-logs', { habitId, date: new Date().toISOString() }),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['habits'] });
    qc.invalidateQueries({ queryKey: ['habit-logs'] });
  },
});
```

### Account Filter Pattern (Finance page)
```typescript
const [accountFilter, setAccountFilter] = useState<'' | 'sunil' | 'vidhya' | 'shared'>('');

// Filter at source — all downstream memos cascade automatically
const ytdExpenses = useMemo(() => {
  const data = ytdExpQ.data ?? [];
  return accountFilter ? data.filter(e => e.paidBy?.toLowerCase() === accountFilter) : data;
}, [ytdExpQ.data, accountFilter]);
```

### Recharts Dark Theme Pie Chart
```typescript
// Custom tooltip for visibility on dark backgrounds
const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-200 text-xs font-semibold">{payload[0].name}</p>
      <p className="text-slate-100 text-sm font-bold">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

// Donut style: innerRadius={40} outerRadius={100}, no label prop, use Legend
<PieChart>
  <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={100} cx="50%" cy="50%">
    {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
  </Pie>
  <Tooltip content={<PieTip />} />
  <Legend />
</PieChart>
```

### TypeScript Double-Cast
```typescript
// When sortBy() returns Record<string,unknown>[] but you need a typed array:
const sorted = sortBy(data, col, dir) as unknown as Income[];
```

### IIFE Pattern in JSX (tab rendering with local vars)
```typescript
{subTab === 'transactions' && (() => {
  const filtered = transactions.filter(...);
  return <table>...</table>;
})()}
```

---

## 8. Design System

All pages use a consistent dark slate theme:

| Element | Class |
|---|---|
| Page background | `bg-slate-900 min-h-screen text-slate-100` |
| Cards / panels | `bg-slate-800 rounded-xl border border-slate-700` |
| Secondary text | `text-slate-400` |
| Muted text | `text-slate-500` |
| Table header | `bg-slate-700/50 text-slate-400 text-xs uppercase` |
| Table row hover | `hover:bg-slate-700/30` |
| Input / select | `bg-slate-700 border-slate-600 text-slate-200` |
| Success / positive | `text-emerald-400` |
| Danger / negative | `text-red-400` |
| Warning | `text-amber-400` |
| Info / current | `text-blue-400` |
| Primary buttons | `bg-indigo-600 hover:bg-indigo-700` |

---

## 9. Environment Variables (`.env.local`)

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...          # Optional — for Calendar integration
GOOGLE_CLIENT_SECRET=...      # Optional — for Calendar integration
```

---

## 10. Common Development Commands

```bash
# Run dev server
PATH=/usr/local/opt/node@20/bin:$PATH npm run dev

# TypeScript check (zero tolerance — fix all errors)
PATH=/usr/local/opt/node@20/bin:$PATH npx tsc --noEmit

# Push schema changes to DB (never use migrate)
PATH=/usr/local/opt/node@20/bin:$PATH npx prisma db push

# Regenerate Prisma client after schema changes
PATH=/usr/local/opt/node@20/bin:$PATH npx prisma generate

# Open Prisma Studio (DB GUI)
PATH=/usr/local/opt/node@20/bin:$PATH npx prisma studio

# Git push
git push origin main
```

---

## 11. Important Gotchas

1. **Habit logs GET endpoint is critical** — `GET /api/habit-logs` must return logs for the dashboard and activity page to show correct completion states. If you see habits always appearing uncompleted, verify this endpoint exists and returns data.

2. **`prisma db push` not `migrate`** — The project uses `db push` for all schema changes (no migration files).

3. **`@@unique([habitId, date])` on HabitLog** — Only one log per habit per day. The POST endpoint toggles `completed` if a log exists, or creates one (completed=true) if not.

4. **Savings are tagged expenses** — There is no separate Savings model. Savings are `Expense` records with `expenseType = 'Savings'`. The `SavingsGoal` model stores targets/plans, not actual transactions.

5. **Account filter must be applied at source** — Filter `ytdExpenses` and `ytdIncome` via `useMemo` at the top level so all charts, totals, tables inherit the filter automatically. Don't filter at each consumption point.

6. **XP never goes below 0** — When unchecking a habit: `newXP = Math.max(0, currentXP - 10)`.

7. **TypeScript strict mode** — Use `as unknown as TargetType[]` when double-casting from generic types like `Record<string, unknown>[]`.

8. **Recharts tooltip on dark bg** — Never use inline `label` prop on Pie charts (renders on slices, unreadable). Always use custom `content={<YourTooltip />}` + `<Legend>` instead.

9. **No password input from Claude** — Claude should never enter passwords or sensitive credentials. User must input these directly.

10. **Two users:** Sunil (primary) and Vidhya (secondary). Expenses/income are tagged per user. The Finance page global filter lets you view either user's data or all combined.
