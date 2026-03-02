import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entry = await prisma.timeEntry.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ timeEntry: entry });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.timeEntry.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.description !== undefined) data.description = body.description.trim();
  if (body.startTime !== undefined) data.startTime = new Date(body.startTime);
  if (body.endTime !== undefined) data.endTime = body.endTime ? new Date(body.endTime) : null;
  if (body.durationMinutes !== undefined) data.durationMinutes = body.durationMinutes;
  if (body.category !== undefined) data.category = body.category;

  // Recompute duration if times change but duration not explicitly provided
  if ((body.startTime !== undefined || body.endTime !== undefined) && body.durationMinutes === undefined) {
    const start = data.startTime ? (data.startTime as Date) : existing.startTime;
    const end = data.endTime !== undefined ? (data.endTime as Date | null) : existing.endTime;
    if (end) data.durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  }

  const timeEntry = await prisma.timeEntry.update({ where: { id: params.id }, data });
  return NextResponse.json({ timeEntry });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.timeEntry.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.timeEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
