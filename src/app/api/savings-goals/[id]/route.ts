import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.savingsGoal.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.savingsGoal.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.savingsGoal.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json();
  const updated = await prisma.savingsGoal.update({
    where: { id: params.id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.targetAmount !== undefined && { targetAmount: body.targetAmount }),
      ...(body.startMonth !== undefined && { startMonth: body.startMonth }),
      ...(body.startYear !== undefined && { startYear: body.startYear }),
      ...(body.endMonth !== undefined && { endMonth: body.endMonth }),
      ...(body.endYear !== undefined && { endYear: body.endYear }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  });
  return NextResponse.json({ goal: updated });
}
