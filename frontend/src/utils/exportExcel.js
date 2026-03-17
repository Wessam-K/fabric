import * as XLSX from 'xlsx';

export function exportToExcel(data, columns, filename, sheetName = 'بيانات') {
  const headers = columns.map(c => c.header);
  const rows = data.map(row => columns.map(c => row[c.key] ?? ''));

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}-${today}.xlsx`);
}

export function exportPayrollToExcel(records, periodName) {
  const columns = [
    { key: 'emp_code', header: 'الكود', width: 10 },
    { key: 'full_name', header: 'الاسم', width: 25 },
    { key: 'department', header: 'القسم', width: 15 },
    { key: 'days_worked', header: 'أيام العمل', width: 12 },
    { key: 'overtime_hours', header: 'ساعات إضافية', width: 12 },
    { key: 'base_pay', header: 'الراتب الأساسي', width: 15 },
    { key: 'overtime_pay', header: 'أجر إضافي', width: 12 },
    { key: 'housing_allowance', header: 'بدل سكن', width: 12 },
    { key: 'transport_allowance', header: 'بدل مواصلات', width: 12 },
    { key: 'food_allowance', header: 'بدل طعام', width: 12 },
    { key: 'bonuses', header: 'مكافآت', width: 12 },
    { key: 'gross_pay', header: 'إجمالي الاستحقاق', width: 15 },
    { key: 'absence_deduction', header: 'خصم غياب', width: 12 },
    { key: 'social_insurance', header: 'تأمينات', width: 12 },
    { key: 'tax_deduction', header: 'ضريبة', width: 12 },
    { key: 'total_deductions', header: 'إجمالي الخصومات', width: 15 },
    { key: 'net_pay', header: 'صافي الراتب', width: 15 },
  ];

  const headers = columns.map(c => c.header);
  const rows = records.map(r => columns.map(c => r[c.key] ?? 0));

  // Add totals row
  const totals = columns.map((c, i) => {
    if (i < 3) return i === 0 ? '' : i === 1 ? 'الإجمالي' : '';
    return records.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totals]);
  ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, periodName || 'كشف الرواتب');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `كشف-رواتب-${periodName || today}.xlsx`);
}
