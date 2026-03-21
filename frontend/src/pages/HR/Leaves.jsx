import { useState, useEffect } from 'react';
import { Plus, Wrench, X, Calendar } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { PageHeader, LoadingState, Tabs, Modal, EmptyState } from '../../components/ui';

export default function Leaves() {
  const toast = useToast();
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [lRes, eRes] = await Promise.all([
        api.get('/hr/leaves'),
        api.get('/hr/employees'),
      ]);
      setLeaves(lRes.data);
      setEmployees(Array.isArray(eRes.data) ? eRes.data : eRes.data.employees || []);
    } catch { toast.error('فشل تحميل البيانات'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.employee_id || !form.start_date || !form.end_date) { toast.error('جميع الحقول مطلوبة'); return; }
    try {
      await api.post('/hr/leaves', form);
      toast.success('تم تقديم طلب الإجازة');
      setShowForm(false);
      setForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleAction = async (id, action) => {
    try {
      await api.patch(`/hr/leaves/${id}`, { status: action });
      toast.success(action === 'approved' ? 'تم قبول الطلب' : 'تم رفض الطلب');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG') : '—';
  const TYPES = { annual: 'سنوية', sick: 'مرضية', unpaid: 'بدون راتب', emergency: 'طارئة' };
  const STATUS = { pending: 'قيد المراجعة', approved: 'مقبولة', rejected: 'مرفوضة' };
  const STATUS_COLORS = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };

  const filtered = tab === 'all' ? leaves : leaves.filter(l => l.status === tab);

  if (loading) return <LoadingState />;

  return (
    <div className="page">
      <PageHeader title="الإجازات" subtitle="إدارة طلبات الإجازات"
        action={<button onClick={() => setShowForm(true)} className="btn btn-gold"><Plus size={16} /> طلب إجازة</button>} />

      <Tabs tabs={[
        { value: 'all', label: 'الكل', count: leaves.length },
        { value: 'pending', label: 'قيد المراجعة', count: leaves.filter(l => l.status === 'pending').length },
        { value: 'approved', label: 'مقبولة', count: leaves.filter(l => l.status === 'approved').length },
        { value: 'rejected', label: 'مرفوضة', count: leaves.filter(l => l.status === 'rejected').length },
      ]} active={tab} onChange={setTab} />

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <EmptyState icon={Calendar} title="لا توجد طلبات إجازات" />
          ) : (
            <table className="data-table">
              <thead><tr><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th><th>السبب</th><th></th></tr></thead>
              <tbody>
                {filtered.map(l => {
                  const days = l.start_date && l.end_date ? Math.ceil((new Date(l.end_date) - new Date(l.start_date)) / 86400000) + 1 : '—';
                  return (
                    <tr key={l.id}>
                      <td className="text-xs font-semibold">{l.employee_name || l.employee_id}</td>
                      <td className="text-xs">{TYPES[l.leave_type] || l.leave_type}</td>
                      <td className="text-xs">{fmtDate(l.start_date)}</td>
                      <td className="text-xs">{fmtDate(l.end_date)}</td>
                      <td className="font-mono text-xs">{days}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[l.status] || ''}`}>{STATUS[l.status] || l.status}</span></td>
                      <td className="text-xs text-gray-500 max-w-[150px] truncate">{l.reason || '—'}</td>
                      <td>
                        {l.status === 'pending' && (
                          <div className="flex gap-1">
                            <button onClick={() => handleAction(l.id, 'approved')} className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200">قبول</button>
                            <button onClick={() => handleAction(l.id, 'rejected')} className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full hover:bg-red-200">رفض</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New Leave Request Modal */}
      <Modal open={showForm} title="طلب إجازة جديد" onClose={() => setShowForm(false)} size="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">الموظف</label>
            <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">اختر الموظف</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">نوع الإجازة</label>
            <select value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">من تاريخ</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">إلى تاريخ</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">السبب</label>
            <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn btn-outline btn-sm">إلغاء</button>
            <button onClick={handleSubmit} className="btn btn-gold btn-sm">تقديم الطلب</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
