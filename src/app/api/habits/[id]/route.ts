import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
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

function computeLongestStreak(logs: { date: Date; completed: boolean }[]): number {
  const sorted = [...logs]
    .filter((l) => l.completed)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = getDateString(sorted[i - 1].date);
    const curr = getDateString(sorted[i].date);
    const diffMs = new Date(curr).getTime() - new Date(prev).getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }

  return longest;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const habit = await prisma.habit.findFirst({
      where: { id: params.id, userId },
      include: {
        logs: {
          where: {
            date: {
              gte: thirtyDaysAgo,
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    const currentStreak = computeCurrentStreak(habit.logs, today);
    const longestStreak = computeLongestStreak(habit.logs);
    const totalCompleted = habit.logs.filter((l) => l.completed).length;
    const completionRate =
      habit.logs.length > 0
        ? Math.round((totalCompleted / habit.logs.length) * 100)
        : 0;

    return NextResponse.json({
      habit: {
        ...habit,
        streakStats: {
          currentStreak,
          longestStreak,
          totalCompleted,
          completionRate,
          totalDaysTracked: habit.logs.length,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/habits/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const existing = await prisma.habit.findFirst({
      where: { id: params.id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, icon, color, frequency, targetDays, scheduledDays } = body;

    const updated = await prisma.habit.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(frequency !== undefined && { frequency }),
        ...(targetDays !== undefined && { targetDays: typeof targetDays === 'number' ? targetDays : parseInt(targetDays, 10) || 1 }),
        ...(scheduledDays !== undefined && { scheduledDays: Array.isArray(scheduledDays) ? scheduledDays : [] }),
      },
    });

    return NextResponse.json({ habit: updated });
  } catch (error) {
    console.error('[PATCH /api/habits/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const existing = await prisma.habit.findFirst({
      where: { id: params.id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    // Delete logs first (cascade may handle this but being explicit)
    await prisma.habitLog.deleteMany({
      where: { habitId: params.id },
    });

    await prisma.habit.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/habits/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
