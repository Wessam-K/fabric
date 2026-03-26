import { useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'تأكيد', cancelText = 'إلغاء', variant = 'danger' }) {
  if (!isOpen) return null;

  const colors = variant === 'danger'
    ? { btn: 'bg-red-600 hover:bg-red-700', icon: 'text-red-600', bg: 'bg-red-100' }
    : { btn: 'bg-yellow-600 hover:bg-yellow-700', icon: 'text-yellow-600', bg: 'bg-yellow-100' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a2e] rounded-xl shadow-2xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${colors.bg}`}>
            <AlertTriangle className={`w-6 h-6 ${colors.icon}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title || 'تأكيد العملية'}</h3>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-sm">{message}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium">
            {cancelText}
          </button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${colors.btn}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' });

  const confirm = useCallback(({ title, message, variant = 'danger' }) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title,
        message,
        variant,
        onConfirm: () => { resolve(true); setState(s => ({ ...s, isOpen: false, onReject: null })); },
        onReject: () => resolve(false),
      });
    });
  }, []);

  const close = useCallback(() => {
    setState(s => {
      if (s.onReject) s.onReject();
      return { ...s, isOpen: false, onReject: null };
    });
  }, []);

  const ConfirmDialogEl = (
    <ConfirmDialog
      isOpen={state.isOpen}
      onClose={close}
      onConfirm={state.onConfirm}
      title={state.title}
      message={state.message}
      variant={state.variant}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogEl };
}
