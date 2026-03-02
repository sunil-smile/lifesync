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
import { Plus, Trash2, ChevronRight, CheckSquare, Calendar } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

interface Task { id: string; title: string; notes?: string; dueDate?: string; priority: Priority; assignee: string; status: TaskStatus; goal?: { id: string; title: string } }

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; next: TaskStatus | null }> = {
  TODO: { label: 'To Do', color: 'border-blue-500/40 bg-blue-500/5', next: 'IN_PROGRESS' },
  IN_PROGRESS: { label: 'In Progress', color: 'border-amber-500/40 bg-amber-500/5', next: 'DONE' },
  DONE: { label: 'Done', color: 'border-emerald-500/40 bg-emerald-500/5', next: null },
};
const PRIORITY_VARIANT: Record<Priority, 'red' | 'amber' | 'slate'> = { HIGH: 'red', MEDIUM: 'amber', LOW: 'slate' };

function DueDateChip({ date }: { date?: string }) {
  if (!date) return null;
  const d = new Date(date);
  const cls = isPast(d) && !isToday(d) ? 'text-red-400' : isToday(d) ? 'text-amber-400' : 'text-slate-500';
  return <span className={`text-xs flex items-center gap-1 ${cls}`}><Calendar size={10} />{format(d, 'MMM d')}</span>;
}

export default function TasksPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<'ALL' | 'sunil' | 'vidhya'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', filterStatus, filterPriority, filterAssignee],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (filterPriority !== 'ALL') params.set('priority', filterPriority);
      if (filterAssignee !== 'ALL') params.set('assignee', filterAssignee);
      return axios.get(`/api/tasks?${params}`).then(r => r.data);
    },
  });
  const { data: goalsData } = useQuery({ queryKey: ['goals-minimal'], queryFn: () => axios.get('/api/goals').then(r => r.data) });

  const createTask = useMutation({
    mutationFn: (d: Record<string, string>) => axios.post('/api/tasks', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setShowModal(false); toast('Task created! +5 XP'); },
    onError: () => toast('Failed to create task', 'error'),
  });
  const updateTask = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Record<string, string>) => axios.put(`/api/tasks/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast('Task updated!'); },
  });
  const deleteTask = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/tasks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast('Task deleted'); },
  });

  const tasks: Task[] = data?.tasks ?? [];
  const byStatus = (s: TaskStatus) => tasks.filter(t => t.status === s);
  const goals = goalsData?.goals ?? [];

  return (
    <div className="p-6 space-y-6">
      <Header title="Tasks" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['ALL','TODO','IN_PROGRESS','DONE'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-700'}`}>
              {s === 'ALL' ? 'All' : s === 'IN_PROGRESS' ? 'In Progress' : s}
            </button>
          ))}
        </div>
        <button onClick={() => { setForm({}); setShowModal(true); }} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-lg font-medium transition-colors">
          <Plus size={14} />Add Task
        </button>
      </div>

      {/* Kanban */}
      {isLoading ? <LoadingSpinner className="py-12" /> : (
        <div className="grid lg:grid-cols-3 gap-4">
          {(['TODO','IN_PROGRESS','DONE'] as TaskStatus[]).map(status => {
            const { label, color, next } = STATUS_CONFIG[status];
            const col = byStatus(status);
            return (
              <div key={status} className={`rounded-xl border p-4 space-y-3 ${color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-200 text-sm">{label}</h3>
                  <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full">{col.length}</span>
                </div>
                {col.length === 0 ? <p className="text-xs text-slate-500 text-center py-4">No tasks here</p> : col.map(task => (
                  <div key={task.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-slate-600 transition-colors group space-y-2">
                    <div className="flex items-start gap-2">
                      <Badge variant={PRIORITY_VARIANT[task.priority]} size="sm">{task.priority}</Badge>
                      <p className="text-sm text-slate-200 font-medium flex-1 leading-snug">{task.title}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${task.assignee === 'vidhya' ? 'bg-violet-500' : 'bg-blue-500'}`}>
                          {task.assignee === 'vidhya' ? 'V' : 'S'}
                        </div>
                        <DueDateChip date={task.dueDate} />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {next && <button onClick={() => updateTask.mutate({ id: task.id, status: next })} title={`Move to ${next}`} className="text-slate-400 hover:text-blue-400"><ChevronRight size={15} /></button>}
                        <button onClick={() => deleteTask.mutate(task.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {task.goal && <p className="text-xs text-slate-500 truncate">🎯 {task.goal.title}</p>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Task">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Task Title *</label><input value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="What needs to be done?" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label><textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 h-20 resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Due Date</label><input type="date" value={form.dueDate ?? ''} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Priority</label>
              <select value={form.priority ?? 'MEDIUM'} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                {['HIGH','MEDIUM','LOW'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Assignee</label>
            <select value={form.assignee ?? 'sunil'} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
              <option value="sunil">Sunil</option><option value="vidhya">Vidhya</option>
            </select>
          </div>
          {goals.length > 0 && <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Link to Goal (optional)</label>
            <select value={form.goalId ?? ''} onChange={e => setForm(p => ({ ...p, goalId: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
              <option value="">No goal</option>{goals.map((g: { id: string; title: string }) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select></div>}
          <button onClick={() => createTask.mutate({ priority: 'MEDIUM', assignee: 'sunil', ...form })} disabled={!form.title?.trim()} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">{createTask.isPending ? 'Creating...' : 'Create Task'}</button>
        </div>
      </Modal>
    </div>
  );
}
