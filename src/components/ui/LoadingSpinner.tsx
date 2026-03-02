import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-2' };

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeMap[size]} rounded-full border-slate-700 border-t-blue-500 animate-spin`} role="status" aria-label="Loading" />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-900 z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" role="status" />
        <p className="text-sm text-slate-400 font-medium">Loading...</p>
      </div>
    </div>
  );
}
