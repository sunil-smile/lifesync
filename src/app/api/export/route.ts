import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [user, expenses, income, investments, habits, workouts, sleepLogs, tasks, goals] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.expense.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.income.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.investment.findMany({ where: { userId } }),
    prisma.habit.findMany({ where: { userId }, include: { logs: { where: { date: { gte: ninetyDaysAgo } }, orderBy: { date: 'desc' } } } }),
    prisma.workout.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' } }),
    prisma.sleepLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' } }),
    prisma.task.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId }, include: { milestones: true } }),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    user,
    expenses,
    income,
    investments,
    habits,
    workouts,
    sleepLogs,
    tasks,
    goals,
  });
}
