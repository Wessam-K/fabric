import { useState } from 'react';
import { Circle, Clock, CheckCircle, SkipForward, ArrowLeft, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_ICON = {
  pending: <Circle size={16} className="text-gray-300" />,
  in_progress: <Clock size={16} className="text-blue-500 animate-pulse" />,
  completed: <CheckCircle size={16} className="text-green-500" />,
  skipped: <SkipForward size={16} className="text-gray-400" />,
};

const STATUS_BORDER = {
  completed: 'border-green-200 bg-green-50/50',
  in_progress: 'border-blue-200 bg-blue-50/50',
};

const STATUS_LABEL = {
  pending: 'معلق',
  in_progress: 'جاري',
  completed: 'مكتمل',
  skipped: 'تم تخطيه',
};

function StageAdvanceForm({ stage, onAdvance, onCancel }) {
  const [qtyPass, setQtyPass] = useState(stage.quantity_in_stage || 0);
  const [qtyReject, setQtyReject] = useState(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const available = stage.quantity_in_stage || 0;
  const total = (parseInt(qtyPass) || 0) + (parseInt(qtyReject) || 0);
  const isValid = total > 0 && total <= available && (parseInt(qtyPass) || 0) >= 0 && (parseInt(qtyReject) || 0) >= 0;

  return (
    <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
        <ArrowLeft size={14} /> تمرير من: {stage.stage_name}
        <span className="mr-auto font-mono text-blue-500">الكمية المتاحة للنقل: {available} قطعة</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">كمية ناجحة</label>
          <input type="number" min="0" max={available} value={qtyPass}
            onChange={e => setQtyPass(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">كمية مرفوضة</label>
          <input type="number" min="0" max={available} value={qtyReject}
            onChange={e => setQtyReject(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
        </div>
      </div>
      {parseInt(qtyReject) > 0 && (
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">سبب الرفض</label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الرفض..."
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-[#c9a84c] outline-none" />
        </div>
      )}
      <div>
        <label className="block text-[10px] text-gray-500 mb-0.5">ملاحظات (اختياري)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات..."
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-[#c9a84c] outline-none" />
      </div>
      {!isValid && total > available && (
        <div className="flex items-center gap-1 text-xs text-red-500">
          <AlertTriangle size={12} /> المجموع ({total}) يتجاوز المتاح ({available})
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => onAdvance({ from_stage_id: stage.id, qty_to_pass: parseInt(qtyPass) || 0, qty_rejected: parseInt(qtyReject) || 0, rejection_reason: reason, notes })}
          disabled={!isValid}
          className="flex-1 px-3 py-2 bg-[#c9a84c] hover:bg-[#b8973f] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold">
          تمرير {parseInt(qtyPass) || 0} قطعة
        </button>
        <button onClick={onCancel} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs">إلغاء</button>
      </div>
    </div>
  );
}

export default function StageChecklist({ stages = [], editable = false, totalQty = 0, onAdvance, onStart, onSkip }) {
  // Auto-open the first in_progress stage with items
  const firstActiveId = stages.find(
    s => s.status === 'in_progress' && (s.quantity_in_stage || 0) > 0
  )?.id || null;
  const [advancingId, setAdvancingId] = useState(firstActiveId);
  const [expandedId, setExpandedId] = useState(null);

  // Flow summary
  const totalIn = stages.reduce((s, st) => s + (st.quantity_in_stage || 0), 0);
  const totalCompleted = stages.reduce((s, st) => s + (st.quantity_completed || 0), 0);
  const totalRejected = stages.reduce((s, st) => s + (st.quantity_rejected || 0), 0);
  const lastStageCompleted = stages.length > 0 ? (stages[stages.length - 1].quantity_completed || 0) : 0;
  const piecePct = totalQty > 0 ? Math.round((lastStageCompleted / totalQty) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Flow Summary Bar */}
      <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2a2a4e] rounded-xl p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-300">تقدم الإنتاج (بالقطع)</span>
          <span className="font-mono font-bold text-[#c9a84c]">{piecePct}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-[#c9a84c] rounded-full transition-all duration-500" style={{ width: `${piecePct}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
          <div><span className="block font-mono text-lg font-bold">{totalQty}</span><span className="text-gray-400">إجمالي</span></div>
          <div><span className="block font-mono text-lg font-bold text-blue-400">{totalIn}</span><span className="text-gray-400">في المراحل</span></div>
          <div><span className="block font-mono text-lg font-bold text-green-400">{lastStageCompleted}</span><span className="text-gray-400">مكتمل نهائي</span></div>
          <div><span className="block font-mono text-lg font-bold text-red-400">{totalRejected}</span><span className="text-gray-400">مرفوض</span></div>
        </div>
      </div>

      {/* Stage Cards */}
      {stages.map((stage, idx) => {
        const isAdvancing = advancingId === stage.id;
        const isExpanded = expandedId === stage.id;
        const stageTotal = (stage.quantity_in_stage || 0) + (stage.quantity_completed || 0) + (stage.quantity_rejected || 0);
        const stagePct = stageTotal > 0 ? Math.round(((stage.quantity_completed || 0) / stageTotal) * 100) : 0;
        const canAdvance = editable && stage.status === 'in_progress' && (stage.quantity_in_stage || 0) > 0;
        const canStart = editable && stage.status === 'pending' && (stage.quantity_in_stage || 0) > 0;
        const isLast = idx === stages.length - 1;

        return (
          <div key={stage.id} className={`rounded-xl border transition-all ${STATUS_BORDER[stage.status] || 'border-gray-100 bg-gray-50/30'}`}>
            {/* Stage header */}
            <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : stage.id)}>
              {STATUS_ICON[stage.status]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {stage.stage_color && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.stage_color }} />}
                  <span className="text-sm font-bold text-[#1a1a2e]">{stage.stage_name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${stage.status === 'completed' ? 'bg-green-100 text-green-700' : stage.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : stage.status === 'skipped' ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[stage.status]}
                  </span>
                </div>
                {/* Quantity mini-bar */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${stagePct}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-gray-500">
                    {stage.quantity_in_stage || 0} في / {stage.quantity_completed || 0} مكتمل
                    {(stage.quantity_rejected || 0) > 0 && <span className="text-red-400"> / {stage.quantity_rejected} رفض</span>}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canStart && (
                  <button onClick={e => { e.stopPropagation(); onStart?.(stage.id); }}
                    className="text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600">بدء</button>
                )}
                {canAdvance && (
                  <button onClick={e => { e.stopPropagation(); setAdvancingId(isAdvancing ? null : stage.id); }}
                    className="text-xs px-3 py-1 bg-[#c9a84c] text-white rounded-lg hover:bg-[#b8973f]">
                    {isLast ? 'إتمام التسليم النهائي' : 'تمرير'}
                  </button>
                )}
                {editable && stage.status === 'pending' && (
                  <button onClick={e => { e.stopPropagation(); onSkip?.(stage.id); }}
                    className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600">تخطي</button>
                )}
                {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-0 text-[11px] text-gray-500 border-t border-gray-100 mt-0">
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {stage.started_at && <div>بدأ: <span className="font-mono">{new Date(stage.started_at).toLocaleString('ar-EG')}</span> {stage.started_by_name && <span className="text-blue-500">({stage.started_by_name})</span>}</div>}
                  {stage.completed_at && <div>أكمل: <span className="font-mono">{new Date(stage.completed_at).toLocaleString('ar-EG')}</span> {stage.completed_by_name && <span className="text-green-500">({stage.completed_by_name})</span>}</div>}
                  {stage.assigned_to && <div>المسؤول: {stage.assigned_to}</div>}
                  {stage.notes && <div className="col-span-2">ملاحظات: {stage.notes}</div>}
                </div>
              </div>
            )}

            {/* Advance form */}
            {isAdvancing && (
              <div className="px-3 pb-3">
                <StageAdvanceForm
                  stage={stage}
                  onAdvance={(data) => { onAdvance?.(data); setAdvancingId(null); }}
                  onCancel={() => setAdvancingId(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
