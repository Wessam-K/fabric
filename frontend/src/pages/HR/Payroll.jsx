import { useState, useEffect } from 'react';
import { Calculator, CheckCircle2, CreditCard, Download, Eye } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { exportPayrollToExcel } from '../../utils/exportExcel';
import HelpButton from '../../components/HelpButton';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { fmtDateTime } from '../../utils/formatters';
import Tooltip from '../../components/Tooltip';

const PERIOD_STATUS = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  calculated: { label: 'محسوبة', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'معتمدة', color: 'bg-green-100 text-green-700' },
  paid: { label: 'مدفوعة', color: 'bg-purple-100 text-purple-700' },
};

export default function Payroll() {
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const toast = useToast();
  const { can } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [records, setRecords] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ period_month: new Date().toISOString().slice(0, 7), period_name: '' });
  const [calculating, setCalculating] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => { loadPeriods(); }, []);

  function loadPeriods() {
    api.get('/hr/payroll').then(r => setPeriods(r.data)).catch(e => console.error('Payroll load failed:', e.message));
  }

  function loadRecords(periodId) {
    api.get(`/hr/payroll/${periodId}`).then(r => {
      setRecords(r.data.records);
      setSelectedPeriod(r.data.period);
    }).catch(e => console.error('Payroll records load failed:', e.message));
  }

  async function createPeriod() {
    if (!newPeriod.period_month) return;
    try {
      const res = await api.post('/hr/payroll/periods', {
        period_month: newPeriod.period_month,
        period_name: newPeriod.period_name || `رواتب ${newPeriod.period_month}`,
      });
      setShowCreate(false);
      setNewPeriod({ period_month: new Date().toISOString().slice(0, 7), period_name: '' });
      loadPeriods();
      loadRecords(res.data.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ');
    }
  }

  async function calculatePayroll(periodId) {
    setCalculating(true);
    try {
      await api.post(`/hr/payroll/${periodId}/calculate`);
      loadRecords(periodId);
      loadPeriods();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ في الحساب');
    } finally {
      setCalculating(false);
    }
  }

  async function approvePeriod(periodId) {
    try {
      await api.patch(`/hr/payroll/${periodId}/approve`);
      loadRecords(periodId);
      loadPeriods();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ');
    }
  }

  async function payPeriod(periodId) {
    const ok = await confirm({ title: 'صرف الرواتب', message: 'هل أنت متأكد من تسجيل صرف الرواتب؟', variant: 'warning' });
    if (!ok) return;
    try {
      await api.patch(`/hr/payroll/${periodId}/pay`);
      loadRecords(periodId);
      loadPeriods();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ');
    }
  }

  function handleExport() {
    if (records.length === 0) return;
    exportPayrollToExcel(records, selectedPeriod?.period_name || 'رواتب');
  }

  const totals = records.reduce((t, r) => ({
    base: t.base + (r.base_salary || 0),
    allowances: t.allowances + (r.total_allowances || 0),
    overtime: t.overtime + (r.overtime_amount || 0),
    gross: t.gross + (r.gross_salary || 0),
    deductions: t.deductions + (r.total_deductions || 0),
    adjustments: t.adjustments + (r.adjustments_total || 0),
    net: t.net + (r.net_salary || 0),
  }), { base: 0, allowances: 0, overtime: 0, gross: 0, deductions: 0, adjustments: 0, net: 0 });

  return (
    <div className="page">
      {ConfirmDialog}
      <PageHeader title="المرتبات" subtitle="إدارة فترات الرواتب"
        action={<div className="flex items-center gap-2"><HelpButton pageKey="payroll" /><button onClick={() => setShowCreate(true)} className="btn btn-gold"><Calculator size={16} /> فترة جديدة</button></div>} />

      {/* Create Period Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-[400px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">إنشاء فترة رواتب</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1">الشهر</label>
                <input type="month" value={newPeriod.period_month} onChange={e => setNewPeriod({ ...newPeriod, period_month: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">اسم الفترة (اختياري)</label>
                <input type="text" value={newPeriod.period_name} onChange={e => setNewPeriod({ ...newPeriod, period_name: e.target.value })}
                  placeholder={`رواتب ${newPeriod.period_month}`}
                  className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">إلغاء</button>
              <button onClick={createPeriod} className="px-4 py-2 bg-[#c9a84c] text-white rounded-xl text-sm hover:bg-[#b8993f]">إنشاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Periods List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {periods.map(p => (
          <div key={p.id} onClick={() => loadRecords(p.id)}
            className={`rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedPeriod?.id === p.id ? 'border-[#c9a84c] bg-amber-50' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-800">{p.period_name}</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${PERIOD_STATUS[p.status]?.color || 'bg-gray-100'}`}>
                {PERIOD_STATUS[p.status]?.label || p.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">{p.period_month}</p>
            {p.total_net_salary > 0 && (
              <p className="text-lg font-bold text-green-600 mt-1">{Number(p.total_net_salary).toLocaleString()} ج.م</p>
            )}
          </div>
        ))}
        {periods.length === 0 && (
          <div className="col-span-3 text-center py-8 text-gray-400">لا توجد فترات رواتب — أنشئ فترة جديدة</div>
        )}
      </div>

      {/* Selected Period Details */}
      {selectedPeriod && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{selectedPeriod.period_name}</h2>
            <div className="flex gap-2">
              {can('payroll', 'edit') && selectedPeriod.status === 'draft' && (
                <button onClick={() => calculatePayroll(selectedPeriod.id)} disabled={calculating}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
                  <Calculator size={14} /> {calculating ? 'جاري الحساب...' : 'حساب الرواتب'}
                </button>
              )}
              {can('payroll', 'edit') && selectedPeriod.status === 'calculated' && (
                <>
                  <button onClick={() => calculatePayroll(selectedPeriod.id)} disabled={calculating}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
                    <Calculator size={14} /> إعادة الحساب
                  </button>
                  <button onClick={() => approvePeriod(selectedPeriod.id)}
                    className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-xl text-sm hover:bg-green-600">
                    <CheckCircle2 size={14} /> اعتماد
                  </button>
                </>
              )}
              {can('payroll', 'edit') && selectedPeriod.status === 'approved' && (
                <button onClick={() => payPeriod(selectedPeriod.id)}
                  className="flex items-center gap-1 px-4 py-2 bg-purple-500 text-white rounded-xl text-sm hover:bg-purple-600">
                  <CreditCard size={14} /> تسجيل الصرف
                </button>
              )}
              {records.length > 0 && (
                <button onClick={handleExport}
                  className="flex items-center gap-1 px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">
                  <Download size={14} /> تصدير Excel
                </button>
              )}
            </div>
          </div>

          {/* Totals */}
          {records.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-2xl p-4">
                <p className="text-xl font-bold text-blue-600">{Number(totals.gross).toLocaleString()}</p>
                <p className="text-sm text-gray-600">إجمالي المستحقات</p>
              </div>
              <div className="bg-red-50 rounded-2xl p-4">
                <p className="text-xl font-bold text-red-600">{Number(totals.deductions).toLocaleString()}</p>
                <p className="text-sm text-gray-600">إجمالي الاستقطاعات</p>
              </div>
              <div className="bg-green-50 rounded-2xl p-4">
                <p className="text-2xl font-bold text-green-600">{Number(totals.net).toLocaleString()}</p>
                <p className="text-sm text-gray-600">صافي الرواتب</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xl font-bold text-gray-700">{records.length}</p>
                <p className="text-sm text-gray-600">عدد الموظفين</p>
              </div>
            </div>
          )}

          {/* Payroll Table */}
          <div className="bg-white rounded-2xl border overflow-x-auto">
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#c9a84c]/10 border-b border-[#c9a84c]/20">
                <span className="text-sm text-[#c9a84c] font-bold">{selectedIds.length} محدد</span>
                <button onClick={() => setSelectedIds([])} className="text-xs text-gray-500 hover:text-red-500">إلغاء التحديد</button>
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" ref={el => { if (el) el.indeterminate = selectedIds.length > 0 && selectedIds.length < records.length; }} checked={records.length > 0 && records.every(r => selectedIds.includes(r.id))} onChange={e => setSelectedIds(e.target.checked ? records.map(r => r.id) : [])}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
                  </th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">الكود</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">الاسم</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">الراتب الأساسي</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">أيام العمل</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">البدلات</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">الإضافي</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">إجمالي</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">الخصومات</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">التسويات</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600 bg-green-50">الصافي</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-600">كشف</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${selectedIds.includes(r.id) ? 'bg-[#c9a84c]/5' : ''}`}>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => setSelectedIds(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-[#c9a84c] focus:ring-[#c9a84c] cursor-pointer" />
                    </td>
                    <td className="px-3 py-2 text-gray-500">{r.emp_code}</td>
                    <td className="px-3 py-2 font-medium">{r.full_name}</td>
                    <td className="px-3 py-2">{Number(r.base_salary).toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">{r.days_worked}</td>
                    <td className="px-3 py-2 text-blue-600">{Number(r.total_allowances).toLocaleString()}</td>
                    <td className="px-3 py-2 text-orange-600">{Number(r.overtime_amount).toLocaleString()}</td>
                    <td className="px-3 py-2 font-medium">{Number(r.gross_salary).toLocaleString()}</td>
                    <td className="px-3 py-2 text-red-600">{Number(r.total_deductions).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(r.adjustments_total || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 font-bold text-green-600 bg-green-50">{Number(r.net_salary).toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">
                      <Tooltip text="عرض كشف الراتب"><button onClick={() => navigate(`/hr/payroll/${selectedPeriod.id}/slip/${r.employee_id}`)}
                        className="text-[#c9a84c] hover:text-[#b8993f]"><Eye size={16} /></button></Tooltip>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                    {selectedPeriod.status === 'draft' ? 'اضغط "حساب الرواتب" لحساب رواتب هذه الفترة' : 'لا توجد سجلات'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
