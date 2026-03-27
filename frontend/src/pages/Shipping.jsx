import { useState, useEffect } from 'react';
import { Plus, Search, Truck, Eye, X, MapPin, Package } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmDialog';

const STATUS_COLORS = { draft: 'bg-gray-100 text-gray-700', preparing: 'bg-yellow-100 text-yellow-700', shipped: 'bg-blue-100 text-blue-700', in_transit: 'bg-purple-100 text-purple-700', delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
const STATUS_LABELS = { draft: 'مسودة', preparing: 'قيد التجهيز', shipped: 'تم الشحن', in_transit: 'في الطريق', delivered: 'تم التسليم', cancelled: 'ملغي' };

export default function Shipping() {
  const toast = useToast();
  const { can } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [shipments, setShipments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ shipment_number: '', shipment_type: 'outbound', customer_id: '', carrier: '', tracking_number: '', estimated_delivery: '', notes: '', items: [{ work_order_id: '', description: '', quantity: 1 }] });
  const [customers, setCustomers] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/shipping', { params: { page, limit: 25, search, status: statusFilter } });
      setShipments(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error('فشل تحميل الشحنات'); }
    finally { setLoading(false); }
  };

  const loadCustomers = async () => {
    try { const { data } = await api.get('/customers'); setCustomers(data.data || data || []); } catch {}
  };

  useEffect(() => { load(); }, [page, statusFilter]);
  useEffect(() => { loadCustomers(); }, []);

  const getNextNumber = async () => {
    try { const { data } = await api.get('/shipping/next-number'); return data.next_number; } catch { return ''; }
  };

  const openNew = async () => {
    const num = await getNextNumber();
    setForm({ shipment_number: num, shipment_type: 'outbound', customer_id: '', carrier: '', tracking_number: '', estimated_delivery: '', notes: '', items: [{ work_order_id: '', description: '', quantity: 1 }] });
    setShowModal(true);
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { work_order_id: '', description: '', quantity: 1 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (form.items.some(i => !i.quantity || parseInt(i.quantity) <= 0)) {
      toast.error('تأكد من أن جميع العناصر لها كمية أكبر من صفر'); return;
    }
    try {
      await api.post('/shipping', form);
      toast.success('تم إنشاء الشحنة');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل الحفظ'); }
  };

  const viewDetail = async (id) => {
    try {
      const { data } = await api.get(`/shipping/${id}`);
      setSelected(data);
      setShowDetail(true);
    } catch { toast.error('فشل تحميل التفاصيل'); }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/shipping/${id}/status`, { status });
      toast.success('تم تحديث الحالة');
      load();
      if (showDetail) viewDetail(id);
    } catch (err) { toast.error(err.response?.data?.error || 'فشل التحديث'); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="الشحن واللوجستيات" icon={Truck} count={total} />
      <ConfirmDialog />

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
            className="w-full pr-9 pl-3 py-2 border rounded-lg text-sm" placeholder="بحث بالرقم..." />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <PermissionGuard module="shipping" action="create">
          <button onClick={openNew} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]">
            <Plus size={18} /> شحنة جديدة
          </button>
        </PermissionGuard>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Truck size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg">لا توجد شحنات</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 text-right">رقم الشحنة</th>
                  <th className="p-3 text-right">النوع</th>
                  <th className="p-3 text-right">العميل/المورد</th>
                  <th className="p-3 text-right">الناقل</th>
                  <th className="p-3 text-center">التسليم المتوقع</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shipments.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-[#1a1a2e]">{s.shipment_number}</td>
                    <td className="p-3">{s.shipment_type === 'inbound' ? 'وارد' : 'صادر'}</td>
                    <td className="p-3 text-gray-600">{s.customer_name || s.supplier_name || '-'}</td>
                    <td className="p-3 text-gray-600">{s.carrier || '-'}</td>
                    <td className="p-3 text-center">{s.estimated_delivery?.slice(0, 10) || '-'}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => viewDetail(s.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Eye size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination current={page} total={total} pageSize={25} onChange={setPage} />
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">شحنة جديدة</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">رقم الشحنة</label>
                  <input value={form.shipment_number} onChange={e => setForm(f => ({ ...f, shipment_number: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">النوع</label>
                  <select value={form.shipment_type} onChange={e => setForm(f => ({ ...f, shipment_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="outbound">صادر</option>
                    <option value="inbound">وارد</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">العميل</label>
                  <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">— اختر —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الناقل</label>
                  <input value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="شركة الشحن" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">رقم التتبع</label>
                  <input value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">تاريخ التسليم المتوقع</label>
                  <input type="date" value={form.estimated_delivery} onChange={e => setForm(f => ({ ...f, estimated_delivery: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold">الأصناف</label>
                  <button onClick={addItem} className="text-xs text-[#c9a84c] hover:underline">+ إضافة صنف</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-center">
                    <input placeholder="الوصف" value={item.description} onChange={e => {
                      const items = [...form.items]; items[i].description = e.target.value; setForm(f => ({ ...f, items }));
                    }} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    <input type="number" placeholder="الكمية" value={item.quantity} onChange={e => {
                      const items = [...form.items]; items[i].quantity = parseInt(e.target.value) || 0; setForm(f => ({ ...f, items }));
                    }} className="w-20 border rounded-lg px-3 py-2 text-sm" />
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={16} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">إلغاء</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold hover:bg-[#b8973f]">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-bold">{selected.shipment_number}</h2>
                <p className="text-sm text-gray-500">{selected.carrier || 'بدون ناقل'} • {selected.customer_name || ''}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto max-h-[65vh]">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">الحالة</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">التسليم المتوقع</p>
                  <p className="font-bold">{selected.estimated_delivery?.slice(0, 10) || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">رقم التتبع</p>
                  <p className="font-bold font-mono">{selected.tracking_number || '-'}</p>
                </div>
              </div>

              {/* Status Actions */}
              {can('shipping', 'edit') && selected.status !== 'delivered' && selected.status !== 'cancelled' && (
                <div className="flex gap-2">
                  {selected.status === 'draft' && <button onClick={() => changeStatus(selected.id, 'preparing')} className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm">بدء التجهيز</button>}
                  {selected.status === 'preparing' && <button onClick={() => changeStatus(selected.id, 'shipped')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">تم الشحن</button>}
                  {selected.status === 'shipped' && <button onClick={() => changeStatus(selected.id, 'in_transit')} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm">في الطريق</button>}
                  {(selected.status === 'shipped' || selected.status === 'in_transit') && <button onClick={() => changeStatus(selected.id, 'delivered')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">تم التسليم</button>}
                </div>
              )}

              {/* Items */}
              {selected.items?.length > 0 && (
                <div>
                  <h3 className="font-bold mb-2">الأصناف</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="p-2 text-right">الوصف</th><th className="p-2 text-center">الكمية</th></tr></thead>
                    <tbody className="divide-y">
                      {selected.items.map(it => (
                        <tr key={it.id}><td className="p-2">{it.description}</td><td className="p-2 text-center">{it.quantity}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
