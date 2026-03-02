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
import { Plus, Trash2, Upload, DollarSign, TrendingDown, TrendingUp, PiggyBank } from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'overview' | 'expenses' | 'income' | 'budget';

const EXPENSE_CATEGORIES = ['Food','Transport','Shopping','Entertainment','Health','Utilities','Home','Education','Travel','Insurance','Other'];
const INCOME_CATEGORIES = ['Salary','Freelance','Investment','Business','Gift','Other'];

function formatEur(n: number) { return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }).format(n); }

const now = new Date();
const MONTH = now.getMonth() + 1;
const YEAR = now.getFullYear();

export default function FinancePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [showModal, setShowModal] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [paidByFilter, setPaidByFilter] = useState('ALL');

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

  const handleBankUpload = async (accountType: string, file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(Boolean).slice(1);
    const transactions = lines.map(line => { const cols = line.split(','); return { amount: Math.abs(parseFloat(cols[3] ?? '0')) || 0, category: 'Other', description: (cols[1] ?? 'Transaction').trim(), date: cols[0] ?? new Date().toISOString() }; }).filter(t => t.amount > 0);
    if (transactions.length === 0) { toast('No valid transactions found in file', 'error'); return; }
    try {
      await axios.post('/api/bank-upload', { accountType, transactions, dateFrom: transactions[transactions.length - 1]?.date, dateTo: transactions[0]?.date });
      qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['bank-logs'] });
      toast(`✅ Uploaded ${transactions.length} transactions from ${accountType}`);
    } catch { toast('Upload failed', 'error'); }
  };

  return (
    <div className="p-6 space-y-6">
      <Header title="Finance" />

      {/* Tabs */}
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
            <div className="flex gap-2">
              {['ALL','SUNIL','VIDHYA','SHARED'].map(f => (
                <button key={f} onClick={() => setPaidByFilter(f)} className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-colors ${paidByFilter === f ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{f}</button>
              ))}
            </div>
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
          <Card title="Bank Upload" subtitle="Upload your bank transaction Excel/CSV files">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[{ type: 'ABN_AMRO', label: 'ABN AMRO', emoji: '🏦', owner: 'Sunil' }, { type: 'ING', label: 'ING', emoji: '🟠', owner: 'Vidhya' }, { type: 'CREDIT_CARD', label: 'Credit Card', emoji: '💳', owner: 'Shared' }].map(bank => {
                const log = bankLogs.find((l: { accountType: string }) => l.accountType === bank.type);
                return (
                  <div key={bank.type} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{bank.emoji}</span>
                      <div>
                        <p className="font-medium text-slate-200 text-sm">{bank.label}</p>
                        <p className="text-xs text-slate-500">{bank.owner}</p>
                      </div>
                    </div>
                    {log && <p className="text-xs text-slate-500">Last upload: {format(new Date(log.uploadedAt), 'MMM d, HH:mm')} ({log.transactionCount} txns)</p>}
                    <label className="flex items-center gap-2 text-xs font-medium text-blue-400 cursor-pointer hover:text-blue-300 transition-colors">
                      <Upload size={14} />Upload CSV/Excel
                      <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleBankUpload(bank.type, file); e.target.value = ''; }} />
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
          {budgLoading ? <LoadingSpinner className="py-8" /> : budgets.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No budget categories yet. Add one to start tracking!</p> : (
            <div className="grid sm:grid-cols-2 gap-4">
              {budgets.map((b: { id: string; icon?: string; name: string; spent: number; monthlyLimit: number; percentage: number; status: string; alertAt: number }) => (
                <div key={b.id} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200">{b.icon ?? '📊'} {b.name}</span>
                    <Badge variant={b.status === 'danger' ? 'red' : b.status === 'warning' ? 'amber' : 'emerald'} size="sm">{b.percentage}%</Badge>
                  </div>
                  <ProgressBar value={Math.min(b.percentage, 100)} color={b.status === 'danger' ? 'red' : b.status === 'warning' ? 'amber' : 'emerald'} size="md" />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Spent: <span className="text-slate-200 font-medium">{formatEur(b.spent)}</span></span>
                    <span>Limit: {formatEur(b.monthlyLimit)}</span>
                  </div>
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
    </div>
  );
}
