import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Printer } from 'lucide-react';
import api from '../../utils/api';

export default function PaySlip() {
  const { periodId, employeeId } = useParams();
  const navigate = useNavigate();
  const [slip, setSlip] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    api.get(`/hr/payroll/${periodId}/slip/${employeeId}`).then(r => setSlip(r.data)).catch(() => navigate('/hr/payroll'));
  }, [periodId, employeeId]);

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    const sanitized = content.cloneNode(true);
    // Strip any script tags or event handlers from cloned content
    sanitized.querySelectorAll('script').forEach(s => s.remove());
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>كشف راتب</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', sans-serif; }
        body { padding: 20px; direction: rtl; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: right; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 600; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 24px; color: #1a1a2e; }
        .header p { color: #666; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 15px 0; font-size: 13px; }
        .info-item { display: flex; gap: 8px; }
        .info-label { color: #666; min-width: 100px; }
        .info-value { font-weight: 600; }
        .net-box { background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; }
        .net-box .amount { font-size: 28px; font-weight: 700; color: #2e7d32; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; color: #999; }
        .signature { margin-top: 40px; display: flex; justify-content: space-around; }
        .signature div { text-align: center; }
        .signature .line { width: 150px; border-top: 1px solid #333; margin-top: 40px; }
      </style>
    </head><body>${sanitized.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  }

  if (!slip) return <div className="p-8 text-center text-gray-400">جاري التحميل...</div>;

  const record = slip.record;
  const employee = slip.employee;

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/hr/payroll')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowRight size={18} /> العودة للمرتبات
        </button>
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] text-white rounded-xl hover:bg-[#b8993f]">
          <Printer size={16} /> طباعة
        </button>
      </div>

      <div ref={printRef} className="bg-white rounded-2xl border p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="header text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a2e]">WK-Hub Factory</h1>
          <p className="text-gray-500 text-sm mt-1">كشف مرتب — {slip.period?.period_name}</p>
          <div className="w-24 h-0.5 bg-[#c9a84c] mx-auto mt-2"></div>
        </div>

        {/* Employee Info */}
        <div className="info-grid grid grid-cols-2 gap-3 text-sm mb-6 bg-gray-50 rounded-xl p-4">
          <div className="flex gap-2"><span className="text-gray-500 min-w-[80px]">الكود:</span><span className="font-semibold">{employee.emp_code}</span></div>
          <div className="flex gap-2"><span className="text-gray-500 min-w-[80px]">الاسم:</span><span className="font-semibold">{employee.full_name}</span></div>
          <div className="flex gap-2"><span className="text-gray-500 min-w-[80px]">القسم:</span><span className="font-semibold">{employee.department || '-'}</span></div>
          <div className="flex gap-2"><span className="text-gray-500 min-w-[80px]">الوظيفة:</span><span className="font-semibold">{employee.job_title || '-'}</span></div>
          <div className="flex gap-2"><span className="text-gray-500 min-w-[80px]">نوع الراتب:</span><span className="font-semibold">{employee.salary_type === 'monthly' ? 'شهري' : employee.salary_type === 'daily' ? 'يومي' : employee.salary_type === 'hourly' ? 'بالساعة' : 'بالقطعة'}</span></div>
          <div className="flex gap-2"><span className="text-gray-500 min-w-[80px]">أيام العمل:</span><span className="font-semibold">{record.days_worked}</span></div>
        </div>

        {/* Earnings & Deductions Side by Side */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Earnings */}
          <div>
            <h3 className="font-bold text-green-700 mb-2 text-sm">المستحقات</h3>
            <table className="w-full text-sm border">
              <tbody>
                <tr><td className="border px-3 py-2 bg-gray-50">الراتب الأساسي</td><td className="border px-3 py-2 text-left font-medium">{Number(record.base_salary).toLocaleString()}</td></tr>
                {record.housing_allowance > 0 && <tr><td className="border px-3 py-2 bg-gray-50">بدل سكن</td><td className="border px-3 py-2 text-left font-medium">{Number(record.housing_allowance).toLocaleString()}</td></tr>}
                {record.transport_allowance > 0 && <tr><td className="border px-3 py-2 bg-gray-50">بدل مواصلات</td><td className="border px-3 py-2 text-left font-medium">{Number(record.transport_allowance).toLocaleString()}</td></tr>}
                {record.food_allowance > 0 && <tr><td className="border px-3 py-2 bg-gray-50">بدل طعام</td><td className="border px-3 py-2 text-left font-medium">{Number(record.food_allowance).toLocaleString()}</td></tr>}
                {record.other_allowances > 0 && <tr><td className="border px-3 py-2 bg-gray-50">بدلات أخرى</td><td className="border px-3 py-2 text-left font-medium">{Number(record.other_allowances).toLocaleString()}</td></tr>}
                {record.overtime_amount > 0 && <tr><td className="border px-3 py-2 bg-gray-50">ساعات إضافية ({record.overtime_hours} ساعة)</td><td className="border px-3 py-2 text-left font-medium">{Number(record.overtime_amount).toLocaleString()}</td></tr>}
                <tr className="font-bold bg-green-50"><td className="border px-3 py-2">إجمالي المستحقات</td><td className="border px-3 py-2 text-left text-green-700">{Number(record.gross_salary).toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Deductions */}
          <div>
            <h3 className="font-bold text-red-700 mb-2 text-sm">الاستقطاعات</h3>
            <table className="w-full text-sm border">
              <tbody>
                {record.insurance_deduction > 0 && <tr><td className="border px-3 py-2 bg-gray-50">تأمينات</td><td className="border px-3 py-2 text-left font-medium">{Number(record.insurance_deduction).toLocaleString()}</td></tr>}
                {record.tax_deduction > 0 && <tr><td className="border px-3 py-2 bg-gray-50">ضرائب</td><td className="border px-3 py-2 text-left font-medium">{Number(record.tax_deduction).toLocaleString()}</td></tr>}
                {record.absence_deduction > 0 && <tr><td className="border px-3 py-2 bg-gray-50">خصم غياب</td><td className="border px-3 py-2 text-left font-medium">{Number(record.absence_deduction).toLocaleString()}</td></tr>}
                {record.other_deductions > 0 && <tr><td className="border px-3 py-2 bg-gray-50">خصومات أخرى</td><td className="border px-3 py-2 text-left font-medium">{Number(record.other_deductions).toLocaleString()}</td></tr>}
                {(record.adjustments_total || 0) !== 0 && <tr><td className="border px-3 py-2 bg-gray-50">تسويات</td><td className="border px-3 py-2 text-left font-medium">{Number(record.adjustments_total).toLocaleString()}</td></tr>}
                <tr className="font-bold bg-red-50"><td className="border px-3 py-2">إجمالي الاستقطاعات</td><td className="border px-3 py-2 text-left text-red-700">{Number(record.total_deductions).toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Net Salary */}
        <div className="net-box bg-green-50 border-2 border-green-400 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-600">صافي الراتب المستحق</p>
          <p className="amount text-3xl font-bold text-green-700 mt-1">{Number(record.net_salary).toLocaleString()} ج.م</p>
        </div>

        {/* Signatures */}
        <div className="signature flex justify-around mt-10 text-sm text-gray-600">
          <div className="text-center">
            <p>المحاسب</p>
            <div className="line w-36 border-t border-gray-400 mt-10 mx-auto"></div>
          </div>
          <div className="text-center">
            <p>المدير</p>
            <div className="line w-36 border-t border-gray-400 mt-10 mx-auto"></div>
          </div>
          <div className="text-center">
            <p>الموظف</p>
            <div className="line w-36 border-t border-gray-400 mt-10 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
