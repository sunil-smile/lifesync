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
  const parsedDateFrom = new Date(dateFrom);
  const parsedDateTo = new Date(dateTo);

  const expenseData = transactions.map((tx: Record<string, unknown>) => ({
    userId,
    amount: tx.amount as number,
    category: String(tx.category ?? 'Other'),
    description: String(tx.description ?? 'Bank transaction'),
    date: tx.date ? new Date(tx.date as string) : new Date(),
    paidBy,
    bankAccount: accountType as string,
    notes: tx.notes ? String(tx.notes) : null,
  }));

  const [uploadLog] = await prisma.$transaction([
    prisma.bankUploadLog.create({
      data: {
        userId, accountType, uploadedAt: new Date(),
        transactionCount: transactions.length,
        dateFrom: parsedDateFrom, dateTo: parsedDateTo,
      },
    }),
    ...expenseData.map((d) => prisma.expense.create({ data: d })),
  ]);

  return NextResponse.json({ inserted: transactions.length, logId: uploadLog.id }, { status: 201 });
}
