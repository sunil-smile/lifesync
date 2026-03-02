import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];
const LEVEL_NAMES = ['Beginner','Starter','Consistent','Motivated','Committed','Determined','Consistent Achiever','High Performer','Life Champion','Master'];
const SECTOR_COLORS: Record<string, string> = { Technology: '#3B82F6', Finance: '#10B981', Healthcare: '#8B5CF6', Energy: '#F59E0B', Consumer: '#EF4444', FMCG: '#06B6D4', Auto: '#F97316', Other: '#94A3B8' };

function getLevelInfo(xp: number) {
  let level = 1, levelName = LEVEL_NAMES[0];
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) { level = i + 1; levelName = LEVEL_NAMES[i]; break; }
  }
  return { level, levelName };
}

function computeStreak(logs: { date: Date; completed: boolean }[]): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let streak = 0;
  const checkDate = new Date(today);
  for (let i = 0; i < 30; i++) {
    const checkTime = checkDate.getTime();
    const log = logs.find(l => { const d = new Date(l.date); d.setHours(0,0,0,0); return d.getTime() === checkTime; });
    if (log && log.completed) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
    else if (i === 0) { checkDate.setDate(checkDate.getDate() - 1); continue; }
    else break;
  }
  return streak;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const [user, habits, allHabitLogs, expenseAgg, incomeAgg, budgetCategories, upcomingTasks, investments, recentActivity, randomQuote] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, avatar: true, bankName: true, xp: true } }),
    prisma.habit.findMany({ where: { userId } }),
    prisma.habitLog.findMany({ where: { userId, date: { gte: todayStart, lte: todayEnd } } }),
    prisma.expense.aggregate({ where: { userId, date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
    prisma.income.aggregate({ where: { userId, date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
    prisma.budgetCategory.findMany({ where: { userId, month, year } }),
    prisma.task.findMany({ where: { userId, status: { not: 'DONE' } }, orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }], take: 5 }),
    prisma.investment.findMany({ where: { userId } }),
    prisma.xpLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.quote.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { level, levelName } = getLevelInfo(user.xp);

  // Today's habits
  const habitsWithToday = habits.map(h => {
    const log = allHabitLogs.find(l => l.habitId === h.id);
    return { ...h, todayCompleted: log?.completed ?? false };
  });
  const completedCount = habitsWithToday.filter(h => h.todayCompleted).length;

  // Finance
  const currentMonthExpenses = expenseAgg._sum.amount ?? 0;
  const currentMonthIncome = incomeAgg._sum.amount ?? 0;
  const savings = currentMonthIncome - currentMonthExpenses;
  const savingsRate = currentMonthIncome > 0 ? Math.round((savings / currentMonthIncome) * 100) : 0;

  const budgetWarnings = await Promise.all(budgetCategories.map(async cat => {
    const agg = await prisma.expense.aggregate({ where: { userId, category: cat.name, date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } });
    const spent = agg._sum.amount ?? 0;
    const pct = cat.monthlyLimit > 0 ? Math.round((spent / cat.monthlyLimit) * 100) : 0;
    return { ...cat, spent, percentage: pct, status: pct >= 100 ? 'danger' : pct >= cat.alertAt ? 'warning' : 'good' };
  }));
  const topBudgetWarnings = budgetWarnings.filter(b => b.status !== 'good').slice(0, 3);

  // Portfolio
  let totalInvested = 0, totalValue = 0;
  const sectorMap: Record<string, number> = {};
  for (const inv of investments) {
    const invested = inv.investedAmount ?? (inv.buyPrice && inv.units ? inv.buyPrice * inv.units : 0);
    const value = inv.currentValue ?? (inv.currentPrice && inv.units ? inv.currentPrice * inv.units : invested);
    totalInvested += invested; totalValue += value;
    sectorMap[inv.sector] = (sectorMap[inv.sector] ?? 0) + value;
  }
  const allocationBySector = Object.entries(sectorMap).map(([name, value]) => ({
    name, value: Math.round(value * 100) / 100,
    pct: totalValue > 0 ? Math.round((value / totalValue) * 100) : 0,
    color: SECTOR_COLORS[name] ?? '#94A3B8',
  }));

  return NextResponse.json({
    user: { ...user, level, levelName },
    todayHabits: { habits: habitsWithToday, completedCount, totalCount: habits.length },
    financeSnapshot: { currentMonthIncome, currentMonthExpenses, savings, savingsRate, topBudgetWarnings },
    upcomingTasks,
    motivationSummary: { xp: user.xp, level, levelName, todayQuote: randomQuote },
    portfolioSummary: { totalValue: Math.round(totalValue * 100) / 100, totalInvested: Math.round(totalInvested * 100) / 100, overallReturnPct: totalInvested > 0 ? Math.round(((totalValue - totalInvested) / totalInvested) * 10000) / 100 : 0, allocationBySector },
    recentActivity,
  });
}
