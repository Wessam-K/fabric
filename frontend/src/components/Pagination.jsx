import { ChevronRight, ChevronLeft } from 'lucide-react';

export default function Pagination({ total, page, pageSize, onPageChange, pageSizeOptions = [25, 50, 100] }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1 && total <= pageSizeOptions[0]) return null;

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>عرض</span>
        <select value={pageSize} onChange={e => onPageChange(1, parseInt(e.target.value))}
          className="px-2 py-1 border border-gray-200 rounded-lg bg-white text-xs focus:outline-none">
          {pageSizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>من {total} سجل</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1, pageSize)} disabled={page <= 1}
          className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={14} />
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let p;
          if (totalPages <= 7) p = i + 1;
          else if (page <= 4) p = i + 1;
          else if (page >= totalPages - 3) p = totalPages - 6 + i;
          else p = page - 3 + i;
          return (
            <button key={p} onClick={() => onPageChange(p, pageSize)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                p === page ? 'bg-[#1a1a2e] text-white' : 'hover:bg-gray-200 text-gray-600'
              }`}>{p}</button>
          );
        })}
        <button onClick={() => onPageChange(page + 1, pageSize)} disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}
