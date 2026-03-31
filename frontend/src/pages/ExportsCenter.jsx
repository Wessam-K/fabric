import { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Search, Calendar, Loader2, CheckCircle, AlertTriangle, Users, Scissors, Package, DollarSign, TrendingUp, Warehouse, CreditCard, UserCheck, Receipt, Settings, Layers, Factory } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import HelpButton from '../components/HelpButton';

const ICON_MAP = {
  Users, Scissors, Package, DollarSign, TrendingUp, Warehouse, AlertTriangle,
  CreditCard, UserCheck, CheckCircle, Receipt, Settings, Layers, Calendar, FileText, Factory,
};

const CATEGORY_MAP = {
  'suppliers': 'الموردين والمشتريات',
  'fabric-usage': 'المخزون والمواد',
  'accessory-usage': 'المخزون والمواد',
  'inventory-valuation': 'المخزون والمواد',
  'wo-cost-breakdown': 'الإنتاج',
  'model-profitability': 'الإنتاج',
  'stage-progress': 'الإنتاج',
  'production-timeline': 'الإنتاج',
  'waste-analysis': 'الإنتاج',
  'po-by-supplier': 'الموردين والمشتريات',
  'purchase-summary': 'الموردين والمشتريات',
  'financial-summary': 'المالية',
  'customers': 'المبيعات',
  'quality-report': 'الجودة',
  'payroll': 'الموارد البشرية',
  'employees': 'الموارد البشرية',
  'machines': 'الماكينات',
  'full-export': 'شامل',
};

const CATEGORIES = ['الإنتاج', 'المخزون والمواد', 'الموردين والمشتريات', 'المالية', 'المبيعات', 'الجودة', 'الموارد البشرية', 'الماكينات', 'شامل'];

export default function ExportsCenter() {
  const toast = useToast();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState({});
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    api.get('/exports/catalog')
      .then(r => setCatalog(r.data))
      .catch(() => toast?.error?.('فشل تحميل قائمة التصديرات'))
      .finally(() => setLoading(false));
  }, []);

  const buildUrl = (key, format) => {
    const params = new URLSearchParams();
    params.set('format', format);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    return `/exports/${key}?${params}`;
  };

  const handleDownload = async (key, format) => {
    const dlKey = `${key}-${format}`;
    setDownloading(p => ({ ...p, [dlKey]: true }));
    try {
      const resp = await api.get(buildUrl(key, format), { responseType: 'blob' });
      const blob = resp.data;
      const ext = format === 'xlsx' ? 'xlsx' : 'csv';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${key}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast?.success?.(`تم تحميل ${key}.${ext}`);
    } catch (err) {
      toast?.error?.(`فشل التحميل: ${err.message}`);
    } finally {
      setDownloading(p => ({ ...p, [dlKey]: false }));
    }
  };

  const filtered = catalog.filter(item => {
    if (search && !item.label.includes(search) && !item.description.includes(search) && !item.key.includes(search)) return false;
    if (activeCategory && CATEGORY_MAP[item.key] !== activeCategory) return false;
    return true;
  });

  const grouped = {};
  for (const item of filtered) {
    const cat = CATEGORY_MAP[item.key] || 'أخرى';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="مركز التصدير" subtitle={`${catalog.length} تقرير متاح للتصدير`} action={<HelpButton pageKey="exportscenter" />} />

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="بحث في التقارير..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pr-10 pl-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c] outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c] outline-none" />
            <span className="text-gray-400">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c] outline-none" />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => setActiveCategory('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${!activeCategory ? 'bg-[#c9a84c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            الكل
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${activeCategory === cat ? 'bg-[#c9a84c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Export cards grouped by category */}
      {CATEGORIES.filter(cat => grouped[cat]?.length > 0).map(cat => (
        <div key={cat}>
          <h2 className="text-lg font-bold text-[#1a1a2e] mb-3">{cat}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped[cat].map(item => {
              const IconComp = ICON_MAP[item.icon] || FileText;
              const csvKey = `${item.key}-csv`;
              const xlsxKey = `${item.key}-xlsx`;
              return (
                <div key={item.key} className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#c9a84c]/10 text-[#c9a84c] flex items-center justify-center flex-shrink-0">
                      <IconComp size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#1a1a2e] text-sm">{item.label}</h3>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50">
                    {!item.excelOnly && (
                      <button onClick={() => handleDownload(item.key, 'csv')} disabled={downloading[csvKey]}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-medium text-gray-600 transition disabled:opacity-40">
                        {downloading[csvKey] ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        CSV
                      </button>
                    )}
                    <button onClick={() => handleDownload(item.key, 'xlsx')} disabled={downloading[xlsxKey]}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#c9a84c]/10 hover:bg-[#c9a84c]/20 rounded-xl text-xs font-medium text-[#c9a84c] transition disabled:opacity-40">
                      {downloading[xlsxKey] ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                      Excel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Download size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد تقارير مطابقة للبحث</p>
        </div>
      )}
    </div>
  );
}
