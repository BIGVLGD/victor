import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast } from '../types';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastContextType {
  toast: (type: Toast['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const icons = {
    success: <CheckCircle size={16} className="text-success" />,
    error: <XCircle size={16} className="text-danger" />,
    info: <Info size={16} className="text-info" />,
    warning: <AlertTriangle size={16} className="text-warning" />,
  };

  const colors = {
    success: 'border-success/30',
    error: 'border-danger/30',
    info: 'border-info/30',
    warning: 'border-warning/30',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-3 bg-card border ${colors[t.type]} rounded-xl p-3 shadow-xl animate-slide-in`}>
            <span className="mt-0.5 shrink-0">{icons[t.type]}</span>
            <p className="text-sm text-txt-primary flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-txt-muted hover:text-txt-primary transition-colors shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
