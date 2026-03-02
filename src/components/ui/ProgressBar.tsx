import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'blue' | 'violet' | 'emerald' | 'amber' | 'red';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const colorMap = {
  blue:    { fill: 'bg-blue-500',    track: 'bg-blue-500/20' },
  violet:  { fill: 'bg-violet-500',  track: 'bg-violet-500/20' },
  emerald: { fill: 'bg-emerald-500', track: 'bg-emerald-500/20' },
  amber:   { fill: 'bg-amber-500',   track: 'bg-amber-500/20' },
  red:     { fill: 'bg-red-500',     track: 'bg-red-500/20' },
};

const sizeMap = { sm: 'h-1', md: 'h-2', lg: 'h-3' };

export function ProgressBar({ value, max = 100, color = 'blue', size = 'md', showLabel = false, label, className = '' }: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const { fill, track } = colorMap[color];

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-slate-400">{label}</span>}
          {showLabel && <span className="text-xs font-semibold text-slate-300 ml-auto">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={`w-full rounded-full overflow-hidden ${sizeMap[size]} ${track} ${className}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${fill}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
