import { useState, useEffect, useMemo } from 'react';
import { Download, Table2 } from 'lucide-react';
import api from '../../utils/api';
import { exportToExcel } from '../../utils/exportExcel';

const PIVOT_SOURCES = {
  production: { label: 'الإنتاج', fields: ['wo_number', 'model_code', 'model_name', 'category', 'gender', 'status', 'total_pieces', 'total_cost', 'cost_per_piece', 'main_fabric_cost', 'lining_cost', 'accessories_cost', 'masnaiya', 'masrouf'] },
  financial: { label: 'المالية', fields: ['po_number', 'supplier_name', 'supplier_type', 'status', 'total_amount', 'paid_amount', 'balance', 'order_date', 'item_count'] },
  hr: { label: 'الموارد البشرية', fields: ['emp_code', 'full_name', 'department', 'job_title', 'salary_type', 'base_salary', 'employment_type', 'status', 'present_days', 'absent_days', 'total_overtime', 'last_net_salary'] },
  inventory: { label: 'المخزون', fields: ['code', 'name', 'fabric_type', 'color', 'supplier', 'price_per_m', 'available_meters', 'min_stock', 'stock_status', 'stock_value'] },
};
const NUMERIC_FIELDS = ['total_pieces', 'total_cost', 'cost_per_piece', 'main_fabric_cost', 'lining_cost', 'accessories_cost', 'masnaiya', 'masrouf', 'total_amount', 'paid_amount', 'balance', 'item_count', 'base_salary', 'present_days', 'absent_days', 'total_overtime', 'last_net_salary', 'price_per_m', 'available_meters', 'min_stock', 'stock_value'];
const AGG_FNS = { sum: 'مجموع', avg: 'متوسط', count: 'عدد', min: 'أقل', max: 'أعلى' };

export default function PivotTable() {
  const [source, setSource] = useState('production');
  const [rawData, setRawData] = useState([]);
  const [rowField, setRowField] = useState('');
  const [colField, setColField] = useState('');
  const [valueField, setValueField] = useState('');
  const [aggFn, setAggFn] = useState('sum');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/reports/pivot', { params: { source } })
      .then(r => {
        setRawData(r.data);
        const fields = PIVOT_SOURCES[source]?.fields || [];
        const textFields = fields.filter(f => !NUMERIC_FIELDS.includes(f));
        const numFields = fields.filter(f => NUMERIC_FIELDS.includes(f));
        setRowField(textFields[0] || '');
        setColField(textFields[1] || '');
        setValueField(numFields[0] || '');
      })
      .catch(() => setRawData([]))
      .finally(() => setLoading(false));
  }, [source]);

  const fields = PIVOT_SOURCES[source]?.fields || [];
  const textFields = fields.filter(f => !NUMERIC_FIELDS.includes(f));
  const numFields = fields.filter(f => NUMERIC_FIELDS.includes(f));

  const pivot = useMemo(() => {
    if (!rowField || !valueField || rawData.length === 0) return null;
    const rowVals = [...new Set(rawData.map(r => String(r[rowField] ?? '—')))];
    const colVals = colField ? [...new Set(rawData.map(r => String(r[colField] ?? '—')))] : ['الكل'];
    const grid = {};
    rowVals.forEach(rv => { grid[rv] = {}; colVals.forEach(cv => { grid[rv][cv] = []; }); });

    rawData.forEach(r => {
      const rv = String(r[rowField] ?? '—');
      const cv = colField ? String(r[colField] ?? '—') : 'الكل';
      const val = Number(r[valueField]) || 0;
      grid[rv][cv].push(val);
    });

    const agg = (arr) => {
      if (arr.length === 0) return 0;
      if (aggFn === 'sum') return arr.reduce((a, b) => a + b, 0);
      if (aggFn === 'avg') return arr.reduce((a, b) => a + b, 0) / arr.length;
      if (aggFn === 'count') return arr.length;
      if (aggFn === 'min') return Math.min(...arr);
      if (aggFn === 'max') return Math.max(...arr);
      return 0;
    };

    const result = rowVals.map(rv => {
      const row = { _label: rv };
      let rowTotal = [];
      colVals.forEach(cv => {
        row[cv] = Math.round(agg(grid[rv][cv]) * 100) / 100;
        rowTotal = rowTotal.concat(grid[rv][cv]);
      });
      row._total = Math.round(agg(rowTotal) * 100) / 100;
      return row;
    });

    const colTotals = { _label: 'الإجمالي' };
    let allVals = [];
    colVals.forEach(cv => {
      const allInCol = rawData.filter(r => !colField || String(r[colField] ?? '—') === cv).map(r => Number(r[valueField]) || 0);
      colTotals[cv] = Math.round(agg(allInCol) * 100) / 100;
      allVals = allVals.concat(allInCol);
    });
    colTotals._total = Math.round(agg(allVals) * 100) / 100;

    const maxVal = Math.max(...result.map(r => colVals.map(cv => r[cv])).flat().filter(v => v > 0), 1);

    return { rowVals, colVals, result, colTotals, maxVal };
  }, [rawData, rowField, colField, valueField, aggFn]);

  function handleExport() {
    if (!pivot) return;
    const exportData = pivot.result.map(r => {
      const obj = { [rowField]: r._label };
      pivot.colVals.forEach(cv => { obj[cv] = r[cv]; });
      obj['الإجمالي'] = r._total;
      return obj;
    });
    const columns = [
      { key: rowField, header: rowField, width: 20 },
      ...pivot.colVals.map(cv => ({ key: cv, header: cv, width: 15 })),
      { key: 'الإجمالي', header: 'الإجمالي', width: 15 },
    ];
    exportToExcel(exportData, columns, `pivot-${source}`);
  }

  const heatColor = (val, maxVal) => {
    if (!val || val <= 0) return '';
    const pct = Math.min(val / maxVal, 1);
    const r = Math.round(201 + (249 - 201) * (1 - pct));
    const g = Math.round(168 + (115 - 168) * pct);
    const b = Math.round(76 + (22 - 76) * pct);
    return `rgba(${r},${g},${b},${0.1 + pct * 0.3})`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Table2 className="text-[#c9a84c]" size={20} />
          <h3 className="text-sm font-bold text-[#1a1a2e]">جدول محوري ديناميكي</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">مصدر البيانات</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              {Object.entries(PIVOT_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">الصفوف (Group By)</label>
            <select value={rowField} onChange={e => setRowField(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              {textFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">الأعمدة (اختياري)</label>
            <select value={colField} onChange={e => setColField(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              <option value="">— بدون —</option>
              {textFields.filter(f => f !== rowField).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">القيمة</label>
            <select value={valueField} onChange={e => setValueField(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              {numFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">الدالة</label>
            <select value={aggFn} onChange={e => setAggFn(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              {Object.entries(AGG_FNS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>}
      {!loading && pivot && (
        <>
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">{pivot.result.length} صف × {pivot.colVals.length} عمود | {rawData.length} سجل</p>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
              <Download size={14} /> تصدير Excel
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-right font-medium text-gray-600 sticky right-0 bg-gray-50">{rowField}</th>
                  {pivot.colVals.map(cv => <th key={cv} className="px-3 py-3 text-center font-medium text-gray-600 min-w-[80px]">{cv}</th>)}
                  <th className="px-3 py-3 text-center font-bold text-[#1a1a2e] bg-amber-50 min-w-[80px]">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {pivot.result.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2 font-medium sticky right-0 bg-white border-l whitespace-nowrap">{row._label}</td>
                    {pivot.colVals.map(cv => (
                      <td key={cv} className="px-3 py-2 text-center font-mono"
                        style={{ backgroundColor: heatColor(row[cv], pivot.maxVal) }}>
                        {Number(row[cv]).toLocaleString()}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-mono font-bold bg-amber-50">{Number(row._total).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                  <td className="px-3 py-2 sticky right-0 bg-gray-50">الإجمالي</td>
                  {pivot.colVals.map(cv => (
                    <td key={cv} className="px-3 py-2 text-center font-mono">{Number(pivot.colTotals[cv]).toLocaleString()}</td>
                  ))}
                  <td className="px-3 py-2 text-center font-mono text-[#c9a84c] bg-amber-50">{Number(pivot.colTotals._total).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      {!loading && !pivot && rawData.length > 0 && (
        <div className="text-center py-8 text-gray-400">اختر الصفوف والقيمة لعرض الجدول المحوري</div>
      )}
      {!loading && rawData.length === 0 && (
        <div className="text-center py-8 text-gray-400">لا توجد بيانات</div>
      )}
    </div>
  );
}
