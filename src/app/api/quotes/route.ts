import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const random = searchParams.get('random') === 'true';

  const quotes = await prisma.quote.findMany({
    where: { ...(category ? { category } : {}) },
    orderBy: { createdAt: 'desc' },
  });

  if (random && quotes.length > 0) {
    return NextResponse.json(quotes[Math.floor(Math.random() * quotes.length)]);
  }
  return NextResponse.json({ quotes });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });
  const quote = await prisma.quote.create({
    data: {
      text: body.text.trim(), author: body.author ?? null,
      category: body.category ?? null, isFavorite: body.isFavorite ?? false,
      userId: session.user.id,
    },
  });
  return NextResponse.json({ quote }, { status: 201 });
}
