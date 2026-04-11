// Enterprise Excel & CSV export utilities — ExcelJS RTL Arabic
import ExcelJS from 'exceljs';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFc9a84c' }, size: 11 };
const HEADER_ALIGNMENT = { horizontal: 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
const ALT_ROW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
const MIN_COL_WIDTH = 12;
const COL_PADDING = 4;

function autoWidth(data, columns) {
  return columns.map(c => {
    const headerLen = (c.header || '').length;
    const maxDataLen = data.reduce((mx, row) => {
      const val = row[c.key];
      const len = val != null ? String(val).length : 0;
      return Math.max(mx, len);
    }, 0);
    return Math.max(MIN_COL_WIDTH, headerLen + COL_PADDING, maxDataLen + COL_PADDING);
  });
}

function isNumericColumn(key) {
  const numericKeys = /price|cost|total|amount|salary|pay|balance|rate|qty|quantity|meters|weight|value|discount|tax|deduction|allowance|bonus|net|gross|profit|revenue|remaining|paid|owed|hours|days/i;
  return numericKeys.test(key);
}

function isDateColumn(key) {
  return /date|created_at|updated_at|due|start|end|period/i.test(key);
}

function downloadBlob(buf, filename) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function styleWorksheet(ws, columns, dataRowCount) {
  // Header row styling
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF444444' } } };
  });
  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
  // Auto-filter
  if (ws.columnCount > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  }
  // Data row styling
  for (let i = 2; i <= dataRowCount + 1; i++) {
    const row = ws.getRow(i);
    if (i % 2 === 0) {
      row.eachCell((cell) => { cell.fill = ALT_ROW_FILL; });
    }
    row.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      if (col) {
        if (isNumericColumn(col.key)) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right', readingOrder: 'rightToLeft' };
        } else if (isDateColumn(col.key)) {
          cell.numFmt = 'yyyy-mm-dd';
          cell.alignment = { horizontal: 'right', readingOrder: 'rightToLeft' };
        } else {
          cell.alignment = { horizontal: 'right', readingOrder: 'rightToLeft' };
        }
      }
    });
  }
}

export async function exportToExcel(data, columns, filename, sheetName = 'بيانات') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WK-Factory ERP';
  workbook.created = new Date();
  workbook.views = [{ rightToLeft: true }];

  const widths = autoWidth(data, columns);
  const ws = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: true }] });
  ws.properties.tabColor = { argb: 'FF1a1a2e' };

  ws.columns = columns.map((c, i) => ({ header: c.header, key: c.key, width: widths[i] }));

  for (const row of data) {
    ws.addRow(columns.reduce((obj, c) => { obj[c.key] = row[c.key] ?? ''; return obj; }, {}));
  }

  styleWorksheet(ws, columns, data.length);

  const today = new Date().toISOString().slice(0, 10);
  const buf = await workbook.xlsx.writeBuffer();
  downloadBlob(buf, `${filename}-${today}.xlsx`);
}

export async function exportMultiSheet(sheets, filename) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WK-Factory ERP';
  workbook.created = new Date();
  workbook.views = [{ rightToLeft: true }];

  for (const { name, data, columns } of sheets) {
    const widths = autoWidth(data, columns);
    const ws = workbook.addWorksheet(name, { views: [{ rightToLeft: true }] });
    ws.properties.tabColor = { argb: 'FF1a1a2e' };
    ws.columns = columns.map((c, i) => ({ header: c.header, key: c.key, width: widths[i] }));
    for (const row of data) {
      ws.addRow(columns.reduce((obj, c) => { obj[c.key] = row[c.key] ?? ''; return obj; }, {}));
    }
    styleWorksheet(ws, columns, data.length);
  }

  const today = new Date().toISOString().slice(0, 10);
  const buf = await workbook.xlsx.writeBuffer();
  downloadBlob(buf, `${filename}-${today}.xlsx`);
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
  workbook.creator = 'WK-Factory ERP';
  workbook.views = [{ rightToLeft: true }];
  const ws = workbook.addWorksheet(periodName || 'كشف الرواتب', { views: [{ rightToLeft: true }] });
  ws.properties.tabColor = { argb: 'FF1a1a2e' };
  ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

  for (const r of records) {
    ws.addRow(columns.reduce((obj, c) => { obj[c.key] = r[c.key] ?? 0; return obj; }, {}));
  }

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

  styleWorksheet(ws, columns, records.length);

  const today = new Date().toISOString().slice(0, 10);
  const buf = await workbook.xlsx.writeBuffer();
  downloadBlob(buf, `كشف-رواتب-${periodName || today}.xlsx`);
}

// CSV export with UTF-8 BOM and formula injection protection
export function exportToCSV(data, columns, filename) {
  const BOM = '\uFEFF';
  const headers = columns.map(c => c.header).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      let val = row[c.key] ?? '';
      val = String(val);
      // Formula injection protection
      if (/^[=+\-@\t]/.test(val)) val = "'" + val;
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',')
  );
  const csv = BOM + headers + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = `${filename}-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
