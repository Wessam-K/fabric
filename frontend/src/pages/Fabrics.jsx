import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Camera, ArrowUpDown } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { PageHeader, LoadingState, EmptyState } from '../components/ui';

const TYPES = [
  { value: '', label: 'الكل' },
  { value: 'main', label: 'أساسي' },
  { value: 'lining', label: 'بطانة' },
  { value: 'both', label: 'كلاهما' },
];

const TYPE_STYLE = {
  main: 'bg-blue-100 text-blue-700',
  lining: 'bg-green-100 text-green-700',
  both: 'bg-purple-100 text-purple-700',
};
const TYPE_LABEL = { main: 'أساسي', lining: 'بطانة', both: 'كلاهما' };

const emptyForm = { code: '', name: '', fabric_type: 'main', price_per_m: '', supplier: '', color: '', notes: '' };

export default function Fabrics() {
  const toast = useToast();
  const [fabrics, setFabrics] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [imageFile, setImageFile] = useState(null);

  const fetchFabrics = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      const { data } = await api.get('/fabrics', { params });
      setFabrics(data);
    } catch { toast.error('فشل تحميل الأقمشة'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFabrics(); }, [search, filterType]);

  const sorted = [...fabrics].sort((a, b) => {
    if (sortBy === 'price') return b.price_per_m - a.price_per_m;
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setImageFile(null); setDrawerOpen(true); };
  const openEdit = (f) => {
    setEditing(f.code);
    setForm({ code: f.code, name: f.name, fabric_type: f.fabric_type, price_per_m: String(f.price_per_m), supplier: f.supplier || '', color: f.color || '', notes: f.notes || '' });
    setImageFile(null);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.price_per_m) {
      toast.error('الكود والاسم والسعر مطلوبين');
      return;
    }
    try {
      const fd = new FormData();
      Object.keys(form).forEach(k => { if (form[k]) fd.append(k, form[k]); });
      if (imageFile) fd.append('image', imageFile);
      if (editing) {
        await api.put(`/fabrics/${editing}`, fd);
        toast.success('تم التحديث');
      } else {
        await api.post('/fabrics', fd);
        toast.success('تمت الإضافة');
      }
      setDrawerOpen(false);
      fetchFabrics();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ');
    }
  };

  const [confirmDel, setConfirmDel] = useState(null);

  const handleDelete = async (code) => {
    setConfirmDel(code);
  };
  const doDelete = async () => {
    const code = confirmDel;
    setConfirmDel(null);
    try {
      await api.delete(`/fabrics/${code}`);
      toast.success('تم إلغاء التفعيل');
      fetchFabrics();
    } catch { toast.error('فشل'); }
  };

  return (
    <div className="page">
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card card-body max-w-sm w-full mx-4">
            <h3 className="section-title mb-2">تأكيد الحذف</h3>
            <p className="text-sm text-[var(--color-muted)] mb-5">إلغاء تفعيل هذا القماش؟</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDel(null)} className="btn btn-ghost">إلغاء</button>
              <button onClick={doDelete} className="btn btn-danger">تأكيد</button>
            </div>
          </div>
        </div>
      )}
      <PageHeader title="سجل الأقمشة" subtitle={`${fabrics.length} قماش مسجل`}
        actions={<button onClick={openNew} className="btn btn-gold"><Plus size={16} /> إضافة قماش</button>}
      />

      {/* Filters bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالكود أو الاسم..."
          className="form-input flex-1 max-w-xs" />
        <div className="flex gap-1">
          {TYPES.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              className={`px-3 py-2 rounded-lg text-xs transition-colors ${filterType === t.value ? 'bg-[#c9a84c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="form-select text-xs">
          <option value="created_at">الأحدث</option>
          <option value="price">السعر</option>
          <option value="name">الاسم</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
              <div className="h-[120px] bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20">
          <Camera size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-lg text-gray-400 mb-1">لا توجد أقمشة</p>
          <p className="text-sm text-gray-300">ابدأ بإضافة قماش جديد</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-[#c9a84c] text-white rounded-lg text-sm font-bold">
            <Plus size={14} className="inline ml-1" />إضافة قماش
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(f => (
            <div key={f.code} className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
              {/* Swatch image */}
              <div className="h-[120px] bg-gray-100 relative overflow-hidden">
                {f.image_path ? (
                  <img src={f.image_path} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <Camera size={32} className="text-gray-300" />
                  </div>
                )}
                <span className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${TYPE_STYLE[f.fabric_type] || 'bg-gray-100 text-gray-600'}`}>
                  {TYPE_LABEL[f.fabric_type] || f.fabric_type}
                </span>
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button onClick={() => openEdit(f)} className="p-2 bg-white rounded-full shadow text-blue-500 hover:bg-blue-50"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(f.code)} className="p-2 bg-white rounded-full shadow text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </div>
              {/* Info */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{f.code}</span>
                  {f.color && <span className="text-[10px] text-gray-400">{f.color}</span>}
                </div>
                <p className="text-sm font-bold text-[#1a1a2e] truncate">{f.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-[#c9a84c] text-sm font-bold">{f.price_per_m} ج/م</span>
                  {f.supplier && <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{f.supplier}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-in Drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="fixed top-0 left-0 z-50 h-full w-[380px] bg-white shadow-2xl flex flex-col animate-[slideInLeft_0.25s_ease-out]">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-[#1a1a2e]">{editing ? 'تعديل قماش' : 'إضافة قماش جديد'}</h3>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Image upload zone */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-[#c9a84c] transition-colors">
                {imageFile ? (
                  <div className="relative">
                    <img src={URL.createObjectURL(imageFile)} alt="" className="w-full h-32 object-cover rounded-lg" />
                    <button onClick={() => setImageFile(null)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"><X size={12} /></button>
                  </div>
                ) : editing && fabrics.find(f => f.code === editing)?.image_path ? (
                  <div className="relative">
                    <img src={fabrics.find(f => f.code === editing).image_path} alt="" className="w-full h-32 object-cover rounded-lg" />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                      <Camera size={24} className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files[0] || null)} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Camera size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">اضغط لرفع صورة القماش</p>
                    <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files[0] || null)} />
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">الكود *</label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} readOnly={!!editing}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none ${editing ? 'bg-gray-50' : ''}`} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">النوع</label>
                  <select value={form.fabric_type} onChange={e => setForm({ ...form, fabric_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#c9a84c] outline-none">
                    <option value="main">أساسي</option>
                    <option value="lining">بطانة</option>
                    <option value="both">كلاهما</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">الاسم *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">سعر المتر *</label>
                  <input type="number" min="0" step="0.5" value={form.price_per_m} onChange={e => setForm({ ...form, price_per_m: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">اللون</label>
                  <input type="text" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">المورد</label>
                <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">ملاحظات</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none resize-none" />
              </div>
            </div>
            <div className="p-5 border-t flex gap-2">
              <button onClick={() => setDrawerOpen(false)} className="flex-1 btn btn-ghost">إلغاء</button>
              <button onClick={handleSave} className="flex-1 btn btn-gold">حفظ</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
