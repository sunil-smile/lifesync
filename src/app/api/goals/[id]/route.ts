import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoalStatus } from '@prisma/client';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const goal = await prisma.goal.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      childGoals: { select: { id: true, title: true, type: true, status: true, progress: true } },
      milestones: true,
      tasks: { select: { id: true, title: true, status: true, priority: true } },
    },
  });
  if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ goal });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const existing = await prisma.goal.findFirst({ where: { id: params.id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const wasCompleted = existing.status !== GoalStatus.COMPLETED && body.status === GoalStatus.COMPLETED;

  const data: Record<string, unknown> = {};
  const fields = ['title','description','whyMotivation','type','category','assignee','progress',
    'progressType','targetValue','targetUnit','parentGoalId','status'] as const;
  for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
  if (body.targetDate !== undefined) data.targetDate = body.targetDate ? new Date(body.targetDate) : null;

  const goal = await prisma.goal.update({
    where: { id: params.id }, data,
    include: {
      childGoals: { select: { id: true, title: true, type: true, status: true, progress: true } },
      milestones: true,
      tasks: { select: { id: true, title: true, status: true, priority: true } },
    },
  });

  if (wasCompleted) {
    await prisma.$transaction([
      prisma.xpLog.create({ data: { userId, action: 'goal_completed', xpEarned: 100 } }),
      prisma.user.update({ where: { id: userId }, data: { xp: { increment: 100 } } }),
    ]);
  }

  return NextResponse.json({ goal });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.goal.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.goal.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
