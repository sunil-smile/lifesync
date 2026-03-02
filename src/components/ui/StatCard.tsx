import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'blue' | 'violet' | 'emerald' | 'amber' | 'red';
}

const colorMap = {
  blue:    'bg-blue-500/20 text-blue-400',
  violet:  'bg-violet-500/20 text-violet-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
  amber:   'bg-amber-500/20 text-amber-400',
  red:     'bg-red-500/20 text-red-400',
};

export function StatCard({ title, value, subtitle, icon, trend, color = 'blue' }: StatCardProps) {
  const isPositive = trend ? trend.value >= 0 : null;
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${colorMap[color]}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{isPositive ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-slate-100 leading-none">{value}</p>
        <p className="text-sm font-medium text-slate-400">{title}</p>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        {trend && <p className="text-xs text-slate-500">{trend.label}</p>}
      </div>
    </div>
  );
}
