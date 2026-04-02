import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Eye, X, Send, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

const AVAILABLE_EVENTS = [
  { value: '*', label: 'جميع الأحداث' },
  { value: 'customer.created', label: 'إنشاء عميل' },
  { value: 'payment.received', label: 'استلام دفعة' },
  { value: 'journal.created', label: 'إنشاء قيد محاسبي' },
  { value: 'stock.transfer_created', label: 'إنشاء تحويل مخزون' },
  { value: 'invoice.created', label: 'إنشاء فاتورة' },
  { value: 'invoice.status_changed', label: 'تغيير حالة فاتورة' },
  { value: 'purchaseorder.created', label: 'إنشاء أمر شراء' },
  { value: 'workorder.created', label: 'إنشاء أمر تشغيل' },
  { value: 'workorder.status_changed', label: 'تغيير حالة أمر تشغيل' },
];

export default function Webhooks() {
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', url: '', events: [], secret: '' });
  const [logsFor, setLogsFor] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/webhooks');
      setWebhooks((data || []).map(w => ({ ...w, events: typeof w.events === 'string' ? JSON.parse(w.events) : (w.events || []) })));
    } catch { toast.error('فشل تحميل الويب هوكس'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm({ name: '', url: '', events: [], secret: '' }); setEditId(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.url || !form.events.length) { toast.error('الاسم والرابط وحدث واحد على الأقل مطلوبين'); return; }
    try {
      if (editId) {
        await api.put(`/webhooks/${editId}`, form);
        toast.success('تم تحديث الويب هوك');
      } else {
        await api.post('/webhooks', form);
        toast.success('تم إنشاء الويب هوك');
      }
      resetForm();
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل الحفظ'); }
  };

  const remove = async (id) => {
    const ok = await confirm({ title: 'حذف ويب هوك', message: 'هل أنت متأكد من حذف هذا الويب هوك؟', variant: 'danger' });
    if (!ok) return;
    try { await api.delete(`/webhooks/${id}`); toast.success('تم الحذف'); load(); }
    catch { toast.error('فشل الحذف'); }
  };

  const toggleStatus = async (wh) => {
    try {
      await api.put(`/webhooks/${wh.id}`, { ...wh, status: wh.status === 'active' ? 'inactive' : 'active' });
      load();
    } catch { toast.error('فشل تغيير الحالة'); }
  };

  const viewLogs = async (id) => {
    setLogsFor(id);
    setLogsLoading(true);
    try { const { data } = await api.get(`/webhooks/${id}/logs`); setLogs(data || []); }
    catch { toast.error('فشل تحميل السجلات'); }
    finally { setLogsLoading(false); }
  };

  const startEdit = (wh) => {
    setForm({ name: wh.name, url: wh.url, events: wh.events, secret: '' });
    setEditId(wh.id);
    setShowForm(true);
  };

  const toggleEvent = (ev) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev]
    }));
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return d; }
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <ConfirmDialog />
      <PageHeader title="إدارة الويب هوكس" icon={Webhook} action={
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> إضافة ويب هوك
        </button>
      } />

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">{editId ? 'تعديل ويب هوك' : 'إضافة ويب هوك جديد'}</h3>
            <button onClick={resetForm}><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم</label>
                <input className="input w-full" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="اسم الويب هوك" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">رابط الاستقبال (URL)</label>
                <input className="input w-full" type="url" value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} placeholder="https://example.com/webhook" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">المفتاح السري (HMAC - اختياري)</label>
              <input className="input w-full" value={form.secret} onChange={e => setForm(f => ({...f, secret: e.target.value}))} placeholder={editId ? 'اتركه فارغاً للإبقاء على المفتاح الحالي' : 'مفتاح سري لتوقيع الطلبات'} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">الأحداث</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_EVENTS.map(ev => (
                  <button key={ev.value} type="button"
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.events.includes(ev.value) ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => toggleEvent(ev.value)}>
                    {ev.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="btn btn-secondary">إلغاء</button>
              <button type="submit" className="btn btn-primary">{editId ? 'تحديث' : 'إنشاء'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Webhooks List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500"><RefreshCw size={24} className="animate-spin mx-auto mb-2" /> جاري التحميل...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Webhook size={48} className="mx-auto mb-3 opacity-50" />
          <p>لا توجد ويب هوكس بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-base">{wh.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${wh.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {wh.status === 'active' ? 'نشط' : 'معطل'}
                    </span>
                    {wh.failure_count > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">{wh.failure_count} فشل</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate mb-1" dir="ltr">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {wh.events.map(ev => (
                      <span key={ev} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{ev}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    أنشئ: {formatDate(wh.created_at)}
                    {wh.last_triggered_at && <> | آخر تفعيل: {formatDate(wh.last_triggered_at)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-1 mr-4">
                  <button onClick={() => toggleStatus(wh)} title={wh.status === 'active' ? 'تعطيل' : 'تفعيل'} className="p-2 rounded-lg hover:bg-gray-100">
                    {wh.status === 'active' ? <ToggleRight size={20} className="text-green-600" /> : <ToggleLeft size={20} className="text-gray-400" />}
                  </button>
                  <button onClick={() => startEdit(wh)} title="تعديل" className="p-2 rounded-lg hover:bg-gray-100">
                    <Send size={16} className="text-blue-500" />
                  </button>
                  <button onClick={() => viewLogs(wh.id)} title="سجل التسليم" className="p-2 rounded-lg hover:bg-gray-100">
                    <Eye size={16} className="text-gray-500" />
                  </button>
                  <button onClick={() => remove(wh.id)} title="حذف" className="p-2 rounded-lg hover:bg-red-50">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delivery Logs Modal */}
      {logsFor && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setLogsFor(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold">سجل التسليم</h3>
              <button onClick={() => setLogsFor(null)}><X size={20} /></button>
            </div>
            <div className="overflow-auto p-4 flex-1">
              {logsLoading ? (
                <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">لا توجد سجلات بعد</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-right">
                      <th className="pb-2 pr-2">الحدث</th>
                      <th className="pb-2 pr-2">الحالة</th>
                      <th className="pb-2 pr-2">النتيجة</th>
                      <th className="pb-2 pr-2">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="py-2 pr-2"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{log.event}</span></td>
                        <td className="py-2 pr-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {log.response_status || '-'}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-xs text-gray-500 max-w-[200px] truncate">{log.response_body || '-'}</td>
                        <td className="py-2 pr-2 text-xs text-gray-400">{formatDate(log.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
