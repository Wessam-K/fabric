import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, CircleDot, Zap, Layers, Tag, Package, Grip, MoreHorizontal, Shield, Aperture } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/Toast';

const ACC_TYPES = [
  { value: '', label: 'الكل', icon: null },
  { value: 'button', label: 'أزرار', icon: CircleDot },
  { value: 'zipper', label: 'سوست', icon: Zap },
  { value: 'thread', label: 'خيوط', icon: Layers },
  { value: 'label', label: 'ليبلات', icon: Tag },
  { value: 'packaging', label: 'تغليف', icon: Package },
  { value: 'elastic', label: 'أستك', icon: Grip },
  { value: 'padding', label: 'حشو', icon: Shield },
  { value: 'interfacing', label: 'فازلين', icon: Aperture },
  { value: 'other', label: 'أخرى', icon: MoreHorizontal },
];

const TYPE_COLORS = {
  button: 'bg-blue-50 text-blue-600 border-blue-200',
  zipper: 'bg-amber-50 text-amber-600 border-amber-200',
  thread: 'bg-green-50 text-green-600 border-green-200',
  label: 'bg-purple-50 text-purple-600 border-purple-200',
  packaging: 'bg-pink-50 text-pink-600 border-pink-200',
  elastic: 'bg-orange-50 text-orange-600 border-orange-200',
  padding: 'bg-teal-50 text-teal-600 border-teal-200',
  interfacing: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
};

const emptyForm = { code: '', acc_type: 'button', name: '', unit_price: '', unit: 'piece', supplier: '', notes: '' };

export default function Accessories() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const fetchList = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      const { data } = await axios.get('/api/accessories', { params });
      setList(data);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, [search, filterType]);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setDrawerOpen(true); };
  const openEdit = (a) => {
    setEditing(a.code);
    setForm({ code: a.code, acc_type: a.acc_type, name: a.name, unit_price: String(a.unit_price), unit: a.unit || 'piece', supplier: a.supplier || '', notes: a.notes || '' });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.unit_price) {
      toast.error('الكود والاسم والسعر مطلوبين');
      return;
    }
    try {
      if (editing) {
        await axios.put(`/api/accessories/${editing}`, form);
        toast.success('تم التحديث');
      } else {
        await axios.post('/api/accessories', form);
        toast.success('تمت الإضافة');
      }
      setDrawerOpen(false);
      fetchList();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ');
    }
  };

  const handleDelete = async (code) => {
    if (!confirm('إلغاء تفعيل هذا الاكسسوار؟')) return;
    try {
      await axios.delete(`/api/accessories/${code}`);
      toast.success('تم إلغاء التفعيل');
      fetchList();
    } catch { toast.error('فشل'); }
  };

  const typeLabel = (t) => ACC_TYPES.find(x => x.value === t)?.label || t;
  const TypeIcon = (t) => ACC_TYPES.find(x => x.value === t)?.icon || MoreHorizontal;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">سجل الاكسسوارات</h2>
          <p className="text-xs text-gray-400 mt-0.5">{list.length} اكسسوار مسجل</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors">
          <Plus size={16} /> إضافة اكسسوار
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            className="w-full border border-gray-300 rounded-lg pr-9 pl-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {ACC_TYPES.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors ${filterType === t.value ? 'bg-[#c9a84c] text-white border-[#c9a84c]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {t.icon && <t.icon size={12} />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-lg text-gray-400 mb-1">لا توجد اكسسوارات</p>
          <p className="text-sm text-gray-300">ابدأ بإضافة اكسسوار جديد</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-[#c9a84c] text-white rounded-lg text-sm font-bold">
            <Plus size={14} className="inline ml-1" />إضافة اكسسوار
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(a => {
            const Icon = TypeIcon(a.acc_type);
            const colors = TYPE_COLORS[a.acc_type] || TYPE_COLORS.other;
            return (
              <div key={a.code} className="bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow group">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${colors}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{a.code}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${colors}`}>{typeLabel(a.acc_type)}</span>
                    </div>
                    <p className="text-sm font-bold text-[#1a1a2e] truncate mt-1">{a.name}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="font-mono text-[#c9a84c] text-sm font-bold">{a.unit_price} ج/{a.unit === 'piece' ? 'قطعة' : a.unit === 'meter' ? 'متر' : a.unit === 'roll' ? 'رول' : a.unit}</span>
                    </div>
                    {a.supplier && <p className="text-[10px] text-gray-400 mt-1">مورد: {a.supplier}</p>}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex gap-1 mt-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(a.code)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-in Drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="fixed top-0 left-0 z-50 h-full w-[380px] bg-white shadow-2xl flex flex-col animate-[slideInLeft_0.25s_ease-out]">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-[#1a1a2e]">{editing ? 'تعديل اكسسوار' : 'إضافة اكسسوار جديد'}</h3>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">الكود *</label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} readOnly={!!editing}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none ${editing ? 'bg-gray-50' : ''}`} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">النوع *</label>
                  <select value={form.acc_type} onChange={e => setForm({ ...form, acc_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#c9a84c] outline-none">
                    {ACC_TYPES.filter(t => t.value).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
                  <label className="block text-[11px] text-gray-500 mb-0.5">سعر الوحدة *</label>
                  <input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">الوحدة</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#c9a84c] outline-none">
                    <option value="piece">قطعة</option>
                    <option value="meter">متر</option>
                    <option value="roll">رول</option>
                    <option value="kg">كجم</option>
                  </select>
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
              <button onClick={() => setDrawerOpen(false)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600">إلغاء</button>
              <button onClick={handleSave} className="flex-1 px-4 py-2.5 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold">حفظ</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
