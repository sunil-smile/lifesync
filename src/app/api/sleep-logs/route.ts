import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function computeTotalHours(bedtime: Date, wakeTime: Date): number {
  const diffMs = wakeTime.getTime() - bedtime.getTime();
  return Math.round((diffMs / 3600000) * 10) / 10;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') ?? '30', 10);

  const where: Record<string, unknown> = { userId };

  if (startDate || endDate) {
    const loggedAtFilter: Record<string, Date> = {};
    if (startDate) loggedAtFilter.gte = new Date(startDate);
    if (endDate) loggedAtFilter.lte = new Date(endDate);
    where.loggedAt = loggedAtFilter;
  }

  const sleepLogs = await prisma.sleepLog.findMany({
    where,
    orderBy: { loggedAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ sleepLogs });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json();
  const { bedtime, wakeTime, qualityRating, notes, loggedAt } = body;

  if (!bedtime)
    return NextResponse.json({ error: 'bedtime is required' }, { status: 400 });
  if (!wakeTime)
    return NextResponse.json({ error: 'wakeTime is required' }, { status: 400 });
  if (
    typeof qualityRating !== 'number' ||
    qualityRating < 1 ||
    qualityRating > 5
  )
    return NextResponse.json(
      { error: 'qualityRating must be a number between 1 and 5' },
      { status: 400 },
    );

  const bedtimeDate = new Date(bedtime);
  const wakeTimeDate = new Date(wakeTime);

  if (isNaN(bedtimeDate.getTime()))
    return NextResponse.json({ error: 'bedtime is not a valid date' }, { status: 400 });
  if (isNaN(wakeTimeDate.getTime()))
    return NextResponse.json({ error: 'wakeTime is not a valid date' }, { status: 400 });
  if (wakeTimeDate <= bedtimeDate)
    return NextResponse.json({ error: 'wakeTime must be after bedtime' }, { status: 400 });

  const totalHours = computeTotalHours(bedtimeDate, wakeTimeDate);

  const sleepLog = await prisma.sleepLog.create({
    data: {
      userId,
      bedtime: bedtimeDate,
      wakeTime: wakeTimeDate,
      totalHours,
      qualityRating,
      notes: notes ?? null,
      loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
    },
  });

  const xpEarned = totalHours >= 7 ? 10 : 5;

  await prisma.$transaction([
    prisma.xpLog.create({
      data: { userId, action: 'sleep_logged', xpEarned },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: xpEarned } },
    }),
  ]);

  return NextResponse.json({ sleepLog }, { status: 201 });
}
