import { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar, Layers, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import HelpButton from '../components/HelpButton';

const STATUS_COLORS = { scheduled: '#3b82f6', in_progress: '#f59e0b', completed: '#22c55e', cancelled: '#ef4444', delayed: '#ef4444' };
const STATUS_LABELS = { scheduled: 'مجدول', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي', delayed: 'متأخر' };

export default function Scheduling() {
  const toast = useToast();
  const { can } = useAuth();
  const [entries, setEntries] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0, 10);
  });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ production_line_id: '', work_order_id: '', start_date: '', end_date: '', shift: 'morning', priority: 3, notes: '' });
  const [workOrders, setWorkOrders] = useState([]);
  const [showLineModal, setShowLineModal] = useState(false);
  const [lineForm, setLineForm] = useState({ name: '', capacity_per_day: 100, shift_count: 1 });

  const weekDays = useMemo(() => {
    const days = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      days.push({ date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' }) });
    }
    return days;
  }, [weekStart]);

  const load = async () => {
    setLoading(true);
    try {
      const endDate = new Date(weekStart); endDate.setDate(endDate.getDate() + 6);
      const [schedRes, linesRes] = await Promise.all([
        api.get('/scheduling', { params: { start_date: weekStart, end_date: endDate.toISOString().slice(0, 10) } }),
        api.get('/scheduling/lines'),
      ]);
      setEntries(schedRes.data || []);
      setLines(linesRes.data || []);
    } catch { toast.error('فشل تحميل الجدولة'); }
    finally { setLoading(false); }
  };

  const loadWOs = async () => {
    try { const { data } = await api.get('/work-orders', { params: { limit: 100, status: 'in_progress' } }); setWorkOrders(data.data || []); } catch {}
  };

  useEffect(() => { load(); }, [weekStart]);
  useEffect(() => { loadWOs(); }, []);

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d.toISOString().slice(0, 10)); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d.toISOString().slice(0, 10)); };

  const getEntriesForLineDay = (lineId, date) => entries.filter(e => e.production_line_id === lineId && e.start_date <= date && e.end_date >= date);

  const save = async () => {
    try {
      await api.post('/scheduling', form);
      toast.success('تمت إضافة الجدولة');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل الحفظ'); }
  };

  const saveLine = async () => {
    try {
      await api.post('/scheduling/lines', lineForm);
      toast.success('تمت إضافة خط الإنتاج');
      setShowLineModal(false);
      setLineForm({ name: '', capacity_per_day: 100, shift_count: 1 });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل الحفظ'); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <PageHeader title="جدولة الإنتاج" icon={Calendar} action={<HelpButton pageKey="scheduling" />} />

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5">
          <button onClick={prevWeek} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
          <span className="text-sm font-bold min-w-[180px] text-center">
            {new Date(weekStart).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <button onClick={nextWeek} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
        </div>
        <PermissionGuard module="scheduling" action="create">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]">
            <Plus size={18} /> جدولة جديدة
          </button>
          <button onClick={() => setShowLineModal(true)} className="flex items-center gap-2 bg-white border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            <Layers size={16} /> خط إنتاج جديد
          </button>
        </PermissionGuard>
      </div>

      {/* Status Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS[k] }} />
            <span>{v}</span>
          </div>
        ))}
      </div>

      {/* Gantt Chart */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : lines.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Layers size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg">لا توجد خطوط إنتاج</p>
          <p className="text-gray-400 text-sm mt-1">أضف خط إنتاج أولاً</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-right border-l min-w-[140px] sticky right-0 bg-gray-50 z-10">خط الإنتاج</th>
                  {weekDays.map(d => (
                    <th key={d.date} className="p-2 text-center min-w-[120px] border-l">
                      <span className="text-xs text-gray-500">{d.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.id} className="border-t">
                    <td className="p-3 font-bold text-sm border-l sticky right-0 bg-white z-10">
                      {line.name}
                      <span className="block text-xs text-gray-400 font-normal">{line.capacity_per_day} قطعة/يوم</span>
                    </td>
                    {weekDays.map(d => {
                      const dayEntries = getEntriesForLineDay(line.id, d.date);
                      return (
                        <td key={d.date} className="p-1 border-l align-top min-h-[60px]">
                          {dayEntries.map(e => (
                            <div key={e.id} className="text-xs mb-1 px-2 py-1 rounded text-white truncate cursor-default"
                              style={{ backgroundColor: STATUS_COLORS[e.status] || '#94a3b8' }}
                              title={`${e.wo_number || ''} — ${e.notes || ''}`}>
                              {e.wo_number || `#${e.work_order_id}`}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">جدولة جديدة</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">خط الإنتاج</label>
                <select value={form.production_line_id} onChange={e => setForm(f => ({ ...f, production_line_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">— اختر —</option>
                  {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">أمر العمل</label>
                <select value={form.work_order_id} onChange={e => setForm(f => ({ ...f, work_order_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">— اختر —</option>
                  {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.wo_number}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">تاريخ البدء</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">تاريخ الانتهاء</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الوردية</label>
                  <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="morning">صباحية</option>
                    <option value="evening">مسائية</option>
                    <option value="night">ليلية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الأولوية (1-5)</label>
                  <input type="number" min={1} max={5} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 3 }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">إلغاء</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold hover:bg-[#b8973f]">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Production Line Modal */}
      {showLineModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowLineModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">خط إنتاج جديد</h2>
              <button onClick={() => setShowLineModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم الخط</label>
                <input value={lineForm.name} onChange={e => setLineForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="خط 1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الطاقة اليومية</label>
                  <input type="number" value={lineForm.capacity_per_day} onChange={e => setLineForm(f => ({ ...f, capacity_per_day: parseInt(e.target.value) || 0 }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">عدد الورديات</label>
                  <input type="number" min={1} max={3} value={lineForm.shift_count} onChange={e => setLineForm(f => ({ ...f, shift_count: parseInt(e.target.value) || 1 }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowLineModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">إلغاء</button>
              <button onClick={saveLine} className="px-4 py-2 text-sm bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold hover:bg-[#b8973f]">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
