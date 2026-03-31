// 1.1: Replaced xlsx (2 HIGH CVEs) with exceljs — safe, actively maintained
import ExcelJS from 'exceljs';

export async function exportToExcel(data, columns, filename, sheetName = 'بيانات') {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: true }] });

  // Set columns with headers and widths
  ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 15 }));
  // Bold header row
  ws.getRow(1).font = { bold: true };

  // Add data rows
  for (const row of data) {
    ws.addRow(columns.reduce((obj, c) => { obj[c.key] = row[c.key] ?? ''; return obj; }, {}));
  }

  const today = new Date().toISOString().slice(0, 10);
  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${today}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPayrollToExcel(records, periodName) {
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

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(periodName || 'كشف الرواتب', { views: [{ rightToLeft: true }] });

  ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).font = { bold: true };

  // Add data rows
  for (const r of records) {
    ws.addRow(columns.reduce((obj, c) => { obj[c.key] = r[c.key] ?? 0; return obj; }, {}));
  }

  // Add totals row
  const totalsRow = ws.addRow(
    columns.reduce((obj, c, i) => {
      if (i === 0) obj[c.key] = '';
      else if (i === 1) obj[c.key] = 'الإجمالي';
      else if (i === 2) obj[c.key] = '';
      else obj[c.key] = records.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
      return obj;
    }, {})
  );
  totalsRow.font = { bold: true };

  const today = new Date().toISOString().slice(0, 10);
  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `كشف-رواتب-${periodName || today}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
