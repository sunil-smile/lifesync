'use client';

import { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { Plus, Trash2, Activity, Dumbbell, Pencil, Monitor, CheckCircle2, Circle, Clock, Zap } from 'lucide-react';
import { format, subDays } from 'date-fns';

type Tab = 'habits' | 'workouts' | 'screen-time';

const EMOJI_OPTIONS = ['💪','🏃','🧘','📚','💤','🥗','💧','🎯','✍️','🎵','🧠','🌅','🚴','🏊','🥗','☕','🌿','⏰','📱','🏋️'];
const COLOR_PRESETS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4'];
const WORKOUT_TYPES = ['RUNNING','GYM','YOGA','CYCLING','SWIMMING','OTHER'];
const WORKOUT_EMOJI: Record<string, string> = { RUNNING: '🏃', GYM: '🏋️', YOGA: '🧘', CYCLING: '🚴', SWIMMING: '🏊', OTHER: '💪' };
const INTENSITY_LEVELS = ['LOW','MEDIUM','HIGH'];

const FREQUENCY_GROUPS: { key: string; label: string; color: string; borderColor: string; icon: string }[] = [
  { key: 'DAILY',    label: 'Daily',     color: 'bg-blue-500/10',    borderColor: 'border-blue-500/30',    icon: '🌅' },
  { key: 'WEEKLY',   label: 'Weekly',    color: 'bg-purple-500/10',  borderColor: 'border-purple-500/30',  icon: '📅' },
  { key: 'BIWEEKLY', label: 'Bi-weekly', color: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: '🔄' },
  { key: 'MONTHLY',  label: 'Monthly',   color: 'bg-amber-500/10',   borderColor: 'border-amber-500/30',   icon: '📆' },
  { key: 'CUSTOM',   label: 'Custom',    color: 'bg-slate-700/30',   borderColor: 'border-slate-600',      icon: '⚙️' },
];

type Habit = { id: string; icon: string; name: string; color: string; frequency: string; targetDays: number };
type ScreenLog = { id: string; date: string; totalHours: number; productiveHours: number; notes: string | null };

function WeekDots({ habitId, logs }: { habitId: string; logs: { habitId: string; date: string; completed: boolean }[] }) {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) days.push(subDays(new Date(), i));
  return (
    <div className="flex gap-1">
      {days.map((d, i) => {
        const dStr = format(d, 'yyyy-MM-dd');
        const log = logs.find(l => l.habitId === habitId && l.date.startsWith(dStr));
        return (
          <div key={i} title={format(d, 'EEE')}
            className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-semibold ${log?.completed ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
            {['M','T','W','T','F','S','S'][i]}
          </div>
        );
      })}
    </div>
  );
}

function HabitCard({ habit, logs, onEdit, onDelete }: { habit: Habit; logs: { habitId: string; date: string; completed: boolean }[]; onEdit: (h: Habit) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors group border border-slate-700/50">
      <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: habit.color }} />
      <span className="text-xl flex-shrink-0">{habit.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-100 text-sm">{habit.name}</p>
        <WeekDots habitId={habit.id} logs={logs} />
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(habit)} className="text-slate-400 hover:text-blue-400 p-1 rounded transition-colors" title="Edit">
          <Pencil size={13} />
        </button>
        <button onClick={() => onDelete(habit.id)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors" title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>('habits');
  const [showModal, setShowModal] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editingLog, setEditingLog] = useState<ScreenLog | null>(null);
  const [stForm, setStForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), totalHours: '', productiveHours: '', notes: '' });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: habitsData, isLoading: habitsLoading } = useQuery({
    queryKey: ['habits'], queryFn: () => axios.get('/api/habits').then(r => r.data), enabled: tab === 'habits',
  });
  const { data: logsData } = useQuery({
    queryKey: ['habit-logs'], queryFn: () => axios.get('/api/habit-logs').then(r => r.data), enabled: tab === 'habits',
  });
  const { data: workoutsData, isLoading: workoutsLoading } = useQuery({
    queryKey: ['workouts'], queryFn: () => axios.get('/api/workouts').then(r => r.data), enabled: tab === 'workouts',
  });
  const { data: screenTimeData, isLoading: screenTimeLoading } = useQuery({
    queryKey: ['screen-time'], queryFn: () => axios.get('/api/screen-time?days=30').then(r => r.data), enabled: tab === 'screen-time',
  });

  const addHabit = useMutation({
    mutationFn: (d: Record<string, string>) => axios.post('/api/habits', { ...d, targetDays: Number(d.targetDays) || 7 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); setShowModal(null); toast('Habit added! +10 XP 🎯'); },
    onError: () => toast('Failed to add habit', 'error'),
  });
  const updateHabit = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Record<string, string>) =>
      axios.patch(`/api/habits/${id}`, { ...d, targetDays: d.targetDays ? Number(d.targetDays) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); setEditingHabit(null); toast('Habit updated! ✏️'); },
    onError: () => toast('Failed to update habit', 'error'),
  });
  const deleteHabit = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/habits/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); toast('Habit deleted'); },
  });
  const addWorkout = useMutation({
    mutationFn: (d: Record<string, string>) => axios.post('/api/workouts', { ...d, durationMinutes: Number(d.durationMinutes), distanceKm: d.distanceKm ? Number(d.distanceKm) : undefined, caloriesBurned: d.caloriesBurned ? Number(d.caloriesBurned) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workouts'] }); setShowModal(null); toast('Workout logged! 💪'); },
    onError: () => toast('Failed to log workout', 'error'),
  });
  const deleteWorkout = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/workouts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workouts'] }); toast('Workout deleted'); },
  });
  const saveScreenTime = useMutation({
    mutationFn: (d: typeof stForm) => axios.post('/api/screen-time', { ...d, totalHours: parseFloat(d.totalHours), productiveHours: parseFloat(d.productiveHours || '0') }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['screen-time'] }); setStForm({ date: format(new Date(), 'yyyy-MM-dd'), totalHours: '', productiveHours: '', notes: '' }); toast('Screen time logged! 🖥️'); },
    onError: () => toast('Failed to log screen time', 'error'),
  });
  const updateScreenTime = useMutation({
    mutationFn: ({ id, ...d }: { id: string; totalHours: number; productiveHours: number; notes: string }) => axios.put(`/api/screen-time/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['screen-time'] }); setEditingLog(null); toast('Updated!'); },
    onError: () => toast('Failed to update', 'error'),
  });
  const deleteScreenTime = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/screen-time/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['screen-time'] }); toast('Deleted'); },
  });

  const habits: Habit[] = habitsData?.habits ?? [];
  const logs = logsData?.logs ?? [];
  const workouts = workoutsData?.workouts ?? [];
  const screenLogs: ScreenLog[] = screenTimeData?.logs ?? [];
  const weekAvgTotal: number | null = screenTimeData?.weekAvgTotal ?? null;
  const weekAvgProductive: number | null = screenTimeData?.weekAvgProductive ?? null;

  const openModal = (type: string, defaultFreq?: string) => {
    setForm(defaultFreq ? { frequency: defaultFreq } : {});
    setShowModal(type);
  };
  const openEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setEditForm({ name: habit.name, icon: habit.icon, color: habit.color, frequency: habit.frequency, targetDays: String(habit.targetDays) });
  };

  // Group habits by frequency
  const habitsByFreq: Record<string, Habit[]> = {};
  for (const h of habits) {
    const key = h.frequency ?? 'CUSTOM';
    if (!habitsByFreq[key]) habitsByFreq[key] = [];
    habitsByFreq[key].push(h);
  }

  return (
    <div className="p-6 space-y-6">
      <Header title="Activity" />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700 w-fit">
        {[
          { key: 'habits', label: '🎯 Habits' },
          { key: 'workouts', label: '💪 Workouts' },
          { key: 'screen-time', label: '🖥️ Screen Time' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* HABITS — grouped by frequency */}
      {tab === 'habits' && (
        habitsLoading ? <LoadingSpinner className="py-8" /> : (
          <div className="space-y-4">
            {FREQUENCY_GROUPS.map(group => {
              const groupHabits = habitsByFreq[group.key] ?? [];
              return (
                <div key={group.key} className={`rounded-xl border ${group.borderColor} ${group.color} p-4`}>
                  {/* Group header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{group.icon}</span>
                      <h3 className="text-sm font-semibold text-slate-200">{group.label}</h3>
                      <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full">{groupHabits.length}</span>
                    </div>
                    <button
                      onClick={() => openModal('habit', group.key)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100 bg-slate-700/60 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors">
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  {/* Habit cards */}
                  {groupHabits.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-3">No {group.label.toLowerCase()} habits yet</p>
                  ) : (
                    <div className="space-y-2">
                      {groupHabits.map(habit => (
                        <HabitCard key={habit.id} habit={habit} logs={logs}
                          onEdit={openEditHabit} onDelete={id => deleteHabit.mutate(id)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {/* If user has no habits at all */}
            {habits.length === 0 && (
              <EmptyState icon={<Activity size={24} />} title="No habits yet" description="Start building consistent habits to earn XP and track your progress." action={{ label: 'Add First Habit', onClick: () => openModal('habit') }} />
            )}
          </div>
        )
      )}

      {/* WORKOUTS */}
      {tab === 'workouts' && (
        <Card title="Workouts" action={<button onClick={() => openModal('workout')} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"><Plus size={14} />Log Workout</button>}>
          {workoutsLoading ? <LoadingSpinner className="py-8" /> : workouts.length === 0 ? (
            <EmptyState icon={<Dumbbell size={24} />} title="No workouts yet" description="Log your first workout to start earning XP!" action={{ label: 'Log Workout', onClick: () => openModal('workout') }} />
          ) : (
            <div className="space-y-3">
              {workouts.map((w: { id: string; type: string; name: string; durationMinutes: number; distanceKm?: number; intensityLevel: string; caloriesBurned?: number; loggedAt: string }) => (
                <div key={w.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors group">
                  <span className="text-2xl">{WORKOUT_EMOJI[w.type] ?? '💪'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-100">{w.name}</p>
                    <p className="text-xs text-slate-400">{w.durationMinutes}min{w.distanceKm ? ` · ${w.distanceKm}km` : ''}{w.caloriesBurned ? ` · ${w.caloriesBurned} kcal` : ''}</p>
                  </div>
                  <Badge variant={w.intensityLevel === 'HIGH' ? 'red' : w.intensityLevel === 'MEDIUM' ? 'amber' : 'slate'} size="sm">{w.intensityLevel}</Badge>
                  <span className="text-xs text-slate-500">{format(new Date(w.loggedAt), 'MMM d')}</span>
                  <button onClick={() => deleteWorkout.mutate(w.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* SCREEN TIME */}
      {tab === 'screen-time' && (
        <div className="space-y-6">
          {/* Weekly overview */}
          {(weekAvgTotal !== null || screenLogs.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Avg Daily Total', value: weekAvgTotal !== null ? `${weekAvgTotal.toFixed(1)}h` : '—', icon: <Clock size={16} className="text-blue-400" />, color: 'text-blue-400' },
                { label: 'Avg Productive', value: weekAvgProductive !== null ? `${weekAvgProductive.toFixed(1)}h` : '—', icon: <CheckCircle2 size={16} className="text-emerald-400" />, color: 'text-emerald-400' },
                { label: 'Productivity Rate', value: (weekAvgTotal && weekAvgProductive) ? `${Math.round((weekAvgProductive / weekAvgTotal) * 100)}%` : '—', icon: <Zap size={16} className="text-amber-400" />, color: 'text-amber-400' },
                { label: 'Avg Unproductive', value: (weekAvgTotal !== null && weekAvgProductive !== null) ? `${(weekAvgTotal - weekAvgProductive).toFixed(1)}h` : '—', icon: <Circle size={16} className="text-red-400" />, color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-slate-400">{s.label}</span></div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Log form */}
          <Card title="Log Screen Time">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
                <input type="date" value={stForm.date}
                  onChange={e => setStForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Total Hours</label>
                <input type="number" step="0.5" min="0" max="24" value={stForm.totalHours} placeholder="e.g. 8"
                  onChange={e => setStForm(f => ({ ...f, totalHours: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Productive Hours</label>
                <input type="number" step="0.5" min="0" max="24" value={stForm.productiveHours} placeholder="e.g. 5"
                  onChange={e => setStForm(f => ({ ...f, productiveHours: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes (optional)</label>
                <input type="text" value={stForm.notes} placeholder="e.g. Work + study"
                  onChange={e => setStForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <button
              onClick={() => saveScreenTime.mutate(stForm)}
              disabled={!stForm.totalHours || saveScreenTime.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              <Monitor size={15} />
              {saveScreenTime.isPending ? 'Saving...' : 'Save Log'}
            </button>
          </Card>

          {/* History */}
          <Card title="Recent Logs">
            {screenTimeLoading ? <LoadingSpinner className="py-8" /> : screenLogs.length === 0 ? (
              <EmptyState icon={<Monitor size={24} />} title="No screen time logged" description="Start tracking your daily screen time to measure productivity." />
            ) : (
              <div className="space-y-2">
                {screenLogs.map(log => {
                  const pct = log.totalHours > 0 ? Math.round((log.productiveHours / log.totalHours) * 100) : 0;
                  const unproductive = Math.round((log.totalHours - log.productiveHours) * 10) / 10;
                  return (
                    <div key={log.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors group">
                      <div className="text-center w-12 flex-shrink-0">
                        <p className="text-xs font-semibold text-slate-200">{format(new Date(log.date), 'MMM d')}</p>
                        <p className="text-[10px] text-slate-500">{format(new Date(log.date), 'EEE')}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Productivity bar */}
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-2 bg-slate-600 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-300">{pct}%</span>
                        </div>
                        <div className="flex gap-3 text-xs text-slate-400">
                          <span><span className="text-slate-200">{log.totalHours}h</span> total</span>
                          <span><span className="text-emerald-400">{log.productiveHours}h</span> productive</span>
                          <span><span className="text-red-400">{unproductive}h</span> unproductive</span>
                          {log.notes && <span className="text-slate-500 truncate">{log.notes}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingLog(log)} className="text-slate-400 hover:text-blue-400 p-1 rounded transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => deleteScreenTime.mutate(log.id)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Add Habit Modal */}
      <Modal isOpen={showModal === 'habit'} onClose={() => setShowModal(null)} title="Add New Habit">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Habit Name</label><input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="e.g. Morning Run" /></div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">{EMOJI_OPTIONS.map(e => <button key={e} onClick={() => setForm(f => ({ ...f, icon: e }))} className={`text-xl p-2 rounded-lg border transition-colors ${form.icon === e ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600 bg-slate-700 hover:border-slate-500'}`}>{e}</button>)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Color</label>
            <div className="flex gap-2">{COLOR_PRESETS.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Frequency</label>
            <select value={form.frequency ?? 'DAILY'} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
              {['DAILY','WEEKLY','BIWEEKLY','MONTHLY','CUSTOM'].map(v => <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <button onClick={() => addHabit.mutate(form)} disabled={!form.name?.trim()} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {addHabit.isPending ? 'Adding...' : 'Add Habit'}
          </button>
        </div>
      </Modal>

      {/* Edit Habit Modal */}
      <Modal isOpen={!!editingHabit} onClose={() => setEditingHabit(null)} title="Edit Habit">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Habit Name</label><input value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">{EMOJI_OPTIONS.map(e => <button key={e} onClick={() => setEditForm(f => ({ ...f, icon: e }))} className={`text-xl p-2 rounded-lg border transition-colors ${editForm.icon === e ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600 bg-slate-700 hover:border-slate-500'}`}>{e}</button>)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Color</label>
            <div className="flex gap-2">{COLOR_PRESETS.map(c => <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full border-2 transition-all ${editForm.color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Frequency</label>
            <select value={editForm.frequency ?? 'DAILY'} onChange={e => setEditForm(f => ({ ...f, frequency: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
              {['DAILY','WEEKLY','BIWEEKLY','MONTHLY','CUSTOM'].map(v => <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <button
            onClick={() => editingHabit && updateHabit.mutate({ id: editingHabit.id, ...editForm })}
            disabled={!editForm.name?.trim() || updateHabit.isPending}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {updateHabit.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Edit Screen Time Modal */}
      <Modal isOpen={!!editingLog} onClose={() => setEditingLog(null)} title="Edit Screen Time">
        {editingLog && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400">
              {format(new Date(editingLog.date), 'EEEE, MMMM d yyyy')}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Total Hours</label>
              <input type="number" step="0.5" min="0" max="24" defaultValue={editingLog.totalHours}
                id="edit-total" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Productive Hours</label>
              <input type="number" step="0.5" min="0" max="24" defaultValue={editingLog.productiveHours}
                id="edit-productive" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
              <input type="text" defaultValue={editingLog.notes ?? ''}
                id="edit-notes" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <button
              onClick={() => {
                const total = parseFloat((document.getElementById('edit-total') as HTMLInputElement).value);
                const productive = parseFloat((document.getElementById('edit-productive') as HTMLInputElement).value || '0');
                const notes = (document.getElementById('edit-notes') as HTMLInputElement).value;
                updateScreenTime.mutate({ id: editingLog.id, totalHours: total, productiveHours: productive, notes });
              }}
              disabled={updateScreenTime.isPending}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              {updateScreenTime.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </Modal>

      {/* Add Workout Modal */}
      <Modal isOpen={showModal === 'workout'} onClose={() => setShowModal(null)} title="Log Workout">
        <div className="space-y-4">
          {[{ key: 'name', label: 'Workout Name', placeholder: 'e.g. Morning Run' }, { key: 'durationMinutes', label: 'Duration (minutes)', type: 'number', placeholder: '30' }, { key: 'distanceKm', label: 'Distance (km, optional)', type: 'number', placeholder: '5' }, { key: 'caloriesBurned', label: 'Calories Burned (optional)', type: 'number', placeholder: '250' }].map(f => (
            <div key={f.key}><label className="block text-sm font-medium text-slate-300 mb-1.5">{f.label}</label><input type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder={f.placeholder} /></div>
          ))}
          {[{ key: 'type', label: 'Type', options: WORKOUT_TYPES }, { key: 'intensityLevel', label: 'Intensity', options: INTENSITY_LEVELS }].map(f => (
            <div key={f.key}><label className="block text-sm font-medium text-slate-300 mb-1.5">{f.label}</label>
            <select value={form[f.key] ?? f.options[0]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">{f.options.map(o => <option key={o}>{o}</option>)}</select></div>
          ))}
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label><input type="date" value={form.loggedAt ?? format(new Date(),'yyyy-MM-dd')} onChange={e => setForm(p => ({ ...p, loggedAt: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
          <button onClick={() => addWorkout.mutate({ type: 'RUNNING', intensityLevel: 'MEDIUM', ...form })} disabled={!form.name?.trim() || !form.durationMinutes} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">{addWorkout.isPending ? 'Logging...' : 'Log Workout'}</button>
        </div>
      </Modal>
    </div>
  );
}
