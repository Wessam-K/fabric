import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Phone, Mail, MapPin, DollarSign, FileText, CreditCard, Clock, Plus, User, MessageSquare, Activity } from 'lucide-react';
import { PageHeader, LoadingState, Tabs } from '../components/ui';
import api from '../utils/api';
import { fmtDateTime } from '../utils/formatters';
import { useToast } from '../components/Toast';
import HelpButton from '../components/HelpButton';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [timeline, setTimeline] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newContact, setNewContact] = useState({ name: '', title: '', phone: '', email: '', is_primary: 0 });
  const [newNote, setNewNote] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [custRes, invRes, payRes] = await Promise.all([
          api.get(`/customers/${id}`),
          api.get(`/customers/${id}/invoices`),
          api.get(`/customers/${id}/payments`),
        ]);
        setCustomer(custRes.data);
        setInvoices(invRes.data.invoices || invRes.data);
        setPayments(payRes.data.payments || []);
      } catch { toast.error('فشل تحميل بيانات العميل'); navigate('/customers'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const loadTimeline = useCallback(async () => {
    try { const { data } = await api.get(`/customers/${id}/timeline`); setTimeline(data || []); } catch {}
  }, [id]);

  const loadContacts = useCallback(async () => {
    try { const { data } = await api.get(`/customers/${id}/contacts`); setContacts(data || []); } catch {}
  }, [id]);

  const loadNotes = useCallback(async () => {
    try { const { data } = await api.get(`/customers/${id}/notes`); setNotes(data || []); } catch {}
  }, [id]);

  useEffect(() => {
    if (tab === 'timeline') loadTimeline();
    if (tab === 'contacts') loadContacts();
    if (tab === 'notes') loadNotes();
  }, [tab, loadTimeline, loadContacts, loadNotes]);

  const addContact = async () => {
    if (!newContact.name.trim()) { toast.error('اسم جهة الاتصال مطلوب'); return; }
    try {
      await api.post(`/customers/${id}/contacts`, newContact);
      toast.success('تمت إضافة جهة الاتصال');
      setNewContact({ name: '', title: '', phone: '', email: '', is_primary: 0 });
      setShowContactForm(false);
      loadContacts();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await api.post(`/customers/${id}/notes`, { note: newNote });
      toast.success('تمت إضافة الملاحظة');
      setNewNote('');
      loadNotes();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');
  const fmtDate = (d) => fmtDateTime(d);

  const STATUS_LABELS = { draft: 'مسودة', sent: 'مُرسلة', paid: 'مدفوعة', overdue: 'متأخرة', cancelled: 'ملغاة' };
  const STATUS_COLORS = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700', cancelled: 'bg-gray-200 text-gray-500' };

  // AR Aging buckets
  const ageBuckets = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((acc, inv) => {
    const dueDate = inv.due_date || inv.created_at;
    const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
    const bucket = days <= 0 ? 'current' : days <= 30 ? '1_30' : days <= 60 ? '31_60' : days <= 90 ? '61_90' : '90plus';
    acc[bucket] = (acc[bucket] || 0) + (inv.total || 0);
    return acc;
  }, {});

  if (loading) return <LoadingState />;
  if (!customer) return null;

  return (
    <div className="page">
      <PageHeader title={customer.name} subtitle={`كود: ${customer.code || '—'} — ${customer.city || 'بدون مدينة'}`}
        action={<div className="flex items-center gap-2"><HelpButton pageKey="customerdetail" /><button onClick={() => navigate('/customers')} className="btn btn-outline btn-sm"><ArrowRight size={14} /> العملاء</button></div>} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2"><FileText size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{customer.invoice_count || 0}</p>
          <p className="text-xs text-gray-400">فواتير</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 text-green-600 mb-2"><DollarSign size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(customer.total_invoiced)} ج</p>
          <p className="text-xs text-gray-400">إجمالي الفواتير</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 mb-2"><CreditCard size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(customer.total_paid)} ج</p>
          <p className="text-xs text-gray-400">إجمالي المدفوع</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 text-red-600 mb-2"><Clock size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(customer.outstanding)} ج</p>
          <p className="text-xs text-gray-400">المستحق</p>
        </div>
      </div>

      <Tabs tabs={[
        { value: 'overview', label: 'نظرة عامة' },
        { value: 'invoices', label: 'الفواتير', count: invoices.length },
        { value: 'payments', label: 'المدفوعات', count: payments.length },
        { value: 'aging', label: 'أعمار الديون' },
        { value: 'timeline', label: 'السجل' },
        { value: 'contacts', label: 'جهات الاتصال' },
        { value: 'notes', label: 'الملاحظات' },
      ]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="card">
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase">معلومات الاتصال</h4>
              {customer.phone && <p className="flex items-center gap-2 text-sm"><Phone size={14} className="text-gray-400" /> {customer.phone}</p>}
              {customer.email && <p className="flex items-center gap-2 text-sm"><Mail size={14} className="text-gray-400" /> {customer.email}</p>}
              {customer.address && <p className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-gray-400" /> {customer.address}</p>}
              {customer.contact_name && <p className="text-sm text-gray-600">جهة الاتصال: {customer.contact_name}</p>}
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase">بيانات مالية</h4>
              <p className="text-sm">نوع العميل: <span className="font-semibold">{customer.customer_type === 'wholesale' ? 'جملة' : 'تجزئة'}</span></p>
              {customer.credit_limit > 0 && <p className="text-sm">حد الائتمان: <span className="font-mono font-semibold">{fmt(customer.credit_limit)} ج</span></p>}
              {customer.payment_terms && <p className="text-sm">شروط الدفع: {customer.payment_terms}</p>}
              {customer.tax_number && <p className="text-sm">الرقم الضريبي: <span className="font-mono">{customer.tax_number}</span></p>}
            </div>
            {customer.notes && (
              <div className="md:col-span-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">ملاحظات</h4>
                <p className="text-sm text-gray-600">{customer.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-gray-400">لا توجد فواتير</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>الإجمالي</th><th>الحالة</th><th>الاستحقاق</th></tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}/view`)} className="cursor-pointer">
                      <td className="font-mono text-xs">{inv.invoice_number}</td>
                      <td className="text-xs">{fmtDate(inv.created_at)}</td>
                      <td className="font-mono">{fmt(inv.total)} ج</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[inv.status] || ''}`}>{STATUS_LABELS[inv.status] || inv.status}</span></td>
                      <td className="text-xs">{fmtDate(inv.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">لا توجد مدفوعات</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>الفاتورة</th><th>ملاحظات</th></tr></thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td className="text-xs">{fmtDate(p.payment_date || p.created_at)}</td>
                      <td className="font-mono text-green-600">{fmt(p.amount)} ج</td>
                      <td className="text-xs">{{ cash: 'نقدي', bank: 'تحويل', check: 'شيك', other: 'أخرى' }[p.payment_method] || p.payment_method}</td>
                      <td className="font-mono text-xs">{p.invoice_number || '—'}</td>
                      <td className="text-xs text-gray-500">{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'aging' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { key: 'current', label: 'حالي', color: 'bg-green-50 text-green-700' },
              { key: '1_30', label: '1-30 يوم', color: 'bg-blue-50 text-blue-700' },
              { key: '31_60', label: '31-60 يوم', color: 'bg-yellow-50 text-yellow-700' },
              { key: '61_90', label: '61-90 يوم', color: 'bg-orange-50 text-orange-700' },
              { key: '90plus', label: '90+ يوم', color: 'bg-red-50 text-red-700' },
            ].map(b => (
              <div key={b.key} className={`rounded-xl p-4 ${b.color}`}>
                <p className="text-xs font-semibold mb-1">{b.label}</p>
                <p className="text-lg font-bold font-mono">{fmt(ageBuckets[b.key] || 0)} ج</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="card">
          <div className="card-body">
            {timeline.length === 0 ? (
              <div className="text-center py-8 text-gray-400"><Activity size={32} className="mx-auto mb-2 text-gray-300" />لا يوجد سجل نشاط</div>
            ) : (
              <div className="space-y-3">
                {timeline.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      ev.type === 'invoice' ? 'bg-blue-50 text-blue-600' :
                      ev.type === 'payment' ? 'bg-green-50 text-green-600' :
                      ev.type === 'work_order' ? 'bg-amber-50 text-amber-600' :
                      ev.type === 'note' ? 'bg-purple-50 text-purple-600' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {ev.type === 'invoice' ? <FileText size={14} /> : ev.type === 'payment' ? <CreditCard size={14} /> : <Activity size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{ev.description || ev.title || ev.type}</p>
                      {ev.amount != null && <p className="text-xs font-mono text-gray-500">{fmt(ev.amount)} ج</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(ev.date || ev.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowContactForm(!showContactForm)} className="btn btn-gold btn-sm"><Plus size={14} /> جهة اتصال</button>
          </div>
          {showContactForm && (
            <div className="card">
              <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={newContact.name} onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))} placeholder="الاسم *" className="border rounded-lg px-3 py-2 text-sm" />
                <input value={newContact.title} onChange={e => setNewContact(c => ({ ...c, title: e.target.value }))} placeholder="المسمى الوظيفي" className="border rounded-lg px-3 py-2 text-sm" />
                <input value={newContact.phone} onChange={e => setNewContact(c => ({ ...c, phone: e.target.value }))} placeholder="الهاتف" className="border rounded-lg px-3 py-2 text-sm" />
                <input value={newContact.email} onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))} placeholder="البريد الإلكتروني" className="border rounded-lg px-3 py-2 text-sm" />
                <label className="flex items-center gap-2 text-sm col-span-full">
                  <input type="checkbox" checked={newContact.is_primary === 1} onChange={e => setNewContact(c => ({ ...c, is_primary: e.target.checked ? 1 : 0 }))} />
                  جهة اتصال رئيسية
                </label>
                <div className="col-span-full flex justify-end gap-2">
                  <button onClick={() => setShowContactForm(false)} className="btn btn-outline btn-sm">إلغاء</button>
                  <button onClick={addContact} className="btn btn-gold btn-sm">حفظ</button>
                </div>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-400"><User size={32} className="mx-auto mb-2 text-gray-300" />لا توجد جهات اتصال</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>الاسم</th><th>المسمى</th><th>الهاتف</th><th>البريد</th><th>رئيسي</th><th></th></tr></thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.id}>
                        <td className="text-sm font-semibold">{c.name}</td>
                        <td className="text-xs text-gray-500">{c.title || '—'}</td>
                        <td className="text-xs font-mono">{c.phone || '—'}</td>
                        <td className="text-xs">{c.email || '—'}</td>
                        <td>{c.is_primary ? <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5">رئيسي</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-body">
              <div className="flex gap-2">
                <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="أضف ملاحظة..."
                  className="flex-1 border rounded-lg px-3 py-2 text-sm" rows={2} />
                <button onClick={addNote} className="btn btn-gold btn-sm self-end"><Plus size={14} /> إضافة</button>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-gray-400"><MessageSquare size={32} className="mx-auto mb-2 text-gray-300" />لا توجد ملاحظات</div>
              ) : (
                <div className="space-y-3">
                  {notes.map(n => (
                    <div key={n.id} className="p-3 rounded-lg bg-gray-50">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.note}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{n.created_by_name || '—'} · {fmtDate(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
