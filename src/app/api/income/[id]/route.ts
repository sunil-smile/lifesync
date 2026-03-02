import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const income = await prisma.income.findUnique({ where: { id: params.id } });
  if (!income || income.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(income);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.income.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.amount !== undefined) data.amount = body.amount;
  if (body.source !== undefined) data.source = body.source;
  if (body.category !== undefined) data.category = body.category;
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.receivedBy !== undefined) data.receivedBy = body.receivedBy;
  if (body.recurring !== undefined) data.recurring = body.recurring;
  if (body.notes !== undefined) data.notes = body.notes;
  const updated = await prisma.income.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.income.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.income.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
