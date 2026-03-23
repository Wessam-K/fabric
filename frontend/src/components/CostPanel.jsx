export default function CostPanel({ cost, masnaiya, masrouf, marginPct, consumerPrice, wholesalePrice, onChangeMasnaiya, onChangeMasrouf, onChangeMargin, onChangeConsumer, onChangeWholesale, readOnly, summary }) {
  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const suggestedPrice = cost.suggested_consumer_price || 0;

  return (
    <div className="space-y-4">
      {/* Quick Summary Strip */}
      {summary && (
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4e] rounded-xl p-4 text-white space-y-2">
          <h4 className="text-[10px] text-gray-400 font-bold mb-2">ملخص سريع</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <span className="text-gray-400">القطع</span>
            <span className="font-mono font-bold text-left">{summary.grandTotal}</span>
            <span className="text-gray-400">الأقمشة</span>
            <span className="font-mono font-bold text-left">{summary.fabricCount}</span>
            <span className="text-gray-400">الاكسسوارات</span>
            <span className="font-mono font-bold text-left">{summary.accessoryCount}</span>
            <span className="text-gray-400">الألوان</span>
            <span className="font-mono font-bold text-left">{summary.colorCount}</span>
          </div>
          <hr className="border-white/10" />
          <div className="flex justify-between items-center">
            <span className="text-gray-300 text-xs">تكلفة القطعة</span>
            <span className="font-mono font-bold text-[#c9a84c] text-lg">{fmt(cost.cost_per_piece)} ج</span>
          </div>
        </div>
      )}
      {/* Editable fields */}
      {!readOnly && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">المصنعية (ج)</label>
            <input type="number" min="0" step="1" value={masnaiya ?? ''} onChange={e => onChangeMasnaiya(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">المصروف (ج)</label>
            <input type="number" min="0" step="1" value={masrouf ?? ''} onChange={e => onChangeMasrouf(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">هامش ربح %</label>
            <input type="number" min="0" step="1" value={marginPct ?? ''} onChange={e => onChangeMargin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
          </div>
        </div>
      )}

      {/* Breakdown */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">تكلفة القماش الأساسي:</span><span className="font-mono">{fmt(cost.main_fabric_cost)} ج</span></div>
        <div className="flex justify-between"><span className="text-gray-500">تكلفة البطانة:</span><span className="font-mono">{fmt(cost.lining_cost)} ج</span></div>
        <div className="flex justify-between"><span className="text-gray-500">تكلفة الاكسسوارات:</span><span className="font-mono">{fmt(cost.accessories_cost)} ج</span></div>
        <div className="flex justify-between"><span className="text-gray-500">المصنعية:</span><span className="font-mono">{fmt(cost.masnaiya_total ?? cost.masnaiya)} ج</span></div>
        <div className="flex justify-between"><span className="text-gray-500">المصروف:</span><span className="font-mono">{fmt(cost.masrouf_total ?? cost.masrouf)} ج</span></div>

        {/* Waste section */}
        {(cost.waste_cost > 0 || cost.waste_cost_per_piece > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1">
            <div className="flex justify-between text-amber-700"><span className="text-amber-600 text-xs font-bold">تكلفة الهدر:</span><span className="font-mono">{fmt(cost.waste_cost)} ج</span></div>
            {cost.waste_cost_per_piece > 0 && (
              <div className="flex justify-between text-amber-600 text-xs"><span>هدر / قطعة:</span><span className="font-mono">{fmt(cost.waste_cost_per_piece)} ج</span></div>
            )}
          </div>
        )}

        {/* Extra expenses section */}
        {(cost.extra_expenses > 0 || cost.extra_cost_per_piece > 0) && (
          <div className="flex justify-between"><span className="text-gray-500">مصاريف إضافية:</span><span className="font-mono">{fmt(cost.extra_expenses)} ج</span></div>
        )}

        <hr className="border-gray-300" />
        <div className="flex justify-between text-base font-bold">
          <span className="text-[#1a1a2e]">إجمالي التكلفة:</span>
          <span className="font-mono text-[#1a1a2e]">{fmt(cost.total_cost)} ج</span>
        </div>
        {(cost.grand_total_pieces > 0 || cost.total_pieces > 0) && (
          <div className="flex justify-between text-base">
            <span className="text-gray-600">تكلفة القطعة الواحدة:</span>
            <span className="font-mono font-bold text-[#c9a84c]">{fmt(cost.cost_per_piece)} ج</span>
          </div>
        )}
        {cost.suggested_consumer_price > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">سعر مقترح (هامش {cost.margin_pct || marginPct}%):</span>
            <span className="font-mono text-gray-500">{fmt(cost.suggested_consumer_price)} ج</span>
          </div>
        )}
      </div>

      {/* Pricing */}
      {!readOnly && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">سعر المستهلك (ج)</label>
            <input type="number" min="0" step="1" value={consumerPrice ?? ''} placeholder={suggestedPrice > 0 ? Math.ceil(suggestedPrice) : ''}
              onChange={e => onChangeConsumer(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
            {suggestedPrice > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">سعر مقترح: {fmt(suggestedPrice)} ج بهامش {cost.margin_pct || marginPct}%</p>
            )}
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">سعر الجملة (ج)</label>
            <input type="number" min="0" step="1" value={wholesalePrice ?? ''}
              onChange={e => onChangeWholesale(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-center focus:border-[#c9a84c] outline-none" />
          </div>
        </div>
      )}
    </div>
  );
}
