import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskStatus } from '@prisma/client';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const task = await prisma.task.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { goal: { select: { id: true, title: true } } },
  });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const existing = await prisma.task.findFirst({ where: { id: params.id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const wasCompleted = existing.status !== TaskStatus.DONE && body.status === TaskStatus.DONE;

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.assignee !== undefined) data.assignee = body.assignee;
  if (body.goalId !== undefined) data.goalId = body.goalId || null;
  if (body.status !== undefined) data.status = body.status;

  const task = await prisma.task.update({
    where: { id: params.id }, data,
    include: { goal: { select: { id: true, title: true } } },
  });

  if (wasCompleted) {
    await prisma.$transaction([
      prisma.xpLog.create({ data: { userId, action: 'task_completed', xpEarned: 15 } }),
      prisma.user.update({ where: { id: userId }, data: { xp: { increment: 15 } } }),
    ]);
  }

  return NextResponse.json({ task });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.task.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
