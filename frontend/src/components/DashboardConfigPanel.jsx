import { useState, useCallback } from 'react';
import { Settings, RotateCcw, X, GripVertical } from 'lucide-react';
import { useDashboardConfig, WIDGET_META } from '../context/DashboardConfigContext';

export default function DashboardConfigPanel({ open, onClose }) {
  const { widgets, toggleWidget, resetToDefault, refreshInterval, setRefreshInterval, widgetOrder, moveWidget } = useDashboardConfig();
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const handleDragStart = useCallback((e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e, toIdx) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== toIdx) moveWidget(dragIdx, toIdx);
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, moveWidget]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-white dark:bg-[#1e1e2e] rounded-xl shadow-xl max-w-md w-full mx-4 mb-8 border border-gray-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings size={15} />
            تخصيص لوحة التحكم
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Widget toggles + drag reorder */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">العناصر المرئية</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">اسحب لتغيير الترتيب • تبديل للإظهار/الإخفاء</p>
            <div className="space-y-1">
              {widgetOrder.map((key, idx) => {
                const meta = WIDGET_META[key];
                if (!meta) return null;
                return (
                  <div key={key} draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                    className={`flex items-center justify-between gap-3 py-2 px-2 rounded-lg
                      hover:bg-gray-50 dark:hover:bg-white/5 cursor-grab active:cursor-grabbing transition-all
                      ${overIdx === idx ? 'ring-2 ring-[#c9a84c]/40' : ''}
                      ${dragIdx === idx ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
                      <span className="text-[10px] text-gray-300 dark:text-gray-600 font-mono w-4 shrink-0">{idx + 1}</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{meta.label}</span>
                    </div>
                    <div className="relative shrink-0">
                      <input type="checkbox" checked={widgets[key]} onChange={() => toggleWidget(key)}
                        className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer-checked:bg-[#c9a84c] transition-colors cursor-pointer"
                        onClick={() => toggleWidget(key)} />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4 pointer-events-none" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refresh interval */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">تحديث تلقائي</p>
            <div className="flex items-center gap-2">
              {[30, 60, 120, 300].map(sec => (
                <button key={sec} onClick={() => setRefreshInterval(sec)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors
                    ${refreshInterval === sec
                      ? 'bg-[#c9a84c] text-white'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15'}`}>
                  {sec < 60 ? `${sec}ث` : `${sec / 60}د`}
                </button>
              ))}
              <button onClick={() => setRefreshInterval(0)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors
                  ${refreshInterval === 0
                    ? 'bg-[#c9a84c] text-white'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15'}`}>
                إيقاف
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
          <button onClick={resetToDefault}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors">
            <RotateCcw size={12} /> إعادة الافتراضي
          </button>
          <button onClick={onClose}
            className="btn btn-sm bg-[#c9a84c] text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#b8973f]">
            تم
          </button>
        </div>
      </div>
    </div>
  );
}
