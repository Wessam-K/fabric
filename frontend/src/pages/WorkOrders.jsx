import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ClipboardList, Clock, CheckCircle, AlertTriangle, LayoutGrid, List as ListIcon } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/Toast';

const STATUS_MAP = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
};

const PRIORITY_MAP = {
  low: { label: 'منخفض', color: 'text-gray-400' },
  normal: { label: 'عادي', color: 'text-blue-500' },
  high: { label: 'عالي', color: 'text-orange-500' },
  urgent: { label: 'عاجل', color: 'text-red-600 font-bold' },
};

function StageProgress({ stages }) {
  if (!stages?.length) return null;
  const completed = stages.filter(s => s.status === 'completed').length;
  const pct = Math.round((completed / stages.length) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-[#c9a84c] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">{completed}/{stages.length}</span>
    </div>
  );
}

export default function WorkOrders() {
  const navigate = useNavigate();
  const toast = useToast();
  const [workOrders, setWorkOrders] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [models, setModels] = useState([]);
  const [form, setForm] = useState({ wo_number: '', model_id: '', quantity: '', priority: 'normal', assigned_to: '', due_date: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await axios.get('/api/workorders', { params });
      setWorkOrders(data.workOrders);
      setTotals(data.totals);
    } catch { toast.error('فشل تحميل أوامر العمل'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const openCreateModal = async () => {
    try {
      const [modelsRes, nextRes] = await Promise.all([
        axios.get('/api/models'),
        axios.get('/api/workorders/next-number'),
      ]);
      setModels(modelsRes.data);
      setForm(prev => ({ ...prev, wo_number: nextRes.data.next_number }));
      setShowCreate(true);
    } catch { toast.error('فشل تحميل البيانات'); }
  };

  const handleCreate = async () => {
    if (!form.wo_number || !form.model_id || !form.quantity) {
      toast.error('الحقول المطلوبة: رقم الأمر، الموديل، الكمية');
      return;
    }
    try {
      await axios.post('/api/workorders', { ...form, quantity: parseInt(form.quantity) });
      toast.success('تم إنشاء أمر العمل بنجاح');
      setShowCreate(false);
      setForm({ wo_number: '', model_id: '', quantity: '', priority: 'normal', assigned_to: '', due_date: '', notes: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const kpiCards = [
    { label: 'إجمالي', value: totals.total || 0, icon: ClipboardList, color: 'bg-gray-50 text-gray-600' },
    { label: 'قيد التنفيذ', value: totals.active_count || 0, icon: Clock, color: 'bg-blue-50 text-blue-600' },
    { label: 'مكتمل', value: totals.completed_count || 0, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { label: 'عاجل', value: totals.urgent_count || 0, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  ];

  // Kanban columns
  const kanbanCols = [
    { key: 'draft', label: 'مسودة', color: 'border-gray-300' },
    { key: 'in_progress', label: 'قيد التنفيذ', color: 'border-blue-400' },
    { key: 'completed', label: 'مكتمل', color: 'border-green-400' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">أوامر العمل</h2>
          <p className="text-xs text-gray-400 mt-0.5">إدارة ومتابعة أوامر الإنتاج</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}><ListIcon size={16} /></button>
            <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-md ${viewMode === 'kanban' ? 'bg-white shadow-sm' : ''}`}><LayoutGrid size={16} /></button>
          </div>
          <button onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors">
            <Plus size={16} /> أمر عمل جديد
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((c, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.color} mb-2`}><c.icon size={18} /></div>
            <p className="text-2xl font-bold font-mono text-[#1a1a2e]">{c.value}</p>
            <p className="text-xs text-gray-400">{c.label}</p>
          </div>
        ))}
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

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {workOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">لا توجد أوامر عمل</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">الرقم</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">الموديل</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الكمية</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الأولوية</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الحالة</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">المرحلة</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">التقدم</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">التسليم</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id} onClick={() => navigate(`/workorders/${wo.id}`)}
                    className="border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{wo.wo_number}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#1a1a2e]">{wo.model_code}</span>
                      {wo.model_name && <span className="text-gray-400 text-xs mr-2">{wo.model_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">{wo.quantity}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs ${PRIORITY_MAP[wo.priority]?.color}`}>{PRIORITY_MAP[wo.priority]?.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-1 rounded-full ${STATUS_MAP[wo.status]?.color}`}>{STATUS_MAP[wo.status]?.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {wo.stage_name && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: wo.stage_color || '#3b82f6' }}>{wo.stage_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 w-32"><StageProgress stages={wo.stages} /></td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {wo.due_date ? new Date(wo.due_date).toLocaleDateString('ar-EG') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Kanban View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {kanbanCols.map(col => {
            const items = workOrders.filter(wo => wo.status === col.key);
            return (
              <div key={col.key} className={`bg-gray-50 rounded-2xl p-4 border-t-4 ${col.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#1a1a2e]">{col.label}</h3>
                  <span className="text-xs bg-white px-2 py-0.5 rounded-full font-mono">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map(wo => (
                    <div key={wo.id} onClick={() => navigate(`/workorders/${wo.id}`)}
                      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-[#c9a84c]">{wo.wo_number}</span>
                        <span className={`text-[10px] ${PRIORITY_MAP[wo.priority]?.color}`}>{PRIORITY_MAP[wo.priority]?.label}</span>
                      </div>
                      <p className="text-sm font-bold text-[#1a1a2e] mb-1">{wo.model_code}</p>
                      <p className="text-xs text-gray-400 mb-2">{wo.quantity} قطعة</p>
                      {wo.stage_name && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-white inline-block mb-2" style={{ backgroundColor: wo.stage_color || '#3b82f6' }}>{wo.stage_name}</span>
                      )}
                      <StageProgress stages={wo.stages} />
                      {wo.due_date && (
                        <p className="text-[10px] text-gray-400 mt-2">التسليم: {new Date(wo.due_date).toLocaleDateString('ar-EG')}</p>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-center text-xs text-gray-300 py-8">فارغ</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e]">أمر عمل جديد</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">رقم الأمر *</label>
                <input type="text" value={form.wo_number} onChange={e => setForm({...form, wo_number: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">الكمية *</label>
                <input type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">الموديل *</label>
              <select value={form.model_id} onChange={e => setForm({...form, model_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                <option value="">اختر الموديل</option>
                {models.map(m => <option key={m.id} value={m.id}>[{m.model_code}] {m.model_name || m.serial_number}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">الأولوية</label>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                  <option value="low">منخفض</option>
                  <option value="normal">عادي</option>
                  <option value="high">عالي</option>
                  <option value="urgent">عاجل</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">تاريخ التسليم</label>
                <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">المسؤول</label>
              <input type="text" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" placeholder="اسم المسؤول..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ملاحظات</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleCreate} className="px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold">إنشاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
