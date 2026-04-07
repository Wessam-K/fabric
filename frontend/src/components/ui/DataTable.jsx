import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, ChevronRight, ChevronLeft } from 'lucide-react';

export default function DataTable({ columns, data, onRowClick, searchable, searchPlaceholder = 'بحث...', emptyMessage = 'لا توجد بيانات', pageSize = 15, searchValue, onSearchChange, selectable, selectedIds, onSelectionChange }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);
  const [localSearch, setLocalSearch] = useState('');

  const search = searchValue !== undefined ? searchValue : localSearch;
  const setSearch = onSearchChange || setLocalSearch;

  const filtered = data.filter(row => {
    if (!search) return true;
    const s = search.toLowerCase();
    return columns.some(col => {
      const val = col.accessor ? (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]) : '';
      return String(val || '').toLowerCase().includes(s);
    });
  });

  const sorted = sortCol !== null ? [...filtered].sort((a, b) => {
    const col = columns[sortCol];
    const av = col.accessor ? (typeof col.accessor === 'function' ? col.accessor(a) : a[col.accessor]) : '';
    const bv = col.accessor ? (typeof col.accessor === 'function' ? col.accessor(b) : b[col.accessor]) : '';
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ar');
    return sortDir === 'asc' ? cmp : -cmp;
  }) : filtered;

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (i) => {
    if (!columns[i].sortable) return;
    if (sortCol === i) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(i); setSortDir('asc'); }
  };

  // Selection helpers
  const selected = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const pagedIds = useMemo(() => paged.map(r => r.id).filter(Boolean), [paged]);
  const allPageSelected = selectable && pagedIds.length > 0 && pagedIds.every(id => selected.has(id));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allPageSelected) {
      onSelectionChange([...selected].filter(id => !pagedIds.includes(id)));
    } else {
      const merged = new Set([...selected, ...pagedIds]);
      onSelectionChange([...merged]);
    }
  };

  const toggleOne = (id) => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange([...next]);
  };

  return (
    <div>
      {searchable && (
        <div className="relative mb-4">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder={searchPlaceholder}
            className="form-input pr-9" />
        </div>
      )}

      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-[#c9a84c]/10 rounded-lg text-sm">
          <span className="text-[#c9a84c] font-bold">{selected.size} محدد</span>
          <button onClick={() => onSelectionChange([])} className="text-xs text-gray-500 hover:text-red-500 transition-colors">إلغاء التحديد</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: '40px' }}>
                  <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
                </th>
              )}
              {columns.map((col, i) => (
                <th key={i} onClick={() => toggleSort(i)}
                  className={col.sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''}
                  style={col.width ? { width: col.width } : {}}>
                  <span className="flex items-center gap-1">
                    {col.header}
                    {sortCol === i && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-12 text-gray-400 text-sm">{emptyMessage}</td></tr>
            ) : paged.map((row, ri) => (
              <tr key={row.id || ri} onClick={() => onRowClick?.(row)}
                className={`${onRowClick ? 'cursor-pointer' : ''} ${selectable && selected.has(row.id) ? 'bg-[#c9a84c]/5' : ''}`}>
                {selectable && (
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
                  </td>
                )}
                {columns.map((col, ci) => (
                  <td key={ci}>{col.cell ? col.cell(row) : (col.accessor ? (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]) : '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 px-1">
          <span className="text-xs text-gray-400">
            {sorted.length} نتيجة — صفحة {page + 1} من {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="btn btn-ghost btn-xs"><ChevronRight size={14} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="btn btn-ghost btn-xs"><ChevronLeft size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
