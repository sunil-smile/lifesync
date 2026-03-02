import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the task belongs to this user
  const task = await prisma.task.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates = await prisma.taskUpdate.findMany({
    where: { taskId: params.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ updates });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the task belongs to this user
  const task = await prisma.task.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  if (!body.text?.trim()) return NextResponse.json({ error: 'Update text is required' }, { status: 400 });

  const update = await prisma.taskUpdate.create({
    data: { taskId: params.id, text: body.text.trim() },
  });

  return NextResponse.json({ update }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const updateId = searchParams.get('updateId');
  if (!updateId) return NextResponse.json({ error: 'updateId is required' }, { status: 400 });

  // Verify ownership via task
  const task = await prisma.task.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.taskUpdate.delete({ where: { id: updateId } });
  return NextResponse.json({ success: true });
}
