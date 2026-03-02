import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'violet' | 'emerald' | 'amber' | 'red' | 'slate';
  size?: 'sm' | 'md';
}

const variantMap = {
  blue:    'bg-blue-500/20 text-blue-400',
  violet:  'bg-violet-500/20 text-violet-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
  amber:   'bg-amber-500/20 text-amber-400',
  red:     'bg-red-500/20 text-red-400',
  slate:   'bg-slate-700 text-slate-300',
};

const sizeMap = { sm: 'px-2 py-0.5 text-[11px]', md: 'px-2.5 py-1 text-xs' };

export function Badge({ children, variant = 'slate', size = 'md' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variantMap[variant]} ${sizeMap[size]}`}>
      {children}
    </span>
  );
}
