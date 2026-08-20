'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; type: ToastType; message: string; }
interface ToastCtx {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} item={t} onDone={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(item.id), 3500);
    return () => clearTimeout(timer);
  }, [item.id, onDone]);

  const colors = {
    success: { bg: 'from-[#22c55e]/20 to-[#06b6d4]/20', border: '#22c55e', icon: CheckCircle },
    error: { bg: 'from-[#ef4444]/20 to-[#f97316]/20', border: '#ef4444', icon: AlertCircle },
    info: { bg: 'from-[#3b82f6]/20 to-[#06b6d4]/20', border: '#3b82f6', icon: Info },
  };
  const c = colors[item.type];
  const Icon = c.icon;

  return (
    <div className={`pointer-events-auto bg-gradient-to-r ${c.bg} border rounded-lg p-3 shadow-xl flex items-center gap-3 min-w-[280px] max-w-sm animate-slide-in-left`}
      style={{ borderColor: `${c.border}60` }}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: c.border }} />
      <span className="text-xs text-[#e4e4e7] flex-1">{item.message}</span>
      <button onClick={() => onDone(item.id)} className="text-[#71717a] hover:text-[#a1a1aa] transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
