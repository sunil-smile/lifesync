import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const goal = await prisma.goal.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  const milestones = await prisma.milestone.findMany({
    where: { goalId: params.id }, orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ milestones });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const goal = await prisma.goal.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

  const body = await request.json();
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const milestone = await prisma.milestone.create({
    data: { goalId: params.id, title: body.title.trim(), dueDate: body.dueDate ? new Date(body.dueDate) : null },
  });
  return NextResponse.json({ milestone }, { status: 201 });
}
