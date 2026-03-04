import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type AccountType = 'ABN_AMRO' | 'ING' | 'CREDIT_CARD';
const VALID_ACCOUNT_TYPES: AccountType[] = ['ABN_AMRO', 'ING', 'CREDIT_CARD'];
const PAID_BY_MAP: Record<AccountType, string> = {
  ABN_AMRO: 'sunil',
  ING: 'vidhya',
  CREDIT_CARD: 'shared',
};

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const logs = await prisma.bankUploadLog.findMany({
    where: { userId },
    orderBy: { uploadedAt: 'desc' },
  });

  const latestByType = new Map<string, typeof logs[number]>();
  for (const log of logs) {
    if (!latestByType.has(log.accountType)) latestByType.set(log.accountType, log);
  }

  return NextResponse.json(Array.from(latestByType.values()));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();
  const { accountType, transactions, dateFrom, dateTo } = body;

  if (!VALID_ACCOUNT_TYPES.includes(accountType))
    return NextResponse.json({ error: `accountType must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}` }, { status: 400 });
  if (!Array.isArray(transactions) || transactions.length === 0)
    return NextResponse.json({ error: 'transactions must be a non-empty array' }, { status: 400 });

  const paidBy = PAID_BY_MAP[accountType as AccountType];
  const parsedDateFrom = dateFrom ? new Date(dateFrom) : new Date();
  const parsedDateTo = dateTo ? new Date(dateTo) : new Date();

  // Split into credits (income) and debits (expenses)
  const debits = transactions.filter((tx: Record<string, unknown>) => tx.type !== 'credit');
  const credits = transactions.filter((tx: Record<string, unknown>) => tx.type === 'credit');

  const expenseData = debits.map((tx: Record<string, unknown>) => ({
    userId,
    amount: tx.amount as number,
    category: String(tx.category ?? 'Other'),
    description: String(tx.description ?? 'Bank transaction'),
    date: tx.date ? new Date(tx.date as string) : new Date(),
    paidBy,
    bankAccount: accountType as string,
    notes: tx.isFixed ? 'fixed' : null,
  }));

  const incomeData = credits.map((tx: Record<string, unknown>) => ({
    userId,
    amount: tx.amount as number,
    source: String(tx.description ?? 'Bank credit'),
    category: String(tx.incomeCategory ?? 'Other'),
    date: tx.date ? new Date(tx.date as string) : new Date(),
    receivedBy: paidBy === 'shared' ? 'sunil' : paidBy,
    recurring: !!tx.isFixed,
    notes: null,
  }));

  const ops = [
    prisma.bankUploadLog.create({
      data: {
        userId, accountType, uploadedAt: new Date(),
        transactionCount: transactions.length,
        dateFrom: parsedDateFrom, dateTo: parsedDateTo,
      },
    }),
    ...expenseData.map((d) => prisma.expense.create({ data: d })),
    ...incomeData.map((d) => prisma.income.create({ data: d })),
  ];

  const results = await prisma.$transaction(ops);
  const uploadLog = results[0] as { id: string };

  return NextResponse.json({
    inserted: transactions.length,
    expenses: debits.length,
    income: credits.length,
    logId: uploadLog.id,
  }, { status: 201 });
}
