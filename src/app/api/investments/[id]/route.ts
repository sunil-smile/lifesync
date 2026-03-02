import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvestmentPlatform, Investment } from '@prisma/client';

interface RouteParams { params: { id: string } }

function enrichInvestment(inv: Investment) {
  let returnAbsolute: number | null = null;
  let returnPct: number | null = null;
  if (inv.buyPrice !== null && inv.currentPrice !== null && inv.units !== null) {
    const invested = inv.buyPrice * inv.units;
    const current = inv.currentPrice * inv.units;
    returnAbsolute = parseFloat((current - invested).toFixed(2));
    returnPct = invested > 0 ? parseFloat((((current - invested) / invested) * 100).toFixed(2)) : null;
  } else if (inv.investedAmount !== null && inv.currentValue !== null) {
    returnAbsolute = parseFloat((inv.currentValue - inv.investedAmount).toFixed(2));
    returnPct = inv.investedAmount > 0
      ? parseFloat((((inv.currentValue - inv.investedAmount) / inv.investedAmount) * 100).toFixed(2))
      : null;
  }
  return { ...inv, returnAbsolute, returnPct };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const inv = await prisma.investment.findUnique({ where: { id: params.id } });
  if (!inv || inv.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(enrichInvestment(inv));
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.investment.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json();
  const data: Record<string, unknown> = {};
  const fields = ['name','ticker','platform','sector','fundType','units','buyPrice','currentPrice',
    'investedAmount','currentValue','currency','notes'] as const;
  for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
  if (body.purchaseDate !== undefined)
    data.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null;
  const updated = await prisma.investment.update({ where: { id: params.id }, data });
  return NextResponse.json(enrichInvestment(updated));
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.investment.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.investment.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
