import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskStatus, TaskPriority } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as TaskStatus | null;
  const priority = searchParams.get('priority') as TaskPriority | null;
  const goalId = searchParams.get('goalId');
  const assignee = searchParams.get('assignee');
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(goalId ? { goalId } : {}),
      ...(assignee ? { assignee } : {}),
    },
    include: { goal: { select: { id: true, title: true } } },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    take: limit,
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { title, notes, dueDate, priority, assignee, goalId, status } = body;

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      userId, title: title.trim(), notes: notes ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority ?? TaskPriority.MEDIUM,
      assignee: assignee ?? 'sunil',
      status: status ?? TaskStatus.TODO,
      goalId: goalId ?? null,
    },
    include: { goal: { select: { id: true, title: true } } },
  });

  await prisma.$transaction([
    prisma.xpLog.create({ data: { userId, action: 'task_created', xpEarned: 5 } }),
    prisma.user.update({ where: { id: userId }, data: { xp: { increment: 5 } } }),
  ]);

  return NextResponse.json({ task }, { status: 201 });
}
