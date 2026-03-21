import { useState, useEffect } from 'react';
import { Package, AlertTriangle, Search, RefreshCw, Edit3 } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { PageHeader, LoadingState } from '../components/ui';
import ExportButton from '../components/ExportButton';

const ACC_TYPE_LABELS = {
  button: 'أزرار', zipper: 'سوست', thread: 'خيوط', label: 'ليبلات',
  packaging: 'تغليف', elastic: 'أستك', padding: 'حشو', interfacing: 'فازلين', other: 'أخرى',
};
const TYPES = [{ value: '', label: 'الكل' }, ...Object.entries(ACC_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))];

export default function AccessoryInventory() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ qty_change: '', notes: '' });

  const fetchData = async () => {
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

  useEffect(() => { fetchData(); }, [search, filterType, lowOnly]);

  const handleAdjust = async () => {
    if (!adjustForm.qty_change || parseInt(adjustForm.qty_change) === 0) { toast.error('الكمية مطلوبة'); return; }
    try {
      await api.post(`/accessories/${adjustModal.code}/stock/adjust`, adjustForm);
      toast.success('تم تعديل المخزون');
      setAdjustModal(null);
      setAdjustForm({ qty_change: '', notes: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const totalValue = items.reduce((s, a) => s + (a.quantity_on_hand || 0) * (a.unit_price || 0), 0);
  const lowCount = items.filter(a => a.is_low_stock).length;

  return (
    <div className="page">
      <PageHeader title="مخزون الاكسسوارات" subtitle={`${items.length} صنف · ${lowCount} منخفض المخزون`}
        actions={<div className="flex items-center gap-2">
          <ExportButton data={items} filename="accessory-inventory" columns={[{key:'code',label:'الكود'},{key:'name',label:'الاسم'},{key:'acc_type',label:'النوع'},{key:'quantity_on_hand',label:'الكمية'},{key:'low_stock_threshold',label:'الحد الأدنى'},{key:'unit_price',label:'سعر الوحدة'}]} />
          <button onClick={fetchData} className="btn btn-ghost"><RefreshCw size={14} /> تحديث</button>
        </div>}
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
                <th className="px-4 py-3 text-center text-xs text-gray-500">تعديل</th>
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
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => { setAdjustModal(a); setAdjustForm({ qty_change: '', notes: '' }); }}
                      className="p-1.5 text-gray-400 hover:text-[#c9a84c] hover:bg-amber-50 rounded-lg transition-colors">
                      <Edit3 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">لا توجد بيانات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAdjustModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e]">تعديل مخزون: {adjustModal.name}</h3>
            <p className="text-xs text-gray-400">المخزون الحالي: <span className="font-mono font-bold">{adjustModal.quantity_on_hand || 0}</span></p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">التعديل (+ إضافة / - سحب) *</label>
              <input type="number" value={adjustForm.qty_change} onChange={e => setAdjustForm({...adjustForm, qty_change: e.target.value})}
                placeholder="مثال: +50 أو -10"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ملاحظات</label>
              <input type="text" value={adjustForm.notes} onChange={e => setAdjustForm({...adjustForm, notes: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdjustModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleAdjust} className="px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold">تنفيذ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
