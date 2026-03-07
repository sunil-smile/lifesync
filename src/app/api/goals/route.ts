import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoalType, GoalStatus, ProgressType } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as GoalType | null;
  const status = searchParams.get('status') as GoalStatus | null;
  const assignee = searchParams.get('assignee');
  const parentGoalIdParam = searchParams.get('parentGoalId');

  const where: Record<string, unknown> = {}; // Show all household data
  if (type) where.type = type;
  if (status) where.status = status;
  if (assignee) where.assignee = assignee;
  if (parentGoalIdParam === 'null') where.parentGoalId = null;
  else if (parentGoalIdParam) where.parentGoalId = parentGoalIdParam;

  const goals = await prisma.goal.findMany({
    where,
    include: {
      childGoals: { select: { id: true, title: true, type: true, status: true, progress: true } },
      milestones: true,
      tasks: { select: { id: true, title: true, status: true, priority: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ goals });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { title, description, whyMotivation, type, category, targetDate, assignee,
          progress, progressType, targetValue, targetUnit, parentGoalId } = body;

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!type) return NextResponse.json({ error: 'Type is required' }, { status: 400 });
  if (!category?.trim()) return NextResponse.json({ error: 'Category is required' }, { status: 400 });

  const goal = await prisma.goal.create({
    data: {
      userId, title: title.trim(), description: description ?? null,
      whyMotivation: whyMotivation ?? null, type: type as GoalType,
      category: category.trim(), targetDate: targetDate ? new Date(targetDate) : null,
      assignee: assignee ?? 'sunil', progress: progress ?? 0,
      progressType: progressType ?? ProgressType.PERCENTAGE,
      targetValue: targetValue ?? null, targetUnit: targetUnit ?? null,
      parentGoalId: parentGoalId ?? null, status: GoalStatus.ACTIVE,
    },
    include: {
      childGoals: { select: { id: true, title: true, type: true, status: true, progress: true } },
      milestones: true,
      tasks: { select: { id: true, title: true, status: true, priority: true } },
    },
  });

  await prisma.$transaction([
    prisma.xpLog.create({ data: { userId, action: 'goal_created', xpEarned: 20 } }),
    prisma.user.update({ where: { id: userId }, data: { xp: { increment: 20 } } }),
  ]);

  return NextResponse.json({ goal }, { status: 201 });
}
