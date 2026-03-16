import { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import { useToast } from './Toast';

export default function BomVariantTabs({ modelCode, fabricsList, accessoriesList }) {
  const toast = useToast();
  const [variants, setVariants] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState(true);

  const load = async () => {
    if (!modelCode) { setLoading(false); return; }
    try {
      const { data } = await axios.get(`/api/models/${modelCode}/variants`);
      setVariants(data);
      if (data.length > 0 && !active) setActive(data[0].id);
    } catch { /* ignore if model is new */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [modelCode]);

  const createVariant = async () => {
    if (!newName.trim()) { toast.error('اسم المتغير مطلوب'); return; }
    try {
      await axios.post(`/api/models/${modelCode}/variants`, {
        name: newName.trim(),
        is_default: variants.length === 0,
        fabrics: [],
        accessories: [],
      });
      setNewName('');
      setShowCreate(false);
      toast.success('تم إنشاء المتغير');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const deleteVariant = async (vid) => {
    if (!confirm('حذف هذا المتغير؟')) return;
    try {
      await axios.delete(`/api/models/${modelCode}/variants/${vid}`);
      toast.success('تم الحذف');
      if (active === vid) setActive(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const setDefault = async (vid) => {
    try {
      await axios.put(`/api/models/${modelCode}/variants/${vid}`, { is_default: true });
      toast.success('تم التعيين كافتراضي');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const activeVariant = variants.find(v => v.id === active);

  const addFabric = async () => {
    if (!activeVariant) return;
    const fabrics = [...(activeVariant.fabrics || []), { fabric_code: '', role: 'main', meters_per_piece: '', waste_pct: '5', color_note: '' }];
    try {
      await axios.put(`/api/models/${modelCode}/variants/${active}`, { fabrics: fabrics.filter(f => f.fabric_code && f.meters_per_piece) });
      load();
    } catch { /* */ }
  };

  const addAccessory = async () => {
    if (!activeVariant) return;
    const accs = [...(activeVariant.accessories || []), { accessory_code: '', accessory_name: '', quantity: '', unit_price: '' }];
    try {
      await axios.put(`/api/models/${modelCode}/variants/${active}`, { accessories: accs.filter(a => a.quantity && a.unit_price) });
      load();
    } catch { /* */ }
  };

  const saveVariantItems = async (fabrics, accessories) => {
    if (!active) return;
    try {
      await axios.put(`/api/models/${modelCode}/variants/${active}`, { fabrics, accessories });
      toast.success('تم الحفظ');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  if (!modelCode) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        احفظ الموديل أولاً لإضافة متغيرات BOM
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-sm font-bold text-[#1a1a2e]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          متغيرات BOM
          <span className="text-[10px] font-normal bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{variants.length}</span>
        </button>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-xs text-[#c9a84c] hover:text-[#a88a3a]">
          <Plus size={14} /> إضافة متغير
        </button>
      </div>

      {expanded && (
        <>
          {/* Variant Tabs */}
          {variants.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {variants.map(v => (
                <button key={v.id} onClick={() => setActive(v.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    active === v.id ? 'bg-[#c9a84c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {v.is_default ? <Star size={10} className="fill-current" /> : null}
                  {v.name}
                </button>
              ))}
            </div>
          )}

          {/* Active Variant Content */}
          {activeVariant && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{activeVariant.name}</span>
                <div className="flex gap-2">
                  {!activeVariant.is_default && (
                    <button onClick={() => setDefault(activeVariant.id)} className="text-[10px] px-2 py-1 bg-amber-50 text-amber-700 rounded hover:bg-amber-100">
                      <Star size={10} className="inline mr-0.5" /> افتراضي
                    </button>
                  )}
                  <button onClick={() => deleteVariant(activeVariant.id)} className="text-[10px] px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">
                    <Trash2 size={10} className="inline mr-0.5" /> حذف
                  </button>
                </div>
              </div>

              {/* Variant Fabrics */}
              <VariantFabrics
                fabrics={activeVariant.fabrics || []}
                fabricsList={fabricsList}
                onSave={(fabrics) => saveVariantItems(fabrics, activeVariant.accessories || [])}
              />

              {/* Variant Accessories */}
              <VariantAccessories
                accessories={activeVariant.accessories || []}
                accessoriesList={accessoriesList}
                onSave={(accs) => saveVariantItems(activeVariant.fabrics || [], accs)}
              />
            </div>
          )}

          {variants.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-xs">
              لا توجد متغيرات — أضف متغيراً لإنشاء BOM بديل
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#1a1a2e]">متغير BOM جديد</h3>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="مثال: قماش بديل، نسخة اقتصادية..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">إلغاء</button>
              <button onClick={createVariant} className="px-4 py-1.5 bg-[#c9a84c] text-white text-sm rounded-lg font-bold">إنشاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VariantFabrics({ fabrics: initialFabrics, fabricsList, onSave }) {
  const [items, setItems] = useState(initialFabrics);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setItems(initialFabrics); setDirty(false); }, [initialFabrics]);

  const update = (i, field, val) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
    setDirty(true);
  };
  const add = () => { setItems(prev => [...prev, { fabric_code: '', role: 'main', meters_per_piece: '', waste_pct: '5', color_note: '' }]); setDirty(true); };
  const remove = (i) => { setItems(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-600">الأقمشة</span>
        <div className="flex gap-1">
          <button onClick={add} className="text-[10px] text-[#c9a84c]">+ قماش</button>
          {dirty && <button onClick={() => onSave(items.filter(f => f.fabric_code && f.meters_per_piece))} className="text-[10px] px-2 py-0.5 bg-[#c9a84c] text-white rounded">حفظ</button>}
        </div>
      </div>
      <div className="space-y-1">
        {items.map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-white rounded-lg p-1.5">
            <select value={f.fabric_code || ''} onChange={e => update(i, 'fabric_code', e.target.value)}
              className="border border-gray-200 rounded px-1.5 py-1 text-[10px] flex-1">
              <option value="">اختر قماش</option>
              {fabricsList.map(fl => <option key={fl.code} value={fl.code}>[{fl.code}] {fl.name}</option>)}
            </select>
            <select value={f.role || 'main'} onChange={e => update(i, 'role', e.target.value)}
              className="border border-gray-200 rounded px-1 py-1 text-[10px] w-14">
              <option value="main">أساسي</option>
              <option value="lining">بطانة</option>
            </select>
            <input type="number" step="0.01" placeholder="م/قطعة" value={f.meters_per_piece || ''} onChange={e => update(i, 'meters_per_piece', e.target.value)}
              className="border border-gray-200 rounded px-1 py-1 text-[10px] w-16 text-center font-mono" />
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function VariantAccessories({ accessories: initialAccs, accessoriesList, onSave }) {
  const [items, setItems] = useState(initialAccs);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setItems(initialAccs); setDirty(false); }, [initialAccs]);

  const update = (i, field, val) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const next = { ...item, [field]: val };
      if (field === 'accessory_code') {
        const found = accessoriesList.find(a => a.code === val);
        if (found) { next.accessory_name = found.name; next.unit_price = found.unit_price; }
      }
      return next;
    }));
    setDirty(true);
  };
  const add = () => { setItems(prev => [...prev, { accessory_code: '', accessory_name: '', quantity: '', unit_price: '' }]); setDirty(true); };
  const remove = (i) => { setItems(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-600">الاكسسوارات</span>
        <div className="flex gap-1">
          <button onClick={add} className="text-[10px] text-[#c9a84c]">+ اكسسوار</button>
          {dirty && <button onClick={() => onSave(items.filter(a => a.quantity && a.unit_price))} className="text-[10px] px-2 py-0.5 bg-[#c9a84c] text-white rounded">حفظ</button>}
        </div>
      </div>
      <div className="space-y-1">
        {items.map((a, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-white rounded-lg p-1.5">
            <select value={a.accessory_code || ''} onChange={e => update(i, 'accessory_code', e.target.value)}
              className="border border-gray-200 rounded px-1 py-1 text-[10px] flex-1">
              <option value="">اختر اكسسوار</option>
              {accessoriesList.map(al => <option key={al.code} value={al.code}>[{al.code}] {al.name}</option>)}
            </select>
            <input type="number" min="0" placeholder="الكمية" value={a.quantity || ''} onChange={e => update(i, 'quantity', e.target.value)}
              className="border border-gray-200 rounded px-1 py-1 text-[10px] w-14 text-center font-mono" />
            <input type="number" min="0" step="0.01" placeholder="السعر" value={a.unit_price || ''} onChange={e => update(i, 'unit_price', e.target.value)}
              className="border border-gray-200 rounded px-1 py-1 text-[10px] w-14 text-center font-mono" />
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
