import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvestmentPlatform, Investment } from '@prisma/client';

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

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') as InvestmentPlatform | null;
  const sector = searchParams.get('sector');

  const where: Record<string, unknown> = { userId };
  if (platform) where.platform = platform;
  if (sector) where.sector = sector;

  const investments = await prisma.investment.findMany({ where, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(investments.map(enrichInvestment));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { name, ticker, platform, sector, fundType, units, buyPrice, currentPrice,
          investedAmount, currentValue, purchaseDate, currency, notes } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!platform) return NextResponse.json({ error: 'platform is required' }, { status: 400 });
  if (!sector?.trim()) return NextResponse.json({ error: 'sector is required' }, { status: 400 });

  const investment = await prisma.investment.create({
    data: {
      userId, name: name.trim(), ticker: ticker ?? null,
      platform: platform as InvestmentPlatform,
      sector: sector.trim(), fundType: fundType ?? null,
      units: units ?? null, buyPrice: buyPrice ?? null,
      currentPrice: currentPrice ?? null, investedAmount: investedAmount ?? null,
      currentValue: currentValue ?? null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      currency: currency ?? 'EUR', notes: notes ?? null,
    },
  });

  await prisma.$transaction([
    prisma.xpLog.create({ data: { userId, action: 'investment_added', xpEarned: 5 } }),
    prisma.user.update({ where: { id: userId }, data: { xp: { increment: 5 } } }),
  ]);

  return NextResponse.json(enrichInvestment(investment), { status: 201 });
}
