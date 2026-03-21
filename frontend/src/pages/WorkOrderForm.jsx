import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowRight, Plus, Scissors, Package, Layers, DollarSign, Factory, Download, X } from 'lucide-react';
import api from '../utils/api';
import HelpButton from '../components/HelpButton';
import FabricBlock from '../components/FabricBlock';
import SizeGrid from '../components/SizeGrid';
import AccessoryTable from '../components/AccessoryTable';
import CostPanel from '../components/CostPanel';
import useCostCalc from '../hooks/useCostCalc';
import { useToast } from '../components/Toast';
import { PageHeader, LoadingState } from '../components/ui';

const emptyFabric = (role, wastePct = 5) => ({ fabric_code: '', role, meters_per_piece: '', waste_pct: wastePct, color_note: '' });
const emptySize = () => ({ color_label: '', qty_s: 0, qty_m: 0, qty_l: 0, qty_xl: 0, qty_2xl: 0, qty_3xl: 0 });
const SIZES_KEYS = ['qty_s', 'qty_m', 'qty_l', 'qty_xl', 'qty_2xl', 'qty_3xl'];

export default function WorkOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = !!id;

  // Header
  const [woNumber, setWoNumber] = useState('');
  const [modelId, setModelId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [woNotes, setWoNotes] = useState('');
  const [customerId, setCustomerId] = useState('');

  // Manufacturing data
  const [mainFabrics, setMainFabrics] = useState([emptyFabric('main')]);
  const [linings, setLinings] = useState([emptyFabric('lining')]);
  const [sizes, setSizes] = useState([emptySize()]);
  const [accessories, setAccessories] = useState([]);

  // V4 fields
  const [quantity, setQuantity] = useState('');
  const [isSizeBased, setIsSizeBased] = useState(true);
  const [fabricBatches, setFabricBatches] = useState([]);
  const [batchOptions, setBatchOptions] = useState({});
  const [extraExpenses, setExtraExpenses] = useState([]);

  // Cost
  const [masnaiya, setMasnaiya] = useState('90');
  const [masrouf, setMasrouf] = useState('50');
  const [marginPct, setMarginPct] = useState('25');
  const [consumerPrice, setConsumerPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');

  // Registry
  const [models, setModels] = useState([]);
  const [bomTemplates, setBomTemplates] = useState([]);
  const [fabricsList, setFabricsList] = useState([]);
  const [accessoriesList, setAccessoriesList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [defaultWaste, setDefaultWaste] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sizeTotal = sizes.reduce((sum, row) =>
    sum + SIZES_KEYS.reduce((s, k) => s + (parseInt(row[k]) || 0), 0), 0);
  const grandTotal = isSizeBased ? sizeTotal : (parseInt(quantity) || 0);

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

  useEffect(() => {
    const load = async () => {
      try {
        const [modelsRes, fabRes, accRes, settingsRes, custRes] = await Promise.all([
          api.get('/models'),
          api.get('/fabrics'),
          api.get('/accessories'),
          api.get('/settings'),
          api.get('/customers').catch(() => ({ data: { customers: [] } })),
        ]);
        setModels(modelsRes.data);
        setFabricsList(fabRes.data);
        setAccessoriesList(accRes.data);
        setCustomersList(custRes.data.customers || custRes.data || []);
        const s = settingsRes.data || {};
        setDefaultWaste(parseFloat(s.waste_pct_default) || 5);
        setMasnaiya(s.masnaiya_default ?? '90');
        setMasrouf(s.masrouf_default ?? '50');
        setMarginPct(s.margin_default ?? '25');

        if (isEdit) {
          const { data } = await api.get(`/work-orders/${id}`);
          setWoNumber(data.wo_number || '');
          setModelId(String(data.model_id || ''));
          setTemplateId(String(data.template_id || ''));
          setPriority(data.priority || 'normal');
          setAssignedTo(data.assigned_to || '');
          setDueDate(data.due_date || '');
          setWoNotes(data.notes || '');
          setCustomerId(data.customer_id ? String(data.customer_id) : '');
          setMasnaiya(String(data.masnaiya ?? 90));
          setMasrouf(String(data.masrouf ?? 50));
          setMarginPct(String(data.margin_pct ?? 25));
          setConsumerPrice(data.consumer_price ? String(data.consumer_price) : '');
          setWholesalePrice(data.wholesale_price ? String(data.wholesale_price) : '');
          setQuantity(data.quantity ? String(data.quantity) : '');
          setIsSizeBased(data.is_size_based !== 0);

          const mf = (data.fabrics || []).filter(f => f.role === 'main');
          const lf = (data.fabrics || []).filter(f => f.role === 'lining');
          setMainFabrics(mf.length > 0 ? mf : [emptyFabric('main')]);
          setLinings(lf.length > 0 ? lf : [emptyFabric('lining')]);
          setSizes(data.sizes?.length > 0 ? data.sizes : [emptySize()]);
          setAccessories(data.accessories?.length > 0 ? data.accessories : []);

          // V4 data
          if (data.fabric_batches?.length > 0) setFabricBatches(data.fabric_batches);
          if (data.extra_expenses?.length > 0) setExtraExpenses(data.extra_expenses);

          // Load BOM templates for selected model
          if (data.model_id) {
            const model = modelsRes.data.find(m => m.id === data.model_id);
            if (model) {
              try { const { data: tpls } = await api.get(`/models/${model.model_code}/bom-templates`); setBomTemplates(tpls); } catch {}
            }
          }
        } else {
          const { data } = await api.get('/work-orders/next-number');
          setWoNumber(data.next_number);
        }
      } catch (err) {
        toast.error('فشل تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  // When model changes, load its BOM templates
  const handleModelChange = async (newModelId) => {
    setModelId(newModelId);
    setTemplateId('');
    setBomTemplates([]);
    if (!newModelId) return;
    const model = models.find(m => String(m.id) === String(newModelId));
    if (!model) return;
    try {
      const { data: tpls } = await api.get(`/models/${model.model_code}/bom-templates`);
      setBomTemplates(tpls);
    } catch {}
  };

  // When template changes, load it into the form
  const handleTemplateLoad = async (tplId) => {
    setTemplateId(tplId);
    if (!tplId) return;
    const model = models.find(m => String(m.id) === String(modelId));
    if (!model) return;
    try {
      const { data } = await api.get(`/models/${model.model_code}/bom-templates/${tplId}`);
      const mf = (data.fabrics || []).filter(f => f.role === 'main');
      const lf = (data.fabrics || []).filter(f => f.role === 'lining');
      setMainFabrics(mf.length > 0 ? mf : [emptyFabric('main', defaultWaste)]);
      setLinings(lf.length > 0 ? lf : [emptyFabric('lining')]);
      setSizes(data.sizes?.length > 0 ? data.sizes : [emptySize()]);
      setAccessories(data.accessories?.length > 0 ? data.accessories : []);
      setMasnaiya(String(data.masnaiya ?? masnaiya));
      setMasrouf(String(data.masrouf ?? masrouf));
      setMarginPct(String(data.margin_pct ?? marginPct));
      toast.success('تم تحميل قائمة المواد');
    } catch { toast.error('فشل تحميل القالب'); }
  };

  const onMainFabricChange = useCallback((i, f) => setMainFabrics(prev => prev.map((x, idx) => idx === i ? f : x)), []);
  const onLiningChange = useCallback((i, f) => setLinings(prev => prev.map((x, idx) => idx === i ? f : x)), []);
  const addMainFabric = () => setMainFabrics(prev => [...prev, emptyFabric('main', defaultWaste)]);
  const addLining = () => setLinings(prev => [...prev, emptyFabric('lining')]);
  const removeMainFabric = (i) => { if (mainFabrics.length > 1) setMainFabrics(prev => prev.filter((_, idx) => idx !== i)); };
  const removeLining = (i) => { if (linings.length > 1) setLinings(prev => prev.filter((_, idx) => idx !== i)); };

  const mainFabricOptions = fabricsList.filter(f => f.fabric_type === 'main' || f.fabric_type === 'both');
  const liningOptions = fabricsList.filter(f => f.fabric_type === 'lining' || f.fabric_type === 'both');

  // Batch loading for v4
  const loadBatches = async (fabricCode) => {
    if (batchOptions[fabricCode]) return;
    try {
      const { data } = await api.get(`/fabrics/${encodeURIComponent(fabricCode)}/batches`);
      setBatchOptions(prev => ({ ...prev, [fabricCode]: data }));
    } catch {}
  };

  const addFabricBatch = () => setFabricBatches(prev => [...prev, { batch_id: '', fabric_code: '', role: 'main', planned_meters_per_piece: '', waste_pct: defaultWaste, color_note: '' }]);
  const removeFabricBatch = (i) => setFabricBatches(prev => prev.filter((_, idx) => idx !== i));
  const updateFabricBatch = (i, field, val) => {
    setFabricBatches(prev => prev.map((fb, idx) => {
      if (idx !== i) return fb;
      const updated = { ...fb, [field]: val };
      if (field === 'fabric_code') {
        updated.batch_id = '';
        loadBatches(val);
      }
      return updated;
    }));
  };

  const addExpense = () => setExtraExpenses(prev => [...prev, { description: '', amount: '' }]);
  const removeExpense = (i) => setExtraExpenses(prev => prev.filter((_, idx) => idx !== i));
  const updateExpense = (i, field, val) => setExtraExpenses(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleSave = async () => {
    if (!woNumber.trim() || !modelId) {
      toast.error('رقم الأمر والموديل مطلوبان');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        wo_number: woNumber.trim(),
        model_id: parseInt(modelId),
        template_id: templateId ? parseInt(templateId) : null,
        priority,
        assigned_to: assignedTo.trim() || null,
        due_date: dueDate || null,
        notes: woNotes.trim() || null,
        customer_id: customerId ? parseInt(customerId) : null,
        masnaiya: parseFloat(masnaiya) || 0,
        masrouf: parseFloat(masrouf) || 0,
        margin_pct: parseFloat(marginPct) || 25,
        consumer_price: consumerPrice ? parseFloat(consumerPrice) : null,
        wholesale_price: wholesalePrice ? parseFloat(wholesalePrice) : null,
        quantity: parseInt(quantity) || 0,
        is_size_based: isSizeBased,
        fabrics: [...mainFabrics, ...linings].filter(f => f.fabric_code && f.meters_per_piece),
        accessories: accessories.filter(a => (a.accessory_code || a.accessory_name) && a.quantity),
        sizes: sizes.filter(s => s.color_label),
        fabric_batches: fabricBatches.filter(fb => fb.batch_id && fb.fabric_code).map(fb => ({
          batch_id: parseInt(fb.batch_id),
          fabric_code: fb.fabric_code,
          role: fb.role || 'main',
          planned_meters_per_piece: parseFloat(fb.planned_meters_per_piece) || 1,
          waste_pct: parseFloat(fb.waste_pct) || 0,
          color_note: fb.color_note || null,
        })),
        extra_expenses: extraExpenses.filter(e => e.description && e.amount).map(e => ({
          description: e.description,
          amount: parseFloat(e.amount) || 0,
          notes: e.notes || null,
        })),
      };

      if (isEdit) {
        await api.put(`/work-orders/${id}`, payload);
        toast.success('تم تحديث أمر الإنتاج');
        navigate(`/work-orders/${id}`);
      } else {
        const { data } = await api.post('/work-orders', payload);
        toast.success('تم إنشاء أمر الإنتاج بنجاح');
        navigate(`/work-orders/${data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <PageHeader title={isEdit ? 'تعديل أمر الإنتاج' : 'أمر إنتاج جديد'} subtitle="الشاشة الرئيسية لقرارات التصنيع"
        actions={
          <div className="flex items-center gap-2">
            <HelpButton pageKey="workorderform" />
            <button onClick={() => navigate('/work-orders')} className="btn btn-ghost"><ArrowRight size={16} /> رجوع</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-gold">
              <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        }
      />

      <div className="flex gap-6">
        {/* ======= LEFT: Main content ======= */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* WO Header */}
          <div className="card">
            <div className="card-header"><h3 className="section-title flex items-center gap-2"><Factory size={16} className="text-orange-500" /> بيانات أمر الإنتاج</h3></div>
            <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">رقم الأمر *</label>
                <input type="text" value={woNumber} onChange={e => setWoNumber(e.target.value)} readOnly={isEdit}
                  className={`w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-[#c9a84c] outline-none ${isEdit ? 'bg-gray-50 text-gray-500' : ''}`} />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">الموديل *</label>
                <select value={modelId} onChange={e => handleModelChange(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] outline-none">
                  <option value="">اختر الموديل</option>
                  {models.map(m => <option key={m.id} value={m.id}>[{m.model_code}] {m.model_name || m.serial_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">الأولوية</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] outline-none">
                  <option value="low">منخفض</option>
                  <option value="normal">عادي</option>
                  <option value="high">عالي</option>
                  <option value="urgent">عاجل</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">المسؤول</label>
                <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] outline-none" placeholder="اسم..." />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">تاريخ التسليم</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] outline-none" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">العميل</label>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] outline-none">
                  <option value="">بدون عميل</option>
                  {customersList.map(c => <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>)}
                </select>
              </div>
              {bomTemplates.length > 0 && (
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">
                    تحميل من قائمة مواد
                    <Download size={12} className="inline mr-1 text-indigo-500" />
                  </label>
                  <select value={templateId} onChange={e => handleTemplateLoad(e.target.value)}
                    className="w-full border-2 border-indigo-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-400 outline-none bg-indigo-50/50">
                    <option value="">اختياري — تحميل قالب</option>
                    {bomTemplates.map(t => <option key={t.id} value={t.id}>{t.template_name} {t.is_default ? '⭐' : ''}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">عدد القطع (مباشر)</label>
                <input type="number" min="0" value={quantity} onChange={e => setQuantity(e.target.value)}
                  disabled={isSizeBased}
                  className={`w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-[#c9a84c] outline-none ${isSizeBased ? 'bg-gray-50 text-gray-400' : ''}`} placeholder="0" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isSizeBased} onChange={e => setIsSizeBased(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c]" />
                <span className="text-gray-600">حساب القطع من جدول المقاسات</span>
              </label>
              {!isSizeBased && grandTotal > 0 && (
                <span className="text-xs font-mono font-bold text-[#c9a84c]">{grandTotal} قطعة</span>
              )}
            </div>
            <div className="mt-3">
              <label className="block text-[11px] text-gray-500 mb-1">ملاحظات</label>
              <textarea rows={2} value={woNotes} onChange={e => setWoNotes(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#c9a84c] outline-none resize-none" placeholder="ملاحظات..." />
            </div>
            </div>
          </div>

          {/* Main Fabrics */}
          <div className="card card-body">
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
          <div className="card card-body">
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
          <div className="card card-body">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
              <Layers size={16} className="text-purple-500" /> جدول المقاسات والألوان
              <span className="text-[10px] font-normal text-gray-400">إجمالي القطع: <span className="font-mono font-bold text-[#1a1a2e]">{grandTotal}</span></span>
            </h3>
            <SizeGrid sizes={sizes} onChange={setSizes} />
          </div>

          {/* Accessories */}
          <div className="card card-body">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
              <Package size={16} className="text-amber-500" /> الاكسسوارات
            </h3>
            <AccessoryTable accessories={accessories} accessoriesList={accessoriesList} onChange={setAccessories} />
          </div>

          {/* V4: Fabric Batches (from PO) */}
          <div className="card card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
                <Layers size={16} className="text-teal-500" /> دفعات الأقمشة (من أوامر الشراء)
                <span className="text-[10px] font-normal bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{fabricBatches.length}</span>
              </h3>
              <button onClick={addFabricBatch} className="flex items-center gap-1 text-xs text-[#c9a84c] hover:text-[#a88a3a] bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={14} /> إضافة دفعة
              </button>
            </div>
            {fabricBatches.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">اختياري — اختر دفعات أقمشة من المخزون لحساب التكلفة الفعلية</p>
            ) : (
              <div className="space-y-3">
                {fabricBatches.map((fb, i) => (
                  <div key={i} className="border border-teal-200 rounded-xl p-3 bg-teal-50/30 space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500">القماش</label>
                        <select value={fb.fabric_code || ''} onChange={e => updateFabricBatch(i, 'fabric_code', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-[#c9a84c] outline-none">
                          <option value="">اختر القماش</option>
                          {fabricsList.map(f => <option key={f.code} value={f.code}>[{f.code}] {f.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">الدفعة (Batch)</label>
                        <select value={fb.batch_id || ''} onChange={e => updateFabricBatch(i, 'batch_id', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:border-[#c9a84c] outline-none">
                          <option value="">اختر الدفعة</option>
                          {(batchOptions[fb.fabric_code] || []).map(b => (
                            <option key={b.id} value={b.id}>{b.batch_code} — {b.available_meters}م @ {b.price_per_meter}ج</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">الدور</label>
                        <select value={fb.role || 'main'} onChange={e => updateFabricBatch(i, 'role', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-[#c9a84c] outline-none">
                          <option value="main">أساسي</option>
                          <option value="lining">بطانة</option>
                        </select>
                      </div>
                      <div className="flex items-end gap-1">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500">م/قطعة</label>
                          <input type="number" min="0" step="0.01" value={fb.planned_meters_per_piece || ''}
                            onChange={e => updateFabricBatch(i, 'planned_meters_per_piece', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:border-[#c9a84c] outline-none" placeholder="1.5" />
                        </div>
                        <button onClick={() => removeFabricBatch(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* V4: Extra Expenses */}
          <div className="card card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
                <DollarSign size={16} className="text-red-500" /> مصروفات إضافية
              </h3>
              <button onClick={addExpense} className="flex items-center gap-1 text-xs text-[#c9a84c] hover:text-[#a88a3a] bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={14} /> إضافة مصروف
              </button>
            </div>
            {extraExpenses.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">لا توجد مصروفات إضافية</p>
            ) : (
              <div className="space-y-2">
                {extraExpenses.map((e, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={e.description || ''} onChange={ev => updateExpense(i, 'description', ev.target.value)}
                      placeholder="وصف المصروف" className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
                    <input type="number" min="0" step="0.01" value={e.amount || ''} onChange={ev => updateExpense(i, 'amount', ev.target.value)}
                      placeholder="المبلغ" className="w-28 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
                    <button onClick={() => removeExpense(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cost Panel Mobile */}
          <div className="lg:hidden card card-body">
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
            <div className="card card-body">
              <h3 className="section-title flex items-center gap-2 mb-4">
                <DollarSign size={16} className="text-[var(--color-gold)]" /> التكلفة والتسعير
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
            <div className="bg-gradient-to-br from-[var(--color-navy)] to-[var(--color-navy-light)] rounded-xl p-5 text-white">
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

      {/* Bottom Bar */}
      <div className="sticky bottom-0 mt-6 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 flex items-center justify-between no-print border border-[var(--color-border)]">
        <div className="text-sm text-gray-500">
          إجمالي القطع: <span className="font-mono font-bold text-[#1a1a2e]">{grandTotal}</span>
          &nbsp;•&nbsp; تكلفة القطعة: <span className="font-mono font-bold text-[#c9a84c]">{(Math.round(cost.cost_per_piece * 100) / 100).toLocaleString('ar-EG')} ج</span>
          &nbsp;•&nbsp; الإجمالي: <span className="font-mono font-bold text-[#1a1a2e]">{(Math.round(cost.total_cost * 100) / 100).toLocaleString('ar-EG')} ج</span>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn btn-gold">
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ أمر الإنتاج'}
        </button>
      </div>
    </div>
  );
}
