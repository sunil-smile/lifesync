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
import { Plus, Target, ChevronDown, ChevronRight, Check, Circle } from 'lucide-react';
import { format } from 'date-fns';

type GoalType = 'LIFE' | 'LONG_TERM' | 'SHORT_TERM';
const GOAL_TYPE_CONFIG: Record<GoalType, { label: string; variant: 'violet' | 'blue' | 'emerald'; emoji: string }> = {
  LIFE: { label: 'Life Goal', variant: 'violet', emoji: '🌟' },
  LONG_TERM: { label: 'Long-term', variant: 'blue', emoji: '🎯' },
  SHORT_TERM: { label: 'Short-term', variant: 'emerald', emoji: '✅' },
};
const CATEGORIES = ['Career','Health','Finance','Family','Learning','Travel','Relationships','Personal','Other'];

interface Goal { id: string; title: string; type: GoalType; category: string; progress: number; status: string; targetDate?: string; assignee: string; milestones: { id: string; title: string; completed: boolean }[]; childGoals: Goal[] }

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

      {/* Child goals */}
      {expanded && goal.childGoals?.length > 0 && goal.childGoals.map(child => (
        <GoalNode key={child.id} goal={child} depth={depth + 1} onAddChild={onAddChild} allGoals={allGoals} />
      ))}
    </div>
  );
}

export default function GoalsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => axios.get('/api/goals').then(r => r.data) });

  const createGoal = useMutation({
    mutationFn: (d: Record<string, unknown>) => axios.post('/api/goals', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowModal(false); toast('Goal created! +20 XP 🎯'); },
    onError: () => toast('Failed to create goal', 'error'),
  });

  const allGoals: Goal[] = data?.goals ?? [];
  const lifeGoals = allGoals.filter(g => g.type === 'LIFE' && !('parentGoalId' in g && g.parentGoalId));

  const openAddModal = (parentId?: string) => {
    setForm({ type: parentId ? 'LONG_TERM' : 'LIFE', assignee: 'sunil', category: 'Personal', progress: '0', parentGoalId: parentId ?? '' });
    setShowModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      <Header title="Goals" />
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{allGoals.length} goals · Life → Long-term → Short-term hierarchy</p>
        <button onClick={() => openAddModal()} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-lg font-medium"><Plus size={14} />Add Life Goal</button>
      </div>

      {isLoading ? <LoadingSpinner className="py-12" /> : lifeGoals.length === 0 ? (
        <EmptyState icon={<Target size={28} />} title="No life goals yet" description="Start with a big life goal and break it down into long-term and short-term goals." action={{ label: 'Add First Life Goal', onClick: () => openAddModal() }} />
      ) : (
        <div className="space-y-2">
          {lifeGoals.map(goal => <GoalNode key={goal.id} goal={goal} onAddChild={openAddModal} allGoals={allGoals} />)}
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
