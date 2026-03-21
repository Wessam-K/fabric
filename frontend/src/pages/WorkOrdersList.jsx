import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ClipboardList, Clock, CheckCircle, AlertTriangle, LayoutGrid, List as ListIcon } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';

const STATUS_MAP = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600' },
  pending: { label: 'معلق', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
};

function StageProgress({ done, total }) {
  if (!total) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-[#c9a84c] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">{done}/{total}</span>
    </div>
  );
}

export default function WorkOrdersList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [workOrders, setWorkOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/work-orders', { params });
      setWorkOrders(data.work_orders || []);
      setStats(data.stats || {});
    } catch { toast.error('فشل تحميل أوامر الإنتاج'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const kpiCards = [
    { label: 'إجمالي', value: stats.total || 0, icon: ClipboardList, color: 'bg-gray-50 text-gray-600' },
    { label: 'قيد التنفيذ', value: stats.in_progress || 0, icon: Clock, color: 'bg-blue-50 text-blue-600' },
    { label: 'مكتمل', value: stats.completed || 0, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { label: 'عاجل', value: stats.urgent || 0, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  ];

  const kanbanCols = [
    { key: 'draft', label: 'مسودة', color: 'border-gray-300' },
    { key: 'pending', label: 'معلق', color: 'border-yellow-400' },
    { key: 'in_progress', label: 'قيد التنفيذ', color: 'border-blue-400' },
    { key: 'completed', label: 'مكتمل', color: 'border-green-400' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">أوامر الإنتاج</h2>
          <p className="text-xs text-gray-400 mt-0.5">إدارة ومتابعة أوامر الإنتاج — المحرك الأساسي للمصنع</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}><ListIcon size={16} /></button>
            <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-md ${viewMode === 'kanban' ? 'bg-white shadow-sm' : ''}`}><LayoutGrid size={16} /></button>
          </div>
          <button onClick={() => navigate('/work-orders/new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors">
            <Plus size={16} /> أمر إنتاج جديد
          </button>
        </div>
      </div>

      {/* KPI */}
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
            <div className="text-center py-16 text-gray-400">لا توجد أوامر إنتاج</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">الرقم</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">الموديل</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الأولوية</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">الحالة</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">التقدم</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">المرحلة</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">التسليم</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">المسؤول</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#c9a84c]">{wo.wo_number}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#1a1a2e]">{wo.model_code}</span>
                      {wo.model_name && <span className="text-gray-400 text-xs mr-2">{wo.model_name}</span>}
                      {wo.fabric_variant_label && <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded mr-1">{wo.fabric_variant_label}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PriorityBadge priority={wo.priority} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={wo.status} type="work_order" />
                    </td>
                    <td className="px-4 py-3 w-32">
                      <StageProgress done={wo.stages_done || 0} total={wo.stages_total || 0} />
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {wo.last_active_stage_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {wo.due_date ? new Date(wo.due_date).toLocaleDateString('ar-EG') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{wo.assigned_to || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Kanban */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <div key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)}
                      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-[#c9a84c]">{wo.wo_number}</span>
                        <PriorityBadge priority={wo.priority} />
                      </div>
                      <p className="text-sm font-bold text-[#1a1a2e] mb-1">{wo.model_code}</p>
                      {wo.model_name && <p className="text-xs text-gray-400 mb-1">{wo.model_name}</p>}
                      {wo.fabric_variant_label && <p className="text-[10px] text-indigo-500 mb-1">{wo.fabric_variant_label}</p>}
                      <StageProgress done={wo.stages_done || 0} total={wo.stages_total || 0} />
                      {wo.last_active_stage_name && <p className="text-[10px] text-emerald-600 mt-1">▶ {wo.last_active_stage_name}</p>}
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
    </div>
  );
}
