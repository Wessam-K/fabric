import { useState, useEffect } from 'react';
import { CalendarClock, Plus, X, ToggleLeft, ToggleRight, RefreshCw, Clock } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import Tooltip from '../components/Tooltip';
import { useConfirm } from '../components/ConfirmDialog';

const REPORT_TYPES = [
  { value: 'summary', label: 'الملخص العام' },
  { value: 'work-orders', label: 'أوامر التشغيل' },
  { value: 'costs', label: 'التكاليف' },
  { value: 'inventory-status', label: 'حالة المخزون' },
  { value: 'customer-summary', label: 'ملخص العملاء' },
  { value: 'expense-analysis', label: 'تحليل المصروفات' },
  { value: 'quality', label: 'الجودة' },
  { value: 'hr-summary', label: 'ملخص الموارد البشرية' },
  { value: 'financial/pl', label: 'قائمة الدخل' },
  { value: 'cash-flow', label: 'التدفقات النقدية' },
  { value: 'ar-aging', label: 'أعمار المديونيات' },
  { value: 'ap-aging', label: 'أعمار الدائنين' },
  { value: 'production/efficiency', label: 'كفاءة الإنتاج' },
  { value: 'inventory-valuation', label: 'تقييم المخزون' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'يومي' },
  { value: 'weekly', label: 'أسبوعي' },
  { value: 'monthly', label: 'شهري' },
];

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function ReportSchedules() {
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', report_type: '', frequency: 'weekly', day_of_week: 0, day_of_month: 1, hour: 8, recipients: '', format: 'xlsx' });

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/report-schedules'); setSchedules(data || []); }
    catch { toast.error('فشل التحميل'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm({ name: '', report_type: '', frequency: 'weekly', day_of_week: 0, day_of_month: 1, hour: 8, recipients: '', format: 'xlsx' }); setEditId(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const recipients = form.recipients.split(',').map(s => s.trim()).filter(Boolean);
    if (!form.name || !form.report_type || !recipients.length) { toast.error('الاسم ونوع التقرير والمستلمين مطلوبين'); return; }
    const payload = { ...form, recipients };
    try {
      if (editId) {
        await api.put(`/report-schedules/${editId}`, payload);
        toast.success('تم التحديث');
      } else {
        await api.post('/report-schedules', payload);
        toast.success('تم إنشاء الجدول الزمني');
      }
      resetForm(); load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل الحفظ'); }
  };

  const toggle = async (id) => {
    try { await api.post(`/report-schedules/${id}/toggle`); load(); }
    catch { toast.error('فشل تغيير الحالة'); }
  };

  const startEdit = (s) => {
    setForm({ name: s.name, report_type: s.report_type, frequency: s.frequency, day_of_week: s.day_of_week, day_of_month: s.day_of_month, hour: s.hour, recipients: (s.recipients || []).join(', '), format: s.format || 'xlsx' });
    setEditId(s.id);
    setShowForm(true);
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return d; }
  };

  const getFreqLabel = (f) => FREQUENCIES.find(x => x.value === f)?.label || f;
  const getReportLabel = (t) => REPORT_TYPES.find(x => x.value === t)?.label || t;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <ConfirmDialog />
      <PageHeader title="التقارير المجدولة" icon={CalendarClock} action={
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> جدول جديد
        </button>
      } />

      {showForm && (
        <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">{editId ? 'تعديل جدول' : 'إنشاء جدول زمني جديد'}</h3>
            <button onClick={resetForm}><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم</label>
                <input className="input w-full" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع التقرير</label>
                <select className="input w-full" value={form.report_type} onChange={e => setForm(f => ({...f, report_type: e.target.value}))} required>
                  <option value="">اختر...</option>
                  {REPORT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">التكرار</label>
                <select className="input w-full" value={form.frequency} onChange={e => setForm(f => ({...f, frequency: e.target.value}))}>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              {form.frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium mb-1">يوم الأسبوع</label>
                  <select className="input w-full" value={form.day_of_week} onChange={e => setForm(f => ({...f, day_of_week: parseInt(e.target.value)}))}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {form.frequency === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium mb-1">يوم الشهر</label>
                  <input type="number" min="1" max="28" className="input w-full" value={form.day_of_month} onChange={e => setForm(f => ({...f, day_of_month: parseInt(e.target.value) || 1}))} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">الساعة</label>
                <input type="number" min="0" max="23" className="input w-full" value={form.hour} onChange={e => setForm(f => ({...f, hour: parseInt(e.target.value) || 0}))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">المستلمين (بريد إلكتروني، مفصولين بفاصلة)</label>
                <input className="input w-full" value={form.recipients} onChange={e => setForm(f => ({...f, recipients: e.target.value}))} placeholder="user@example.com, admin@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الصيغة</label>
                <select className="input w-full" value={form.format} onChange={e => setForm(f => ({...f, format: e.target.value}))}>
                  <option value="xlsx">Excel (XLSX)</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="btn btn-secondary">إلغاء</button>
              <button type="submit" className="btn btn-primary">{editId ? 'تحديث' : 'إنشاء'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500"><RefreshCw size={24} className="animate-spin mx-auto mb-2" /> جاري التحميل...</div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarClock size={48} className="mx-auto mb-3 opacity-50" />
          <p>لا توجد تقارير مجدولة بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => (
            <div key={s.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-base">{s.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.enabled ? 'مفعّل' : 'معطّل'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-1">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{getReportLabel(s.report_type)}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {getFreqLabel(s.frequency)} - الساعة {s.hour}:00</span>
                    <span>الصيغة: {s.format?.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    المستلمون: {(s.recipients || []).join(', ')}
                    {s.last_run_at && <> | آخر تشغيل: {formatDate(s.last_run_at)}</>}
                    {s.next_run_at && <> | التشغيل القادم: {formatDate(s.next_run_at)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-1 mr-4">
                  <Tooltip text={s.enabled ? 'تعطيل' : 'تفعيل'}><button onClick={() => toggle(s.id)} className="p-2 rounded-lg hover:bg-gray-100">
                    {s.enabled ? <ToggleRight size={20} className="text-green-600" /> : <ToggleLeft size={20} className="text-gray-400" />}
                  </button></Tooltip>
                  <Tooltip text="تعديل"><button onClick={() => startEdit(s)} className="p-2 rounded-lg hover:bg-gray-100">
                    <CalendarClock size={16} className="text-blue-500" />
                  </button></Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
