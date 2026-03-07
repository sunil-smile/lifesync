import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const goals = await prisma.savingsGoal.findMany({
    where: {},
    orderBy: { createdAt: 'desc' },
  });

  // For each goal, compute actual savings during its period
  const enriched = await Promise.all(goals.map(async (goal) => {
    const startDate = new Date(goal.startYear, goal.startMonth - 1, 1);
    const endDate = new Date(goal.endYear, goal.endMonth, 1); // exclusive

    const incomeAgg = await prisma.income.aggregate({
      where: { date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
    });
    const expenseAgg = await prisma.expense.aggregate({
      where: { date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
    });

    const totalIncome = incomeAgg._sum.amount ?? 0;
    const totalExpense = expenseAgg._sum.amount ?? 0;
    const actualSavings = totalIncome - totalExpense;
    const percentage = goal.targetAmount > 0
      ? Math.round((actualSavings / goal.targetAmount) * 100)
      : 0;

    return { ...goal, actualSavings, percentage };
  }));

  return NextResponse.json({ goals: enriched });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { name, targetAmount, startMonth, startYear, endMonth, endYear, notes } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!targetAmount || targetAmount <= 0)
    return NextResponse.json({ error: 'targetAmount must be positive' }, { status: 400 });

  const goal = await prisma.savingsGoal.create({
    data: {
      userId,
      name: name.trim(),
      targetAmount,
      startMonth: startMonth ?? new Date().getMonth() + 1,
      startYear: startYear ?? new Date().getFullYear(),
      endMonth: endMonth ?? new Date().getMonth() + 1,
      endYear: endYear ?? new Date().getFullYear(),
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ goal }, { status: 201 });
}
