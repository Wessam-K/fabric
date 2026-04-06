import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, CircleDot, Zap, Layers, Tag, Package, Grip, MoreHorizontal, Shield, Aperture, AlertTriangle, Camera, Upload } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import Pagination from '../components/Pagination';
import ExportButton from '../components/ExportButton';
import HelpButton from '../components/HelpButton';
import PermissionGuard from '../components/PermissionGuard';
import ImportCSV from '../components/ImportCSV';
import { useAuth } from '../context/AuthContext';

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
  const { can } = useAuth();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [stockModal, setStockModal] = useState(null);
  const [stockAdjust, setStockAdjust] = useState({ qty_change: '', notes: '' });
  const [confirmDel, setConfirmDel] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [showImport, setShowImport] = useState(false);

  // Blob URL with cleanup to prevent memory leak
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile]);
  useEffect(() => { return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }; }, [imagePreview]);

  const fetchList = async () => {
    try {
      const params = { page, limit: pageSize };
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      const { data } = await api.get('/accessories', { params });
      if (data.data) { setList(data.data); setTotal(data.total); }
      else { setList(data); setTotal(data.length); }
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, [search, filterType, page, pageSize]);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setImageFile(null); setDrawerOpen(true); };
  const openEdit = (a) => {
    setEditing(a.code);
    setForm({ code: a.code, acc_type: a.acc_type, name: a.name, unit_price: String(a.unit_price), unit: a.unit || 'piece', supplier: a.supplier || '', notes: a.notes || '' });
    setImageFile(null);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.unit_price) {
      toast.error('الكود والاسم والسعر مطلوبين');
      return;
    }
    if (parseFloat(form.unit_price) <= 0) { toast.error('السعر يجب أن يكون أكبر من صفر'); return; }
    try {
      const fd = new FormData();
      Object.keys(form).forEach(k => { if (form[k]) fd.append(k, form[k]); });
      if (imageFile) fd.append('image', imageFile);
      if (editing) {
        await api.put(`/accessories/${editing}`, fd);
        toast.success('تم التحديث');
      } else {
        await api.post('/accessories', fd);
        toast.success('تمت الإضافة');
      }
      setDrawerOpen(false);
      fetchList();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ');
    }
  };

  const handleDelete = async (code) => {
    setConfirmDel(code);
  };
  const doDelete = async () => {
    const code = confirmDel;
    setConfirmDel(null);
    try {
      await api.delete(`/accessories/${code}`);
      toast.success('تم التعطيل بنجاح');
      fetchList();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error(`لا يمكن تعطيل هذا الإكسسوار: مرتبط بـ ${err.response.data.blocking_count} سجل نشط`);
      } else {
        toast.error(err.response?.data?.error || 'فشل التعطيل');
      }
    }
  };

  const handleStockAdjust = async () => {
    if (!stockAdjust.qty_change || parseInt(stockAdjust.qty_change) === 0) { toast.error('الكمية مطلوبة'); return; }
    try {
      await api.post(`/accessories/${stockModal.code}/stock/adjust`, stockAdjust);
      toast.success('تم تعديل المخزون');
      setStockModal(null);
      setStockAdjust({ qty_change: '', notes: '' });
      fetchList();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const typeLabel = (t) => ACC_TYPES.find(x => x.value === t)?.label || t;
  const TypeIcon = (t) => ACC_TYPES.find(x => x.value === t)?.icon || MoreHorizontal;

  return (
    <div className="page">
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card card-body max-w-sm w-full mx-4">
            <h3 className="section-title mb-2">تأكيد التعطيل</h3>
            <p className="text-sm text-[var(--color-muted)] mb-5">هل أنت متأكد من تعطيل هذا الاكسسوار؟ لا يمكن حذفه نهائياً — يمكن إعادة تفعيله لاحقاً.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDel(null)} className="btn btn-ghost">إلغاء</button>
              <button onClick={doDelete} className="btn btn-danger">تأكيد</button>
            </div>
          </div>
        </div>
      )}
      <PageHeader title="سجل الاكسسوارات" subtitle={`${total} اكسسوار مسجل`}
        actions={<div className="flex items-center gap-2">
          <HelpButton pageKey="accessories" />
          <button onClick={() => setShowImport(true)} className="btn btn-outline btn-sm flex items-center gap-1.5"><Upload size={14} /> استيراد</button>
          <ExportButton data={list} filename="accessories" backendEndpoint="/accessories/export" columns={[{key:'code',label:'الكود'},{key:'name',label:'الاسم'},{key:'acc_type',label:'النوع'},{key:'unit_price',label:'سعر الوحدة'},{key:'unit',label:'الوحدة'},{key:'quantity_on_hand',label:'المخزون'},{key:'supplier',label:'المورد'}]} />
          <PermissionGuard module="accessories" action="create">
            <button onClick={openNew} className="btn btn-gold"><Plus size={16} /> إضافة اكسسوار</button>
          </PermissionGuard>
        </div>}
      />

      <ImportCSV isOpen={showImport} onClose={() => setShowImport(false)}
        endpoint="/accessories/import" entityName="الاكسسوارات"
        templateColumns={['code','acc_type','name','unit_price','unit','supplier','notes']}
        helpText="الأعمدة المطلوبة: code, name, unit_price. الأعمدة الاختيارية: acc_type (button/zipper/thread/label/packaging/elastic/other), unit, supplier, notes"
        onSuccess={() => fetchList()} />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
          className="form-input flex-1 max-w-xs" />
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
                    {/* Stock info */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${(a.quantity_on_hand || 0) <= (a.low_stock_threshold || 10) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        مخزون: {a.quantity_on_hand || 0}
                      </span>
                      {(a.quantity_on_hand || 0) <= (a.low_stock_threshold || 10) && <AlertTriangle size={12} className="text-amber-500" />}
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex gap-1 mt-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  {can('accessories', 'edit') && <button onClick={() => { setStockModal(a); setStockAdjust({ qty_change: '', notes: '' }); }} className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg text-[10px]">تعديل مخزون</button>}
                  {can('accessories', 'edit') && <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>}
                  {can('accessories', 'delete') && <button onClick={() => handleDelete(a.code)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination total={total} page={page} pageSize={pageSize} onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }} />

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
              {/* Image upload zone */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-[#c9a84c] transition-colors">
                {imageFile ? (
                  <div className="relative">
                    <img src={imagePreview} alt="" className="w-full h-32 object-cover rounded-lg" />
                    <button onClick={() => setImageFile(null)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"><X size={12} /></button>
                  </div>
                ) : editing && list.find(a => a.code === editing)?.image_path ? (
                  <div className="relative">
                    <img src={list.find(a => a.code === editing).image_path} alt="" className="w-full h-32 object-cover rounded-lg" />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                      <Camera size={24} className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files[0] || null)} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Camera size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">اضغط لرفع صورة الاكسسوار</p>
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
              <button onClick={() => setDrawerOpen(false)} className="flex-1 btn btn-ghost">إلغاء</button>
              <button onClick={handleSave} className="flex-1 btn btn-gold">حفظ</button>
            </div>
          </div>
        </>
      )}

      {/* Stock Adjustment Modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setStockModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e]">تعديل مخزون: {stockModal.name}</h3>
            <p className="text-xs text-gray-400">المخزون الحالي: <span className="font-mono font-bold">{stockModal.quantity_on_hand || 0}</span></p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">التعديل (+ إضافة / - سحب) *</label>
              <input type="number" value={stockAdjust.qty_change} onChange={e => setStockAdjust({...stockAdjust, qty_change: e.target.value})}
                placeholder="مثال: +50 أو -10"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ملاحظات</label>
              <input type="text" value={stockAdjust.notes} onChange={e => setStockAdjust({...stockAdjust, notes: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setStockModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={handleStockAdjust} className="px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold">تنفيذ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
