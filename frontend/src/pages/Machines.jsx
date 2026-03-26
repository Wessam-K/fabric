import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Settings, Clock, Wrench, X, MapPin, Activity, Download, Upload, Barcode } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import HelpButton from '../components/HelpButton';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import { exportFromBackend, importFromCSV } from '../utils/exportUtils';

const STATUS_MAP = { active: 'نشطة', maintenance: 'صيانة', inactive: 'متوقفة' };
const STATUS_COLOR = { active: 'bg-green-100 text-green-700', maintenance: 'bg-yellow-100 text-yellow-700', inactive: 'bg-gray-200 text-gray-500' };

export default function Machines() {
  const toast = useToast();
  const { can } = useAuth();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [barcodeSearch, setBarcodeSearch] = useState('');

  const emptyForm = { name: '', machine_type: '', location: '', capacity_per_hour: '', cost_per_hour: '', notes: '', sort_order: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/machines', { params });
      setMachines(data);
    } catch { toast.error('فشل تحميل الماكينات'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (m) => {
    setEditId(m.id);
    setForm({ name: m.name, machine_type: m.machine_type || '', location: m.location || '', capacity_per_hour: m.capacity_per_hour || '', cost_per_hour: m.cost_per_hour || '', notes: m.notes || '', sort_order: m.sort_order || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('اسم الماكينة مطلوب'); return; }
    try {
      if (editId) {
        await api.patch(`/machines/${editId}`, form);
        toast.success('تم تحديث الماكينة');
      } else {
        await api.post('/machines', form);
        toast.success('تم إضافة الماكينة');
      }
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const toggleStatus = async (m) => {
    const newStatus = m.status === 'active' ? 'maintenance' : 'active';
    try {
      await api.patch(`/machines/${m.id}`, { status: newStatus });
      toast.success(`تم تغيير الحالة إلى ${STATUS_MAP[newStatus]}`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const active = machines.filter(m => m.status === 'active').length;
  const maintenance = machines.filter(m => m.status === 'maintenance').length;

  const handleExport = async () => {
    try { await exportFromBackend('/machines/export', 'machines'); toast.success('تم التصدير'); }
    catch { toast.error('فشل التصدير'); }
  };

  const handleImport = async () => {
    try {
      const result = await importFromCSV('/machines/import');
      if (result) { toast.success(`تم استيراد ${result.imported || 0} ماكينة`); load(); }
    } catch (err) { toast.error(err.message || 'فشل الاستيراد'); }
  };

  const handleBarcodeSearch = async () => {
    if (!barcodeSearch.trim()) return;
    try {
      const { data } = await api.get(`/machines/barcode/${barcodeSearch.trim()}`);
      if (data) { setMachines([data]); toast.success('تم العثور على الماكينة'); }
    } catch { toast.error('لم يتم العثور على ماكينة بهذا الباركود'); }
  };

  return (
    <div className="page">
      <PageHeader title="الماكينات" subtitle="إدارة ماكينات ومراكز الإنتاج"
        action={<div className="flex items-center gap-2">
          <HelpButton pageKey="machines" />
          <button onClick={handleExport} className="btn btn-secondary text-xs"><Download size={14} /> تصدير</button>
          <PermissionGuard module="machines" action="create">
            <button onClick={handleImport} className="btn btn-secondary text-xs"><Upload size={14} /> استيراد</button>
            <button onClick={openCreate} className="btn btn-gold"><Plus size={16} /> ماكينة جديدة</button>
          </PermissionGuard>
        </div>} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2"><Settings size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{machines.length}</p>
          <p className="text-xs text-gray-400">إجمالي الماكينات</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 text-green-600 mb-2"><Activity size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{active}</p>
          <p className="text-xs text-gray-400">نشطة</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-yellow-50 text-yellow-600 mb-2"><Wrench size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{maintenance}</p>
          <p className="text-xs text-gray-400">في الصيانة</p>
        </div>
        <div className="stat-card">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 mb-2"><Clock size={18} /></div>
          <p className="text-2xl font-bold font-mono" style={{color:'var(--color-navy)'}}>{machines.reduce((s, m) => s + (m.total_hours || 0), 0)}</p>
          <p className="text-xs text-gray-400">ساعات تشغيل</p>
        </div>
      </div>

      {/* Filters */}
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
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setBarcodeSearch(''); }} placeholder="بحث بالاسم أو الكود أو الموقع..."
            className="w-full pr-9 pl-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
          <option value="">كل الحالات</option>
          <option value="active">نشطة</option>
          <option value="maintenance">صيانة</option>
          <option value="inactive">متوقفة</option>
        </select>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>
      ) : machines.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl shadow-sm">لا توجد ماكينات</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map(m => (
            <div key={m.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/machines/${m.id}`} className="font-bold text-[#1a1a2e] hover:text-[#c9a84c] transition-colors block">{m.name}</Link>
                  <p className="text-xs text-gray-400 font-mono">{m.code}</p>
                  {m.barcode && <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1"><Barcode size={10} /> {m.barcode}</p>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLOR[m.status] || STATUS_COLOR.inactive}`}>{STATUS_MAP[m.status] || m.status}</span>
              </div>
              {m.machine_type && <p className="text-xs text-gray-500">النوع: {m.machine_type}</p>}
              {m.location && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12} /> {m.location}</p>}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-2 border-t border-gray-100">
                <div><span className="block font-mono font-bold text-sm text-blue-600">{m.active_stages || 0}</span>مراحل نشطة</div>
                <div><span className="block font-mono font-bold text-sm text-[#1a1a2e]">{m.total_stages || 0}</span>إجمالي مراحل</div>
                <div><span className="block font-mono font-bold text-sm text-purple-600">{m.total_hours || 0}</span>ساعة</div>
              </div>
              <div className="flex gap-2 pt-1">
                {can('machines', 'edit') && <button onClick={() => openEdit(m)} className="flex-1 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600">تعديل</button>}
                {can('machines', 'edit') && <button onClick={() => toggleStatus(m)} className={`flex-1 text-xs px-3 py-1.5 rounded-lg ${m.status === 'active' ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700' : 'bg-green-50 hover:bg-green-100 text-green-700'}`}>
                  {m.status === 'active' ? 'صيانة' : 'تنشيط'}
                </button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1a1a2e]">{editId ? 'تعديل ماكينة' : 'ماكينة جديدة'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">الاسم *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">النوع</label>
                <input type="text" value={form.machine_type} onChange={e => setForm({...form, machine_type: e.target.value})} placeholder="مثال: خياطة"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">الموقع</label>
                <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="مثال: خط إنتاج 1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">الطاقة (قطعة/ساعة)</label>
                <input type="number" min="0" step="1" value={form.capacity_per_hour} onChange={e => setForm({...form, capacity_per_hour: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">التكلفة (ج.م/ساعة)</label>
                <input type="number" min="0" step="0.5" value={form.cost_per_hour} onChange={e => setForm({...form, cost_per_hour: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ملاحظات</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleSave} className="px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
