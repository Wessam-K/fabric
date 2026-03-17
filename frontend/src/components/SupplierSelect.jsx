import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import api from '../utils/api';

export default function SupplierSelect({ value, onChange, supplierType, className = '' }) {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = suppliers.filter(s => {
    if (supplierType && s.supplier_type !== supplierType) return false;
    if (!search) return true;
    return s.name.includes(search) || s.code?.includes(search);
  });

  const selected = suppliers.find(s => String(s.id) === String(value));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none bg-white">
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? `[${selected.code}] ${selected.name}` : 'اختر المورد'}
        </span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          <div className="sticky top-0 bg-white p-2 border-b">
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1">
              <Search size={14} className="text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
                className="flex-1 text-sm outline-none bg-transparent" autoFocus />
            </div>
          </div>
          <div className="py-1">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }}
              className="w-full text-right px-3 py-2 text-sm text-gray-400 hover:bg-gray-50">بدون مورد</button>
            {filtered.map(s => (
              <button type="button" key={s.id} onClick={() => { onChange(String(s.id)); setOpen(false); setSearch(''); }}
                className={`w-full text-right px-3 py-2 text-sm hover:bg-[#c9a84c]/10 ${String(s.id) === String(value) ? 'bg-[#c9a84c]/5 font-bold' : ''}`}>
                <span className="font-mono text-[#c9a84c] text-xs">[{s.code}]</span> {s.name}
                <span className="text-[10px] text-gray-400 mr-2">{s.supplier_type === 'fabric' ? 'أقمشة' : s.supplier_type === 'accessory' ? 'اكسسوارات' : 'عام'}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-3">لا توجد نتائج</p>}
          </div>
        </div>
      )}
    </div>
  );
}
