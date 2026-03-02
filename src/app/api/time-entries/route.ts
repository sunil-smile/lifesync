import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      userId,
      ...(category ? { category } : {}),
      ...(startDate || endDate ? {
        startTime: {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate ? { lte: new Date(endDate) } : {}),
        },
      } : {}),
    },
    orderBy: { startTime: 'desc' },
    take: limit,
  });

  return NextResponse.json({ timeEntries });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { description, startTime, endTime, durationMinutes, category } = body;

  if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  if (!startTime) return NextResponse.json({ error: 'startTime is required' }, { status: 400 });

  let computedDuration: number | null = durationMinutes ?? null;
  if (endTime && durationMinutes === undefined) {
    computedDuration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
  }

  const timeEntry = await prisma.timeEntry.create({
    data: {
      userId, description: description.trim(),
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      durationMinutes: computedDuration,
      category: category ?? null,
    },
  });

  return NextResponse.json({ timeEntry }, { status: 201 });
}
