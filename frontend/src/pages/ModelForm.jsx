import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Printer, Camera, Layers, FileText, ClipboardList, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../utils/api';
import ImageUpload from '../components/ImageUpload';
import { useToast } from '../components/Toast';

const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

export default function ModelForm() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = !!code;

  const [serial, setSerial] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [modelName, setModelName] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('unisex');
  const [notes, setNotes] = useState('');
  const [modelImage, setModelImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [bomTemplates, setBomTemplates] = useState([]);
  const [costData, setCostData] = useState(null);
  const [bomCostData, setBomCostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [costPanelOpen, setCostPanelOpen] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (isEdit) {
          const { data } = await api.get(`/models/${code}`);
          setSerial(data.serial_number || '');
          setModelCode(data.model_code || '');
          setModelName(data.model_name || '');
          setCategory(data.category || '');
          setGender(data.gender || 'unisex');
          setNotes(data.notes || '');
          setModelImage(data.model_image || null);
          setBomTemplates(data.bom_templates || []);
          // Fetch cost data for this model
          try {
            const costRes = await api.get('/reports/by-model', { params: { search: code } });
            const match = (costRes.data || []).find(r => r.model_code === code);
            if (match) setCostData(match);
          } catch {}
          // Fetch BOM-estimated cost from default template
          try {
            const defaultTpl = (data.bom_templates || []).find(t => t.is_default) || (data.bom_templates || [])[0];
            if (defaultTpl) {
              const [tplRes, fabricsRes] = await Promise.all([
                api.get(`/models/${code}/bom-templates/${defaultTpl.id}`),
                api.get('/fabrics'),
              ]);
              const tpl = tplRes.data;
              const fabricLookup = {};
              for (const f of fabricsRes.data) fabricLookup[f.code] = f;
              const allSizes = tpl.sizes || [];
              const grandTotal = allSizes.reduce((s, sz) => s + (sz.qty_s||0) + (sz.qty_m||0) + (sz.qty_l||0) + (sz.qty_xl||0) + (sz.qty_2xl||0) + (sz.qty_3xl||0), 0);
              const calcFabricCost = (fabrics) => (fabrics || []).reduce((sum, f) => {
                if (!f.fabric_code || !f.meters_per_piece) return sum;
                const reg = fabricLookup[f.fabric_code];
                const price = reg?.price_per_m || 0;
                const mpp = parseFloat(f.meters_per_piece) || 0;
                const waste = parseFloat(f.waste_pct) || 0;
                return sum + mpp * (1 + waste / 100) * price * grandTotal;
              }, 0);
              const mainFabrics = (tpl.fabrics || []).filter(f => f.role === 'main');
              const linings = (tpl.fabrics || []).filter(f => f.role === 'lining');
              const mainCost = calcFabricCost(mainFabrics);
              const liningCost = calcFabricCost(linings);
              const accCost = (tpl.accessories || []).reduce((sum, a) => sum + ((parseFloat(a.quantity)||0) * (parseFloat(a.unit_price)||0) * grandTotal), 0);
              const masCost = (parseFloat(tpl.masnaiya) || 0) * grandTotal;
              const masrCost = (parseFloat(tpl.masrouf) || 0) * grandTotal;
              const total = mainCost + liningCost + accCost + masCost + masrCost;
              const perPiece = grandTotal > 0 ? total / grandTotal : 0;
              const margin = parseFloat(tpl.margin_pct) || 0;
              const suggested = perPiece * (1 + margin / 100);
              setBomCostData({
                template_name: tpl.template_name,
                grand_total: grandTotal,
                main_fabric_cost: mainCost,
                lining_cost: liningCost,
                accessories_cost: accCost,
                masnaiya: masCost,
                masrouf: masrCost,
                total_cost: total,
                cost_per_piece: perPiece,
                margin_pct: margin,
                suggested_price: suggested,
              });
            }
          } catch {}
        } else {
          const { data } = await api.get('/models/next-serial');
          setSerial(data.next_serial);
        }
      } catch (err) {
        toast.error('فشل تحميل البيانات: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [code, isEdit]);

  const hasCostPanel = isEdit && (costData || bomCostData);

  const handleSave = async () => {
    if (!serial.trim() || !modelCode.trim()) {
      toast.error('الرقم التسلسلي وكود الموديل مطلوبان');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        serial_number: serial.trim(),
        model_code: modelCode.trim(),
        model_name: modelName.trim() || null,
        category: category.trim() || null,
        gender,
        notes: notes.trim() || null,
      };

      let savedCode;
      if (isEdit) {
        await api.put(`/models/${code}`, payload);
        savedCode = code;
        toast.success('تم تحديث الموديل بنجاح');
      } else {
        const { data } = await api.post('/models', payload);
        savedCode = data.model_code;
        toast.success('تم إنشاء الموديل بنجاح');
      }

      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await api.post(`/models/${savedCode}/image`, fd);
      }

      navigate(`/models/${savedCode}/edit`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">{isEdit ? 'تعديل الموديل' : 'موديل جديد'}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{isEdit ? `كود: ${code}` : 'إضافة موديل جديد للكتالوج'}</p>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <>
              <button onClick={() => navigate(`/models/${code}/bom`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm text-indigo-700 transition-colors">
                <ClipboardList size={16} /> قوائم المواد ({bomTemplates.length})
              </button>
              <button onClick={() => window.open(`/models/${code}/print`, '_blank')}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">
                <Printer size={16} /> طباعة
              </button>
            </>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
            <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>

      {/* Main content with optional sticky cost panel */}
      <div className={`${hasCostPanel ? 'lg:grid lg:grid-cols-[1fr_240px] lg:gap-6 lg:items-start' : ''}`}>
      <div>
      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Image */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center justify-center">
          <ImageUpload size="lg"
            value={modelImage}
            onChange={(file) => {
              setImageFile(file);
              if (file) setModelImage(URL.createObjectURL(file));
            }} />
          <p className="text-[10px] text-gray-400 mt-2">صورة الموديل</p>
        </div>

        {/* Basic Info */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2"><Layers size={16} /> بيانات الموديل</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">الرقم التسلسلي *</label>
              <input type="text" value={serial} onChange={e => setSerial(e.target.value)} readOnly={isEdit}
                className={`w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all ${isEdit ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder="1-001" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">كود الموديل *</label>
              <input type="text" value={modelCode} onChange={e => setModelCode(e.target.value)} readOnly={isEdit}
                className={`w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all ${isEdit ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder="MDL-001" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">اسم الموديل</label>
              <input type="text" value={modelName} onChange={e => setModelName(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all"
                placeholder="اسم وصفي..." />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">الفئة</label>
              <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all"
                placeholder="قمصان، بنطلون، ..." />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">النوع</label>
              <select value={gender} onChange={e => setGender(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all">
                <option value="unisex">يونيسكس</option>
                <option value="male">رجالي</option>
                <option value="female">حريمي</option>
                <option value="kids">أطفال</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-[11px] text-gray-500 mb-1">ملاحظات</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all resize-none"
              placeholder="ملاحظات اختيارية..." />
          </div>
        </div>
      </div>

      {/* BOM Templates quick view */}
      {isEdit && bomTemplates.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
              <ClipboardList size={16} className="text-indigo-500" /> قوائم المواد (BOM Templates)
            </h3>
            <button onClick={() => navigate(`/models/${code}/bom`)}
              className="text-xs text-[#c9a84c] hover:text-[#a88a3a]">عرض الكل ←</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bomTemplates.map(t => (
              <div key={t.id} className={`p-3 rounded-xl border ${t.is_default ? 'border-[#c9a84c] bg-amber-50/50' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-[#1a1a2e]">{t.template_name}</span>
                  {t.is_default ? <span className="text-[10px] bg-[#c9a84c]/20 text-[#c9a84c] px-2 py-0.5 rounded-full">افتراضي</span> : null}
                </div>
                <p className="text-xs text-gray-400">
                  {t.fabrics_count || 0} أقمشة • {t.accessories_count || 0} اكسسوار • {t.sizes_count || 0} ألوان
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom hint */}
      {isEdit && bomTemplates.length === 0 && (
        <div className="mt-6 bg-indigo-50 rounded-2xl p-5 text-center">
          <p className="text-sm text-indigo-600">لم يتم إضافة قوائم مواد بعد.</p>
          <button onClick={() => navigate(`/models/${code}/bom`)}
            className="mt-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-colors">
            إضافة قائمة مواد
          </button>
        </div>
      )}
      </div>{/* end main column */}

      {/* Sticky Cost Summary Panel */}
      {hasCostPanel && (
        <>
        {/* Mobile: collapsible section */}
        <div className="lg:hidden mt-6">
          <button onClick={() => setCostPanelOpen(!costPanelOpen)}
            className="w-full flex items-center justify-between bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
            <span className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2"><DollarSign size={14} className="text-[#c9a84c]" /> ملخص التكاليف</span>
            {costPanelOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>
          {costPanelOpen && (
            <div className="bg-white rounded-b-2xl shadow-sm px-4 pb-4 border border-t-0 border-gray-100 -mt-2">
              <CostPanelContent costData={costData} bomCostData={bomCostData} />
            </div>
          )}
        </div>
        {/* Desktop: sticky sidebar */}
        <div className="sticky top-4 self-start bg-white rounded-2xl shadow-sm p-4 border border-gray-100 hidden lg:block">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2"><DollarSign size={14} className="text-[#c9a84c]" /> ملخص التكاليف</h3>
          <CostPanelContent costData={costData} bomCostData={bomCostData} />
        </div>
        </>
      )}
      </div>{/* end grid wrapper */}
    </div>
  );
}

function CostPanelContent({ costData, bomCostData }) {
  if (costData) {
    return (
      <div className="space-y-2 text-[11px]">
        <div className="flex justify-between"><span className="text-gray-500">أوامر العمل</span><span className="font-mono font-bold">{costData.wo_count || 0}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">مكتمل</span><span className="font-mono font-bold text-green-600">{costData.completed_count || 0}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">إجمالي القطع</span><span className="font-mono font-bold">{costData.total_pieces || 0}</span></div>
        <hr className="border-gray-100" />
        <div className="flex justify-between"><span className="text-gray-500">قماش رئيسي</span><span className="font-mono">{fmt(costData.main_fabric_cost)} ج.م</span></div>
        <div className="flex justify-between"><span className="text-gray-500">بطانة</span><span className="font-mono">{fmt(costData.lining_cost)} ج.م</span></div>
        <div className="flex justify-between"><span className="text-gray-500">إكسسوارات</span><span className="font-mono">{fmt(costData.accessories_cost)} ج.م</span></div>
        <div className="flex justify-between"><span className="text-gray-500">مصنعية</span><span className="font-mono">{fmt(costData.masnaiya)} ج.م</span></div>
        <div className="flex justify-between"><span className="text-gray-500">مصروفات</span><span className="font-mono">{fmt(costData.masrouf)} ج.م</span></div>
        <hr className="border-gray-100" />
        <div className="flex justify-between font-bold"><span className="text-[#1a1a2e]">الإجمالي</span><span className="font-mono text-[#c9a84c]">{fmt(costData.total_cost)} ج.م</span></div>
        <div className="flex justify-between font-bold"><span className="text-[#1a1a2e]">تكلفة القطعة</span><span className="font-mono text-[#c9a84c]">{fmt(costData.cost_per_piece)} ج.م</span></div>
      </div>
    );
  }
  if (bomCostData) {
    return (
      <div className="space-y-2 text-[11px]">
        <div className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mb-2">تقدير من قائمة المواد: {bomCostData.template_name}</div>
        <div className="flex justify-between"><span className="text-gray-500">إجمالي القطع (BOM)</span><span className="font-mono font-bold">{bomCostData.grand_total || 0}</span></div>
        <hr className="border-gray-100" />
        <div className="flex justify-between"><span className="text-gray-500">قماش رئيسي</span><span className="font-mono">{fmt(bomCostData.main_fabric_cost)} ج.م</span></div>
        <div className="flex justify-between"><span className="text-gray-500">بطانة</span><span className="font-mono">{fmt(bomCostData.lining_cost)} ج.م</span></div>
        <div className="flex justify-between"><span className="text-gray-500">إكسسوارات</span><span className="font-mono">{fmt(bomCostData.accessories_cost)} ج.م</span></div>
        <div className="flex justify-between"><span className="text-gray-500">مصنعية</span><span className="font-mono">{fmt(bomCostData.masnaiya)} ج.م</span></div>
        <div className="flex justify-between"><span className="text-gray-500">مصروفات</span><span className="font-mono">{fmt(bomCostData.masrouf)} ج.م</span></div>
        <hr className="border-gray-100" />
        <div className="flex justify-between font-bold"><span className="text-[#1a1a2e]">الإجمالي</span><span className="font-mono text-[#c9a84c]">{fmt(bomCostData.total_cost)} ج.م</span></div>
        <div className="flex justify-between font-bold"><span className="text-[#1a1a2e]">تكلفة القطعة</span><span className="font-mono text-[#c9a84c]">{fmt(bomCostData.cost_per_piece)} ج.م</span></div>
        {bomCostData.margin_pct > 0 && (
          <>
            <hr className="border-gray-100" />
            <div className="flex justify-between"><span className="text-gray-500">هامش ({bomCostData.margin_pct}%)</span><span className="font-mono">{fmt(bomCostData.suggested_price)} ج.م</span></div>
          </>
        )}
      </div>
    );
  }
  return null;
}
