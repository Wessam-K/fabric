import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    const duration = type === 'error' ? 5000 : 3500;
    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      return next.length > 5 ? next.slice(-5) : next;
    });
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const toast = useMemo(() => ({
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
  }), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 left-4 z-50 space-y-2 no-print" role="status" aria-live="polite" style={{ direction: 'rtl' }}>
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white animate-[slideIn_0.3s_ease] ${
            t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            {t.type === 'success' ? <CheckCircle size={16} /> : t.type === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default function Toast() { return null; }
