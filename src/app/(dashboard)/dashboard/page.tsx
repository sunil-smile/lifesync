'use client';

import { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CheckCircle2, Circle, Flame, Zap, DollarSign, CheckSquare, TrendingUp, Calendar, Star, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning'; if (h < 17) return 'Good afternoon'; return 'Good evening';
}

const WEEK_DAYS = ['M','T','W','T','F','S','S'];

function formatCurrency(n: number) { return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n); }

export default function DashboardPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => axios.get('/api/dashboard').then(r => r.data) });

  const toggleHabit = useMutation({
    mutationFn: ({ habitId, completed }: { habitId: string; completed: boolean }) =>
      axios.post('/api/habit-logs', { habitId, date: new Date().toISOString(), completed: !completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  if (isLoading) return <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>;
  if (!data) return null;

  const { user, todayHabits, financeSnapshot, upcomingTasks, motivationSummary, portfolioSummary, recentActivity } = data;

  const NEXT_LEVEL_XP = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];
  const lvl = (motivationSummary?.level ?? 1) - 1;
  const nextXP = NEXT_LEVEL_XP[lvl + 1] ?? user?.xp;
  const currXP = user?.xp ?? 0;
  const lvlStart = NEXT_LEVEL_XP[lvl] ?? 0;
  const xpPct = nextXP > lvlStart ? Math.round(((currXP - lvlStart) / (nextXP - lvlStart)) * 100) : 100;

  return (
    <div className="p-6 space-y-6">
      <Header title="Dashboard" />

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">{getGreeting()}, {user?.name?.split(' ')[0]}! 👋</h2>
          <p className="text-slate-400 mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 bg-slate-800 rounded-xl border border-slate-700 px-4 py-3">
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Habits" value={`${todayHabits?.completedCount ?? 0}/${todayHabits?.totalCount ?? 0}`} icon={<CheckCircle2 size={18} />} color="emerald" />
        <StatCard title="Month Spend" value={formatCurrency(financeSnapshot?.currentMonthExpenses ?? 0)} icon={<DollarSign size={18} />} color="amber" />
        <StatCard title="Active Tasks" value={upcomingTasks?.length ?? 0} icon={<CheckSquare size={18} />} color="blue" />
        <StatCard title="Portfolio" value={formatCurrency(portfolioSummary?.totalValue ?? 0)} icon={<TrendingUp size={18} />} color="violet" />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Habits */}
        <Card title="Today's Habits" subtitle={`${todayHabits?.completedCount}/${todayHabits?.totalCount} complete`}>
          {todayHabits?.habits?.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No habits yet. Add some in the Activity tab!</p>
          ) : (
            <div className="space-y-3">
              {todayHabits?.habits?.map((habit: { id: string; icon: string; name: string; todayCompleted: boolean }) => (
                <div key={habit.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors">
                  <span className="text-xl flex-shrink-0">{habit.icon}</span>
                  <span className="flex-1 text-sm font-medium text-slate-200">{habit.name}</span>
                  <button onClick={() => toggleHabit.mutate({ habitId: habit.id, completed: habit.todayCompleted })}
                    className={`flex-shrink-0 transition-colors ${habit.todayCompleted ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}>
                    {habit.todayCompleted ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Tasks */}
        <Card title="Upcoming Tasks" action={<Badge variant="blue" size="sm">{upcomingTasks?.length ?? 0}</Badge>}>
          {upcomingTasks?.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No upcoming tasks. Great job! 🎉</p>
          ) : (
            <div className="space-y-2">
              {upcomingTasks?.map((task: { id: string; title: string; priority: string; dueDate?: string; assignee: string }) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50">
                  <Badge variant={task.priority === 'HIGH' ? 'red' : task.priority === 'MEDIUM' ? 'amber' : 'slate'} size="sm">
                    {task.priority}
                  </Badge>
                  <span className="flex-1 text-sm text-slate-200 truncate">{task.title}</span>
                  {task.dueDate && (
                    <span className="text-xs text-slate-500 flex-shrink-0 flex items-center gap-1">
                      <Calendar size={11} />{format(new Date(task.dueDate), 'MMM d')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Finance + Quote */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Finance Snapshot" subtitle="This month">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 font-medium mb-1">Income</p>
              <p className="text-lg font-bold text-emerald-300">{formatCurrency(financeSnapshot?.currentMonthIncome ?? 0)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400 font-medium mb-1">Expenses</p>
              <p className="text-lg font-bold text-red-300">{formatCurrency(financeSnapshot?.currentMonthExpenses ?? 0)}</p>
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
              <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5"><AlertTriangle size={12} />Budget Alerts</p>
              {financeSnapshot.topBudgetWarnings.map((b: { id: string; name: string; percentage: number; status: string }) => (
                <div key={b.id} className="flex items-center gap-3">
                  <span className="text-sm text-slate-300 w-24 truncate">{b.name}</span>
                  <ProgressBar value={b.percentage} color={b.status === 'danger' ? 'red' : 'amber'} size="sm" className="flex-1" />
                  <span className={`text-xs font-semibold ${b.status === 'danger' ? 'text-red-400' : 'text-amber-400'}`}>{b.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quote */}
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

      {/* Recent XP Activity */}
      {recentActivity?.length > 0 && (
        <Card title="Recent Activity" subtitle="XP earned">
          <div className="space-y-2">
            {recentActivity.slice(0, 5).map((log: { id: string; action: string; xpEarned: number; createdAt: string }) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                <span className="text-sm text-slate-300 capitalize">{log.action.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-1.5">
                  <Flame size={12} className="text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">+{log.xpEarned} XP</span>
                  <span className="text-xs text-slate-500 ml-2">{format(new Date(log.createdAt), 'h:mm a')}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
