import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, Clock, CheckCircle, AlertTriangle, LayoutGrid, List as ListIcon, Download } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { PageHeader, KPIStrip, DataTable, StatusBadge, LoadingState, EmptyState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import PermissionGuard from '../components/PermissionGuard';
import { exportFromBackend } from '../utils/exportUtils';

const STATUS_OPTIONS = [
  { value: '', label: 'كل الحالات' },
  { value: 'draft', label: 'مسودة' },
  { value: 'pending', label: 'معلق' },
  { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'cancelled', label: 'ملغي' },
];

function StageProgress({ done, total }) {
  if (!total) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--color-gold)] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-[var(--color-muted)] font-mono whitespace-nowrap">{done}/{total}</span>
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
    <div className="page">
      <PageHeader title="أوامر الإنتاج" subtitle="إدارة ومتابعة أوامر الإنتاج — المحرك الأساسي للمصنع"
        actions={
          <div className="flex items-center gap-2">
            <HelpButton pageKey="workorders" />
            <button onClick={() => exportFromBackend('/work-orders/export', 'work-orders').catch(() => {})} className="btn btn-secondary text-xs"><Download size={14} /> تصدير</button>
            <div className="flex bg-[var(--color-surface)] rounded-lg p-0.5">
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}><ListIcon size={16} /></button>
              <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-md ${viewMode === 'kanban' ? 'bg-white shadow-sm' : ''}`}><LayoutGrid size={16} /></button>
            </div>
            <PermissionGuard module="workorders" action="create">
              <button onClick={() => navigate('/work-orders/new')} className="btn btn-gold">
                <Plus size={16} /> أمر إنتاج جديد
              </button>
            </PermissionGuard>
          </div>
        }
      />

      <KPIStrip items={[
        { label: 'إجمالي', value: stats.total || 0, icon: ClipboardList },
        { label: 'قيد التنفيذ', value: stats.in_progress || 0, icon: Clock, color: 'info' },
        { label: 'مكتمل', value: stats.completed || 0, icon: CheckCircle, color: 'success' },
        { label: 'عاجل', value: stats.urgent || 0, icon: AlertTriangle, color: 'danger' },
      ]} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
          className="form-input flex-1 min-w-[200px]" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? <LoadingState /> : viewMode === 'list' ? (
        workOrders.length === 0 ? <EmptyState icon={ClipboardList} message="لا توجد أوامر إنتاج" /> : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr>
                <th>الرقم</th><th>الموديل</th><th>الأولوية</th><th>الحالة</th><th>التقدم</th><th>المرحلة</th><th>التسليم</th><th>المسؤول</th>
              </tr></thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)} className="cursor-pointer">
                    <td><span className="font-mono text-xs font-bold text-[var(--color-gold)]">{wo.wo_number}</span></td>
                    <td>
                      <span className="font-bold text-[var(--color-navy)]">{wo.model_code}</span>
                      {wo.model_name && <span className="text-[var(--color-muted)] text-xs mr-2">{wo.model_name}</span>}
                      {wo.fabric_variant_label && <span className="badge badge-info text-[10px] mr-1">{wo.fabric_variant_label}</span>}
                    </td>
                    <td className="text-center"><StatusBadge status={wo.priority} type="priority" /></td>
                    <td className="text-center"><StatusBadge status={wo.status} /></td>
                    <td className="w-32"><StageProgress done={wo.stages_done || 0} total={wo.stages_total || 0} /></td>
                    <td className="text-center text-xs text-[var(--color-muted)]">{wo.last_active_stage_name || '—'}</td>
                    <td className="text-center text-xs text-[var(--color-muted)]">{wo.due_date ? new Date(wo.due_date).toLocaleDateString('ar-EG') : '—'}</td>
                    <td className="text-center text-xs text-[var(--color-muted)]">{wo.assigned_to || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Kanban */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {kanbanCols.map(col => {
            const items = workOrders.filter(wo => wo.status === col.key);
            return (
              <div key={col.key} className={`bg-[var(--color-surface)] rounded-xl p-4 border-t-4 ${col.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[var(--color-navy)]">{col.label}</h3>
                  <span className="text-xs bg-white px-2 py-0.5 rounded-full font-mono">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map(wo => (
                    <div key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)}
                      className="card card-body hover:shadow-md cursor-pointer transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-[var(--color-gold)]">{wo.wo_number}</span>
                        <StatusBadge status={wo.priority} type="priority" />
                      </div>
                      <p className="text-sm font-bold text-[var(--color-navy)] mb-1">{wo.model_code}</p>
                      {wo.model_name && <p className="text-xs text-[var(--color-muted)] mb-1">{wo.model_name}</p>}
                      {wo.fabric_variant_label && <p className="text-[10px] text-indigo-500 mb-1">{wo.fabric_variant_label}</p>}
                      <StageProgress done={wo.stages_done || 0} total={wo.stages_total || 0} />
                      {wo.last_active_stage_name && <p className="text-[10px] text-emerald-600 mt-1">▶ {wo.last_active_stage_name}</p>}
                      {wo.due_date && <p className="text-[10px] text-[var(--color-muted)] mt-2">التسليم: {new Date(wo.due_date).toLocaleDateString('ar-EG')}</p>}
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
