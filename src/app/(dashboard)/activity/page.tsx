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
import { Plus, Trash2, Activity, Pencil, Monitor, CheckCircle2, Circle, Clock, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subDays, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';

type Tab = 'habits' | 'screen-time';

const EMOJI_OPTIONS = ['💪','🏃','🧘','📚','💤','🥗','💧','🎯','✍️','🎵','🧠','🌅','🚴','🏊','🥗','☕','🌿','⏰','📱','🏋️'];
const COLOR_PRESETS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4'];

// 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_SHORT  = ['M','T','W','T','F','S','S'];

const FREQUENCY_GROUPS: { key: string; label: string; color: string; borderColor: string; icon: string; defaultTarget: number; periodLabel: string; hasDayPicker: boolean }[] = [
  { key: 'DAILY',    label: 'Daily',     color: 'bg-blue-500/10',    borderColor: 'border-blue-500/30',    icon: '🌅', defaultTarget: 1, periodLabel: 'per day',     hasDayPicker: false },
  { key: 'WEEKLY',   label: 'Weekly',    color: 'bg-purple-500/10',  borderColor: 'border-purple-500/30',  icon: '📅', defaultTarget: 3, periodLabel: 'per week',    hasDayPicker: true  },
  { key: 'BIWEEKLY', label: 'Bi-weekly', color: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: '🔄', defaultTarget: 2, periodLabel: 'per 2 weeks', hasDayPicker: true  },
  { key: 'MONTHLY',  label: 'Monthly',   color: 'bg-amber-500/10',   borderColor: 'border-amber-500/30',   icon: '📆', defaultTarget: 4, periodLabel: 'per month',   hasDayPicker: false },
  { key: 'CUSTOM',   label: 'Custom',    color: 'bg-slate-700/30',   borderColor: 'border-slate-600',      icon: '⚙️', defaultTarget: 1, periodLabel: 'times',       hasDayPicker: false },
];

type Habit = { id: string; icon: string; name: string; color: string; frequency: string; targetDays: number; scheduledDays: number[] };
type HabitFormState = { name?: string; icon?: string; color?: string; frequency?: string; targetDays?: string; scheduledDays?: number[] };
type ScreenLog = { id: string; date: string; totalHours: number; productiveHours: number; notes: string | null };

// ─── Day Tags ─────────────────────────────────────────────────────────────────
function DayTags({ scheduledDays, frequency }: { scheduledDays: number[]; frequency: string }) {
  const grp = FREQUENCY_GROUPS.find(g => g.key === frequency);
  if (!grp?.hasDayPicker || !scheduledDays?.length) return null;
  return (
    <div className="flex gap-0.5 mt-1">
      {DAY_SHORT.map((d, i) => (
        <span key={i} className={`text-[9px] w-[18px] h-[14px] flex items-center justify-center rounded
          ${scheduledDays.includes(i) ? 'bg-blue-500 text-white' : 'bg-slate-700/50 text-slate-600'}`}>
          {d}
        </span>
      ))}
    </div>
  );
}

// ─── Day Picker (for modals) ──────────────────────────────────────────────────
function DayPicker({ selected, onChange }: { selected: number[]; onChange: (days: number[]) => void }) {
  const toggle = (i: number) => {
    onChange(selected.includes(i) ? selected.filter(d => d !== i) : [...selected, i]);
  };
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">Scheduled Days</label>
      <div className="flex gap-1.5">
        {DAY_LABELS.map((day, i) => (
          <button key={i} type="button" onClick={() => toggle(i)}
            className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg border transition-colors
              ${selected.includes(i)
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
            {day.slice(0, 2)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Week Dots ────────────────────────────────────────────────────────────────
function WeekDots({ habitId, logs }: { habitId: string; logs: { habitId: string; date: string; completed: boolean }[] }) {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) days.push(subDays(new Date(), i));
  return (
    <div className="flex gap-1">
      {days.map((d, i) => {
        const dStr = format(d, 'yyyy-MM-dd');
        const log = logs.find(l => l.habitId === habitId && l.date.startsWith(dStr));
        return (
          <div key={i} title={format(d, 'EEE dd')}
            className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-semibold
              ${log?.completed ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
            {DAY_SHORT[i]}
          </div>
        );
      })}
    </div>
  );
}

// ─── Habit Card ───────────────────────────────────────────────────────────────
function HabitCard({ habit, logs, onEdit, onDelete }: {
  habit: Habit;
  logs: { habitId: string; date: string; completed: boolean }[];
  onEdit: (h: Habit) => void;
  onDelete: (id: string) => void;
}) {
  const group = FREQUENCY_GROUPS.find(g => g.key === habit.frequency);
  const targetLabel = habit.targetDays && habit.targetDays > 0 && habit.frequency !== 'DAILY'
    ? `${habit.targetDays}× ${group?.periodLabel ?? ''}`
    : null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors group border border-slate-700/50">
      <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: habit.color }} />
      <span className="text-xl flex-shrink-0">{habit.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-100 text-sm">{habit.name}</p>
          {targetLabel && <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded-full">{targetLabel}</span>}
        </div>
        <DayTags scheduledDays={habit.scheduledDays ?? []} frequency={habit.frequency} />
        <div className="mt-1"><WeekDots habitId={habit.id} logs={logs} /></div>
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

// ─── Screen Time Weekly Strip ─────────────────────────────────────────────────
function ScreenWeekStrip({
  logs,
  weekStart,
  selectedDay,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  canGoNext,
}: {
  logs: ScreenLog[];
  weekStart: Date;
  selectedDay: string | null;
  onSelectDay: (d: string | null) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  canGoNext: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const maxHours = Math.max(...logs.map(l => l.totalHours), 1);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevWeek} className="p-1 text-slate-400 hover:text-slate-100 transition-colors"><ChevronLeft size={16} /></button>
        <span className="text-sm font-medium text-slate-300">
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </span>
        <button onClick={onNextWeek} disabled={!canGoNext} className="p-1 text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day bars */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dStr = format(day, 'yyyy-MM-dd');
          const log = logs.find(l => l.date.startsWith(dStr));
          const totalH = log?.totalHours ?? 0;
          const prodH = log?.productiveHours ?? 0;
          const barPct = totalH > 0 ? (totalH / maxHours) * 100 : 0;
          const prodPct = totalH > 0 ? (prodH / totalH) * 100 : 0;
          const isSelected = selectedDay === dStr;
          const isToday = isSameDay(day, new Date());
          const isFuture = day > new Date();

          return (
            <button key={i} onClick={() => onSelectDay(isSelected ? null : dStr)}
              disabled={isFuture}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors
                ${isSelected ? 'bg-blue-500/20 border border-blue-500/50' : 'hover:bg-slate-700/60 border border-transparent'}
                ${isFuture ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}>
              <span className={`text-[10px] font-medium ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                {DAY_LABELS[i === 6 ? 6 : i].slice(0,2)}
              </span>
              <span className={`text-[10px] ${isToday ? 'text-blue-300' : 'text-slate-500'}`}>{format(day, 'd')}</span>
              {/* Bar */}
              <div className="w-full h-16 bg-slate-700 rounded-sm overflow-hidden flex flex-col-reverse">
                {totalH > 0 ? (
                  <>
                    <div className="w-full rounded-sm" style={{ height: `${barPct}%`, background: 'rgba(148,163,184,0.4)' }}>
                      <div className="w-full rounded-sm bg-emerald-500" style={{ height: `${prodPct}%` }} />
                    </div>
                  </>
                ) : null}
              </div>
              <span className={`text-[10px] font-medium ${totalH > 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                {totalH > 0 ? `${totalH}h` : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-emerald-500 inline-block" />Productive</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-slate-500/40 inline-block" />Total</span>
        <span className="ml-auto text-slate-600">Click a day to see details</span>
      </div>
    </div>
  );
}

// ─── Screen Day Detail ────────────────────────────────────────────────────────
function ScreenDayDetail({ log, dayStr, onEdit, onDelete }: {
  log: ScreenLog | undefined;
  dayStr: string;
  onEdit: (l: ScreenLog) => void;
  onDelete: (id: string) => void;
}) {
  if (!log) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
        <p className="text-slate-400 text-sm">No screen time logged for {format(parseISO(dayStr), 'EEEE, MMMM d')}.</p>
      </div>
    );
  }
  const pct = log.totalHours > 0 ? Math.round((log.productiveHours / log.totalHours) * 100) : 0;
  const unproductive = Math.round((log.totalHours - log.productiveHours) * 10) / 10;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-200">{format(parseISO(dayStr), 'EEEE, MMMM d')}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(log)} className="text-slate-400 hover:text-blue-400 p-1 rounded transition-colors"><Pencil size={13} /></button>
          <button onClick={() => onDelete(log.id)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: `${log.totalHours}h`, color: 'text-slate-200' },
          { label: 'Productive', value: `${log.productiveHours}h`, color: 'text-emerald-400' },
          { label: 'Wasted', value: `${unproductive}h`, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="text-center p-2 bg-slate-700/50 rounded-lg">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Productivity</span>
          <span className={`text-sm font-bold ${pct >= 60 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 60 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {log.notes && <p className="text-xs text-slate-400 italic">{log.notes}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>('habits');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<HabitFormState>({});
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editForm, setEditForm] = useState<HabitFormState>({});
  const [editingLog, setEditingLog] = useState<ScreenLog | null>(null);
  const [stForm, setStForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), totalHours: '', productiveHours: '', notes: '' });

  // Screen time week navigation
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = prev week, etc.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 }); // Monday start

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: habitsData, isLoading: habitsLoading } = useQuery({
    queryKey: ['habits'], queryFn: () => axios.get('/api/habits').then(r => r.data), enabled: tab === 'habits',
  });
  const { data: logsData } = useQuery({
    queryKey: ['habit-logs'], queryFn: () => axios.get('/api/habit-logs').then(r => r.data), enabled: tab === 'habits',
  });
  const { data: screenTimeData, isLoading: screenTimeLoading } = useQuery({
    queryKey: ['screen-time'], queryFn: () => axios.get('/api/screen-time?days=90').then(r => r.data), enabled: tab === 'screen-time',
  });

  const addHabit = useMutation({
    mutationFn: (d: HabitFormState) => axios.post('/api/habits', {
      ...d,
      targetDays: Number(d.targetDays) || 1,
      scheduledDays: d.scheduledDays ?? [],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); setShowModal(false); setForm({}); toast('Habit added! +10 XP 🎯'); },
    onError: () => toast('Failed to add habit', 'error'),
  });
  const updateHabit = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & HabitFormState) =>
      axios.patch(`/api/habits/${id}`, {
        ...d,
        targetDays: d.targetDays ? Number(d.targetDays) : undefined,
        scheduledDays: d.scheduledDays ?? [],
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); setEditingHabit(null); toast('Habit updated! ✏️'); },
    onError: () => toast('Failed to update habit', 'error'),
  });
  const deleteHabit = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/habits/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); toast('Habit deleted'); },
  });
  const saveScreenTime = useMutation({
    mutationFn: (d: typeof stForm) => axios.post('/api/screen-time', { ...d, totalHours: parseFloat(d.totalHours), productiveHours: parseFloat(d.productiveHours || '0') }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screen-time'] });
      setStForm({ date: format(new Date(), 'yyyy-MM-dd'), totalHours: '', productiveHours: '', notes: '' });
      toast('Screen time logged! 🖥️');
    },
    onError: () => toast('Failed to log screen time', 'error'),
  });
  const updateScreenTime = useMutation({
    mutationFn: ({ id, ...d }: { id: string; totalHours: number; productiveHours: number; notes: string }) =>
      axios.put(`/api/screen-time/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['screen-time'] }); setEditingLog(null); toast('Updated!'); },
    onError: () => toast('Failed to update', 'error'),
  });
  const deleteScreenTime = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/screen-time/${id}`),
    onSuccess: (_data, deletedId) => {
      qc.invalidateQueries({ queryKey: ['screen-time'] });
      if (selectedDay && screenLogs.find(l => l.date.startsWith(selectedDay))?.id === deletedId) setSelectedDay(null);
      toast('Deleted');
    },
  });

  const habits: Habit[] = habitsData?.habits ?? [];
  const logs = logsData?.logs ?? [];
  const screenLogs: ScreenLog[] = screenTimeData?.logs ?? [];
  const weekAvgTotal: number | null = screenTimeData?.weekAvgTotal ?? null;
  const weekAvgProductive: number | null = screenTimeData?.weekAvgProductive ?? null;

  // Group habits by frequency
  const habitsByFreq: Record<string, Habit[]> = {};
  for (const h of habits) {
    const key = h.frequency ?? 'CUSTOM';
    if (!habitsByFreq[key]) habitsByFreq[key] = [];
    habitsByFreq[key].push(h);
  }

  const openAddHabit = (defaultFreq?: string) => {
    const grp = FREQUENCY_GROUPS.find(g => g.key === (defaultFreq ?? 'DAILY'));
    setForm({ frequency: defaultFreq ?? 'DAILY', targetDays: String(grp?.defaultTarget ?? 1), scheduledDays: [] });
    setShowModal(true);
  };
  const openEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setEditForm({
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      frequency: habit.frequency,
      targetDays: String(habit.targetDays ?? 1),
      scheduledDays: habit.scheduledDays ?? [],
    });
  };

  const selectedDayLog = selectedDay ? screenLogs.find(l => l.date.startsWith(selectedDay)) : undefined;
  const showFormFreqGroup = FREQUENCY_GROUPS.find(g => g.key === (form.frequency ?? 'DAILY'));
  const editFormFreqGroup = FREQUENCY_GROUPS.find(g => g.key === (editForm.frequency ?? 'DAILY'));

  return (
    <div className="p-6 space-y-6">
      <Header title="Activity" />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700 w-fit">
        {[
          { key: 'habits',      label: '🎯 Habits' },
          { key: 'screen-time', label: '🖥️ Screen Time' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === t.key ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── HABITS ── */}
      {tab === 'habits' && (
        habitsLoading ? <LoadingSpinner className="py-8" /> : (
          <div className="space-y-4">
            {FREQUENCY_GROUPS.map(group => {
              const groupHabits = habitsByFreq[group.key] ?? [];
              return (
                <div key={group.key} className={`rounded-xl border ${group.borderColor} ${group.color} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{group.icon}</span>
                      <h3 className="text-sm font-semibold text-slate-200">{group.label}</h3>
                      <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full">{groupHabits.length}</span>
                    </div>
                    <button onClick={() => openAddHabit(group.key)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100 bg-slate-700/60 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors">
                      <Plus size={12} /> Add
                    </button>
                  </div>
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
            {habits.length === 0 && (
              <EmptyState icon={<Activity size={24} />} title="No habits yet"
                description="Start building consistent habits to earn XP and track your progress."
                action={{ label: 'Add First Habit', onClick: () => openAddHabit() }} />
            )}
          </div>
        )
      )}

      {/* ── SCREEN TIME ── */}
      {tab === 'screen-time' && (
        <div className="space-y-6">
          {/* Weekly stats row */}
          {(weekAvgTotal !== null || screenLogs.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Avg Daily Total',      value: weekAvgTotal !== null ? `${weekAvgTotal.toFixed(1)}h` : '—', icon: <Clock size={16} className="text-blue-400" />,         color: 'text-blue-400' },
                { label: 'Avg Productive',        value: weekAvgProductive !== null ? `${weekAvgProductive.toFixed(1)}h` : '—', icon: <CheckCircle2 size={16} className="text-emerald-400" />, color: 'text-emerald-400' },
                { label: 'Productivity Rate',     value: (weekAvgTotal && weekAvgProductive) ? `${Math.round((weekAvgProductive / weekAvgTotal) * 100)}%` : '—', icon: <Zap size={16} className="text-amber-400" />, color: 'text-amber-400' },
                { label: 'Avg Unproductive',      value: (weekAvgTotal !== null && weekAvgProductive !== null) ? `${(weekAvgTotal - weekAvgProductive).toFixed(1)}h` : '—', icon: <Circle size={16} className="text-red-400" />, color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-slate-400">{s.label}</span></div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Weekly bar chart */}
          {screenTimeLoading ? <LoadingSpinner className="py-8" /> : (
            <ScreenWeekStrip
              logs={screenLogs}
              weekStart={weekStart}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onPrevWeek={() => { setWeekOffset(w => w - 1); setSelectedDay(null); }}
              onNextWeek={() => { setWeekOffset(w => Math.min(w + 1, 0)); setSelectedDay(null); }}
              canGoNext={weekOffset < 0}
            />
          )}

          {/* Day detail */}
          {selectedDay && (
            <ScreenDayDetail
              log={selectedDayLog}
              dayStr={selectedDay}
              onEdit={setEditingLog}
              onDelete={id => deleteScreenTime.mutate(id)}
            />
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
            <button onClick={() => saveScreenTime.mutate(stForm)} disabled={!stForm.totalHours || saveScreenTime.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              <Monitor size={15} />{saveScreenTime.isPending ? 'Saving...' : 'Save Log'}
            </button>
          </Card>
        </div>
      )}

      {/* ── ADD HABIT MODAL ── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Habit">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Habit Name</label>
            <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
              placeholder="e.g. Morning Run" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setForm(f => ({ ...f, icon: e }))}
                  className={`text-xl p-2 rounded-lg border transition-colors ${form.icon === e ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600 bg-slate-700 hover:border-slate-500'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Frequency</label>
              <select value={form.frequency ?? 'DAILY'}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value, targetDays: String(FREQUENCY_GROUPS.find(g => g.key === e.target.value)?.defaultTarget ?? 1) }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                {FREQUENCY_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Times {showFormFreqGroup?.periodLabel ?? ''}
              </label>
              <input type="number" min="1" max="31" value={form.targetDays ?? '1'}
                onChange={e => setForm(f => ({ ...f, targetDays: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          {showFormFreqGroup?.hasDayPicker && (
            <DayPicker selected={form.scheduledDays ?? []} onChange={days => setForm(f => ({ ...f, scheduledDays: days }))} />
          )}
          <button onClick={() => addHabit.mutate(form)} disabled={!form.name?.trim() || addHabit.isPending}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {addHabit.isPending ? 'Adding...' : 'Add Habit'}
          </button>
        </div>
      </Modal>

      {/* ── EDIT HABIT MODAL ── */}
      <Modal isOpen={!!editingHabit} onClose={() => setEditingHabit(null)} title="Edit Habit">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Habit Name</label>
            <input value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setEditForm(f => ({ ...f, icon: e }))}
                  className={`text-xl p-2 rounded-lg border transition-colors ${editForm.icon === e ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600 bg-slate-700 hover:border-slate-500'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map(c => (
                <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${editForm.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Frequency</label>
              <select value={editForm.frequency ?? 'DAILY'} onChange={e => setEditForm(f => ({ ...f, frequency: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                {FREQUENCY_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Times {editFormFreqGroup?.periodLabel ?? ''}
              </label>
              <input type="number" min="1" max="31" value={editForm.targetDays ?? '1'}
                onChange={e => setEditForm(f => ({ ...f, targetDays: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          {editFormFreqGroup?.hasDayPicker && (
            <DayPicker selected={editForm.scheduledDays ?? []} onChange={days => setEditForm(f => ({ ...f, scheduledDays: days }))} />
          )}
          <button onClick={() => editingHabit && updateHabit.mutate({ id: editingHabit.id, ...editForm })}
            disabled={!editForm.name?.trim() || updateHabit.isPending}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {updateHabit.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* ── EDIT SCREEN TIME MODAL ── */}
      <Modal isOpen={!!editingLog} onClose={() => setEditingLog(null)} title="Edit Screen Time">
        {editingLog && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400">{format(parseISO(editingLog.date), 'EEEE, MMMM d yyyy')}</div>
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
    </div>
  );
}
