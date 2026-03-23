import { useState, useEffect } from 'react';
import { Plus, Search, Download, Upload, DollarSign, CheckCircle, XCircle, Clock, FileText, X } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import HelpButton from '../components/HelpButton';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import { exportFromBackend, importFromCSV } from '../utils/exportUtils';
import { useConfirm } from '../components/ConfirmDialog';

const TYPES = { machine: 'ماكينات', maintenance: 'صيانة', salary: 'رواتب', utilities: 'مرافق', raw_material: 'خامات', production: 'إنتاج', transport: 'نقل', other: 'أخرى' };
const STATUS_COLORS = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };
const STATUS_LABELS = { pending: 'قيد الانتظار', approved: 'معتمد', rejected: 'مرفوض' };

export default function Expenses() {
  const toast = useToast();
  const { can } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const emptyForm = { description: '', expense_type: 'other', amount: '', expense_date: new Date().toISOString().slice(0, 10), notes: '', reference_type: '', reference_id: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      const { data } = await api.get('/expenses', { params });
      setExpenses(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error('فشل تحميل المصروفات'); }
    finally { setLoading(false); }
  };

  const loadSummary = async () => {
    try {
      const { data } = await api.get('/expenses/summary');
      setSummary(data);
    } catch {}
  };

  useEffect(() => { load(); }, [search, statusFilter, typeFilter, page]);
  useEffect(() => { loadSummary(); }, []);

  const handleSave = async () => {
    if (!form.description || !form.amount) { toast.error('الوصف والمبلغ مطلوبان'); return; }
    try {
      if (editId) {
        await api.put(`/expenses/${editId}`, form);
        toast.success('تم تحديث المصروف');
      } else {
        await api.post('/expenses', form);
        toast.success('تم إضافة المصروف');
      }
      setShowModal(false);
      load();
      loadSummary();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/expenses/${id}/approve`);
      toast.success('تم اعتماد المصروف');
      load(); loadSummary();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('سبب الرفض مطلوب'); return; }
    try {
      await api.put(`/expenses/${rejectId}/reject`, { reason: rejectReason });
      toast.success('تم رفض المصروف');
      setRejectId(null);
      setRejectReason('');
      load(); loadSummary();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'حذف المصروف', message: 'هل تريد حذف هذا المصروف؟' });
    if (!ok) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('تم حذف المصروف');
      load(); loadSummary();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleExport = async () => {
    try { await exportFromBackend('/expenses/export', 'expenses'); toast.success('تم التصدير'); }
    catch { toast.error('فشل التصدير'); }
  };

  const handleImport = async () => {
    try {
      const result = await importFromCSV('/expenses/import');
      if (result) { toast.success(`تم استيراد ${result.imported || 0} سجل`); load(); loadSummary(); }
    } catch (err) { toast.error(err.message || 'فشل الاستيراد'); }
  };

  const openEdit = (e) => {
    setEditId(e.id);
    setForm({ description: e.description || '', expense_type: e.expense_type, amount: e.amount, expense_date: e.expense_date || '', notes: e.notes || '', reference_type: e.reference_type || '', reference_id: e.reference_id || '' });
    setShowModal(true);
  };

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

  return (
    <div className="page">
      {ConfirmDialog}
      <PageHeader title="المصروفات" subtitle="إدارة مصروفات المصنع"
        action={<div className="flex items-center gap-2">
          <HelpButton pageKey="expenses" />
          <button onClick={handleExport} className="btn btn-secondary text-xs"><Download size={14} /> تصدير</button>
          <PermissionGuard module="expenses" action="create">
            <button onClick={handleImport} className="btn btn-secondary text-xs"><Upload size={14} /> استيراد</button>
            <button onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true); }} className="btn btn-gold"><Plus size={16} /> مصروف جديد</button>
          </PermissionGuard>
        </div>} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2"><DollarSign size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(summary.total_this_year)} ج</p>
          <p className="text-xs text-gray-400">إجمالي السنة</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 text-green-600 mb-2"><CheckCircle size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(summary.pending_total)} ج</p>
          <p className="text-xs text-gray-400">معلق للاعتماد</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-yellow-50 text-yellow-600 mb-2"><Clock size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{summary.pending_count || 0}</p>
          <p className="text-xs text-gray-400">قيد الانتظار</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 mb-2"><FileText size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(summary.total_this_month)} ج</p>
          <p className="text-xs text-gray-400">هذا الشهر</p>
        </div>
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
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
          <option value="">كل الأنواع</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-500 text-xs">
              <th className="text-right py-3 px-3 font-medium">الوصف</th>
              <th className="text-right py-3 px-3 font-medium">النوع</th>
              <th className="text-right py-3 px-3 font-medium">المبلغ</th>
              <th className="text-right py-3 px-3 font-medium">التاريخ</th>
              <th className="text-right py-3 px-3 font-medium">الحالة</th>
              <th className="text-right py-3 px-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-400">جاري التحميل...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-400">لا توجد مصروفات</td></tr>
            ) : expenses.map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="py-3 px-3 font-medium">{e.description}</td>
                <td className="py-3 px-3 text-gray-500">{TYPES[e.expense_type] || e.expense_type}</td>
                <td className="py-3 px-3 font-mono font-bold">{fmt(e.amount)} ج</td>
                <td className="py-3 px-3 text-gray-500">{e.expense_date || '—'}</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[e.status] || e.status}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1">
                    {e.status === 'pending' && can('expenses', 'approve') && (
                      <>
                        <button onClick={() => handleApprove(e.id)} className="text-green-600 hover:bg-green-50 p-1 rounded" title="اعتماد"><CheckCircle size={16} /></button>
                        <button onClick={() => { setRejectId(e.id); setRejectReason(''); }} className="text-red-600 hover:bg-red-50 p-1 rounded" title="رفض"><XCircle size={16} /></button>
                      </>
                    )}
                    {e.status === 'pending' && can('expenses', 'edit') && (
                      <button onClick={() => openEdit(e)} className="text-blue-600 hover:bg-blue-50 p-1 rounded text-xs">تعديل</button>
                    )}
                    {can('expenses', 'delete') && (
                      <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:bg-red-50 p-1 rounded text-xs">حذف</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={total} page={page} pageSize={pageSize} onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }} />

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg" style={{ color: 'var(--color-navy)' }}>{editId ? 'تعديل مصروف' : 'مصروف جديد'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الوصف *</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">النوع</label>
                  <select value={form.expense_type} onChange={e => setForm({ ...form, expense_type: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">المبلغ *</label>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">التاريخ</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">نوع المرجع</label>
                  <select value={form.reference_type} onChange={e => setForm({ ...form, reference_type: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                    <option value="">بدون</option>
                    <option value="machine">ماكينة</option>
                    <option value="work_order">أمر تشغيل</option>
                    <option value="maintenance">صيانة</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">رقم المرجع</label>
                  <input value={form.reference_id} onChange={e => setForm({ ...form, reference_id: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">ملاحظات</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">إلغاء</button>
              <button onClick={handleSave} className="btn btn-gold">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRejectId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold" style={{ color: 'var(--color-navy)' }}>سبب الرفض</h3>
              <button onClick={() => setRejectId(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4">
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="أدخل سبب الرفض..."
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none resize-none" />
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t">
              <button onClick={() => setRejectId(null)} className="btn btn-secondary">إلغاء</button>
              <button onClick={handleReject} className="btn btn-gold" style={{ background: '#dc2626' }}>رفض</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
