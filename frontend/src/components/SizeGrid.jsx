import { Plus, X, Palette } from 'lucide-react';

const SIZES = ['qty_s', 'qty_m', 'qty_l', 'qty_xl', 'qty_2xl', 'qty_3xl'];
const SIZE_LABELS = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const ROW_COLORS = ['bg-blue-50/50', 'bg-rose-50/50', 'bg-green-50/50', 'bg-purple-50/50', 'bg-amber-50/50', 'bg-cyan-50/50'];

export default function SizeGrid({ sizes, onChange }) {
  const addRow = () => {
    onChange([...sizes, { color_label: '', qty_s: 0, qty_m: 0, qty_l: 0, qty_xl: 0, qty_2xl: 0, qty_3xl: 0 }]);
  };

  const removeRow = (i) => {
    if (sizes.length <= 1) return;
    onChange(sizes.filter((_, idx) => idx !== i));
  };

  const updateCell = (rowIdx, field, val) => {
    const updated = sizes.map((row, i) => i === rowIdx ? { ...row, [field]: val } : row);
    onChange(updated);
  };

  const rowTotal = (row) => SIZES.reduce((s, k) => s + (parseInt(row[k]) || 0), 0);
  const grandTotal = sizes.reduce((s, row) => s + rowTotal(row), 0);
  const colTotals = SIZES.map(k => sizes.reduce((s, row) => s + (parseInt(row[k]) || 0), 0));

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#1a1a2e]">
              <th className="px-2 py-3 w-8"></th>
              <th className="px-3 py-3 text-right text-xs text-gray-300 font-bold min-w-[120px]">
                <div className="flex items-center gap-1.5"><Palette size={12} /> اللون</div>
              </th>
              {SIZE_LABELS.map((s, i) => (
                <th key={i} className="px-2 py-3 text-center text-xs text-white w-[70px] font-mono font-bold">{s}</th>
              ))}
              <th className="px-3 py-3 text-center text-xs text-[#c9a84c] w-20 font-mono font-bold">إجمالي</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((row, ri) => {
              const rt = rowTotal(row);
              return (
                <tr key={ri} className={`border-t border-gray-100 ${ROW_COLORS[ri % ROW_COLORS.length]} hover:bg-gray-100/50 transition-colors`}>
                  <td className="px-1 py-2 text-center">
                    {sizes.length > 1 ? (
                      <button onClick={() => removeRow(ri)} className="text-red-300 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"><X size={14} /></button>
                    ) : (
                      <span className="text-gray-300 text-xs">{ri + 1}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={row.color_label || ''} placeholder="اللون..."
                      onChange={e => updateCell(ri, 'color_label', e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all bg-white" />
                  </td>
                  {SIZES.map((k, ci) => (
                    <td key={ci} className="px-1 py-2">
                      <input type="number" min="0" value={row[k] || 0}
                        onChange={e => updateCell(ri, k, parseInt(e.target.value) || 0)}
                        className="w-full border-2 border-gray-200 rounded-lg px-1 py-2 text-sm text-center font-mono font-bold focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all bg-white" />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-block font-mono font-bold text-sm px-3 py-1.5 rounded-lg ${rt > 0 ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {rt}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#1a1a2e] bg-gray-50">
              <td></td>
              <td className="px-3 py-3 text-xs font-bold text-gray-500">إجمالي القص</td>
              {colTotals.map((t, i) => (
                <td key={i} className="px-2 py-3 text-center font-mono text-sm font-bold text-[#1a1a2e]">{t}</td>
              ))}
              <td className="px-2 py-3 text-center">
                <span className="bg-[#c9a84c] text-white px-4 py-1.5 rounded-lg text-sm font-mono font-bold shadow-sm">{grandTotal}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addRow}
        className="mt-3 flex items-center gap-1.5 text-xs text-[#c9a84c] hover:text-[#a88a3a] bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg transition-colors">
        <Plus size={14} /> لون جديد
      </button>
    </div>
  );
}
