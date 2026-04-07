import { useState } from 'react';
import { Filter, ChevronDown, ChevronUp, X } from 'lucide-react';

/**
 * Reusable collapsible table filters component.
 *
 * @param {Object} props
 * @param {Array} props.filters - Array of filter config objects:
 *   { key, label, type: 'select'|'date'|'number'|'text', options?: [{value,label}], placeholder? }
 * @param {Object} props.values - Current filter values keyed by filter key
 * @param {Function} props.onChange - Called with (key, value) when a filter changes
 * @param {Function} props.onClear - Called to clear all filters
 */
export default function TableFilters({ filters, values, onChange, onClear }) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(values).filter(v => v !== '' && v != null).length;

  return (
    <div className="bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <Filter size={14} />
          <span className="font-medium">فلاتر</span>
          {activeCount > 0 && (
            <span className="bg-[#c9a84c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span>
          )}
        </span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      <div
        className="transition-all duration-200 ease-in-out overflow-hidden"
        style={{ maxHeight: open ? '300px' : '0', opacity: open ? 1 : 0 }}
      >
        <div className="px-4 pb-3 pt-1 flex flex-wrap items-end gap-3 border-t border-gray-100 dark:border-white/5">
          {filters.map(f => (
            <div key={f.key} className="min-w-[140px]">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
              {f.type === 'select' ? (
                <select
                  value={values[f.key] || ''}
                  onChange={e => onChange(f.key, e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 dark:bg-[#0f0f1a] dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:border-[#c9a84c] outline-none transition-colors"
                >
                  <option value="">{f.placeholder || 'الكل'}</option>
                  {(f.options || []).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === 'date' ? (
                <input
                  type="date"
                  value={values[f.key] || ''}
                  onChange={e => onChange(f.key, e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 dark:bg-[#0f0f1a] dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:border-[#c9a84c] outline-none transition-colors"
                />
              ) : f.type === 'number' ? (
                <input
                  type="number"
                  value={values[f.key] || ''}
                  onChange={e => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder || ''}
                  className="w-full border border-gray-200 dark:border-white/10 dark:bg-[#0f0f1a] dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:border-[#c9a84c] outline-none transition-colors"
                />
              ) : (
                <input
                  type="text"
                  value={values[f.key] || ''}
                  onChange={e => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder || ''}
                  className="w-full border border-gray-200 dark:border-white/10 dark:bg-[#0f0f1a] dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:border-[#c9a84c] outline-none transition-colors"
                />
              )}
            </div>
          ))}
          {activeCount > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors pb-0.5"
            >
              <X size={12} /> مسح الفلاتر
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
