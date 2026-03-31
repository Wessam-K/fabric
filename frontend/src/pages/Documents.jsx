import { useState, useEffect } from 'react';
import { Plus, Search, FileText, Eye, X, Upload, Trash2, Download } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmDialog';
import HelpButton from '../components/HelpButton';

const CATEGORY_LABELS = { general: 'عام', contract: 'عقد', invoice: 'فاتورة', report: 'تقرير', certificate: 'شهادة', specification: 'مواصفات', drawing: 'رسم', photo: 'صورة', other: 'أخرى' };

export default function Documents() {
  const toast = useToast();
  const { can } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', entity_type: '', entity_id: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const { data } = await api.get('/documents', { params });
      setDocs(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error('فشل التحميل'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, categoryFilter]);

  const upload = async () => {
    if (!file) return toast.error('اختر ملف');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', form.title || file.name);
    if (form.description) fd.append('description', form.description);
    if (form.category) fd.append('category', form.category);
    if (form.entity_type) fd.append('entity_type', form.entity_type);
    if (form.entity_id) fd.append('entity_id', form.entity_id);
    try {
      await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('تم رفع الملف');
      setShowUpload(false);
      setFile(null);
      setForm({ title: '', description: '', category: 'general', entity_type: '', entity_id: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل الرفع'); }
  };

  const viewDetail = async (id) => {
    try { const { data } = await api.get(`/documents/${id}`); setSelected(data); setShowDetail(true); }
    catch { toast.error('فشل التحميل'); }
  };

  const remove = async (id) => {
    const ok = await confirm({ title: 'حذف المستند', message: 'هل أنت متأكد من حذف هذا المستند؟' });
    if (!ok) return;
    try { await api.delete(`/documents/${id}`); toast.success('تم الحذف'); load(); setShowDetail(false); }
    catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <ConfirmDialog />
      <PageHeader title="المستندات" icon={FileText} action={<HelpButton pageKey="documents" />} />

      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="بحث..." className="w-full pr-10 pl-4 py-2.5 border rounded-xl text-sm" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border rounded-xl px-3 py-2.5 text-sm">
          <option value="">كل الفئات</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <PermissionGuard module="documents" action="create">
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2.5 rounded-xl font-bold hover:bg-[#b8973f]"><Upload size={18} /> رفع ملف</button>
        </PermissionGuard>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : docs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border"><FileText size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">لا توجد مستندات</p></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="p-3 text-right">العنوان</th><th className="p-3 text-right">الفئة</th><th className="p-3 text-center">النوع</th><th className="p-3 text-center">الحجم</th><th className="p-3 text-right">بواسطة</th><th className="p-3 text-center">إجراءات</th></tr></thead>
            <tbody className="divide-y">
              {docs.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="p-3 font-bold">{d.title}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{CATEGORY_LABELS[d.category] || d.category}</span></td>
                  <td className="p-3 text-center text-gray-500 font-mono text-xs">{d.mime_type?.split('/').pop() || '-'}</td>
                  <td className="p-3 text-center text-gray-500">{formatSize(d.file_size)}</td>
                  <td className="p-3 text-gray-600">{d.uploaded_by_name || '-'}</td>
                  <td className="p-3 text-center flex justify-center gap-1">
                    <button onClick={() => viewDetail(d.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Eye size={16} /></button>
                    {can('documents', 'delete') && <button onClick={() => remove(d.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination current={page} total={total} pageSize={25} onChange={setPage} />
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">رفع مستند جديد</h2>
              <button onClick={() => setShowUpload(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">الملف *</label>
                <input type="file" onChange={e => setFile(e.target.files[0])} className="w-full border rounded-lg px-3 py-2 text-sm" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip" />
              </div>
              <div><label className="block text-sm font-medium mb-1">العنوان</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="اسم الملف" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">الفئة</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium mb-1">الوصف</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">نوع الكيان</label><input value={form.entity_type} onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))} placeholder="مثال: work_order" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">رقم الكيان</label><input value={form.entity_id} onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">إلغاء</button>
              <button onClick={upload} className="px-4 py-2 text-sm bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold hover:bg-[#b8973f]">رفع</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">{selected.title}</h2>
              <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الفئة</p><p className="font-bold">{CATEGORY_LABELS[selected.category] || selected.category}</p></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الحجم</p><p className="font-bold">{formatSize(selected.file_size)}</p></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">النوع</p><p className="font-bold text-xs font-mono">{selected.mime_type || '-'}</p></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">بواسطة</p><p className="font-bold">{selected.uploaded_by_name || '-'}</p></div>
              </div>
              {selected.description && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 mb-1">الوصف</p><p className="text-sm">{selected.description}</p></div>}
              {selected.file_path && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 mb-1">المسار</p><p className="text-xs font-mono break-all">{selected.file_path}</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
