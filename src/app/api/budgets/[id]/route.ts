import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const budget = await prisma.budgetCategory.findUnique({ where: { id: params.id } });
  if (!budget || budget.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(budget);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.budgetCategory.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.icon !== undefined) data.icon = body.icon;
  if (body.monthlyLimit !== undefined) data.monthlyLimit = body.monthlyLimit;
  if (body.alertAt !== undefined) data.alertAt = body.alertAt;
  const updated = await prisma.budgetCategory.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.budgetCategory.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.budgetCategory.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
