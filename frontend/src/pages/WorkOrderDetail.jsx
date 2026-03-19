import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Play, Trash2, Edit2, Scissors, Package, DollarSign, Layers, FileText, Receipt, Plus, CheckCircle, AlertTriangle, History, Beaker, Printer, XCircle } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import StageChecklist from '../components/StageChecklist';
import CostPanel from '../components/CostPanel';

const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

function ConfirmModal({ open, title, message, confirmLabel = 'تأكيد', confirmClass = 'bg-red-500 hover:bg-red-600', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-bold text-[#1a1a2e] mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600">
            إلغاء
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg text-sm font-bold ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
const TABS = [
  { key: 'stages', label: 'المراحل / WIP', icon: Layers },
  { key: 'materials', label: 'المواد والتكلفة', icon: Beaker },
  { key: 'fabrics', label: 'الأقمشة والدفعات', icon: Scissors },
  { key: 'accessories', label: 'الاكسسوارات', icon: Package },
  { key: 'expenses', label: 'المصاريف', icon: DollarSign },
  { key: 'cost', label: 'ملخص التكلفة', icon: Receipt },
  { key: 'invoices', label: 'الفواتير الجزئية', icon: FileText },
];

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [wo, setWo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('stages');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, confirmLabel: 'تأكيد', confirmClass: 'bg-red-500 hover:bg-red-600' });
  const [logExpanded, setLogExpanded] = useState(false);

  const openConfirm = (title, message, onConfirm, confirmLabel, confirmClass) =>
    setConfirmModal({ open: true, title, message, onConfirm, confirmLabel: confirmLabel || 'تأكيد', confirmClass: confirmClass || 'bg-red-500 hover:bg-red-600' });
  const closeConfirm = () => setConfirmModal({ open: false, title: '', message: '', onConfirm: null });

  // Expense form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  // Partial invoice form
  const [invPieces, setInvPieces] = useState('');
  const [invPrice, setInvPrice] = useState('');
  // V8: Materials & consumption
  const [consumptionData, setConsumptionData] = useState(null);
  const [wasteForm, setWasteForm] = useState({ waste_meters: '', price_per_meter: '', notes: '' });
  const [consumptionForm, setConsumptionForm] = useState({ fabric_code: '', batch_id: '', actual_meters: '', notes: '' });
  // V8: Create invoice from WO
  const [invoiceForm, setInvoiceForm] = useState({ qty: '', price: '', customer_name: '', notes: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/work-orders/${id}`);
      setWo(data);
    } catch { toast.error('فشل تحميل أمر العمل'); navigate('/work-orders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  // V8: Load consumption data when materials tab is active
  const loadConsumption = useCallback(async () => {
    try {
      const { data } = await api.get(`/work-orders/${id}/fabric-consumption`);
      setConsumptionData(data);
    } catch {}
  }, [id]);

  useEffect(() => { if (tab === 'materials' && wo) loadConsumption(); }, [tab, wo?.id]);

  // V8: Add fabric consumption
  const handleAddConsumption = async () => {
    const { fabric_code, batch_id, actual_meters, notes } = consumptionForm;
    if (!actual_meters || parseFloat(actual_meters) <= 0) return toast.error('يجب تحديد الكمية');
    // Determine fabric_id and price from batch
    let fabric_id = 0;
    let price = 0;
    if (batch_id && consumptionData?.available_batches) {
      for (const batches of Object.values(consumptionData.available_batches)) {
        const b = batches.find(b => b.batch_id === parseInt(batch_id));
        if (b) { price = b.price_per_meter; break; }
      }
    }
    // Find fabric by code
    const fab = (wo.fabrics || []).find(f => f.fabric_code === fabric_code) || (wo.fabric_batches || []).find(f => f.fabric_code === fabric_code);
    if (fab) fabric_id = fab.id || 0;

    try {
      const { data } = await api.post(`/work-orders/${id}/fabric-consumption`, {
        fabric_id, fabric_code, batch_id: batch_id ? parseInt(batch_id) : null,
        actual_meters: parseFloat(actual_meters), price_per_meter: price, notes
      });
      setWo(data);
      setConsumptionForm({ fabric_code: '', batch_id: '', actual_meters: '', notes: '' });
      loadConsumption();
      toast.success('تم تسجيل الاستهلاك');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  // V8: Add waste
  const handleAddWaste = async () => {
    const { waste_meters, price_per_meter, notes } = wasteForm;
    if (!waste_meters || parseFloat(waste_meters) <= 0) return toast.error('يجب تحديد كمية الهدر');
    try {
      const { data } = await api.post(`/work-orders/${id}/waste`, {
        waste_meters: parseFloat(waste_meters), price_per_meter: parseFloat(price_per_meter) || 0, notes
      });
      setWo(data);
      setWasteForm({ waste_meters: '', price_per_meter: '', notes: '' });
      toast.success('تم تسجيل الهدر');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  // V8: Create invoice from WO
  const handleCreateInvoice = async () => {
    const { qty, price, customer_name, notes } = invoiceForm;
    if (!qty || parseInt(qty) <= 0) return toast.error('يجب تحديد عدد القطع');
    try {
      const { data } = await api.post(`/work-orders/${id}/create-invoice`, {
        qty_to_invoice: parseInt(qty), unit_price: parseFloat(price) || 0, customer_name, notes
      });
      setWo(data.wo);
      setInvoiceForm({ qty: '', price: '', customer_name: '', notes: '' });
      toast.success(`تم إصدار فاتورة ${data.invoice_number} لـ ${qty} قطعة`);
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleStageAction = async (stageId, status) => {
    try {
      const { data } = await api.patch(`/work-orders/${id}/stages/${stageId}`, { status });
      setWo(data); toast.success('تم تحديث المرحلة');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleStageAdvance = async (advanceData) => {
    try {
      const { data } = await api.patch(`/work-orders/${id}/stage-advance`, advanceData);
      setWo(data);
      toast.success(`تم نقل ${advanceData.qty_to_pass} قطعة للمرحلة التالية`
        + (advanceData.qty_rejected > 0 ? ` • مرفوض: ${advanceData.qty_rejected}` : ''));
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في النقل'); }
  };

  const handleStageStart = async (stageId) => {
    try {
      const { data } = await api.patch(`/work-orders/${id}/stage-start`, { stage_id: stageId });
      setWo(data); toast.success('تم بدء المرحلة');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleStageSkip = async (stageId) => {
    try {
      const { data } = await api.patch(`/work-orders/${id}/stages/${stageId}`, { status: 'skipped' });
      setWo(data); toast.success('تم تخطي المرحلة');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleDelete = () => {
    openConfirm(
      'إلغاء أمر الشغل',
      `هل أنت متأكد من إلغاء أمر الشغل ${wo?.wo_number}؟ لا يمكن التراجع عن هذا الإجراء.`,
      async () => {
        closeConfirm();
        try { await api.delete(`/work-orders/${id}`); toast.success('تم الإلغاء'); navigate('/work-orders'); }
        catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
      }
    );
  };

  const handleStatusChange = async (status) => {
    try { await api.patch(`/work-orders/${id}/status`, { status }); toast.success('تم تحديث الحالة'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleAddExpense = async () => {
    if (!expDesc || !expAmount) return;
    try {
      const { data } = await api.post(`/work-orders/${id}/expenses`, { description: expDesc, amount: parseFloat(expAmount) });
      setWo(data); setExpDesc(''); setExpAmount(''); toast.success('تمت إضافة المصروف');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleDeleteExpense = async (expId) => {
    try { const { data } = await api.delete(`/work-orders/${id}/expenses/${expId}`); setWo(data); toast.success('تم الحذف'); }
    catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handlePartialInvoice = async () => {
    if (!invPieces) return;
    try {
      const { data } = await api.post(`/work-orders/${id}/partial-invoice`, {
        pieces_invoiced: parseInt(invPieces),
        invoice_price_per_piece: invPrice ? parseFloat(invPrice) : undefined,
      });
      setWo(data); setInvPieces(''); setInvPrice(''); toast.success('تمت إضافة فاتورة جزئية');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleFinalize = () => {
    openConfirm(
      'إنهاء الإنتاج',
      'هل تريد إنهاء الإنتاج وتسجيل التكلفة النهائية؟ لا يمكن التراجع.',
      async () => {
        closeConfirm();
        try { const { data } = await api.post(`/work-orders/${id}/finalize`, {});
          setWo(data); toast.success('تم إنهاء الإنتاج بنجاح'); }
        catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
      },
      'إنهاء الإنتاج',
      'bg-green-500 hover:bg-green-600'
    );
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error('سبب الإلغاء مطلوب'); return; }
    try {
      const { data } = await api.post(`/work-orders/${id}/cancel`, { cancel_reason: cancelReason.trim() });
      setWo(data);
      setShowCancelModal(false);
      setCancelReason('');
      toast.success('تم إلغاء أمر التشغيل');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الإلغاء'); }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>;
  if (!wo) return null;

  const completedStages = wo.stages?.filter(s => s.status === 'completed').length || 0;
  const totalStages = wo.stages?.length || 0;
  const cs = wo.cost_summary || {};
  const totalPieces = wo.quantity || cs.total_pieces || cs.grand_total_pieces || 0;
  const piecesCompleted = wo.pieces_completed || 0;
  const progressPct = totalPieces > 0 ? Math.round((piecesCompleted / totalPieces) * 100) : 0;
  const alreadyInvoiced = (wo.partial_invoices || []).reduce((s, i) => s + (i.pieces_invoiced || 0), 0);
  const piecesInProgress = (wo.stages || []).reduce((s, st) => s + (st.quantity_in_stage || 0), 0);
  const piecesRejected = (wo.stages || []).reduce((s, st) => s + (st.quantity_rejected || 0), 0);
  const piecesNotStarted = Math.max(0, totalPieces - piecesCompleted - piecesInProgress - piecesRejected);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/work-orders')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowRight size={20} /></button>
          <div>
            <h2 className="text-xl font-bold text-[#1a1a2e] flex items-center gap-2">
              <span className="font-mono text-[#c9a84c]">{wo.wo_number}</span>
              <StatusBadge status={wo.status} type="work_order" />
            </h2>
            <p className="text-xs text-gray-400">{wo.model_code} — {wo.model_name || ''} {wo.template_name ? `• ${wo.template_name}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {wo.status === 'draft' && <button onClick={() => handleStatusChange('in_progress')} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold"><Play size={14} /> بدء التنفيذ</button>}
          {wo.status === 'in_progress' && <button onClick={handleFinalize} className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold"><CheckCircle size={14} /> إنهاء الإنتاج</button>}
          {!['completed', 'cancelled', 'delivered'].includes(wo.status) && (
            <button onClick={() => setShowCancelModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm"><XCircle size={14} /> إلغاء</button>
          )}
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"><Printer size={14} /> طباعة</button>
          <button onClick={() => navigate(`/work-orders/${id}/edit`)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"><Edit2 size={14} /> تعديل</button>
          <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
        </div>
      </div>

      {/* Cancellation banner */}
      {wo.status === 'cancelled' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <XCircle size={20} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">تم إلغاء أمر التشغيل</p>
            {wo.cancel_reason && <p className="text-xs text-red-600 mt-1">السبب: {wo.cancel_reason}</p>}
            {wo.cancelled_at && <p className="text-[10px] text-red-400 mt-1">بتاريخ: {new Date(wo.cancelled_at).toLocaleString('ar-EG')}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: tabs + main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Info card */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-400">الكمية:</span> <span className="font-mono font-bold">{totalPieces} قطعة</span></div>
              <div><span className="text-gray-400">مكتمل:</span> <span className="font-mono font-bold text-green-600">{piecesCompleted} قطعة</span></div>
              <div><span className="text-gray-400">الأولوية:</span> <span className="font-bold">{({low:'منخفض',normal:'عادي',high:'عالي',urgent:'عاجل'})[wo.priority]}</span></div>
              <div><span className="text-gray-400">المسؤول:</span> <span className="font-bold">{wo.assigned_to || '—'}</span></div>
              {wo.due_date && <div><span className="text-gray-400">التسليم:</span> <span className="font-mono">{new Date(wo.due_date).toLocaleDateString('ar-EG')}</span></div>}
              {wo.notes && <div className="col-span-2"><span className="text-gray-400">ملاحظات:</span> <span>{wo.notes}</span></div>}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${tab === t.key ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'stages' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">مراحل الإنتاج</h3>
                <StageChecklist
                  stages={wo.stages || []}
                  editable={['draft', 'pending', 'in_progress'].includes(wo.status)}
                  totalQty={wo.quantity || 0}
                  onAdvance={handleStageAdvance}
                  onStart={handleStageStart}
                  onSkip={handleStageSkip}
                />
              </div>
              {/* Quantity Integrity */}
              {wo.quantity_integrity && !wo.quantity_integrity.ok && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle size={14} />
                  <span>تحذير: الكميات غير متوازنة — إجمالي الأمر: {wo.quantity_integrity.total_ordered}، في المراحل: {wo.quantity_integrity.total_in_stages}، مكتمل: {wo.quantity_integrity.total_completed}، مرفوض: {wo.quantity_integrity.total_rejected} (فرق: {wo.quantity_integrity.difference})</span>
                </div>
              )}
              {/* Movement Log */}
              {wo.movement_log?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => setLogExpanded(!logExpanded)}
                    className="w-full flex items-center justify-between p-4 text-sm font-bold text-[#1a1a2e] hover:bg-gray-50">
                    <span className="flex items-center gap-2">
                      <History size={15} className="text-indigo-400" />
                      سجل حركة الإنتاج ({wo.movement_log.length} سجل)
                    </span>
                    <span className="text-gray-400 text-xs">{logExpanded ? '▲ إخفاء' : '▼ عرض'}</span>
                  </button>
                  {logExpanded && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {wo.movement_log.map(log => (
                        <div key={log.id} className="flex items-start gap-3 text-xs p-3 hover:bg-gray-50">
                          <div className="flex-1">
                            <span className="font-bold">{log.from_stage_name}</span>
                            <span className="text-gray-300 mx-1.5">→</span>
                            <span className="font-bold text-blue-600">{log.to_stage_name || 'تسليم نهائي'}</span>
                            <span className="font-mono text-green-600 mx-2">+{log.qty_moved}</span>
                            {log.qty_rejected > 0 && (
                              <span className="font-mono text-red-500">
                                -{log.qty_rejected}
                                {log.rejection_reason && ` (${log.rejection_reason})`}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 text-left whitespace-nowrap shrink-0">
                            <div className="font-medium">{log.moved_by_name}</div>
                            <div>{new Date(log.moved_at).toLocaleString('ar-EG')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'materials' && (
            <div className="space-y-4">
              {/* Section 1: Fabric consumption */}
              <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2"><Scissors size={16} className="text-blue-500" /> أقمشة مستخدمة</h3>
                {/* Existing consumption records */}
                {(wo.fabric_consumption || []).length > 0 && (
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-gray-400 border-b"><th className="pb-2 text-right">القماش</th><th className="pb-2 text-center">الدفعة</th><th className="pb-2 text-center">المخطط</th><th className="pb-2 text-center">الفعلي</th><th className="pb-2 text-center">السعر/م</th><th className="pb-2 text-center">التكلفة</th></tr></thead>
                    <tbody>
                      {wo.fabric_consumption.map(c => (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-2 text-right">{c.fabric_name || c.fabric_code}</td>
                          <td className="py-2 text-center text-xs font-mono text-gray-500">{c.batch_code || c.po_number || '—'}</td>
                          <td className="py-2 text-center font-mono">{fmt(c.planned_meters)}</td>
                          <td className="py-2 text-center font-mono font-bold">{fmt(c.actual_meters)}</td>
                          <td className="py-2 text-center font-mono">{fmt(c.price_per_meter)}</td>
                          <td className="py-2 text-center font-mono text-[#c9a84c] font-bold">{fmt(c.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {/* Add consumption form */}
                {['draft', 'pending', 'in_progress'].includes(wo.status) && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-gray-500 font-bold">إضافة استهلاك قماش</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <select value={consumptionForm.fabric_code} onChange={e => {
                        setConsumptionForm(f => ({ ...f, fabric_code: e.target.value, batch_id: '' }));
                      }} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                        <option value="">— القماش —</option>
                        {[...(wo.fabrics || []).map(f => f.fabric_code), ...(wo.fabric_batches || []).map(f => f.fabric_code)]
                          .filter((v, i, a) => v && a.indexOf(v) === i)
                          .map(code => <option key={code} value={code}>{(wo.fabrics || []).find(f => f.fabric_code === code)?.fabric_name || code}</option>)}
                      </select>
                      <select value={consumptionForm.batch_id} onChange={e => setConsumptionForm(f => ({ ...f, batch_id: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                        <option value="">— الدفعة —</option>
                        {(consumptionData?.available_batches?.[consumptionForm.fabric_code] || []).map(b => (
                          <option key={b.batch_id} value={b.batch_id}>{b.po_number || b.batch_code} | {fmt(b.price_per_meter)} ج/م | متاح {fmt(b.available_meters)} م</option>
                        ))}
                      </select>
                      <input type="number" placeholder="الكمية (م)" value={consumptionForm.actual_meters}
                        onChange={e => setConsumptionForm(f => ({ ...f, actual_meters: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono text-center" />
                      <button onClick={handleAddConsumption} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"><Plus size={14} className="inline" /> تسجيل</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Waste */}
              <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2"><AlertTriangle size={16} className="text-orange-500" /> هدر القماش</h3>
                {(wo.waste_records || []).length > 0 && (
                  <div className="space-y-1">
                    {wo.waste_records.map(w => (
                      <div key={w.id} className="flex justify-between text-sm bg-orange-50 rounded-lg px-3 py-2">
                        <span>{fmt(w.waste_meters)} م × {fmt(w.price_per_meter)} ج/م</span>
                        <span className="font-mono font-bold text-orange-600">{fmt(w.waste_cost)} ج</span>
                      </div>
                    ))}
                  </div>
                )}
                {['draft', 'pending', 'in_progress'].includes(wo.status) && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" placeholder="كمية الهدر (م)" value={wasteForm.waste_meters}
                        onChange={e => setWasteForm(f => ({ ...f, waste_meters: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono text-center" />
                      <input type="number" placeholder="السعر/م" value={wasteForm.price_per_meter}
                        onChange={e => setWasteForm(f => ({ ...f, price_per_meter: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono text-center" />
                      <button onClick={handleAddWaste} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm">تسجيل الهدر</button>
                    </div>
                    {wasteForm.waste_meters && wasteForm.price_per_meter && (
                      <p className="text-xs text-gray-500">
                        تكلفة الهدر: <span className="font-mono font-bold">{fmt(parseFloat(wasteForm.waste_meters) * parseFloat(wasteForm.price_per_meter))}</span> ج
                        {piecesCompleted > 0 && <> • هدر/قطعة: <span className="font-mono">{fmt(parseFloat(wasteForm.waste_meters) * parseFloat(wasteForm.price_per_meter) / piecesCompleted)}</span> ج</>}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400">يُضاف تلقائياً لتكلفة القطعة</p>
                  </div>
                )}
              </div>

              {/* Section 3: Cost Summary Card */}
              <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4e] rounded-2xl p-5 text-white">
                <h3 className="text-sm font-bold mb-4">ملخص التكلفة</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">تكلفة الأقمشة</span><span className="font-mono">{fmt(wo.total_fabric_consumption_cost || cs.main_fabric_cost + cs.lining_cost)} ج</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">تكلفة الاكسسوار</span><span className="font-mono">{fmt(wo.total_accessory_consumption_cost || cs.accessories_cost)} ج</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">المصنعية</span><span className="font-mono">{fmt(cs.masnaiya_total)} ج</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">المصروف</span><span className="font-mono">{fmt(cs.masrouf_total)} ج</span></div>
                  <div className="flex justify-between text-orange-400"><span>تكلفة الهدر</span><span className="font-mono">{fmt(wo.total_waste_cost || cs.waste_cost)} ج</span></div>
                  <hr className="border-white/20" />
                  {(() => {
                    const totalFab = wo.total_fabric_consumption_cost || (cs.main_fabric_cost + cs.lining_cost);
                    const totalAcc = wo.total_accessory_consumption_cost || cs.accessories_cost;
                    const totalW = wo.total_waste_cost || cs.waste_cost || 0;
                    const grand = totalFab + totalAcc + cs.masnaiya_total + cs.masrouf_total + totalW + (cs.extra_expenses || 0);
                    const cpp = piecesCompleted > 0 ? grand / piecesCompleted : cs.cost_per_piece;
                    return (
                      <>
                        <div className="flex justify-between font-bold text-base"><span>إجمالي التكلفة</span><span className="font-mono text-[#c9a84c]">{fmt(grand)} ج</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">القطع المكتملة</span><span className="font-mono font-bold">{piecesCompleted}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">تكلفة القطعة</span><span className="font-mono font-bold text-[#c9a84c]">{fmt(cpp)} ج</span></div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {tab === 'fabrics' && (
            <div className="space-y-4">
              {/* Batch-based fabrics */}
              {wo.fabric_batches?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2"><Scissors size={16} className="text-blue-500" /> دفعات الأقمشة (V4)</h3>
                  <div className="space-y-2">
                    {wo.fabric_batches.map((f, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 text-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded ${f.role === 'main' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{f.role === 'main' ? 'أساسي' : 'بطانة'}</span>
                          <span className="font-bold">{f.fabric_name || f.fabric_code}</span>
                          <span className="text-[10px] font-mono text-gray-400">دفعة: {f.batch_code}</span>
                          {f.supplier_name && <span className="text-[10px] text-gray-400">({f.supplier_name})</span>}
                          {f.po_number && <span className="text-[10px] font-mono text-indigo-500">{f.po_number}</span>}
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div><span className="text-gray-400">مخطط:</span> <span className="font-mono">{fmt(f.planned_total_meters)} م</span></div>
                          <div><span className="text-gray-400">فعلي:</span> <span className="font-mono">{fmt(f.actual_total_meters || f.planned_total_meters)} م</span></div>
                          <div><span className="text-gray-400">هدر:</span> <span className="font-mono text-orange-500">{fmt(f.waste_meters)} م</span></div>
                          <div><span className="text-gray-400">السعر:</span> <span className="font-mono text-[#c9a84c]">{fmt(f.price_per_meter)} ج/م</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy fabrics */}
              {wo.fabrics?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2"><Scissors size={16} className="text-blue-500" /> الأقمشة</h3>
                  <div className="space-y-2">
                    {wo.fabrics.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 text-sm">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${f.role === 'main' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{f.role === 'main' ? 'أساسي' : 'بطانة'}</span>
                        <span className="font-bold">{f.fabric_name || f.fabric_code}</span>
                        <span className="text-gray-400 font-mono text-xs">{f.meters_per_piece || 0} م/قطعة</span>
                        {f.waste_pct > 0 && <span className="text-[10px] text-orange-500">+{f.waste_pct}% هدر</span>}
                        <span className="mr-auto font-mono text-[#c9a84c] font-bold">{fmt(f.price_per_m)} ج/م</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'accessories' && (
            <div className="space-y-4">
              {wo.accessories_detail?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2"><Package size={16} className="text-purple-500" /> اكسسوارات تفصيلية (V4)</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-gray-400"><th className="text-right pb-2">الاسم</th><th className="text-center pb-2">لكل قطعة</th><th className="text-center pb-2">السعر</th><th className="text-center pb-2">الإجمالي المخطط</th></tr></thead>
                    <tbody>
                      {wo.accessories_detail.map((a, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-2 font-bold">{a.accessory_name || a.registry_name || a.accessory_code}</td>
                          <td className="py-2 text-center font-mono">{a.quantity_per_piece}</td>
                          <td className="py-2 text-center font-mono">{fmt(a.unit_price)}</td>
                          <td className="py-2 text-center font-mono font-bold text-[#c9a84c]">{fmt(a.planned_total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {wo.accessories?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2"><Package size={16} className="text-purple-500" /> الاكسسوارات</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-gray-400"><th className="text-right pb-2">الاسم</th><th className="text-center pb-2">الكمية</th><th className="text-center pb-2">السعر</th><th className="text-center pb-2">الإجمالي</th></tr></thead>
                    <tbody>
                      {wo.accessories.map((a, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-2 font-bold">{a.name || a.registry_name || a.accessory_code}</td>
                          <td className="py-2 text-center font-mono">{a.quantity}</td>
                          <td className="py-2 text-center font-mono">{fmt(a.unit_price)}</td>
                          <td className="py-2 text-center font-mono font-bold text-[#c9a84c]">{fmt((a.quantity||0)*(a.unit_price||0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'expenses' && (
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2"><DollarSign size={16} className="text-red-500" /> المصاريف الإضافية</h3>
              {/* Add form */}
              <div className="flex items-end gap-2 bg-gray-50 rounded-lg p-3">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-0.5">الوصف</label>
                  <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="وصف المصروف..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
                </div>
                <div className="w-28">
                  <label className="block text-[10px] text-gray-400 mb-0.5">المبلغ (ج)</label>
                  <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
                </div>
                <button onClick={handleAddExpense} className="px-3 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm"><Plus size={16} /></button>
              </div>
              {/* List */}
              {(wo.extra_expenses || []).length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">لا توجد مصاريف إضافية</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-gray-400"><th className="text-right pb-2">الوصف</th><th className="text-center pb-2">المبلغ</th><th className="text-center pb-2">التاريخ</th><th className="pb-2"></th></tr></thead>
                  <tbody>
                    {wo.extra_expenses.map(e => (
                      <tr key={e.id} className="border-t border-gray-100">
                        <td className="py-2">{e.description}</td>
                        <td className="py-2 text-center font-mono font-bold text-red-500">{fmt(e.amount)} ج</td>
                        <td className="py-2 text-center text-xs text-gray-400">{new Date(e.recorded_at).toLocaleDateString('ar-EG')}</td>
                        <td className="py-2 text-center"><button onClick={() => handleDeleteExpense(e.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="text-left font-mono font-bold text-sm text-red-500">الإجمالي: {fmt(wo.extra_expenses_total)} ج</div>
            </div>
          )}

          {tab === 'cost' && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">ملخص التكلفة الكامل</h3>
              <CostPanel cost={cs} readOnly masnaiya={cs.masnaiya} masrouf={cs.masrouf} marginPct={wo.margin_pct} />
            </div>
          )}

          {tab === 'invoices' && (
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2"><FileText size={16} className="text-indigo-500" /> الفواتير الجزئية</h3>
              {/* Add form */}
              <div className="flex items-end gap-2 bg-gray-50 rounded-lg p-3">
                <div className="w-28">
                  <label className="block text-[10px] text-gray-400 mb-0.5">عدد القطع</label>
                  <input type="number" value={invPieces} onChange={e => setInvPieces(e.target.value)} placeholder="0" min="1"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
                </div>
                <div className="w-28">
                  <label className="block text-[10px] text-gray-400 mb-0.5">سعر القطعة (ج)</label>
                  <input type="number" value={invPrice} onChange={e => setInvPrice(e.target.value)} placeholder={fmt(cs.suggested_consumer_price)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
                </div>
                <button onClick={handlePartialInvoice} className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm"><Plus size={16} /></button>
              </div>
              <div className="text-xs text-gray-400">
                مكتمل: {piecesCompleted} / مفوتر: {alreadyInvoiced} / متاح للفوترة: {Math.max(0, piecesCompleted - alreadyInvoiced)}
              </div>
              {(wo.partial_invoices || []).length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">لا توجد فواتير جزئية</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-gray-400"><th className="text-center pb-2">#</th><th className="text-center pb-2">القطع</th><th className="text-center pb-2">تكلفة/قطعة</th><th className="text-center pb-2">سعر الفاتورة/قطعة</th><th className="text-center pb-2">الإجمالي</th><th className="text-center pb-2">التاريخ</th></tr></thead>
                  <tbody>
                    {wo.partial_invoices.map((inv, i) => (
                      <tr key={inv.id} className="border-t border-gray-100">
                        <td className="py-2 text-center font-mono">{i + 1}</td>
                        <td className="py-2 text-center font-mono font-bold">{inv.pieces_invoiced}</td>
                        <td className="py-2 text-center font-mono">{fmt(inv.cost_per_piece)}</td>
                        <td className="py-2 text-center font-mono text-[#c9a84c]">{fmt(inv.invoice_price_per_piece)}</td>
                        <td className="py-2 text-center font-mono font-bold">{fmt(inv.pieces_invoiced * inv.invoice_price_per_piece)}</td>
                        <td className="py-2 text-center text-xs text-gray-400">{new Date(inv.created_at).toLocaleDateString('ar-EG')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto space-y-4">
          {/* Progress */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4e] rounded-2xl p-5 text-white">
            <h4 className="text-xs text-gray-300 mb-3">التقدم</h4>
            <div className="text-center mb-3"><span className="text-4xl font-bold font-mono text-[#c9a84c]">{progressPct}%</span></div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-[#c9a84c] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-gray-400 text-center">{progressPct}% مكتمل</p>
            <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">مكتمل نهائياً</span>
                <span className="font-mono font-bold text-green-400">{piecesCompleted} / {totalPieces}</span>
              </div>
              {piecesInProgress > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">في مراحل التصنيع</span>
                  <span className="font-mono text-blue-400">{piecesInProgress}</span>
                </div>
              )}
              {piecesRejected > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">مرفوض/هالك</span>
                  <span className="font-mono text-red-400">{piecesRejected}</span>
                </div>
              )}
              {piecesNotStarted > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">لم يبدأ بعد</span>
                  <span className="font-mono text-gray-500">{piecesNotStarted}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick cost summary */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h4 className="text-xs text-gray-400 mb-3">ملخص التكلفة</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">قماش أساسي</span><span className="font-mono">{fmt(cs.main_fabric_cost)} ج</span></div>
              <div className="flex justify-between"><span className="text-gray-400">بطانة</span><span className="font-mono">{fmt(cs.lining_cost)} ج</span></div>
              <div className="flex justify-between"><span className="text-gray-400">اكسسوارات</span><span className="font-mono">{fmt(cs.accessories_cost)} ج</span></div>
              <div className="flex justify-between"><span className="text-gray-400">مصنعية</span><span className="font-mono">{fmt(cs.masnaiya_total)} ج</span></div>
              <div className="flex justify-between"><span className="text-gray-400">مصروف</span><span className="font-mono">{fmt(cs.masrouf_total)} ج</span></div>
              {cs.waste_cost > 0 && <div className="flex justify-between text-orange-500"><span>هدر</span><span className="font-mono">{fmt(cs.waste_cost)} ج</span></div>}
              {cs.extra_expenses > 0 && <div className="flex justify-between text-red-500"><span>مصاريف إضافية</span><span className="font-mono">{fmt(cs.extra_expenses)} ج</span></div>}
              <hr />
              <div className="flex justify-between font-bold"><span>الإجمالي</span><span className="font-mono text-[#c9a84c]">{fmt(cs.total_cost)} ج</span></div>
              <div className="flex justify-between"><span className="text-gray-400">تكلفة القطعة</span><span className="font-mono font-bold">{fmt(cs.cost_per_piece)} ج</span></div>
              {cs.suggested_consumer_price > 0 && <div className="flex justify-between"><span className="text-gray-400">سعر مقترح</span><span className="font-mono text-gray-500">{fmt(cs.suggested_consumer_price)} ج</span></div>}
              {wo.consumer_price > 0 && <div className="flex justify-between"><span className="text-gray-400">سعر المستهلك</span><span className="font-mono">{fmt(wo.consumer_price)} ج</span></div>}
            </div>
          </div>

          {/* V8: Create Invoice from WO */}
          {piecesCompleted > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h4 className="text-xs text-gray-400 flex items-center gap-1.5"><FileText size={14} className="text-indigo-500" /> فاتورة جزئية</h4>
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span className="text-gray-400">القطع المكتملة</span><span className="font-mono font-bold">{piecesCompleted}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">القطع المُفوترة</span><span className="font-mono">{wo.total_invoiced_qty || 0}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">متاح للفوترة</span><span className="font-mono font-bold text-green-600">{Math.max(0, piecesCompleted - (wo.total_invoiced_qty || 0))}</span></div>
              </div>
              {piecesCompleted > (wo.total_invoiced_qty || 0) && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <input type="number" placeholder="عدد القطع" value={invoiceForm.qty}
                    onChange={e => setInvoiceForm(f => ({ ...f, qty: e.target.value }))}
                    max={piecesCompleted - (wo.total_invoiced_qty || 0)} min="1"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono text-center" />
                  <input type="number" placeholder="سعر القطعة (ج)" value={invoiceForm.price}
                    onChange={e => setInvoiceForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono text-center" />
                  <input type="text" placeholder="العميل" value={invoiceForm.customer_name}
                    onChange={e => setInvoiceForm(f => ({ ...f, customer_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                  <button onClick={handleCreateInvoice}
                    className="w-full px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold">إصدار الفاتورة</button>
                </div>
              )}
              {/* List existing WO invoices */}
              {(wo.wo_invoices || []).length > 0 && (
                <div className="pt-2 border-t border-gray-100 space-y-1">
                  {wo.wo_invoices.map(inv => (
                    <div key={inv.id} className="flex justify-between text-xs">
                      <span className="font-mono text-[#c9a84c]">{inv.invoice_number}</span>
                      <span className="font-mono">{inv.qty_invoiced} قطعة × {fmt(inv.unit_price)} ج</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Model info */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h4 className="text-xs text-gray-400 mb-3">الموديل</h4>
            <p className="font-mono font-bold text-[#c9a84c]">{wo.model_code}</p>
            <p className="text-sm text-[#1a1a2e] font-bold">{wo.model_name || '—'}</p>
            {wo.template_name && <p className="text-xs text-gray-400 mt-1">القالب: {wo.template_name}</p>}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h4 className="text-xs text-gray-400 mb-3">الجدول الزمني</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">الإنشاء</span><span className="font-mono text-xs">{new Date(wo.created_at).toLocaleDateString('ar-EG')}</span></div>
              {wo.start_date && <div className="flex justify-between"><span className="text-gray-400">البدء</span><span className="font-mono text-xs">{new Date(wo.start_date).toLocaleDateString('ar-EG')}</span></div>}
              {wo.due_date && <div className="flex justify-between"><span className="text-gray-400">التسليم</span><span className="font-mono text-xs">{new Date(wo.due_date).toLocaleDateString('ar-EG')}</span></div>}
              {wo.completed_date && <div className="flex justify-between"><span className="text-green-600">الانتهاء</span><span className="font-mono text-xs">{new Date(wo.completed_date).toLocaleDateString('ar-EG')}</span></div>}
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmClass={confirmModal.confirmClass}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-[#1a1a2e] mb-2">إلغاء أمر التشغيل</h3>
            <p className="text-sm text-gray-500 mb-3">سيتم إرجاع المواد المخصصة. هذا الإجراء لا يمكن التراجع عنه.</p>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">سبب الإلغاء *</label>
              <textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="اكتب سبب الإلغاء..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-red-400 outline-none resize-none" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600">تراجع</button>
              <button onClick={handleCancel}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold">تأكيد الإلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
