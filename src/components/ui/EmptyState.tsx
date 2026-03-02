import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-700/50 text-slate-400 mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-xs leading-relaxed mb-6">{description}</p>
      {action && (
        <button onClick={action.onClick} className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}
