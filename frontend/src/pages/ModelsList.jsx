import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, FileText, Printer, List } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { PageHeader, LoadingState, EmptyState } from '../components/ui';
import HelpButton from '../components/HelpButton';

const CATEGORY_MAP = { men: 'رجالي', women: 'حريمي', kids: 'أطفال', unisex: 'يونيسكس' };

export default function ModelsList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [models, setModels] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchModels = async () => {
    try {
      const { data } = await api.get('/models', { params: search ? { search } : {} });
      setModels(data);
    } catch (err) {
      toast.error('فشل تحميل الموديلات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchModels(); }, [search]);

  const handleDelete = async (code) => {
    if (!confirm('هل تريد إلغاء تفعيل هذا الموديل؟')) return;
    try {
      await api.delete(`/models/${code}`);
      toast.success('تم إلغاء تفعيل الموديل');
      fetchModels();
    } catch { toast.error('فشل الحذف'); }
  };

  return (
    <div className="page">
      <PageHeader title="قائمة الموديلات" subtitle="إدارة موديلات المصنع"
        actions={<div className="flex gap-2"><HelpButton pageKey="models" /><button onClick={() => navigate('/models/new')} className="btn btn-gold"><Plus size={16} /> موديل جديد</button></div>}
      />

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="بحث بالكود أو الاسم أو التسلسلي..." className="form-input max-w-sm" />

      {loading ? <LoadingState /> : models.length === 0 ? (
        <EmptyState icon={List} message="لا توجد موديلات" sub="ابدأ بإنشاء موديل جديد" />
      ) : (
        <div className="grid gap-3">
          {models.map(m => (
            <div key={m.model_code}
              className="card card-body flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/models/${m.model_code}/edit`)}>
              <div className="w-14 h-14 rounded-lg bg-[var(--color-surface)] overflow-hidden shrink-0 flex items-center justify-center">
                {m.model_image ? <img src={m.model_image} alt="" className="w-full h-full object-cover" /> :
                  <List size={20} className="text-gray-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">{m.serial_number}</span>
                  <span className="font-mono text-sm font-bold text-[var(--color-navy)]">{m.model_code}</span>
                  {m.category && <span className="badge badge-info text-[10px]">{CATEGORY_MAP[m.category] || m.category}</span>}
                </div>
                {m.model_name && <p className="text-sm text-[var(--color-muted)] mt-0.5 truncate">{m.model_name}</p>}
                <p className="text-[10px] text-[var(--color-muted)] mt-0.5">{new Date(m.created_at).toLocaleDateString('ar-EG')}</p>
              </div>
              <div className="text-center shrink-0">
                <p className="text-[10px] text-[var(--color-muted)]">قوالب BOM</p>
                <p className="font-mono font-bold text-[var(--color-gold)] text-lg">{m.bom_template_count ?? '—'}</p>
              </div>
              <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => navigate(`/models/${m.model_code}/bom`)} className="btn btn-ghost btn-xs" title="قوالب BOM"><FileText size={16} /></button>
                <button onClick={() => navigate(`/models/${m.model_code}/edit`)} className="btn btn-ghost btn-xs"><Edit2 size={16} /></button>
                <button onClick={() => window.open(`/models/${m.model_code}/print`, '_blank')} className="btn btn-ghost btn-xs"><Printer size={16} /></button>
                <button onClick={() => handleDelete(m.model_code)} className="btn btn-ghost btn-xs" style={{color:'var(--color-danger)'}}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
