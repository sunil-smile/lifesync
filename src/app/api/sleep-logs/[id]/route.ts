import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

function computeTotalHours(bedtime: Date, wakeTime: Date): number {
  const diffMs = wakeTime.getTime() - bedtime.getTime();
  return Math.round((diffMs / 3600000) * 10) / 10;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const sleepLog = await prisma.sleepLog.findUnique({ where: { id: params.id } });
  if (!sleepLog || sleepLog.userId !== userId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ sleepLog });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const existing = await prisma.sleepLog.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.qualityRating !== undefined) {
    if (
      typeof body.qualityRating !== 'number' ||
      body.qualityRating < 1 ||
      body.qualityRating > 5
    )
      return NextResponse.json(
        { error: 'qualityRating must be a number between 1 and 5' },
        { status: 400 },
      );
    data.qualityRating = body.qualityRating;
  }

  if (body.notes !== undefined) data.notes = body.notes;
  if (body.loggedAt !== undefined) data.loggedAt = new Date(body.loggedAt);

  // Recompute totalHours if bedtime or wakeTime are being updated
  const newBedtime =
    body.bedtime !== undefined ? new Date(body.bedtime) : existing.bedtime;
  const newWakeTime =
    body.wakeTime !== undefined ? new Date(body.wakeTime) : existing.wakeTime;

  if (body.bedtime !== undefined || body.wakeTime !== undefined) {
    if (isNaN(newBedtime.getTime()))
      return NextResponse.json({ error: 'bedtime is not a valid date' }, { status: 400 });
    if (isNaN(newWakeTime.getTime()))
      return NextResponse.json({ error: 'wakeTime is not a valid date' }, { status: 400 });
    if (newWakeTime <= newBedtime)
      return NextResponse.json({ error: 'wakeTime must be after bedtime' }, { status: 400 });

    data.bedtime = newBedtime;
    data.wakeTime = newWakeTime;
    data.totalHours = computeTotalHours(newBedtime, newWakeTime);
  }

  const sleepLog = await prisma.sleepLog.update({ where: { id: params.id }, data });
  return NextResponse.json({ sleepLog });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const existing = await prisma.sleepLog.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.sleepLog.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
