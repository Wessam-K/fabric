import { useState, useEffect } from 'react';
import { Plus, Search, ShoppingCart, Clock, CheckCircle, DollarSign, Package, Download } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import HelpButton from '../components/HelpButton';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import { exportFromBackend } from '../utils/exportUtils';

const STATUS_MAP = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600' },
  sent: { label: 'مُرسل', color: 'bg-blue-100 text-blue-700' },
  partial: { label: 'استلام جزئي', color: 'bg-amber-100 text-amber-700' },
  received: { label: 'مُستلم', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
};

const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

export default function PurchaseOrders() {
  const toast = useToast();
  const { can } = useAuth();
  const [orders, setOrders] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [accessories, setAccessories] = useState([]);

  const emptyItem = { item_type: 'fabric', item_code: '', description: '', quantity: '', unit_price: '' };
  const [form, setForm] = useState({ po_number: '', supplier_id: '', tax_pct: '0', discount: '0', expected_date: '', notes: '', items: [{ ...emptyItem }] });
  const [defaultTax, setDefaultTax] = useState('0');

  // Receive workflow
  const [showReceive, setShowReceive] = useState(null);
  const [receiveItems, setReceiveItems] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/purchase-orders', { params });
      setOrders(data.orders);
      setTotals(data.totals);
    } catch { toast.error('فشل تحميل أوامر الشراء'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter]);
  useEffect(() => { api.get('/settings').then(r => { const t = r.data?.tax_rate; if (t) setDefaultTax(String(t)); }).catch(() => {}); }, []);

  const openCreate = async () => {
    try {
      const [supRes, nextRes, fabRes, accRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/purchase-orders/next-number'),
        api.get('/fabrics'),
        api.get('/accessories'),
      ]);
      setSuppliers(supRes.data);
      setFabrics(fabRes.data);
      setAccessories(accRes.data);
      setForm({ po_number: nextRes.data.next_number, supplier_id: '', tax_pct: defaultTax, discount: '0', expected_date: '', notes: '', items: [{ ...emptyItem }] });
      setShowCreate(true);
    } catch { toast.error('فشل تحميل البيانات'); }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: val };
      if (field === 'item_code') {
        const list = items[i].item_type === 'fabric' ? fabrics : accessories;
        const found = list.find(x => x.code === val);
        if (found) {
          items[i].description = found.name;
          items[i].unit_price = items[i].item_type === 'fabric' ? found.price_per_m : found.unit_price;
        }
      }
      return { ...f, items };
    });
  };

  const formSubtotal = form.items.reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
  const formDiscount = parseFloat(form.discount) || 0;
  const formTax = (formSubtotal - formDiscount) * ((parseFloat(form.tax_pct) || 0) / 100);
  const formTotal = formSubtotal - formDiscount + formTax;

  const handleCreate = async () => {
    if (!form.po_number || !form.supplier_id) { toast.error('رقم الأمر والمورد مطلوبان'); return; }
    try {
      await api.post('/purchase-orders', form);
      toast.success('تم إنشاء أمر الشراء');
      setShowCreate(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/purchase-orders/${id}/status`, { status });
      toast.success('تم تحديث الحالة');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const openReceive = async (poId) => {
    try {
      const { data } = await api.get(`/purchase-orders/${poId}`);
      setShowReceive(data);
      setReceiveItems((data.items || []).map(item => ({
        item_id: item.id,
        description: item.fabric_name || item.accessory_name || item.description || '',
        item_type: item.item_type,
        ordered_qty: item.quantity,
        already_received: item.received_qty_actual || 0,
        received_qty: '',
      })));
    } catch { toast.error('فشل تحميل بيانات أمر الشراء'); }
  };

  const handleReceive = async () => {
    if (!showReceive) return;
    const items = receiveItems.filter(i => parseFloat(i.received_qty) > 0).map(i => ({
      item_id: i.item_id,
      received_qty: parseFloat(i.received_qty),
      variance_notes: i.variance_notes || null,
    }));
    if (items.length === 0) { toast.error('أدخل كمية مستلمة لعنصر واحد على الأقل'); return; }
    try {
      await api.patch(`/purchase-orders/${showReceive.id}/receive`, { items });
      const totalVariance = receiveItems.reduce((s, r) => {
        const recvd = parseFloat(r.received_qty) || 0;
        const remain = r.ordered_qty - r.already_received;
        return s + (remain - recvd);
      }, 0);
      toast.success(`تم تسجيل الاستلام${totalVariance !== 0 ? ` • فرق: ${totalVariance > 0 ? '+' : ''}${totalVariance}` : ''}`);
      setShowReceive(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  return (
    <div className="page">
      <PageHeader title="أوامر الشراء" subtitle="إدارة مشتريات الخامات والاكسسوارات"
        action={<div className="flex items-center gap-2">
          <HelpButton pageKey="purchaseorders" />
          <button onClick={() => exportFromBackend('/purchase-orders/export', 'purchase-orders').catch(() => {})} className="btn btn-secondary text-xs"><Download size={14} /> تصدير</button>
          <PermissionGuard module="purchase_orders" action="create">
            <button onClick={openCreate} className="btn btn-gold"><Plus size={16} /> أمر شراء جديد</button>
          </PermissionGuard>
        </div>} />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2"><ShoppingCart size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{totals.total || 0}</p>
          <p className="text-xs text-gray-400">إجمالي الأوامر</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 mb-2"><Clock size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{fmt(totals.pending_total)} ج</p>
          <p className="text-xs text-gray-400">مبلغ معلق</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 text-green-600 mb-2"><CheckCircle size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{fmt(totals.received_total)} ج</p>
          <p className="text-xs text-gray-400">مبلغ مُستلم</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 text-gray-600 mb-2"><DollarSign size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{fmt(totals.draft_total)} ج</p>
          <p className="text-xs text-gray-400">مسودات</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            className="w-full pr-9 pl-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">لا توجد أوامر شراء</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">الرقم</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">المورد</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الحالة</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الإجمالي</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">التوصيل المتوقع</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">التاريخ</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(po => (
                  <tr key={po.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{po.po_number}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#1a1a2e]">{po.supplier_name}</span>
                      <span className="text-xs text-gray-400 mr-2">{po.supplier_code}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-1 rounded-full ${STATUS_MAP[po.status]?.color}`}>{STATUS_MAP[po.status]?.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-[#c9a84c]">{fmt(po.total_amount)} ج</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">{po.expected_date ? new Date(po.expected_date).toLocaleDateString('ar-EG') : '—'}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">{new Date(po.created_at).toLocaleDateString('ar-EG')}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {can('purchase_orders', 'edit') && po.status === 'draft' && <button onClick={() => updateStatus(po.id, 'sent')} className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded">إرسال</button>}
                        {can('purchase_orders', 'edit') && (po.status === 'sent' || po.status === 'partial') && <button onClick={() => openReceive(po.id)} className="text-[10px] px-2 py-1 bg-green-50 text-green-700 rounded flex items-center gap-1"><Package size={10} /> استلام</button>}
                        {can('purchase_orders', 'edit') && ['draft','sent'].includes(po.status) && <button onClick={() => updateStatus(po.id, 'cancelled')} className="text-[10px] px-2 py-1 bg-red-50 text-red-700 rounded">إلغاء</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e]">أمر شراء جديد</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">رقم الأمر *</label>
                <input type="text" value={form.po_number} onChange={e => setForm({...form, po_number: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">المورد *</label>
                <select value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                  <option value="">اختر المورد</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ضريبة %</label>
                <input type="number" value={form.tax_pct} onChange={e => setForm({...form, tax_pct: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">خصم (ج)</label>
                <input type="number" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">تاريخ التوصيل</label>
                <input type="date" value={form.expected_date} onChange={e => setForm({...form, expected_date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
            </div>

            {/* Items */}
            <div>
              <h4 className="text-sm font-bold text-[#1a1a2e] mb-2">البنود</h4>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <select value={item.item_type} onChange={e => updateItem(i, 'item_type', e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-20">
                      <option value="fabric">قماش</option>
                      <option value="accessory">اكسسوار</option>
                    </select>
                    <select value={item.item_code} onChange={e => updateItem(i, 'item_code', e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs flex-1">
                      <option value="">اختر...</option>
                      {(item.item_type === 'fabric' ? fabrics : accessories).map(x => (
                        <option key={x.code} value={x.code}>[{x.code}] {x.name}</option>
                      ))}
                    </select>
                    <input type="number" min="0" placeholder="الكمية" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-20 font-mono text-center" />
                    <input type="number" min="0" step="0.01" placeholder="السعر" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-20 font-mono text-center" />
                    <span className="text-xs font-mono font-bold text-[#c9a84c] w-20 text-center">{fmt((parseFloat(item.quantity)||0) * (parseFloat(item.unit_price)||0))}</span>
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addItem} className="mt-2 text-xs text-[#c9a84c] hover:text-[#a88a3a]">+ إضافة بند</button>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">المجموع الفرعي:</span><span className="font-mono">{fmt(formSubtotal)} ج</span></div>
              <div className="flex justify-between"><span className="text-gray-500">الضريبة:</span><span className="font-mono">{fmt(formTax)} ج</span></div>
              <div className="flex justify-between"><span className="text-gray-500">الخصم:</span><span className="font-mono">-{fmt(parseFloat(form.discount) || 0)} ج</span></div>
              <hr />
              <div className="flex justify-between font-bold"><span>الإجمالي:</span><span className="font-mono text-[#c9a84c]">{fmt(formTotal)} ج</span></div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleCreate} className="px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold">إنشاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceive && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowReceive(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e]">استلام بنود — {showReceive.po_number}</h3>
            <p className="text-xs text-gray-400">أدخل الكمية المستلمة لكل بند. سيتم إنشاء دفعات مخزون تلقائياً للأقمشة.</p>
            <div className="space-y-2">
              {receiveItems.map((item, i) => {
                const remaining = item.ordered_qty - item.already_received;
                const recvd = parseFloat(item.received_qty) || 0;
                const variance = recvd > 0 ? recvd - remaining : 0;
                return (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded ${item.item_type === 'fabric' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {item.item_type === 'fabric' ? 'قماش' : 'اكسسوار'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{item.description}</p>
                        <p className="text-[10px] text-gray-400">مطلوب: {item.ordered_qty} | مستلم سابقاً: {item.already_received} | متبقي: {remaining}</p>
                      </div>
                      <input type="number" min="0" step="0.01" placeholder="0"
                        value={item.received_qty}
                        onChange={e => setReceiveItems(prev => prev.map((r, idx) => idx === i ? { ...r, received_qty: e.target.value } : r))}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
                    </div>
                    {recvd > 0 && variance !== 0 && (
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          فرق: {variance > 0 ? '+' : ''}{variance} {item.item_type === 'fabric' ? 'م' : 'قطعة'}
                        </span>
                        <input type="text" placeholder="ملاحظات الفرق..."
                          value={item.variance_notes || ''}
                          onChange={e => setReceiveItems(prev => prev.map((r, idx) => idx === i ? { ...r, variance_notes: e.target.value } : r))}
                          className="flex-1 border border-gray-200 rounded px-2 py-1 text-[10px]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReceive(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleReceive} className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"><Package size={14} /> تأكيد الاستلام</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
