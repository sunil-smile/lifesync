import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function computeWeekDots(
  logs: { date: Date; completed: boolean }[],
  today: Date,
): { date: string; completed: boolean; isToday: boolean }[] {
  const dots: { date: string; completed: boolean; isToday: boolean }[] = [];
  const todayStr = getDateString(today);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = getDateString(d);
    const log = logs.find((l) => getDateString(l.date) === dStr);
    dots.push({
      date: dStr,
      completed: log?.completed ?? false,
      isToday: dStr === todayStr,
    });
  }

  return dots;
}

function computeCurrentStreak(
  logs: { date: Date; completed: boolean }[],
  today: Date,
): number {
  let streak = 0;
  const cursor = new Date(today);

  while (true) {
    const dStr = getDateString(cursor);
    const log = logs.find((l) => getDateString(l.date) === dStr);
    if (log?.completed) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const habits = await prisma.habit.findMany({
      where: {},
      include: {
        logs: {
          where: {
            date: {
              gte: sevenDaysAgo,
              lte: today,
            },
          },
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const todayDate = new Date();
    const result = habits.map((habit) => {
      const weekDots = computeWeekDots(habit.logs, todayDate);
      const currentStreak = computeCurrentStreak(habit.logs, todayDate);

      return {
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        frequency: habit.frequency,
        targetDays: habit.targetDays,
        scheduledDays: habit.scheduledDays ?? [],
        createdAt: habit.createdAt,
        updatedAt: habit.updatedAt,
        weekDots,
        currentStreak,
      };
    });

    return NextResponse.json({ habits: result });
  } catch (error) {
    console.error('[GET /api/habits]', error);
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
    const { name, icon, color, frequency, targetDays, scheduledDays } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const habit = await prisma.habit.create({
      data: {
        userId,
        name,
        icon: icon ?? '✅',
        color: color ?? '#6366f1',
        frequency: frequency ?? 'DAILY',
        targetDays: typeof targetDays === 'number' ? targetDays : parseInt(targetDays ?? '1', 10) || 1,
        scheduledDays: Array.isArray(scheduledDays) ? scheduledDays : [],
      },
    });

    const XP_AMOUNT = 3;
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: XP_AMOUNT } },
    });
    await prisma.xpLog.create({
      data: { userId, action: 'CREATE_HABIT', xpEarned: XP_AMOUNT },
    });

    return NextResponse.json({ habit }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/habits]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
