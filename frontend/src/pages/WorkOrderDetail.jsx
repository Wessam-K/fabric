import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Play, Trash2, Edit2, Scissors, Package, DollarSign, Layers, FileText, Receipt, Plus, CheckCircle, AlertTriangle, History } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import StageChecklist from '../components/StageChecklist';
import CostPanel from '../components/CostPanel';

const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');
const TABS = [
  { key: 'stages', label: 'المراحل / WIP', icon: Layers },
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

  // Expense form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  // Partial invoice form
  const [invPieces, setInvPieces] = useState('');
  const [invPrice, setInvPrice] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get(`/work-orders/${id}`);
      setWo(data);
    } catch { toast.error('فشل تحميل أمر العمل'); navigate('/work-orders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleStageAction = async (stageId, status) => {
    try {
      const { data } = await api.patch(`/work-orders/${id}/stages/${stageId}`, { status });
      setWo(data); toast.success('تم تحديث المرحلة');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleStageAdvance = async (advanceData) => {
    try {
      const { data } = await api.patch(`/work-orders/${id}/stage-advance`, advanceData);
      setWo(data); toast.success(`تم تمرير ${advanceData.qty_to_pass} قطعة`);
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
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

  const handleStageQty = async (stageId, field, value) => {
    try {
      const { data } = await api.patch(`/work-orders/${id}/stage-quantity`, { stage_id: stageId, [field]: parseInt(value) || 0 });
      setWo(data);
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من إلغاء أمر العمل؟')) return;
    try { await api.delete(`/work-orders/${id}`); toast.success('تم الإلغاء'); navigate('/work-orders'); }
    catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
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

  const handleFinalize = async () => {
    if (!confirm('هل أنت متأكد من إنهاء الإنتاج وتسجيل التكلفة النهائية؟')) return;
    try { const { data } = await api.post(`/work-orders/${id}/finalize`, {}); setWo(data); toast.success('تم إنهاء الإنتاج بنجاح'); }
    catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
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
          <button onClick={() => navigate(`/work-orders/${id}/edit`)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"><Edit2 size={14} /> تعديل</button>
          <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  editable={wo.status === 'in_progress'}
                  totalQty={wo.quantity || 0}
                  onAdvance={handleStageAdvance}
                  onStart={handleStageStart}
                  onSkip={handleStageSkip}
                />
              </div>
              {/* Quantity Integrity */}
              {wo.quantity_integrity && !wo.quantity_integrity.balanced && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle size={14} />
                  <span>تحذير: الكميات غير متوازنة — إجمالي الأمر: {wo.quantity_integrity.total_ordered}، في المراحل: {wo.quantity_integrity.total_in_stages}، مكتمل: {wo.quantity_integrity.total_completed}، مرفوض: {wo.quantity_integrity.total_rejected}</span>
                </div>
              )}
              {/* Movement Log */}
              {wo.movement_log?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2"><History size={16} className="text-indigo-500" /> سجل التحركات</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {wo.movement_log.map(log => (
                      <div key={log.id} className="flex items-start gap-3 text-xs bg-gray-50 rounded-lg p-2">
                        <div className="flex-1">
                          <span className="font-bold">{log.from_stage_name}</span>
                          <span className="text-gray-400 mx-1">←</span>
                          <span className="font-bold text-blue-600">{log.to_stage_name || 'نهاية'}</span>
                          <span className="font-mono text-green-600 mx-2">+{log.qty_moved}</span>
                          {log.qty_rejected > 0 && <span className="font-mono text-red-500">-{log.qty_rejected}</span>}
                          {log.rejection_reason && <span className="text-gray-400 mr-1">({log.rejection_reason})</span>}
                        </div>
                        <div className="text-[10px] text-gray-400 text-left whitespace-nowrap">
                          <div>{log.moved_by_name}</div>
                          <div>{new Date(log.moved_at).toLocaleString('ar-EG')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
        <div className="space-y-4">
          {/* Progress */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4e] rounded-2xl p-5 text-white">
            <h4 className="text-xs text-gray-300 mb-3">التقدم</h4>
            <div className="text-center mb-3"><span className="text-4xl font-bold font-mono text-[#c9a84c]">{progressPct}%</span></div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-[#c9a84c] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-gray-400 text-center">{piecesCompleted} من {totalPieces} قطعة مكتملة ({completedStages}/{totalStages} مراحل)</p>
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex justify-between text-sm"><span className="text-gray-400">القطع المكتملة</span><span className="font-mono font-bold">{piecesCompleted} / {totalPieces}</span></div>
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
    </div>
  );
}
