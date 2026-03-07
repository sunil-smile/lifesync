import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const expense = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(expense);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.amount      !== undefined) data.amount      = body.amount;
  if (body.category    !== undefined) data.category    = body.category;
  if (body.description !== undefined) data.description = body.description;
  if (body.date        !== undefined) data.date        = new Date(body.date);
  if (body.paidBy      !== undefined) data.paidBy      = body.paidBy;
  if (body.bankAccount !== undefined) data.bankAccount = body.bankAccount;
  if (body.expenseType !== undefined) data.expenseType = body.expenseType;
  if (body.isFixed     !== undefined) data.isFixed     = Boolean(body.isFixed);
  if (body.notes       !== undefined) data.notes       = body.notes;

  const updated = await prisma.expense.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.expense.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
