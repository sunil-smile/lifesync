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
  const dateTo   = new Date(year, month, 1);
  const yearFrom = new Date(year, 0, 1);
  const yearTo   = new Date(year + 1, 0, 1);

  // Monthly budgets: month > 0 AND NOT isYearly
  const monthlyCategories = await prisma.budgetCategory.findMany({
    where: { userId, year, month, isYearly: false },
  });

  // Yearly budgets: isYearly = true for this year (month=0 convention)
  const yearlyCategories = await prisma.budgetCategory.findMany({
    where: { userId, year, isYearly: true },
  });

  // Enrich monthly budgets with this-month spend
  const enrichedMonthly = await Promise.all(monthlyCategories.map(async (cat) => {
    const agg = await prisma.expense.aggregate({
      where: { category: cat.name, date: { gte: dateFrom, lt: dateTo } },
      _sum: { amount: true },
    });
    const spent = agg._sum.amount ?? 0;
    const limit = cat.monthlyLimit;
    const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    return { ...cat, spent, percentage, status: getBudgetStatus(percentage, cat.alertAt) };
  }));

  // Enrich yearly budgets with full-year spend
  const enrichedYearly = await Promise.all(yearlyCategories.map(async (cat) => {
    const agg = await prisma.expense.aggregate({
      where: { category: cat.name, date: { gte: yearFrom, lt: yearTo } },
      _sum: { amount: true },
    });
    const spent = agg._sum.amount ?? 0;
    const limit = cat.monthlyLimit; // field reused as "yearlyLimit" for isYearly records
    const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    return { ...cat, spent, percentage, status: getBudgetStatus(percentage, cat.alertAt) };
  }));

  return NextResponse.json({ monthly: enrichedMonthly, yearly: enrichedYearly });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { name, icon, monthlyLimit, alertAt, month, year, isYearly } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (typeof monthlyLimit !== 'number' || monthlyLimit <= 0)
    return NextResponse.json({ error: 'monthlyLimit must be positive' }, { status: 400 });
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });

  const isYearlyBool = Boolean(isYearly);
  // For yearly budgets, store month=0 as sentinel
  const effectiveMonth = isYearlyBool ? 0 : (month ?? new Date().getMonth() + 1);

  const budget = await prisma.budgetCategory.create({
    data: {
      userId,
      name: name.trim(),
      icon: icon ?? null,
      monthlyLimit,
      alertAt: alertAt ?? 80,
      month: effectiveMonth,
      year,
      isYearly: isYearlyBool,
    },
  });
  return NextResponse.json(budget, { status: 201 });
}
