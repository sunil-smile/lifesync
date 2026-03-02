import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NoteVisibility } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const visibility = searchParams.get('visibility') as NoteVisibility | null;
  const tag = searchParams.get('tag');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  const notes = await prisma.note.findMany({
    where: {
      userId,
      ...(visibility ? { visibility } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(search ? { OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]} : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { title, content, tags, visibility } = body;

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: 'Content is required' }, { status: 400 });

  const note = await prisma.note.create({
    data: {
      userId, title: title.trim(), content: content.trim(),
      tags: Array.isArray(tags) ? tags : [],
      visibility: visibility ?? NoteVisibility.PERSONAL,
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}
