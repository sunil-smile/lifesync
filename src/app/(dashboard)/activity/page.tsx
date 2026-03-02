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
import { Plus, Trash2, Flame, Activity, Moon, Dumbbell, Pencil } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Tab = 'habits' | 'workouts' | 'sleep';

const EMOJI_OPTIONS = ['💪','🏃','🧘','📚','💤','🥗','💧','🎯','✍️','🎵','🧠','🌅','🚴','🏊','🥗','☕','🌿','⏰','📱','🏋️'];
const COLOR_PRESETS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4'];
const WORKOUT_TYPES = ['RUNNING','GYM','YOGA','CYCLING','SWIMMING','OTHER'];
const WORKOUT_EMOJI: Record<string, string> = { RUNNING: '🏃', GYM: '🏋️', YOGA: '🧘', CYCLING: '🚴', SWIMMING: '🏊', OTHER: '💪' };
const INTENSITY_LEVELS = ['LOW','MEDIUM','HIGH'];

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

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>('habits');
  const [showModal, setShowModal] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
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
  const { data: sleepData, isLoading: sleepLoading } = useQuery({
    queryKey: ['sleep-logs'], queryFn: () => axios.get('/api/sleep-logs').then(r => r.data), enabled: tab === 'sleep',
  });

  const addHabit = useMutation({
    mutationFn: (d: Record<string, string>) => axios.post('/api/habits', { ...d, targetDays: Number(d.targetDays) || 7 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); setShowModal(null); toast('Habit added! +10 XP 🎯'); },
    onError: () => toast('Failed to add habit', 'error'),
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
  const addSleep = useMutation({
    mutationFn: (d: Record<string, string>) => axios.post('/api/sleep-logs', { ...d, qualityRating: Number(d.qualityRating) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sleep-logs'] }); setShowModal(null); toast('Sleep logged! 😴'); },
    onError: () => toast('Failed to log sleep', 'error'),
  });
  const deleteSleep = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/sleep-logs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sleep-logs'] }); toast('Sleep log deleted'); },
  });

  const habits = habitsData?.habits ?? [];
  const logs = logsData?.logs ?? [];
  const workouts = workoutsData?.workouts ?? [];
  const sleepLogs = sleepData?.sleepLogs ?? [];

  const openModal = (type: string) => { setForm({}); setShowModal(type); };

  return (
    <div className="p-6 space-y-6">
      <Header title="Activity" />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700 w-fit">
        {(['habits','workouts','sleep'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}>
            {t === 'habits' ? '🎯 Habits' : t === 'workouts' ? '💪 Workouts' : '😴 Sleep'}
          </button>
        ))}
      </div>

      {/* HABITS */}
      {tab === 'habits' && (
        <Card title="My Habits" action={<button onClick={() => openModal('habit')} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"><Plus size={14} />Add Habit</button>}>
          {habitsLoading ? <LoadingSpinner className="py-8" /> : habits.length === 0 ? (
            <EmptyState icon={<Activity size={24} />} title="No habits yet" description="Start building consistent habits to earn XP and track your progress." action={{ label: 'Add First Habit', onClick: () => openModal('habit') }} />
          ) : (
            <div className="space-y-3">
              {habits.map((habit: { id: string; icon: string; name: string; color: string; frequency: string }) => (
                <div key={habit.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors group">
                  <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: habit.color }} />
                  <span className="text-2xl flex-shrink-0">{habit.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-100">{habit.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{habit.frequency.toLowerCase()}</p>
                  </div>
                  <WeekDots habitId={habit.id} logs={logs} />
                  <button onClick={() => deleteHabit.mutate(habit.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
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

      {/* SLEEP */}
      {tab === 'sleep' && (
        <>
          {sleepLogs.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '7-day avg', value: `${(sleepLogs.slice(0,7).reduce((s: number, l: { totalHours: number }) => s + l.totalHours, 0) / Math.min(7, sleepLogs.length)).toFixed(1)}h` },
                { label: 'Avg quality', value: `${(sleepLogs.slice(0,7).reduce((s: number, l: { qualityRating: number }) => s + l.qualityRating, 0) / Math.min(7, sleepLogs.length)).toFixed(1)}/5` },
                { label: 'Logs total', value: sleepLogs.length },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                  <p className="text-xl font-bold text-slate-100">{stat.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
          <Card title="Sleep Logs" action={<button onClick={() => openModal('sleep')} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"><Plus size={14} />Log Sleep</button>}>
            {sleepLoading ? <LoadingSpinner className="py-8" /> : sleepLogs.length === 0 ? (
              <EmptyState icon={<Moon size={24} />} title="No sleep logs" description="Track your sleep to earn XP and improve your health score." action={{ label: 'Log Sleep', onClick: () => openModal('sleep') }} />
            ) : (
              <div className="space-y-3">
                {sleepLogs.map((sl: { id: string; bedtime: string; wakeTime: string; totalHours: number; qualityRating: number; loggedAt: string }) => (
                  <div key={sl.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors group">
                    <Moon size={20} className="text-violet-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-100">{format(new Date(sl.bedtime), 'h:mm a')} → {format(new Date(sl.wakeTime), 'h:mm a')}</p>
                      <p className="text-xs text-slate-400">{sl.totalHours}h sleep</p>
                    </div>
                    <span className="text-slate-300">{'★'.repeat(sl.qualityRating)}{'☆'.repeat(5 - sl.qualityRating)}</span>
                    <span className="text-xs text-slate-500">{format(new Date(sl.loggedAt), 'MMM d')}</span>
                    <button onClick={() => deleteSleep.mutate(sl.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
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
              {['DAILY','WEEKLY','CUSTOM'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <button onClick={() => addHabit.mutate(form)} disabled={!form.name?.trim()} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {addHabit.isPending ? 'Adding...' : 'Add Habit'}
          </button>
        </div>
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

      {/* Add Sleep Modal */}
      <Modal isOpen={showModal === 'sleep'} onClose={() => setShowModal(null)} title="Log Sleep">
        <div className="space-y-4">
          {[{ key: 'bedtime', label: 'Bedtime', type: 'datetime-local' }, { key: 'wakeTime', label: 'Wake Time', type: 'datetime-local' }].map(f => (
            <div key={f.key}><label className="block text-sm font-medium text-slate-300 mb-1.5">{f.label}</label><input type={f.type} value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
          ))}
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Quality (1-5 stars)</label>
            <div className="flex gap-2">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setForm(p => ({ ...p, qualityRating: String(n) }))} className={`text-2xl transition-all ${Number(form.qualityRating) >= n ? 'text-amber-400' : 'text-slate-600'}`}>★</button>)}</div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Notes (optional)</label><textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 h-20 resize-none" /></div>
          <button onClick={() => addSleep.mutate(form)} disabled={!form.bedtime || !form.wakeTime || !form.qualityRating} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">{addSleep.isPending ? 'Logging...' : 'Log Sleep'}</button>
        </div>
      </Modal>
    </div>
  );
}
