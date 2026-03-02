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
import { Plus, Trash2, Activity, Dumbbell, Pencil } from 'lucide-react';
import { format, subDays } from 'date-fns';

type Tab = 'habits' | 'workouts';

const EMOJI_OPTIONS = ['💪','🏃','🧘','📚','💤','🥗','💧','🎯','✍️','🎵','🧠','🌅','🚴','🏊','🥗','☕','🌿','⏰','📱','🏋️'];
const COLOR_PRESETS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4'];
const WORKOUT_TYPES = ['RUNNING','GYM','YOGA','CYCLING','SWIMMING','OTHER'];
const WORKOUT_EMOJI: Record<string, string> = { RUNNING: '🏃', GYM: '🏋️', YOGA: '🧘', CYCLING: '🚴', SWIMMING: '🏊', OTHER: '💪' };
const INTENSITY_LEVELS = ['LOW','MEDIUM','HIGH'];

type Habit = { id: string; icon: string; name: string; color: string; frequency: string; targetDays: number };

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
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
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

  const habits: Habit[] = habitsData?.habits ?? [];
  const logs = logsData?.logs ?? [];
  const workouts = workoutsData?.workouts ?? [];

  const openModal = (type: string) => { setForm({}); setShowModal(type); };
  const openEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setEditForm({ name: habit.name, icon: habit.icon, color: habit.color, frequency: habit.frequency, targetDays: String(habit.targetDays) });
  };

  return (
    <div className="p-6 space-y-6">
      <Header title="Activity" />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700 w-fit">
        {(['habits','workouts'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}>
            {t === 'habits' ? '🎯 Habits' : '💪 Workouts'}
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
              {habits.map((habit) => (
                <div key={habit.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors group">
                  <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: habit.color }} />
                  <span className="text-2xl flex-shrink-0">{habit.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-100">{habit.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{habit.frequency.toLowerCase()}</p>
                  </div>
                  <WeekDots habitId={habit.id} logs={logs} />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditHabit(habit)} className="text-slate-400 hover:text-blue-400 p-1 rounded transition-colors" title="Edit habit">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => deleteHabit.mutate(habit.id)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors" title="Delete habit">
                      <Trash2 size={15} />
                    </button>
                  </div>
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
              {['DAILY','WEEKLY','CUSTOM'].map(v => <option key={v} value={v}>{v}</option>)}
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
