import { Plus, X } from 'lucide-react';

export default function AccessoryTable({ accessories, accessoriesList, onChange }) {
  const addRow = () => {
    onChange([...accessories, { accessory_code: '', accessory_name: '', quantity: 1, unit_price: 0, notes: '' }]);
  };

  const removeRow = (i) => onChange(accessories.filter((_, idx) => idx !== i));

  const updateRow = (i, field, val) => {
    const updated = accessories.map((row, idx) => {
      if (idx !== i) return row;
      const newRow = { ...row, [field]: val };
      if (field === 'accessory_code') {
        const reg = accessoriesList.find(a => a.code === val);
        if (reg) {
          newRow.accessory_name = reg.name;
          newRow.unit_price = reg.unit_price;
        }
      }
      return newRow;
    });
    onChange(updated);
  };

  const totalAcc = accessories.reduce((s, a) => s + (parseFloat(a.quantity) || 0) * (parseFloat(a.unit_price) || 0), 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 text-right text-xs text-gray-500">اكسسوار</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 w-20">الكمية</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 w-24">سعر الوحدة</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 w-24">إجمالي</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {accessories.map((row, i) => {
              const subtotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0);
              return (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-1 py-1">
                    <div className="flex gap-1">
                      <select value={row.accessory_code || ''} onChange={e => updateRow(i, 'accessory_code', e.target.value)}
                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-white focus:border-[#c9a84c] outline-none">
                        <option value="">اختر أو اكتب...</option>
                        {accessoriesList.map(a => (
                          <option key={a.code} value={a.code}>[{a.code}] {a.name} — {a.unit_price}ج</option>
                        ))}
                      </select>
                      <input type="text" value={row.accessory_name || ''} placeholder="أو اسم حر"
                        onChange={e => updateRow(i, 'accessory_name', e.target.value)}
                        className="w-28 border border-gray-200 rounded px-2 py-1 text-sm focus:border-[#c9a84c] outline-none" />
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.5" value={row.quantity || ''}
                      onChange={e => updateRow(i, 'quantity', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center font-mono focus:border-[#c9a84c] outline-none" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.01" value={row.unit_price || ''}
                      onChange={e => updateRow(i, 'unit_price', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center font-mono focus:border-[#c9a84c] outline-none" />
                  </td>
                  <td className="px-1 py-1 text-center font-mono text-[#c9a84c] font-bold text-sm">
                    {(Math.round(subtotal * 100) / 100).toLocaleString('ar-EG')}
                  </td>
                  <td className="px-1 py-1">
                    <button onClick={() => removeRow(i)} className="text-red-300 hover:text-red-500 p-0.5"><X size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {accessories.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td colSpan={3} className="px-2 py-2 text-xs text-gray-500 text-left">إجمالي الاكسسوارات</td>
                <td className="px-2 py-2 text-center font-mono text-[#c9a84c]">{(Math.round(totalAcc * 100) / 100).toLocaleString('ar-EG')}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <button onClick={addRow}
        className="mt-2 flex items-center gap-1 text-xs text-[#c9a84c] hover:text-[#a88a3a] transition-colors">
        <Plus size={14} /> إضافة اكسسوار
      </button>
    </div>
  );
}
