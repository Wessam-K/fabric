/**
 * Report Scheduling Execution Engine
 * Polls report_schedules for due items and generates report files.
 */
const path = require('path');
const fs = require('fs');
const db = require('../database');
const ExcelJS = require('exceljs');

const GENERATED_DIR = path.join(__dirname, '..', 'generated-reports');
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

// Map report_type to a function that returns { columns, headerLabels, rows }
const REPORT_GENERATORS = {
  'work-orders': () => {
    const rows = db.prepare(`SELECT wo.wo_number, m.model_name, wo.quantity, wo.status, wo.consumer_price, wo.wholesale_price, wo.created_at
      FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id ORDER BY wo.created_at DESC LIMIT 1000`).all();
    return { columns: ['wo_number','model_name','quantity','status','consumer_price','wholesale_price','created_at'], headerLabels: ['WO#','Model','Qty','Status','Consumer','Wholesale','Created'], rows };
  },
  'invoices': () => {
    const rows = db.prepare(`SELECT invoice_number, customer_name, total, status, created_at FROM invoices ORDER BY created_at DESC LIMIT 1000`).all();
    return { columns: ['invoice_number','customer_name','total','status','created_at'], headerLabels: ['Invoice#','Customer','Total','Status','Created'], rows };
  },
  'expenses': () => {
    const rows = db.prepare(`SELECT description, amount, expense_type, expense_date, status FROM expenses WHERE is_deleted=0 ORDER BY expense_date DESC LIMIT 1000`).all();
    return { columns: ['description','amount','expense_type','expense_date','status'], headerLabels: ['Description','Amount','Type','Date','Status'], rows };
  },
  'purchase-orders': () => {
    const rows = db.prepare(`SELECT po.po_number, s.name as supplier, po.total_amount, po.status, po.order_date FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id ORDER BY po.order_date DESC LIMIT 1000`).all();
    return { columns: ['po_number','supplier','total_amount','status','order_date'], headerLabels: ['PO#','Supplier','Total','Status','Date'], rows };
  },
  'inventory': () => {
    const rows = db.prepare(`SELECT f.name, fi.color, fi.roll_number, fi.available_meters, fi.unit_price FROM fabric_inventory fi LEFT JOIN fabrics f ON f.id=fi.fabric_id WHERE fi.available_meters > 0 ORDER BY f.name LIMIT 1000`).all();
    return { columns: ['name','color','roll_number','available_meters','unit_price'], headerLabels: ['Fabric','Color','Roll#','Available(m)','Price/m'], rows };
  },
  'production': () => {
    const rows = db.prepare(`SELECT wo.wo_number, m.model_name, wo.quantity, wo.pieces_completed, wo.status, wo.total_production_cost
      FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id WHERE wo.status IN ('in_production','completed') ORDER BY wo.created_at DESC LIMIT 1000`).all();
    return { columns: ['wo_number','model_name','quantity','pieces_completed','status','total_production_cost'], headerLabels: ['WO#','Model','Qty','Completed','Status','Total Cost'], rows };
  },
  'financial-summary': () => {
    const year = new Date().getFullYear();
    const rows = db.prepare(`SELECT strftime('%Y-%m', created_at) as month, SUM(total) as revenue FROM invoices WHERE status='paid' AND strftime('%Y',created_at)=? GROUP BY month ORDER BY month`).all(String(year));
    return { columns: ['month','revenue'], headerLabels: ['Month','Revenue'], rows };
  },
};

function computeNextRun(frequency, dayOfWeek, dayOfMonth, hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour ?? 8, 0, 0, 0);
  if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    const day = dayOfWeek ?? 0;
    next.setDate(next.getDate() + ((7 + day - next.getDay()) % 7 || 7));
    if (next <= now) next.setDate(next.getDate() + 7);
  } else if (frequency === 'monthly') {
    const d = dayOfMonth ?? 1;
    next.setDate(d);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString().slice(0, 19).replace('T', ' ');
}

async function generateXLSX(data, filePath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  ws.addRow(data.headerLabels || data.columns);
  for (const row of data.rows) {
    ws.addRow(data.columns.map(c => row[c] ?? ''));
  }
  await wb.xlsx.writeFile(filePath);
}

function generateCSV(data) {
  const BOM = '\uFEFF';
  const esc = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = (data.headerLabels || data.columns).map(esc).join(',');
  const lines = data.rows.map(row => data.columns.map(c => esc(row[c])).join(','));
  return BOM + header + '\n' + lines.join('\n');
}

async function runScheduledReports() {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const due = db.prepare(`SELECT * FROM report_schedules WHERE enabled=1 AND next_run_at <= ?`).all(now);

    for (const schedule of due) {
      try {
        const generator = REPORT_GENERATORS[schedule.report_type];
        if (!generator) {
          console.warn(`[ReportScheduler] Unknown report_type: ${schedule.report_type}`);
          continue;
        }

        const data = generator();
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const ext = schedule.format === 'csv' ? 'csv' : 'xlsx';
        const fileName = `${schedule.report_type}_${ts}.${ext}`;
        const filePath = path.join(GENERATED_DIR, fileName);

        if (ext === 'csv') {
          try { fs.writeFileSync(filePath, generateCSV(data), 'utf8'); }
          catch (writeErr) { console.error(`[ReportScheduler] Write failed (disk full?): ${writeErr.message}`); continue; }
        } else {
          await generateXLSX(data, filePath);
        }

        const nextRun = computeNextRun(schedule.frequency, schedule.day_of_week, schedule.day_of_month, schedule.hour);
        db.prepare(`UPDATE report_schedules SET last_run_at=?, next_run_at=? WHERE id=?`).run(now, nextRun, schedule.id);

        console.log(`[ReportScheduler] Generated ${fileName} for schedule "${schedule.name}"`);
      } catch (err) {
        console.error(`[ReportScheduler] Failed schedule ${schedule.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[ReportScheduler] Error:', err.message);
  }
}

let intervalId = null;

// V59: Clean up old generated report files
function cleanOldReportFiles() {
  try {
    const maxAgeDays = parseInt(process.env.REPORT_RETENTION_DAYS || '30');
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(GENERATED_DIR);
    let deleted = 0;
    for (const file of files) {
      const filePath = path.join(GENERATED_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) { fs.unlinkSync(filePath); deleted++; }
      } catch {}
    }
    if (deleted > 0) console.log(`[ReportScheduler] Cleaned ${deleted} old report files (>${maxAgeDays} days)`);
  } catch (err) {
    console.error('[ReportScheduler] Cleanup error:', err.message);
  }
}

function startScheduler(intervalMs = 5 * 60 * 1000) {
  if (intervalId) return;
  // Run once on startup after short delay
  setTimeout(() => { runScheduledReports(); cleanOldReportFiles(); }, 10000);
  intervalId = setInterval(runScheduledReports, intervalMs);
  // V59: Run file cleanup daily
  setInterval(cleanOldReportFiles, 24 * 60 * 60 * 1000);
  console.log('[ReportScheduler] Started (interval: ' + (intervalMs / 60000) + ' min)');
}

function stopScheduler() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

module.exports = { startScheduler, stopScheduler, runScheduledReports };
