'use client';

import { useState, useRef, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { Header } from '@/components/layout/Header';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import {
  Plus, Trash2, TrendingUp, PiggyBank, DollarSign,
  ChevronLeft, ChevronRight, AlertTriangle, ArrowDownCircle, ArrowUpCircle,
  Target, Pencil, List, FileSpreadsheet, Calendar, CheckSquare, Square,
  ChevronUp, ChevronDown, ChevronsUpDown, X, Upload, BarChart2, Users,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type ParentTab = 'ytd' | 'monthly' | 'upload';
type SubTab    = 'transactions' | 'income' | 'expenses' | 'budget' | 'savings';
type PeriodMode = 'month' | 'custom';
type SortDir    = 'asc' | 'desc';

interface Expense {
  id: string; userId: string; amount: number; category: string;
  description: string; date: string; paidBy: string;
  bankAccount?: string; isFixed: boolean; expenseType?: string; notes?: string;
  createdAt: string; updatedAt: string;
}
interface Income {
  id: string; userId: string; amount: number; source: string;
  category: string; date: string; receivedBy: string;
  recurring: boolean; expenseType?: string; notes?: string; createdAt: string;
}
interface BudgetCat {
  id: string; name: string; icon?: string; monthlyLimit: number;
  alertAt: number; month: number; year: number; isYearly: boolean;
  spent: number; percentage: number; status: 'good' | 'warning' | 'danger';
}
interface SavingsGoal {
  id: string; name: string; targetAmount: number;
  startMonth: number; startYear: number; endMonth: number; endYear: number;
  notes?: string; actualSavings: number; percentage: number;
}
interface TxFilters {
  dateFrom: string; dateTo: string; category: string;
  expenseType: string; txType: string; account: string;
  amtMin: string; amtMax: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const EXPENSE_CATS  = ['Food','Transport','Shopping','Entertainment','Health','Utilities','Home','Education','Travel','Insurance','Subscriptions','Other'];
const INCOME_CATS   = ['Salary','Freelance','Investment','Business','Gift','Other'];
const PAID_BY_OPTS  = ['sunil','vidhya','shared'];
const EXPENSE_TYPES = ['Fixed','Variable','Discretionary','Recurring','One-time','Savings','Other'];
const MONTHS        = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS    = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7'];
const SAVINGS_PIE   = ['#8b5cf6','#6366f1','#a855f7','#c084fc','#7c3aed','#4f46e5','#ddd6fe'];
const NOW  = new Date();
const CUR_Y = NOW.getFullYear();
const CUR_M = NOW.getMonth() + 1;

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function formatEur(n: number) {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }).format(n);
}
function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; }
}
function normaliseKey(k: string) {
  return k.toLowerCase().replace(/[\s_\-]+/g, '_').trim();
}

/* ─── Sort ───────────────────────────────────────────────────────────────────── */
function sortBy<T extends Record<string, unknown>>(arr: T[], col: string, dir: SortDir): T[] {
  return [...arr].sort((a, b) => {
    const av = a[col]; const bv = b[col];
    let cmp = 0;
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
    return dir === 'asc' ? cmp : -cmp;
  });
}

/* ─── Sortable header ────────────────────────────────────────────────────────── */
function SortTh({ col, label, sortCol, sortDir, onSort, className = '' }: {
  col: string; label: string; sortCol: string; sortDir: SortDir;
  onSort: (c: string) => void; className?: string;
}) {
  const active = sortCol === col;
  return (
    <th className={`px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wide ${className}`}>
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-slate-200 transition-colors">
        {label}
        {active ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-40" />}
      </button>
    </th>
  );
}

/* ─── Custom Pie Tooltip ─────────────────────────────────────────────────────── */
const PieTip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-200 text-xs font-semibold">{payload[0].name}</p>
      <p className="text-slate-100 text-sm font-bold">{formatEur(payload[0].value)}</p>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════════════════ */
export default function FinancePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Parent / Sub tabs ──────────────────────────────────────────────────── */
  const [parentTab, setParentTab] = useState<ParentTab>('ytd');
  const [subTab,    setSubTab]    = useState<SubTab>('transactions');

  /* ── Global Account User filter ─────────────────────────────────────────── */
  const [accountFilter, setAccountFilter] = useState<'' | 'sunil' | 'vidhya'| 'shared'>('');

  /* ── Year / Period ──────────────────────────────────────────────────────── */
  const [selYear,     setSelYear]     = useState(CUR_Y);
  const [periodMode,  setPeriodMode]  = useState<PeriodMode>('month');
  const [periodMonth, setPeriodMonth] = useState(CUR_M);
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');

  /* ── Upload ─────────────────────────────────────────────────────────────── */
  const [uploadDateFrom, setUploadDateFrom] = useState('');
  const [uploadDateTo,   setUploadDateTo]   = useState('');
  const [uploading, setUploading] = useState(false);

  /* ── Sort state ─────────────────────────────────────────────────────────── */
  const [txSort,  setTxSort]  = useState<{ col: string; dir: SortDir }>({ col: 'date', dir: 'desc' });
  const [incSort, setIncSort] = useState<{ col: string; dir: SortDir }>({ col: 'date', dir: 'desc' });
  const [expSort, setExpSort] = useState<{ col: string; dir: SortDir }>({ col: 'date', dir: 'desc' });
  function toggleSort(cur: { col: string; dir: SortDir }, col: string) {
    return cur.col === col ? { col, dir: (cur.dir === 'asc' ? 'desc' : 'asc') as SortDir } : { col, dir: 'desc' as SortDir };
  }

  /* ── Tx column filters ──────────────────────────────────────────────────── */
  const emptyTxF: TxFilters = { dateFrom: '', dateTo: '', category: '', expenseType: '', txType: '', account: '', amtMin: '', amtMax: '' };
  const [txF, setTxF] = useState<TxFilters>(emptyTxF);
  const hasFilter = Object.values(txF).some(v => v !== '');

  /* ── Multi-select ───────────────────────────────────────────────────────── */
  const [selExp, setSelExp] = useState<Set<string>>(new Set());
  const [selInc, setSelInc] = useState<Set<string>>(new Set());
  const [selTx,  setSelTx]  = useState<Set<string>>(new Set());

  /* ── Modals ─────────────────────────────────────────────────────────────── */
  type TxType = 'expense' | 'income';
  const [txModal, setTxModal] = useState<{ open: boolean; type: TxType; item?: Expense | Income }>({ open: false, type: 'expense' });
  const blankExp = () => ({ amount: 0, category: 'Other', description: '', date: format(new Date(),'yyyy-MM-dd'), paidBy: 'sunil', bankAccount: '', expenseType: '', notes: '' });
  const blankInc = () => ({ amount: 0, source: '', category: 'Salary', date: format(new Date(),'yyyy-MM-dd'), receivedBy: 'sunil', expenseType: '', notes: '' });
  const [txForm, setTxForm] = useState<Record<string, unknown>>(blankExp());

  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetEdit,  setBudgetEdit]  = useState<BudgetCat | null>(null);
  const [budgetForm,  setBudgetForm]  = useState({ name:'', icon:'💰', monthlyLimit:'', alertAt:'80', isYearly: false });

  const [savingModal, setSavingModal] = useState(false);
  const [savingEdit,  setSavingEdit]  = useState<SavingsGoal | null>(null);
  const [savingForm,  setSavingForm]  = useState({ name:'', targetAmount:'', startMonth: CUR_M, startYear: CUR_Y, endMonth: CUR_M, endYear: CUR_Y+1, notes:'' });

  /* ══════════════════════════════════════════════════════════════════════════
     DATE RANGES
  ══════════════════════════════════════════════════════════════════════════ */
  const ytdFrom = `${selYear}-01-01`;
  const ytdTo   = selYear === CUR_Y ? format(NOW, 'yyyy-MM-dd') : `${selYear}-12-31`;

  const periodFrom = useMemo(() => {
    if (periodMode === 'custom' && customFrom) return customFrom;
    return format(startOfMonth(new Date(selYear, periodMonth - 1)), 'yyyy-MM-dd');
  }, [periodMode, customFrom, selYear, periodMonth]);

  const periodTo = useMemo(() => {
    if (periodMode === 'custom' && customTo) return customTo;
    return format(endOfMonth(new Date(selYear, periodMonth - 1)), 'yyyy-MM-dd');
  }, [periodMode, customTo, selYear, periodMonth]);

  /* ══════════════════════════════════════════════════════════════════════════
     QUERIES
  ══════════════════════════════════════════════════════════════════════════ */
  const ytdExpQ = useQuery<Expense[]>({
    queryKey: ['exp-ytd', ytdFrom, ytdTo],
    queryFn: () => axios.get(`/api/expenses?dateFrom=${ytdFrom}&dateTo=${ytdTo}&limit=2000`).then(r => r.data),
  });
  const ytdIncQ = useQuery<Income[]>({
    queryKey: ['inc-ytd', ytdFrom, ytdTo],
    queryFn: () => axios.get(`/api/income?dateFrom=${ytdFrom}&dateTo=${ytdTo}&limit=2000`).then(r => r.data),
  });
  const budQ = useQuery<{ monthly: BudgetCat[]; yearly: BudgetCat[] }>({
    queryKey: ['budgets', periodMonth, selYear],
    queryFn: () => axios.get(`/api/budgets?month=${periodMonth}&year=${selYear}`).then(r => r.data),
  });
  const savQ = useQuery<{ goals: SavingsGoal[] }>({
    queryKey: ['savings-goals'],
    queryFn: () => axios.get('/api/savings-goals').then(r => r.data),
  });

  /* ─── Raw data (account-filtered) ──────────────────────────────────────── */
  const ytdExpenses = useMemo(() => {
    const data = ytdExpQ.data ?? [];
    return accountFilter ? data.filter(e => e.paidBy?.toLowerCase() === accountFilter) : data;
  }, [ytdExpQ.data, accountFilter]);

  const ytdIncome = useMemo(() => {
    const data = ytdIncQ.data ?? [];
    return accountFilter ? data.filter(i => i.receivedBy?.toLowerCase() === accountFilter) : data;
  }, [ytdIncQ.data, accountFilter]);

  const budgets = [...(budQ.data?.monthly ?? []), ...(budQ.data?.yearly ?? [])];
  const goals   = savQ.data?.goals ?? [];

  /* ─── Period filter ─────────────────────────────────────────────────────── */
  const periodExpenses = useMemo(() =>
    ytdExpenses.filter(e => e.date >= periodFrom && e.date.slice(0,10) <= periodTo),
    [ytdExpenses, periodFrom, periodTo]);
  const periodIncome = useMemo(() =>
    ytdIncome.filter(i => i.date >= periodFrom && i.date.slice(0,10) <= periodTo),
    [ytdIncome, periodFrom, periodTo]);

  /* ─── YTD Totals ────────────────────────────────────────────────────────── */
  const ytdTotalInc     = ytdIncome.reduce((s, x) => s + x.amount, 0);
  const ytdTotalExp     = ytdExpenses.reduce((s, x) => s + x.amount, 0);
  const ytdNetSavings   = ytdTotalInc - ytdTotalExp;
  const ytdMarkedSavings = ytdExpenses.filter(e => e.expenseType === 'Savings').reduce((s, e) => s + e.amount, 0);
  const ytdSavingsRate  = ytdTotalInc > 0 ? (ytdMarkedSavings / ytdTotalInc) * 100 : 0;

  /* ─── Period Totals ─────────────────────────────────────────────────────── */
  const perTotalInc = periodIncome.reduce((s, x) => s + x.amount, 0);
  const perTotalExp = periodExpenses.reduce((s, x) => s + x.amount, 0);
  const perSavings  = perTotalInc - perTotalExp;

  /* ─── Chart data ────────────────────────────────────────────────────────── */
  const expByCat = useMemo(() => {
    const m: Record<string, number> = {};
    ytdExpenses.filter(e => e.expenseType !== 'Savings').forEach(e => { m[e.category] = (m[e.category] ?? 0) + e.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [ytdExpenses]);

  const incByCat = useMemo(() => {
    const m: Record<string, number> = {};
    ytdIncome.forEach(i => { m[i.category] = (m[i.category] ?? 0) + i.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [ytdIncome]);

  const savingsByCat = useMemo(() => {
    const m: Record<string, number> = {};
    ytdExpenses.filter(e => e.expenseType === 'Savings').forEach(e => {
      const key = e.category || 'Savings';
      m[key] = (m[key] ?? 0) + e.amount;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [ytdExpenses]);

  const combinedByCat = useMemo(() => {
    const cats = new Set([...expByCat.map(x => x.name), ...incByCat.map(x => x.name)]);
    return Array.from(cats).map(name => ({
      name,
      income:  incByCat.find(x => x.name === name)?.value ?? 0,
      expense: expByCat.find(x => x.name === name)?.value ?? 0,
    })).sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
  }, [expByCat, incByCat]);

  const monthlyData = useMemo(() =>
    MONTHS.map((m, i) => {
      const mn = i + 1;
      const prefix = `${selYear}-${String(mn).padStart(2,'0')}`;
      return {
        name: m,
        income:  ytdIncome.filter(x => x.date.startsWith(prefix)).reduce((s, x) => s + x.amount, 0),
        expense: ytdExpenses.filter(x => x.date.startsWith(prefix)).reduce((s, x) => s + x.amount, 0),
      };
    }), [ytdIncome, ytdExpenses, selYear]);

  /* ─── Sorted base lists ─────────────────────────────────────────────────── */
  const allTxBase = useMemo(() => {
    const merged = [
      ...periodExpenses.map(x => ({ ...x, txType: 'expense' as const })),
      ...periodIncome.map(x => ({ ...x, txType: 'income' as const })),
    ];
    return sortBy(merged as Record<string, unknown>[], txSort.col, txSort.dir) as typeof merged;
  }, [periodExpenses, periodIncome, txSort]);

  /* ─── Tx column filter unique values ────────────────────────────────────── */
  const txUniqueCategories = useMemo(() =>
    [...new Set(allTxBase.map(t => t.category).filter(Boolean))].sort(), [allTxBase]);
  const txUniqueTypes = useMemo(() =>
    [...new Set(allTxBase.map(t => t.expenseType ?? '').filter(Boolean))].sort(), [allTxBase]);
  const txUniqueAccounts = useMemo(() =>
    [...new Set(allTxBase.map(t =>
      t.txType === 'income' ? (t as unknown as Income).receivedBy : (t as unknown as Expense).paidBy
    ).filter(Boolean))].sort(), [allTxBase]);

  /* ─── Filtered transactions ─────────────────────────────────────────────── */
  const allTx = useMemo(() => {
    return allTxBase.filter(tx => {
      if (txF.dateFrom && tx.date.slice(0,10) < txF.dateFrom) return false;
      if (txF.dateTo   && tx.date.slice(0,10) > txF.dateTo)   return false;
      if (txF.category && tx.category !== txF.category) return false;
      if (txF.expenseType && (tx.expenseType ?? '') !== txF.expenseType) return false;
      if (txF.txType && tx.txType !== txF.txType) return false;
      if (txF.account) {
        const acct = tx.txType === 'income'
          ? (tx as unknown as Income).receivedBy
          : (tx as unknown as Expense).paidBy;
        if (acct !== txF.account) return false;
      }
      const mn = parseFloat(txF.amtMin); const mx = parseFloat(txF.amtMax);
      if (!isNaN(mn) && tx.amount < mn) return false;
      if (!isNaN(mx) && tx.amount > mx) return false;
      return true;
    });
  }, [allTxBase, txF]);

  const sortedIncome   = useMemo(() =>
    sortBy(periodIncome as unknown as Record<string,unknown>[], incSort.col, incSort.dir) as unknown as Income[],
    [periodIncome, incSort]);
  const sortedExpenses = useMemo(() =>
    sortBy(periodExpenses as unknown as Record<string,unknown>[], expSort.col, expSort.dir) as unknown as Expense[],
    [periodExpenses, expSort]);

  /* ══════════════════════════════════════════════════════════════════════════
     MUTATIONS
  ══════════════════════════════════════════════════════════════════════════ */
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['exp-ytd'] });
    qc.invalidateQueries({ queryKey: ['inc-ytd'] });
  };

  const saveExpMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => d.id ? axios.put(`/api/expenses/${d.id}`, d) : axios.post('/api/expenses', d),
    onSuccess: () => { invalidate(); setTxModal({ open: false, type: 'expense' }); toast('Saved ✓', 'success'); },
    onError: () => toast('Save failed', 'error'),
  });
  const delExpMut = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/expenses/${id}`),
    onSuccess: () => { invalidate(); setSelExp(new Set()); setSelTx(new Set()); toast('Deleted', 'success'); },
    onError: () => toast('Delete failed', 'error'),
  });
  const saveIncMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => d.id ? axios.put(`/api/income/${d.id}`, d) : axios.post('/api/income', d),
    onSuccess: () => { invalidate(); setTxModal({ open: false, type: 'income' }); toast('Saved ✓', 'success'); },
    onError: () => toast('Save failed', 'error'),
  });
  const delIncMut = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/income/${id}`),
    onSuccess: () => { invalidate(); setSelInc(new Set()); setSelTx(new Set()); toast('Deleted', 'success'); },
    onError: () => toast('Delete failed', 'error'),
  });
  const markSavingsMut = useMutation({
    mutationFn: ({ id, isSavings }: { id: string; isSavings: boolean }) =>
      axios.put(`/api/expenses/${id}`, { expenseType: isSavings ? 'Savings' : '' }),
    onSuccess: () => { invalidate(); toast('Updated ✓', 'success'); },
    onError: () => toast('Update failed', 'error'),
  });

  async function bulkDeleteExp(ids: string[]) {
    if (!confirm(`Delete ${ids.length} expense(s)?`)) return;
    await Promise.all(ids.map(id => axios.delete(`/api/expenses/${id}`)));
    invalidate(); setSelExp(new Set()); setSelTx(new Set());
    toast(`Deleted ${ids.length}`, 'success');
  }
  async function bulkDeleteInc(ids: string[]) {
    if (!confirm(`Delete ${ids.length} income record(s)?`)) return;
    await Promise.all(ids.map(id => axios.delete(`/api/income/${id}`)));
    invalidate(); setSelInc(new Set()); setSelTx(new Set());
    toast(`Deleted ${ids.length}`, 'success');
  }
  async function bulkDeleteTx(items: { id: string; txType: 'expense' | 'income' }[]) {
    if (!confirm(`Delete ${items.length} transaction(s)?`)) return;
    await Promise.all(items.map(({ id, txType }) =>
      txType === 'expense' ? axios.delete(`/api/expenses/${id}`) : axios.delete(`/api/income/${id}`)
    ));
    invalidate(); setSelTx(new Set());
    toast(`Deleted ${items.length}`, 'success');
  }

  const saveBudgetMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => d.id ? axios.put(`/api/budgets/${d.id}`, d) : axios.post('/api/budgets', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); setBudgetModal(false); toast('Budget saved ✓', 'success'); },
  });
  const delBudgetMut = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/budgets/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); toast('Deleted', 'success'); },
  });
  const saveSavingMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => d.id ? axios.put(`/api/savings-goals/${d.id}`, d) : axios.post('/api/savings-goals', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['savings-goals'] }); setSavingModal(false); toast('Goal saved ✓', 'success'); },
  });
  const delSavingMut = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/savings-goals/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['savings-goals'] }); toast('Deleted', 'success'); },
  });

  /* ══════════════════════════════════════════════════════════════════════════
     EXCEL UPLOAD
  ══════════════════════════════════════════════════════════════════════════ */
  function parseAmount(val: unknown): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      let s = val.replace(/[€$£¥₹\s+]/g, '').trim();
      if (!s) return 0;
      const lastComma = s.lastIndexOf(','); const lastDot = s.lastIndexOf('.');
      if (lastComma > lastDot) { s = s.replace(/\./g, '').replace(',', '.'); }
      else { s = s.replace(/,/g, ''); }
      return parseFloat(s) || 0;
    }
    return 0;
  }

  function parseDate(val: unknown): string {
    if (!val && val !== 0) return '';
    if (val instanceof Date) return isNaN(val.getTime()) ? '' : format(val, 'yyyy-MM-dd');
    if (typeof val === 'number') {
      try { const d = XLSX.SSF.parse_date_code(val); return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`; }
      catch { return ''; }
    }
    if (typeof val === 'string') {
      const s = val.trim(); if (!s) return '';
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
      if (dmy) { const [, d, m, y] = dmy; return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; }
      const p = new Date(s); return isNaN(p.getTime()) ? '' : format(p, 'yyyy-MM-dd');
    }
    return '';
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
    if (!rows.length) { toast('No data found in file', 'error'); return; }

    const allParsed = rows.map(raw => {
      const r: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) r[normaliseKey(k)] = v;
      const rawDate   = r['date'] ?? r['datum'] ?? r['transactiondate'] ?? r['transaction_date'] ?? '';
      const rawAmt    = r['amount'] ?? r['bedrag'] ?? r['amt'] ?? r['value'] ?? '';
      const rawDesc   = r['description'] ?? r['omschrijving'] ?? r['desc'] ?? r['memo'] ?? r['naam_omschrijving'] ?? '';
      const rawAcctU  = r['account_user'] ?? r['accountuser'] ?? r['account'] ?? r['gebruiker'] ?? r['paid_by'] ?? '';
      const rawTxType = r['transaction_type'] ?? r['transactiontype'] ?? r['type'] ?? r['bij_af'] ?? r['af_bij'] ?? '';
      const rawAcctT  = r['account_type'] ?? r['accounttype'] ?? r['bank'] ?? r['bank_account'] ?? '';
      const rawCat    = r['category'] ?? r['categorie'] ?? r['cat'] ?? '';
      const rawExpT   = r['expense_type'] ?? r['expensetype'] ?? r['type_of_expense'] ?? '';
      const dateStr   = parseDate(rawDate);
      const amount    = parseAmount(rawAmt);
      const txStr     = String(rawTxType).toLowerCase().trim();
      let type: 'credit' | 'debit';
      if (['credit','bij','in','income','inkomsten','ontvangen','cr','c','+'].includes(txStr)) type = 'credit';
      else if (['debit','af','uit','expense','debet','dr','d','-'].includes(txStr)) type = 'debit';
      else type = amount < 0 ? 'credit' : 'debit';
      return {
        date: dateStr, amount: Math.abs(amount),
        description: String(rawDesc).trim() || 'No description',
        accountUser: String(rawAcctU).trim(), type,
        accountType: String(rawAcctT).trim(),
        category:    String(rawCat).trim() || 'Other',
        expenseType: String(rawExpT).trim(),
      };
    });

    const transactions = allParsed.filter(tx => tx.amount > 0 && tx.date);
    const skipped = allParsed.length - transactions.length;
    if (!transactions.length) {
      const sampleKeys = rows[0] ? Object.keys(rows[0]).join(', ') : 'none';
      toast(`No valid rows. Columns found: ${sampleKeys}`, 'error'); return;
    }
    if (skipped > 0) toast(`Skipped ${skipped} row(s) with missing date or zero amount`, 'warning');
    const overwrite = !!(uploadDateFrom && uploadDateTo);
    const msg = overwrite
      ? `Import ${transactions.length} transactions and OVERWRITE ${uploadDateFrom} → ${uploadDateTo}?`
      : `Import ${transactions.length} transactions (append)?`;
    if (!confirm(msg)) return;
    setUploading(true);
    try {
      const res = await axios.post('/api/bank-upload', { transactions, dateFrom: uploadDateFrom || undefined, dateTo: uploadDateTo || undefined, overwrite });
      const { imported, debits, credits } = res.data;
      toast(`✓ Imported ${imported} (${credits} income, ${debits} expenses)`, 'success');
      invalidate();
    } catch { toast('Upload failed', 'error'); }
    finally { setUploading(false); }
  }

  /* ── Modal helpers ──────────────────────────────────────────────────────── */
  function openTxModal(type: TxType, item?: Expense | Income) {
    setTxModal({ open: true, type, item });
    if (item) {
      if (type === 'expense') {
        const e = item as Expense;
        setTxForm({ id: e.id, amount: e.amount, category: e.category, description: e.description, date: e.date.split('T')[0], paidBy: e.paidBy, bankAccount: e.bankAccount ?? '', expenseType: e.expenseType ?? '', notes: e.notes ?? '' });
      } else {
        const i = item as Income;
        setTxForm({ id: i.id, amount: i.amount, source: i.source, category: i.category, date: i.date.split('T')[0], receivedBy: i.receivedBy, expenseType: i.expenseType ?? '', notes: i.notes ?? '' });
      }
    } else { setTxForm(type === 'expense' ? blankExp() : blankInc()); }
  }

  /* ── Checkbox helpers ───────────────────────────────────────────────────── */
  function toggleId(set: Set<string>, id: string) { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); return n; }
  function allSelected(ids: string[], sel: Set<string>) { return ids.length > 0 && ids.every(id => sel.has(id)); }
  function toggleAll(ids: string[], sel: Set<string>, setter: (s: Set<string>) => void) {
    setter(allSelected(ids, sel) ? new Set() : new Set(ids));
  }

  /* ─── Style helpers ─────────────────────────────────────────────────────── */
  const inp = 'w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500';
  const sel = `${inp} cursor-pointer`;
  const fcls = 'w-full text-[10px] bg-slate-700/60 border border-slate-600/60 text-slate-300 rounded px-1.5 py-1 focus:outline-none focus:border-blue-500/60 placeholder-slate-600';

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col min-h-full bg-slate-900">
      <Header title="Finance" subtitle="Finance" />

      <div className="flex-1 p-4 md:p-6 space-y-4 max-w-7xl mx-auto w-full">

        {/* ══ GLOBAL ACCOUNT USER FILTER ════════════════════════════════════ */}
        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <Users size={13} /> View by
          </div>
          <div className="flex gap-1">
            {([
              { label: 'All Accounts',  value: ''       },
              { label: '👤 Sunil',      value: 'sunil'  },
              { label: '👤 Vidhya',     value: 'vidhya' },
              { label: '🤝 Shared',     value: 'shared' },
            ] as { label: string; value: '' | 'sunil' | 'vidhya' | 'shared' }[]).map(({ label, value }) => (
              <button key={value} onClick={() => setAccountFilter(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  accountFilter === value
                    ? value === ''       ? 'bg-slate-600 text-slate-100 shadow-sm'
                    : value === 'sunil'  ? 'bg-blue-600 text-white shadow-sm'
                    : value === 'vidhya' ? 'bg-violet-600 text-white shadow-sm'
                    :                     'bg-slate-600 text-white shadow-sm'
                    : 'bg-slate-700/40 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}>
                {label}
              </button>
            ))}
          </div>
          {accountFilter && (
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-slate-500">Showing data for</span>
              <span className={`font-bold ${accountFilter === 'sunil' ? 'text-blue-400' : accountFilter === 'vidhya' ? 'text-violet-400' : 'text-slate-300'}`}>
                {accountFilter.charAt(0).toUpperCase() + accountFilter.slice(1)}
              </span>
              <span className="text-slate-500">only</span>
              <button onClick={() => setAccountFilter('')}
                className="ml-1 p-0.5 text-slate-600 hover:text-red-400 transition-colors rounded">
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        {/* ══ THREE BIG PARENT TABS ══════════════════════════════════════════ */}
        <div className="flex gap-1 p-1 bg-slate-800 border border-slate-700 rounded-2xl">
          {([
            { id: 'ytd',     label: 'YTD Overview',     icon: BarChart2 },
            { id: 'monthly', label: 'Monthly Overview',  icon: Calendar },
            { id: 'upload',  label: 'Excel Upload',      icon: Upload },
          ] as { id: ParentTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setParentTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${parentTab === id
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'}`}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            PARENT TAB: YTD OVERVIEW
        ════════════════════════════════════════════════════════════════════ */}
        {parentTab === 'ytd' && (
          <div className="space-y-4">
            {/* Year nav */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"><ChevronLeft size={16} /></button>
                  <span className="text-slate-100 font-semibold text-base w-28 text-center">
                    {selYear === CUR_Y ? `${selYear} — YTD` : String(selYear)}
                  </span>
                  <button onClick={() => setSelYear(y => Math.min(y + 1, CUR_Y))} disabled={selYear >= CUR_Y}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-30">
                    <ChevronRight size={16} />
                  </button>
                </div>
                <span className="text-xs text-slate-600">{ytdFrom} → {ytdTo}</span>
              </div>

              {/* 5-card banner */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { label: 'YTD Income',   value: ytdTotalInc,    icon: ArrowUpCircle,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20' },
                  { label: 'YTD Expenses', value: ytdTotalExp,    icon: ArrowDownCircle,color: 'text-red-400',     bg: 'bg-red-500/10 border border-red-500/20' },
                  { label: 'Savings',      value: ytdMarkedSavings, icon: PiggyBank,    color: 'text-violet-400',  bg: 'bg-violet-500/10 border border-violet-500/20' },
                  { label: 'Net Balance',  value: ytdNetSavings,  icon: TrendingUp,     color: ytdNetSavings >= 0 ? 'text-blue-400' : 'text-red-400', bg: 'bg-blue-500/10 border border-blue-500/20' },
                  { label: 'Savings Rate', value: `${ytdSavingsRate.toFixed(1)}%`, icon: Target, color: 'text-amber-400', bg: 'bg-amber-500/10 border border-amber-500/20' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`rounded-xl p-3 flex items-center gap-3 ${bg}`}>
                    <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className={`font-bold text-base ${color}`}>
                        {typeof value === 'number' ? formatEur(value) : value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly bar chart */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Monthly Overview — {selYear}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 8 }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                    itemStyle={{ color: '#cbd5e1' }}
                    formatter={(v: number) => formatEur(v)} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  <Bar dataKey="income"  name="Income"  fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie charts: Expenses, Income, Savings */}
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: 'Expenses by Category', data: expByCat,      colors: PIE_COLORS  },
                { title: 'Income by Category',   data: incByCat,      colors: PIE_COLORS  },
                { title: 'Savings Allocation',   data: savingsByCat,  colors: SAVINGS_PIE },
              ].map(({ title, data, colors }) => (
                <div key={title} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
                  {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                      <PiggyBank size={28} className="mb-2 opacity-30" />
                      <p className="text-xs">No data for {selYear}</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={data}
                          cx="50%" cy="45%"
                          outerRadius={100}
                          innerRadius={40}
                          dataKey="value"
                          paddingAngle={2}>
                          {data.map((_: unknown, i: number) => (
                            <Cell key={i} fill={colors[i % colors.length]} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTip />} />
                        <Legend
                          formatter={(value: string) => (
                            <span style={{ color: '#cbd5e1', fontSize: 11 }}>{value}</span>
                          )}
                          wrapperStyle={{ paddingTop: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ))}
            </div>

            {/* Category breakdown table */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">Category Breakdown (YTD)</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-5 py-2.5 text-left text-xs text-slate-400 font-medium">Category</th>
                    <th className="px-5 py-2.5 text-right text-xs text-slate-400 font-medium">Income</th>
                    <th className="px-5 py-2.5 text-right text-xs text-slate-400 font-medium">Expense</th>
                    <th className="px-5 py-2.5 text-right text-xs text-slate-400 font-medium">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {combinedByCat.map(row => (
                    <tr key={row.name} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-2.5 text-slate-200 font-medium">{row.name}</td>
                      <td className="px-5 py-2.5 text-right text-emerald-400">{row.income > 0 ? formatEur(row.income) : '—'}</td>
                      <td className="px-5 py-2.5 text-right text-red-400">{row.expense > 0 ? formatEur(row.expense) : '—'}</td>
                      <td className={`px-5 py-2.5 text-right font-semibold ${row.income - row.expense >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {formatEur(row.income - row.expense)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PARENT TAB: MONTHLY OVERVIEW
        ════════════════════════════════════════════════════════════════════ */}
        {parentTab === 'monthly' && (
          <div className="space-y-4">
            {/* Period Filter */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Period</span>
                <div className="flex gap-1">
                  {(['month','custom'] as PeriodMode[]).map(m => (
                    <button key={m} onClick={() => setPeriodMode(m)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${periodMode === m ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}>
                      {m === 'month' ? 'Monthly' : 'Custom Range'}
                    </button>
                  ))}
                </div>
              </div>

              {periodMode === 'month' ? (
                <div className="flex flex-wrap gap-1.5">
                  {MONTHS.map((m, i) => {
                    const mn = i + 1;
                    const isFuture = selYear === CUR_Y && mn > CUR_M;
                    const exp = ytdExpenses.filter(x => x.date.startsWith(`${selYear}-${String(mn).padStart(2,'0')}`)).reduce((s, x) => s + x.amount, 0);
                    return (
                      <button key={m} onClick={() => !isFuture && setPeriodMonth(mn)} disabled={isFuture}
                        className={`flex flex-col items-center min-w-[52px] px-2.5 py-2 rounded-lg text-xs transition-all
                          ${isFuture ? 'opacity-25 cursor-not-allowed bg-slate-700/20'
                            : periodMonth === mn ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}>
                        <span className="font-semibold">{m}</span>
                        {!isFuture && exp > 0 && (
                          <span className={`text-[10px] mt-0.5 ${periodMonth === mn ? 'text-blue-200' : 'text-slate-500'}`}>
                            {formatEur(exp)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-1.5 text-sm" />
                  <span className="text-slate-600 text-sm">→</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-1.5 text-sm" />
                  {(customFrom || customTo) && (
                    <button onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><X size={14} /></button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 pt-3 mt-3 border-t border-slate-700/50 text-xs flex-wrap">
                <span className="text-slate-500 font-medium">
                  {periodMode === 'month'
                    ? `${MONTHS[periodMonth-1]} ${selYear}`
                    : (customFrom && customTo ? `${customFrom} → ${customTo}` : 'Select dates')}
                </span>
                <span className="text-emerald-400">+{formatEur(perTotalInc)}</span>
                <span className="text-red-400">-{formatEur(perTotalExp)}</span>
                <span className={`font-semibold ${perSavings >= 0 ? 'text-blue-400' : 'text-red-400'}`}>net {formatEur(perSavings)}</span>
                <span className="text-slate-600">({periodExpenses.length + periodIncome.length} txns)</span>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700/50 flex-wrap">
              {([
                { id: 'transactions', label: 'Transactions', icon: List },
                { id: 'income',       label: 'Income',       icon: ArrowUpCircle },
                { id: 'expenses',     label: 'Expenses',     icon: ArrowDownCircle },
                { id: 'budget',       label: 'Budget',       icon: DollarSign },
                { id: 'savings',      label: 'Savings',      icon: Target },
              ] as { id: SubTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setSubTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${subTab === id ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>

            {/* ── SUB-TAB: TRANSACTIONS ── */}
            {subTab === 'transactions' && (() => {
              const txIds  = allTx.map(x => x.id);
              const selList = allTx.filter(x => selTx.has(x.id));
              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-slate-200">
                        All Transactions <span className="text-slate-500">({allTx.length}
                        {hasFilter && <span className="text-blue-400"> filtered</span>})</span>
                      </h3>
                      {selTx.size > 0 && (
                        <button onClick={() => bulkDeleteTx(selList.map(x => ({ id: x.id, txType: x.txType })))}
                          className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg text-xs transition-colors">
                          <Trash2 size={12} /> Delete {selTx.size}
                        </button>
                      )}
                      {hasFilter && (
                        <button onClick={() => setTxF(emptyTxF)}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs transition-colors">
                          <X size={11} /> Clear filters
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openTxModal('income')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-medium transition-colors"><Plus size={13} /> Income</button>
                      <button onClick={() => openTxModal('expense')} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg font-medium transition-colors"><Plus size={13} /> Expense</button>
                    </div>
                  </div>

                  {ytdExpQ.isLoading || ytdIncQ.isLoading ? <LoadingSpinner /> : (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-700/50 border-b border-slate-700">
                            {/* Sort headers */}
                            <tr>
                              <th className="px-3 py-2.5 w-8 text-left">
                                <button onClick={() => toggleAll(txIds, selTx, setSelTx)}>
                                  {allSelected(txIds, selTx) ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} className="text-slate-500" />}
                                </button>
                              </th>
                              <SortTh col="date"        label="Date"        sortCol={txSort.col} sortDir={txSort.dir} onSort={c => setTxSort(s => toggleSort(s, c))} />
                              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Description</th>
                              <SortTh col="category"    label="Category"    sortCol={txSort.col} sortDir={txSort.dir} onSort={c => setTxSort(s => toggleSort(s, c))} />
                              <SortTh col="expenseType" label="Type"        sortCol={txSort.col} sortDir={txSort.dir} onSort={c => setTxSort(s => toggleSort(s, c))} />
                              <SortTh col="txType"      label="Dr/Cr"       sortCol={txSort.col} sortDir={txSort.dir} onSort={c => setTxSort(s => toggleSort(s, c))} />
                              <SortTh col="paidBy"      label="Account"     sortCol={txSort.col} sortDir={txSort.dir} onSort={c => setTxSort(s => toggleSort(s, c))} />
                              <SortTh col="amount"      label="Amount"      sortCol={txSort.col} sortDir={txSort.dir} onSort={c => setTxSort(s => toggleSort(s, c))} className="text-right" />
                              <th className="w-20" />
                            </tr>
                            {/* Filter row */}
                            <tr className="border-t border-slate-700/60 bg-slate-800/80">
                              <td className="px-2 py-1.5" />
                              {/* Date filter */}
                              <td className="px-2 py-1.5 min-w-[120px]">
                                <input type="date" value={txF.dateFrom} onChange={e => setTxF(p => ({ ...p, dateFrom: e.target.value }))} className={fcls} title="From date" />
                                <input type="date" value={txF.dateTo} onChange={e => setTxF(p => ({ ...p, dateTo: e.target.value }))} className={`${fcls} mt-0.5`} title="To date" />
                              </td>
                              {/* Description – no filter */}
                              <td className="px-2 py-1.5 text-[9px] text-slate-600 italic">no filter</td>
                              {/* Category */}
                              <td className="px-2 py-1.5 min-w-[100px]">
                                <select value={txF.category} onChange={e => setTxF(p => ({ ...p, category: e.target.value }))} className={fcls}>
                                  <option value="">All</option>
                                  {txUniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </td>
                              {/* Type */}
                              <td className="px-2 py-1.5 min-w-[90px]">
                                <select value={txF.expenseType} onChange={e => setTxF(p => ({ ...p, expenseType: e.target.value }))} className={fcls}>
                                  <option value="">All</option>
                                  {txUniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </td>
                              {/* Dr/Cr */}
                              <td className="px-2 py-1.5 min-w-[80px]">
                                <select value={txF.txType} onChange={e => setTxF(p => ({ ...p, txType: e.target.value }))} className={fcls}>
                                  <option value="">All</option>
                                  <option value="income">Credit</option>
                                  <option value="expense">Debit</option>
                                </select>
                              </td>
                              {/* Account */}
                              <td className="px-2 py-1.5 min-w-[90px]">
                                <select value={txF.account} onChange={e => setTxF(p => ({ ...p, account: e.target.value }))} className={fcls}>
                                  <option value="">All</option>
                                  {txUniqueAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                              </td>
                              {/* Amount range */}
                              <td className="px-2 py-1.5 min-w-[80px]">
                                <input type="number" placeholder="Min €" value={txF.amtMin} onChange={e => setTxF(p => ({ ...p, amtMin: e.target.value }))} className={fcls} />
                                <input type="number" placeholder="Max €" value={txF.amtMax} onChange={e => setTxF(p => ({ ...p, amtMax: e.target.value }))} className={`${fcls} mt-0.5`} />
                              </td>
                              <td className="px-2 py-1.5">
                                {hasFilter && (
                                  <button onClick={() => setTxF(emptyTxF)} title="Clear filters"
                                    className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded">
                                    <X size={12} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/40">
                            {allTx.length === 0 ? (
                              <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-500 text-sm">
                                {hasFilter ? 'No transactions match the active filters' : 'No transactions for this period'}
                              </td></tr>
                            ) : allTx.map(tx => {
                              const isInc   = tx.txType === 'income';
                              const desc    = isInc ? (tx as unknown as Income).source : (tx as unknown as Expense).description;
                              const acct    = isInc ? (tx as unknown as Income).receivedBy : (tx as unknown as Expense).paidBy;
                              const isSel   = selTx.has(tx.id);
                              const isSavings = tx.expenseType === 'Savings';
                              return (
                                <tr key={tx.id} className={`hover:bg-slate-700/30 transition-colors
                                  ${isSel ? 'bg-blue-500/5' : ''}
                                  ${isSavings ? 'bg-violet-500/5' : ''}`}>
                                  <td className="px-3 py-2.5">
                                    <button onClick={() => setSelTx(s => toggleId(s, tx.id))}>
                                      {isSel ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} className="text-slate-600" />}
                                    </button>
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap text-xs">{fmtDate(tx.date)}</td>
                                  <td className="px-3 py-2.5 text-slate-200 max-w-[180px] truncate" title={desc}>{desc}</td>
                                  <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">{tx.category}</span></td>
                                  <td className="px-3 py-2.5">
                                    {isSavings
                                      ? <span className="px-1.5 py-0.5 bg-violet-500/15 text-violet-400 border border-violet-500/20 rounded text-xs flex items-center gap-1 w-fit"><PiggyBank size={10} />Savings</span>
                                      : <span className="text-xs text-slate-500">{tx.expenseType || '—'}</span>}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={`flex items-center gap-1 text-xs font-medium ${isInc ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {isInc ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                                      {isInc ? 'Credit' : 'Debit'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-xs text-slate-500 capitalize">{acct}</td>
                                  <td className={`px-3 py-2.5 text-right font-semibold ${isInc ? 'text-emerald-400' : isSavings ? 'text-violet-400' : 'text-red-400'}`}>
                                    {isInc ? '+' : '-'}{formatEur(tx.amount)}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex gap-1 justify-end items-center">
                                      {!isInc && (
                                        <button
                                          onClick={() => markSavingsMut.mutate({ id: tx.id, isSavings: !isSavings })}
                                          title={isSavings ? 'Unmark savings' : 'Mark as savings'}
                                          className={`p-1 rounded transition-colors ${isSavings ? 'text-violet-400 hover:text-violet-300' : 'text-slate-600 hover:text-violet-400'}`}>
                                          <PiggyBank size={13} />
                                        </button>
                                      )}
                                      <button onClick={() => openTxModal(tx.txType, tx)} className="p-1 text-slate-500 hover:text-blue-400 rounded transition-colors"><Pencil size={13} /></button>
                                      <button onClick={() => { if (!confirm('Delete?')) return; isInc ? delIncMut.mutate(tx.id) : delExpMut.mutate(tx.id); }} className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"><Trash2 size={13} /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── SUB-TAB: INCOME ── */}
            {subTab === 'income' && (() => {
              const ids = sortedIncome.map(x => x.id);
              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-slate-200">Income — <span className="text-emerald-400">{formatEur(perTotalInc)}</span> <span className="text-slate-500">({sortedIncome.length})</span></h3>
                      {selInc.size > 0 && (
                        <button onClick={() => bulkDeleteInc(Array.from(selInc))}
                          className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg text-xs transition-colors">
                          <Trash2 size={12} /> Delete {selInc.size}
                        </button>
                      )}
                    </div>
                    <button onClick={() => openTxModal('income')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-medium transition-colors"><Plus size={13} /> Add Income</button>
                  </div>
                  {ytdIncQ.isLoading ? <LoadingSpinner /> : sortedIncome.length === 0
                    ? <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-500 text-sm">No income this period</div>
                    : (
                      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-700/50 border-b border-slate-700">
                              <tr>
                                <th className="px-3 py-2.5 w-8 text-left">
                                  <button onClick={() => toggleAll(ids, selInc, setSelInc)}>
                                    {allSelected(ids, selInc) ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} className="text-slate-500" />}
                                  </button>
                                </th>
                                <SortTh col="date"        label="Date"        sortCol={incSort.col} sortDir={incSort.dir} onSort={c => setIncSort(s => toggleSort(s, c))} />
                                <SortTh col="source"      label="Source"      sortCol={incSort.col} sortDir={incSort.dir} onSort={c => setIncSort(s => toggleSort(s, c))} />
                                <SortTh col="category"    label="Category"    sortCol={incSort.col} sortDir={incSort.dir} onSort={c => setIncSort(s => toggleSort(s, c))} />
                                <SortTh col="expenseType" label="Type"        sortCol={incSort.col} sortDir={incSort.dir} onSort={c => setIncSort(s => toggleSort(s, c))} />
                                <SortTh col="receivedBy"  label="Received By" sortCol={incSort.col} sortDir={incSort.dir} onSort={c => setIncSort(s => toggleSort(s, c))} />
                                <SortTh col="amount"      label="Amount"      sortCol={incSort.col} sortDir={incSort.dir} onSort={c => setIncSort(s => toggleSort(s, c))} className="text-right" />
                                <th className="w-16" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/40">
                              {sortedIncome.map(inc => (
                                <tr key={inc.id} className={`hover:bg-slate-700/30 transition-colors ${selInc.has(inc.id) ? 'bg-blue-500/5' : ''}`}>
                                  <td className="px-3 py-2.5"><button onClick={() => setSelInc(s => toggleId(s, inc.id))}>{selInc.has(inc.id) ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} className="text-slate-600" />}</button></td>
                                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap text-xs">{fmtDate(inc.date)}</td>
                                  <td className="px-3 py-2.5 text-slate-200 max-w-[200px] truncate" title={inc.source}>{inc.source}</td>
                                  <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs">{inc.category}</span></td>
                                  <td className="px-3 py-2.5 text-xs text-slate-500">{inc.expenseType || '—'}</td>
                                  <td className="px-3 py-2.5 text-xs text-slate-400 capitalize">{inc.receivedBy}</td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-emerald-400">+{formatEur(inc.amount)}</td>
                                  <td className="px-3 py-2.5"><div className="flex gap-1 justify-end">
                                    <button onClick={() => openTxModal('income', inc)} className="p-1 text-slate-500 hover:text-blue-400 rounded transition-colors"><Pencil size={13} /></button>
                                    <button onClick={() => { if (!confirm('Delete?')) return; delIncMut.mutate(inc.id); }} className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"><Trash2 size={13} /></button>
                                  </div></td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-700/30 border-t border-slate-700">
                              <tr><td colSpan={6} className="px-3 py-2 text-xs font-semibold text-slate-300">Total</td>
                                <td className="px-3 py-2 text-right font-bold text-emerald-400">{formatEur(perTotalInc)}</td><td /></tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )
                  }
                </div>
              );
            })()}

            {/* ── SUB-TAB: EXPENSES ── */}
            {subTab === 'expenses' && (() => {
              const ids = sortedExpenses.map(x => x.id);
              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-slate-200">Expenses — <span className="text-red-400">{formatEur(perTotalExp)}</span> <span className="text-slate-500">({sortedExpenses.length})</span></h3>
                      {selExp.size > 0 && (
                        <button onClick={() => bulkDeleteExp(Array.from(selExp))}
                          className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg text-xs transition-colors">
                          <Trash2 size={12} /> Delete {selExp.size}
                        </button>
                      )}
                    </div>
                    <button onClick={() => openTxModal('expense')} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg font-medium transition-colors"><Plus size={13} /> Add Expense</button>
                  </div>
                  {ytdExpQ.isLoading ? <LoadingSpinner /> : sortedExpenses.length === 0
                    ? <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-500 text-sm">No expenses this period</div>
                    : (
                      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-700/50 border-b border-slate-700">
                              <tr>
                                <th className="px-3 py-2.5 w-8 text-left">
                                  <button onClick={() => toggleAll(ids, selExp, setSelExp)}>
                                    {allSelected(ids, selExp) ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} className="text-slate-500" />}
                                  </button>
                                </th>
                                <SortTh col="date"        label="Date"         sortCol={expSort.col} sortDir={expSort.dir} onSort={c => setExpSort(s => toggleSort(s, c))} />
                                <SortTh col="description" label="Description"  sortCol={expSort.col} sortDir={expSort.dir} onSort={c => setExpSort(s => toggleSort(s, c))} />
                                <SortTh col="category"    label="Category"     sortCol={expSort.col} sortDir={expSort.dir} onSort={c => setExpSort(s => toggleSort(s, c))} />
                                <SortTh col="expenseType" label="Type"         sortCol={expSort.col} sortDir={expSort.dir} onSort={c => setExpSort(s => toggleSort(s, c))} />
                                <SortTh col="paidBy"      label="Paid By"      sortCol={expSort.col} sortDir={expSort.dir} onSort={c => setExpSort(s => toggleSort(s, c))} />
                                <SortTh col="amount"      label="Amount"       sortCol={expSort.col} sortDir={expSort.dir} onSort={c => setExpSort(s => toggleSort(s, c))} className="text-right" />
                                <th className="w-20" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/40">
                              {sortedExpenses.map(exp => {
                                const isSavings = exp.expenseType === 'Savings';
                                return (
                                  <tr key={exp.id} className={`hover:bg-slate-700/30 transition-colors
                                    ${selExp.has(exp.id) ? 'bg-blue-500/5' : ''}
                                    ${isSavings ? 'bg-violet-500/5' : ''}`}>
                                    <td className="px-3 py-2.5"><button onClick={() => setSelExp(s => toggleId(s, exp.id))}>{selExp.has(exp.id) ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} className="text-slate-600" />}</button></td>
                                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap text-xs">{fmtDate(exp.date)}</td>
                                    <td className="px-3 py-2.5 text-slate-200 max-w-[200px] truncate" title={exp.description}>{exp.description}</td>
                                    <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs border ${isSavings ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{exp.category}</span></td>
                                    <td className="px-3 py-2.5">
                                      {isSavings
                                        ? <span className="px-1.5 py-0.5 bg-violet-500/15 text-violet-400 border border-violet-500/20 rounded text-xs flex items-center gap-1 w-fit"><PiggyBank size={10} />Savings</span>
                                        : <span className="text-xs text-slate-500">{exp.expenseType || '—'}</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-slate-400 capitalize">{exp.paidBy}</td>
                                    <td className={`px-3 py-2.5 text-right font-semibold ${isSavings ? 'text-violet-400' : 'text-red-400'}`}>-{formatEur(exp.amount)}</td>
                                    <td className="px-3 py-2.5"><div className="flex gap-1 justify-end items-center">
                                      <button
                                        onClick={() => markSavingsMut.mutate({ id: exp.id, isSavings: !isSavings })}
                                        title={isSavings ? 'Unmark savings' : 'Mark as savings'}
                                        className={`p-1 rounded transition-colors ${isSavings ? 'text-violet-400 hover:text-violet-300' : 'text-slate-600 hover:text-violet-400'}`}>
                                        <PiggyBank size={13} />
                                      </button>
                                      <button onClick={() => openTxModal('expense', exp)} className="p-1 text-slate-500 hover:text-blue-400 rounded transition-colors"><Pencil size={13} /></button>
                                      <button onClick={() => { if (!confirm('Delete?')) return; delExpMut.mutate(exp.id); }} className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"><Trash2 size={13} /></button>
                                    </div></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-slate-700/30 border-t border-slate-700">
                              <tr><td colSpan={6} className="px-3 py-2 text-xs font-semibold text-slate-300">Total</td>
                                <td className="px-3 py-2 text-right font-bold text-red-400">-{formatEur(perTotalExp)}</td><td /></tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )
                  }
                </div>
              );
            })()}

            {/* ── SUB-TAB: BUDGET ── */}
            {subTab === 'budget' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-200">Budgets</h3>
                  <button onClick={() => { setBudgetEdit(null); setBudgetForm({ name:'', icon:'💰', monthlyLimit:'', alertAt:'80', isYearly: false }); setBudgetModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium transition-colors"><Plus size={13} /> Add Budget</button>
                </div>
                {budQ.isLoading ? <LoadingSpinner /> : budgets.length === 0
                  ? <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-500 text-sm">No budgets yet</div>
                  : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {budgets.map(b => (
                        <div key={b.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{b.icon ?? '💰'}</span>
                              <div>
                                <p className="font-medium text-slate-200">{b.name}</p>
                                <p className="text-xs text-slate-500">{b.isYearly ? 'Yearly' : 'Monthly'} · Limit {formatEur(b.monthlyLimit)}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => { setBudgetEdit(b); setBudgetForm({ name: b.name, icon: b.icon ?? '💰', monthlyLimit: String(b.monthlyLimit), alertAt: String(b.alertAt), isYearly: b.isYearly }); setBudgetModal(true); }} className="p-1 text-slate-500 hover:text-blue-400 rounded transition-colors"><Pencil size={13} /></button>
                              <button onClick={() => { if (!confirm('Delete?')) return; delBudgetMut.mutate(b.id); }} className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"><Trash2 size={13} /></button>
                            </div>
                          </div>
                          <ProgressBar value={b.percentage} color={b.status === 'good' ? 'emerald' : b.status === 'warning' ? 'amber' : 'red'} />
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>{formatEur(b.spent)} spent</span>
                            <span className={b.status === 'danger' ? 'text-red-400 font-semibold' : ''}>{b.percentage.toFixed(0)}% {b.status === 'danger' && <AlertTriangle size={11} className="inline" />}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            {/* ── SUB-TAB: SAVINGS ── */}
            {subTab === 'savings' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-200">Savings Goals</h3>
                  <button onClick={() => { setSavingEdit(null); setSavingForm({ name:'', targetAmount:'', startMonth: CUR_M, startYear: selYear, endMonth: CUR_M, endYear: selYear+1, notes:'' }); setSavingModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium transition-colors"><Plus size={13} /> New Goal</button>
                </div>
                {savQ.isLoading ? <LoadingSpinner /> : goals.length === 0
                  ? <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-500 text-sm">No savings goals yet</div>
                  : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {goals.map(g => (
                        <div key={g.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5">
                              <Target size={18} className="text-violet-400 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-slate-200">{g.name}</p>
                                <p className="text-xs text-slate-500">{MONTHS[g.startMonth-1]} {g.startYear} → {MONTHS[g.endMonth-1]} {g.endYear}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => { setSavingEdit(g); setSavingForm({ name: g.name, targetAmount: String(g.targetAmount), startMonth: g.startMonth, startYear: g.startYear, endMonth: g.endMonth, endYear: g.endYear, notes: g.notes ?? '' }); setSavingModal(true); }} className="p-1 text-slate-500 hover:text-blue-400 rounded transition-colors"><Pencil size={13} /></button>
                              <button onClick={() => { if (!confirm('Delete?')) return; delSavingMut.mutate(g.id); }} className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"><Trash2 size={13} /></button>
                            </div>
                          </div>
                          <ProgressBar value={Math.min(g.percentage, 100)} color={g.percentage >= 100 ? 'emerald' : g.percentage >= 60 ? 'blue' : 'amber'} />
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>{formatEur(g.actualSavings)} saved</span>
                            <span>Target {formatEur(g.targetAmount)} · {g.percentage.toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PARENT TAB: EXCEL UPLOAD
        ════════════════════════════════════════════════════════════════════ */}
        {parentTab === 'upload' && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-200 mb-1 flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-blue-400" /> Import Transactions
              </h3>
              <p className="text-xs text-slate-500">
                Supported columns: <span className="font-mono text-slate-400">Date · Amount · Description · Account_user · Transaction_Type · Account_Type · Category · Expense_Type</span>
              </p>
            </div>

            <div className="border border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar size={12} /> Overwrite Date Range
                <span className="text-slate-600 font-normal normal-case">(optional — leave blank to append)</span>
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <input type="date" value={uploadDateFrom} onChange={e => setUploadDateFrom(e.target.value)}
                  className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm" />
                <span className="text-slate-600">→</span>
                <input type="date" value={uploadDateTo} onChange={e => setUploadDateTo(e.target.value)}
                  className="bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm" />
                {(uploadDateFrom || uploadDateTo) && (
                  <button onClick={() => { setUploadDateFrom(''); setUploadDateTo(''); }}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><X size={14} /></button>
                )}
              </div>
              {uploadDateFrom && uploadDateTo && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Existing transactions from {uploadDateFrom} to {uploadDateTo} will be deleted before importing.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-10">
              <div className="text-center">
                <Upload size={36} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-4">Select your Excel or CSV file</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 mx-auto">
                  {uploading ? <LoadingSpinner size="sm" /> : <FileSpreadsheet size={16} />}
                  {uploading ? 'Uploading…' : 'Choose File & Upload'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ════════════════ MODALS ════════════════ */}
      {/* Transaction Modal */}
      <Modal isOpen={txModal.open} onClose={() => setTxModal({ open: false, type: 'expense' })}
        title={`${txForm.id ? 'Edit' : 'Add'} ${txModal.type === 'expense' ? 'Expense' : 'Income'}`}>
        <div className="space-y-3">
          {txModal.type === 'expense' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 block mb-1">Date</label><input type="date" value={String(txForm.date ?? '')} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} className={inp} /></div>
                <div><label className="text-xs text-slate-400 block mb-1">Amount (€)</label><input type="number" min={0} step={0.01} value={String(txForm.amount ?? '')} onChange={e => setTxForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className={inp} /></div>
              </div>
              <div><label className="text-xs text-slate-400 block mb-1">Description</label><input value={String(txForm.description ?? '')} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))} className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 block mb-1">Category</label><select value={String(txForm.category ?? 'Other')} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))} className={sel}>{EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className="text-xs text-slate-400 block mb-1">Expense Type</label><select value={String(txForm.expenseType ?? '')} onChange={e => setTxForm(p => ({ ...p, expenseType: e.target.value }))} className={sel}><option value="">— none —</option>{EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 block mb-1">Paid By</label><select value={String(txForm.paidBy ?? 'sunil')} onChange={e => setTxForm(p => ({ ...p, paidBy: e.target.value }))} className={sel}>{PAID_BY_OPTS.map(o => <option key={o}>{o}</option>)}</select></div>
                <div><label className="text-xs text-slate-400 block mb-1">Account</label><input value={String(txForm.bankAccount ?? '')} onChange={e => setTxForm(p => ({ ...p, bankAccount: e.target.value }))} placeholder="ING, RABO…" className={inp} /></div>
              </div>
              <div><label className="text-xs text-slate-400 block mb-1">Notes</label><input value={String(txForm.notes ?? '')} onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))} className={inp} /></div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 block mb-1">Date</label><input type="date" value={String(txForm.date ?? '')} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} className={inp} /></div>
                <div><label className="text-xs text-slate-400 block mb-1">Amount (€)</label><input type="number" min={0} step={0.01} value={String(txForm.amount ?? '')} onChange={e => setTxForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className={inp} /></div>
              </div>
              <div><label className="text-xs text-slate-400 block mb-1">Source / Description</label><input value={String(txForm.source ?? '')} onChange={e => setTxForm(p => ({ ...p, source: e.target.value }))} className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 block mb-1">Category</label><select value={String(txForm.category ?? 'Salary')} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))} className={sel}>{INCOME_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className="text-xs text-slate-400 block mb-1">Type</label><select value={String(txForm.expenseType ?? '')} onChange={e => setTxForm(p => ({ ...p, expenseType: e.target.value }))} className={sel}><option value="">— none —</option>{EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="text-xs text-slate-400 block mb-1">Received By</label><select value={String(txForm.receivedBy ?? 'sunil')} onChange={e => setTxForm(p => ({ ...p, receivedBy: e.target.value }))} className={sel}>{PAID_BY_OPTS.map(o => <option key={o}>{o}</option>)}</select></div>
              <div><label className="text-xs text-slate-400 block mb-1">Notes</label><input value={String(txForm.notes ?? '')} onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))} className={inp} /></div>
            </>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setTxModal({ open: false, type: 'expense' })} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">Cancel</button>
            <button onClick={() => txModal.type === 'expense' ? saveExpMut.mutate(txForm) : saveIncMut.mutate(txForm)}
              disabled={saveExpMut.isPending || saveIncMut.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {saveExpMut.isPending || saveIncMut.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Budget Modal */}
      <Modal isOpen={budgetModal} onClose={() => setBudgetModal(false)} title={budgetEdit ? 'Edit Budget' : 'Add Budget'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 block mb-1">Name</label><input value={budgetForm.name} onChange={e => setBudgetForm(p => ({ ...p, name: e.target.value }))} className={inp} /></div>
            <div><label className="text-xs text-slate-400 block mb-1">Icon</label><input value={budgetForm.icon} onChange={e => setBudgetForm(p => ({ ...p, icon: e.target.value }))} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 block mb-1">Limit (€)</label><input type="number" value={budgetForm.monthlyLimit} onChange={e => setBudgetForm(p => ({ ...p, monthlyLimit: e.target.value }))} className={inp} /></div>
            <div><label className="text-xs text-slate-400 block mb-1">Alert at (%)</label><input type="number" value={budgetForm.alertAt} onChange={e => setBudgetForm(p => ({ ...p, alertAt: e.target.value }))} className={inp} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" checked={budgetForm.isYearly} onChange={e => setBudgetForm(p => ({ ...p, isYearly: e.target.checked }))} /> Yearly budget</label>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setBudgetModal(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">Cancel</button>
            <button onClick={() => saveBudgetMut.mutate({ ...(budgetEdit ? { id: budgetEdit.id } : {}), name: budgetForm.name, icon: budgetForm.icon, monthlyLimit: parseFloat(budgetForm.monthlyLimit), alertAt: parseInt(budgetForm.alertAt), isYearly: budgetForm.isYearly, month: periodMonth, year: selYear })}
              disabled={saveBudgetMut.isPending} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {saveBudgetMut.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Savings Goal Modal */}
      <Modal isOpen={savingModal} onClose={() => setSavingModal(false)} title={savingEdit ? 'Edit Goal' : 'New Savings Goal'}>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 block mb-1">Goal Name</label><input value={savingForm.name} onChange={e => setSavingForm(p => ({ ...p, name: e.target.value }))} className={inp} /></div>
          <div><label className="text-xs text-slate-400 block mb-1">Target Amount (€)</label><input type="number" value={savingForm.targetAmount} onChange={e => setSavingForm(p => ({ ...p, targetAmount: e.target.value }))} className={inp} /></div>
          <div className="grid grid-cols-2 gap-3">
            {(['start','end'] as const).map(w => (
              <div key={w}><label className="text-xs text-slate-400 block mb-1 capitalize">{w}</label>
                <div className="flex gap-1">
                  <select value={w === 'start' ? savingForm.startMonth : savingForm.endMonth} onChange={e => setSavingForm(p => w === 'start' ? { ...p, startMonth: +e.target.value } : { ...p, endMonth: +e.target.value })} className={`${sel} flex-1`}>{MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                  <input type="number" value={w === 'start' ? savingForm.startYear : savingForm.endYear} onChange={e => setSavingForm(p => w === 'start' ? { ...p, startYear: +e.target.value } : { ...p, endYear: +e.target.value })} className={`${inp} w-20`} />
                </div>
              </div>
            ))}
          </div>
          <div><label className="text-xs text-slate-400 block mb-1">Notes</label><input value={savingForm.notes} onChange={e => setSavingForm(p => ({ ...p, notes: e.target.value }))} className={inp} /></div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setSavingModal(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">Cancel</button>
            <button onClick={() => saveSavingMut.mutate({ ...(savingEdit ? { id: savingEdit.id } : {}), name: savingForm.name, targetAmount: parseFloat(savingForm.targetAmount), startMonth: savingForm.startMonth, startYear: savingForm.startYear, endMonth: savingForm.endMonth, endYear: savingForm.endYear, notes: savingForm.notes })}
              disabled={saveSavingMut.isPending} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {saveSavingMut.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
