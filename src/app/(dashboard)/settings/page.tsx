'use client';

import { useState } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { Download, Calendar, AlertTriangle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'profile' | 'preferences' | 'data';

export default function SettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');
  const [name, setName] = useState(session?.user?.name ?? '');
  const [bankName, setBankName] = useState('ABN AMRO');
  const [saving, setSaving] = useState(false);

  const { data: bankLogsData, isLoading: bankLoading } = useQuery({
    queryKey: ['bank-logs-settings'], queryFn: () => axios.get('/api/bank-upload').then(r => r.data), enabled: tab === 'data',
  });

  const userId = (session?.user as { id?: string })?.id;
  const initials = (session?.user?.name ?? 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await axios.put(`/api/users/${userId}`, { name, bankName });
      toast('Profile saved!');
    } catch { toast('Failed to save profile', 'error'); }
    setSaving(false);
  };

  const handleExport = async () => {
    try {
      const res = await axios.get('/api/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `lifesync-export-${format(new Date(), 'yyyy-MM-dd')}.json`; a.click();
      URL.revokeObjectURL(url);
      toast('Data exported successfully!');
    } catch { toast('Export failed', 'error'); }
  };

  const bankLogs = bankLogsData ?? [];

  return (
    <div className="p-6 space-y-6">
      <Header title="Settings" />
      <div className="flex gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700 w-fit">
        {(['profile','preferences','data'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-100'}`}>{t}</button>
        ))}
      </div>

      {/* PROFILE */}
      {tab === 'profile' && (
        <div className="max-w-lg space-y-6">
          <Card title="Profile">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold text-white">{initials}</div>
              <div>
                <p className="font-semibold text-slate-100">{session?.user?.name}</p>
                <p className="text-sm text-slate-400">{session?.user?.email}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Display Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label><input value={session?.user?.email ?? ''} disabled className="w-full px-3 py-2 bg-slate-700/50 border border-slate-700 rounded-lg text-slate-500 cursor-not-allowed" /></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Primary Bank</label>
                <select value={bankName} onChange={e => setBankName(e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                  <option>ABN AMRO</option><option>ING</option>
                </select>
              </div>
              <button onClick={handleSaveProfile} disabled={saving} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">{saving ? 'Saving...' : 'Save Profile'}</button>
            </div>
          </Card>

          <Card title="Change Password">
            <p className="text-sm text-slate-400 text-center py-4">Password changes are managed by your administrator. Contact support to reset your password.</p>
          </Card>
        </div>
      )}

      {/* PREFERENCES */}
      {tab === 'preferences' && (
        <div className="max-w-lg space-y-6">
          <Card title="Display Preferences">
            <div className="space-y-6">
              {[
                { label: 'Currency', key: 'currency', options: ['EUR (€)', 'INR (₹)', 'USD ($)'] },
                { label: 'Week starts on', key: 'weekStart', options: ['Monday', 'Sunday'] },
              ].map(pref => (
                <div key={pref.key}>
                  <p className="text-sm font-medium text-slate-300 mb-3">{pref.label}</p>
                  <div className="flex gap-2">
                    {pref.options.map(opt => {
                      const stored = typeof window !== 'undefined' ? localStorage.getItem(`pref_${pref.key}`) : null;
                      const isActive = stored ? stored === opt : pref.options[0] === opt;
                      return (
                        <button key={opt} onClick={() => { localStorage.setItem(`pref_${pref.key}`, opt); toast('Preference saved'); }}
                          className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'}`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-sm font-medium text-slate-300 mb-1">Budget Alert Threshold</p>
                <p className="text-xs text-slate-500 mb-2">Alert when spending reaches 80% of budget limit</p>
                <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-700 text-sm text-slate-300">80% (default — configurable per category)</div>
              </div>
            </div>
          </Card>

          {/* Google Calendar */}
          <Card title="Google Calendar Integration">
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Connect your Google Calendar to sync events and reminders with LifeSync.</p>
              <div className="bg-slate-700/50 rounded-xl border border-slate-600 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><Calendar size={16} className="text-blue-400" /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">Google Calendar — Sunil</p>
                    <p className="text-xs text-slate-500">Connect to see events on your dashboard</p>
                  </div>
                  <a href="/api/auth/signin/google" className="ml-auto flex items-center gap-1.5 text-xs bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"><ExternalLink size={12} />Connect</a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center"><Calendar size={16} className="text-violet-400" /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">Google Calendar — Vidhya</p>
                    <p className="text-xs text-slate-500">Share Vidhya&apos;s calendar events</p>
                  </div>
                  <a href="/api/auth/signin/google" className="ml-auto flex items-center gap-1.5 text-xs bg-violet-500 hover:bg-violet-400 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"><ExternalLink size={12} />Connect</a>
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
                <strong>Setup required:</strong> Add your Google OAuth credentials to .env (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud Console) to enable calendar sync.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* DATA */}
      {tab === 'data' && (
        <div className="max-w-lg space-y-6">
          <Card title="Export Data">
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Download all your LifeSync data as a JSON file. This includes expenses, income, investments, habits, workouts, sleep logs, tasks, and goals.</p>
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg font-medium text-sm transition-colors">
                <Download size={16} />Export All Data (JSON)
              </button>
            </div>
          </Card>

          <Card title="Bank Upload History">
            {bankLoading ? <LoadingSpinner className="py-8" /> : bankLogs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No bank uploads yet.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-4 text-xs font-medium text-slate-400 pb-2 border-b border-slate-700 gap-2">
                  <span>Account</span><span>Uploaded</span><span>Transactions</span><span>Date Range</span>
                </div>
                {bankLogs.map((log: { id: string; accountType: string; uploadedAt: string; transactionCount: number; dateFrom: string; dateTo: string }) => (
                  <div key={log.id} className="grid grid-cols-4 text-xs text-slate-300 py-2 border-b border-slate-700/50 gap-2 items-center">
                    <span className="font-medium">{log.accountType.replace('_', ' ')}</span>
                    <span className="text-slate-400">{format(new Date(log.uploadedAt), 'MMM d, HH:mm')}</span>
                    <span>{log.transactionCount} txns</span>
                    <span className="text-slate-500">{format(new Date(log.dateFrom), 'MMM d')} - {format(new Date(log.dateTo), 'MMM d')}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="border border-red-500/30 rounded-xl p-4 bg-red-500/5">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-red-400" /><p className="font-semibold text-red-400 text-sm">Danger Zone</p></div>
              <p className="text-xs text-slate-400">Data reset is not available in this version of LifeSync. To clear all data, you can reset the database using <code className="text-slate-300 bg-slate-700 px-1 rounded">npm run db:reset</code> from the terminal.</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
