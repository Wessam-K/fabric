import { X, Ruler, DollarSign, Percent, Palette } from 'lucide-react';
import FabricSearchDropdown from './FabricSearchDropdown';

export default function FabricBlock({ fabric, index, fabricsList, onChange, onRemove, canRemove, grandTotal, role }) {
  const isMain = role === 'main';
  const registryFabric = fabricsList.find(f => f.code === fabric.fabric_code);
  const price = registryFabric?.price_per_m || 0;
  const meters = parseFloat(fabric.meters_per_piece) || 0;
  const waste = isMain ? (parseFloat(fabric.waste_pct) || 0) : 0;
  const totalMeters = meters * grandTotal;
  const cost = isMain
    ? totalMeters * price * (1 + waste / 100)
    : totalMeters * price;

  const update = (field, val) => onChange(index, { ...fabric, [field]: val });

  const handleFabricSelect = (f) => {
    if (!f) {
      onChange(index, { ...fabric, fabric_code: '', price_per_m: 0 });
    } else {
      onChange(index, { ...fabric, fabric_code: f.code, price_per_m: f.price_per_m || 0 });
    }
  };

  return (
    <div className={`rounded-xl relative transition-all ${isMain
      ? 'border-r-[4px] border-r-blue-500 border border-blue-200 bg-gradient-to-l from-blue-50/40 to-white shadow-sm'
      : 'border-r-[4px] border-r-green-500 border border-green-200 bg-gradient-to-l from-green-50/40 to-white shadow-sm'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isMain ? 'border-blue-100 bg-blue-50/50' : 'border-green-100 bg-green-50/50'} rounded-t-xl`}>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${isMain ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
          {isMain ? 'قماش أساسي' : 'بطانة'} #{index + 1}
        </span>
        {registryFabric && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
              {registryFabric.image_path ? (
                <img src={registryFabric.image_path} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
              )}
            </div>
            <span className="text-xs font-bold text-[#1a1a2e]">{registryFabric.name}</span>
            <span className="font-mono text-[11px] text-[#c9a84c] font-bold">{price} ج/م</span>
          </div>
        )}
        {canRemove && (
          <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition-colors"><X size={16} /></button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Fabric Selector — full width */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1.5">اختيار القماش</label>
          <FabricSearchDropdown
            value={fabric.fabric_code || ''}
            onChange={handleFabricSelect}
            fabricsList={fabricsList}
            role={role}
          />
        </div>

        {/* Details Grid — well-spaced inputs */}
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
            </label>
            <input type="number" min="0" step="0.01" value={price || ''} readOnly
              className="w-full border-2 border-gray-100 rounded-lg px-3 py-2 text-sm text-center bg-gray-50 font-mono text-[#c9a84c] font-bold" />
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
        {(meters > 0 && price > 0) && (
          <div className={`rounded-lg px-4 py-2.5 flex items-center justify-between ${isMain ? 'bg-blue-50 border border-blue-100' : 'bg-green-50 border border-green-100'}`}>
            <span className="text-[11px] text-gray-500 font-mono">
              {meters.toFixed(2)}م × {grandTotal} قطعة × {price}ج{isMain ? ` × ${(1 + waste / 100).toFixed(2)}` : ''}
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
