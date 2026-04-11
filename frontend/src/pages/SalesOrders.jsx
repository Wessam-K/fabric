import { useState, useEffect } from 'react';
import { Search, ShoppingCart, Eye, X, Factory, ArrowLeftRight, Download } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { fmtDateTime } from '../utils/formatters';
import Tooltip from '../components/Tooltip';
import Pagination from '../components/Pagination';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import HelpButton from '../components/HelpButton';
import { exportToExcel } from '../utils/exportExcel';

const STATUS_COLORS = { confirmed: 'bg-blue-100 text-blue-700', in_production: 'bg-yellow-100 text-yellow-700', shipped: 'bg-purple-100 text-purple-700', delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
const STATUS_LABELS = { confirmed: 'مؤكد', in_production: 'قيد الإنتاج', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };

export default function SalesOrders() {
  const toast = useToast();
  const { can } = useAuth();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/quotations/sales-orders/list', { params: { page, limit: 25, status: statusFilter } });
      setOrders(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error('فشل تحميل أوامر البيع'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const viewDetail = async (id) => {
    try { const { data } = await api.get(`/quotations/sales-orders/${id}`); setSelected(data); setShowDetail(true); }
    catch { toast.error('فشل التحميل'); }
  };

  const convertToWO = async (id) => {
    try {
      const { data } = await api.post(`/quotations/sales-orders/${id}/convert-to-wo`);
      toast.success(`تم إنشاء أمر عمل ${data.wo_number}`);
      setShowDetail(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل التحويل'); }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/quotations/sales-orders/${id}/status`, { status });
      toast.success('تم التحديث');
      load();
      if (showDetail) viewDetail(id);
    } catch { toast.error('فشل التحديث'); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="أوامر البيع" icon={ShoppingCart} count={total} action={<HelpButton pageKey="salesorders" />} />

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => exportToExcel(orders.map(o => ({ 'رقم الأمر': o.so_number, 'العميل': o.customer_name, 'الحالة': STATUS_LABELS[o.status] || o.status, 'الإجمالي': o.total, 'تاريخ الطلب': o.order_date, 'تاريخ التسليم': o.delivery_date })), 'أوامر البيع')} className="btn btn-ghost text-xs flex items-center gap-1"><Download size={14} /> تصدير</button>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border"><ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">لا توجد أوامر بيع</p><p className="text-gray-400 text-sm mt-1">قم بتحويل عرض سعر إلى أمر بيع</p></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-[#c9a84c]/10 border-b border-[#c9a84c]/20">
              <span className="text-sm text-[#c9a84c] font-bold">{selectedIds.length} محدد</span>
              <button onClick={() => setSelectedIds([])} className="text-xs text-gray-500 hover:text-red-500">إلغاء التحديد</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 w-10">
                    <input type="checkbox" ref={el => { if (el) el.indeterminate = selectedIds.length > 0 && selectedIds.length < orders.length; }} checked={orders.length > 0 && orders.every(o => selectedIds.includes(o.id))} onChange={e => setSelectedIds(e.target.checked ? orders.map(o => o.id) : [])}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
                  </th>
                  <th className="p-3 text-right">رقم أمر البيع</th><th className="p-3 text-right">العميل</th><th className="p-3 text-center">الإجمالي</th><th className="p-3 text-center">تاريخ الطلب</th><th className="p-3 text-center">الحالة</th><th className="p-3 text-center">إجراءات</th></tr>
              </thead>
              <tbody className="divide-y">
                {orders.map(o => (
                  <tr key={o.id} className={`hover:bg-gray-50 ${selectedIds.includes(o.id) ? 'bg-[#c9a84c]/5' : ''}`}>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => setSelectedIds(prev => prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id])}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
                    </td>
                    <td className="p-3 font-mono font-bold text-[#1a1a2e]">{o.so_number}</td>
                    <td className="p-3 text-gray-600">{o.customer_name || '-'}</td>
                    <td className="p-3 text-center font-bold">{Number(o.total || 0).toLocaleString()}</td>
                    <td className="p-3 text-center text-gray-500">{fmtDateTime(o.order_date)}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status] || o.status}</span></td>
                    <td className="p-3 text-center"><Tooltip text="عرض التفاصيل"><button onClick={() => viewDetail(o.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Eye size={16} /></button></Tooltip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination current={page} total={total} pageSize={25} onChange={setPage} />
        </div>
      )}

      {showDetail && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-bold">{selected.so_number}</h2>
                <p className="text-sm text-gray-500">{selected.customer_name}</p>
              </div>
              <div className="flex gap-2">
                {selected.status === 'confirmed' && can('work_orders', 'create') && (
                  <button onClick={() => convertToWO(selected.id)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                    <Factory size={14} /> تحويل لأمر عمل
                  </button>
                )}
                {selected.status !== 'delivered' && selected.status !== 'cancelled' && can('sales_orders', 'edit') && (
                  <>
                    {selected.status === 'in_production' && <button onClick={() => changeStatus(selected.id, 'shipped')} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm">شحن</button>}
                    {selected.status === 'shipped' && <button onClick={() => changeStatus(selected.id, 'delivered')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">تسليم</button>}
                  </>
                )}
                <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[65vh]">
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الحالة</p><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">تاريخ الطلب</p><p className="font-bold">{fmtDateTime(selected.order_date)}</p></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">تاريخ التسليم</p><p className="font-bold">{fmtDateTime(selected.delivery_date)}</p></div>
                <div className="bg-[#c9a84c]/10 p-3 rounded-lg"><p className="text-xs text-gray-500">الإجمالي</p><p className="font-bold text-lg">{Number(selected.total || 0).toLocaleString()}</p></div>
              </div>
              {selected.items?.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2 text-right">الوصف</th><th className="p-2 text-center">الكمية</th><th className="p-2 text-center">السعر</th><th className="p-2 text-center">الإجمالي</th></tr></thead>
                  <tbody className="divide-y">
                    {selected.items.map(it => (
                      <tr key={it.id}><td className="p-2">{it.description}</td><td className="p-2 text-center">{it.quantity}</td><td className="p-2 text-center">{Number(it.unit_price).toLocaleString()}</td><td className="p-2 text-center font-bold">{Number(it.total_price).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
