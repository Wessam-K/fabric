import { useState, useEffect } from 'react';
import { X, Ruler, DollarSign, Percent, Palette, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import FabricSearchDropdown from './FabricSearchDropdown';
import api from '../utils/api';

export default function FabricBlock({ fabric, index, fabricsList, onChange, onRemove, canRemove, grandTotal, role }) {
  const isMain = role === 'main';
  const registryFabric = fabricsList.find(f => f.code === fabric.fabric_code);
  const registryPrice = registryFabric?.price_per_m || 0;

  // PO batch state
  const [poBatches, setPoBatches] = useState([]);
  const [batchesOpen, setBatchesOpen] = useState(false);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [priceOverride, setPriceOverride] = useState(false);

  // Selected price logic: manual override > po batch price > registry price
  const effectivePrice = priceOverride ? (parseFloat(fabric.custom_price) || 0)
    : (fabric.po_batch_price != null) ? parseFloat(fabric.po_batch_price)
    : registryPrice;

  const meters = parseFloat(fabric.meters_per_piece) || 0;
  const waste = isMain ? (parseFloat(fabric.waste_pct) || 0) : 0;
  const totalMeters = meters * grandTotal;
  const cost = isMain
    ? totalMeters * effectivePrice * (1 + waste / 100)
    : totalMeters * effectivePrice;

  const update = (field, val) => onChange(index, { ...fabric, [field]: val });

  // Fetch PO batches when fabric is selected
  useEffect(() => {
    if (!fabric.fabric_code) { setPoBatches([]); return; }
    let cancelled = false;
    setBatchesLoading(true);
    api.get(`/fabrics/${encodeURIComponent(fabric.fabric_code)}/po-batches`)
      .then(({ data }) => { if (!cancelled) setPoBatches(data.batches || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBatchesLoading(false); });
    return () => { cancelled = true; };
  }, [fabric.fabric_code]);

  const handleFabricSelect = (f) => {
    if (!f) {
      onChange(index, { ...fabric, fabric_code: '', price_per_m: 0, po_batch_id: null, po_batch_price: null, po_number: null, custom_price: null });
    } else {
      onChange(index, { ...fabric, fabric_code: f.code, price_per_m: f.price_per_m || 0, po_batch_id: null, po_batch_price: null, po_number: null, custom_price: null });
    }
    setPriceOverride(false);
  };

  const selectBatch = (batch) => {
    onChange(index, {
      ...fabric,
      po_batch_id: batch.item_id,
      po_batch_price: batch.price_per_meter,
      po_number: batch.po_number,
    });
    setPriceOverride(false);
  };

  const clearBatchSelection = () => {
    onChange(index, { ...fabric, po_batch_id: null, po_batch_price: null, po_number: null });
  };

  return (
    <div className={`rounded-xl relative transition-all ${isMain
      ? 'border-r-[4px] border-r-blue-500 border border-blue-200 bg-gradient-to-l from-blue-50/40 to-white shadow-sm'
      : 'border-r-[4px] border-r-green-500 border border-green-200 bg-gradient-to-l from-green-50/40 to-white shadow-sm'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isMain ? 'border-blue-100 bg-blue-50/50' : 'border-green-100 bg-green-50/50'} rounded-t-xl`}>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${isMain ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
            {isMain ? 'قماش أساسي' : 'بطانة'} #{index + 1}
          </span>
          {fabric.po_number && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/20">
              [{fabric.po_number}]
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {registryFabric && (
            <>
              <div className="w-6 h-6 rounded overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                {registryFabric.image_path ? (
                  <img src={registryFabric.image_path} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                )}
              </div>
              <span className="text-xs font-bold text-[#1a1a2e]">{registryFabric.name}</span>
              <span className="font-mono text-[11px] text-[#c9a84c] font-bold">{effectivePrice} ج/م</span>
            </>
          )}
          {canRemove && (
            <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition-colors"><X size={16} /></button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Fabric Selector */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1.5">اختيار القماش</label>
          <FabricSearchDropdown
            value={fabric.fabric_code || ''}
            onChange={handleFabricSelect}
            fabricsList={fabricsList}
            role={role}
          />
        </div>

        {/* PO Batch Picker */}
        {fabric.fabric_code && (
          <div>
            {batchesLoading ? (
              <p className="text-[10px] text-gray-400 animate-pulse">جاري تحميل دفعات الشراء...</p>
            ) : poBatches.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setBatchesOpen(!batchesOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-[11px] font-bold text-gray-600 transition-colors">
                  <span>{poBatches.length} دفعات بأسعار مختلفة — اضغط للاختيار</span>
                  {batchesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {batchesOpen && (
                  <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {poBatches.map(b => {
                      const isSelected = fabric.po_batch_id === b.item_id;
                      const remaining = (b.received_meters || 0);
                      return (
                        <div key={b.item_id}
                          onClick={() => isSelected ? clearBatchSelection() : selectBatch(b)}
                          className={`px-3 py-2 cursor-pointer transition-colors text-[11px] flex items-center gap-3 ${isSelected ? 'bg-[#c9a84c]/10 border-r-2 border-r-[#c9a84c]' : 'hover:bg-gray-50'}`}>
                          <span className="font-mono font-bold text-[#1a1a2e]">{b.po_number}</span>
                          <span className="text-gray-400">{b.supplier_name || '—'}</span>
                          <span className="font-mono font-bold text-[#c9a84c]">{b.price_per_meter} ج/م</span>
                          <span className={`font-mono text-[10px] ${remaining > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            متبقي: {remaining}م
                          </span>
                          {isSelected && <span className="text-green-500 mr-auto">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                لا توجد دفعات شراء — يستخدم سعر السجل: {registryPrice} ج/م
              </p>
            )}
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
              <Ruler size={12} /> مشراج بالمتر
            </label>
            <input type="number" min="0" step="0.01" value={fabric.meters_per_piece || ''} placeholder="0.00"
              onChange={e => update('meters_per_piece', e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-mono focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all" />
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
              <DollarSign size={12} /> سعر المتر
              <button onClick={() => setPriceOverride(!priceOverride)} className="mr-1 text-gray-400 hover:text-[#c9a84c]" title="تجاوز السعر يدوياً">
                <Edit3 size={10} />
              </button>
            </label>
            {priceOverride ? (
              <input type="number" min="0" step="0.01" value={fabric.custom_price ?? effectivePrice}
                onChange={e => update('custom_price', e.target.value)}
                className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-sm text-center font-mono text-[#c9a84c] font-bold focus:border-[#c9a84c] outline-none bg-amber-50/50" />
            ) : (
              <input type="number" min="0" step="0.01" value={effectivePrice || ''} readOnly
                className="w-full border-2 border-gray-100 rounded-lg px-3 py-2 text-sm text-center bg-gray-50 font-mono text-[#c9a84c] font-bold" />
            )}
          </div>
          {isMain && (
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
                <Percent size={12} /> هدر %
              </label>
              <input type="number" min="0" max="50" step="0.5" value={fabric.waste_pct ?? 5}
                onChange={e => update('waste_pct', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-mono focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all" />
            </div>
          )}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
              <Palette size={12} /> اللون
            </label>
            <input type="text" value={fabric.color_note || ''} placeholder="مثال: أسود"
              onChange={e => update('color_note', e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all" />
          </div>
        </div>

        {/* Live cost formula */}
        {(meters > 0 && effectivePrice > 0) && (
          <div className={`rounded-lg px-4 py-2.5 flex items-center justify-between ${isMain ? 'bg-blue-50 border border-blue-100' : 'bg-green-50 border border-green-100'}`}>
            <span className="text-[11px] text-gray-500 font-mono">
              {meters.toFixed(2)}م × {grandTotal} قطعة × {effectivePrice}ج{isMain ? ` × ${(1 + waste / 100).toFixed(2)}` : ''}
            </span>
            <span className={`font-mono font-bold text-sm ${isMain ? 'text-blue-700' : 'text-green-700'}`}>
              = {(Math.round(cost * 100) / 100).toLocaleString('ar-EG')} ج
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
