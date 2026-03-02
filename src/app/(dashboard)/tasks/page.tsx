'use client';

import { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { Plus, Trash2, ChevronRight, CheckSquare, Calendar, Pencil, Send, RotateCcw, Clock } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'HOLD' | 'DONE';
type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

interface Task {
  id: string; title: string; notes?: string; dueDate?: string;
  priority: Priority; assignee: string; status: TaskStatus;
  goal?: { id: string; title: string };
}
interface TaskUpdate { id: string; text: string; createdAt: string }

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; headerColor: string; next: TaskStatus | null; nextLabel: string | null }> = {
  TODO:        { label: 'To Do',       color: 'border-blue-500/40 bg-blue-500/5',    headerColor: 'text-blue-400',    next: 'IN_PROGRESS', nextLabel: 'Start' },
  IN_PROGRESS: { label: 'In Progress', color: 'border-amber-500/40 bg-amber-500/5',  headerColor: 'text-amber-400',   next: 'DONE',        nextLabel: 'Complete' },
  HOLD:        { label: 'On Hold',     color: 'border-slate-500/40 bg-slate-500/5',  headerColor: 'text-slate-400',   next: 'IN_PROGRESS', nextLabel: 'Resume' },
  DONE:        { label: 'Done',        color: 'border-emerald-500/40 bg-emerald-500/5', headerColor: 'text-emerald-400', next: null, nextLabel: null },
};
const PRIORITY_VARIANT: Record<Priority, 'red' | 'amber' | 'slate'> = { HIGH: 'red', MEDIUM: 'amber', LOW: 'slate' };
const ALL_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'HOLD', 'DONE'];

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, string>>({});
  // Edit / detail modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [updateText, setUpdateText] = useState('');

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
  const { data: updatesData, isLoading: updatesLoading } = useQuery({
    queryKey: ['task-updates', selectedTask?.id],
    queryFn: () => axios.get(`/api/tasks/${selectedTask!.id}/updates`).then(r => r.data),
    enabled: !!selectedTask,
  });

  const createTask = useMutation({
    mutationFn: (d: Record<string, string>) => axios.post('/api/tasks', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setShowCreateModal(false); toast('Task created! +5 XP'); },
    onError: () => toast('Failed to create task', 'error'),
  });
  const updateTask = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Record<string, string>) => axios.put(`/api/tasks/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast('Task updated!'); },
  });
  const saveEdit = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Record<string, string>) => axios.put(`/api/tasks/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null); toast('Task saved!'); },
    onError: () => toast('Failed to save task', 'error'),
  });
  const deleteTask = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/tasks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null); toast('Task deleted'); },
  });
  const postUpdate = useMutation({
    mutationFn: ({ taskId, text }: { taskId: string; text: string }) => axios.post(`/api/tasks/${taskId}/updates`, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-updates', selectedTask?.id] });
      setUpdateText('');
      toast('Update logged!');
    },
    onError: () => toast('Failed to post update', 'error'),
  });
  const deleteUpdate = useMutation({
    mutationFn: ({ taskId, updateId }: { taskId: string; updateId: string }) =>
      axios.delete(`/api/tasks/${taskId}/updates?updateId=${updateId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-updates', selectedTask?.id] }); },
  });

  const tasks: Task[] = data?.tasks ?? [];
  const byStatus = (s: TaskStatus) => tasks.filter(t => t.status === s);
  const goals = goalsData?.goals ?? [];
  const taskUpdates: TaskUpdate[] = updatesData?.updates ?? [];

  const openEdit = (task: Task) => {
    setSelectedTask(task);
    setEditForm({
      title: task.title,
      notes: task.notes ?? '',
      priority: task.priority,
      status: task.status,
      assignee: task.assignee,
      dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
      goalId: task.goal?.id ?? '',
    });
    setUpdateText('');
  };

  return (
    <div className="p-6 space-y-6">
      <Header title="Tasks" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['ALL', ...ALL_STATUSES] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-700'}`}>
              {s === 'ALL' ? 'All' : s === 'IN_PROGRESS' ? 'In Progress' : s === 'HOLD' ? 'On Hold' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <button onClick={() => { setCreateForm({}); setShowCreateModal(true); }} className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-lg font-medium transition-colors">
          <Plus size={14} />Add Task
        </button>
      </div>

      {/* Kanban Board */}
      {isLoading ? <LoadingSpinner className="py-12" /> : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {ALL_STATUSES.map(status => {
            const { label, color, headerColor, next, nextLabel } = STATUS_CONFIG[status];
            const col = byStatus(status);
            return (
              <div key={status} className={`rounded-xl border p-4 space-y-3 ${color}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold text-sm ${headerColor}`}>{label}</h3>
                  <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full">{col.length}</span>
                </div>
                {col.length === 0
                  ? <p className="text-xs text-slate-500 text-center py-4">No tasks here</p>
                  : col.map(task => (
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
                          <button onClick={() => openEdit(task)} title="Edit / View updates" className="text-slate-400 hover:text-blue-400 p-0.5"><Pencil size={13} /></button>
                          {next && (
                            <button onClick={() => updateTask.mutate({ id: task.id, status: next })} title={nextLabel ?? ''} className="text-slate-400 hover:text-emerald-400 p-0.5">
                              {status === 'HOLD' ? <RotateCcw size={13} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                          <button onClick={() => deleteTask.mutate(task.id)} className="text-slate-500 hover:text-red-400 p-0.5"><Trash2 size={13} /></button>
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
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Task">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Task Title *</label><input value={createForm.title ?? ''} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" placeholder="What needs to be done?" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label><textarea value={createForm.notes ?? ''} onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 h-20 resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Due Date</label><input type="date" value={createForm.dueDate ?? ''} onChange={e => setCreateForm(p => ({ ...p, dueDate: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Priority</label>
              <select value={createForm.priority ?? 'MEDIUM'} onChange={e => setCreateForm(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                {['HIGH','MEDIUM','LOW'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Assignee</label>
            <select value={createForm.assignee ?? 'sunil'} onChange={e => setCreateForm(p => ({ ...p, assignee: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
              <option value="sunil">Sunil</option><option value="vidhya">Vidhya</option>
            </select>
          </div>
          {goals.length > 0 && <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Link to Goal (optional)</label>
            <select value={createForm.goalId ?? ''} onChange={e => setCreateForm(p => ({ ...p, goalId: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
              <option value="">No goal</option>{goals.map((g: { id: string; title: string }) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select></div>}
          <button onClick={() => createTask.mutate({ priority: 'MEDIUM', assignee: 'sunil', ...createForm })} disabled={!createForm.title?.trim()} className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">{createTask.isPending ? 'Creating...' : 'Create Task'}</button>
        </div>
      </Modal>

      {/* Edit Task + Update Log Modal */}
      <Modal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} title="Task Details">
        {selectedTask && (
          <div className="space-y-5">
            {/* Edit Fields */}
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                <input value={editForm.title ?? ''} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
                <textarea value={editForm.notes ?? ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500 h-20 resize-none" placeholder="Add notes..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                  <select value={editForm.status ?? 'TODO'} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500">
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="HOLD">On Hold</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                  <select value={editForm.priority ?? 'MEDIUM'} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500">
                    {['HIGH','MEDIUM','LOW'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-400 mb-1">Assignee</label>
                  <select value={editForm.assignee ?? 'sunil'} onChange={e => setEditForm(p => ({ ...p, assignee: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500">
                    <option value="sunil">Sunil</option><option value="vidhya">Vidhya</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-400 mb-1">Due Date</label>
                  <input type="date" value={editForm.dueDate ?? ''} onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveEdit.mutate({ id: selectedTask.id, ...editForm })} disabled={saveEdit.isPending} className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
                  {saveEdit.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => deleteTask.mutate(selectedTask.id)} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckSquare size={12} />Update Log
              </p>

              {/* Post new update */}
              <div className="space-y-2 mb-4">
                <textarea
                  value={updateText}
                  onChange={e => setUpdateText(e.target.value)}
                  placeholder="Log a progress update, blocker, or note..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500 h-20 resize-none placeholder-slate-500"
                />
                <button
                  onClick={() => postUpdate.mutate({ taskId: selectedTask.id, text: updateText })}
                  disabled={!updateText.trim() || postUpdate.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  <Send size={13} />{postUpdate.isPending ? 'Posting...' : 'Post Update'}
                </button>
              </div>

              {/* Past updates */}
              {updatesLoading
                ? <LoadingSpinner className="py-4" />
                : taskUpdates.length === 0
                  ? <p className="text-xs text-slate-500 text-center py-2">No updates yet — be the first to log one!</p>
                  : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {taskUpdates.map(u => (
                        <div key={u.id} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50 group">
                          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{u.text}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={10} />{format(new Date(u.createdAt), 'MMM d, h:mm a')}</span>
                            <button onClick={() => deleteUpdate.mutate({ taskId: selectedTask.id, updateId: u.id })} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
              }
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
