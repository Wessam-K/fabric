import { useState, useEffect } from 'react';
import { Plus, Search, FileText, ShoppingCart, Eye, X, ArrowLeftRight, Download, Printer } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { fmtDateTime } from '../utils/formatters';
import Tooltip from '../components/Tooltip';
import Pagination from '../components/Pagination';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import { exportToExcel } from '../utils/exportExcel';

const STATUS_COLORS = { draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', expired: 'bg-orange-100 text-orange-700', cancelled: 'bg-red-100 text-red-700' };
const STATUS_LABELS = { draft: 'مسودة', sent: 'مرسل', accepted: 'مقبول', rejected: 'مرفوض', expired: 'منتهي', cancelled: 'ملغي' };

export default function Quotations() {
  const toast = useToast();
  const { can } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ quotation_number: '', customer_id: '', valid_until: '', notes: '', discount_percent: 0, tax_percent: 0, items: [{ description: '', quantity: 1, unit: 'pc', unit_price: 0, notes: '' }] });
  const [defaultTax, setDefaultTax] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/quotations', { params: { page, limit: 25, search, status: statusFilter } });
      setQuotations(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error('فشل تحميل عروض الأسعار'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, statusFilter, search]);
  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data?.data || r.data || [])).catch(e => console.error('Customers load failed:', e.message));
    api.get('/settings').then(r => { const tax = parseFloat(r.data?.tax_rate) || 0; setDefaultTax(tax); }).catch(e => console.error('Settings load failed:', e.message));
  }, []);

  const openNew = async () => {
    try {
      const { data } = await api.get('/quotations/next-number');
      setForm({ quotation_number: data.next_number, customer_id: '', valid_until: '', notes: '', discount_percent: 0, tax_percent: defaultTax, items: [{ description: '', quantity: 1, unit: 'pc', unit_price: 0, notes: '' }] });
      setShowModal(true);
    } catch { setShowModal(true); }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit: 'pc', unit_price: 0, notes: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const calcTotal = () => {
    const sub = form.items.reduce((s, it) => s + (it.quantity || 0) * (it.unit_price || 0), 0);
    const disc = sub * (form.discount_percent || 0) / 100;
    const tax = (sub - disc) * (form.tax_percent || 0) / 100;
    return { sub, disc, tax, total: sub - disc + tax };
  };

  const save = async () => {
    if (!form.customer_id) { toast.error('العميل مطلوب'); return; }
    if (form.items.some(i => !i.description || parseFloat(i.quantity || 0) <= 0)) {
      toast.error('تأكد من أن جميع العناصر لها وصف وكمية أكبر من صفر'); return;
    }
    try {
      await api.post('/quotations', form);
      toast.success('تم إنشاء عرض السعر');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل الحفظ'); }
  };

  const viewDetail = async (id) => {
    try { const { data } = await api.get(`/quotations/${id}`); setSelected(data); setShowDetail(true); }
    catch { toast.error('فشل التحميل'); }
  };

  const convertToSO = async (id) => {
    try {
      const { data } = await api.post(`/quotations/${id}/convert-to-so`);
      toast.success(`تم التحويل إلى أمر بيع ${data.so_number}`);
      setShowDetail(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل التحويل'); }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/quotations/${id}`, { status });
      toast.success('تم التحديث');
      load();
      if (showDetail) viewDetail(id);
    } catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  const totals = calcTotal();

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="عروض الأسعار" icon={FileText} count={total} />

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
        <button onClick={() => exportToExcel(quotations.map(q => ({ 'رقم العرض': q.quotation_number, 'العميل': q.customer_name, 'الحالة': STATUS_LABELS[q.status] || q.status, 'الإجمالي': q.total, 'صالح حتى': q.valid_until })), 'عروض الأسعار')} className="btn btn-ghost text-xs flex items-center gap-1"><Download size={14} /> تصدير</button>
        <PermissionGuard module="quotations" action="create">
          <button onClick={openNew} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]">
            <Plus size={18} /> عرض سعر جديد
          </button>
        </PermissionGuard>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : quotations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border"><FileText size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">لا توجد عروض أسعار</p></div>
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
                    <input type="checkbox" ref={el => { if (el) el.indeterminate = selectedIds.length > 0 && selectedIds.length < quotations.length; }} checked={quotations.length > 0 && quotations.every(q => selectedIds.includes(q.id))} onChange={e => setSelectedIds(e.target.checked ? quotations.map(q => q.id) : [])}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
                  </th>
                  <th className="p-3 text-right">الرقم</th><th className="p-3 text-right">العميل</th><th className="p-3 text-center">الإجمالي</th><th className="p-3 text-center">صالح حتى</th><th className="p-3 text-center">الحالة</th><th className="p-3 text-center">إجراءات</th></tr>
              </thead>
              <tbody className="divide-y">
                {quotations.map(q => (
                  <tr key={q.id} className={`hover:bg-gray-50 ${selectedIds.includes(q.id) ? 'bg-[#c9a84c]/5' : ''}`}>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(q.id)} onChange={() => setSelectedIds(prev => prev.includes(q.id) ? prev.filter(x => x !== q.id) : [...prev, q.id])}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
                    </td>
                    <td className="p-3 font-mono font-bold text-[#1a1a2e]">{q.quotation_number}</td>
                    <td className="p-3 text-gray-600">{q.customer_name || '-'}</td>
                    <td className="p-3 text-center font-bold">{Number(q.total || 0).toLocaleString()}</td>
                    <td className="p-3 text-center text-gray-500">{fmtDateTime(q.valid_until)}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status]}</span></td>
                    <td className="p-3 text-center">
                      <Tooltip text="عرض التفاصيل"><button onClick={() => viewDetail(q.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Eye size={16} /></button></Tooltip>
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
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">عرض سعر جديد</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium mb-1">الرقم</label><input value={form.quotation_number} onChange={e => setForm(f => ({ ...f, quotation_number: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" /></div>
                <div><label className="block text-sm font-medium mb-1">العميل *</label>
                  <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">— اختر —</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium mb-1">صالح حتى</label><input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">الخصم %</label><input type="number" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: parseFloat(e.target.value) || 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">الضريبة %</label><input type="number" value={form.tax_percent} onChange={e => setForm(f => ({ ...f, tax_percent: parseFloat(e.target.value) || 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2"><label className="text-sm font-bold">الأصناف</label><button onClick={addItem} className="text-xs text-[#c9a84c] hover:underline">+ إضافة</button></div>
                <div className="space-y-2">
                  {form.items.map((it, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input placeholder="الوصف" value={it.description} onChange={e => { const items = [...form.items]; items[i].description = e.target.value; setForm(f => ({ ...f, items })); }} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                      <input type="number" placeholder="الكمية" value={it.quantity} onChange={e => { const items = [...form.items]; items[i].quantity = parseInt(e.target.value) || 0; setForm(f => ({ ...f, items })); }} className="w-20 border rounded-lg px-3 py-2 text-sm" />
                      <input type="number" placeholder="السعر" value={it.unit_price} onChange={e => { const items = [...form.items]; items[i].unit_price = parseFloat(e.target.value) || 0; setForm(f => ({ ...f, items })); }} className="w-24 border rounded-lg px-3 py-2 text-sm" />
                      <span className="text-sm font-bold min-w-[70px] text-left">{((it.quantity || 0) * (it.unit_price || 0)).toLocaleString()}</span>
                      {form.items.length > 1 && <button onClick={() => removeItem(i)} className="p-1 text-red-500"><X size={16} /></button>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-1">
                <div className="flex justify-between"><span>المجموع الفرعي</span><span>{totals.sub.toLocaleString()}</span></div>
                {totals.disc > 0 && <div className="flex justify-between text-red-600"><span>الخصم ({form.discount_percent}%)</span><span>-{totals.disc.toLocaleString()}</span></div>}
                {totals.tax > 0 && <div className="flex justify-between text-blue-600"><span>الضريبة ({form.tax_percent}%)</span><span>+{totals.tax.toLocaleString()}</span></div>}
                <div className="flex justify-between font-bold text-lg border-t pt-1"><span>الإجمالي</span><span>{totals.total.toLocaleString()}</span></div>
              </div>

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
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-bold">{selected.quotation_number}</h2>
                <p className="text-sm text-gray-500">{selected.customer_name}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-1 border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100">
                  <Printer size={14} /> طباعة
                </button>
                {(selected.status === 'draft' || selected.status === 'sent') && can('sales_orders', 'create') && (
                  <button onClick={() => convertToSO(selected.id)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700">
                    <ArrowLeftRight size={14} /> تحويل لأمر بيع
                  </button>
                )}
                {selected.status === 'draft' && can('quotations', 'edit') && <button onClick={() => changeStatus(selected.id, 'sent')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">إرسال</button>}
                <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[65vh]">
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الحالة</p><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">صالح حتى</p><p className="font-bold">{fmtDateTime(selected.valid_until)}</p></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الخصم</p><p className="font-bold">{selected.discount_percent}%</p></div>
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
              {selected.notes && <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">{selected.notes}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
