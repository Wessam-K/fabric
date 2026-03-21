import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Settings, Activity, Clock, MapPin, Wrench, Factory } from 'lucide-react';
import { PageHeader, LoadingState, Tabs } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import HelpButton from '../components/HelpButton';
import BarcodePrint from '../components/BarcodePrint';

const STATUS_MAP = { active: 'نشطة', maintenance: 'صيانة', inactive: 'متوقفة' };
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', maintenance: 'bg-yellow-100 text-yellow-700', inactive: 'bg-gray-200 text-gray-500' };

export default function MachineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/machines/${id}`);
        setMachine(data);
      } catch { toast.error('فشل تحميل بيانات الماكينة'); navigate('/machines'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG') : '—';

  if (loading) return <LoadingState />;
  if (!machine) return null;

  const stages = machine.recent_stages || [];
  const activeStages = stages.filter(s => s.status === 'in_progress');
  const completedStages = stages.filter(s => s.status === 'completed');

  return (
    <div className="page">
      <PageHeader title={machine.name} subtitle={`كود: ${machine.code} — ${machine.machine_type || 'بدون نوع'}`}
        action={<div className="flex items-center gap-2"><HelpButton pageKey="machinedetail" /><button onClick={() => navigate('/machines')} className="btn btn-outline btn-sm"><ArrowRight size={14} /> الماكينات</button></div>} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2"><Settings size={18} /></div>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[machine.status] || ''}`}>{STATUS_MAP[machine.status] || machine.status}</span>
          <p className="text-xs text-gray-400 mt-1">الحالة</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 text-green-600 mb-2"><Activity size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{activeStages.length}</p>
          <p className="text-xs text-gray-400">مراحل نشطة</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 mb-2"><Clock size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(machine.total_hours || stages.reduce((s, st) => s + (st.actual_hours || 0), 0))}</p>
          <p className="text-xs text-gray-400">ساعات تشغيل</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 mb-2"><Factory size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{completedStages.length}</p>
          <p className="text-xs text-gray-400">مراحل مكتملة</p>
        </div>
      </div>

      <Tabs tabs={[
        { value: 'overview', label: 'نظرة عامة' },
        { value: 'stages', label: 'أوامر العمل', count: stages.length },
      ]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="card">
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase">بيانات الماكينة</h4>
              <p className="text-sm">النوع: <span className="font-semibold">{machine.machine_type || '—'}</span></p>
              {machine.location && <p className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-gray-400" /> {machine.location}</p>}
              {machine.capacity_per_hour > 0 && <p className="text-sm">السعة/ساعة: <span className="font-mono font-semibold">{machine.capacity_per_hour}</span> قطعة</p>}
              {machine.cost_per_hour > 0 && <p className="text-sm">التكلفة/ساعة: <span className="font-mono font-semibold">{fmt(machine.cost_per_hour)} ج</span></p>}
            </div>
            {machine.notes && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">ملاحظات</h4>
                <p className="text-sm text-gray-600">{machine.notes}</p>
              </div>
            )}
            {machine.barcode && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">الباركود</h4>
                <BarcodePrint barcode={machine.barcode} title={machine.name} subtitle={machine.code} size="small" />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'stages' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {stages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">لا توجد مراحل مسجلة</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>أمر العمل</th><th>الموديل</th><th>المرحلة</th><th>الحالة</th><th>الساعات</th><th>البداية</th></tr></thead>
                <tbody>
                  {stages.map(st => (
                    <tr key={st.id} onClick={() => st.wo_number && navigate(`/work-orders/${st.wo_id}`)} className="cursor-pointer">
                      <td className="font-mono text-xs">{st.wo_number || '—'}</td>
                      <td className="text-xs">{st.model_name || '—'}</td>
                      <td className="text-xs">{st.stage_name || st.name || '—'}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          st.status === 'completed' ? 'bg-green-100 text-green-700' :
                          st.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {{ completed: 'مكتمل', in_progress: 'جاري', pending: 'معلق' }[st.status] || st.status}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{fmt(st.actual_hours || 0)}</td>
                      <td className="text-xs">{fmtDate(st.started_at)}</td>
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
