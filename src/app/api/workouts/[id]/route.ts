import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WorkoutType, IntensityLevel } from '@prisma/client';

interface RouteParams {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const workout = await prisma.workout.findUnique({ where: { id: params.id } });
  if (!workout || workout.userId !== userId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ workout });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const existing = await prisma.workout.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name.trim();
  if (body.type !== undefined) {
    if (!Object.values(WorkoutType).includes(body.type as WorkoutType))
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    data.type = body.type as WorkoutType;
  }
  if (body.durationMinutes !== undefined) data.durationMinutes = body.durationMinutes;
  if (body.distanceKm !== undefined) data.distanceKm = body.distanceKm;
  if (body.intensityLevel !== undefined) {
    if (!Object.values(IntensityLevel).includes(body.intensityLevel as IntensityLevel))
      return NextResponse.json({ error: 'Invalid intensityLevel' }, { status: 400 });
    data.intensityLevel = body.intensityLevel as IntensityLevel;
  }
  if (body.caloriesBurned !== undefined) data.caloriesBurned = body.caloriesBurned;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.loggedAt !== undefined) data.loggedAt = new Date(body.loggedAt);

  const workout = await prisma.workout.update({ where: { id: params.id }, data });
  return NextResponse.json({ workout });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const existing = await prisma.workout.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.workout.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
