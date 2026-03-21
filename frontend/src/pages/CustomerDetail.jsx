import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Phone, Mail, MapPin, DollarSign, FileText, CreditCard, Clock } from 'lucide-react';
import { PageHeader, LoadingState, Tabs } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

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

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG') : '—';

  const STATUS_LABELS = { draft: 'مسودة', sent: 'مُرسلة', paid: 'مدفوعة', overdue: 'متأخرة', cancelled: 'ملغاة' };
  const STATUS_COLORS = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700', cancelled: 'bg-gray-200 text-gray-500' };

  // AR Aging buckets
  const ageBuckets = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((acc, inv) => {
    const days = Math.floor((Date.now() - new Date(inv.created_at).getTime()) / 86400000);
    const bucket = days <= 0 ? 'current' : days <= 30 ? '1_30' : days <= 60 ? '31_60' : days <= 90 ? '61_90' : '90plus';
    acc[bucket] = (acc[bucket] || 0) + (inv.total || 0);
    return acc;
  }, {});

  if (loading) return <LoadingState />;
  if (!customer) return null;

  return (
    <div className="page">
      <PageHeader title={customer.name} subtitle={`كود: ${customer.code || '—'} — ${customer.city || 'بدون مدينة'}`}
        action={<button onClick={() => navigate('/customers')} className="btn btn-outline btn-sm"><ArrowRight size={14} /> العملاء</button>} />

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
    </div>
  );
}
