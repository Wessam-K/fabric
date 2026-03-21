import { useState, useEffect } from 'react';
import { Package, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, LoadingState } from '../components/ui';

const ACC_TYPE_LABELS = {
  button: 'أزرار', zipper: 'سوست', thread: 'خيوط', label: 'ليبلات',
  packaging: 'تغليف', elastic: 'أستك', padding: 'حشو', interfacing: 'فازلين', other: 'أخرى',
};
const TYPES = [{ value: '', label: 'الكل' }, ...Object.entries(ACC_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))];

export default function AccessoryInventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      if (lowOnly) params.low_stock_only = '1';
      const { data } = await api.get('/inventory/accessory-stock', { params });
      setItems(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [search, filterType, lowOnly]);

  const totalValue = items.reduce((s, a) => s + (a.quantity_on_hand || 0) * (a.unit_price || 0), 0);
  const lowCount = items.filter(a => a.is_low_stock).length;

  return (
    <div className="page">
      <PageHeader title="مخزون الاكسسوارات" subtitle={`${items.length} صنف · ${lowCount} منخفض المخزون`}
        actions={<button onClick={fetch} className="btn btn-ghost"><RefreshCw size={14} /> تحديث</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-gray-400">إجمالي الأصناف</p>
          <p className="text-2xl font-bold font-mono text-[#1a1a2e]">{items.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-gray-400">منخفض المخزون</p>
          <p className="text-2xl font-bold font-mono text-red-500">{lowCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 col-span-2">
          <p className="text-xs text-gray-400">القيمة الإجمالية</p>
          <p className="text-2xl font-bold font-mono text-[#c9a84c]">{Math.round(totalValue).toLocaleString('ar-EG')} ج</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="form-input w-full pr-8" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="form-select text-xs">
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} className="rounded" />
          منخفض فقط
        </label>
      </div>

      {loading ? <LoadingState /> : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الكود</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الاسم</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">النوع</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">الكمية</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">الحد الأدنى</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">سعر الوحدة</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">القيمة</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr key={a.code} className={`border-t border-gray-100 hover:bg-gray-50/50 ${a.is_low_stock ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{a.code}</td>
                  <td className="px-4 py-3 font-bold text-[#1a1a2e]">{a.name}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{ACC_TYPE_LABELS[a.acc_type] || a.acc_type}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold">{a.quantity_on_hand || 0}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-gray-400">{a.low_stock_threshold || 10}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs">{a.unit_price} ج</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-[#c9a84c] font-bold">{Math.round((a.quantity_on_hand || 0) * (a.unit_price || 0)).toLocaleString('ar-EG')} ج</td>
                  <td className="px-4 py-3 text-center">
                    {a.is_low_stock ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={10} /> منخفض
                      </span>
                    ) : (
                      <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full">جيد</span>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">لا توجد بيانات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
