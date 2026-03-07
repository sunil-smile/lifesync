import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const logs = await prisma.bankUploadLog.findMany({ orderBy: { uploadedAt: 'desc' }, take: 20 });
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json();
  const { transactions, dateFrom, dateTo, overwrite } = body;

  if (!Array.isArray(transactions) || transactions.length === 0)
    return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });

  interface TxRow {
    amount: number;
    description: string;
    date: string;
    category: string;
    expenseType?: string;
    type: 'credit' | 'debit';
    accountUser?: string;  // Account_user column → paidBy / receivedBy
    accountType?: string;  // Account_Type column → bankAccount
  }

  const rows = transactions as TxRow[];
  const debits  = rows.filter(tx => tx.type !== 'credit');
  const credits = rows.filter(tx => tx.type === 'credit');

  // Map Account_user to paidBy / receivedBy label
  const toPerson = (acctUser?: string) => {
    if (!acctUser) return 'sunil';
    const a = acctUser.toLowerCase();
    if (a.includes('vidhya') || a.includes('ing')) return 'vidhya';
    if (a.includes('shared') || a.includes('joint')) return 'shared';
    return 'sunil';
  };

  // If overwrite=true and date range provided, delete existing records in that window
  if (overwrite && dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to   = new Date(dateTo);
    // Extend 'to' to end of day
    to.setHours(23, 59, 59, 999);

    await prisma.$transaction([
      prisma.expense.deleteMany({
        where: { date: { gte: from, lte: to } },
      }),
      prisma.income.deleteMany({
        where: { date: { gte: from, lte: to } },
      }),
    ]);
  }

  // Insert all transactions
  await prisma.$transaction([
    ...debits.map(tx =>
      prisma.expense.create({
        data: {
          userId,
          amount:      Math.abs(tx.amount),
          category:    tx.category || 'Other',
          description: tx.description,
          date:        new Date(tx.date),
          paidBy:      toPerson(tx.accountUser),
          bankAccount: tx.accountType ?? null,
          expenseType: tx.expenseType ?? null,
          isFixed:     (tx.expenseType ?? '').toLowerCase() === 'fixed',
        },
      })
    ),
    ...credits.map(tx =>
      prisma.income.create({
        data: {
          userId,
          amount:      Math.abs(tx.amount),
          source:      tx.description,
          category:    tx.category || 'Other',
          date:        new Date(tx.date),
          receivedBy:  toPerson(tx.accountUser),
          expenseType: tx.expenseType ?? null,
          recurring:   (tx.expenseType ?? '').toLowerCase() === 'fixed',
        },
      })
    ),
  ]);

  const accountTypes = [...new Set(rows.map(tx => tx.accountType ?? 'EXCEL'))];
  await prisma.bankUploadLog.create({
    data: {
      userId,
      accountType:      accountTypes.join(','),
      uploadedAt:       new Date(),
      transactionCount: transactions.length,
      dateFrom:         dateFrom ? new Date(dateFrom) : new Date(),
      dateTo:           dateTo   ? new Date(dateTo)   : new Date(),
    },
  });

  return NextResponse.json({ imported: transactions.length, debits: debits.length, credits: credits.length });
}
