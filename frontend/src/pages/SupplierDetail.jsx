import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Phone, Mail, MapPin, DollarSign, ShoppingCart, Star, Truck, CreditCard } from 'lucide-react';
import { PageHeader, LoadingState, Tabs } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [supplier, setSupplier] = useState(null);
  const [pos, setPOs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const load = async () => {
      try {
        const suppRes = await api.get('/suppliers');
        const s = suppRes.data.find(x => x.id === parseInt(id));
        if (!s) { toast.error('المورد غير موجود'); navigate('/suppliers'); return; }
        setSupplier(s);
        try {
          const poRes = await api.get('/purchase-orders', { params: { supplier_id: id } });
          setPOs(Array.isArray(poRes.data) ? poRes.data : poRes.data.data || []);
        } catch {}
      } catch { toast.error('فشل تحميل البيانات'); navigate('/suppliers'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG') : '—';

  const TYPE_MAP = { fabric: 'أقمشة', accessory: 'اكسسوارات', both: 'أقمشة واكسسوارات', other: 'أخرى' };
  const PO_STATUS = { draft: 'مسودة', sent: 'مُرسل', partial: 'جزئي', received: 'مُستلم', cancelled: 'ملغي' };
  const PO_COLORS = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', partial: 'bg-yellow-100 text-yellow-700', received: 'bg-green-100 text-green-700', cancelled: 'bg-gray-200 text-gray-500' };

  if (loading) return <LoadingState />;
  if (!supplier) return null;

  const supplierPOs = pos.filter(po => po.supplier_id === parseInt(id));

  return (
    <div className="page">
      <PageHeader title={supplier.name} subtitle={`كود: ${supplier.code} — ${TYPE_MAP[supplier.supplier_type] || supplier.supplier_type}`}
        action={<button onClick={() => navigate('/suppliers')} className="btn btn-outline btn-sm"><ArrowRight size={14} /> الموردين</button>} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2"><ShoppingCart size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{supplier.total_orders || supplierPOs.length}</p>
          <p className="text-xs text-gray-400">أوامر شراء</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 text-green-600 mb-2"><DollarSign size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(supplier.total_paid || 0)} ج</p>
          <p className="text-xs text-gray-400">إجمالي المدفوع</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 text-red-600 mb-2"><CreditCard size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(supplier.balance || 0)} ج</p>
          <p className="text-xs text-gray-400">الرصيد المستحق</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-yellow-50 text-yellow-600 mb-2"><Star size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{'★'.repeat(supplier.rating || 0)}{'☆'.repeat(5 - (supplier.rating || 0))}</p>
          <p className="text-xs text-gray-400">التقييم</p>
        </div>
      </div>

      <Tabs tabs={[
        { value: 'overview', label: 'نظرة عامة' },
        { value: 'orders', label: 'أوامر الشراء', count: supplierPOs.length },
      ]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="card">
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase">معلومات الاتصال</h4>
              {supplier.contact_name && <p className="text-sm">جهة الاتصال: <span className="font-semibold">{supplier.contact_name}</span></p>}
              {supplier.phone && <p className="flex items-center gap-2 text-sm"><Phone size={14} className="text-gray-400" /> {supplier.phone}</p>}
              {supplier.email && <p className="flex items-center gap-2 text-sm"><Mail size={14} className="text-gray-400" /> {supplier.email}</p>}
              {supplier.address && <p className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-gray-400" /> {supplier.address}</p>}
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase">بيانات تجارية</h4>
              <p className="text-sm">النوع: <span className="font-semibold">{TYPE_MAP[supplier.supplier_type] || supplier.supplier_type}</span></p>
              {supplier.payment_terms && <p className="text-sm">شروط الدفع: {supplier.payment_terms}</p>}
              <p className="text-sm">التقييم: <span className="text-yellow-500">{'★'.repeat(supplier.rating || 0)}</span></p>
            </div>
            {supplier.notes && (
              <div className="md:col-span-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">ملاحظات</h4>
                <p className="text-sm text-gray-600">{supplier.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {supplierPOs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">لا توجد أوامر شراء</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>رقم الأمر</th><th>التاريخ</th><th>الإجمالي</th><th>الحالة</th><th>الموعد المتوقع</th></tr></thead>
                <tbody>
                  {supplierPOs.map(po => (
                    <tr key={po.id}>
                      <td className="font-mono text-xs">{po.po_number}</td>
                      <td className="text-xs">{fmtDate(po.created_at)}</td>
                      <td className="font-mono">{fmt(po.total)} ج</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PO_COLORS[po.status] || ''}`}>{PO_STATUS[po.status] || po.status}</span></td>
                      <td className="text-xs">{fmtDate(po.expected_date)}</td>
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
