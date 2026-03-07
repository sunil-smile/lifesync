'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  CheckCircle2, Circle, Flame, Zap, DollarSign,
  Calendar, Star, AlertTriangle, Monitor, Activity,
  ChevronLeft, ChevronRight, XCircle, Clock, TrendingUp,
  CheckSquare, AlertCircle,
} from 'lucide-react';
import {
  format, startOfWeek, addDays, isSameDay, addWeeks, isAfter,
  isToday, isBefore, startOfDay,
} from 'date-fns';

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

const DAY_INITIALS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

type HabitLog = { id: string; habitId: string; date: string; completed: boolean };
type Habit    = { id: string; name: string; icon: string; color?: string };
type Task     = { id: string; title: string; dueDate?: string; priority: string; status: string };
type ScreenLog = { date: string; totalHours: number; productiveHours: number; notes?: string | null };

/* ─── Day status helper ─────────────────────────────────────────────────────── */
type DayStatus = 'great' | 'good' | 'mixed' | 'missed' | 'neutral' | 'today' | 'future';

function getDayStatus(
  habitPct: number,
  habitTotal: number,
  overdueCount: number,
  isFuture: boolean,
  isTodayDay: boolean,
): DayStatus {
  if (isFuture) return 'future';
  if (isTodayDay) return 'today';
  if (habitTotal === 0) return overdueCount > 0 ? 'missed' : 'neutral';
  if (habitPct === 100 && overdueCount === 0) return 'great';
  if (habitPct >= 80) return 'good';
  if (habitPct >= 40 || overdueCount <= 1) return 'mixed';
  return 'missed';
}

const STATUS_STYLES: Record<DayStatus, { border: string; bg: string; ring: string }> = {
  great:   { border: 'border-emerald-500/50', bg: 'bg-emerald-500/5',  ring: '#10b981' },
  good:    { border: 'border-emerald-400/30', bg: 'bg-emerald-400/5',  ring: '#34d399' },
  mixed:   { border: 'border-amber-500/40',   bg: 'bg-amber-500/5',    ring: '#f59e0b' },
  missed:  { border: 'border-red-500/40',     bg: 'bg-red-500/5',      ring: '#ef4444' },
  neutral: { border: 'border-slate-600/50',   bg: 'bg-slate-800/30',   ring: '#475569' },
  today:   { border: 'border-blue-500/60',    bg: 'bg-blue-500/5',     ring: '#3b82f6' },
  future:  { border: 'border-slate-700/30',   bg: 'bg-slate-800/20',   ring: '#334155' },
};

/* ══════════════════════════════════════════════════════════════════════════════
   WEEK STRIP
══════════════════════════════════════════════════════════════════════════════ */
function WeekStrip({
  weekStart, selectedDay, habits, logs, tasks, screenLogs,
  onSelectDay, onPrevWeek, onNextWeek, canGoNext,
}: {
  weekStart: Date;
  selectedDay: Date | null;
  habits: Habit[];
  logs: HabitLog[];
  tasks: Task[];
  screenLogs: ScreenLog[];
  onSelectDay: (d: Date | null) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  canGoNext: boolean;
}) {
  const now  = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Week summary stats
  const weekStats = useMemo(() => {
    let totalDone = 0, totalExpected = 0, overdueInWeek = 0;
    days.forEach(day => {
      const dStr = format(day, 'yyyy-MM-dd');
      const isPast = isBefore(day, startOfDay(now)) && !isToday(day);
      const isTodayDay = isToday(day);
      if (isPast || isTodayDay) {
        const done = logs.filter(l => l.date === dStr && l.completed).length;
        totalDone += done;
        totalExpected += habits.length;
        overdueInWeek += tasks.filter(t =>
          t.dueDate && t.dueDate.startsWith(dStr) && t.status !== 'DONE',
        ).length;
      }
    });
    const pct = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;
    return { totalDone, totalExpected, pct, overdueInWeek };
  }, [days, logs, tasks, habits, now]);

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60">
        <button onClick={onPrevWeek}
          className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Weekly Overview · click a day to explore</p>
        </div>
        <button onClick={onNextWeek} disabled={!canGoNext}
          className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-px bg-slate-700/30 p-px">
        {days.map((day, i) => {
          const dStr = format(day, 'yyyy-MM-dd');
          const isTodayDay = isToday(day);
          const isFuture = isAfter(day, now) && !isTodayDay;
          const isPast = isBefore(day, startOfDay(now)) && !isTodayDay;
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

          const dayLogs     = logs.filter(l => l.date === dStr && l.completed);
          const habitDone   = dayLogs.length;
          const habitTotal  = habits.length;
          const habitPct    = habitTotal > 0 ? (habitDone / habitTotal) * 100 : 0;
          const missedCount = habitTotal > 0 && (isPast || isTodayDay) ? habitTotal - habitDone : 0;

          const dayTasks = tasks.filter(t => t.dueDate && t.dueDate.startsWith(dStr));
          const overdueCount = (isPast || isTodayDay)
            ? dayTasks.filter(t => t.status !== 'DONE').length : 0;

          const status = getDayStatus(habitPct, habitTotal, overdueCount, isFuture, isTodayDay);
          const sty    = STATUS_STYLES[status];
          const stLog  = screenLogs.find(l => l.date.startsWith(dStr));

          return (
            <button key={i}
              onClick={() => !isFuture && onSelectDay(isSelected ? null : day)}
              disabled={isFuture}
              className={`
                relative flex flex-col items-center gap-1.5 py-3 px-1.5 transition-all group
                ${isSelected
                  ? 'bg-blue-600/20 ring-1 ring-inset ring-blue-500/60'
                  : `${sty.bg} hover:bg-slate-700/50`}
                ${isFuture ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
              `}>

              {/* Day label */}
              <span className={`text-[10px] font-bold tracking-widest uppercase
                ${isTodayDay ? 'text-blue-400' : 'text-slate-500'}`}>
                {DAY_INITIALS[i]}
              </span>

              {/* Date number */}
              <span className={`text-lg font-bold leading-none
                ${isTodayDay ? 'text-blue-300' : isSelected ? 'text-white' : 'text-slate-200'}`}>
                {format(day, 'd')}
              </span>

              {/* Today badge */}
              {isTodayDay && (
                <span className="text-[8px] font-bold tracking-wider text-blue-400 uppercase -mt-1">today</span>
              )}

              {/* Habit ring */}
              {!isFuture && habitTotal > 0 && (
                <div className="relative w-10 h-10 flex-shrink-0 my-0.5">
                  <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#1e293b" strokeWidth="3.5" />
                    <circle cx="20" cy="20" r="16" fill="none"
                      stroke={sty.ring}
                      strokeWidth="3.5"
                      strokeDasharray={`${Math.round(habitPct * 1.005)} 100.5`}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-300">
                    {habitDone}/{habitTotal}
                  </span>
                </div>
              )}

              {/* No habits configured */}
              {!isFuture && habitTotal === 0 && (
                <div className="w-10 h-10 rounded-full bg-slate-700/40 flex items-center justify-center my-0.5">
                  <span className="text-[9px] text-slate-600">—</span>
                </div>
              )}

              {/* Alert indicators */}
              <div className="flex flex-col items-center gap-0.5 w-full min-h-[28px]">
                {(isPast || isTodayDay) && missedCount > 0 && (
                  <div className="flex items-center gap-0.5">
                    <XCircle size={8} className={status === 'missed' ? 'text-red-400' : 'text-amber-400'} />
                    <span className={`text-[8px] font-semibold ${status === 'missed' ? 'text-red-400' : 'text-amber-400'}`}>
                      {missedCount} missed
                    </span>
                  </div>
                )}
                {overdueCount > 0 && (
                  <div className="flex items-center gap-0.5">
                    <AlertTriangle size={8} className="text-red-400" />
                    <span className="text-[8px] font-semibold text-red-400">
                      {overdueCount} overdue
                    </span>
                  </div>
                )}
                {stLog && !isFuture && (
                  <span className="text-[8px] text-cyan-500">{stLog.totalHours}h</span>
                )}
                {(isPast || isTodayDay) && overdueCount === 0 && missedCount === 0 && habitTotal > 0 && (
                  <CheckCircle2 size={10} className="text-emerald-500 opacity-70" />
                )}
              </div>

              {/* Selected indicator line */}
              {isSelected && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Week summary bar */}
      <div className="px-5 py-3 border-t border-slate-700/60 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Flame size={13} className="text-amber-400" />
            <span className="text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{weekStats.totalDone}</span>
              <span className="text-slate-500">/{weekStats.totalExpected}</span>
              <span className="ml-1">habits this week</span>
            </span>
          </div>
          {weekStats.overdueInWeek > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertCircle size={13} className="text-red-400" />
              <span className="text-xs text-red-400 font-medium">
                {weekStats.overdueInWeek} overdue task{weekStats.overdueInWeek > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500
                ${weekStats.pct >= 80 ? 'bg-emerald-500' : weekStats.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${weekStats.pct}%` }}
            />
          </div>
          <span className={`text-xs font-semibold tabular-nums
            ${weekStats.pct >= 80 ? 'text-emerald-400' : weekStats.pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {weekStats.pct}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DAY DRILL DOWN
══════════════════════════════════════════════════════════════════════════════ */
function DayDrillDown({
  day, habits, logs, tasks, screenLogs, onToggleHabit,
}: {
  day: Date;
  habits: Habit[];
  logs: HabitLog[];
  tasks: Task[];
  screenLogs: ScreenLog[];
  onToggleHabit: (habitId: string, currentCompleted: boolean) => void;
}) {
  const dStr        = format(day, 'yyyy-MM-dd');
  const isTodayDay  = isToday(day);
  const isPast      = isBefore(day, startOfDay(new Date())) && !isTodayDay;

  const dayLogs = logs.filter(l => l.date === dStr);
  const habitsWithStatus = habits.map(h => ({
    ...h,
    completed: dayLogs.find(l => l.habitId === h.id)?.completed ?? false,
  }));
  const completedCount  = habitsWithStatus.filter(h => h.completed).length;
  const habitPct        = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;

  const dayTasks    = tasks.filter(t => t.dueDate && t.dueDate.startsWith(dStr));
  const overdueTasks = dayTasks.filter(t => t.status !== 'DONE' && (isPast || isTodayDay));

  const stLog = screenLogs.find(l => l.date.startsWith(dStr));
  const stPct = stLog && stLog.totalHours > 0
    ? Math.round((stLog.productiveHours / stLog.totalHours) * 100) : 0;

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-3.5 border-b border-slate-700/60 flex items-center justify-between
        ${isTodayDay ? 'bg-blue-600/10' : isPast && overdueTasks.length > 0 ? 'bg-red-500/5' : ''}`}>
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            {isTodayDay ? '📅 Today' : format(day, 'EEEE, MMMM d')}
          </h3>
          {!isTodayDay && <p className="text-xs text-slate-500">{format(day, 'yyyy')}</p>}
        </div>
        <div className="flex items-center gap-2">
          {habits.length > 0 && (
            <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold
              ${habitPct === 100 ? 'bg-emerald-500/15 text-emerald-400'
                : habitPct >= 50 ? 'bg-amber-500/15 text-amber-400'
                : 'bg-red-500/15 text-red-400'}`}>
              {completedCount}/{habits.length} habits
            </div>
          )}
          {overdueTasks.length > 0 && (
            <div className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold flex items-center gap-1">
              <AlertTriangle size={11} />
              {overdueTasks.length} overdue
            </div>
          )}
        </div>
      </div>

      <div className="p-5 grid lg:grid-cols-3 gap-5">
        {/* ── Habits ── */}
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Habits</p>
          {habitsWithStatus.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-slate-600">
              <Circle size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No habits tracked yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {habitsWithStatus.map(habit => {
                const isMissed = isPast && !habit.completed;
                return (
                  <div key={habit.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors
                      ${isMissed
                        ? 'bg-red-500/8 border border-red-500/20'
                        : habit.completed
                          ? 'bg-emerald-500/8 border border-emerald-500/20'
                          : 'bg-slate-700/40 border border-slate-600/30'
                      }`}>
                    <span className="text-xl flex-shrink-0">{habit.icon}</span>
                    <span className={`flex-1 text-sm font-medium
                      ${isMissed ? 'text-slate-400 line-through decoration-red-400/50'
                        : 'text-slate-200'}`}>
                      {habit.name}
                    </span>
                    {isMissed && (
                      <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                        <XCircle size={12} /> Missed
                      </span>
                    )}
                    {isTodayDay ? (
                      <button
                        onClick={() => onToggleHabit(habit.id, habit.completed)}
                        className={`flex-shrink-0 p-1 rounded-lg transition-all
                          ${habit.completed
                            ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-600/50'}`}>
                        {habit.completed
                          ? <CheckCircle2 size={20} />
                          : <Circle size={20} />}
                      </button>
                    ) : (
                      !isMissed && habit.completed && (
                        <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-4">
          {/* Tasks */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tasks Due</p>
            {dayTasks.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-4">No tasks due this day</p>
            ) : (
              <div className="space-y-2">
                {dayTasks.map(task => {
                  const isOverdue = task.status !== 'DONE' && (isPast || isTodayDay);
                  return (
                    <div key={task.id}
                      className={`flex items-start gap-2 p-2.5 rounded-lg
                        ${isOverdue ? 'bg-red-500/8 border border-red-500/20' : 'bg-slate-700/40'}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate
                          ${task.status === 'DONE' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge
                            variant={task.priority === 'HIGH' ? 'red' : task.priority === 'MEDIUM' ? 'amber' : 'slate'}
                            size="sm">
                            {task.priority}
                          </Badge>
                          {isOverdue && (
                            <span className="text-[9px] font-bold text-red-400 flex items-center gap-0.5">
                              <Clock size={8} /> OVERDUE
                            </span>
                          )}
                        </div>
                      </div>
                      {task.status === 'DONE'
                        ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        : <Circle size={14} className={`flex-shrink-0 mt-0.5 ${isOverdue ? 'text-red-400' : 'text-slate-600'}`} />
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Screen time */}
          {stLog && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Screen Time</p>
              <div className="bg-slate-700/40 rounded-xl p-3 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total</span>
                  <span className="font-semibold text-slate-200">{stLog.totalHours}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-400">Productive</span>
                  <span className="font-semibold text-emerald-400">{stLog.productiveHours}h</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>Productivity</span>
                    <span className={stPct >= 60 ? 'text-emerald-400' : stPct >= 40 ? 'text-amber-400' : 'text-red-400'}>
                      {stPct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${stPct >= 60 ? 'bg-emerald-500' : stPct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${stPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset]     = useState(0);
  const [selectedDay, setSelectedDay]   = useState<Date | null>(new Date());

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });

  /* ── Queries ── */
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => axios.get('/api/dashboard').then(r => r.data),
  });
  const { data: habitsApiData } = useQuery({
    queryKey: ['habits'],
    queryFn: () => axios.get('/api/habits').then(r => r.data),
  });
  const { data: logsApiData } = useQuery({
    queryKey: ['habit-logs', 'rolling-60'],
    queryFn: () => axios.get('/api/habit-logs?days=60').then(r => r.data),
  });
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', 'ALL', 'ALL', 'ALL'],
    queryFn: () => axios.get('/api/tasks?limit=200').then(r => r.data),
  });
  const { data: screenTimeApiData } = useQuery({
    queryKey: ['screen-time'],
    queryFn: () => axios.get('/api/screen-time?days=60').then(r => r.data),
  });

  /* ── Habit toggle ── */
  const toggleHabit = useMutation({
    mutationFn: ({ habitId }: { habitId: string; currentCompleted: boolean }) =>
      axios.post('/api/habit-logs', { habitId, date: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['habits'] });
      qc.invalidateQueries({ queryKey: ['habit-logs'] });
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>;
  if (!data) return null;

  const { user, todayHabits, financeSnapshot, upcomingTasks, motivationSummary, portfolioSummary, recentActivity, screenTimeSummary } = data;

  /* XP progress */
  const NEXT_LEVEL_XP = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];
  const lvl    = (motivationSummary?.level ?? 1) - 1;
  const nextXP = NEXT_LEVEL_XP[lvl + 1] ?? user?.xp;
  const currXP = user?.xp ?? 0;
  const lvlStart = NEXT_LEVEL_XP[lvl] ?? 0;
  const xpPct  = nextXP > lvlStart ? Math.round(((currXP - lvlStart) / (nextXP - lvlStart)) * 100) : 100;

  /* Derived lists */
  const allHabits: Habit[] = (habitsApiData?.habits ?? todayHabits?.habits ?? []).map(
    (h: Habit & { weekDots?: unknown[]; currentStreak?: number }) => ({
      id: h.id, name: h.name, icon: h.icon, color: h.color,
    }),
  );
  const allLogs: HabitLog[]       = logsApiData?.logs ?? [];
  const allTasks: Task[]          = tasksData?.tasks ?? upcomingTasks ?? [];
  const allScreenLogs: ScreenLog[] = screenTimeApiData?.logs ?? [];

  /* Overdue tasks (across all time, not just current week) */
  const now = new Date();
  const globalOverdue = allTasks.filter(t =>
    t.dueDate && t.status !== 'DONE' && isBefore(new Date(t.dueDate), now),
  );

  return (
    <div className="p-6 space-y-6">
      <Header title="Dashboard" />

      {/* ── Greeting + XP ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            {getGreeting()}, {user?.name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-slate-400 mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-800 rounded-xl border border-slate-700 px-4 py-3">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="blue" size="sm">Lvl {motivationSummary?.level}</Badge>
              <span className="text-sm font-semibold text-slate-200">{currXP} XP</span>
            </div>
            <div className="w-36"><ProgressBar value={xpPct} size="sm" color="blue" /></div>
            <span className="text-xs text-slate-500 mt-1">{nextXP - currXP} XP to next level</span>
          </div>
          <Zap size={20} className="text-blue-400" />
        </div>
      </div>

      {/* ── Global Overdue Alert ── */}
      {globalOverdue.length > 0 && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-300 mb-1">
              {globalOverdue.length} Overdue Task{globalOverdue.length > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {globalOverdue.slice(0, 4).map(t => (
                <span key={t.id}
                  className="text-xs bg-red-500/15 text-red-300 px-2 py-0.5 rounded-md truncate max-w-[160px]">
                  {t.title}
                  {t.dueDate && (
                    <span className="text-red-500 ml-1">· {format(new Date(t.dueDate), 'MMM d')}</span>
                  )}
                </span>
              ))}
              {globalOverdue.length > 4 && (
                <span className="text-xs text-red-500">+{globalOverdue.length - 4} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Today's Habit Progress (quick summary) ── */}
      {allHabits.length > 0 && (() => {
        const todayStr = format(now, 'yyyy-MM-dd');
        const doneTodayCount = allLogs.filter(l => l.date === todayStr && l.completed).length;
        const todayPct = Math.round((doneTodayCount / allHabits.length) * 100);
        return (
          <div className="flex items-center gap-4 bg-slate-800 border border-slate-700 rounded-xl px-5 py-3.5">
            <div className="flex items-center gap-2.5 flex-1">
              <CheckSquare size={16} className={
                todayPct === 100 ? 'text-emerald-400' : todayPct >= 50 ? 'text-amber-400' : 'text-red-400'
              } />
              <span className="text-sm font-medium text-slate-300">Today's Habits</span>
              <span className={`text-sm font-bold
                ${todayPct === 100 ? 'text-emerald-300' : todayPct >= 50 ? 'text-amber-300' : 'text-red-300'}`}>
                {doneTodayCount}/{allHabits.length}
              </span>
            </div>
            <div className="w-40 flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all
                    ${todayPct === 100 ? 'bg-emerald-500' : todayPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${todayPct}%` }}
                />
              </div>
              <span className={`text-xs font-bold tabular-nums w-8 text-right
                ${todayPct === 100 ? 'text-emerald-400' : todayPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {todayPct}%
              </span>
            </div>
            {todayPct === 100 && (
              <span className="text-sm">🔥</span>
            )}
          </div>
        );
      })()}

      {/* ── Weekly Strip ── */}
      <WeekStrip
        weekStart={weekStart}
        selectedDay={selectedDay}
        habits={allHabits}
        logs={allLogs}
        tasks={allTasks}
        screenLogs={allScreenLogs}
        onSelectDay={setSelectedDay}
        onPrevWeek={() => { setWeekOffset(w => w - 1); setSelectedDay(null); }}
        onNextWeek={() => { setWeekOffset(w => Math.min(w + 1, 0)); setSelectedDay(null); }}
        canGoNext={weekOffset < 0}
      />

      {/* ── Day Drill Down ── */}
      {selectedDay && (
        <DayDrillDown
          day={selectedDay}
          habits={allHabits}
          logs={allLogs}
          tasks={allTasks}
          screenLogs={allScreenLogs}
          onToggleHabit={(habitId, currentCompleted) =>
            toggleHabit.mutate({ habitId, currentCompleted })}
        />
      )}

      {/* ── Screen Time Widget ── */}
      {(screenTimeSummary?.todayTotal !== null && screenTimeSummary?.todayTotal !== undefined) && (
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Monitor size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Screen Time Today</p>
                <p className="text-xs text-slate-500">
                  {screenTimeSummary.isEstimate ? 'Based on 7-day average (no entry today)' : 'Logged today'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-100">{screenTimeSummary.todayTotal?.toFixed(1)}h</p>
                <p className="text-[11px] text-slate-500">Total</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-400">{(screenTimeSummary.todayProductive ?? 0).toFixed(1)}h</p>
                <p className="text-[11px] text-slate-500">Productive</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-400">{(screenTimeSummary.unproductiveHours ?? 0).toFixed(1)}h</p>
                <p className="text-[11px] text-slate-500">Wasted</p>
              </div>
              <div className="flex flex-col gap-1 min-w-[120px]">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Activity size={10} />Productivity
                  </span>
                  <span className={`text-sm font-bold ${
                    (screenTimeSummary.productivityPct ?? 0) >= 60 ? 'text-emerald-400'
                    : (screenTimeSummary.productivityPct ?? 0) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                    {screenTimeSummary.productivityPct ?? 0}%
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (screenTimeSummary.productivityPct ?? 0) >= 60 ? 'bg-emerald-500'
                      : (screenTimeSummary.productivityPct ?? 0) >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(screenTimeSummary.productivityPct ?? 0, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 text-right">
                  {(screenTimeSummary.productivityPct ?? 0) >= 60
                    ? 'On track 🎯'
                    : (screenTimeSummary.productivityPct ?? 0) >= 40
                      ? 'Could improve 📈' : 'High distraction ⚠️'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Finance + Quote ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Finance Snapshot" subtitle="This month">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 font-medium mb-1">Income</p>
              <p className="text-lg font-bold text-emerald-300">
                {formatCurrency(financeSnapshot?.currentMonthIncome ?? 0)}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400 font-medium mb-1">Expenses</p>
              <p className="text-lg font-bold text-red-300">
                {formatCurrency(financeSnapshot?.currentMonthExpenses ?? 0)}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-400 font-medium mb-1">Savings</p>
              <p className={`text-lg font-bold ${(financeSnapshot?.savings ?? 0) >= 0 ? 'text-blue-300' : 'text-red-300'}`}>
                {formatCurrency(financeSnapshot?.savings ?? 0)}
              </p>
            </div>
          </div>
          {financeSnapshot?.topBudgetWarnings?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <AlertTriangle size={12} />Budget Alerts
              </p>
              {financeSnapshot.topBudgetWarnings.map((b: { id: string; name: string; percentage: number; status: string }) => (
                <div key={b.id} className="flex items-center gap-3">
                  <span className="text-sm text-slate-300 w-24 truncate">{b.name}</span>
                  <ProgressBar value={b.percentage} color={b.status === 'danger' ? 'red' : 'amber'} size="sm" className="flex-1" />
                  <span className={`text-xs font-semibold ${b.status === 'danger' ? 'text-red-400' : 'text-amber-400'}`}>
                    {b.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex flex-col h-full justify-between">
            <Star size={20} className="text-amber-400 mb-3" />
            <blockquote className="text-slate-200 text-base font-medium leading-relaxed italic flex-1">
              &ldquo;{motivationSummary?.todayQuote?.text ?? 'Every day is a new opportunity to grow and become better.'}&rdquo;
            </blockquote>
            {motivationSummary?.todayQuote?.author && (
              <p className="text-slate-500 text-sm mt-4">— {motivationSummary.todayQuote.author}</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Recent XP Activity ── */}
      {recentActivity?.length > 0 && (
        <Card title="Recent Activity" subtitle="XP earned">
          <div className="space-y-2">
            {recentActivity.slice(0, 5).map((log: { id: string; action: string; xpEarned: number; createdAt: string }) => (
              <div key={log.id}
                className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                <span className="text-sm text-slate-300 capitalize">{log.action.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-1.5">
                  <Flame size={12} className="text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">+{log.xpEarned} XP</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {format(new Date(log.createdAt), 'h:mm a')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
