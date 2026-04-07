import { useState, useEffect } from 'react';
import { Search, Package, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { PageHeader, LoadingState, EmptyState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import api from '../utils/api';
import { fmtDateTime } from '../utils/formatters';
import { useToast } from '../components/Toast';

const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

export default function FabricInventory() {
  const toast = useToast();
  const [stock, setStock] = useState([]);
  const [threshold, setThreshold] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [batches, setBatches] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (lowOnly) params.low_stock_only = '1';
      const { data } = await api.get('/inventory/fabric-stock', { params });
      setStock(data.rows);
      setThreshold(data.low_stock_threshold);
    } catch { toast.error('فشل تحميل المخزون'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, lowOnly]);

  const toggleExpand = async (code) => {
    if (expanded === code) { setExpanded(null); setBatches([]); return; }
    setExpanded(code);
    setBatchLoading(true);
    try {
      const { data } = await api.get(`/fabrics/${code}/batches`, { params: { status: 'all' } });
      setBatches(data);
    } catch { setBatches([]); }
    finally { setBatchLoading(false); }
  };

  return (
    <div className="page">
      <PageHeader title="مخزون الأقمشة" subtitle="تتبع الدفعات والأمتار المتاحة من كل قماش" action={<HelpButton pageKey="inventory" />} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود..."
            className="w-full pr-9 pl-3 py-2 text-sm form-input" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} className="accent-[#c9a84c]" />
          <AlertTriangle size={14} className="text-amber-500" /> مخزون منخفض فقط (أقل من {threshold} م)
        </label>
      </div>

      {loading ? (
        <LoadingState />
      ) : stock.length === 0 ? (
        <EmptyState title="لا توجد أقمشة في المخزون" />
      ) : (
        <div className="space-y-3">
          {stock.map(f => (
            <div key={f.code} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button onClick={() => toggleExpand(f.code)} className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-right">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Package size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1a1a2e] text-sm">{f.name}</span>
                    <span className="text-[10px] font-mono text-gray-400">{f.code}</span>
                    {f.color && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{f.color}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                    <span>{f.batch_count} دفعة</span>
                    <span>استلام: {fmt(f.total_received)} م</span>
                    <span>استخدام: {fmt(f.total_used)} م</span>
                    {f.total_wasted > 0 && <span className="text-orange-500">هدر: {fmt(f.total_wasted)} م</span>}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <div className={`text-xl font-bold font-mono ${f.total_available < threshold && f.total_available > 0 ? 'text-amber-500' : f.total_available <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {fmt(f.total_available)} م
                  </div>
                  <span className="text-[10px] text-gray-400">متاح</span>
                </div>
                {expanded === f.code ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
              </button>

              {expanded === f.code && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                  {batchLoading ? (
                    <div className="text-center py-4 text-xs text-gray-400">جاري التحميل...</div>
                  ) : batches.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400">لا توجد دفعات</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-right pb-2">رمز الدفعة</th>
                          <th className="text-right pb-2">المورد</th>
                          <th className="text-right pb-2">أمر الشراء</th>
                          <th className="text-center pb-2">المستلم</th>
                          <th className="text-center pb-2">المستخدم</th>
                          <th className="text-center pb-2">المتاح</th>
                          <th className="text-center pb-2">السعر/م</th>
                          <th className="text-center pb-2">الحالة</th>
                          <th className="text-center pb-2">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batches.map(b => (
                          <tr key={b.id} className="border-t border-gray-100">
                            <td className="py-2 font-mono font-bold">{b.batch_code}</td>
                            <td className="py-2">{b.supplier_name || '—'}</td>
                            <td className="py-2 font-mono">{b.po_number || '—'}</td>
                            <td className="py-2 text-center font-mono">{fmt(b.received_meters)}</td>
                            <td className="py-2 text-center font-mono">{fmt(b.used_meters)}</td>
                            <td className="py-2 text-center font-mono font-bold text-green-600">{fmt(b.available_meters)}</td>
                            <td className="py-2 text-center font-mono text-[#c9a84c]">{fmt(b.price_per_meter)} ج</td>
                            <td className="py-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${b.batch_status === 'available' ? 'bg-green-100 text-green-700' : b.batch_status === 'depleted' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                {b.batch_status === 'available' ? 'متاح' : b.batch_status === 'depleted' ? 'نفد' : b.batch_status}
                              </span>
                            </td>
                            <td className="py-2 text-center">{b.received_date ? fmtDateTime(b.received_date) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
