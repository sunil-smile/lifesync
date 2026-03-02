import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WorkoutType, IntensityLevel } from '@prisma/client';

const XP_BY_INTENSITY: Record<IntensityLevel, number> = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: 30,
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as WorkoutType | null;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);

  const where: Record<string, unknown> = { userId };

  if (type) where.type = type;

  if (startDate || endDate) {
    const loggedAtFilter: Record<string, Date> = {};
    if (startDate) loggedAtFilter.gte = new Date(startDate);
    if (endDate) loggedAtFilter.lte = new Date(endDate);
    where.loggedAt = loggedAtFilter;
  }

  const workouts = await prisma.workout.findMany({
    where,
    orderBy: { loggedAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ workouts });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json();
  const {
    name,
    type,
    durationMinutes,
    distanceKm,
    intensityLevel,
    caloriesBurned,
    notes,
    loggedAt,
  } = body;

  if (!name?.trim())
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!type || !Object.values(WorkoutType).includes(type as WorkoutType))
    return NextResponse.json({ error: 'type is required and must be a valid WorkoutType' }, { status: 400 });
  if (typeof durationMinutes !== 'number' || durationMinutes <= 0)
    return NextResponse.json({ error: 'durationMinutes must be a positive number' }, { status: 400 });
  if (!intensityLevel || !Object.values(IntensityLevel).includes(intensityLevel as IntensityLevel))
    return NextResponse.json({ error: 'intensityLevel is required and must be LOW, MEDIUM, or HIGH' }, { status: 400 });

  const workout = await prisma.workout.create({
    data: {
      userId,
      name: name.trim(),
      type: type as WorkoutType,
      durationMinutes,
      distanceKm: distanceKm ?? null,
      intensityLevel: intensityLevel as IntensityLevel,
      caloriesBurned: caloriesBurned ?? null,
      notes: notes ?? null,
      loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
    },
  });

  const xpEarned = XP_BY_INTENSITY[intensityLevel as IntensityLevel];

  await prisma.$transaction([
    prisma.xpLog.create({
      data: { userId, action: `workout_logged_${intensityLevel.toLowerCase()}`, xpEarned },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: xpEarned } },
    }),
  ]);

  return NextResponse.json({ workout }, { status: 201 });
}
