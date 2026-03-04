import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.screenTime.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const log = await prisma.screenTime.update({
    where: { id: params.id },
    data: {
      totalHours: body.totalHours !== undefined ? parseFloat(body.totalHours) : existing.totalHours,
      productiveHours: body.productiveHours !== undefined ? parseFloat(body.productiveHours) : existing.productiveHours,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    },
  });
  return NextResponse.json({ log });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.screenTime.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.screenTime.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
