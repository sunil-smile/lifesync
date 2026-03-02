import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];
const NAMES = ['Beginner','Starter','Consistent','Motivated','Committed','Determined','Consistent Achiever','High Performer','Life Champion','Master'];

function getLevelData(xp: number) {
  let idx = 0;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) { if (xp >= THRESHOLDS[i]) { idx = i; break; } }
  const level = idx + 1; const levelName = NAMES[idx];
  const nextXP = THRESHOLDS[idx + 1] ?? THRESHOLDS[idx];
  const range = (THRESHOLDS[idx + 1] ?? xp + 1) - THRESHOLDS[idx];
  const progressPct = idx === THRESHOLDS.length - 1 ? 100 : Math.round(((xp - THRESHOLDS[idx]) / range) * 100);
  return { xp, level, levelName, nextLevelXP: nextXP, progressPct };
}

function getGrade(score: number): string {
  if (score >= 95) return 'A+'; if (score >= 90) return 'A'; if (score >= 85) return 'A-';
  if (score >= 80) return 'B+'; if (score >= 75) return 'B'; if (score >= 70) return 'B-';
  if (score >= 65) return 'C+'; if (score >= 60) return 'C'; if (score >= 45) return 'D';
  return 'F';
}

function computeCurrentStreak(logs: { date: Date; completed: boolean }[]): number {
  const today = new Date(); today.setHours(0,0,0,0);
  let streak = 0; const d = new Date(today);
  for (let i = 0; i < 365; i++) {
    const t = d.getTime();
    const log = logs.find(l => { const ld = new Date(l.date); ld.setHours(0,0,0,0); return ld.getTime() === t; });
    if (log?.completed) { streak++; d.setDate(d.getDate() - 1); }
    else if (i === 0) { d.setDate(d.getDate() - 1); continue; }
    else break;
  }
  return streak;
}

function computeLongestStreak(logs: { date: Date; completed: boolean }[]): number {
  const sorted = [...logs].filter(l => l.completed).map(l => { const d = new Date(l.date); d.setHours(0,0,0,0); return d.getTime(); }).sort();
  let longest = 0, current = 0, last = 0;
  for (const t of sorted) {
    if (last && t - last === 86400000) current++; else current = 1;
    if (current > longest) longest = current; last = t;
  }
  return longest;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0,0,0,0);

  const [user, habits, allLogs, workoutsWeek, sleepWeek, tasksWeek, budgetCats, xpLogsWeek, quotes, otherUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true } }),
    prisma.habit.findMany({ where: { userId } }),
    prisma.habitLog.findMany({ where: { userId } }),
    prisma.workout.findMany({ where: { userId, loggedAt: { gte: weekStart } } }),
    prisma.sleepLog.findMany({ where: { userId, loggedAt: { gte: weekStart } } }),
    prisma.task.findMany({ where: { userId, createdAt: { gte: weekStart } } }),
    prisma.budgetCategory.findMany({ where: { userId, month: now.getMonth() + 1, year: now.getFullYear() } }),
    prisma.xpLog.findMany({ where: { userId, createdAt: { gte: weekStart } } }),
    prisma.quote.findMany({ take: 100 }),
    prisma.user.findFirst({ where: { id: { not: userId } }, select: { name: true, xp: true } }),
  ]);

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Streaks
  const streaks = habits.map(h => {
    const habitLogs = allLogs.filter(l => l.habitId === h.id);
    return { habitId: h.id, habitName: h.name, icon: h.icon, currentStreak: computeCurrentStreak(habitLogs), longestStreak: computeLongestStreak(habitLogs) };
  }).sort((a, b) => b.currentStreak - a.currentStreak);

  // Weekly report
  const habitScoreRaw = habits.length > 0 ? (allLogs.filter(l => l.completed && new Date(l.date) >= weekStart).length / (habits.length * 7)) * 100 : 100;
  const workoutScore = Math.min(100, workoutsWeek.length * 20);
  const sleepScore = sleepWeek.length > 0 ? (sleepWeek.reduce((s, l) => s + l.qualityRating, 0) / sleepWeek.length) * 20 : 50;
  const doneTasks = tasksWeek.filter(t => t.status === 'DONE').length;
  const taskScore = tasksWeek.length > 0 ? Math.round((doneTasks / tasksWeek.length) * 100) : 100;
  const budgetSpendPcts = await Promise.all(budgetCats.map(async cat => {
    const ms = new Date(now.getFullYear(), now.getMonth(), 1);
    const agg = await prisma.expense.aggregate({ where: { userId, category: cat.name, date: { gte: ms } }, _sum: { amount: true } });
    return cat.monthlyLimit > 0 ? ((agg._sum.amount ?? 0) / cat.monthlyLimit) * 100 : 0;
  }));
  const overBudget = budgetSpendPcts.filter(p => p > 100).length;
  const financeScore = budgetCats.length > 0 ? Math.max(0, 100 - overBudget * 20) : 100;

  const scores = { habits: Math.round(habitScoreRaw), workouts: Math.round(workoutScore), sleep: Math.round(sleepScore), finance: Math.round(financeScore), tasks: Math.round(taskScore) };
  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 5);
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  const partnerData = otherUser ? (() => { const d = getLevelData(otherUser.xp); return { name: otherUser.name, xp: otherUser.xp, level: d.level, levelName: d.levelName }; })() : null;
  const todayQuote = quotes.length > 0 ? quotes[Math.floor(Math.random() * quotes.length)] : { id: '0', text: 'Every day is a new opportunity to grow.', author: 'LifeSync', category: 'motivation', isFavorite: false };

  return NextResponse.json({
    streaks,
    xpData: getLevelData(user.xp),
    weeklyReport: {
      habits: { score: scores.habits, grade: getGrade(scores.habits), detail: `${allLogs.filter(l => l.completed && new Date(l.date) >= weekStart).length} completions` },
      workouts: { score: scores.workouts, grade: getGrade(scores.workouts), detail: `${workoutsWeek.length} sessions` },
      sleep: { score: scores.sleep, grade: getGrade(scores.sleep), detail: sleepWeek.length > 0 ? `Avg ${(sleepWeek.reduce((s, l) => s + l.totalHours, 0) / sleepWeek.length).toFixed(1)}h` : 'No data' },
      finance: { score: scores.finance, grade: getGrade(scores.finance), detail: `${overBudget} categories over budget` },
      tasks: { score: scores.tasks, grade: getGrade(scores.tasks), detail: `${doneTasks}/${tasksWeek.length} done` },
      overall: { score: overall, grade: getGrade(overall) },
      xpEarnedThisWeek: xpLogsWeek.reduce((s, l) => s + l.xpEarned, 0),
      winOfWeek: sortedScores[0][0],
      improveArea: sortedScores[sortedScores.length - 1][0],
    },
    partnerStats: partnerData,
    todayQuote,
  });
}
