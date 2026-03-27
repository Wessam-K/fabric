import { useState, useEffect } from 'react';
import { Plus, Search, RotateCcw, Eye, X, CheckCircle } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };
const STATUS_LABELS = { pending: 'قيد الانتظار', approved: 'معتمد', rejected: 'مرفوض' };

export default function Returns() {
  const toast = useToast();
  const { can } = useAuth();
  const [tab, setTab] = useState('sales');

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="المرتجعات" icon={RotateCcw} />

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('sales')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sales' ? 'bg-white shadow text-[#1a1a2e]' : 'text-gray-500'}`}>مرتجعات المبيعات</button>
        <button onClick={() => setTab('purchases')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'purchases' ? 'bg-white shadow text-[#1a1a2e]' : 'text-gray-500'}`}>مرتجعات المشتريات</button>
      </div>

      {tab === 'sales' && <SalesReturnsTab />}
      {tab === 'purchases' && <PurchaseReturnsTab />}
    </div>
  );
}

function SalesReturnsTab() {
  const toast = useToast();
  const { can } = useAuth();
  const [returns, setReturns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id: '', invoice_id: '', reason: '', notes: '', items: [{ product_description: '', quantity: 1, unit_price: 0, reason: '' }] });

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/returns/sales', { params: { page, limit: 25 } }); setReturns(data.data || []); setTotal(data.total || 0); }
    catch { toast.error('فشل التحميل'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => { api.get('/customers').then(r => setCustomers(r.data?.data || r.data || [])).catch(() => {}); }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_description: '', quantity: 1, unit_price: 0, reason: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const save = async () => {
    try { await api.post('/returns/sales', form); toast.success('تم إنشاء المرتجع'); setShowModal(false); setForm({ customer_id: '', invoice_id: '', reason: '', notes: '', items: [{ product_description: '', quantity: 1, unit_price: 0, reason: '' }] }); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  const viewDetail = async (id) => {
    try { const { data } = await api.get(`/returns/sales/${id}`); setSelected(data); setShowDetail(true); }
    catch { toast.error('فشل التحميل'); }
  };

  const approve = async (id) => {
    try { await api.patch(`/returns/sales/${id}/approve`); toast.success('تم اعتماد المرتجع'); load(); setShowDetail(false); }
    catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <PermissionGuard module="returns" action="create">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]"><Plus size={18} /> مرتجع مبيعات جديد</button>
        </PermissionGuard>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : returns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border"><RotateCcw size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">لا توجد مرتجعات مبيعات</p></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="p-3 text-right">الرقم</th><th className="p-3 text-right">العميل</th><th className="p-3 text-right">الفاتورة</th><th className="p-3 text-center">المبلغ</th><th className="p-3 text-center">الحالة</th><th className="p-3 text-center">إجراءات</th></tr></thead>
            <tbody className="divide-y">
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono font-bold">{r.return_number}</td>
                  <td className="p-3 text-gray-600">{r.customer_name || '-'}</td>
                  <td className="p-3 text-gray-600">{r.invoice_number || '-'}</td>
                  <td className="p-3 text-center font-bold">{Number(r.total_amount || 0).toLocaleString()}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span></td>
                  <td className="p-3 text-center">
                    <button onClick={() => viewDetail(r.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Eye size={16} /></button>
                    {r.status === 'pending' && can('returns', 'edit') && <button onClick={() => approve(r.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded ml-1"><CheckCircle size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination current={page} total={total} pageSize={25} onChange={setPage} />
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">مرتجع مبيعات جديد</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">العميل *</label><select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">—</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">سبب الإرجاع</label><input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2"><label className="text-sm font-bold">الأصناف</label><button onClick={addItem} className="text-xs text-[#c9a84c] hover:underline">+ إضافة</button></div>
                {form.items.map((it, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-center">
                    <input placeholder="الوصف" value={it.product_description} onChange={e => { const items = [...form.items]; items[i].product_description = e.target.value; setForm(f => ({ ...f, items })); }} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    <input type="number" placeholder="الكمية" value={it.quantity} onChange={e => { const items = [...form.items]; items[i].quantity = parseInt(e.target.value) || 0; setForm(f => ({ ...f, items })); }} className="w-20 border rounded-lg px-3 py-2 text-sm" />
                    <input type="number" placeholder="السعر" value={it.unit_price} onChange={e => { const items = [...form.items]; items[i].unit_price = parseFloat(e.target.value) || 0; setForm(f => ({ ...f, items })); }} className="w-24 border rounded-lg px-3 py-2 text-sm" />
                    {form.items.length > 1 && <button onClick={() => removeItem(i)} className="p-1 text-red-500"><X size={16} /></button>}
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

      {showDetail && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">{selected.return_number}</h2>
              <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[65vh]">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">العميل</p><p className="font-bold">{selected.customer_name}</p></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الحالة</p><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">المبلغ</p><p className="font-bold">{Number(selected.total_amount || 0).toLocaleString()}</p></div>
              </div>
              {selected.items?.length > 0 && (
                <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-right">الوصف</th><th className="p-2 text-center">الكمية</th><th className="p-2 text-center">السعر</th><th className="p-2 text-center">الإجمالي</th></tr></thead>
                  <tbody className="divide-y">{selected.items.map(it => (<tr key={it.id}><td className="p-2">{it.product_description}</td><td className="p-2 text-center">{it.quantity}</td><td className="p-2 text-center">{Number(it.unit_price).toLocaleString()}</td><td className="p-2 text-center font-bold">{Number(it.total_price).toLocaleString()}</td></tr>))}</tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PurchaseReturnsTab() {
  const toast = useToast();
  const { can } = useAuth();
  const [returns, setReturns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ supplier_id: '', reason: '', notes: '', items: [{ product_description: '', quantity: 1, unit_price: 0, reason: '' }] });

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/returns/purchases', { params: { page, limit: 25 } }); setReturns(data.data || []); setTotal(data.total || 0); }
    catch { toast.error('فشل التحميل'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => { api.get('/suppliers').then(r => setSuppliers(r.data?.data || r.data || [])).catch(() => {}); }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_description: '', quantity: 1, unit_price: 0, reason: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const save = async () => {
    try { await api.post('/returns/purchases', form); toast.success('تم إنشاء المرتجع'); setShowModal(false); setForm({ supplier_id: '', reason: '', notes: '', items: [{ product_description: '', quantity: 1, unit_price: 0, reason: '' }] }); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  const approve = async (id) => {
    try { await api.patch(`/returns/purchases/${id}/approve`); toast.success('تم الاعتماد'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <PermissionGuard module="returns" action="create">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]"><Plus size={18} /> مرتجع مشتريات جديد</button>
        </PermissionGuard>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : returns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border"><RotateCcw size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">لا توجد مرتجعات مشتريات</p></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="p-3 text-right">الرقم</th><th className="p-3 text-right">المورد</th><th className="p-3 text-right">أمر الشراء</th><th className="p-3 text-center">المبلغ</th><th className="p-3 text-center">الحالة</th><th className="p-3 text-center">إجراءات</th></tr></thead>
            <tbody className="divide-y">
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono font-bold">{r.return_number}</td>
                  <td className="p-3 text-gray-600">{r.supplier_name || '-'}</td>
                  <td className="p-3 text-gray-600">{r.po_number || '-'}</td>
                  <td className="p-3 text-center font-bold">{Number(r.total_amount || 0).toLocaleString()}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span></td>
                  <td className="p-3 text-center">
                    {r.status === 'pending' && can('returns', 'edit') && <button onClick={() => approve(r.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><CheckCircle size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination current={page} total={total} pageSize={25} onChange={setPage} />
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">مرتجع مشتريات جديد</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">المورد *</label><select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">—</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">السبب</label><input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2"><label className="text-sm font-bold">الأصناف</label><button onClick={addItem} className="text-xs text-[#c9a84c] hover:underline">+ إضافة</button></div>
                {form.items.map((it, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-center">
                    <input placeholder="الوصف" value={it.product_description} onChange={e => { const items = [...form.items]; items[i].product_description = e.target.value; setForm(f => ({ ...f, items })); }} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    <input type="number" placeholder="الكمية" value={it.quantity} onChange={e => { const items = [...form.items]; items[i].quantity = parseInt(e.target.value) || 0; setForm(f => ({ ...f, items })); }} className="w-20 border rounded-lg px-3 py-2 text-sm" />
                    <input type="number" placeholder="السعر" value={it.unit_price} onChange={e => { const items = [...form.items]; items[i].unit_price = parseFloat(e.target.value) || 0; setForm(f => ({ ...f, items })); }} className="w-24 border rounded-lg px-3 py-2 text-sm" />
                    {form.items.length > 1 && <button onClick={() => removeItem(i)} className="p-1 text-red-500"><X size={16} /></button>}
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
    </>
  );
}
