import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export default function FabricSearchDropdown({ value, onChange, fabricsList, role, placeholder = 'ابحث واختر القماش...' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);

  const selected = fabricsList.find(f => f.code === value);

  const filtered = fabricsList.filter(f => {
    if (search) {
      const q = search.toLowerCase();
      return f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q) || (f.supplier || '').toLowerCase().includes(q);
    }
    return true;
  });

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => { setHighlightIdx(0); }, [search]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[highlightIdx];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx, open]);

  const handleSelect = (fabric) => {
    onChange(fabric);
    setOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlightIdx]) handleSelect(filtered[highlightIdx]); }
    else if (e.key === 'Escape') { setOpen(false); setSearch(''); }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button — large, clear, full width */}
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full border-2 rounded-xl px-3 py-2.5 bg-white flex items-center gap-3 outline-none transition-all ${
          open ? 'border-[#c9a84c] ring-2 ring-[#c9a84c]/20 shadow-md' : selected ? 'border-gray-300 hover:border-[#c9a84c]' : 'border-dashed border-gray-300 hover:border-[#c9a84c]'
        }`}>
        {selected ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg shrink-0 overflow-hidden bg-gray-100 border border-gray-200">
              {selected.image_path ? (
                <img src={selected.image_path} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] bg-[#1a1a2e] text-white px-2 py-0.5 rounded-md shrink-0">{selected.code}</span>
                <span className="font-bold text-[#1a1a2e] text-sm truncate">{selected.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[#c9a84c] text-xs font-bold">{selected.price_per_m} ج/م</span>
                {selected.supplier && <span className="text-[10px] text-gray-400">• {selected.supplier}</span>}
              </div>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="p-1 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <Search size={18} className="text-gray-300 shrink-0" />
            <span className="text-gray-400 text-sm">{placeholder}</span>
          </div>
        )}
        <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full mt-2 w-full min-w-[340px] bg-white border border-gray-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input ref={searchRef} type="text" value={search} placeholder="بحث بالاسم أو الكود أو المورد..."
                onChange={e => setSearch(e.target.value)} onKeyDown={handleKeyDown}
                className="w-full pr-10 pl-3 py-2.5 text-sm outline-none bg-white border border-gray-200 rounded-lg focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 transition-all" />
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[10px] text-gray-400">{filtered.length} نتيجة</span>
              <span className="text-[10px] text-gray-400">↑↓ للتنقل • Enter للاختيار</span>
            </div>
          </div>

          {/* Fabric list */}
          <div ref={listRef} className="overflow-y-auto max-h-[320px]">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Search size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">لا توجد أقمشة مطابقة</p>
              </div>
            ) : (
              filtered.map((f, i) => (
                <button key={f.code} type="button"
                  onClick={() => handleSelect(f)}
                  onMouseEnter={() => setHighlightIdx(i)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-sm transition-colors border-b border-gray-50 last:border-b-0 ${
                    f.code === value ? 'bg-[#c9a84c]/10' :
                    i === highlightIdx ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                  }`}>
                  {/* Swatch */}
                  <div className="w-11 h-11 rounded-lg shrink-0 overflow-hidden bg-gray-100 border border-gray-200">
                    {f.image_path ? (
                      <img src={f.image_path} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-gray-700 text-white px-1.5 py-0.5 rounded shrink-0">{f.code}</span>
                      <span className="font-bold text-[#1a1a2e] truncate">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[#c9a84c] text-xs font-bold">{f.price_per_m} ج/م</span>
                      {f.color && <span className="text-[10px] text-gray-400">{f.color}</span>}
                    </div>
                  </div>
                  {/* Selected check */}
                  {f.code === value && <Check size={16} className="text-[#c9a84c] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
