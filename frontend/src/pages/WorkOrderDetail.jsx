import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Circle, Clock, Play, SkipForward, Save, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/Toast';

const STATUS_MAP = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
};

const STAGE_ICON = {
  pending: <Circle size={16} className="text-gray-300" />,
  in_progress: <Clock size={16} className="text-blue-500 animate-pulse" />,
  completed: <CheckCircle size={16} className="text-green-500" />,
  skipped: <SkipForward size={16} className="text-gray-400" />,
};

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [wo, setWo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const load = async () => {
    try {
      const { data } = await axios.get(`/api/workorders/${id}`);
      setWo(data);
      setForm({ quantity: data.quantity, priority: data.priority, status: data.status, assigned_to: data.assigned_to || '', due_date: data.due_date || '', notes: data.notes || '' });
    } catch { toast.error('فشل تحميل أمر العمل'); navigate('/workorders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    try {
      await axios.put(`/api/workorders/${id}`, form);
      toast.success('تم التحديث بنجاح');
      setEditing(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleStageAction = async (stage_id, status) => {
    try {
      const { data } = await axios.patch(`/api/workorders/${id}/stage`, { stage_id, status });
      setWo(data);
      toast.success('تم تحديث المرحلة');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف أمر العمل؟')) return;
    try {
      await axios.delete(`/api/workorders/${id}`);
      toast.success('تم الحذف');
      navigate('/workorders');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleStart = async () => {
    try {
      await axios.put(`/api/workorders/${id}`, { status: 'in_progress' });
      toast.success('تم بدء أمر العمل');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>;
  }

  if (!wo) return null;

  const completedStages = wo.stages?.filter(s => s.status === 'completed').length || 0;
  const totalStages = wo.stages?.length || 0;
  const progressPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/workorders')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowRight size={20} /></button>
          <div>
            <h2 className="text-xl font-bold text-[#1a1a2e] flex items-center gap-2">
              <span className="font-mono text-[#c9a84c]">{wo.wo_number}</span>
              <span className={`text-[10px] px-2 py-1 rounded-full ${STATUS_MAP[wo.status]?.color}`}>{STATUS_MAP[wo.status]?.label}</span>
            </h2>
            <p className="text-xs text-gray-400">{wo.model_code} — {wo.model_name || wo.serial_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {wo.status === 'draft' && (
            <button onClick={handleStart} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold"><Play size={14} /> بدء التنفيذ</button>
          )}
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700">
            <Save size={14} /> {editing ? 'عرض' : 'تعديل'}
          </button>
          <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details + Edit */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">تفاصيل الأمر</h3>
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">الكمية</label>
                    <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
                  </div>
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
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">الحالة</label>
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ملاحظات</label>
                  <textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none resize-none" />
                </div>
                <button onClick={handleSave} className="px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold">حفظ التعديلات</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">الكمية:</span> <span className="font-mono font-bold">{wo.quantity} قطعة</span></div>
                <div><span className="text-gray-400">الأولوية:</span> <span className="font-bold">{({low:'منخفض',normal:'عادي',high:'عالي',urgent:'عاجل'})[wo.priority]}</span></div>
                <div><span className="text-gray-400">المسؤول:</span> <span className="font-bold">{wo.assigned_to || '—'}</span></div>
                <div><span className="text-gray-400">تاريخ التسليم:</span> <span className="font-mono">{wo.due_date ? new Date(wo.due_date).toLocaleDateString('ar-EG') : '—'}</span></div>
                {wo.start_date && <div><span className="text-gray-400">بدء:</span> <span className="font-mono">{new Date(wo.start_date).toLocaleDateString('ar-EG')}</span></div>}
                {wo.end_date && <div><span className="text-gray-400">انتهاء:</span> <span className="font-mono">{new Date(wo.end_date).toLocaleDateString('ar-EG')}</span></div>}
                {wo.notes && <div className="col-span-2"><span className="text-gray-400">ملاحظات:</span> <span>{wo.notes}</span></div>}
              </div>
            )}
          </div>

          {/* Stage Checklist */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">مراحل الإنتاج</h3>
            <div className="space-y-3">
              {(wo.stages || []).map((stage, i) => (
                <div key={stage.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  stage.status === 'completed' ? 'border-green-200 bg-green-50/50' :
                  stage.status === 'in_progress' ? 'border-blue-200 bg-blue-50/50' :
                  'border-gray-100 bg-gray-50/30'
                }`}>
                  {STAGE_ICON[stage.status]}
                  <div className="flex-1">
                    <span className="text-sm font-bold" style={{ color: stage.color }}>{stage.stage_name}</span>
                    {stage.completed_at && <span className="text-[10px] text-gray-400 mr-2">{new Date(stage.completed_at).toLocaleDateString('ar-EG')}</span>}
                  </div>
                  {wo.status === 'in_progress' && stage.status === 'pending' && (
                    <button onClick={() => handleStageAction(stage.stage_id, 'in_progress')}
                      className="text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600">بدء</button>
                  )}
                  {wo.status === 'in_progress' && stage.status === 'in_progress' && (
                    <button onClick={() => handleStageAction(stage.stage_id, 'completed')}
                      className="text-xs px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600">إكمال</button>
                  )}
                  {wo.status === 'in_progress' && stage.status === 'pending' && (
                    <button onClick={() => handleStageAction(stage.stage_id, 'skipped')}
                      className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600">تخطي</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Progress */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4e] rounded-2xl p-5 text-white">
            <h4 className="text-xs text-gray-300 mb-3">التقدم</h4>
            <div className="text-center mb-3">
              <span className="text-4xl font-bold font-mono text-[#c9a84c]">{progressPct}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-[#c9a84c] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-gray-400 text-center">{completedStages} من {totalStages} مراحل مكتملة</p>
          </div>

          {/* Model info */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h4 className="text-xs text-gray-400 mb-3">الموديل</h4>
            <p className="font-mono font-bold text-[#c9a84c]">{wo.model_code}</p>
            <p className="text-sm text-[#1a1a2e] font-bold">{wo.model_name || '—'}</p>
            {wo.variant_name && <p className="text-xs text-gray-400 mt-1">المتغير: {wo.variant_name}</p>}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h4 className="text-xs text-gray-400 mb-3">الجدول الزمني</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">الإنشاء</span><span className="font-mono text-xs">{new Date(wo.created_at).toLocaleDateString('ar-EG')}</span></div>
              {wo.start_date && <div className="flex justify-between"><span className="text-gray-400">البدء</span><span className="font-mono text-xs">{new Date(wo.start_date).toLocaleDateString('ar-EG')}</span></div>}
              {wo.due_date && <div className="flex justify-between"><span className="text-gray-400">التسليم</span><span className="font-mono text-xs">{new Date(wo.due_date).toLocaleDateString('ar-EG')}</span></div>}
              {wo.end_date && <div className="flex justify-between"><span className="text-green-600">الانتهاء</span><span className="font-mono text-xs">{new Date(wo.end_date).toLocaleDateString('ar-EG')}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
