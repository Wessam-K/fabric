import { useState, useEffect, useRef } from 'react';
import { Clock, Upload, Plus, Download, Search } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import api from '../../utils/api';
import { exportToExcel } from '../../utils/exportExcel';
import HelpButton from '../../components/HelpButton';

const STATUS_COLORS = {
  present: 'bg-green-200 text-green-800',
  absent: 'bg-red-200 text-red-800',
  late: 'bg-yellow-200 text-yellow-800',
  half_day: 'bg-orange-200 text-orange-800',
  holiday: 'bg-gray-200 text-gray-600',
  leave: 'bg-blue-200 text-blue-800',
};

export default function Attendance() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState([]);
  const [view, setView] = useState('grid'); // grid | import
  const [importStep, setImportStep] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { loadSummary(); }, [month]);

  function loadSummary() {
    api.get(`/hr/attendance/summary/${month}`).then(r => setSummary(r.data)).catch(() => {});
    api.get('/hr/attendance', { params: { month } }).then(r => setAttendance(r.data)).catch(() => {});
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImportStep(1);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('period_month', month);

    try {
      const res = await api.post('/hr/attendance/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(res.data);
      setImportStep(2);
      loadSummary();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'حدث خطأ أثناء الاستيراد' });
      setImportStep(2);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleExport() {
    exportToExcel(summary, [
      { key: 'emp_code', header: 'الكود', width: 10 },
      { key: 'full_name', header: 'الاسم', width: 25 },
      { key: 'department', header: 'القسم', width: 15 },
      { key: 'days_worked', header: 'أيام العمل', width: 12 },
      { key: 'total_hours', header: 'إجمالي الساعات', width: 12 },
      { key: 'overtime_hours', header: 'ساعات إضافية', width: 12 },
      { key: 'absent_days', header: 'أيام الغياب', width: 12 },
    ], `حضور-${month}`);
  }

  // Build grid data — employees as rows, days as columns
  const daysInMonth = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]), 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Group attendance by employee
  const attByEmp = {};
  attendance.forEach(a => {
    if (!attByEmp[a.employee_id]) attByEmp[a.employee_id] = {};
    const day = parseInt(a.work_date.split('-')[2]);
    attByEmp[a.employee_id][day] = a;
  });

  return (
    <div className="page">
      <PageHeader title="الحضور والانصراف" subtitle="إدارة سجلات الحضور"
        action={<div className="flex gap-2">
          <HelpButton pageKey="attendance" />
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="form-input" />
          <button onClick={handleExport} className="btn btn-outline"><Download size={16} /> تصدير</button>
          <label className="btn btn-gold cursor-pointer">
            <Upload size={16} /> استيراد من Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          </label>
        </div>} />

      {/* Import Result */}
      {importStep === 2 && importResult && (
        <div className={`rounded-2xl p-4 ${importResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          {importResult.error ? (
            <p className="text-red-600">{importResult.error}</p>
          ) : (
            <div>
              <p className="text-green-700 font-medium">تم استيراد {importResult.imported} سجل حضور بنجاح</p>
              {importResult.errors?.length > 0 && (
                <div className="mt-2">
                  <p className="text-orange-600 text-sm">لم يتم التعرف على {importResult.errors.length} سجل:</p>
                  <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
                    {importResult.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>صف {e.row}: {e.value} — {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <button onClick={() => setImportStep(0)} className="mt-2 text-xs text-gray-500 hover:text-gray-700">إغلاق</button>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-2xl font-bold text-blue-600">{summary.length}</p>
          <p className="text-sm text-gray-600">عدد الموظفين</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4">
          <p className="text-2xl font-bold text-green-600">{summary.reduce((s, e) => s + (e.days_worked || 0), 0)}</p>
          <p className="text-sm text-gray-600">إجمالي أيام العمل</p>
        </div>
        <div className="bg-orange-50 rounded-2xl p-4">
          <p className="text-2xl font-bold text-orange-600">{Math.round(summary.reduce((s, e) => s + (e.overtime_hours || 0), 0) * 10) / 10}</p>
          <p className="text-sm text-gray-600">ساعات إضافية</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4">
          <p className="text-2xl font-bold text-red-600">{summary.reduce((s, e) => s + (e.absent_days || 0), 0)}</p>
          <p className="text-sm text-gray-600">أيام الغياب</p>
        </div>
      </div>

      {/* Attendance Grid */}
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="text-xs min-w-max">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-right sticky right-0 bg-gray-50 font-medium text-gray-600 min-w-[150px]">الموظف</th>
              {days.map(d => (
                <th key={d} className="px-2 py-2 text-center font-medium text-gray-600 min-w-[36px]">{d}</th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-gray-600 min-w-[60px]">أيام</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 min-w-[60px]">ساعات</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 min-w-[60px]">إضافي</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 min-w-[60px]">غياب</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {summary.map(emp => (
              <tr key={emp.employee_id} className="hover:bg-gray-50">
                <td className="px-3 py-2 sticky right-0 bg-white font-medium whitespace-nowrap border-l">
                  <span className="text-gray-500 ml-1">{emp.emp_code}</span> {emp.full_name}
                </td>
                {days.map(d => {
                  const rec = attByEmp[emp.employee_id]?.[d];
                  return (
                    <td key={d} className="px-1 py-1 text-center">
                      {rec ? (
                        <span className={`inline-block w-7 h-6 leading-6 rounded text-[10px] ${STATUS_COLORS[rec.attendance_status] || 'bg-gray-100'}`}>
                          {rec.actual_hours || 0}
                        </span>
                      ) : (
                        <span className="inline-block w-7 h-6 leading-6 rounded bg-gray-50 text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-medium">{emp.days_worked || 0}</td>
                <td className="px-3 py-2 text-center">{Math.round((emp.total_hours || 0) * 10) / 10}</td>
                <td className="px-3 py-2 text-center text-orange-600">{Math.round((emp.overtime_hours || 0) * 10) / 10}</td>
                <td className="px-3 py-2 text-center text-red-600">{emp.absent_days || 0}</td>
              </tr>
            ))}
            {summary.length === 0 && (
              <tr><td colSpan={days.length + 5} className="px-4 py-8 text-center text-gray-400">لا توجد بيانات حضور — قم باستيراد ملف Excel</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
