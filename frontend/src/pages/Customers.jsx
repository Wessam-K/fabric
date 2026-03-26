import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, DollarSign, X, FileText, Users } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import ExportButton from '../components/ExportButton';
import HelpButton from '../components/HelpButton';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';

export default function Customers() {
  const toast = useToast();
  const { can } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);

  const emptyForm = { name: '', phone: '', email: '', address: '', city: '', tax_number: '', credit_limit: '', notes: '', customer_type: 'retail', contact_name: '', payment_terms: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (search) params.search = search;
      if (cityFilter) params.city = cityFilter;
      const { data } = await api.get('/customers', { params });
      const list = data.customers || data;
      setCustomers(Array.isArray(list) ? list : []);
      setTotal(data.total ?? (Array.isArray(list) ? list.length : 0));
    } catch { toast.error('فشل تحميل العملاء'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, cityFilter, page, pageSize]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditId(c.id);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', city: c.city || '', tax_number: c.tax_number || '', credit_limit: c.credit_limit || '', notes: c.notes || '', customer_type: c.customer_type || 'retail', contact_name: c.contact_name || '', payment_terms: c.payment_terms || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('اسم العميل مطلوب'); return; }
    try {
      if (editId) {
        await api.patch(`/customers/${editId}`, form);
        toast.success('تم تحديث العميل');
      } else {
        await api.post('/customers', form);
        toast.success('تم إضافة العميل');
      }
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const viewInvoices = async (c) => {
    setSelectedCustomer(c);
    try {
      const { data } = await api.get(`/customers/${c.id}/invoices`);
      setCustomerInvoices(data);
    } catch { toast.error('فشل تحميل الفواتير'); }
  };

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

  const cities = [...new Set(customers.map(c => c.city).filter(Boolean))];
  const totalOutstanding = customers.reduce((s, c) => s + (c.balance || 0), 0);

  return (
    <div className="page">
      <PageHeader title="العملاء" subtitle="إدارة العملاء والمستحقات"
        action={<div className="flex items-center gap-2">
          <HelpButton pageKey="customers" />
          <ExportButton data={customers} filename="customers" columns={[{key:'code',label:'الكود'},{key:'name',label:'الاسم'},{key:'customer_type',label:'النوع'},{key:'city',label:'المدينة'},{key:'phone',label:'الهاتف'},{key:'balance',label:'الرصيد'}]} />
          <PermissionGuard module="customers" action="create">
            <button onClick={openCreate} className="btn btn-gold"><Plus size={16} /> عميل جديد</button>
          </PermissionGuard>
        </div>} />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2"><Users size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{customers.length}</p>
          <p className="text-xs text-gray-400">عميل نشط</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 text-red-600 mb-2"><DollarSign size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{fmt(totalOutstanding)} ج.م</p>
          <p className="text-xs text-gray-400">إجمالي المستحقات</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 text-green-600 mb-2"><FileText size={18} /></div>
          <p className="text-2xl font-bold font-mono text-[#1a1a2e]">{cities.length}</p>
          <p className="text-xs text-gray-400">مدن</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود أو الهاتف..."
            className="w-full pr-9 pl-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] outline-none" />
        </div>
        {cities.length > 0 && (
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
            className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
            <option value="">كل المدن</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {customers.length === 0 ? (
            <div className="text-center py-16 text-gray-400">لا يوجد عملاء</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">الكود</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">الاسم</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">النوع</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">المدينة</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الهاتف</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الحد الائتماني</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الرصيد</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{c.code}</td>
                    <td className="px-4 py-3">
                      <Link to={`/customers/${c.id}`} className="font-bold text-[#1a1a2e] hover:text-[#c9a84c] transition-colors">{c.name}</Link>
                      {c.contact_name && <span className="text-xs text-gray-400 mr-2">• {c.contact_name}</span>}
                      {c.email && <span className="text-xs text-gray-400 mr-2">• {c.email}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.customer_type === 'wholesale' ? 'bg-blue-100 text-blue-700' : c.customer_type === 'corporate' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.customer_type === 'wholesale' ? 'جملة' : c.customer_type === 'corporate' ? 'شركات' : 'تجزئة'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{c.city || '—'}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{c.credit_limit ? `${fmt(c.credit_limit)} ج.م` : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono font-bold text-sm ${(c.balance || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>{fmt(c.balance)} ج.م</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {can('customers', 'edit') && <button onClick={() => openEdit(c)} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">تعديل</button>}
                        <button onClick={() => viewInvoices(c)} className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded text-blue-700">فواتير</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Pagination total={total} page={page} pageSize={pageSize} onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }} />

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e]">{editId ? 'تعديل عميل' : 'عميل جديد'}</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">الاسم *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">نوع العميل</label>
                <select value={form.customer_type} onChange={e => setForm({...form, customer_type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                  <option value="retail">تجزئة</option>
                  <option value="wholesale">جملة</option>
                  <option value="corporate">شركات</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">جهة الاتصال</label>
                <input type="text" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">المدينة</label>
                <input type="text" value={form.city} onChange={e => setForm({...form, city: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">الرقم الضريبي</label>
                <input type="text" value={form.tax_number} onChange={e => setForm({...form, tax_number: e.target.value})}
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
                <label className="block text-xs text-gray-500 mb-1">الحد الائتماني (ج.م)</label>
                <input type="number" min="0" step="100" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">شروط الدفع</label>
                <input type="text" value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})} placeholder="مثال: 30 يوم"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
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

      {/* Customer Invoices Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1a1a2e]">فواتير {selectedCustomer.name}</h3>
              <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {customerInvoices.length === 0 ? (
              <p className="text-center py-8 text-gray-400">لا توجد فواتير</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">رقم الفاتورة</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500">الحالة</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500">المبلغ</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500">المدفوع</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {customerInvoices.map(inv => (
                    <tr key={inv.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs font-bold">{inv.invoice_number}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                          inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                          inv.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>{inv.status === 'paid' ? 'مدفوعة' : inv.status === 'sent' ? 'مرسلة' : inv.status === 'overdue' ? 'متأخرة' : 'مسودة'}</span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs">{fmt(inv.total)} ج.م</td>
                      <td className="px-3 py-2 text-center font-mono text-xs">{fmt(inv.paid_amount)} ج.م</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-400">{inv.created_at ? new Date(inv.created_at).toLocaleDateString('ar-EG') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
