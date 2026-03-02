/**
 * LifeSync Excel Export Script
 * Run: npm run export:excel
 *
 * Exports all data from PostgreSQL to an Excel workbook with multiple sheets.
 * Output: lifesync-export-YYYY-MM-DD.xlsx (in project root)
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function main() {
  console.log('📊 LifeSync Excel Export — Starting...');
  const wb = XLSX.utils.book_new();

  // ── 1. Users sheet ──────────────────────────────────────────────────────────
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, bankName: true, xp: true, level: true, levelName: true, createdAt: true } });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(users.map(u => ({
    Name: u.name, Email: u.email, Bank: u.bankName, XP: u.xp, Level: u.level, LevelName: u.levelName, Joined: formatDate(u.createdAt),
  }))), 'Users');

  // ── 2. Expenses sheet ───────────────────────────────────────────────────────
  const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses.map(e => ({
    Date: formatDate(e.date), Description: e.description, Category: e.category,
    Amount_EUR: e.amount, PaidBy: e.paidBy, BankAccount: e.bankAccount ?? '',
    Notes: e.notes ?? '',
  }))), 'Expenses');
  console.log(`   ✅ Expenses: ${expenses.length} rows`);

  // ── 3. Income sheet ─────────────────────────────────────────────────────────
  const income = await prisma.income.findMany({ orderBy: { date: 'desc' } });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(income.map(i => ({
    Date: formatDate(i.date), Source: i.source, Category: i.category,
    Amount_EUR: i.amount, ReceivedBy: i.receivedBy, Recurring: i.recurring ? 'Yes' : 'No',
  }))), 'Income');
  console.log(`   ✅ Income: ${income.length} rows`);

  // ── 4. Investments sheet ─────────────────────────────────────────────────────
  const investments = await prisma.investment.findMany();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(investments.map(inv => {
    const invested = inv.investedAmount ?? (inv.buyPrice && inv.units ? inv.buyPrice * inv.units : 0);
    const value = inv.currentValue ?? (inv.currentPrice && inv.units ? inv.currentPrice * inv.units : invested);
    const pl = value - invested;
    const plPct = invested > 0 ? ((pl / invested) * 100).toFixed(2) + '%' : 'N/A';
    return {
      Name: inv.name, Ticker: inv.ticker ?? '', Platform: inv.platform, Sector: inv.sector,
      Units: inv.units ?? '', BuyPrice: inv.buyPrice ?? '', CurrentPrice: inv.currentPrice ?? '',
      InvestedAmount: invested || '', CurrentValue: value || '', PnL: pl || '', PnL_Pct: plPct,
      Currency: inv.currency, PurchaseDate: formatDate(inv.purchaseDate),
    };
  })), 'Investments');
  console.log(`   ✅ Investments: ${investments.length} rows`);

  // ── 5. Habits sheet ──────────────────────────────────────────────────────────
  const habits = await prisma.habit.findMany({ include: { logs: { orderBy: { date: 'desc' }, take: 90 } } });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(habits.map(h => ({
    Name: h.name, Frequency: h.frequency, TargetDays: h.targetDays,
    LogsLast90Days: h.logs.length, CompletedLast90Days: h.logs.filter(l => l.completed).length,
  }))), 'Habits');
  console.log(`   ✅ Habits: ${habits.length} rows`);

  // ── 6. Workouts sheet ────────────────────────────────────────────────────────
  const workouts = await prisma.workout.findMany({ orderBy: { loggedAt: 'desc' } });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(workouts.map(w => ({
    Date: formatDate(w.loggedAt), Name: w.name, Type: w.type,
    Duration_min: w.durationMinutes, Distance_km: w.distanceKm ?? '',
    Intensity: w.intensityLevel, Calories: w.caloriesBurned ?? '',
  }))), 'Workouts');
  console.log(`   ✅ Workouts: ${workouts.length} rows`);

  // ── 7. Sleep sheet ───────────────────────────────────────────────────────────
  const sleepLogs = await prisma.sleepLog.findMany({ orderBy: { loggedAt: 'desc' } });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sleepLogs.map(s => ({
    Date: formatDate(s.loggedAt), Bedtime: formatDate(s.bedtime), WakeTime: formatDate(s.wakeTime),
    TotalHours: s.totalHours, QualityRating: s.qualityRating, Notes: s.notes ?? '',
  }))), 'Sleep');
  console.log(`   ✅ Sleep: ${sleepLogs.length} rows`);

  // ── 8. Tasks sheet ───────────────────────────────────────────────────────────
  const tasks = await prisma.task.findMany({ include: { goal: { select: { title: true } } } });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tasks.map(t => ({
    Title: t.title, Status: t.status, Priority: t.priority, Assignee: t.assignee,
    DueDate: formatDate(t.dueDate), LinkedGoal: t.goal?.title ?? '', Notes: t.notes ?? '',
  }))), 'Tasks');
  console.log(`   ✅ Tasks: ${tasks.length} rows`);

  // ── 9. Goals sheet ───────────────────────────────────────────────────────────
  const goals = await prisma.goal.findMany({ include: { milestones: true } });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goals.map(g => ({
    Title: g.title, Type: g.type, Category: g.category, Status: g.status,
    Progress: g.progress + '%', Assignee: g.assignee, TargetDate: formatDate(g.targetDate),
    Milestones: g.milestones.length, MilestonesComplete: g.milestones.filter(m => m.completed).length,
  }))), 'Goals');
  console.log(`   ✅ Goals: ${goals.length} rows`);

  // ── Save file ─────────────────────────────────────────────────────────────────
  const filename = `lifesync-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const outputPath = path.join(process.cwd(), filename);
  XLSX.writeFile(wb, outputPath);
  console.log(`\n✨ Excel export complete: ${filename}`);
  console.log(`   📁 Saved to: ${outputPath}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
