import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.id !== params.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, avatar: true, bankName: true, xp: true, level: true, levelName: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.id !== params.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.name?.trim()) data.name = body.name.trim();
  if (body.bankName !== undefined) data.bankName = body.bankName;
  if (body.avatar !== undefined) data.avatar = body.avatar;
  const user = await prisma.user.update({
    where: { id: params.id }, data,
    select: { id: true, name: true, email: true, avatar: true, bankName: true, xp: true, level: true, levelName: true },
  });
  return NextResponse.json({ user });
}
