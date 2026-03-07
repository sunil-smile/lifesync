import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const days = parseInt(url.searchParams.get('days') ?? '60', 10);

  try {
    let dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom || dateTo) {
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); dateFilter.lte = d; }
    } else {
      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);
      dateFilter = { gte: from };
    }

    const logs = await prisma.habitLog.findMany({
      where: { userId, date: dateFilter },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({
      logs: logs.map(l => ({
        id: l.id,
        habitId: l.habitId,
        date: l.date.toISOString().split('T')[0], // YYYY-MM-DD for easy string matching
        completed: l.completed,
      })),
    });
  } catch (error) {
    console.error('[GET /api/habit-logs]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json();
    const { habitId, date } = body;

    if (!habitId || !date) {
      return NextResponse.json(
        { error: 'habitId and date are required' },
        { status: 400 },
      );
    }

    // Verify the habit belongs to the user
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });

    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    // Parse the date (store as UTC midnight)
    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);

    // Look for existing log
    const existingLog = await prisma.habitLog.findFirst({
      where: {
        habitId,
        date: parsedDate,
      },
    });

    let log;
    let xpDelta = 0;

    if (existingLog) {
      // Toggle completed
      const newCompleted = !existingLog.completed;
      log = await prisma.habitLog.update({
        where: { id: existingLog.id },
        data: { completed: newCompleted },
      });
      xpDelta = newCompleted ? 10 : -10;
    } else {
      // Create new log as completed
      log = await prisma.habitLog.create({
        data: {
          habitId,
          userId,
          date: parsedDate,
          completed: true,
        },
      });
      xpDelta = 10;
    }

    // Update user XP, ensuring it never drops below 0
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true },
    });

    const currentXP = currentUser?.xp ?? 0;
    const newXP = Math.max(0, currentXP + xpDelta);
    const actualDelta = newXP - currentXP;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { xp: newXP },
    });

    if (actualDelta !== 0) {
      await prisma.xpLog.create({
        data: {
          userId,
          action: log.completed ? 'COMPLETE_HABIT' : 'UNCHECK_HABIT',
          xpEarned: actualDelta,
        },
      });
    }

    return NextResponse.json({ log, userXP: updatedUser.xp });
  } catch (error) {
    console.error('[POST /api/habit-logs]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
