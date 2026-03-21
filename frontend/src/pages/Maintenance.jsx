import { useState, useEffect } from 'react';
import { Plus, Search, Download, Upload, Wrench, AlertTriangle, Clock, CheckCircle, Barcode, X } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import HelpButton from '../components/HelpButton';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import { exportFromBackend, importFromCSV } from '../utils/exportUtils';

const PRIORITY_COLORS = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' };
const PRIORITY_LABELS = { critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' };
const STATUS_COLORS = { pending: 'bg-blue-100 text-blue-700', in_progress: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500' };
const STATUS_LABELS = { pending: 'معلّق', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' };
const TYPES = { preventive: 'وقائية', corrective: 'تصحيحية', emergency: 'طارئة', routine: 'روتينية' };

export default function Maintenance() {
  const toast = useToast();
  const { can } = useAuth();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [machines, setMachines] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [barcodeSearch, setBarcodeSearch] = useState('');

  const emptyForm = { machine_id: '', title: '', description: '', maintenance_type: 'corrective', priority: 'medium', cost: '', performed_by: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const { data } = await api.get('/maintenance', { params });
      setOrders(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error('فشل تحميل أوامر الصيانة'); }
    finally { setLoading(false); }
  };

  const loadStats = async () => {
    try { const { data } = await api.get('/maintenance/stats'); setStats(data); } catch {}
  };

  const loadMachines = async () => {
    try { const { data } = await api.get('/machines'); setMachines(Array.isArray(data) ? data : data.data || []); } catch {}
  };

  useEffect(() => { load(); }, [search, statusFilter, priorityFilter, page]);
  useEffect(() => { loadStats(); loadMachines(); }, []);

  const handleSave = async () => {
    if (!form.machine_id || !form.title) { toast.error('الماكينة والعنوان مطلوبان'); return; }
    try {
      if (editId) {
        await api.put(`/maintenance/${editId}`, form);
        toast.success('تم تحديث أمر الصيانة');
      } else {
        await api.post('/maintenance', form);
        toast.success('تم إنشاء أمر الصيانة');
      }
      setShowModal(false);
      load(); loadStats();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف أمر الصيانة؟')) return;
    try {
      await api.delete(`/maintenance/${id}`);
      toast.success('تم الحذف');
      load(); loadStats();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleExport = async () => {
    try { await exportFromBackend('/maintenance/export', 'maintenance'); toast.success('تم التصدير'); }
    catch { toast.error('فشل التصدير'); }
  };

  const handleImport = async () => {
    try {
      const result = await importFromCSV('/maintenance/import');
      if (result) { toast.success(`تم استيراد ${result.imported || 0} سجل`); load(); loadStats(); }
    } catch (err) { toast.error(err.message || 'فشل الاستيراد'); }
  };

  const handleBarcodeSearch = async () => {
    if (!barcodeSearch.trim()) return;
    try {
      const { data } = await api.get(`/maintenance/barcode/${barcodeSearch.trim()}`);
      if (data) {
        setOrders([data]);
        setTotal(1);
        toast.success('تم العثور على أمر الصيانة');
      }
    } catch { toast.error('لم يتم العثور على أمر بهذا الباركود'); }
  };

  const openEdit = (o) => {
    setEditId(o.id);
    setForm({ machine_id: o.machine_id, title: o.title || '', description: o.description || '', maintenance_type: o.maintenance_type || 'corrective', priority: o.priority || 'medium', cost: o.cost || '', performed_by: o.performed_by || '', status: o.status });
    setShowModal(true);
  };

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

  return (
    <div className="page">
      <PageHeader title="أوامر الصيانة" subtitle="إدارة صيانة الماكينات"
        action={<div className="flex items-center gap-2">
          <HelpButton pageKey="maintenance" />
          <button onClick={handleExport} className="btn btn-secondary text-xs"><Download size={14} /> تصدير</button>
          <PermissionGuard module="maintenance" action="create">
            <button onClick={handleImport} className="btn btn-secondary text-xs"><Upload size={14} /> استيراد</button>
            <button onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true); }} className="btn btn-gold"><Plus size={16} /> أمر صيانة</button>
          </PermissionGuard>
        </div>} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2"><Wrench size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{stats.total_orders || 0}</p>
          <p className="text-xs text-gray-400">إجمالي الأوامر</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-yellow-50 text-yellow-600 mb-2"><Clock size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{stats.pending_count || 0}</p>
          <p className="text-xs text-gray-400">معلقة</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 text-red-600 mb-2"><AlertTriangle size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{stats.critical_count || 0}</p>
          <p className="text-xs text-gray-400">حرجة</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 text-green-600 mb-2"><CheckCircle size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-navy)' }}>{fmt(stats.total_cost_this_month)} ج</p>
          <p className="text-xs text-gray-400">إجمالي التكلفة</p>
        </div>
      </div>

      {/* Barcode + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex items-center gap-1">
          <Barcode size={15} className="text-gray-400" />
          <input type="text" value={barcodeSearch} onChange={e => setBarcodeSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBarcodeSearch()}
            placeholder="باركود..."
            className="w-32 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setBarcodeSearch(''); }} placeholder="بحث..."
            className="w-full pr-9 pl-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
          <option value="">كل الأولويات</option>
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-500 text-xs">
              <th className="text-right py-3 px-3 font-medium">باركود</th>
              <th className="text-right py-3 px-3 font-medium">العنوان</th>
              <th className="text-right py-3 px-3 font-medium">الماكينة</th>
              <th className="text-right py-3 px-3 font-medium">النوع</th>
              <th className="text-right py-3 px-3 font-medium">الأولوية</th>
              <th className="text-right py-3 px-3 font-medium">الحالة</th>
              <th className="text-right py-3 px-3 font-medium">التكلفة</th>
              <th className="text-right py-3 px-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center py-8 text-gray-400">جاري التحميل...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-8 text-gray-400">لا توجد أوامر صيانة</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="py-3 px-3 font-mono text-xs text-gray-500">{o.barcode || '—'}</td>
                <td className="py-3 px-3 font-medium">{o.title}</td>
                <td className="py-3 px-3 text-gray-500">{o.machine_name || `#${o.machine_id}`}</td>
                <td className="py-3 px-3 text-gray-500">{TYPES[o.maintenance_type] || o.maintenance_type}</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[o.priority] || 'bg-gray-100'}`}>
                    {PRIORITY_LABELS[o.priority] || o.priority}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
                <td className="py-3 px-3 font-mono">{o.cost ? `${fmt(o.cost)} ج` : '—'}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1">
                    {can('maintenance', 'update') && o.status !== 'completed' && o.status !== 'cancelled' && (
                      <button onClick={() => openEdit(o)} className="text-blue-600 hover:bg-blue-50 p-1 rounded text-xs">تعديل</button>
                    )}
                    {can('maintenance', 'delete') && (
                      <button onClick={() => handleDelete(o.id)} className="text-red-400 hover:bg-red-50 p-1 rounded text-xs">حذف</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={total} page={page} pageSize={pageSize} onPageChange={setPage} />

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg" style={{ color: 'var(--color-navy)' }}>{editId ? 'تعديل أمر صيانة' : 'أمر صيانة جديد'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الماكينة *</label>
                <select value={form.machine_id} onChange={e => setForm({ ...form, machine_id: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                  <option value="">اختر ماكينة</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.machine_type})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">العنوان *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">النوع</label>
                  <select value={form.maintenance_type} onChange={e => setForm({ ...form, maintenance_type: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">الأولوية</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">التكلفة</label>
                  <input type="number" step="0.01" min="0" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
                </div>
              </div>
              {editId && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">الحالة</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الوصف</label>
                <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الفني المنفذ</label>
                <input value={form.performed_by} onChange={e => setForm({ ...form, performed_by: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">إلغاء</button>
              <button onClick={handleSave} className="btn btn-gold">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
