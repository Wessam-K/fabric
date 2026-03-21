import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Star, Phone, Mail, Building2, DollarSign, X } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const TYPE_MAP = { fabric: 'أقمشة', accessory: 'اكسسوارات', both: 'أقمشة واكسسوارات', other: 'أخرى' };

export default function Suppliers() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showPayment, setShowPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', reference: '', notes: '' });

  const emptyForm = { code: '', name: '', contact_name: '', phone: '', email: '', address: '', supplier_type: 'fabric', payment_terms: '', rating: 3, notes: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const { data } = await api.get('/suppliers', { params });
      setSuppliers(data);
    } catch { toast.error('فشل تحميل الموردين'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, typeFilter]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditId(s.id);
    setForm({ code: s.code, name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '', address: s.address || '', supplier_type: s.supplier_type || 'fabric', payment_terms: s.payment_terms || '', rating: s.rating, notes: s.notes || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { toast.error('الكود والاسم مطلوبان'); return; }
    try {
      if (editId) {
        await api.put(`/suppliers/${editId}`, form);
        toast.success('تم تحديث المورد');
      } else {
        await api.post('/suppliers', form);
        toast.success('تم إضافة المورد');
      }
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handlePayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { toast.error('أدخل مبلغ صحيح'); return; }
    try {
      await api.post(`/suppliers/${showPayment}/payments`, paymentForm);
      toast.success('تم تسجيل الدفعة');
      setShowPayment(null);
      setPaymentForm({ amount: '', payment_method: 'cash', reference: '', notes: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

  const totalBalance = suppliers.reduce((s, sup) => s + (sup.balance || 0), 0);

  return (
    <div className="page">
      <PageHeader title="الموردين" subtitle="إدارة الموردين والمدفوعات"
        action={<button onClick={openCreate} className="btn btn-gold"><Plus size={16} /> مورد جديد</button>} />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2"><Building2 size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{suppliers.length}</p>
          <p className="text-xs text-gray-400">مورد نشط</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 text-red-600 mb-2"><DollarSign size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{fmt(totalBalance)} ج</p>
          <p className="text-xs text-gray-400">إجمالي المستحقات</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            className="w-full pr-9 pl-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] outline-none" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {suppliers.length === 0 ? (
            <div className="text-center py-16 text-gray-400">لا يوجد موردون</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">الكود</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">الاسم</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">النوع</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">التقييم</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الهاتف</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">المستحقات</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{s.code}</td>
                    <td className="px-4 py-3">
                      <Link to={`/suppliers/${s.id}`} className="font-bold text-[#1a1a2e] hover:text-[#c9a84c] transition-colors">{s.name}</Link>
                      {s.contact_name && <span className="text-xs text-gray-400 mr-2">• {s.contact_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-center"><span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded">{TYPE_MAP[s.supplier_type]}</span></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {[1,2,3,4,5].map(n => <Star key={n} size={12} className={n <= s.rating ? 'text-[#c9a84c] fill-[#c9a84c]' : 'text-gray-200'} />)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono font-bold text-sm ${s.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>{fmt(s.balance)} ج</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(s)} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">تعديل</button>
                        {s.balance > 0 && (
                          <button onClick={() => setShowPayment(s.id)} className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 rounded text-green-700">دفع</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e]">{editId ? 'تعديل مورد' : 'مورد جديد'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">الكود *</label>
                <input type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})} readOnly={!!editId}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none ${editId ? 'bg-gray-50' : ''}`} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">الاسم *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">شخص التواصل</label>
                <input type="text" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">النوع</label>
                <select value={form.supplier_type} onChange={e => setForm({...form, supplier_type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                  {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">الهاتف</label>
                <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">البريد</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">العنوان</label>
              <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">شروط الدفع</label>
                <input type="text" value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})} placeholder="مثال: صافي 30 يوم"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">التقييم</label>
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setForm({...form, rating: n})}>
                      <Star size={20} className={n <= form.rating ? 'text-[#c9a84c] fill-[#c9a84c]' : 'text-gray-200'} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ملاحظات</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleSave} className="px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPayment(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e]">تسجيل دفعة</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">المبلغ *</label>
              <input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">طريقة الدفع</label>
              <select value={paymentForm.payment_method} onChange={e => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                <option value="cash">نقدي</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="check">شيك</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">المرجع</label>
              <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" placeholder="رقم الشيك / التحويل..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPayment(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handlePayment} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold">تسجيل الدفعة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
