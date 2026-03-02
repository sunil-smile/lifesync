'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Upload, ChevronDown, LogOut, User, ChevronRight } from 'lucide-react';
import Link from 'next/link';

type ViewMode = 'my' | 'family';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession();
  const [viewMode, setViewMode] = useState<ViewMode>('my');
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (viewRef.current && !viewRef.current.contains(e.target as Node)) setViewDropdownOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = session?.user?.name ?? 'User';
  const userEmail = session?.user?.email ?? '';
  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="flex items-center justify-between bg-slate-800 border-b border-slate-700 px-6 py-4 flex-shrink-0">
      <div className="flex flex-col">
        {subtitle && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5">
            <span>LifeSync</span><ChevronRight size={12} /><span className="text-slate-400">{subtitle}</span>
          </div>
        )}
        <h1 className="text-xl font-semibold text-slate-100 leading-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* View Selector */}
        <div className="relative" ref={viewRef}>
          <button
            onClick={() => setViewDropdownOpen((p) => !p)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-300 hover:text-slate-100 transition-colors duration-150 border border-slate-600"
          >
            <span>{viewMode === 'my' ? 'My View' : 'Family View'}</span>
            <ChevronDown size={14} className={`transition-transform ${viewDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {viewDropdownOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
              {(['my', 'family'] as ViewMode[]).map((mode) => (
                <button key={mode} onClick={() => { setViewMode(mode); setViewDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${viewMode === mode ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300 hover:bg-slate-700'}`}>
                  {mode === 'my' ? 'My View' : 'Family View'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bank Upload */}
        <Link href="/finance#upload" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors border border-amber-500/20">
          <Upload size={15} /><span className="hidden sm:inline">Upload Bank</span>
        </Link>

        {/* User Avatar */}
        <div className="relative" ref={userRef}>
          <button onClick={() => setUserDropdownOpen((p) => !p)}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 transition-colors">
            {initials}
          </button>
          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 py-2">
              <div className="px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500 text-white text-sm font-semibold flex-shrink-0">{initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{userName}</p>
                    <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                  </div>
                </div>
              </div>
              <div className="py-1">
                <button onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                  <User size={15} className="text-slate-500" />Profile
                </button>
                <button onClick={() => { setUserDropdownOpen(false); signOut({ callbackUrl: '/login' }); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                  <LogOut size={15} />Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
