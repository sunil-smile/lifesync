import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') ?? '30', 10);
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const logs = await prisma.screenTime.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: 'desc' },
  });

  // Compute weekly average (last 7 days that have data)
  const last7 = logs.slice(0, 7);
  const weekAvgTotal = last7.length > 0 ? last7.reduce((s, l) => s + l.totalHours, 0) / last7.length : null;
  const weekAvgProductive = last7.length > 0 ? last7.reduce((s, l) => s + l.productiveHours, 0) / last7.length : null;

  // Today's log
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = logs.find(l => l.date.toISOString().startsWith(todayStr)) ?? null;

  return NextResponse.json({ logs, weekAvgTotal, weekAvgProductive, todayLog });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { date, totalHours, productiveHours, notes } = body;

  if (!date || totalHours === undefined) return NextResponse.json({ error: 'date and totalHours are required' }, { status: 400 });

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  // Upsert — one entry per day per user
  const log = await prisma.screenTime.upsert({
    where: { userId_date: { userId, date: dayStart } },
    update: { totalHours: parseFloat(totalHours), productiveHours: parseFloat(productiveHours ?? 0), notes: notes ?? null },
    create: { userId, date: dayStart, totalHours: parseFloat(totalHours), productiveHours: parseFloat(productiveHours ?? 0), notes: notes ?? null },
  });

  return NextResponse.json({ log }, { status: 201 });
}
