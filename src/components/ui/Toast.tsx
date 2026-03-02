'use client';

import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem { id: string; message: string; type: ToastType }
interface ToastContextValue { toast: (message: string, type?: ToastType) => void; toasts: ToastItem[] }

const ToastContext = createContext<ToastContextValue | null>(null);

const typeConfig = {
  success: { icon: <CheckCircle size={16} />, classes: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', iconClass: 'text-emerald-400' },
  error:   { icon: <XCircle size={16} />,     classes: 'bg-red-500/15 border-red-500/30 text-red-300',             iconClass: 'text-red-400' },
  warning: { icon: <AlertTriangle size={16} />,classes: 'bg-amber-500/15 border-amber-500/30 text-amber-300',      iconClass: 'text-amber-400' },
  info:    { icon: <Info size={16} />,         classes: 'bg-blue-500/15 border-blue-500/30 text-blue-300',         iconClass: 'text-blue-400' },
};

function ToastItemComponent({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const config = typeConfig[item.type];
  useEffect(() => {
    const t = setTimeout(() => onRemove(item.id), 4000);
    return () => clearTimeout(t);
  }, [item.id, onRemove]);

  return (
    <div className={`flex items-start gap-3 w-80 px-4 py-3 rounded-xl border shadow-lg ${config.classes}`} role="alert">
      <span className={`flex-shrink-0 mt-0.5 ${config.iconClass}`}>{config.icon}</span>
      <p className="flex-1 text-sm font-medium leading-snug">{item.message}</p>
      <button onClick={() => onRemove(item.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);
  const removeToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{ toast, toasts }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2" aria-live="polite">
          {toasts.map((item) => <ToastItemComponent key={item.id} item={item} onRemove={removeToast} />)}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
