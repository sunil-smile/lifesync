'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Activity, DollarSign, CheckSquare, Target } from 'lucide-react';

const mobileNavItems = [
  { label: 'Home',     href: '/dashboard',   icon: <LayoutDashboard size={22} /> },
  { label: 'Activity', href: '/activity',    icon: <Activity size={22} /> },
  { label: 'Finance',  href: '/finance',     icon: <DollarSign size={22} /> },
  { label: 'Tasks',    href: '/tasks',       icon: <CheckSquare size={22} /> },
  { label: 'Goals',    href: '/goals',       icon: <Target size={22} /> },
];

export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/dashboard' ? (pathname === '/dashboard' || pathname === '/') : pathname.startsWith(href);

  return (
    <nav className="lg:hidden flex items-center justify-around fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-40 h-16">
      {mobileNavItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link key={item.href} href={item.href}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-3 flex-1 transition-colors ${active ? 'text-blue-400' : 'text-slate-500'}`}>
            {item.icon}
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
