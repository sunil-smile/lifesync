'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Activity, DollarSign, TrendingUp,
  CheckSquare, Target, FileText, Zap, Settings,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard',   href: '/dashboard',   icon: <LayoutDashboard size={18} /> },
  { label: 'Activity',    href: '/activity',    icon: <Activity size={18} /> },
  { label: 'Finance',     href: '/finance',     icon: <DollarSign size={18} /> },
  { label: 'Investments', href: '/investments', icon: <TrendingUp size={18} /> },
  { label: 'Tasks',       href: '/tasks',       icon: <CheckSquare size={18} /> },
  { label: 'Goals',       href: '/goals',       icon: <Target size={18} /> },
  { label: 'Notes',       href: '/notes',       icon: <FileText size={18} /> },
  { label: 'Motivation',  href: '/motivation',  icon: <Zap size={18} /> },
  { label: 'Settings',    href: '/settings',    icon: <Settings size={18} /> },
];

interface SidebarProps {
  userName?: string;
  userLevel?: number;
  userInitials?: string;
  levelName?: string;
}

export function Sidebar({ userName = 'Sunil', userLevel = 1, userInitials = 'S', levelName = 'Beginner' }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden lg:flex flex-col h-screen bg-slate-900 border-r border-slate-700 overflow-hidden" style={{ width: '240px', minWidth: '240px' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-700">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500">
          <Zap size={16} className="text-white" fill="white" />
        </div>
        <span className="text-lg font-bold text-slate-100 tracking-tight">LifeSync</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
                active
                  ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-400 pl-[10px]'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 border-l-2 border-transparent'
              }`}
            >
              <span className={`flex-shrink-0 transition-colors duration-150 ${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors duration-150 cursor-pointer">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500 text-white text-sm font-semibold flex-shrink-0">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{userName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400">
                Lvl {userLevel}
              </span>
              <span className="text-xs text-slate-500 truncate">{levelName}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
