'use client';

import { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { Plus, Trash2, Upload, DollarSign, TrendingDown, TrendingUp, PiggyBank, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'overview' | 'expenses' | 'income' | 'budget';
const EXPENSE_CATEGORIES = ['Food','Transport','Shopping','Entertainment','Health','Utilities','Home','Education','Travel','Insurance','Subscriptions','Other'];
const INCOME_CATEGORIES = ['Salary','Freelance','Investment','Business','Gift','Other'];
function formatEur(n: number) { return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }).format(n); }
const now = new Date(); const MONTH = now.getMonth() + 1; const YEAR = now.getFullYear();

// Dutch → English keyword mapping for ABN AMRO statements
const DUTCH_EN: [RegExp, string][] = [
  [/betaalautomaat|pinbet|pin\s*betaling/i, 'Card Payment'],
  [/automatische\s*incasso|incasso/i, 'Direct Debit'],
  [/internet\s*bankieren|mobiel\s*bankieren|overboeking/i, 'Bank Transfer'],
  [/salaris|loonbetaling|salarisbetaling/i, 'Salary'],
  [/huur\b|woninghuur/i, 'Rent'],
  [/hypotheek/i, 'Mortgage'],
  [/verzekering/i, 'Insurance'],
  [/kpn|vodafone|t-mobile|telecom|telefoon/i, 'Phone/Telecom'],
  [/albert\s*heijn|ah\.nl|ah\s+to\s+go/i, 'Albert Heijn'],
  [/jumbo/i, 'Jumbo Supermarket'],
  [/lidl/i, 'Lidl'],
  [/aldi/i, 'Aldi'],
  [/supermarkt|boodschappen/i, 'Supermarket'],
  [/restaurant|eetcaf[eé]|bistro|cafeteria/i, 'Restaurant'],
  [/benzine|tankstation|shell|total\s*energie|bp\b/i, 'Fuel'],
  [/apotheek|farmacie/i, 'Pharmacy'],
  [/ziekenhuis|huisarts|tandarts|fysiotherap/i, 'Healthcare'],
  [/elektriciteit|stroom\b/i, 'Electricity'],
  [/nuon|eneco|vattenfall|essent/i, 'Gas/Utilities'],
  [/belasting|inkomstenbelasting/i, 'Tax'],
  [/ns\s*reizen|ov-chipkaart|ovchip|openbaar\s*vervoer|gvb\b|ret\b/i, 'Public Transport'],
  [/bol\.com|amazon\b/i, 'Online Shopping'],
  [/gym|fitness|sport/i, 'Sports/Fitness'],
  [/abonnement|netflix|spotify|disney/i, 'Subscription'],
  [/dividend/i, 'Dividend'],
  [/pensioen/i, 'Pension'],
  [/spaarrekening/i, 'Savings Transfer'],
];

function translateDutch(text: string): string {
  for (const [pat, eng] of DUTCH_EN) { if (pat.test(text)) return eng; }
  return text;
}
function guessCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (/supermarkt|albert|jumbo|lidl|aldi|boodschap|grocer/i.test(d)) return 'Food';
  if (/restaurant|eetcaf|bistro|cafeteria/i.test(d)) return 'Food';
  if (/ns\s*reizen|ovchip|trein|metro|bus|transport|benzine|tank|fuel/i.test(d)) return 'Transport';
  if (/verzekering|insurance/i.test(d)) return 'Insurance';
  if (/nuon|eneco|vattenfall|elektriciteit|utilities/i.test(d)) return 'Utilities';
  if (/huur|hypotheek|rent|mortgage/i.test(d)) return 'Home';
  if (/ziekenhuis|huisarts|apotheek|health|pharmacy|tandarts/i.test(d)) return 'Health';
  if (/gym|fitness|sport/i.test(d)) return 'Health';
  if (/netflix|spotify|abonnement|subscri/i.test(d)) return 'Entertainment';
  if (/bol\.com|amazon|shopping/i.test(d)) return 'Shopping';
  return 'Other';
}

interface ReviewRow {
  id: string; originalDesc: string; description: string; date: string;
  amount: number; type: 'debit' | 'credit'; category: string;
  incomeCategory: string; isFixed: boolean; include: boolean;
}

export default function FinancePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [showModal, setShowModal] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [paidByFilter, setPaidByFilter] = useState('ALL');
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [reviewAccountType, setReviewAccountType] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [importing, setImporting] = useState(false);

  const { data: expensesData, isLoading: expLoading } = useQuery({ queryKey: ['expenses', MONTH, YEAR], queryFn: () => axios.get(`/api/expenses?month=${MONTH}&year=${YEAR}&limit=100`).then(r => r.data) });
  const { data: incomeData, isLoading: incLoading } = useQuery({ queryKey: ['income', MONTH, YEAR], queryFn: () => axios.get(`/api/income?month=${MONTH}&year=${YEAR}&limit=100`).then(r => r.data) });
  const { data: budgetData, isLoading: budgLoading } = useQuery({ queryKey: ['budgets', MONTH, YEAR], queryFn: () => axios.get(`/api/budgets?month=${MONTH}&year=${YEAR}`).then(r => r.data) });
  const { data: bankLogsData } = useQuery({ queryKey: ['bank-logs'], queryFn: () => axios.get('/api/bank-upload').then(r => r.data) });

  const addExpense = useMutation({ mutationFn: (d: Record<string, unknown>) => axios.post('/api/expenses', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowModal(null); toast('Expense added!'); }, onError: () => toast('Failed to add expense', 'error') });
  const deleteExpense = useMutation({ mutationFn: (id: string) => axios.delete(`/api/expenses/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast('Deleted'); } });
  const addIncome = useMutation({ mutationFn: (d: Record<string, unknown>) => axios.post('/api/income', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['income'] }); setShowModal(null); toast('Income added!'); }, onError: () => toast('Failed to add income', 'error') });
  const deleteIncome = useMutation({ mutationFn: (id: string) => axios.delete(`/api/income/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['income'] }); toast('Deleted'); } });
  const addBudget = useMutation({ mutationFn: (d: Record<string, unknown>) => axios.post('/api/budgets', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); setShowModal(null); toast('Budget category added!'); }, onError: () => toast('Failed to add budget', 'error') });

  const expenses = expensesData ?? [];
  const incomes = incomeData ?? [];
  const budgets = budgetData ?? [];
  const bankLogs = bankLogsData ?? [];
  const totalExpenses = expenses.reduce((s: number, e: { amount: number }) => s + e.amount, 0);
  const totalIncome = incomes.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
  const savings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
  const filteredExpenses = paidByFilter === 'ALL' ? expenses : expenses.filter((e: { paidBy: string }) => e.paidBy === paidByFilter.toLowerCase());

  const handleBankFileSelect = async (accountType: string, file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(Boolean).slice(1);
    const rows: ReviewRow[] = lines.map((line, i) => {
      const delim = line.includes(';') ? ';' : ',';
      const cols = line.split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
      const rawAmount = parseFloat((cols[3] ?? cols[6] ?? '0').replace(',', '.')) || 0;
      const rawDesc = (cols[1] ?? cols[2] ?? 'Transaction').trim();
      const rawDate = (cols[0] ?? format(new Date(), 'yyyy-MM-dd')).slice(0, 10);
      const debitCol = (cols[4] ?? cols[5] ?? '').toLowerCase();
      const isDebit = rawAmount < 0 || debitCol.includes('deb') || debitCol.includes('af') || !debitCol.includes('cred');
      const amount = Math.abs(rawAmount);
      const translated = translateDutch(rawDesc);
      return { id: String(i), originalDesc: rawDesc, description: translated, date: rawDate, amount, type: (isDebit ? 'debit' : 'credit') as 'debit' | 'credit', category: guessCategory(rawDesc), incomeCategory: 'Other', isFixed: false, include: amount > 0 };
    }).filter(r => r.amount > 0);
    if (rows.length === 0) { toast('No valid transactions found', 'error'); return; }
    setReviewRows(rows); setReviewAccountType(accountType); setShowReview(true);
  };

  const updateRow = (id: string, field: keyof ReviewRow, value: unknown) =>
    setReviewRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const handleImport = async () => {
    const toImport = reviewRows.filter(r => r.include);
    if (!toImport.length) { toast('No transactions selected', 'error'); return; }
    setImporting(true);
    try {
      const dates = toImport.map(r => r.date).sort();
      await axios.post('/api/bank-upload', {
        accountType: reviewAccountType,
        transactions: toImport.map(r => ({ amount: r.amount, description: r.description, date: r.date, category: r.category, incomeCategory: r.incomeCategory, isFixed: r.isFixed, type: r.type })),
        dateFrom: dates[0], dateTo: dates[dates.length - 1],
      });
      qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['income'] }); qc.invalidateQueries({ queryKey: ['bank-logs'] });
      toast(`✅ Imported ${toImport.length} transactions (${toImport.filter(r => r.type === 'credit').length} income, ${toImport.filter(r => r.type === 'debit').length} expenses)`);
      setShowReview(false);
    } catch { toast('Import failed', 'error'); }
    setImporting(false);
  };

  return (
    <div className="p-6 space-y-6">
      <Header title="Finance" />
      <div className="flex gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700 w-fit">
        {(['overview','expenses','income','budget'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}>{t}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Income', value: formatEur(totalIncome), icon: <TrendingUp size={18} />, color: 'bg-emerald-500/20 text-emerald-400' },
              { label: 'Expenses', value: formatEur(totalExpenses), icon: <TrendingDown size={18} />, color: 'bg-red-500/20 text-red-400' },
              { label: 'Savings', value: formatEur(savings), icon: <PiggyBank size={18} />, color: savings >= 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400' },
              { label: 'Savings Rate', value: `${savingsRate}%`, icon: <DollarSign size={18} />, color: savingsRate >= 20 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${s.color}`}>{s.icon}</div>
                <p className="text-xl font-bold text-slate-100">{s.value}</p>
                <p className="text-sm text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {budgets.length > 0 && (
            <Card title="Budget Status">
              <div className="space-y-3">
                {budgets.map((b: { id: string; icon?: string; name: string; spent: number; monthlyLimit: number; percentage: number; status: string }) => (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{b.icon} {b.name}</span>
                      <span className={b.status === 'danger' ? 'text-red-400' : b.status === 'warning' ? 'text-amber-400' : 'text-slate-400'}>{formatEur(b.spent)} / {formatEur(b.monthlyLimit)}</span>
                    </div>
                    <ProgressBar value={b.percentage} color={b.status === 'danger' ? 'red' : b.status === 'warning' ? 'amber' : 'emerald'} size="sm" />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* EXPENSES */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2">{['ALL','SUNIL','VIDHYA','SHARED'].map(f => (<button key={f} onClick={() => setPaidByFilter(f)} className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-colors ${paidByFilter === f ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{f}</button>))}</div>
            <button onClick={() => { setForm({ category: 'Food', paidBy: 'sunil' }); setShowModal('expense'); }} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-lg font-medium"><Plus size={14} />Add Expense</button>
          </div>
          <Card>
            {expLoading ? <LoadingSpinner className="py-8" /> : filteredExpenses.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No expenses this month.</p> : (
              <div className="space-y-2">
                {filteredExpenses.map((e: { id: string; date: string; description: string; category: string; amount: number; paidBy: string }) => (
                  <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-slate-700/50 last:border-0 group">
                    <span className="text-xs text-slate-500 w-16 flex-shrink-0">{format(new Date(e.date), 'MMM d')}</span>
                    <span className="flex-1 text-sm text-slate-200 truncate">{e.description}</span>
                    <Badge variant="slate" size="sm">{e.category}</Badge>
                    <Badge variant={e.paidBy === 'vidhya' ? 'violet' : e.paidBy === 'shared' ? 'amber' : 'blue'} size="sm">{e.paidBy}</Badge>
                    <span className="text-sm font-semibold text-slate-100 w-20 text-right">{formatEur(e.amount)}</span>
                    <button onClick={() => deleteExpense.mutate(e.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Bank Upload */}
          <Card title="Bank Statement Upload" subtitle="Import transactions — Dutch descriptions auto-translated to English">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[{ type: 'ABN_AMRO', label: 'ABN AMRO', emoji: '🏦', owner: 'Sunil' }, { type: 'ING', label: 'ING', emoji: '🟠', owner: 'Vidhya' }, { type: 'CREDIT_CARD', label: 'Credit Card', emoji: '💳', owner: 'Shared' }].map(bank => {
                const log = bankLogs.find((l: { accountType: string }) => l.accountType === bank.type);
                return (
                  <div key={bank.type} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{bank.emoji}</span>
                      <div><p className="font-medium text-slate-200 text-sm">{bank.label}</p><p className="text-xs text-slate-500">{bank.owner}</p></div>
                    </div>
                    {log && <p className="text-xs text-slate-500">Last: {format(new Date(log.uploadedAt), 'MMM d')} · {log.transactionCount} txns</p>}
                    <label className="flex items-center gap-2 text-xs font-medium text-blue-400 cursor-pointer hover:text-blue-300 transition-colors">
                      <Upload size={14} />Upload CSV / Excel
                      <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleBankFileSelect(bank.type, f); e.target.value = ''; }} />
                    </label>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* INCOME */}
      {tab === 'income' && (
        <Card title="Income" action={<button onClick={() => { setForm({ category: 'Salary', receivedBy: 'sunil' }); setShowModal('income'); }} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium"><Plus size={14} />Add Income</button>}>
          {incLoading ? <LoadingSpinner className="py-8" /> : incomes.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No income this month.</p> : (
            <div className="space-y-2">
              {incomes.map((i: { id: string; date: string; source: string; category: string; amount: number; receivedBy: string; recurring: boolean }) => (
                <div key={i.id} className="flex items-center gap-3 py-2.5 border-b border-slate-700/50 last:border-0 group">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">{format(new Date(i.date), 'MMM d')}</span>
                  <span className="flex-1 text-sm text-slate-200 truncate">{i.source}</span>
                  <Badge variant="emerald" size="sm">{i.category}</Badge>
                  <Badge variant={i.receivedBy === 'vidhya' ? 'violet' : 'blue'} size="sm">{i.receivedBy}</Badge>
                  {i.recurring && <Badge variant="slate" size="sm">🔄 recurring</Badge>}
                  <span className="text-sm font-semibold text-emerald-400 w-20 text-right">+{formatEur(i.amount)}</span>
                  <button onClick={() => deleteIncome.mutate(i.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* BUDGET */}
      {tab === 'budget' && (
        <Card title="Budget Categories" action={<button onClick={() => { setForm({ alertAt: '80', month: String(MONTH), year: String(YEAR) }); setShowModal('budget'); }} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium"><Plus size={14} />Add Category</button>}>
          {budgLoading ? <LoadingSpinner className="py-8" /> : budgets.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No budget categories yet.</p> : (
            <div className="grid sm:grid-cols-2 gap-4">
              {budgets.map((b: { id: string; icon?: string; name: string; spent: number; monthlyLimit: number; percentage: number; status: string }) => (
                <div key={b.id} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 space-y-3">
                  <div className="flex items-center justify-between"><span className="font-medium text-slate-200">{b.icon ?? '📊'} {b.name}</span><Badge variant={b.status === 'danger' ? 'red' : b.status === 'warning' ? 'amber' : 'emerald'} size="sm">{b.percentage}%</Badge></div>
                  <ProgressBar value={Math.min(b.percentage, 100)} color={b.status === 'danger' ? 'red' : b.status === 'warning' ? 'amber' : 'emerald'} size="md" />
                  <div className="flex items-center justify-between text-xs text-slate-400"><span>Spent: <span className="text-slate-200 font-medium">{formatEur(b.spent)}</span></span><span>Limit: {formatEur(b.monthlyLimit)}</span></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Expense Modal */}
      <Modal isOpen={showModal === 'expense'} onClose={() => setShowModal(null)} title="Add Expense">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Amount (€) *</label><input type="number" step="0.01" value={String(form.amount ?? '')} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="0.00" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Description *</label><input value={String(form.description ?? '')} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label><select value={String(form.category ?? 'Food')} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Paid By</label><select value={String(form.paidBy ?? 'sunil')} onChange={e => setForm(p => ({ ...p, paidBy: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"><option value="sunil">Sunil</option><option value="vidhya">Vidhya</option><option value="shared">Shared</option></select></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label><input type="date" value={String(form.date ?? format(new Date(), 'yyyy-MM-dd'))} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
          <button onClick={() => addExpense.mutate({ ...form, amount: parseFloat(String(form.amount)) })} disabled={!form.amount || !form.description} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium">{addExpense.isPending ? 'Adding...' : 'Add Expense'}</button>
        </div>
      </Modal>

      {/* Income Modal */}
      <Modal isOpen={showModal === 'income'} onClose={() => setShowModal(null)} title="Add Income">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Amount (€) *</label><input type="number" step="0.01" value={String(form.amount ?? '')} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="0.00" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Source *</label><input value={String(form.source ?? '')} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="e.g. Monthly Salary" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label><select value={String(form.category ?? 'Salary')} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">{INCOME_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Received By</label><select value={String(form.receivedBy ?? 'sunil')} onChange={e => setForm(p => ({ ...p, receivedBy: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"><option value="sunil">Sunil</option><option value="vidhya">Vidhya</option></select></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label><input type="date" value={String(form.date ?? format(new Date(), 'yyyy-MM-dd'))} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!form.recurring} onChange={e => setForm(p => ({ ...p, recurring: e.target.checked }))} className="rounded" /><span className="text-sm text-slate-300">Recurring monthly</span></label>
          <button onClick={() => addIncome.mutate({ ...form, amount: parseFloat(String(form.amount)) })} disabled={!form.amount || !form.source} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium">{addIncome.isPending ? 'Adding...' : 'Add Income'}</button>
        </div>
      </Modal>

      {/* Budget Modal */}
      <Modal isOpen={showModal === 'budget'} onClose={() => setShowModal(null)} title="Add Budget Category">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Category Name *</label><input value={String(form.name ?? '')} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="e.g. Food" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Icon (emoji)</label><input value={String(form.icon ?? '')} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="🍕" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Monthly Limit (€) *</label><input type="number" value={String(form.monthlyLimit ?? '')} onChange={e => setForm(p => ({ ...p, monthlyLimit: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="500" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Alert at {form.alertAt ?? 80}%</label><input type="range" min="50" max="100" value={String(form.alertAt ?? 80)} onChange={e => setForm(p => ({ ...p, alertAt: e.target.value }))} className="w-full" /></div>
          <button onClick={() => addBudget.mutate({ ...form, monthlyLimit: parseFloat(String(form.monthlyLimit)), alertAt: parseInt(String(form.alertAt ?? 80)), month: parseInt(String(form.month ?? MONTH)), year: parseInt(String(form.year ?? YEAR)) })} disabled={!form.name || !form.monthlyLimit} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium">{addBudget.isPending ? 'Adding...' : 'Add Category'}</button>
        </div>
      </Modal>

      {/* ── Bank Upload Review Modal ── */}
      <Modal isOpen={showReview} onClose={() => setShowReview(false)} size="xl"
        title={`Review Transactions — ${reviewAccountType.replace('_',' ')} (${reviewRows.filter(r=>r.include).length} of ${reviewRows.length} selected)`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Edit descriptions, toggle credit/debit, set categories, then import.</span>
            <div className="flex gap-3">
              <button onClick={() => setReviewRows(p => p.map(r => ({...r, include: true})))} className="text-blue-400 hover:text-blue-300">Select all</button>
              <button onClick={() => setReviewRows(p => p.map(r => ({...r, include: false})))} className="text-slate-500 hover:text-slate-300">Deselect all</button>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-700 gap-2"
            style={{ gridTemplateColumns: '1.5rem 5rem 1fr 8rem 7rem 5rem 3.5rem' }}>
            <span/><span>Date</span><span>Description (English)</span><span>Type</span><span>Category</span><span className="text-right">Amount</span><span className="text-center">Fixed</span>
          </div>

          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {reviewRows.map(row => (
              <div key={row.id} className={`grid items-center gap-2 py-1.5 px-1 rounded-lg text-sm transition-opacity ${row.include ? 'bg-slate-700/30' : 'opacity-40'}`}
                style={{ gridTemplateColumns: '1.5rem 5rem 1fr 8rem 7rem 5rem 3.5rem' }}>
                <input type="checkbox" checked={row.include} onChange={e => updateRow(row.id,'include',e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                <span className="text-xs text-slate-400">{row.date.slice(0,10)}</span>
                <input value={row.description} onChange={e => updateRow(row.id,'description',e.target.value)}
                  className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-xs focus:outline-none focus:border-blue-500 w-full" />
                <div className="flex gap-1">
                  <button onClick={() => updateRow(row.id,'type','debit')}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${row.type==='debit'?'bg-red-500/20 text-red-400 border border-red-500/30':'bg-slate-700 text-slate-500 hover:text-slate-300'}`}>
                    <ArrowDownCircle size={10}/>Debit
                  </button>
                  <button onClick={() => updateRow(row.id,'type','credit')}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${row.type==='credit'?'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30':'bg-slate-700 text-slate-500 hover:text-slate-300'}`}>
                    <ArrowUpCircle size={10}/>Credit
                  </button>
                </div>
                <select value={row.type==='credit' ? row.incomeCategory : row.category}
                  onChange={e => updateRow(row.id, row.type==='credit'?'incomeCategory':'category', e.target.value)}
                  className="px-1 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-xs focus:outline-none focus:border-blue-500 w-full">
                  {(row.type==='credit' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c=><option key={c}>{c}</option>)}
                </select>
                <span className={`text-xs font-semibold text-right ${row.type==='credit'?'text-emerald-400':'text-slate-200'}`}>{formatEur(row.amount)}</span>
                <div className="flex justify-center">
                  <input type="checkbox" checked={row.isFixed} onChange={e => updateRow(row.id,'isFixed',e.target.checked)} className="w-4 h-4 rounded accent-emerald-500" title="Fixed/recurring" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-400">
              <span className="text-emerald-400 font-medium">{reviewRows.filter(r=>r.include&&r.type==='credit').length} income</span>
              {' · '}
              <span className="text-red-400 font-medium">{reviewRows.filter(r=>r.include&&r.type==='debit').length} expenses</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowReview(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">Cancel</button>
              <button onClick={handleImport} disabled={importing || !reviewRows.some(r=>r.include)}
                className="flex items-center gap-2 px-5 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                <Upload size={14}/>{importing ? 'Importing...' : `Import ${reviewRows.filter(r=>r.include).length} transactions`}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
