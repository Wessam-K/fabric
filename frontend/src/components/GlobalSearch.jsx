import { useState, useEffect, useRef } from 'react';
import { Search, X, Layers, Scissors, Package, FileText, ArrowLeft, Factory, ShoppingCart, Users, Truck, Settings, DollarSign, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const CATEGORY_META = {
  models:            { label: 'الموديلات',     icon: Layers,       color: 'text-blue-500 bg-blue-50',    path: (r) => `/models/${r.model_code}/edit` },
  fabrics:           { label: 'الأقمشة',       icon: Scissors,     color: 'text-green-500 bg-green-50',  path: () => '/fabrics' },
  accessories:       { label: 'الاكسسوارات',  icon: Package,      color: 'text-purple-500 bg-purple-50', path: () => '/accessories' },
  invoices:          { label: 'الفواتير',      icon: FileText,     color: 'text-amber-600 bg-amber-50',  path: (r) => `/invoices/${r.id}/view` },
  workOrders:        { label: 'أوامر الإنتاج', icon: Factory,      color: 'text-orange-500 bg-orange-50', path: (r) => `/work-orders/${r.id}` },
  purchaseOrders:    { label: 'أوامر الشراء',  icon: ShoppingCart,  color: 'text-teal-500 bg-teal-50',   path: () => `/purchase-orders` },
  customers:         { label: 'العملاء',       icon: Users,        color: 'text-indigo-500 bg-indigo-50', path: (r) => `/customers/${r.id}` },
  suppliers:         { label: 'الموردين',      icon: Truck,        color: 'text-cyan-500 bg-cyan-50',    path: (r) => `/suppliers/${r.id}` },
  machines:          { label: 'الماكينات',     icon: Settings,     color: 'text-gray-500 bg-gray-50',    path: (r) => `/machines/${r.id}` },
  expenses:          { label: 'المصاريف',      icon: DollarSign,   color: 'text-red-500 bg-red-50',      path: () => `/expenses` },
  maintenanceOrders: { label: 'الصيانة',       icon: Wrench,       color: 'text-yellow-600 bg-yellow-50', path: () => `/maintenance` },
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') { setOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults({}); return; }
    const t = setTimeout(() => {
      setLoading(true);
      api.get('/search', { params: { q: query.trim() } })
        .then(r => setResults(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const totalResults = Object.values(results).reduce((s, arr) => s + (arr?.length || 0), 0);

  const go = (cat, item) => {
    setOpen(false); setQuery('');
    navigate(CATEGORY_META[cat].path(item));
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 text-xs transition-colors border border-white/10">
        <Search size={14} />
        <span>بحث...</span>
        <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-gray-200">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="ابحث في النظام (الموديلات، العملاء، الموردين، الفواتير، الماكينات...)"
            className="flex-1 py-3.5 text-sm bg-transparent outline-none placeholder:text-gray-400" dir="rtl" />
          {query && <button onClick={() => setQuery('')}><X size={16} className="text-gray-400 hover:text-gray-600" /></button>}
          <button onClick={() => setOpen(false)} className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 font-mono">ESC</button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto" dir="rtl">
          {loading && <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#c9a84c] border-t-transparent rounded-full" /></div>}

          {!loading && query && totalResults === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">لا توجد نتائج لـ &quot;{query}&quot;</div>
          )}

          {!loading && Object.entries(results).map(([cat, items]) => {
            if (!items?.length) return null;
            const meta = CATEGORY_META[cat];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <div key={cat}>
                <div className="px-4 py-2 text-[10px] font-bold text-gray-400 flex items-center gap-1.5 bg-gray-50 sticky top-0">
                  <Icon size={12} /> {meta.label} <span className="mr-auto text-gray-300">{items.length}</span>
                </div>
                {items.map((item, i) => (
                  <button key={i} onClick={() => go(cat, item)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-right">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}><Icon size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate text-[#1a1a2e]">{item.name || item.description || item.customer_name || item.code}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{item.code || item.invoice_number || ''}</div>
                    </div>
                    <ArrowLeft size={14} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            );
          })}

          {!query && (
            <div className="text-center py-10 text-gray-400 text-xs space-y-1">
              <Search size={24} className="mx-auto mb-2 opacity-30" />
              <p>ابدأ بالكتابة للبحث</p>
              <p className="text-[10px]">الموديلات • الأقمشة • العملاء • الموردين • الماكينات • الصيانة • المصاريف</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
