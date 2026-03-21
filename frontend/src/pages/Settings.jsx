import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, GripVertical, Factory } from 'lucide-react';
import { PageHeader, LoadingState } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const FIELDS = [
  { key: 'masnaiya_default', label: 'المصنعية الافتراضية (ج)', type: 'number' },
  { key: 'masrouf_default', label: 'المصروف الافتراضي (ج)', type: 'number' },
  { key: 'waste_pct_default', label: 'نسبة الهدر الافتراضية %', type: 'number' },
  { key: 'margin_default', label: 'هامش الربح الافتراضي %', type: 'number' },
];

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState({});
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStage, setNewStage] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/settings'),
      api.get('/settings/stages'),
    ])
      .then(([settingsRes, stagesRes]) => {
        setSettings(settingsRes.data);
        setStages(stagesRes.data);
      })
      .catch(() => toast.error('فشل تحميل الإعدادات'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings', settings);
      setSettings(data);
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch { toast.error('فشل حفظ الإعدادات'); }
    finally { setSaving(false); }
  };

  const addStage = async () => {
    if (!newStage.trim()) return;
    try {
      await api.post('/settings/stages', { name: newStage.trim() });
      setNewStage('');
      const { data } = await api.get('/settings/stages');
      setStages(data);
      toast.success('تمت إضافة المرحلة');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const deleteStage = async (id) => {
    if (!confirm('حذف هذه المرحلة؟')) return;
    try {
      await api.delete(`/settings/stages/${id}`);
      const { data } = await api.get('/settings/stages');
      setStages(data);
      toast.success('تم الحذف');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const toggleStage = async (stage) => {
    try {
      await api.put(`/settings/stages/${stage.id}`, { is_default: stage.is_default ? 0 : 1 });
      const { data } = await api.get('/settings/stages');
      setStages(data);
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const updateStageColor = async (stage, color) => {
    try {
      await api.put(`/settings/stages/${stage.id}`, { color });
      const { data } = await api.get('/settings/stages');
      setStages(data);
    } catch { /* */ }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="page">
      <PageHeader title="الإعدادات" subtitle="القيم الافتراضية ومراحل الإنتاج"
        action={<button onClick={handleSave} disabled={saving} className="btn btn-gold"><Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ'}</button>} />

      {/* Default Values */}
      <div className="card card-body space-y-5">
        <h3 className="section-title">القيم الافتراضية</h3>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          هذه القيم ستُطبَّق تلقائياً على كل موديل جديد
        </div>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-sm text-gray-600 mb-1">{f.label}</label>
            <input
              type={f.type}
              value={settings[f.key] ?? ''}
              onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none"
            />
          </div>
        ))}
      </div>

      {/* Production Stages */}
      <div className="card card-body space-y-4">
        <div className="flex items-center gap-2">
          <Factory size={18} className="text-blue-600" />
          <h3 className="section-title">مراحل الإنتاج</h3>
          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{stages.length}</span>
        </div>
        <p className="text-xs text-gray-400">تُستخدم في أوامر الإنتاج لتتبع تقدم كل أمر</p>

        <div className="space-y-2">
          {stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-xs text-gray-400 font-mono w-6">{i + 1}</span>
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#3b82f6' }} />
              <input type="color" value={stage.color || '#3b82f6'} onChange={e => updateStageColor(stage, e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0" title="تغيير اللون" />
              <span className={`flex-1 text-sm font-bold ${stage.is_default ? 'text-[#1a1a2e]' : 'text-gray-400 line-through'}`}>{stage.name}</span>
              <button onClick={() => toggleStage(stage)}
                className={`text-[10px] px-2 py-1 rounded ${stage.is_default ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {stage.is_default ? 'مفعّل' : 'معطّل'}
              </button>
              <button onClick={() => deleteStage(stage.id)} className="text-red-400 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input type="text" value={newStage} onChange={e => setNewStage(e.target.value)}
            placeholder="اسم مرحلة جديدة..."
            onKeyDown={e => e.key === 'Enter' && addStage()}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
          <button onClick={addStage}
            className="flex items-center gap-1 px-4 py-2 bg-[#c9a84c] text-white rounded-lg text-sm font-bold">
            <Plus size={14} /> إضافة
          </button>
        </div>
      </div>
    </div>
  );
}
