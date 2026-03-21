import { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Edit3, X, Check } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { ConfirmDialog } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import HelpButton from '../components/HelpButton';

export default function StageTemplates() {
  const toast = useToast();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#6b7280' });
  const [deleteId, setDeleteId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/stage-templates');
      setStages(data);
    } catch { toast.error('فشل تحميل القوالب'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm({ name: '', color: '#6b7280' }); setShowForm(true); };
  const openEdit = (s) => { setEditId(s.id); setForm({ name: s.name, color: s.color || '#6b7280' }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('اسم المرحلة مطلوب'); return; }
    try {
      if (editId) {
        await api.put(`/stage-templates/${editId}`, form);
        toast.success('تم تحديث المرحلة');
      } else {
        await api.post('/stage-templates', form);
        toast.success('تم إضافة المرحلة');
      }
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/stage-templates/${deleteId}`);
      toast.success('تم حذف المرحلة');
      setDeleteId(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const moveStage = async (index, direction) => {
    const newStages = [...stages];
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= newStages.length) return;
    [newStages[index], newStages[swapIdx]] = [newStages[swapIdx], newStages[index]];
    const order = newStages.map((s, i) => ({ id: s.id, sort_order: i + 1 }));
    try {
      await api.put('/stage-templates/reorder', { order });
      setStages(newStages);
    } catch { toast.error('فشل إعادة الترتيب'); }
  };

  return (
    <div className="page">
      <PageHeader title="قوالب المراحل" subtitle="إدارة مراحل الإنتاج الافتراضية"
        action={<div className="flex items-center gap-2"><HelpButton pageKey="stagetemplates" /><button onClick={openCreate} className="btn btn-gold"><Plus size={16} /> مرحلة جديدة</button></div>} />

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8 text-gray-400">جاري التحميل...</div>
          ) : stages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">لا توجد مراحل بعد</div>
          ) : (
            <div className="space-y-2">
              {stages.map((stage, idx) => (
                <div key={stage.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveStage(idx, -1)} disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-0.5">
                      <GripVertical size={14} className="rotate-180" />
                    </button>
                    <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-0.5">
                      <GripVertical size={14} />
                    </button>
                  </div>
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#6b7280' }} />
                  <span className="text-sm font-semibold text-[#1a1a2e] flex-1">{stage.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono">#{stage.sort_order}</span>
                  <button onClick={() => openEdit(stage)} className="text-gray-400 hover:text-blue-600 p-1"><Edit3 size={14} /></button>
                  <button onClick={() => setDeleteId(stage.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-sm font-bold text-[#1a1a2e]">{editId ? 'تعديل المرحلة' : 'مرحلة جديدة'}</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">اسم المرحلة</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c9a84c]"
                placeholder="مثال: القص" autoFocus />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">اللون</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0" />
                <span className="text-xs text-gray-400 font-mono">{form.color}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="btn btn-outline btn-sm"><X size={14} /> إلغاء</button>
              <button onClick={handleSave} className="btn btn-gold btn-sm"><Check size={14} /> حفظ</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteId} title="حذف المرحلة" message="هل أنت متأكد من حذف هذه المرحلة؟" danger
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
