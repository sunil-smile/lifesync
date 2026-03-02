'use client';

import { useState, useCallback } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { Plus, FileText, Search, Trash2, Globe, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Note { id: string; title: string; content: string; tags: string[]; visibility: string; updatedAt: string }

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export default function NotesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Note | null>(null);
  const [search, setSearch] = useState('');
  const [visFilter, setVisFilter] = useState<'ALL' | 'PERSONAL' | 'SHARED'>('ALL');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editVis, setEditVis] = useState<'PERSONAL' | 'SHARED'>('PERSONAL');

  const { data, isLoading } = useQuery({
    queryKey: ['notes', visFilter],
    queryFn: () => {
      const p = new URLSearchParams({ limit: '100' });
      if (visFilter !== 'ALL') p.set('visibility', visFilter);
      return axios.get(`/api/notes?${p}`).then(r => r.data);
    },
  });

  const createNote = useMutation({
    mutationFn: () => axios.post('/api/notes', { title: 'Untitled Note', content: '' }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['notes'] }); const note = res.data.note; setSelected(note); setEditTitle(note.title); setEditContent(note.content); setEditTags(note.tags?.join(', ') ?? ''); setEditVis(note.visibility); },
    onError: () => toast('Failed to create note', 'error'),
  });

  const saveNote = useCallback(debounce(async (id: string, payload: Record<string, unknown>) => {
    try { await axios.put(`/api/notes/${id}`, payload); qc.invalidateQueries({ queryKey: ['notes'] }); } catch { /* silent */ }
  }, 1000), [qc]);

  const deleteNote = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/notes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); setSelected(null); toast('Note deleted'); },
  });

  const selectNote = (note: Note) => { setSelected(note); setEditTitle(note.title); setEditContent(note.content); setEditTags(note.tags?.join(', ') ?? ''); setEditVis(note.visibility as 'PERSONAL' | 'SHARED'); };

  const notes: Note[] = (data?.notes ?? []).filter((n: Note) => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));

  const handleTitleChange = (v: string) => { setEditTitle(v); if (selected) saveNote(selected.id, { title: v, content: editContent, tags: editTags.split(',').map(t => t.trim()).filter(Boolean), visibility: editVis }); };
  const handleContentChange = (v: string) => { setEditContent(v); if (selected) saveNote(selected.id, { title: editTitle, content: v, tags: editTags.split(',').map(t => t.trim()).filter(Boolean), visibility: editVis }); };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Notes</h2>
            <button onClick={() => createNote.mutate()} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"><Plus size={13} />New</button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-1">
            {(['ALL','PERSONAL','SHARED'] as const).map(v => <button key={v} onClick={() => setVisFilter(v)} className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${visFilter === v ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{v}</button>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? <LoadingSpinner className="py-8" /> : notes.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No notes found</p>
          ) : notes.map(note => (
            <button key={note.id} onClick={() => selectNote(note)} className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 ${selected?.id === note.id ? 'bg-slate-800 border-l-2 border-l-blue-500' : ''}`}>
              <p className="text-sm font-medium text-slate-200 truncate">{note.title || 'Untitled'}</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{note.content?.slice(0, 60) || 'Empty note'}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {note.tags?.slice(0, 2).map((t: string) => <span key={t} className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">{t}</span>)}
                <span className="text-[10px] text-slate-600 ml-auto">{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={<FileText size={28} />} title="Select a note" description="Choose a note from the left or create a new one" action={{ label: 'Create Note', onClick: () => createNote.mutate() }} />
          </div>
        ) : (
          <>
            <div className="px-8 pt-6 pb-4 border-b border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <input value={editTitle} onChange={e => handleTitleChange(e.target.value)} className="flex-1 text-2xl font-bold text-slate-100 bg-transparent border-none outline-none placeholder-slate-600" placeholder="Note title" />
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => { const newVis = editVis === 'PERSONAL' ? 'SHARED' : 'PERSONAL'; setEditVis(newVis); if (selected) saveNote(selected.id, { title: editTitle, content: editContent, tags: editTags.split(',').map(t => t.trim()).filter(Boolean), visibility: newVis }); }} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${editVis === 'SHARED' ? 'border-violet-500/40 bg-violet-500/10 text-violet-400' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                    {editVis === 'SHARED' ? <Globe size={13} /> : <Lock size={13} />}{editVis}
                  </button>
                  <button onClick={() => { if (confirm('Delete this note?')) deleteNote.mutate(selected.id); }} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
              <input value={editTags} onChange={e => { setEditTags(e.target.value); if (selected) saveNote(selected.id, { title: editTitle, content: editContent, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean), visibility: editVis }); }} className="w-full text-xs text-slate-500 bg-transparent border-none outline-none placeholder-slate-700" placeholder="Add tags, comma separated (e.g. work, ideas, health)" />
            </div>
            <textarea value={editContent} onChange={e => handleContentChange(e.target.value)} className="flex-1 px-8 py-6 bg-transparent text-slate-300 text-base leading-relaxed outline-none resize-none placeholder-slate-700" placeholder="Start writing..." />
          </>
        )}
      </div>
    </div>
  );
}
