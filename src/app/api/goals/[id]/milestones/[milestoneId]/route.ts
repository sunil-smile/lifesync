import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string; milestoneId: string } }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const goal = await prisma.goal.findFirst({ where: { id: params.id, userId } });
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  const existing = await prisma.milestone.findFirst({ where: { id: params.milestoneId, goalId: params.id } });
  if (!existing) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });

  const body = await request.json();
  const wasJustCompleted = !existing.completed && body.completed === true;

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.completed !== undefined) data.completed = body.completed;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const milestone = await prisma.milestone.update({ where: { id: params.milestoneId }, data });

  if (wasJustCompleted) {
    await prisma.$transaction([
      prisma.xpLog.create({ data: { userId, action: 'milestone_completed', xpEarned: 25 } }),
      prisma.user.update({ where: { id: userId }, data: { xp: { increment: 25 } } }),
    ]);
  }

  return NextResponse.json({ milestone });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const goal = await prisma.goal.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  const existing = await prisma.milestone.findFirst({ where: { id: params.milestoneId, goalId: params.id } });
  if (!existing) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
  await prisma.milestone.delete({ where: { id: params.milestoneId } });
  return NextResponse.json({ success: true });
}
