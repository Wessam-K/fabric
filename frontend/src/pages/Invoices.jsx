import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, DollarSign, Clock, CheckCircle, AlertTriangle, Send, X, Eye, Pencil, Trash2, Download, Filter } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/Toast';

const STATUS_MAP = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600', icon: FileText },
  sent: { label: 'مُرسلة', color: 'bg-blue-100 text-blue-700', icon: Send },
  paid: { label: 'مدفوعة', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'متأخرة', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  cancelled: { label: 'ملغاة', color: 'bg-gray-100 text-gray-400', icon: X },
};

const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG', { minimumFractionDigits: 2 });

export default function Invoices() {
  const navigate = useNavigate();
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const { data } = await axios.get('/api/invoices', { params });
      setInvoices(data.invoices);
      setTotals(data.totals);
    } catch { toast.error('فشل تحميل الفواتير'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter, dateFrom, dateTo]);

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`/api/invoices/${id}/status`, { status });
      toast.success('تم تحديث الحالة');
      load();
    } catch { toast.error('فشل التحديث'); }
  };

  const deleteInvoice = async (id) => {
    if (!confirm('هل تريد حذف هذه الفاتورة؟')) return;
    try {
      await axios.delete(`/api/invoices/${id}`);
      toast.success('تم حذف الفاتورة');
      load();
    } catch { toast.error('فشل الحذف'); }
  };

  const kpiCards = [
    { label: 'إجمالي الفواتير', value: totals.total_count || 0, icon: FileText, color: 'bg-blue-50 text-blue-600' },
    { label: 'المدفوعة', value: `${fmt(totals.total_paid)} ج`, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { label: 'غير المدفوعة', value: `${fmt(totals.total_unpaid)} ج`, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'المسودات', value: `${fmt(totals.total_draft)} ج`, icon: FileText, color: 'bg-gray-50 text-gray-600' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">الفواتير</h2>
          <p className="text-xs text-gray-400 mt-0.5">إدارة الفواتير والمدفوعات</p>
        </div>
        <button onClick={() => { setEditInvoice(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors">
          <Plus size={16} /> فاتورة جديدة
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((c, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.color} mb-2`}><c.icon size={18} /></div>
            <p className="text-xl font-bold font-mono text-[#1a1a2e]">{c.value}</p>
            <p className="text-[11px] text-gray-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] text-gray-500 mb-1">بحث</label>
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="رقم الفاتورة أو اسم العميل..."
                className="w-full pr-10 pl-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] outline-none transition-all" />
            </div>
          </div>
          <div className="w-40">
            <label className="block text-[11px] text-gray-500 mb-1">الحالة</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#c9a84c] outline-none">
              <option value="">الكل</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="w-40">
            <label className="block text-[11px] text-gray-500 mb-1">من تاريخ</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
          </div>
          <div className="w-40">
            <label className="block text-[11px] text-gray-500 mb-1">إلى تاريخ</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
          </div>
          {(search || statusFilter || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 text-xs text-gray-500 hover:text-red-500 transition-colors">مسح الفلاتر</button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">لا توجد فواتير{search || statusFilter ? ' مطابقة' : ''}</p>
          <button onClick={() => { setEditInvoice(null); setShowForm(true); }}
            className="mt-4 px-4 py-2 bg-[#c9a84c] text-white rounded-lg text-sm font-bold hover:bg-[#b8973f] transition-colors">
            إنشاء فاتورة
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">رقم الفاتورة</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">العميل</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">الحالة</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">المبلغ</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">التاريخ</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500 w-32">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                return (
                  <tr key={inv.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{inv.invoice_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-sm">{inv.customer_name}</div>
                      {inv.customer_phone && <div className="text-[10px] text-gray-400">{inv.customer_phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${st.color}`}>
                        <st.icon size={12} /> {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-[#c9a84c]">{fmt(inv.total)} ج</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {new Date(inv.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => navigate(`/invoices/${inv.id}`)} title="عرض"
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-blue-600"><Eye size={15} /></button>
                        <button onClick={() => { setEditInvoice(inv); setShowForm(true); }} title="تعديل"
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                        {inv.status === 'draft' && (
                          <button onClick={() => updateStatus(inv.id, 'sent')} title="إرسال"
                            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-gray-400 hover:text-blue-600"><Send size={15} /></button>
                        )}
                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                          <button onClick={() => updateStatus(inv.id, 'paid')} title="تم الدفع"
                            className="p-1.5 hover:bg-green-50 rounded-lg transition-colors text-gray-400 hover:text-green-600"><CheckCircle size={15} /></button>
                        )}
                        <button onClick={() => deleteInvoice(inv.id)} title="حذف"
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Form Modal */}
      {showForm && <InvoiceForm invoice={editInvoice} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function InvoiceForm({ invoice, onClose, onSaved }) {
  const toast = useToast();
  const [number, setNumber] = useState(invoice?.invoice_number || '');
  const [customerName, setCustomerName] = useState(invoice?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(invoice?.customer_phone || '');
  const [customerEmail, setCustomerEmail] = useState(invoice?.customer_email || '');
  const [notes, setNotes] = useState(invoice?.notes || '');
  const [taxPct, setTaxPct] = useState(String(invoice?.tax_pct || 0));
  const [discount, setDiscount] = useState(String(invoice?.discount || 0));
  const [dueDate, setDueDate] = useState(invoice?.due_date || '');
  const [status, setStatus] = useState(invoice?.status || 'draft');
  const [items, setItems] = useState(invoice?.items?.length ?
    invoice.items.map(i => ({ ...i })) :
    [{ description: '', quantity: 1, unit_price: 0, model_code: '', variant: '' }]
  );
  const [models, setModels] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!invoice) {
      axios.get('/api/invoices/next-number').then(r => setNumber(r.data.next_number));
    }
    axios.get('/api/models').then(r => setModels(r.data));
  }, []);

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const taxAmt = subtotal * ((parseFloat(taxPct) || 0) / 100);
  const total = subtotal + taxAmt - (parseFloat(discount) || 0);

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0, model_code: '', variant: '' }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => {
    setItems(items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === 'model_code' && val) {
        const model = models.find(m => m.model_code === val);
        if (model) {
          updated.description = model.model_name || model.model_code;
          if (model.consumer_price) updated.unit_price = model.consumer_price;
        }
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    if (!number.trim() || !customerName.trim()) { toast.error('رقم الفاتورة واسم العميل مطلوبان'); return; }
    if (items.filter(i => i.description).length === 0) { toast.error('أضف عنصر واحد على الأقل'); return; }
    setSaving(true);
    try {
      const payload = {
        invoice_number: number.trim(),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        notes: notes.trim() || null,
        tax_pct: parseFloat(taxPct) || 0,
        discount: parseFloat(discount) || 0,
        due_date: dueDate || null,
        status,
        items: items.filter(i => i.description),
      };
      if (invoice) {
        await axios.put(`/api/invoices/${invoice.id}`, payload);
        toast.success('تم تحديث الفاتورة');
      } else {
        await axios.post('/api/invoices', payload);
        toast.success('تم إنشاء الفاتورة');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ أثناء الحفظ');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 mb-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-[#1a1a2e]">{invoice ? 'تعديل فاتورة' : 'فاتورة جديدة'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Header fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">رقم الفاتورة *</label>
              <input type="text" value={number} onChange={e => setNumber(e.target.value)} readOnly={!!invoice}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">اسم العميل *</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="اسم العميل"
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">الهاتف</label>
              <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="01x..."
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">البريد</label>
              <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="email@..."
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">الحالة</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#c9a84c] outline-none">
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">تاريخ الاستحقاق</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">ملاحظات</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات..."
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#1a1a2e]">بنود الفاتورة</h4>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-[#c9a84c] hover:text-[#a88a3a] bg-amber-50 px-3 py-1.5 rounded-lg">
                <Plus size={14} /> إضافة بند
              </button>
            </div>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">الموديل</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">الوصف</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500 w-20">التنوع</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500 w-20">الكمية</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500 w-24">السعر</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500 w-24">المجموع</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                    return (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-2">
                          <select value={item.model_code || ''} onChange={e => updateItem(i, 'model_code', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white">
                            <option value="">—</option>
                            {models.map(m => <option key={m.model_code} value={m.model_code}>{m.model_code}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input type="text" value={item.description || ''} onChange={e => updateItem(i, 'description', e.target.value)}
                            placeholder="وصف البند" className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="text" value={item.variant || ''} onChange={e => updateItem(i, 'variant', e.target.value)}
                            placeholder="S/M/L" className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-center" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" value={item.quantity || ''} onChange={e => updateItem(i, 'quantity', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-center font-mono" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" step="0.01" value={item.unit_price || ''} onChange={e => updateItem(i, 'unit_price', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-center font-mono" />
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs font-bold text-[#c9a84c]">{fmt(lineTotal)}</td>
                        <td className="px-1 py-2">
                          <button onClick={() => removeItem(i)} className="text-red-300 hover:text-red-500 p-1"><X size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">ضريبة %</label>
              <input type="number" min="0" step="0.5" value={taxPct} onChange={e => setTaxPct(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">خصم (ج)</label>
              <input type="number" min="0" step="1" value={discount} onChange={e => setDiscount(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
            </div>
            <div className="flex flex-col justify-end">
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">المجموع الفرعي:</span><span className="font-mono">{fmt(subtotal)} ج</span></div>
                {parseFloat(taxPct) > 0 && <div className="flex justify-between"><span className="text-gray-500">ضريبة ({taxPct}%):</span><span className="font-mono">{fmt(taxAmt)} ج</span></div>}
                {parseFloat(discount) > 0 && <div className="flex justify-between"><span className="text-red-500">خصم:</span><span className="font-mono text-red-500">-{fmt(discount)} ج</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span className="text-[#1a1a2e]">الإجمالي:</span>
                  <span className="font-mono text-[#c9a84c]">{fmt(total)} ج</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">إلغاء</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-6 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
            <FileText size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
          </button>
        </div>
      </div>
    </div>
  );
}
