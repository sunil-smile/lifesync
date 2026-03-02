import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month');
  const yearParam = searchParams.get('year');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  const where: Record<string, unknown> = { userId };
  if (monthParam && yearParam) {
    const month = parseInt(monthParam, 10);
    const year = parseInt(yearParam, 10);
    where.date = { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
  }
  if (category) where.category = category;

  const incomes = await prisma.income.findMany({ where, orderBy: { date: 'desc' }, take: limit });
  return NextResponse.json(incomes);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { amount, source, category, date, receivedBy, recurring, notes } = body;

  if (typeof amount !== 'number' || amount <= 0)
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  if (!source?.trim()) return NextResponse.json({ error: 'source is required' }, { status: 400 });
  if (!category?.trim()) return NextResponse.json({ error: 'category is required' }, { status: 400 });
  if (!receivedBy?.trim()) return NextResponse.json({ error: 'receivedBy is required' }, { status: 400 });

  const income = await prisma.income.create({
    data: {
      userId, amount, source: source.trim(), category: category.trim(),
      date: date ? new Date(date) : new Date(),
      receivedBy: receivedBy.trim(),
      recurring: recurring ?? false,
      notes: notes ?? null,
    },
  });

  await prisma.$transaction([
    prisma.xpLog.create({ data: { userId, action: 'income_logged', xpEarned: 3 } }),
    prisma.user.update({ where: { id: userId }, data: { xp: { increment: 3 } } }),
  ]);

  return NextResponse.json(income, { status: 201 });
}
