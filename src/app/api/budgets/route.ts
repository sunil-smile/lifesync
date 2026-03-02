import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getBudgetStatus(pct: number, alertAt: number): 'good' | 'warning' | 'danger' {
  if (pct >= 100) return 'danger';
  if (pct >= alertAt) return 'warning';
  return 'good';
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10);
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10);
  const dateFrom = new Date(year, month - 1, 1);
  const dateTo = new Date(year, month, 1);

  const categories = await prisma.budgetCategory.findMany({ where: { userId, month, year } });

  const enriched = await Promise.all(categories.map(async (cat) => {
    const agg = await prisma.expense.aggregate({
      where: { userId, category: cat.name, date: { gte: dateFrom, lt: dateTo } },
      _sum: { amount: true },
    });
    const spent = agg._sum.amount ?? 0;
    const percentage = cat.monthlyLimit > 0 ? Math.round((spent / cat.monthlyLimit) * 100) : 0;
    return { ...cat, spent, percentage, status: getBudgetStatus(percentage, cat.alertAt) };
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { name, icon, monthlyLimit, alertAt, month, year } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (typeof monthlyLimit !== 'number' || monthlyLimit <= 0)
    return NextResponse.json({ error: 'monthlyLimit must be positive' }, { status: 400 });
  if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 });

  const budget = await prisma.budgetCategory.create({
    data: { userId, name: name.trim(), icon: icon ?? null, monthlyLimit, alertAt: alertAt ?? 80, month, year },
  });
  return NextResponse.json(budget, { status: 201 });
}
