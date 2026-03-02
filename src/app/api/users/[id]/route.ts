import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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

  // Handle profile fields
  if (body.name?.trim()) data.name = body.name.trim();
  if (body.bankName !== undefined) data.bankName = body.bankName;
  if (body.avatar !== undefined) data.avatar = body.avatar;

  // Handle password change
  if (body.currentPassword !== undefined || body.newPassword !== undefined) {
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Both current and new password are required.' },
        { status: 400 },
      );
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters.' },
        { status: 400 },
      );
    }

    // Fetch the stored hash (password is not in the default select)
    const userWithPassword = await prisma.user.findUnique({
      where: { id: params.id },
      select: { password: true },
    });

    if (!userWithPassword?.password) {
      return NextResponse.json(
        { error: 'Cannot change password for this account.' },
        { status: 400 },
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, userWithPassword.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Current password is incorrect.' },
        { status: 400 },
      );
    }

    data.password = await bcrypt.hash(newPassword, 12);
  }

  const user = await prisma.user.update({
    where: { id: params.id }, data,
    select: { id: true, name: true, email: true, avatar: true, bankName: true, xp: true, level: true, levelName: true },
  });
  return NextResponse.json({ user });
}
