import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Printer, Plus, Camera, FileText, Layers, Package, Scissors, DollarSign, GitBranch } from 'lucide-react';
import axios from 'axios';
import ImageUpload from '../components/ImageUpload';
import FabricBlock from '../components/FabricBlock';
import SizeGrid from '../components/SizeGrid';
import AccessoryTable from '../components/AccessoryTable';
import CostPanel from '../components/CostPanel';
import BomVariantTabs from '../components/BomVariantTabs';
import useCostCalc from '../hooks/useCostCalc';
import { useToast } from '../components/Toast';

const emptyFabric = (role, wastePct = 5) => ({ fabric_code: '', role, meters_per_piece: '', waste_pct: wastePct, color_note: '', swatch: null });
const emptySize = () => ({ color_label: '', qty_s: 0, qty_m: 0, qty_l: 0, qty_xl: 0, qty_2xl: 0, qty_3xl: 0 });
const SIZES_KEYS = ['qty_s', 'qty_m', 'qty_l', 'qty_xl', 'qty_2xl', 'qty_3xl'];

export default function ModelForm() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = !!code;

  // Header
  const [serial, setSerial] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [modelName, setModelName] = useState('');
  const [notes, setNotes] = useState('');
  const [modelImage, setModelImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  // Sub-arrays
  const [mainFabrics, setMainFabrics] = useState([emptyFabric('main')]);
  const [linings, setLinings] = useState([emptyFabric('lining')]);
  const [sizes, setSizes] = useState([emptySize()]);
  const [accessories, setAccessories] = useState([]);

  // Cost
  const [masnaiya, setMasnaiya] = useState('90');
  const [masrouf, setMasrouf] = useState('50');
  const [marginPct, setMarginPct] = useState('25');
  const [consumerPrice, setConsumerPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');

  // Registry data
  const [fabricsList, setFabricsList] = useState([]);
  const [accessoriesList, setAccessoriesList] = useState([]);
  const [defaultWaste, setDefaultWaste] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Grand total calculation
  const grandTotal = sizes.reduce((sum, row) =>
    sum + SIZES_KEYS.reduce((s, k) => s + (parseInt(row[k]) || 0), 0), 0);

  // Build fabrics array for cost calc — include price from registry
  const allFabrics = [...mainFabrics, ...linings].map(f => ({
    ...f,
    price_per_meter: fabricsList.find(x => x.code === f.fabric_code)?.price_per_m || 0,
    meters: (parseFloat(f.meters_per_piece) || 0) * grandTotal,
  }));

  const cost = useCostCalc({
    fabrics: allFabrics,
    accessories,
    masnaiya,
    masrouf,
    grandTotalPieces: grandTotal,
  });

  // fetch registries + model (if edit) + settings (if new)
  useEffect(() => {
    const load = async () => {
      try {
        const [fabRes, accRes, settingsRes] = await Promise.all([
          axios.get('/api/fabrics'),
          axios.get('/api/accessories'),
          axios.get('/api/settings'),
        ]);
        setFabricsList(fabRes.data);
        setAccessoriesList(accRes.data);
        const s = settingsRes.data || {};

        if (isEdit) {
          const { data } = await axios.get(`/api/models/${code}`);
          setSerial(data.serial_number || '');
          setModelCode(data.model_code || '');
          setModelName(data.model_name || '');
          setNotes(data.notes || '');
          setModelImage(data.model_image || null);
          setMasnaiya(String(data.masnaiya ?? 90));
          setMasrouf(String(data.masrouf ?? 50));
          setConsumerPrice(data.consumer_price ? String(data.consumer_price) : '');
          setWholesalePrice(data.wholesale_price ? String(data.wholesale_price) : '');

          const mf = (data.fabrics || []).filter(f => f.role === 'main');
          const lf = (data.fabrics || []).filter(f => f.role === 'lining');
          setMainFabrics(mf.length > 0 ? mf : [emptyFabric('main')]);
          setLinings(lf.length > 0 ? lf : [emptyFabric('lining')]);
          setSizes(data.sizes?.length > 0 ? data.sizes : [emptySize()]);
          setAccessories(data.accessories?.length > 0 ? data.accessories : []);
        } else {
          // Apply settings defaults for new model
          const defMasnaiya = s.masnaiya_default ?? '90';
          const defMasrouf = s.masrouf_default ?? '50';
          const defWaste = s.waste_pct_default ?? '5';
          const defMargin = s.margin_default ?? '30';
          setMasnaiya(defMasnaiya);
          setMasrouf(defMasrouf);
          setMarginPct(defMargin);
          setDefaultWaste(parseFloat(defWaste) || 5);
          setMainFabrics([emptyFabric('main', parseFloat(defWaste) || 5)]);
          setLinings([emptyFabric('lining')]);

          const { data } = await axios.get('/api/models/next-serial');
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

  // Fabric change handlers
  const onMainFabricChange = useCallback((i, f) => setMainFabrics(prev => prev.map((x, idx) => idx === i ? f : x)), []);
  const onLiningChange = useCallback((i, f) => setLinings(prev => prev.map((x, idx) => idx === i ? f : x)), []);
  const addMainFabric = () => setMainFabrics(prev => [...prev, emptyFabric('main', defaultWaste)]);
  const addLining = () => setLinings(prev => [...prev, emptyFabric('lining')]);
  const removeMainFabric = (i) => { if (mainFabrics.length > 1) setMainFabrics(prev => prev.filter((_, idx) => idx !== i)); };
  const removeLining = (i) => { if (linings.length > 1) setLinings(prev => prev.filter((_, idx) => idx !== i)); };

  // Filter fabrics list per role
  const mainFabricOptions = fabricsList.filter(f => f.fabric_type === 'main' || f.fabric_type === 'both');
  const liningOptions = fabricsList.filter(f => f.fabric_type === 'lining' || f.fabric_type === 'both');

  // Save
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
        masnaiya: parseFloat(masnaiya) || 0,
        masrouf: parseFloat(masrouf) || 0,
        consumer_price: consumerPrice ? parseFloat(consumerPrice) : null,
        wholesale_price: wholesalePrice ? parseFloat(wholesalePrice) : null,
        notes: notes.trim() || null,
        fabrics: [...mainFabrics, ...linings].filter(f => f.fabric_code && f.meters_per_piece),
        accessories: accessories.filter(a => a.quantity && a.unit_price),
        sizes: sizes.filter(s => s.color_label),
      };

      let savedCode;
      if (isEdit) {
        await axios.put(`/api/models/${code}`, payload);
        savedCode = code;
        toast.success('تم تحديث الموديل بنجاح');
      } else {
        const { data } = await axios.post('/api/models', payload);
        savedCode = data.model_code;
        toast.success('تم إنشاء الموديل بنجاح');
      }

      // Upload image if new file selected
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await axios.post(`/api/models/${savedCode}/image`, fd);
      }

      navigate(`/models/${savedCode}/edit`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">{isEdit ? 'تعديل الموديل' : 'موديل جديد'}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{isEdit ? `كود: ${code}` : 'نموذج الموديل — صفحة رئيسية'}</p>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <>
              <button onClick={() => window.open(`/models/${code}/invoice`, '_blank')}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">
                <FileText size={16} /> فاتورة
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

      <div className="flex gap-6">
        {/* ======= LEFT: Main content ======= */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Top Row: Image + Basic Info */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center justify-center">
              <ImageUpload size="lg"
                value={modelImage}
                onChange={(file) => {
                  setImageFile(file);
                  if (file) setModelImage(URL.createObjectURL(file));
                }} />
              <p className="text-[10px] text-gray-400 mt-2">صورة الموديل</p>
            </div>
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
              </div>
              <div className="mt-4">
                <label className="block text-[11px] text-gray-500 mb-1">ملاحظات</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all resize-none"
                  placeholder="ملاحظات اختيارية..." />
              </div>
            </div>
          </div>

          {/* Main Fabrics — FULL WIDTH */}
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

          {/* Linings — FULL WIDTH */}
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

          {/* Size Grid — FULL WIDTH */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
              <Layers size={16} className="text-purple-500" /> جدول المقاسات والألوان
              <span className="text-[10px] font-normal text-gray-400">إجمالي القطع: <span className="font-mono font-bold text-[#1a1a2e]">{grandTotal}</span></span>
            </h3>
            <SizeGrid sizes={sizes} onChange={setSizes} />
          </div>

          {/* Accessories — FULL WIDTH */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
              <Package size={16} className="text-amber-500" /> الاكسسوارات
            </h3>
            <AccessoryTable accessories={accessories} accessoriesList={accessoriesList} onChange={setAccessories} />
          </div>

          {/* BOM Variants — FULL WIDTH */}
          {isEdit && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
                <GitBranch size={16} className="text-indigo-500" /> متغيرات BOM
                <span className="text-[10px] font-normal text-gray-400">نسخ بديلة من الخامات</span>
              </h3>
              <BomVariantTabs modelCode={code} fabricsList={fabricsList} accessoriesList={accessoriesList} />
            </div>
          )}

          {/* Cost Panel — Full width on mobile, visible in main flow */}
          <div className="lg:hidden bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-[#c9a84c]" /> التكلفة والتسعير
            </h3>
            <CostPanel
              cost={cost}
              masnaiya={masnaiya} masrouf={masrouf} marginPct={marginPct}
              consumerPrice={consumerPrice} wholesalePrice={wholesalePrice}
              onChangeMasnaiya={setMasnaiya} onChangeMasrouf={setMasrouf} onChangeMargin={setMarginPct}
              onChangeConsumer={setConsumerPrice} onChangeWholesale={setWholesalePrice}
            />
          </div>
        </div>

        {/* ======= RIGHT: Sticky Cost Sidebar (desktop) ======= */}
        <div className="hidden lg:block w-[320px] shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
                <DollarSign size={16} className="text-[#c9a84c]" /> التكلفة والتسعير
              </h3>
              <CostPanel
                cost={cost}
                masnaiya={masnaiya} masrouf={masrouf} marginPct={marginPct}
                consumerPrice={consumerPrice} wholesalePrice={wholesalePrice}
                onChangeMasnaiya={setMasnaiya} onChangeMasrouf={setMasrouf} onChangeMargin={setMarginPct}
                onChangeConsumer={setConsumerPrice} onChangeWholesale={setWholesalePrice}
              />
            </div>

            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4e] rounded-2xl p-5 text-white">
              <h4 className="text-xs text-gray-300 mb-3">ملخص سريع</h4>
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
                  <span className="font-mono font-bold">{accessories.filter(a=>a.accessory_code).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">الألوان</span>
                  <span className="font-mono font-bold">{sizes.filter(s=>s.color_label).length}</span>
                </div>
                <hr className="border-white/10" />
                <div className="flex justify-between">
                  <span className="text-gray-300 text-sm">تكلفة القطعة</span>
                  <span className="font-mono font-bold text-[#c9a84c] text-lg">{(Math.round(cost.cost_per_piece * 100) / 100).toLocaleString('ar-EG')} ج</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="sticky bottom-0 mt-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-4 flex items-center justify-between no-print border border-gray-100">
        <div className="text-sm text-gray-500">
          إجمالي القطع: <span className="font-mono font-bold text-[#1a1a2e]">{grandTotal}</span>
          &nbsp;•&nbsp; تكلفة القطعة: <span className="font-mono font-bold text-[#c9a84c]">{(Math.round(cost.cost_per_piece * 100) / 100).toLocaleString('ar-EG')} ج</span>
          &nbsp;•&nbsp; الإجمالي: <span className="font-mono font-bold text-[#1a1a2e]">{(Math.round(cost.total_cost * 100) / 100).toLocaleString('ar-EG')} ج</span>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-6 py-2.5 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ الموديل'}
        </button>
      </div>
    </div>
  );
}
