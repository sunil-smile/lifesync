'use client';

import { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { Plus, Target, ChevronDown, ChevronRight, Check, Circle, LayoutList, GanttChartSquare } from 'lucide-react';
import { format, addMonths, differenceInDays, startOfMonth } from 'date-fns';

type GoalType = 'LIFE' | 'LONG_TERM' | 'SHORT_TERM';
const GOAL_TYPE_CONFIG: Record<GoalType, { label: string; variant: 'violet' | 'blue' | 'emerald'; emoji: string; barColor: string }> = {
  LIFE:       { label: 'Life Goal',  variant: 'violet',  emoji: '🌟', barColor: '#8B5CF6' },
  LONG_TERM:  { label: 'Long-term', variant: 'blue',    emoji: '🎯', barColor: '#3B82F6' },
  SHORT_TERM: { label: 'Short-term',variant: 'emerald', emoji: '✅', barColor: '#10B981' },
};
const CATEGORIES = ['Career','Health','Finance','Family','Learning','Travel','Relationships','Personal','Other'];

interface Goal {
  id: string; title: string; type: GoalType; category: string; progress: number;
  status: string; targetDate?: string; assignee: string; createdAt?: string;
  milestones: { id: string; title: string; completed: boolean }[];
  childGoals: Goal[];
}

// Flatten nested goal tree into a flat list with depth info
function flattenGoals(goals: Goal[], depth = 0): (Goal & { depth: number })[] {
  const result: (Goal & { depth: number })[] = [];
  for (const g of goals) {
    result.push({ ...g, depth });
    if (g.childGoals?.length) result.push(...flattenGoals(g.childGoals, depth + 1));
  }
  return result;
}

/* ─── Gantt / Timeline View ─────────────────────────────── */
function GanttView({ goals }: { goals: Goal[] }) {
  const now = new Date();
  const flat = flattenGoals(goals);

  // Determine time range
  const starts = flat.map(g => g.createdAt ? new Date(g.createdAt) : now);
  const ends = flat.map(g => g.targetDate ? new Date(g.targetDate) : addMonths(now, 6));

  const minTs = Math.min(...starts.map(d => d.getTime()), startOfMonth(now).getTime());
  const maxTs = Math.max(...ends.map(d => d.getTime()), addMonths(now, 3).getTime());
  const totalMs = maxTs - minTs;

  // Month markers
  const months: Date[] = [];
  const cur = new Date(startOfMonth(new Date(minTs)));
  while (cur.getTime() <= maxTs) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  // Today's x position
  const todayPct = Math.max(0, Math.min(100, ((now.getTime() - minTs) / totalMs) * 100));

  const getBarStyle = (goal: Goal) => {
    const start = goal.createdAt ? new Date(goal.createdAt) : now;
    const end = goal.targetDate ? new Date(goal.targetDate) : addMonths(now, 6);
    const leftPct = Math.max(0, ((start.getTime() - minTs) / totalMs) * 100);
    const widthPct = Math.max(1, ((end.getTime() - start.getTime()) / totalMs) * 100);
    return { left: `${leftPct.toFixed(2)}%`, width: `${widthPct.toFixed(2)}%` };
  };

  const getDaysLeft = (goal: Goal) => {
    if (!goal.targetDate) return null;
    const d = differenceInDays(new Date(goal.targetDate), now);
    return d;
  };

  if (flat.length === 0) return (
    <EmptyState icon={<Target size={28} />} title="No goals yet" description="Add life goals and they'll appear on the timeline." />
  );

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header row */}
      <div className="flex border-b border-slate-700">
        <div className="w-52 flex-shrink-0 px-4 py-2 text-xs font-medium text-slate-400 border-r border-slate-700">Goal</div>
        <div className="flex-1 relative min-w-0">
          {/* Month labels */}
          <div className="flex h-full">
            {months.map((m, i) => {
              const monthPct = ((m.getTime() - minTs) / totalMs) * 100;
              const nextM = months[i + 1];
              const nextPct = nextM ? ((nextM.getTime() - minTs) / totalMs) * 100 : 100;
              const widPct = nextPct - monthPct;
              return (
                <div key={m.toISOString()}
                  className="flex-shrink-0 border-r border-slate-700/50 px-1 py-2 text-[10px] text-slate-500 overflow-hidden"
                  style={{ width: `${widPct.toFixed(2)}%` }}>
                  {format(m, months.length > 16 ? 'MMM yy' : 'MMM yyyy')}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Goal rows */}
      {flat.map(goal => {
        const cfg = GOAL_TYPE_CONFIG[goal.type];
        const barStyle = getBarStyle(goal);
        const daysLeft = getDaysLeft(goal);
        const isOverdue = daysLeft !== null && daysLeft < 0 && goal.status !== 'COMPLETED';

        return (
          <div key={goal.id} className="flex border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors group">
            {/* Label */}
            <div className="w-52 flex-shrink-0 flex items-center gap-2 px-4 py-3 border-r border-slate-700/50"
              style={{ paddingLeft: `${16 + goal.depth * 16}px` }}>
              <span className="text-base flex-shrink-0">{cfg.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{goal.title}</p>
                <p className="text-[10px] text-slate-500">
                  {daysLeft !== null
                    ? isOverdue
                      ? <span className="text-red-400">{Math.abs(daysLeft)}d overdue</span>
                      : `${daysLeft}d left`
                    : goal.category}
                </p>
              </div>
            </div>

            {/* Bar area */}
            <div className="flex-1 relative min-w-0 py-3 px-1">
              {/* Month grid lines */}
              {months.map(m => {
                const pct = ((m.getTime() - minTs) / totalMs) * 100;
                return (
                  <div key={m.toISOString()} className="absolute top-0 bottom-0 w-px bg-slate-700/30"
                    style={{ left: `${pct.toFixed(2)}%` }} />
                );
              })}

              {/* Today line */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-10"
                style={{ left: `${todayPct.toFixed(2)}%` }}>
                <div className="absolute -top-0.5 -left-1 w-2 h-2 rounded-full bg-red-500" />
              </div>

              {/* Goal bar */}
              <div className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full overflow-hidden"
                style={{ ...barStyle, backgroundColor: `${cfg.barColor}25`, border: `1px solid ${cfg.barColor}60` }}>
                {/* Progress fill */}
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${goal.progress}%`, backgroundColor: cfg.barColor + (goal.status === 'COMPLETED' ? '' : 'CC') }} />
                {/* Label on bar */}
                {parseFloat(barStyle.width) > 8 && (
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[10px] font-medium text-white/80 truncate">{goal.progress}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Today label */}
      <div className="flex border-t border-slate-700">
        <div className="w-52 flex-shrink-0 border-r border-slate-700/50" />
        <div className="flex-1 relative h-5">
          <div className="absolute text-[10px] text-red-400 font-medium"
            style={{ left: `max(0px, calc(${todayPct.toFixed(2)}% - 20px))` }}>
            Today
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tree View ─────────────────────────────────────────── */
function GoalNode({ goal, depth = 0, onAddChild, allGoals }: { goal: Goal; depth?: number; onAddChild: (parentId: string) => void; allGoals: Goal[] }) {
  const [expanded, setExpanded] = useState(true);
  const qc = useQueryClient();
  const toggleMilestone = async (milestoneId: string, completed: boolean) => {
    await axios.put(`/api/goals/${goal.id}/milestones/${milestoneId}`, { completed: !completed });
    qc.invalidateQueries({ queryKey: ['goals'] });
  };
  const cfg = GOAL_TYPE_CONFIG[goal.type];
  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-slate-700' : ''}`}>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-3 hover:border-slate-600 transition-colors">
        <div className="flex items-start gap-3">
          <button onClick={() => setExpanded(e => !e)} className="mt-1 text-slate-500 flex-shrink-0">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-lg">{cfg.emoji}</span>
              <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
              <h3 className="font-semibold text-slate-100 flex-1">{goal.title}</h3>
              <Badge variant={goal.status === 'COMPLETED' ? 'emerald' : 'slate'} size="sm">{goal.status}</Badge>
            </div>
            <ProgressBar value={goal.progress} size="sm" color={cfg.variant} showLabel />
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span>📁 {goal.category}</span>
              {goal.targetDate && <span>📅 {format(new Date(goal.targetDate), 'MMM yyyy')}</span>}
              <span>{goal.assignee === 'vidhya' ? '👩 Vidhya' : '👨 Sunil'}</span>
            </div>
          </div>
          <button onClick={() => onAddChild(goal.id)} className="flex-shrink-0 text-xs text-slate-500 hover:text-blue-400 flex items-center gap-1 transition-colors"><Plus size={12} />Sub-goal</button>
        </div>
        {/* Milestones */}
        {expanded && goal.milestones?.length > 0 && (
          <div className="mt-3 ml-7 space-y-1.5">
            {goal.milestones.map(m => (
              <button key={m.id} onClick={() => toggleMilestone(m.id, m.completed)} className={`flex items-center gap-2 w-full text-left text-sm transition-colors ${m.completed ? 'text-slate-500 line-through' : 'text-slate-300 hover:text-slate-100'}`}>
                {m.completed ? <Check size={14} className="text-emerald-400 flex-shrink-0" /> : <Circle size={14} className="text-slate-600 flex-shrink-0" />}
                {m.title}
              </button>
            ))}
          </div>
        )}
      </div>
      {expanded && goal.childGoals?.length > 0 && goal.childGoals.map(child => (
        <GoalNode key={child.id} goal={child} depth={depth + 1} onAddChild={onAddChild} allGoals={allGoals} />
      ))}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function GoalsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'tree' | 'timeline'>('tree');

  const { data, isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => axios.get('/api/goals').then(r => r.data) });

  const createGoal = useMutation({
    mutationFn: (d: Record<string, unknown>) => axios.post('/api/goals', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowModal(false); toast('Goal created! +20 XP 🎯'); },
    onError: () => toast('Failed to create goal', 'error'),
  });

  const allGoals: Goal[] = data?.goals ?? [];
  const lifeGoals = allGoals.filter(g => g.type === 'LIFE' && !('parentGoalId' in g && (g as Goal & { parentGoalId?: string }).parentGoalId));

  const openAddModal = (parentId?: string) => {
    setForm({ type: parentId ? 'LONG_TERM' : 'LIFE', assignee: 'sunil', category: 'Personal', progress: '0', parentGoalId: parentId ?? '' });
    setShowModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      <Header title="Goals" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-slate-400 text-sm">{allGoals.length} goals · Life → Long-term → Short-term hierarchy</p>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 p-1 bg-slate-800 rounded-lg border border-slate-700">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'tree' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-100'}`}>
              <LayoutList size={13} />Tree
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-100'}`}>
              <GanttChartSquare size={13} />Timeline
            </button>
          </div>
          <button onClick={() => openAddModal()} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-lg font-medium">
            <Plus size={14} />Add Life Goal
          </button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner className="py-12" /> : (
        <>
          {viewMode === 'timeline' ? (
            <GanttView goals={lifeGoals} />
          ) : (
            lifeGoals.length === 0 ? (
              <EmptyState icon={<Target size={28} />} title="No life goals yet" description="Start with a big life goal and break it down into long-term and short-term goals." action={{ label: 'Add First Life Goal', onClick: () => openAddModal() }} />
            ) : (
              <div className="space-y-2">
                {lifeGoals.map(goal => <GoalNode key={goal.id} goal={goal} onAddChild={openAddModal} allGoals={allGoals} />)}
              </div>
            )
          )}
        </>
      )}

      {/* Legend for Timeline */}
      {viewMode === 'timeline' && allGoals.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap text-xs text-slate-400">
          {Object.entries(GOAL_TYPE_CONFIG).map(([, cfg]) => (
            <div key={cfg.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cfg.barColor }} />
              {cfg.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-3 bg-red-500 rounded" />Today
          </div>
          <span className="text-slate-500">Bar fill = progress</span>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Goal" size="lg">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Goal Title *</label><input value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="What do you want to achieve?" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Why? (your motivation)</label><textarea value={form.whyMotivation ?? ''} onChange={e => setForm(p => ({ ...p, whyMotivation: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 h-20 resize-none" placeholder="Why is this goal important to you?" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label><select value={form.type ?? 'LIFE'} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"><option value="LIFE">🌟 Life Goal</option><option value="LONG_TERM">🎯 Long-term</option><option value="SHORT_TERM">✅ Short-term</option></select></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label><select value={form.category ?? 'Personal'} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Assignee</label><select value={form.assignee ?? 'sunil'} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"><option value="sunil">Sunil</option><option value="vidhya">Vidhya</option></select></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Target Date</label><input type="date" value={form.targetDate ?? ''} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
          </div>
          {form.parentGoalId && <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Parent Goal</label><p className="text-sm text-slate-400 px-3 py-2 bg-slate-700/50 rounded-lg">{allGoals.find(g => g.id === form.parentGoalId)?.title ?? 'None'}</p></div>}
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Initial Progress: {form.progress ?? 0}%</label><input type="range" min="0" max="100" value={form.progress ?? '0'} onChange={e => setForm(p => ({ ...p, progress: e.target.value }))} className="w-full" /></div>
          <button onClick={() => createGoal.mutate({ ...form, progress: parseInt(form.progress ?? '0'), parentGoalId: form.parentGoalId || undefined })} disabled={!form.title?.trim() || !form.type || !form.category} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium">{createGoal.isPending ? 'Creating...' : 'Create Goal'}</button>
        </div>
      </Modal>
    </div>
  );
}
