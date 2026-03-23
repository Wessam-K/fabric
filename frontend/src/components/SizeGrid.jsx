import { Plus, X, Palette, Grid3x3, Ruler, Hash } from 'lucide-react';

const ROW_COLORS = ['bg-blue-50/50', 'bg-rose-50/50', 'bg-green-50/50', 'bg-purple-50/50', 'bg-amber-50/50', 'bg-cyan-50/50'];

const MODE_TABS = [
  { key: 'standard', label: 'مقاسات قياسية', icon: Grid3x3 },
  { key: 'custom', label: 'مقاسات مخصصة', icon: Ruler },
  { key: 'free', label: 'مقاس واحد (فري سايز)', icon: Hash },
];

export default function SizeGrid({ sizes, onChange, sizeConfig, onSizeConfigChange, mode = 'standard', onModeChange }) {
  const currentConfig = sizeConfig || [
    { key: 'qty_s', label: 'S' },
    { key: 'qty_m', label: 'M' },
    { key: 'qty_l', label: 'L' },
    { key: 'qty_xl', label: 'XL' },
    { key: 'qty_2xl', label: '2XL' },
    { key: 'qty_3xl', label: '3XL' },
  ];

  const addRow = () => {
    const newRow = { color_label: '' };
    if (mode === 'free') {
      newRow.qty_free = 0;
    } else {
      currentConfig.forEach(sc => { newRow[sc.key] = 0; });
    }
    onChange([...sizes, newRow]);
  };

  const removeRow = (i) => {
    if (sizes.length <= 1) return;
    onChange(sizes.filter((_, idx) => idx !== i));
  };

  const updateCell = (rowIdx, field, val) => {
    const updated = sizes.map((row, i) => i === rowIdx ? { ...row, [field]: val } : row);
    onChange(updated);
  };

  const rowTotal = (row) => {
    if (mode === 'free') return parseInt(row.qty_free) || 0;
    return currentConfig.reduce((s, sc) => s + (parseInt(row[sc.key]) || 0), 0);
  };

  const grandTotal = sizes.reduce((s, row) => s + rowTotal(row), 0);

  const colTotals = mode === 'free'
    ? [sizes.reduce((s, row) => s + (parseInt(row.qty_free) || 0), 0)]
    : currentConfig.map(sc => sizes.reduce((s, row) => s + (parseInt(row[sc.key]) || 0), 0));

  // Custom mode: add/remove/rename columns
  const addSizeColumn = () => {
    const idx = currentConfig.length;
    const newKey = `qty_${idx}`;
    const newConfig = [...currentConfig, { key: newKey, label: 'جديد' }];
    if (onSizeConfigChange) onSizeConfigChange(newConfig);
    onChange(sizes.map(row => ({ ...row, [newKey]: 0 })));
  };

  const removeSizeColumn = (colIdx) => {
    if (currentConfig.length <= 1) return;
    const removedKey = currentConfig[colIdx].key;
    const newConfig = currentConfig.filter((_, i) => i !== colIdx);
    if (onSizeConfigChange) onSizeConfigChange(newConfig);
    onChange(sizes.map(row => {
      const { [removedKey]: _, ...rest } = row;
      return rest;
    }));
  };

  const renameSizeColumn = (colIdx, newLabel) => {
    const newConfig = currentConfig.map((sc, i) => i === colIdx ? { ...sc, label: newLabel } : sc);
    if (onSizeConfigChange) onSizeConfigChange(newConfig);
  };

  return (
    <div>
      {/* Grand Total Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-2 bg-[#c9a84c] text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm">
          إجمالي القطع: <span className="font-mono text-base">{grandTotal}</span>
        </span>
        <span className="text-[10px] text-gray-400">{sizes.filter(s=>s.color_label).length} ألوان</span>
      </div>

      {/* Mode Switcher */}
      {onModeChange && (
        <div className="flex items-center gap-1 mb-3 bg-gray-100 rounded-lg p-1">
          {MODE_TABS.map(t => (
            <button key={t.key}
              onClick={() => onModeChange(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${mode === t.key ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#1a1a2e]">
              <th className="px-2 py-3 w-8"></th>
              <th className="px-3 py-3 text-right text-xs text-gray-300 font-bold min-w-[120px]">
                <div className="flex items-center gap-1.5"><Palette size={12} /> اللون</div>
              </th>
              {mode === 'free' ? (
                <th className="px-2 py-3 text-center text-xs text-white w-[100px] font-mono font-bold">الكمية</th>
              ) : (
                currentConfig.map((sc, i) => (
                  <th key={sc.key} className="px-2 py-3 text-center text-xs text-white w-[70px] font-mono font-bold relative group">
                    {mode === 'custom' ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <input type="text" value={sc.label}
                          onChange={e => renameSizeColumn(i, e.target.value)}
                          className="w-12 bg-transparent text-white text-center text-xs font-mono font-bold border-b border-white/30 focus:border-[#c9a84c] outline-none" />
                        {currentConfig.length > 1 && (
                          <button onClick={() => removeSizeColumn(i)}
                            className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-400 transition-opacity">
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ) : (
                      sc.label
                    )}
                  </th>
                ))
              )}
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
                  {mode === 'free' ? (
                    <td className="px-1 py-2">
                      <input type="number" min="0" value={row.qty_free || 0}
                        onChange={e => updateCell(ri, 'qty_free', parseInt(e.target.value) || 0)}
                        className="w-full border-2 border-gray-200 rounded-lg px-1 py-2 text-sm text-center font-mono font-bold focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all bg-white" />
                    </td>
                  ) : (
                    currentConfig.map((sc) => (
                      <td key={sc.key} className="px-1 py-2">
                        <input type="number" min="0" value={row[sc.key] || 0}
                          onChange={e => updateCell(ri, sc.key, parseInt(e.target.value) || 0)}
                          className="w-full border-2 border-gray-200 rounded-lg px-1 py-2 text-sm text-center font-mono font-bold focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none transition-all bg-white" />
                      </td>
                    ))
                  )}
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

      <div className="mt-3 flex items-center gap-2">
        <button onClick={addRow}
          className="flex items-center gap-1.5 text-xs text-[#c9a84c] hover:text-[#a88a3a] bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg transition-colors">
          <Plus size={14} /> لون جديد
        </button>
        {mode === 'custom' && (
          <button onClick={addSizeColumn}
            className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors">
            <Plus size={14} /> مقاس
          </button>
        )}
      </div>
    </div>
  );
}
