'use client';

import { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Tab = 'portfolio' | 'india' | 'us';

const SECTORS = ['Technology','Finance','Healthcare','Energy','Consumer','FMCG','Auto','Other'];
const SECTOR_COLORS: Record<string, string> = { Technology: '#3B82F6', Finance: '#10B981', Healthcare: '#8B5CF6', Energy: '#F59E0B', Consumer: '#EF4444', FMCG: '#06B6D4', Auto: '#F97316', Other: '#94A3B8' };

function formatCurr(n: number, curr = 'EUR') {
  return new Intl.NumberFormat('en', { style: 'currency', currency: curr, maximumFractionDigits: 2 }).format(n);
}

function PLCell({ value, pct }: { value: number; pct: number | null }) {
  const pos = value >= 0;
  return (
    <td className="py-2 px-3 text-right">
      <div className={`font-semibold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>{pos ? '+' : ''}{value.toFixed(2)}</div>
      {pct !== null && <div className={`text-xs ${pos ? 'text-emerald-500' : 'text-red-500'}`}>{pos ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</div>}
    </td>
  );
}

export default function InvestmentsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('portfolio');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({ queryKey: ['investments'], queryFn: () => axios.get('/api/investments').then(r => r.data) });

  const addInv = useMutation({
    mutationFn: (d: Record<string, unknown>) => axios.post('/api/investments', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investments'] }); setShowModal(false); toast('Investment added! +5 XP'); },
    onError: () => toast('Failed to add investment', 'error'),
  });
  const delInv = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/investments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investments'] }); toast('Deleted'); },
  });

  const allInvestments = data ?? [];
  const india = allInvestments.filter((i: { platform: string }) => ['INDIA_STOCK','INDIA_MF'].includes(i.platform));
  const us = allInvestments.filter((i: { platform: string }) => i.platform === 'US_STOCK');

  const totalValue = allInvestments.reduce((s: number, i: { currentValue?: number; currentPrice?: number; units?: number; investedAmount?: number }) => s + (i.currentValue ?? (i.currentPrice && i.units ? i.currentPrice * i.units : (i.investedAmount ?? 0))), 0);
  const totalInvested = allInvestments.reduce((s: number, i: { investedAmount?: number; buyPrice?: number; units?: number }) => s + (i.investedAmount ?? (i.buyPrice && i.units ? i.buyPrice * i.units : 0)), 0);
  const overallPL = totalValue - totalInvested;
  const overallPLPct = totalInvested > 0 ? (overallPL / totalInvested) * 100 : 0;

  const sectorMap: Record<string, number> = {};
  for (const inv of allInvestments) {
    const v = inv.currentValue ?? (inv.currentPrice && inv.units ? inv.currentPrice * inv.units : (inv.investedAmount ?? 0));
    sectorMap[inv.sector] = (sectorMap[inv.sector] ?? 0) + v;
  }
  const sectorData = Object.entries(sectorMap).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100, color: SECTOR_COLORS[name] ?? '#94A3B8' }));

  const openModal = (platform: string) => { setForm({ platform, currency: platform === 'US_STOCK' ? 'EUR' : 'INR', sector: 'Technology' }); setShowModal(true); };

  const InvTable = ({ items }: { items: Array<Record<string, unknown>> }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-slate-400 border-b border-slate-700">{['Name','Sector','Units','Buy','Current','Invested','Value','P&L',''].map(h => <th key={h} className="py-2 px-3 text-right first:text-left font-medium">{h}</th>)}</tr></thead>
        <tbody>
          {items.map((inv: Record<string, unknown>) => {
            const curr = String(inv.currency ?? 'EUR');
            const invested = (inv.investedAmount as number) ?? ((inv.buyPrice as number) && (inv.units as number) ? (inv.buyPrice as number) * (inv.units as number) : 0);
            const value = (inv.currentValue as number) ?? ((inv.currentPrice as number) && (inv.units as number) ? (inv.currentPrice as number) * (inv.units as number) : invested);
            const pl = value - invested;
            const plPct = invested > 0 ? (pl / invested) * 100 : null;
            return (
              <tr key={String(inv.id)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors group">
                <td className="py-2 px-3"><p className="font-medium text-slate-200">{String(inv.name)}</p>{!!inv.ticker && <p className="text-xs text-slate-500">{String(inv.ticker)}</p>}</td>
                <td className="py-2 px-3 text-right"><Badge variant="slate" size="sm">{String(inv.sector)}</Badge></td>
                <td className="py-2 px-3 text-right text-slate-300">{inv.units !== null && inv.units !== undefined ? String(inv.units) : '-'}</td>
                <td className="py-2 px-3 text-right text-slate-400">{(inv.buyPrice as number) ? formatCurr(inv.buyPrice as number, curr) : '-'}</td>
                <td className="py-2 px-3 text-right text-slate-300">{(inv.currentPrice as number) ? formatCurr(inv.currentPrice as number, curr) : '-'}</td>
                <td className="py-2 px-3 text-right text-slate-400">{invested ? formatCurr(invested, curr) : '-'}</td>
                <td className="py-2 px-3 text-right font-medium text-slate-200">{value ? formatCurr(value, curr) : '-'}</td>
                <PLCell value={pl} pct={plPct} />
                <td className="py-2 px-3"><button onClick={() => delInv.mutate(String(inv.id))} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"><Trash2 size={14} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <Header title="Investments" />
      <div className="flex gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700 w-fit">
        {(['portfolio','india','us'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-100'}`}>
            {t === 'portfolio' ? '📊 Portfolio' : t === 'india' ? '🇮🇳 India' : '🇺🇸 US Stocks'}
          </button>
        ))}
      </div>

      {tab === 'portfolio' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Invested', value: formatCurr(totalInvested), color: 'text-slate-100' },
              { label: 'Current Value', value: formatCurr(totalValue), color: 'text-slate-100' },
              { label: 'Overall P&L', value: `${overallPL >= 0 ? '+' : ''}${formatCurr(overallPL)} (${overallPLPct.toFixed(1)}%)`, color: overallPL >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800 rounded-xl border border-slate-700 p-5 text-center">
                <p className="text-xs text-slate-400 mb-1">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          {sectorData.length > 0 && (
            <Card title="Sector Allocation">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={200} className="max-w-xs">
                  <PieChart>
                    <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, pct }) => `${name} ${pct}%`}>
                      {sectorData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurr(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  {sectorData.map(s => (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-xs text-slate-300 truncate">{s.name}</span>
                      <span className="text-xs text-slate-500 ml-auto">{formatCurr(s.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'india' && (
        <Card title="India Investments (NSE/MF)" action={<button onClick={() => openModal('INDIA_STOCK')} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium"><Plus size={14} />Add</button>}>
          {isLoading ? <LoadingSpinner className="py-8" /> : india.length === 0 ? <p className="text-center text-slate-400 py-8">No India investments yet.</p> : <InvTable items={india} />}
        </Card>
      )}

      {tab === 'us' && (
        <Card title="US Stocks (via BUX Netherlands)" action={<button onClick={() => openModal('US_STOCK')} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium"><Plus size={14} />Add</button>}>
          {isLoading ? <LoadingSpinner className="py-8" /> : us.length === 0 ? <p className="text-center text-slate-400 py-8">No US stock investments yet.</p> : <InvTable items={us} />}
        </Card>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Investment" size="lg">
        <div className="grid grid-cols-2 gap-4">
          {[{ key: 'name', label: 'Name *', placeholder: 'e.g. Infosys', full: true }, { key: 'ticker', label: 'Ticker Symbol', placeholder: 'e.g. INFY' }, { key: 'units', label: 'Units', type: 'number', placeholder: '100' }, { key: 'buyPrice', label: 'Buy Price', type: 'number', placeholder: '1500' }, { key: 'currentPrice', label: 'Current Price', type: 'number', placeholder: '1650' }, { key: 'investedAmount', label: 'Total Invested', type: 'number', placeholder: '150000' }].map(f => (
            <div key={f.key} className={f.full ? 'col-span-2' : ''}><label className="block text-sm font-medium text-slate-300 mb-1.5">{f.label}</label><input type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder={f.placeholder} /></div>
          ))}
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Platform</label><select value={form.platform ?? 'INDIA_STOCK'} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"><option value="INDIA_STOCK">India Stock (NSE)</option><option value="INDIA_MF">India Mutual Fund</option><option value="US_STOCK">US Stock (BUX)</option></select></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Sector</label><select value={form.sector ?? 'Technology'} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">{SECTORS.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Currency</label><select value={form.currency ?? 'INR'} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"><option>INR</option><option>EUR</option><option>USD</option></select></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Purchase Date</label><input type="date" value={form.purchaseDate ?? ''} onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
          <div className="col-span-2"><button onClick={() => addInv.mutate({ ...form, units: form.units ? parseFloat(form.units) : undefined, buyPrice: form.buyPrice ? parseFloat(form.buyPrice) : undefined, currentPrice: form.currentPrice ? parseFloat(form.currentPrice) : undefined, investedAmount: form.investedAmount ? parseFloat(form.investedAmount) : undefined })} disabled={!form.name || !form.sector} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium">{addInv.isPending ? 'Adding...' : 'Add Investment'}</button></div>
        </div>
      </Modal>
    </div>
  );
}
