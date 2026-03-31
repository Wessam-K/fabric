import { useState, useEffect } from 'react';
import { Plus, Search, Beaker, Eye, X, Factory, CheckCircle } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import HelpButton from '../components/HelpButton';

const STATUS_COLORS = { requested: 'bg-gray-100 text-gray-700', in_progress: 'bg-yellow-100 text-yellow-700', completed: 'bg-blue-100 text-blue-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', in_production: 'bg-purple-100 text-purple-700', cancelled: 'bg-red-100 text-red-700' };
const STATUS_LABELS = { requested: 'مطلوبة', in_progress: 'قيد التنفيذ', completed: 'مكتملة', approved: 'معتمدة', rejected: 'مرفوضة', in_production: 'في الإنتاج', cancelled: 'ملغاة' };

export default function Samples() {
  const toast = useToast();
  const { can } = useAuth();
  const [samples, setSamples] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ sample_number: '', customer_id: '', product_name: '', description: '', quantity: 1, size_range: '', fabric_details: '', accessories_details: '', target_price: '', deadline: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/samples', { params: { page, limit: 25, search, status: statusFilter } });
      setSamples(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error('فشل تحميل العينات'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, statusFilter]);
  useEffect(() => { api.get('/customers').then(r => setCustomers(r.data?.data || r.data || [])).catch(() => {}); }, []);

  const openNew = async () => {
    try {
      const { data } = await api.get('/samples/next-number');
      setForm({ sample_number: data.next_number, customer_id: '', product_name: '', description: '', quantity: 1, size_range: '', fabric_details: '', accessories_details: '', target_price: '', deadline: '', notes: '' });
      setShowModal(true);
    } catch { setShowModal(true); }
  };

  const save = async () => {
    try {
      await api.post('/samples', form);
      toast.success('تم إنشاء العينة');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل الحفظ'); }
  };

  const viewDetail = async (id) => {
    try { const { data } = await api.get(`/samples/${id}`); setSelected(data); setShowDetail(true); }
    catch { toast.error('فشل التحميل'); }
  };

  const changeStatus = async (id, status) => {
    try { await api.put(`/samples/${id}`, { status }); toast.success('تم التحديث'); load(); if (showDetail) viewDetail(id); }
    catch { toast.error('فشل التحديث'); }
  };

  const convertToWO = async (id) => {
    try {
      const { data } = await api.post(`/samples/${id}/convert-to-wo`, { quantity: selected?.quantity || 1 });
      toast.success(`تم إنشاء أمر عمل ${data.wo_number}`);
      setShowDetail(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل التحويل'); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="إدارة العينات" icon={Beaker} count={total} action={<HelpButton pageKey="samples" />} />

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
            className="w-full pr-9 pl-3 py-2 border rounded-lg text-sm" placeholder="بحث..." />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <PermissionGuard module="samples" action="create">
          <button onClick={openNew} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]">
            <Plus size={18} /> عينة جديدة
          </button>
        </PermissionGuard>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : samples.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border"><Beaker size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">لا توجد عينات</p></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th className="p-3 text-right">الرقم</th><th className="p-3 text-right">المنتج</th><th className="p-3 text-right">العميل</th><th className="p-3 text-center">الكمية</th><th className="p-3 text-center">الموعد</th><th className="p-3 text-center">الحالة</th><th className="p-3 text-center">إجراءات</th></tr>
              </thead>
              <tbody className="divide-y">
                {samples.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-[#1a1a2e]">{s.sample_number}</td>
                    <td className="p-3">{s.product_name}</td>
                    <td className="p-3 text-gray-600">{s.customer_name || '-'}</td>
                    <td className="p-3 text-center">{s.quantity}</td>
                    <td className="p-3 text-center text-gray-500">{s.deadline?.slice(0, 10) || '-'}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[s.status]}`}>{STATUS_LABELS[s.status]}</span></td>
                    <td className="p-3 text-center"><button onClick={() => viewDetail(s.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Eye size={16} /></button></td>
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
              <h2 className="text-lg font-bold">عينة جديدة</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">رقم العينة</label><input value={form.sample_number} onChange={e => setForm(f => ({ ...f, sample_number: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" /></div>
                <div><label className="block text-sm font-medium mb-1">العميل</label><select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">—</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">اسم المنتج *</label><input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">الوصف</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium mb-1">الكمية</label><input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">نطاق المقاسات</label><input value={form.size_range} onChange={e => setForm(f => ({ ...f, size_range: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="S-XL" /></div>
                <div><label className="block text-sm font-medium mb-1">السعر المستهدف</label><input type="number" value={form.target_price} onChange={e => setForm(f => ({ ...f, target_price: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">تفاصيل الأقمشة</label><textarea value={form.fabric_details} onChange={e => setForm(f => ({ ...f, fabric_details: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
              <div><label className="block text-sm font-medium mb-1">تفاصيل الاكسسوارات</label><textarea value={form.accessories_details} onChange={e => setForm(f => ({ ...f, accessories_details: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
              <div><label className="block text-sm font-medium mb-1">الموعد النهائي</label><input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">ملاحظات</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
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
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-bold">{selected.sample_number}</h2>
                <p className="text-sm text-gray-500">{selected.product_name} • {selected.customer_name || '-'}</p>
              </div>
              <div className="flex gap-2">
                {selected.status === 'approved' && can('work_orders', 'create') && (
                  <button onClick={() => convertToWO(selected.id)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                    <Factory size={14} /> تحويل لأمر عمل
                  </button>
                )}
                {selected.status === 'requested' && can('samples', 'edit') && <button onClick={() => changeStatus(selected.id, 'in_progress')} className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm">بدء التنفيذ</button>}
                {selected.status === 'in_progress' && can('samples', 'edit') && <button onClick={() => changeStatus(selected.id, 'completed')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">اكتمال</button>}
                {selected.status === 'completed' && can('samples', 'edit') && (
                  <>
                    <button onClick={() => changeStatus(selected.id, 'approved')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">اعتماد</button>
                    <button onClick={() => changeStatus(selected.id, 'rejected')} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm">رفض</button>
                  </>
                )}
                <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[65vh] space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الحالة</p><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الكمية</p><p className="font-bold">{selected.quantity}</p></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الموعد</p><p className="font-bold">{selected.deadline?.slice(0, 10) || '-'}</p></div>
              </div>
              {selected.fabric_details && <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600 font-bold mb-1">تفاصيل الأقمشة</p><p className="text-sm">{selected.fabric_details}</p></div>}
              {selected.accessories_details && <div className="bg-purple-50 p-3 rounded-lg"><p className="text-xs text-purple-600 font-bold mb-1">تفاصيل الاكسسوارات</p><p className="text-sm">{selected.accessories_details}</p></div>}
              {selected.description && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 font-bold mb-1">الوصف</p><p className="text-sm">{selected.description}</p></div>}
              {selected.customer_feedback && <div className="bg-yellow-50 p-3 rounded-lg"><p className="text-xs text-yellow-600 font-bold mb-1">ملاحظات العميل</p><p className="text-sm">{selected.customer_feedback}</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
