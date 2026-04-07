import { useState, useEffect } from 'react';
import { Search, Download } from 'lucide-react';
import { PageHeader } from '../components/ui';
import TableFilters from '../components/ui/TableFilters';
import HelpButton from '../components/HelpButton';
import api from '../utils/api';
import { exportToExcel } from '../utils/exportExcel';
import { fmtDateTime } from '../utils/formatters';

const ACTION_COLORS = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-gray-100 text-gray-700',
  LOGOUT: 'bg-gray-100 text-gray-500',
  EXPORT: 'bg-purple-100 text-purple-700',
};
const ACTION_LABELS = { CREATE: 'إنشاء', UPDATE: 'تعديل', DELETE: 'حذف', LOGIN: 'دخول', LOGOUT: 'خروج', EXPORT: 'تصدير' };

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', entity_type: '', search: '', date_from: '', date_to: '' });
  const [expanded, setExpanded] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => { load(); }, [page, filters]);

  function load() {
    const params = { page, limit: 50, ...filters };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    api.get('/audit-log', { params }).then(r => {
      setLogs(r.data.logs);
      setTotal(r.data.total);
    }).catch(() => {});
  }

  function handleExport() {
    exportToExcel(logs, [
      { key: 'created_at', header: 'التاريخ', width: 20 },
      { key: 'username', header: 'المستخدم', width: 15 },
      { key: 'action', header: 'الإجراء', width: 10 },
      { key: 'entity_type', header: 'النوع', width: 12 },
      { key: 'entity_label', header: 'التفاصيل', width: 25 },
    ], 'سجل-المراجعة');
  }

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="page">
      <PageHeader title="سجل المراجعة" subtitle="تتبع جميع العمليات والتغييرات في النظام"
        action={<div className="flex gap-2"><HelpButton pageKey="auditlog" /><button onClick={handleExport} className="btn btn-outline"><Download size={16} /> تصدير Excel</button></div>} />

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search size={16} className="absolute right-3 top-3 text-gray-400" />
          <input value={filters.search} onChange={e => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} placeholder="بحث..."
            className="w-full pr-10 pl-4 py-2.5 border rounded-xl text-sm" />
        </div>
        <TableFilters
          filters={[
            { key: 'action', label: 'الإجراء', type: 'select', options: Object.entries(ACTION_LABELS).map(([k, v]) => ({ value: k, label: v })) },
            { key: 'entity_type', label: 'النوع', type: 'select', options: ['user', 'work_order', 'invoice', 'model', 'fabric', 'accessory', 'supplier', 'po', 'employee', 'attendance_import', 'payroll_period', 'hr_adjustment', 'expenses', 'maintenance_orders', 'machines'].map(t => ({ value: t, label: t })) },
            { key: 'date_from', label: 'من تاريخ', type: 'date' },
            { key: 'date_to', label: 'إلى تاريخ', type: 'date' },
          ]}
          values={{ action: filters.action, entity_type: filters.entity_type, date_from: filters.date_from, date_to: filters.date_to }}
          onChange={(key, val) => { setFilters(f => ({ ...f, [key]: val })); setPage(1); }}
          onClear={() => { setFilters(f => ({ ...f, action: '', entity_type: '', date_from: '', date_to: '' })); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-[#c9a84c]/10 border-b border-[#c9a84c]/20">
            <span className="text-sm text-[#c9a84c] font-bold">{selectedIds.length} محدد</span>
            <button onClick={() => setSelectedIds([])} className="text-xs text-gray-500 hover:text-red-500">إلغاء التحديد</button>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" ref={el => { if (el) el.indeterminate = selectedIds.length > 0 && selectedIds.length < logs.length; }} checked={logs.length > 0 && logs.every(l => selectedIds.includes(l.id))} onChange={e => setSelectedIds(e.target.checked ? logs.map(l => l.id) : [])}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">التاريخ</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">المستخدم</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الإجراء</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">النوع</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">التفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map(log => (
              <tr key={log.id} className={`hover:bg-gray-50 cursor-pointer ${selectedIds.includes(log.id) ? 'bg-[#c9a84c]/5' : ''}`} onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.includes(log.id)} onChange={() => setSelectedIds(prev => prev.includes(log.id) ? prev.filter(x => x !== log.id) : [...prev, log.id])}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(log.created_at)}</td>
                <td className="px-4 py-3">{log.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${ACTION_COLORS[log.action] || 'bg-gray-100'}`}>
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{log.entity_type}</td>
                <td className="px-4 py-3 text-gray-700">{log.entity_label || log.entity_id || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">لا توجد سجلات</td></tr>
            )}
          </tbody>
        </table>

        {/* Expanded diff view */}
        {expanded && (() => {
          const log = logs.find(l => l.id === expanded);
          if (!log || (!log.old_values && !log.new_values)) return null;
          let oldV, newV;
          try { oldV = log.old_values ? JSON.parse(log.old_values) : {}; } catch { oldV = {}; }
          try { newV = log.new_values ? JSON.parse(log.new_values) : {}; } catch { newV = {}; }
          const keys = [...new Set([...Object.keys(oldV), ...Object.keys(newV)])].filter(k => !k.includes('password'));
          return (
            <div className="p-4 bg-gray-50 border-t">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-bold text-red-600 mb-2">القيم القديمة</p>
                  {keys.map(k => <p key={k} className="py-0.5"><span className="text-gray-500">{k}:</span> {String(oldV[k] ?? '—')}</p>)}
                </div>
                <div>
                  <p className="font-bold text-green-600 mb-2">القيم الجديدة</p>
                  {keys.map(k => (
                    <p key={k} className={`py-0.5 ${oldV[k] !== newV[k] ? 'bg-green-100 px-1 rounded' : ''}`}>
                      <span className="text-gray-500">{k}:</span> {String(newV[k] ?? '—')}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50">السابق</button>
          <span className="text-sm text-gray-600">صفحة {page} من {totalPages} ({total} سجل)</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50">التالي</button>
        </div>
      )}
    </div>
  );
}
