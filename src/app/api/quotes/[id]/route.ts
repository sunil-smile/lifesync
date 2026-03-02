import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ quote });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.text !== undefined) data.text = body.text.trim();
  if (body.author !== undefined) data.author = body.author;
  if (body.category !== undefined) data.category = body.category;
  if (body.isFavorite !== undefined) data.isFavorite = body.isFavorite;
  const updated = await prisma.quote.update({ where: { id: params.id }, data });
  return NextResponse.json({ quote: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote || (quote.userId && quote.userId !== session.user.id))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.quote.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
