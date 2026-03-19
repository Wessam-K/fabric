import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Save, Trash2, Star, Scissors, Package, Layers, DollarSign } from 'lucide-react';
import api from '../utils/api';
import FabricBlock from '../components/FabricBlock';
import SizeGrid from '../components/SizeGrid';
import AccessoryTable from '../components/AccessoryTable';
import { useToast } from '../components/Toast';

const emptyFabric = (role, wastePct = 5) => ({ fabric_code: '', role, meters_per_piece: '', waste_pct: wastePct, color_note: '' });
const emptySize = () => ({ color_label: '', qty_s: 0, qty_m: 0, qty_l: 0, qty_xl: 0, qty_2xl: 0, qty_3xl: 0 });
const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

function LiveCostSummary({ mainFabrics, linings, accessories, grandTotal, masnaiya, masrouf, marginPct, fabricsList }) {
  const lookup = useMemo(() => {
    const m = {};
    for (const f of fabricsList) m[f.code] = f;
    return m;
  }, [fabricsList]);

  const calcFabricCost = (fabrics) => fabrics.reduce((sum, f) => {
    if (!f.fabric_code || !f.meters_per_piece) return sum;
    const reg = lookup[f.fabric_code];
    const price = reg?.price_per_m || 0;
    const mpp = parseFloat(f.meters_per_piece) || 0;
    const waste = parseFloat(f.waste_pct) || 0;
    const mppWithWaste = mpp * (1 + waste / 100);
    return sum + mppWithWaste * price * grandTotal;
  }, 0);

  const mainCost = calcFabricCost(mainFabrics);
  const liningCost = calcFabricCost(linings);
  const accCost = accessories.reduce((sum, a) => sum + ((parseFloat(a.quantity) || 0) * (parseFloat(a.unit_price) || 0) * grandTotal), 0);
  const masCost = (parseFloat(masnaiya) || 0) * grandTotal;
  const masrCost = (parseFloat(masrouf) || 0) * grandTotal;
  const total = mainCost + liningCost + accCost + masCost + masrCost;
  const perPiece = grandTotal > 0 ? total / grandTotal : 0;
  const margin = parseFloat(marginPct) || 0;
  const suggested = perPiece * (1 + margin / 100);

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex justify-between"><span className="text-gray-400">قماش أساسي</span><span className="font-mono">{fmt(mainCost)} ج</span></div>
      <div className="flex justify-between"><span className="text-gray-400">بطانة</span><span className="font-mono">{fmt(liningCost)} ج</span></div>
      <div className="flex justify-between"><span className="text-gray-400">اكسسوارات</span><span className="font-mono">{fmt(accCost)} ج</span></div>
      <div className="flex justify-between"><span className="text-gray-400">مصنعية</span><span className="font-mono">{fmt(masCost)} ج</span></div>
      <div className="flex justify-between"><span className="text-gray-400">مصروف</span><span className="font-mono">{fmt(masrCost)} ج</span></div>
      <hr className="border-gray-200" />
      <div className="flex justify-between font-bold text-sm"><span>الإجمالي</span><span className="font-mono text-[#c9a84c]">{fmt(total)} ج</span></div>
      <div className="flex justify-between"><span className="text-gray-400">تكلفة/قطعة</span><span className="font-mono font-bold">{fmt(perPiece)} ج</span></div>
      {suggested > 0 && <div className="flex justify-between"><span className="text-gray-400">سعر مقترح</span><span className="font-mono text-green-600">{fmt(suggested)} ج</span></div>}
    </div>
  );
}

export default function BomTemplates() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [model, setModel] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state for active template
  const [templateName, setTemplateName] = useState('');
  const [masnaiya, setMasnaiya] = useState('90');
  const [masrouf, setMasrouf] = useState('50');
  const [marginPct, setMarginPct] = useState('25');
  const [mainFabrics, setMainFabrics] = useState([emptyFabric('main')]);
  const [linings, setLinings] = useState([emptyFabric('lining')]);
  const [sizes, setSizes] = useState([emptySize()]);
  const [accessories, setAccessories] = useState([]);
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Registry data
  const [fabricsList, setFabricsList] = useState([]);
  const [accessoriesList, setAccessoriesList] = useState([]);
  const [defaultWaste, setDefaultWaste] = useState(5);

  const loadModel = async () => {
    try {
      const [modelRes, fabRes, accRes, settingsRes] = await Promise.all([
        api.get(`/models/${code}`),
        api.get('/fabrics'),
        api.get('/accessories'),
        api.get('/settings'),
      ]);
      setModel(modelRes.data);
      setFabricsList(fabRes.data);
      setAccessoriesList(accRes.data);
      const s = settingsRes.data || {};
      setDefaultWaste(parseFloat(s.waste_pct_default) || 5);

      // Load templates list
      const { data: tpls } = await api.get(`/models/${code}/bom-templates`);
      setTemplates(tpls);
      if (tpls.length > 0) {
        const defTpl = tpls.find(t => t.is_default) || tpls[0];
        await loadTemplate(defTpl.id);
      }
    } catch (err) {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = async (tplId) => {
    try {
      const { data } = await api.get(`/models/${code}/bom-templates/${tplId}`);
      setActiveId(data.id);
      setTemplateName(data.template_name || '');
      setMasnaiya(String(data.masnaiya ?? 90));
      setMasrouf(String(data.masrouf ?? 50));
      setMarginPct(String(data.margin_pct ?? 25));
      setNotes(data.notes || '');

      const mf = (data.fabrics || []).filter(f => f.role === 'main');
      const lf = (data.fabrics || []).filter(f => f.role === 'lining');
      setMainFabrics(mf.length > 0 ? mf : [emptyFabric('main', defaultWaste)]);
      setLinings(lf.length > 0 ? lf : [emptyFabric('lining')]);
      setSizes(data.sizes?.length > 0 ? data.sizes : [emptySize()]);
      setAccessories(data.accessories?.length > 0 ? data.accessories : []);
    } catch {
      toast.error('فشل تحميل القالب');
    }
  };

  useEffect(() => { loadModel(); }, [code]);

  const onMainFabricChange = useCallback((i, f) => setMainFabrics(prev => prev.map((x, idx) => idx === i ? f : x)), []);
  const onLiningChange = useCallback((i, f) => setLinings(prev => prev.map((x, idx) => idx === i ? f : x)), []);
  const addMainFabric = () => setMainFabrics(prev => [...prev, emptyFabric('main', defaultWaste)]);
  const addLining = () => setLinings(prev => [...prev, emptyFabric('lining')]);
  const removeMainFabric = (i) => { if (mainFabrics.length > 1) setMainFabrics(prev => prev.filter((_, idx) => idx !== i)); };
  const removeLining = (i) => { if (linings.length > 1) setLinings(prev => prev.filter((_, idx) => idx !== i)); };

  const mainFabricOptions = fabricsList.filter(f => f.fabric_type === 'main' || f.fabric_type === 'both');
  const liningOptions = fabricsList.filter(f => f.fabric_type === 'lining' || f.fabric_type === 'both');

  const SIZES_KEYS = ['qty_s', 'qty_m', 'qty_l', 'qty_xl', 'qty_2xl', 'qty_3xl'];
  const grandTotal = sizes.reduce((sum, row) =>
    sum + SIZES_KEYS.reduce((s, k) => s + (parseInt(row[k]) || 0), 0), 0);

  const buildPayload = () => ({
    template_name: templateName.trim() || 'الافتراضي',
    masnaiya: parseFloat(masnaiya) || 0,
    masrouf: parseFloat(masrouf) || 0,
    margin_pct: parseFloat(marginPct) || 25,
    notes: notes.trim() || null,
    fabrics: [...mainFabrics, ...linings].filter(f => f.fabric_code && f.meters_per_piece),
    accessories: accessories.filter(a => a.quantity && a.unit_price),
    sizes: sizes.filter(s => s.color_label),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeId) {
        await api.put(`/models/${code}/bom-templates/${activeId}`, buildPayload());
        toast.success('تم تحديث القالب');
      } else {
        const { data } = await api.post(`/models/${code}/bom-templates`, buildPayload());
        setActiveId(data.id);
        toast.success('تم إنشاء القالب');
      }
      // Refresh templates list
      const { data: tpls } = await api.get(`/models/${code}/bom-templates`);
      setTemplates(tpls);
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    setActiveId(null);
    setTemplateName('');
    setMasnaiya('90');
    setMasrouf('50');
    setMarginPct('25');
    setNotes('');
    setMainFabrics([emptyFabric('main', defaultWaste)]);
    setLinings([emptyFabric('lining')]);
    setSizes([emptySize()]);
    setAccessories([]);
  };

  const handleDelete = async (tplId) => {
    setConfirmDelete(tplId);
  };

  const doDelete = async () => {
    const tplId = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/models/${code}/bom-templates/${tplId}`);
      toast.success('تم الحذف');
      const { data: tpls } = await api.get(`/models/${code}/bom-templates`);
      setTemplates(tpls);
      if (tpls.length > 0) {
        await loadTemplate(tpls[0].id);
      } else {
        handleNew();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'لا يمكن الحذف');
    }
  };

  const handleSetDefault = async (tplId) => {
    try {
      await api.post(`/models/${code}/bom-templates/${tplId}/set-default`);
      toast.success('تم تعيين كافتراضي');
      const { data: tpls } = await api.get(`/models/${code}/bom-templates`);
      setTemplates(tpls);
    } catch { toast.error('خطأ'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/models/${code}/edit`)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowRight size={20} /></button>
          <div>
            <h2 className="text-xl font-bold text-[#1a1a2e]">قوائم المواد (BOM)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="font-mono text-[#c9a84c]">{code}</span> — {model?.model_name || model?.serial_number}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">
            <Plus size={16} /> قالب جديد
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
            <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>

      {/* Template tabs */}
      {templates.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {templates.map(t => (
            <button key={t.id}
              onClick={() => loadTemplate(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                activeId === t.id ? 'bg-[#c9a84c]/20 text-[#c9a84c] font-bold border border-[#c9a84c]' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {t.is_default && <Star size={12} className="text-[#c9a84c]" />}
              {t.template_name}
              <span className="text-[10px] text-gray-400">({t.fabrics_count || 0} أقمشة)</span>
            </button>
          ))}
          {!activeId && (
            <span className="flex items-center px-4 py-2 rounded-xl text-sm bg-green-50 text-green-600 border border-green-200 font-bold">
              + جديد
            </span>
          )}
        </div>
      )}

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-6">
          {/* Template basic info */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2"><Layers size={16} /> بيانات القالب</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">اسم القالب</label>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] outline-none"
                  placeholder="الافتراضي" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">المصنعية (ج)</label>
                <input type="number" min="0" value={masnaiya} onChange={e => setMasnaiya(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">المصروف (ج)</label>
                <input type="number" min="0" value={masrouf} onChange={e => setMasrouf(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">هامش ربح %</label>
                <input type="number" min="0" value={marginPct} onChange={e => setMarginPct(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-[#c9a84c] outline-none" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[11px] text-gray-500 mb-1">ملاحظات</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] outline-none"
                placeholder="ملاحظات اختيارية..." />
            </div>
          </div>

          {/* Main Fabrics */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
                <Scissors size={16} className="text-blue-500" /> الأقمشة الأساسية
                <span className="text-[10px] font-normal bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{mainFabrics.length}</span>
              </h3>
              <button onClick={addMainFabric} className="flex items-center gap-1 text-xs text-[#c9a84c] hover:text-[#a88a3a] bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={14} /> إضافة قماش
              </button>
            </div>
            <div className="space-y-4">
              {mainFabrics.map((f, i) => (
                <FabricBlock key={i} fabric={f} index={i} role="main"
                  fabricsList={mainFabricOptions}
                  onChange={onMainFabricChange} onRemove={removeMainFabric}
                  canRemove={mainFabrics.length > 1} grandTotal={grandTotal} />
              ))}
            </div>
          </div>

          {/* Linings */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
                <Scissors size={16} className="text-green-500" /> البطانة
                <span className="text-[10px] font-normal bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{linings.length}</span>
              </h3>
              <button onClick={addLining} className="flex items-center gap-1 text-xs text-[#c9a84c] hover:text-[#a88a3a] bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={14} /> إضافة بطانة
              </button>
            </div>
            <div className="space-y-4">
              {linings.map((f, i) => (
                <FabricBlock key={i} fabric={f} index={i} role="lining"
                  fabricsList={liningOptions}
                  onChange={onLiningChange} onRemove={removeLining}
                  canRemove={linings.length > 1} grandTotal={grandTotal} />
              ))}
            </div>
          </div>

          {/* Size Grid */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
              <Layers size={16} className="text-purple-500" /> جدول المقاسات والألوان
              <span className="text-[10px] font-normal text-gray-400">إجمالي القطع: <span className="font-mono font-bold text-[#1a1a2e]">{grandTotal}</span></span>
            </h3>
            <SizeGrid sizes={sizes} onChange={setSizes} />
          </div>

          {/* Accessories */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
              <Package size={16} className="text-amber-500" /> الاكسسوارات
            </h3>
            <AccessoryTable accessories={accessories} accessoriesList={accessoriesList} onChange={setAccessories} />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="hidden lg:block w-[280px] shrink-0">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto space-y-4">
            {/* Actions */}
            {activeId && (
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
                <button onClick={() => handleSetDefault(activeId)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-[#c9a84c] rounded-lg text-sm transition-colors">
                  <Star size={14} /> تعيين كافتراضي
                </button>
                <button onClick={() => handleDelete(activeId)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm transition-colors">
                  <Trash2 size={14} /> حذف القالب
                </button>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4e] rounded-2xl p-5 text-white">
              <h4 className="text-xs text-gray-300 mb-3">ملخص القالب</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">القطع</span>
                  <span className="font-mono font-bold">{grandTotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">الأقمشة</span>
                  <span className="font-mono font-bold">{mainFabrics.filter(f=>f.fabric_code).length + linings.filter(f=>f.fabric_code).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">الاكسسوارات</span>
                  <span className="font-mono font-bold">{accessories.filter(a=>a.accessory_code || a.quantity).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">الألوان</span>
                  <span className="font-mono font-bold">{sizes.filter(s=>s.color_label).length}</span>
                </div>
              </div>
            </div>

            {/* Live Cost Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h4 className="text-xs text-gray-400 mb-3 flex items-center gap-1.5"><DollarSign size={14} className="text-[#c9a84c]" /> التكلفة التقديرية</h4>
              <LiveCostSummary
                mainFabrics={mainFabrics} linings={linings}
                accessories={accessories} grandTotal={grandTotal}
                masnaiya={masnaiya} masrouf={masrouf} marginPct={marginPct}
                fabricsList={fabricsList}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="sticky bottom-0 mt-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-4 flex items-center justify-between no-print border border-gray-100">
        <div className="text-sm text-gray-500">
          القالب: <span className="font-bold text-[#1a1a2e]">{templateName || 'جديد'}</span>
          &nbsp;•&nbsp; إجمالي القطع: <span className="font-mono font-bold text-[#1a1a2e]">{grandTotal}</span>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-6 py-2.5 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ القالب'}
        </button>
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 text-center space-y-4">
            <h3 className="font-bold text-lg">حذف القالب</h3>
            <p className="text-gray-600 text-sm">هل أنت متأكد من حذف هذا القالب؟ لا يمكن التراجع.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">إلغاء</button>
              <button onClick={doDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
