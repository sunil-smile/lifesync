import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthParam  = searchParams.get('month');
  const yearParam   = searchParams.get('year');
  const dateFrom    = searchParams.get('dateFrom');
  const dateTo      = searchParams.get('dateTo');
  const category    = searchParams.get('category');
  const paidBy      = searchParams.get('paidBy');
  const limit       = parseInt(searchParams.get('limit') ?? '500', 10);

  const where: Record<string, unknown> = {};

  if (dateFrom && dateTo) {
    where.date = { gte: new Date(dateFrom), lte: new Date(dateTo) };
  } else if (monthParam && yearParam) {
    const month = parseInt(monthParam, 10);
    const year  = parseInt(yearParam, 10);
    where.date  = { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
  }
  if (category) where.category = category;
  if (paidBy)   where.paidBy   = paidBy;

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
    take: limit,
  });

  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const body = await request.json();
  const { amount, category, description, date, paidBy, bankAccount, expenseType, notes } = body;

  if (typeof amount !== 'number' || amount <= 0)
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  if (!category?.trim())
    return NextResponse.json({ error: 'category is required' }, { status: 400 });
  if (!description?.trim())
    return NextResponse.json({ error: 'description is required' }, { status: 400 });

  const expense = await prisma.expense.create({
    data: {
      userId,
      amount,
      category:    category.trim(),
      description: description.trim(),
      date:        date ? new Date(date) : new Date(),
      paidBy:      paidBy      ?? 'sunil',
      bankAccount: bankAccount ?? null,
      expenseType: expenseType ?? null,
      isFixed:     (expenseType ?? '').toLowerCase() === 'fixed',
      notes:       notes ?? null,
    },
  });

  await prisma.$transaction([
    prisma.xpLog.create({ data: { userId, action: 'expense_logged', xpEarned: 5 } }),
    prisma.user.update({ where: { id: userId }, data: { xp: { increment: 5 } } }),
  ]);

  return NextResponse.json(expense, { status: 201 });
}
