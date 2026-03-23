import { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Download, RefreshCw, Shield, X } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';

export default function Backups() {
  const toast = useToast();
  const { can } = useAuth();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/backups'); setBackups(data || []); }
    catch { toast.error('فشل التحميل'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/backups');
      toast.success('تم إنشاء النسخة الاحتياطية');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل إنشاء النسخة'); }
    finally { setCreating(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه النسخة؟')) return;
    try { await api.delete(`/backups/${id}`); toast.success('تم الحذف'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  const restore = async (id) => {
    if (!window.confirm('تحذير: سيتم استبدال قاعدة البيانات الحالية. هل أنت متأكد؟')) return;
    try {
      const { data } = await api.post(`/backups/${id}/restore`);
      toast.success('يرجى إعادة تشغيل الخادم لتطبيق النسخة الاحتياطية');
    } catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return d; }
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <PageHeader title="النسخ الاحتياطية" icon={Database} />

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Shield size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-bold mb-1">حماية البيانات</p>
          <p>يتم حفظ النسخ الاحتياطية في مجلد backups على الخادم. يمكنك إنشاء نسخة احتياطية يدوياً في أي وقت.</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <PermissionGuard module="backups" action="create">
          <button onClick={createBackup} disabled={creating} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-5 py-2.5 rounded-xl font-bold hover:bg-[#b8973f] disabled:opacity-50">
            {creating ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
            {creating ? 'جاري الإنشاء...' : 'إنشاء نسخة احتياطية'}
          </button>
        </PermissionGuard>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : backups.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Database size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-2">لا توجد نسخ احتياطية</p>
          <p className="text-gray-400 text-sm">أنشئ أول نسخة احتياطية لحماية بياناتك</p>
        </div>
      ) : (
        <div className="space-y-3">
          {backups.map(b => (
            <div key={b.id} className="bg-white rounded-xl border p-4 flex items-center justify-between hover:shadow-sm transition group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1a1a2e]/5 flex items-center justify-center">
                  <Database size={22} className="text-[#1a1a2e]" />
                </div>
                <div>
                  <p className="font-bold text-[#1a1a2e]">{b.filename}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span>{formatDate(b.created_at)}</span>
                    <span>{formatSize(b.file_size)}</span>
                    {b.created_by_name && <span>بواسطة: {b.created_by_name}</span>}
                  </div>
                  {b.notes && <p className="text-xs text-gray-400 mt-1">{b.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                {can('backups', 'edit') && (
                  <button onClick={() => restore(b.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                    <RefreshCw size={14} /> استعادة
                  </button>
                )}
                {can('backups', 'delete') && (
                  <button onClick={() => remove(b.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                    <Trash2 size={14} /> حذف
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
