export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={40} className="mb-3 text-gray-300" />}
      <p className="text-sm font-semibold text-gray-500 mb-1">{title}</p>
      {description && <p className="text-xs text-gray-400 mb-4">{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="spinner" />
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {tabs.map(tab => (
        <button key={tab.value} onClick={() => onChange(tab.value)}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all
            ${active === tab.value ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {tab.label}
          {tab.count != null && <span className="mr-1.5 text-[10px] bg-gray-200/80 px-1.5 py-0.5 rounded-full">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
        <h3 className="text-sm font-bold text-[#1a1a2e]">{title}</h3>
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onCancel} className="btn btn-outline btn-sm">{cancelLabel}</button>
          <button onClick={onConfirm} className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ open, title, children, onClose, size = 'md' }) {
  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-black/40 backdrop-blur-[2px] overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-xl ${widths[size]} w-full mx-4 mb-8`} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1a1a2e]">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
