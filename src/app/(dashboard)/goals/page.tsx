'use client';

import { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { Plus, Target, ChevronDown, ChevronRight, Check, Circle, LayoutList, GanttChartSquare, Pencil, Trash2 } from 'lucide-react';
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
  parentGoalId?: string | null;
  milestones: { id: string; title: string; completed: boolean }[];
  childGoals: { id: string; title: string; type: GoalType; status: string; progress: number }[];
}

// Flatten all goals from the tree (using allGoals flat list)
function flattenGoals(goals: Goal[], allGoals: Goal[], depth = 0): (Goal & { depth: number })[] {
  const result: (Goal & { depth: number })[] = [];
  for (const g of goals) {
    result.push({ ...g, depth });
    const children = allGoals.filter(c => c.parentGoalId === g.id);
    if (children.length) result.push(...flattenGoals(children, allGoals, depth + 1));
  }
  return result;
}

/* ─── Gantt / Timeline View ─────────────────────────────── */
function GanttView({ rootGoals, allGoals }: { rootGoals: Goal[]; allGoals: Goal[] }) {
  const now = new Date();
  const flat = flattenGoals(rootGoals, allGoals);
  if (flat.length === 0) return <EmptyState icon={<Target size={28} />} title="No goals yet" description="Add goals and they'll appear on the timeline." />;

  const starts = flat.map(g => g.createdAt ? new Date(g.createdAt) : now);
  const ends = flat.map(g => g.targetDate ? new Date(g.targetDate) : addMonths(now, 6));
  const minTs = Math.min(...starts.map(d => d.getTime()), startOfMonth(now).getTime());
  const maxTs = Math.max(...ends.map(d => d.getTime()), addMonths(now, 3).getTime());
  const totalMs = maxTs - minTs;

  const months: Date[] = [];
  const cur = new Date(startOfMonth(new Date(minTs)));
  while (cur.getTime() <= maxTs) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }

  const todayPct = Math.max(0, Math.min(100, ((now.getTime() - minTs) / totalMs) * 100));

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex border-b border-slate-700">
        <div className="w-52 flex-shrink-0 px-4 py-2 text-xs font-medium text-slate-400 border-r border-slate-700">Goal</div>
        <div className="flex-1 relative min-w-0">
          <div className="flex h-full">
            {months.map((m, i) => {
              const monthPct = ((m.getTime() - minTs) / totalMs) * 100;
              const nextM = months[i + 1];
              const nextPct = nextM ? ((nextM.getTime() - minTs) / totalMs) * 100 : 100;
              return (
                <div key={m.toISOString()} className="flex-shrink-0 border-r border-slate-700/50 px-1 py-2 text-[10px] text-slate-500 overflow-hidden" style={{ width: `${(nextPct - monthPct).toFixed(2)}%` }}>
                  {format(m, months.length > 16 ? 'MMM yy' : 'MMM yyyy')}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {flat.map(goal => {
        const cfg = GOAL_TYPE_CONFIG[goal.type] ?? GOAL_TYPE_CONFIG.SHORT_TERM;
        const start = goal.createdAt ? new Date(goal.createdAt) : now;
        const end = goal.targetDate ? new Date(goal.targetDate) : addMonths(now, 6);
        const leftPct = Math.max(0, ((start.getTime() - minTs) / totalMs) * 100);
        const widthPct = Math.max(1, ((end.getTime() - start.getTime()) / totalMs) * 100);
        const daysLeft = goal.targetDate ? differenceInDays(new Date(goal.targetDate), now) : null;
        const isOverdue = daysLeft !== null && daysLeft < 0 && goal.status !== 'COMPLETED';
        return (
          <div key={goal.id} className="flex border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
            <div className="w-52 flex-shrink-0 flex items-center gap-2 px-4 py-3 border-r border-slate-700/50" style={{ paddingLeft: `${16 + goal.depth * 16}px` }}>
              <span className="text-base flex-shrink-0">{cfg.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{goal.title}</p>
                <p className="text-[10px]">{daysLeft !== null ? isOverdue ? <span className="text-red-400">{Math.abs(daysLeft)}d overdue</span> : <span className="text-slate-500">{daysLeft}d left</span> : <span className="text-slate-500">{goal.category}</span>}</p>
              </div>
            </div>
            <div className="flex-1 relative min-w-0 py-3 px-1">
              {months.map(m => <div key={m.toISOString()} className="absolute top-0 bottom-0 w-px bg-slate-700/30" style={{ left: `${((m.getTime() - minTs) / totalMs * 100).toFixed(2)}%` }} />)}
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-10" style={{ left: `${todayPct.toFixed(2)}%` }}><div className="absolute -top-0.5 -left-1 w-2 h-2 rounded-full bg-red-500" /></div>
              <div className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full overflow-hidden" style={{ left: `${leftPct.toFixed(2)}%`, width: `${widthPct.toFixed(2)}%`, backgroundColor: `${cfg.barColor}25`, border: `1px solid ${cfg.barColor}60` }}>
                <div className="h-full rounded-full" style={{ width: `${goal.progress}%`, backgroundColor: cfg.barColor + 'CC' }} />
                {widthPct > 8 && <div className="absolute inset-0 flex items-center px-2"><span className="text-[10px] font-medium text-white/80 truncate">{goal.progress}%</span></div>}
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex border-t border-slate-700">
        <div className="w-52 flex-shrink-0 border-r border-slate-700/50" />
        <div className="flex-1 relative h-5">
          <div className="absolute text-[10px] text-red-400 font-medium" style={{ left: `max(0px, calc(${todayPct.toFixed(2)}% - 20px))` }}>Today</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Goal Node (Tree View) ─────────────────────────────── */
function GoalNode({ goal, depth = 0, onAddChild, onEdit, onDelete, allGoals }: {
  goal: Goal; depth?: number; onAddChild: (parentId: string) => void;
  onEdit: (goal: Goal) => void; onDelete: (id: string) => void; allGoals: Goal[];
}) {
  const [expanded, setExpanded] = useState(true);
  const qc = useQueryClient();
  const toggleMilestone = async (milestoneId: string, completed: boolean) => {
    await axios.put(`/api/goals/${goal.id}/milestones/${milestoneId}`, { completed: !completed });
    qc.invalidateQueries({ queryKey: ['goals'] });
  };
  const cfg = GOAL_TYPE_CONFIG[goal.type] ?? GOAL_TYPE_CONFIG.SHORT_TERM;
  // Look up children from the flat allGoals list
  const children = allGoals.filter(g => g.parentGoalId === goal.id);
  const isOverdue = goal.targetDate && new Date(goal.targetDate) < new Date() && goal.status !== 'COMPLETED';

  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-slate-700' : ''}`}>
      <div className={`rounded-xl border p-4 mb-3 hover:border-slate-600 transition-colors ${isOverdue ? 'bg-red-950/20 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
        <div className="flex items-start gap-3">
          <button onClick={() => setExpanded(e => !e)} className="mt-1 text-slate-500 flex-shrink-0">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-lg">{cfg.emoji}</span>
              <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
              <h3 className="font-semibold text-slate-100 flex-1">{goal.title}</h3>
              <Badge variant={goal.status === 'COMPLETED' ? 'emerald' : isOverdue ? 'red' : 'slate'} size="sm">
                {isOverdue && goal.status !== 'COMPLETED' ? '⚠️ OVERDUE' : goal.status}
              </Badge>
            </div>
            <ProgressBar value={goal.progress} size="sm" color={cfg.variant} showLabel />
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span>📁 {goal.category}</span>
              {goal.targetDate && <span className={isOverdue ? 'text-red-400' : ''}>📅 {format(new Date(goal.targetDate), 'MMM yyyy')}</span>}
              <span>{goal.assignee === 'vidhya' ? '👩 Vidhya' : '👨 Sunil'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEdit(goal)} className="text-slate-500 hover:text-blue-400 p-1 rounded transition-colors" title="Edit"><Pencil size={13} /></button>
            <button onClick={() => onAddChild(goal.id)} className="text-xs text-slate-500 hover:text-emerald-400 flex items-center gap-0.5 transition-colors p-1" title="Add sub-goal"><Plus size={13} /></button>
            <button onClick={() => onDelete(goal.id)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors" title="Delete"><Trash2 size={13} /></button>
          </div>
        </div>
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
      {expanded && children.map(child => (
        <GoalNode key={child.id} goal={child} depth={depth + 1} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} allGoals={allGoals} />
      ))}
    </div>
  );
}

/* ─── Goal Form ──────────────────────────────────────────── */
function GoalForm({ form, setForm, goals, onSubmit, isPending, submitLabel }: {
  form: Record<string, string>; setForm: (fn: (p: Record<string, string>) => Record<string, string>) => void;
  goals: Goal[]; onSubmit: () => void; isPending: boolean; submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Goal Title *</label><input value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="What do you want to achieve?" /></div>
      <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Why? (motivation)</label><textarea value={form.whyMotivation ?? ''} onChange={e => setForm(p => ({ ...p, whyMotivation: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 h-16 resize-none" placeholder="Why is this important to you?" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
          <select value={form.type ?? 'LIFE'} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
            <option value="LIFE">🌟 Life Goal</option><option value="LONG_TERM">🎯 Long-term</option><option value="SHORT_TERM">✅ Short-term</option>
          </select>
        </div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
          <select value={form.category ?? 'Personal'} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Assignee</label>
          <select value={form.assignee ?? 'sunil'} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
            <option value="sunil">👨 Sunil</option><option value="vidhya">👩 Vidhya</option>
          </select>
        </div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Target Date</label>
          <input type="date" value={form.targetDate ?? ''} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" />
        </div>
      </div>
      <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Status</label>
        <select value={form.status ?? 'ACTIVE'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
          <option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="ARCHIVED">Archived</option>
        </select>
      </div>
      {goals.length > 0 && (
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Parent Goal (optional)</label>
          <select value={form.parentGoalId ?? ''} onChange={e => setForm(p => ({ ...p, parentGoalId: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
            <option value="">No parent (top-level)</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.type === 'LIFE' ? '🌟' : g.type === 'LONG_TERM' ? '🎯' : '✅'} {g.title}</option>)}
          </select>
        </div>
      )}
      <div><label className="block text-sm font-medium text-slate-300 mb-2">Progress: {form.progress ?? 0}%</label>
        <input type="range" min="0" max="100" value={form.progress ?? '0'} onChange={e => setForm(p => ({ ...p, progress: e.target.value }))} className="w-full" />
      </div>
      <button onClick={onSubmit} disabled={!form.title?.trim() || isPending} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium">
        {isPending ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function GoalsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, string>>({});
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'tree' | 'timeline'>('tree');

  const { data, isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => axios.get('/api/goals').then(r => r.data) });

  const createGoal = useMutation({
    mutationFn: (d: Record<string, unknown>) => axios.post('/api/goals', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowCreateModal(false); toast('Goal created! +20 XP 🎯'); },
    onError: () => toast('Failed to create goal', 'error'),
  });
  const updateGoal = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Record<string, unknown>) => axios.put(`/api/goals/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setEditingGoal(null); toast('Goal updated! ✏️'); },
    onError: () => toast('Failed to update goal', 'error'),
  });
  const deleteGoal = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/goals/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast('Goal deleted'); },
    onError: () => toast('Failed to delete goal', 'error'),
  });

  const allGoals: Goal[] = data?.goals ?? [];
  // Root goals = no parentGoalId (show ALL types at root level)
  const rootGoals = allGoals.filter(g => !g.parentGoalId);

  const openCreate = (parentId?: string) => {
    setCreateForm({ type: parentId ? 'LONG_TERM' : 'LIFE', assignee: 'sunil', category: 'Personal', progress: '0', parentGoalId: parentId ?? '', status: 'ACTIVE' });
    setShowCreateModal(true);
  };
  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setEditForm({
      title: goal.title, type: goal.type, category: goal.category, assignee: goal.assignee,
      progress: String(goal.progress), status: goal.status, parentGoalId: goal.parentGoalId ?? '',
      targetDate: goal.targetDate ? format(new Date(goal.targetDate), 'yyyy-MM-dd') : '',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <Header title="Goals" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-slate-400 text-sm">
          {allGoals.length} goals · {rootGoals.length} top-level
        </p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-800 rounded-lg border border-slate-700">
            <button onClick={() => setViewMode('tree')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'tree' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-100'}`}>
              <LayoutList size={13} />Tree
            </button>
            <button onClick={() => setViewMode('timeline')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-100'}`}>
              <GanttChartSquare size={13} />Timeline
            </button>
          </div>
          <button onClick={() => openCreate()} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-lg font-medium">
            <Plus size={14} />Add Goal
          </button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner className="py-12" /> : (
        viewMode === 'timeline' ? (
          <GanttView rootGoals={rootGoals} allGoals={allGoals} />
        ) : rootGoals.length === 0 ? (
          <EmptyState icon={<Target size={28} />} title="No goals yet" description="Add your first goal — Life Goal, Long-term, or Short-term." action={{ label: 'Add First Goal', onClick: () => openCreate() }} />
        ) : (
          <div className="space-y-2">
            {rootGoals.map(goal => (
              <GoalNode key={goal.id} goal={goal} onAddChild={openCreate} onEdit={openEdit} onDelete={id => deleteGoal.mutate(id)} allGoals={allGoals} />
            ))}
          </div>
        )
      )}

      {viewMode === 'timeline' && allGoals.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap text-xs text-slate-400">
          {Object.entries(GOAL_TYPE_CONFIG).map(([, cfg]) => (
            <div key={cfg.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cfg.barColor }} />{cfg.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5"><div className="w-0.5 h-3 bg-red-500 rounded" />Today</div>
          <span className="text-slate-500">Bar fill = progress</span>
        </div>
      )}

      {/* Create Goal Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Goal" size="lg">
        <GoalForm form={createForm} setForm={setCreateForm} goals={allGoals}
          onSubmit={() => createGoal.mutate({ ...createForm, progress: parseInt(createForm.progress ?? '0'), parentGoalId: createForm.parentGoalId || undefined })}
          isPending={createGoal.isPending} submitLabel="Create Goal" />
      </Modal>

      {/* Edit Goal Modal */}
      <Modal isOpen={!!editingGoal} onClose={() => setEditingGoal(null)} title="Edit Goal" size="lg">
        {editingGoal && (
          <GoalForm form={editForm} setForm={setEditForm} goals={allGoals.filter(g => g.id !== editingGoal.id)}
            onSubmit={() => updateGoal.mutate({ id: editingGoal.id, ...editForm, progress: parseInt(editForm.progress ?? '0'), parentGoalId: editForm.parentGoalId || null })}
            isPending={updateGoal.isPending} submitLabel="Save Changes" />
        )}
      </Modal>
    </div>
  );
}
