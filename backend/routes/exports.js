/**
 * WK-Hub Comprehensive Export Routes
 * Supports CSV and Excel (XLSX) exports for all major entities and reports.
 * All exports are permission-gated.
 */
const express = require('express');
const router = express.Router();
const db = require('../database');
// 1.1: Replaced xlsx (2 HIGH CVEs) with exceljs — safe, actively maintained
const ExcelJS = require('exceljs');
const { requirePermission } = require('../middleware/auth');
const { round2, safeSubtract } = require('../utils/money');

// ─── HELPERS ────────────────────────────────────
const BOM = '\uFEFF';

function escCSV(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSVString(rows, columns, headerLabels) {
  const header = (headerLabels || columns).map(escCSV).join(',');
  const lines = rows.map(row =>
    columns.map(col => escCSV(row[col])).join(',')
  );
  return header + '\n' + lines.join('\n');
}

function sendCSV(res, filename, rows, columns, headerLabels) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(BOM + toCSVString(rows, columns, headerLabels));
}

// 1.1: Rewritten sendExcel using exceljs (replacing vulnerable xlsx library)
async function sendExcel(res, filename, sheets) {
  const workbook = new ExcelJS.Workbook();
  for (const { name, data, columns, headerLabels } of sheets) {
    const ws = workbook.addWorksheet(name.slice(0, 31), { views: [{ rightToLeft: true }] });
    const labels = headerLabels || columns;
    // Add header row
    ws.addRow(labels);
    // Style header row bold
    ws.getRow(1).font = { bold: true };
    // Set column widths
    ws.columns = labels.map((label, i) => ({ width: Math.max(label.length + 4, 12) }));
    // Add data rows
    for (const row of data) {
      ws.addRow(columns.map(col => row[col] ?? ''));
    }
  }
  const buf = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
}

function getFormat(req) {
  return (req.query.format || 'csv').toLowerCase();
}

function dateFilter(req) {
  const from = req.query.from || '2000-01-01';
  const to = req.query.to || '2099-12-31';
  return { from, to };
}

// ═══════════════════════════════════════════════
// 1. SUPPLIERS REPORT (by supplier: POs, spending, fabric types)
// ═══════════════════════════════════════════════
router.get('/suppliers', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT s.code, s.name, s.supplier_type, s.phone, s.email, s.contact_name, s.payment_terms, s.rating,
        COUNT(DISTINCT po.id) as total_pos,
        COALESCE(SUM(po.total_amount),0) as total_ordered,
        COALESCE(SUM(po.paid_amount),0) as total_paid,
        COALESCE(SUM(po.total_amount - po.paid_amount),0) as outstanding,
        COUNT(DISTINCT CASE WHEN po.status='received' THEN po.id END) as received_pos,
        COUNT(DISTINCT CASE WHEN po.status='cancelled' THEN po.id END) as cancelled_pos
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id
        AND po.order_date BETWEEN ? AND ?
      WHERE s.status = 'active'
      GROUP BY s.id
      ORDER BY total_ordered DESC
    `).all(from, to);

    const cols = ['code','name','supplier_type','phone','contact_name','payment_terms','rating','total_pos','total_ordered','total_paid','outstanding','received_pos','cancelled_pos'];
    const labels = ['كود','الاسم','النوع','الهاتف','جهة الاتصال','شروط الدفع','التقييم','عدد أوامر الشراء','إجمالي المطلوب','إجمالي المدفوع','المتبقي','المستلمة','الملغاة'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'suppliers-report.xlsx', [{ name: 'تقرير الموردين', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'suppliers-report.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 2. FABRIC USAGE REPORT (by fabric: consumption, batches, WOs)
// ═══════════════════════════════════════════════
router.get('/fabric-usage', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT f.code, f.name, f.fabric_type, f.color, f.price_per_m,
        s.name as supplier_name,
        f.available_meters,
        COALESCE(bi.total_received, 0) as total_received_meters,
        COALESCE(bi.total_used, 0) as total_used_meters,
        COALESCE(bi.total_wasted, 0) as total_wasted_meters,
        COALESCE(wfc.consumption_meters, 0) as wo_consumption_meters,
        COALESCE(wfc.consumption_cost, 0) as wo_consumption_cost,
        COALESCE(wfc.wo_count, 0) as used_in_wo_count,
        f.low_stock_threshold,
        CASE WHEN f.available_meters <= f.low_stock_threshold THEN 'منخفض' ELSE 'جيد' END as stock_status
      FROM fabrics f
      LEFT JOIN suppliers s ON s.id = f.supplier_id
      LEFT JOIN (
        SELECT fabric_code,
          SUM(received_meters) as total_received,
          SUM(used_meters) as total_used,
          SUM(wasted_meters) as total_wasted
        FROM fabric_inventory_batches
        GROUP BY fabric_code
      ) bi ON bi.fabric_code = f.code
      LEFT JOIN (
        SELECT fabric_code,
          SUM(actual_meters) as consumption_meters,
          SUM(total_cost) as consumption_cost,
          COUNT(DISTINCT work_order_id) as wo_count
        FROM wo_fabric_consumption
        WHERE recorded_at BETWEEN ? AND ?
        GROUP BY fabric_code
      ) wfc ON wfc.fabric_code = f.code
      WHERE f.status = 'active'
      ORDER BY wo_consumption_cost DESC
    `).all(from, to);

    const cols = ['code','name','fabric_type','color','price_per_m','supplier_name','available_meters','total_received_meters','total_used_meters','total_wasted_meters','wo_consumption_meters','wo_consumption_cost','used_in_wo_count','stock_status'];
    const labels = ['كود','الاسم','النوع','اللون','سعر المتر','المورد','المتاح (م)','إجمالي المستلم (م)','إجمالي المستخدم (م)','إجمالي الهالك (م)','استهلاك الإنتاج (م)','تكلفة الاستهلاك','عدد أوامر الإنتاج','حالة المخزون'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'fabric-usage-report.xlsx', [{ name: 'استهلاك الأقمشة', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'fabric-usage-report.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 3. ACCESSORY USAGE REPORT
// ═══════════════════════════════════════════════
router.get('/accessory-usage', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT a.code, a.acc_type, a.name, a.unit, a.unit_price,
        s.name as supplier_name,
        a.quantity_on_hand,
        COALESCE(ab.total_received, 0) as total_received,
        COALESCE(ab.total_used, 0) as total_used,
        COALESCE(wac.consumption_qty, 0) as wo_consumption_qty,
        COALESCE(wac.consumption_cost, 0) as wo_consumption_cost,
        COALESCE(wac.wo_count, 0) as used_in_wo_count,
        a.low_stock_threshold,
        CASE WHEN a.quantity_on_hand <= a.low_stock_threshold THEN 'منخفض' ELSE 'جيد' END as stock_status
      FROM accessories a
      LEFT JOIN suppliers s ON s.id = a.supplier_id
      LEFT JOIN (
        SELECT accessory_code,
          SUM(received_qty) as total_received,
          SUM(used_qty) as total_used
        FROM accessory_inventory_batches
        GROUP BY accessory_code
      ) ab ON ab.accessory_code = a.code
      LEFT JOIN (
        SELECT accessory_code,
          SUM(actual_qty) as consumption_qty,
          SUM(total_cost) as consumption_cost,
          COUNT(DISTINCT work_order_id) as wo_count
        FROM wo_accessory_consumption
        WHERE recorded_at BETWEEN ? AND ?
        GROUP BY accessory_code
      ) wac ON wac.accessory_code = a.code
      WHERE a.status = 'active'
      ORDER BY wo_consumption_cost DESC
    `).all(from, to);

    const cols = ['code','acc_type','name','unit','unit_price','supplier_name','quantity_on_hand','total_received','total_used','wo_consumption_qty','wo_consumption_cost','used_in_wo_count','stock_status'];
    const labels = ['كود','النوع','الاسم','الوحدة','سعر الوحدة','المورد','الكمية المتاحة','إجمالي المستلم','إجمالي المستخدم','استهلاك الإنتاج','تكلفة الاستهلاك','عدد أوامر الإنتاج','حالة المخزون'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'accessory-usage-report.xlsx', [{ name: 'استهلاك الإكسسوارات', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'accessory-usage-report.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 4. WORK ORDER COST BREAKDOWN (by WO with full cost math)
// ═══════════════════════════════════════════════
router.get('/wo-cost-breakdown', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT wo.wo_number, m.model_code, m.model_name, m.category, wo.quantity, wo.status, wo.priority,
        wo.start_date, wo.due_date, wo.completed_date,
        wo.masnaiya, wo.masrouf, wo.margin_pct,
        wo.total_production_cost, wo.cost_per_piece, wo.waste_cost_total,
        c.name as customer_name,
        cs.main_fabric_cost, cs.lining_cost, cs.accessories_cost, cs.waste_cost as snapshot_waste_cost,
        cs.total_cost as snapshot_total_cost, cs.cost_per_piece as snapshot_cost_pp,
        cs.total_meters_main,
        (wo.masnaiya * wo.quantity) as masnaiya_total,
        (wo.masrouf * wo.quantity) as masrouf_total,
        wo.consumer_price, wo.wholesale_price
      FROM work_orders wo
      LEFT JOIN models m ON m.id = wo.model_id
      LEFT JOIN customers c ON c.id = wo.customer_id
      LEFT JOIN cost_snapshots cs ON cs.wo_id = wo.id
      WHERE wo.created_at BETWEEN ? AND ?
      ORDER BY wo.created_at DESC
    `).all(from, to);

    const cols = ['wo_number','model_code','model_name','category','quantity','status','customer_name','start_date','completed_date','masnaiya','masrouf','margin_pct','main_fabric_cost','lining_cost','accessories_cost','snapshot_waste_cost','masnaiya_total','masrouf_total','snapshot_total_cost','snapshot_cost_pp','consumer_price','wholesale_price','total_meters_main'];
    const labels = ['رقم أمر الإنتاج','كود الموديل','اسم الموديل','الفئة','الكمية','الحالة','العميل','تاريخ البدء','تاريخ الإنجاز','المصنعية/قطعة','المصروف/قطعة','هامش %','تكلفة القماش','تكلفة البطانة','تكلفة الإكسسوارات','تكلفة الهالك','إجمالي المصنعية','إجمالي المصروف','التكلفة الإجمالية','تكلفة القطعة','سعر المستهلك','سعر الجملة','أمتار القماش'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'wo-cost-breakdown.xlsx', [{ name: 'تكاليف أوامر الإنتاج', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'wo-cost-breakdown.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 5. MODEL PROFITABILITY REPORT
// ═══════════════════════════════════════════════
router.get('/model-profitability', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT m.model_code, m.model_name, m.category, m.gender,
        COUNT(DISTINCT wo.id) as wo_count,
        COALESCE(SUM(wo.quantity),0) as total_pieces,
        COALESCE(SUM(CASE WHEN wo.status='completed' THEN wo.quantity END),0) as completed_pieces,
        COALESCE(AVG(cs.cost_per_piece),0) as avg_cost_per_piece,
        COALESCE(AVG(wo.consumer_price),0) as avg_consumer_price,
        COALESCE(AVG(wo.wholesale_price),0) as avg_wholesale_price,
        COALESCE(SUM(cs.total_cost),0) as total_production_cost,
        COALESCE(SUM(inv.total),0) as total_revenue,
        COALESCE(SUM(inv.total),0) - COALESCE(SUM(cs.total_cost),0) as profit,
        CASE WHEN COALESCE(SUM(inv.total),0) > 0
          THEN ROUND((COALESCE(SUM(inv.total),0) - COALESCE(SUM(cs.total_cost),0)) / COALESCE(SUM(inv.total),0) * 100, 2)
          ELSE 0 END as profit_margin_pct
      FROM models m
      LEFT JOIN work_orders wo ON wo.model_id = m.id AND wo.created_at BETWEEN ? AND ?
      LEFT JOIN cost_snapshots cs ON cs.wo_id = wo.id
      LEFT JOIN invoices inv ON inv.wo_id = wo.id AND inv.status != 'cancelled'
      WHERE m.status = 'active'
      GROUP BY m.id
      ORDER BY total_revenue DESC
    `).all(from, to);

    const cols = ['model_code','model_name','category','gender','wo_count','total_pieces','completed_pieces','avg_cost_per_piece','avg_consumer_price','avg_wholesale_price','total_production_cost','total_revenue','profit','profit_margin_pct'];
    const labels = ['كود الموديل','الاسم','الفئة','الجنس','عدد الأوامر','إجمالي القطع','القطع المكتملة','متوسط تكلفة القطعة','متوسط سعر المستهلك','متوسط سعر الجملة','إجمالي تكلفة الإنتاج','إجمالي الإيرادات','الربح','هامش الربح %'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'model-profitability.xlsx', [{ name: 'ربحية الموديلات', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'model-profitability.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 6. PURCHASE ORDER DETAIL BY SUPPLIER (costs, items)
// ═══════════════════════════════════════════════
router.get('/po-by-supplier', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT s.code as supplier_code, s.name as supplier_name, s.supplier_type,
        po.po_number, po.po_type, po.status, po.order_date, po.expected_date, po.received_date,
        po.total_amount, po.paid_amount,
        (po.total_amount - po.paid_amount) as outstanding,
        poi.item_type, poi.fabric_code, poi.accessory_code, poi.description as item_desc,
        poi.quantity, poi.unit, poi.unit_price, COALESCE(poi.received_qty_actual, poi.received_qty) as received_qty,
        ROUND(poi.quantity * poi.unit_price, 2) as line_total
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE po.order_date BETWEEN ? AND ?
      ORDER BY s.name, po.order_date DESC
    `).all(from, to);

    const cols = ['supplier_code','supplier_name','po_number','po_type','status','order_date','received_date','item_type','item_desc','quantity','unit','unit_price','received_qty','line_total','total_amount','paid_amount','outstanding'];
    const labels = ['كود المورد','اسم المورد','رقم أمر الشراء','نوع الأمر','الحالة','تاريخ الطلب','تاريخ الاستلام','نوع الصنف','الوصف','الكمية','الوحدة','سعر الوحدة','الكمية المستلمة','إجمالي البند','إجمالي الأمر','المدفوع','المتبقي'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'po-by-supplier.xlsx', [{ name: 'أوامر شراء بالمورد', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'po-by-supplier.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 7. INVENTORY VALUATION (fabric + accessories)
// ═══════════════════════════════════════════════
router.get('/inventory-valuation', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const fabrics = db.prepare(`
      SELECT f.code, f.name, 'fabric' as item_type, f.fabric_type as sub_type,
        f.available_meters as qty_on_hand, 'meter' as unit, f.price_per_m as unit_price,
        ROUND(f.available_meters * f.price_per_m, 2) as total_value,
        s.name as supplier_name, f.low_stock_threshold,
        CASE WHEN f.available_meters <= f.low_stock_threshold THEN 'منخفض' ELSE 'جيد' END as stock_status
      FROM fabrics f
      LEFT JOIN suppliers s ON s.id = f.supplier_id
      WHERE f.status = 'active'
    `).all();

    const accessories = db.prepare(`
      SELECT a.code, a.name, 'accessory' as item_type, a.acc_type as sub_type,
        a.quantity_on_hand as qty_on_hand, a.unit, a.unit_price,
        ROUND(a.quantity_on_hand * a.unit_price, 2) as total_value,
        s.name as supplier_name, a.low_stock_threshold,
        CASE WHEN a.quantity_on_hand <= a.low_stock_threshold THEN 'منخفض' ELSE 'جيد' END as stock_status
      FROM accessories a
      LEFT JOIN suppliers s ON s.id = a.supplier_id
      WHERE a.status = 'active'
    `).all();

    const all = [...fabrics, ...accessories].sort((a, b) => (b.total_value || 0) - (a.total_value || 0));
    const cols = ['code','name','item_type','sub_type','qty_on_hand','unit','unit_price','total_value','supplier_name','stock_status'];
    const labels = ['كود','الاسم','نوع الصنف','التصنيف الفرعي','الكمية المتاحة','الوحدة','سعر الوحدة','القيمة الإجمالية','المورد','حالة المخزون'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'inventory-valuation.xlsx', [
        { name: 'أقمشة', data: fabrics, columns: cols, headerLabels: labels },
        { name: 'إكسسوارات', data: accessories, columns: cols, headerLabels: labels },
        { name: 'الكل', data: all, columns: cols, headerLabels: labels },
      ]);
    } else {
      sendCSV(res, 'inventory-valuation.csv', all, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 8. WASTE ANALYSIS REPORT
// ═══════════════════════════════════════════════
router.get('/waste-analysis', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT wo.wo_number, m.model_code, m.model_name,
        ww.waste_meters, ww.price_per_meter, ww.waste_cost, ww.notes, ww.recorded_at,
        wfb.fabric_code, f.name as fabric_name,
        CASE WHEN wfb.actual_total_meters > 0
          THEN ROUND(ww.waste_meters / wfb.actual_total_meters * 100, 2)
          ELSE 0 END as waste_pct
      FROM wo_waste ww
      JOIN work_orders wo ON wo.id = ww.work_order_id
      LEFT JOIN models m ON m.id = wo.model_id
      LEFT JOIN wo_fabric_batches wfb ON wfb.wo_id = wo.id AND wfb.id = (SELECT MIN(wfb2.id) FROM wo_fabric_batches wfb2 WHERE wfb2.wo_id = wo.id)
      LEFT JOIN fabrics f ON f.code = wfb.fabric_code
      WHERE ww.recorded_at BETWEEN ? AND ?
      ORDER BY ww.waste_cost DESC
    `).all(from, to);

    const cols = ['wo_number','model_code','model_name','fabric_code','fabric_name','waste_meters','price_per_meter','waste_cost','waste_pct','notes','recorded_at'];
    const labels = ['رقم أمر الإنتاج','كود الموديل','الموديل','كود القماش','اسم القماش','أمتار الهالك','سعر المتر','تكلفة الهالك','نسبة الهالك %','ملاحظات','تاريخ التسجيل'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'waste-analysis.xlsx', [{ name: 'تحليل الهالك', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'waste-analysis.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 9. FINANCIAL SUMMARY (revenue, costs, profit by month)
// ═══════════════════════════════════════════════
router.get('/financial-summary', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);

    const revenue = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month,
        COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END),0) as paid_revenue,
        COALESCE(SUM(total),0) as total_invoiced,
        COUNT(*) as invoice_count
      FROM invoices
      WHERE created_at BETWEEN ? AND ? AND status != 'cancelled'
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month
    `).all(from, to);

    const costs = db.prepare(`
      SELECT strftime('%Y-%m', po.order_date) as month,
        COALESCE(SUM(po.total_amount),0) as total_purchases,
        COALESCE(SUM(po.paid_amount),0) as total_paid
      FROM purchase_orders po
      WHERE po.order_date BETWEEN ? AND ? AND po.status != 'cancelled'
      GROUP BY strftime('%Y-%m', po.order_date)
      ORDER BY month
    `).all(from, to);

    const expenses = db.prepare(`
      SELECT strftime('%Y-%m', expense_date) as month,
        COALESCE(SUM(amount),0) as total_expenses
      FROM expenses
      WHERE expense_date BETWEEN ? AND ? AND status = 'approved'
      GROUP BY strftime('%Y-%m', expense_date)
      ORDER BY month
    `).all(from, to);

    // Merge into months
    const months = {};
    for (const r of revenue) { months[r.month] = { ...months[r.month], month: r.month, paid_revenue: r.paid_revenue, total_invoiced: r.total_invoiced, invoice_count: r.invoice_count }; }
    for (const c of costs) { months[c.month] = { ...(months[c.month] || { month: c.month }), total_purchases: c.total_purchases, total_paid_suppliers: c.total_paid }; }
    for (const e of expenses) { months[e.month] = { ...(months[e.month] || { month: e.month }), total_expenses: e.total_expenses }; }

    const rows = Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map(r => ({
      month: r.month,
      paid_revenue: round2(r.paid_revenue || 0),
      total_invoiced: round2(r.total_invoiced || 0),
      invoice_count: r.invoice_count || 0,
      total_purchases: round2(r.total_purchases || 0),
      total_paid_suppliers: round2(r.total_paid_suppliers || 0),
      total_expenses: round2(r.total_expenses || 0),
      net_profit: round2(safeSubtract(r.paid_revenue || 0, (r.total_paid_suppliers || 0) + (r.total_expenses || 0))),
    }));

    const cols = ['month','paid_revenue','total_invoiced','invoice_count','total_purchases','total_paid_suppliers','total_expenses','net_profit'];
    const labels = ['الشهر','الإيرادات المحصلة','إجمالي الفواتير','عدد الفواتير','إجمالي المشتريات','المدفوع للموردين','المصروفات','صافي الربح'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'financial-summary.xlsx', [{ name: 'ملخص مالي', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'financial-summary.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 10. CUSTOMER REPORT (sales, payments, balances)
// ═══════════════════════════════════════════════
router.get('/customers', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT c.code, c.name, c.phone, c.city, c.customer_type, c.credit_limit,
        COUNT(DISTINCT inv.id) as invoice_count,
        COALESCE(SUM(inv.total),0) as total_invoiced,
        COALESCE(SUM(CASE WHEN inv.status='paid' THEN inv.total ELSE 0 END),0) as total_paid,
        COALESCE(SUM(CASE WHEN inv.status IN ('sent','overdue') THEN inv.total ELSE 0 END),0) as outstanding,
        COALESCE(cp_total.total_payments, 0) as total_payments_received,
        COUNT(DISTINCT so.id) as sales_order_count,
        COUNT(DISTINCT sr.id) as return_count
      FROM customers c
      LEFT JOIN invoices inv ON inv.customer_id = c.id AND inv.created_at BETWEEN ? AND ?
      LEFT JOIN sales_orders so ON so.customer_id = c.id AND so.created_at BETWEEN ? AND ?
      LEFT JOIN sales_returns sr ON sr.customer_id = c.id AND sr.created_at BETWEEN ? AND ?
      LEFT JOIN (
        SELECT customer_id, SUM(amount) as total_payments FROM customer_payments GROUP BY customer_id
      ) cp_total ON cp_total.customer_id = c.id
      WHERE c.status = 'active'
      GROUP BY c.id
      ORDER BY total_invoiced DESC
    `).all(from, to, from, to, from, to);

    const cols = ['code','name','phone','city','customer_type','credit_limit','invoice_count','total_invoiced','total_paid','outstanding','total_payments_received','sales_order_count','return_count'];
    const labels = ['كود','الاسم','الهاتف','المدينة','النوع','حد الائتمان','عدد الفواتير','إجمالي المفوتر','المحصل','المتبقي','إجمالي المدفوعات','عدد أوامر البيع','عدد المرتجعات'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'customer-report.xlsx', [{ name: 'تقرير العملاء', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'customer-report.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 11. PRODUCTION QUALITY REPORT (QC inspections)
// ═══════════════════════════════════════════════
router.get('/quality-report', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT qc.inspection_number, wo.wo_number, m.model_code, m.model_name,
        qc.inspection_date, qc.lot_size, qc.sample_size, qc.passed, qc.failed, qc.result,
        CASE WHEN qc.sample_size > 0 THEN ROUND(CAST(qc.passed AS REAL) / qc.sample_size * 100, 2) ELSE 0 END as pass_rate,
        CASE WHEN qc.sample_size > 0 THEN ROUND(CAST(qc.failed AS REAL) / qc.sample_size * 100, 2) ELSE 0 END as fail_rate
      FROM qc_inspections qc
      LEFT JOIN work_orders wo ON wo.id = qc.work_order_id
      LEFT JOIN models m ON m.id = wo.model_id
      WHERE qc.created_at BETWEEN ? AND ?
      ORDER BY qc.inspection_date DESC
    `).all(from, to);

    const cols = ['inspection_number','wo_number','model_code','model_name','inspection_date','lot_size','sample_size','passed','failed','result','pass_rate','fail_rate'];
    const labels = ['رقم الفحص','رقم أمر الإنتاج','كود الموديل','الموديل','تاريخ الفحص','حجم الدفعة','حجم العينة','ناجح','فاشل','النتيجة','نسبة النجاح %','نسبة الفشل %'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, 'quality-report.xlsx', [{ name: 'تقرير الجودة', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'quality-report.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 12. HR/PAYROLL REPORT
// ═══════════════════════════════════════════════
router.get('/payroll', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const period = req.query.period; // e.g. "2026-01"
    let rows;
    if (period) {
      rows = db.prepare(`
        SELECT e.emp_code, e.full_name, e.department, e.job_title, e.employment_type,
          pr.days_worked, pr.hours_worked, pr.overtime_hours, pr.absent_days,
          pr.base_pay, pr.overtime_pay, pr.gross_pay,
          pr.social_insurance, pr.tax_deduction, pr.total_deductions, pr.net_pay,
          pr.payment_status, pp.period_name
        FROM payroll_records pr
        JOIN employees e ON e.id = pr.employee_id
        JOIN payroll_periods pp ON pp.id = pr.period_id
        WHERE pp.period_month = ?
        ORDER BY e.department, e.full_name
      `).all(period);
    } else {
      rows = db.prepare(`
        SELECT e.emp_code, e.full_name, e.department, e.job_title, e.employment_type,
          pr.days_worked, pr.hours_worked, pr.overtime_hours, pr.absent_days,
          pr.base_pay, pr.overtime_pay, pr.gross_pay,
          pr.social_insurance, pr.tax_deduction, pr.total_deductions, pr.net_pay,
          pr.payment_status, pp.period_name
        FROM payroll_records pr
        JOIN employees e ON e.id = pr.employee_id
        JOIN payroll_periods pp ON pp.id = pr.period_id
        ORDER BY pp.period_month DESC, e.department, e.full_name
      `).all();
    }

    const cols = ['emp_code','full_name','department','job_title','period_name','days_worked','hours_worked','overtime_hours','absent_days','base_pay','overtime_pay','gross_pay','social_insurance','tax_deduction','total_deductions','net_pay','payment_status'];
    const labels = ['كود الموظف','الاسم','القسم','الوظيفة','الفترة','أيام العمل','ساعات العمل','ساعات إضافية','أيام غياب','الراتب الأساسي','بدل إضافي','إجمالي','تأمينات','ضرائب','إجمالي الخصم','صافي الراتب','حالة الصرف'];

    const fmt = getFormat(req);
    if (fmt === 'xlsx') {
      await sendExcel(res, `payroll${period ? '-' + period : ''}.xlsx`, [{ name: 'كشف الرواتب', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, `payroll${period ? '-' + period : ''}.csv`, rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 13. COMPREHENSIVE MULTI-SHEET EXCEL EXPORT
// ═══════════════════════════════════════════════
router.get('/full-export', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);

    const fabrics = db.prepare(`SELECT f.code, f.name, f.fabric_type, f.color, f.price_per_m, s.name as supplier_name, f.available_meters, f.status FROM fabrics f LEFT JOIN suppliers s ON s.id=f.supplier_id ORDER BY f.code`).all();
    const accessories = db.prepare(`SELECT a.code, a.acc_type, a.name, a.unit_price, a.unit, s.name as supplier_name, a.quantity_on_hand, a.status FROM accessories a LEFT JOIN suppliers s ON s.id=a.supplier_id ORDER BY a.code`).all();
    const suppliers = db.prepare(`SELECT code, name, supplier_type, phone, email, contact_name, rating, status FROM suppliers ORDER BY code`).all();
    const customers = db.prepare(`SELECT code, name, phone, city, customer_type, credit_limit, status FROM customers ORDER BY code`).all();
    const pos = db.prepare(`SELECT po.po_number, s.name as supplier_name, po.po_type, po.status, po.order_date, po.total_amount, po.paid_amount FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.order_date BETWEEN ? AND ? ORDER BY po.order_date DESC`).all(from, to);
    const wos = db.prepare(`SELECT wo.wo_number, m.model_code, m.model_name, wo.quantity, wo.status, wo.priority, wo.start_date, wo.due_date, wo.total_production_cost, wo.cost_per_piece FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id WHERE wo.created_at BETWEEN ? AND ? ORDER BY wo.created_at DESC`).all(from, to);
    const invoices = db.prepare(`SELECT inv.invoice_number, inv.customer_name, inv.status, inv.subtotal, inv.discount, inv.tax_pct, inv.total, inv.due_date, inv.created_at FROM invoices inv WHERE inv.created_at BETWEEN ? AND ? ORDER BY inv.created_at DESC`).all(from, to);

    await sendExcel(res, 'wk-hub-full-export.xlsx', [
      { name: 'أقمشة', data: fabrics, columns: ['code','name','fabric_type','color','price_per_m','supplier_name','available_meters','status'], headerLabels: ['كود','الاسم','النوع','اللون','سعر المتر','المورد','المتاح','الحالة'] },
      { name: 'إكسسوارات', data: accessories, columns: ['code','acc_type','name','unit_price','unit','supplier_name','quantity_on_hand','status'], headerLabels: ['كود','النوع','الاسم','سعر الوحدة','الوحدة','المورد','المتاح','الحالة'] },
      { name: 'موردين', data: suppliers, columns: ['code','name','supplier_type','phone','email','contact_name','rating','status'], headerLabels: ['كود','الاسم','النوع','الهاتف','البريد','جهة الاتصال','التقييم','الحالة'] },
      { name: 'عملاء', data: customers, columns: ['code','name','phone','city','customer_type','credit_limit','status'], headerLabels: ['كود','الاسم','الهاتف','المدينة','النوع','حد الائتمان','الحالة'] },
      { name: 'أوامر شراء', data: pos, columns: ['po_number','supplier_name','po_type','status','order_date','total_amount','paid_amount'], headerLabels: ['رقم الأمر','المورد','النوع','الحالة','التاريخ','الإجمالي','المدفوع'] },
      { name: 'أوامر إنتاج', data: wos, columns: ['wo_number','model_code','model_name','quantity','status','priority','start_date','due_date','total_production_cost','cost_per_piece'], headerLabels: ['رقم الأمر','كود الموديل','الاسم','الكمية','الحالة','الأولوية','البدء','الاستحقاق','التكلفة','تكلفة القطعة'] },
      { name: 'فواتير', data: invoices, columns: ['invoice_number','customer_name','status','subtotal','discount','tax_pct','total','due_date','created_at'], headerLabels: ['رقم الفاتورة','العميل','الحالة','المبلغ','الخصم','الضريبة %','الإجمالي','الاستحقاق','التاريخ'] },
    ]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 14. EMPLOYEES EXPORT
// ═══════════════════════════════════════════════
router.get('/employees', requirePermission('hr', 'view'), async (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT e.emp_code, e.full_name, e.department, e.job_title, e.employment_type,
             e.salary_type, e.base_salary,
             e.housing_allowance, e.transport_allowance,
             e.hire_date, e.phone, e.status
      FROM employees e ORDER BY e.department, e.full_name
    `).all();
    const cols = ['emp_code','full_name','department','job_title','employment_type','salary_type','base_salary','housing_allowance','transport_allowance','hire_date','phone','status'];
    const labels = ['الكود','الاسم','القسم','المسمى الوظيفي','نوع التعاقد','نوع الراتب','الراتب الأساسي','بدل سكن','بدل مواصلات','تاريخ التعيين','الهاتف','الحالة'];
    if (getFormat(req) === 'xlsx') {
      await sendExcel(res, 'employees.xlsx', [{ name: 'الموظفون', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'employees.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 15. MACHINES EXPORT
// ═══════════════════════════════════════════════
router.get('/machines', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT mc.code, mc.name, mc.machine_type, mc.brand, mc.model_number,
             mc.purchase_date, mc.purchase_price, mc.status,
             mc.last_maintenance_date, mc.next_maintenance_date,
             (SELECT COUNT(*) FROM maintenance_orders mo WHERE mo.machine_id = mc.id) as maintenance_count,
             (SELECT COALESCE(SUM(mo.cost),0) FROM maintenance_orders mo WHERE mo.machine_id = mc.id) as total_maintenance_cost
      FROM machines mc ORDER BY mc.code
    `).all();
    const cols = ['code','name','machine_type','brand','model_number','purchase_date','purchase_price','status','last_maintenance_date','next_maintenance_date','maintenance_count','total_maintenance_cost'];
    const labels = ['الكود','الاسم','النوع','الماركة','الموديل','تاريخ الشراء','سعر الشراء','الحالة','آخر صيانة','الصيانة القادمة','عدد الصيانات','إجمالي تكاليف الصيانة'];
    if (getFormat(req) === 'xlsx') {
      await sendExcel(res, 'machines.xlsx', [{ name: 'الماكينات', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'machines.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 16. STAGE PROGRESS EXPORT
// ═══════════════════════════════════════════════
router.get('/stage-progress', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT ws.id, wo.wo_number, m.model_code, ws.stage_name, ws.sort_order,
             ws.quantity_in_stage, ws.status as stage_status,
             ws.assigned_to, e.full_name as assigned_name,
             ws.started_at, ws.completed_at,
             wo.quantity as wo_total_qty, wo.status as wo_status
      FROM wo_stages ws
      JOIN work_orders wo ON wo.id = ws.wo_id
      LEFT JOIN models m ON m.id = wo.model_id
      LEFT JOIN employees e ON e.id = ws.assigned_to
      ORDER BY wo.wo_number, ws.sort_order
    `).all();
    const cols = ['wo_number','model_code','stage_name','sort_order','quantity_in_stage','stage_status','assigned_name','started_at','completed_at','wo_total_qty','wo_status'];
    const labels = ['رقم أمر الإنتاج','كود الموديل','المرحلة','الترتيب','الكمية بالمرحلة','حالة المرحلة','المسؤول','تاريخ البدء','تاريخ الانتهاء','إجمالي الكمية','حالة الأمر'];
    if (getFormat(req) === 'xlsx') {
      await sendExcel(res, 'stage-progress.xlsx', [{ name: 'تقدم المراحل', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'stage-progress.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 17. PRODUCTION TIMELINE EXPORT
// ═══════════════════════════════════════════════
router.get('/production-timeline', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT wo.wo_number, m.model_code, m.model_name, wo.quantity,
             wo.status, wo.priority,
             c.name as customer_name,
             wo.start_date, wo.due_date, wo.completed_date,
             CAST(julianday(COALESCE(wo.completed_date, date('now'))) - julianday(wo.start_date) AS INTEGER) as days_elapsed,
             CASE WHEN wo.due_date < date('now') AND wo.status NOT IN ('completed','cancelled') THEN 'متأخر' ELSE 'في الوقت' END as schedule_status,
             wo.total_production_cost, wo.cost_per_piece
      FROM work_orders wo
      LEFT JOIN models m ON m.id = wo.model_id
      LEFT JOIN customers c ON c.id = wo.customer_id
      WHERE wo.start_date BETWEEN ? AND ?
      ORDER BY wo.start_date
    `).all(from, to);
    const cols = ['wo_number','model_code','model_name','quantity','status','priority','customer_name','start_date','due_date','completed_date','days_elapsed','schedule_status','total_production_cost','cost_per_piece'];
    const labels = ['رقم الأمر','كود الموديل','الاسم','الكمية','الحالة','الأولوية','العميل','تاريخ البدء','الاستحقاق','الإنجاز','الأيام','مواعيد التسليم','التكلفة الإجمالية','تكلفة القطعة'];
    if (getFormat(req) === 'xlsx') {
      await sendExcel(res, 'production-timeline.xlsx', [{ name: 'الخط الزمني', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'production-timeline.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 18. PURCHASE SUMMARY BY TYPE
// ═══════════════════════════════════════════════
router.get('/purchase-summary', requirePermission('reports', 'view'), async (req, res) => {
  try {
    const { from, to } = dateFilter(req);
    const rows = db.prepare(`
      SELECT po.po_type,
             COUNT(*) as total_orders,
             SUM(CASE WHEN po.status='received' THEN 1 ELSE 0 END) as received_count,
             SUM(CASE WHEN po.status IN ('draft','sent','partial') THEN 1 ELSE 0 END) as pending_count,
             ROUND(SUM(po.total_amount),2) as total_amount,
             ROUND(SUM(po.paid_amount),2) as total_paid,
             ROUND(SUM(po.total_amount) - SUM(po.paid_amount),2) as outstanding,
             COUNT(DISTINCT po.supplier_id) as supplier_count
      FROM purchase_orders po
      WHERE po.order_date BETWEEN ? AND ?
      GROUP BY po.po_type
      ORDER BY total_amount DESC
    `).all(from, to);
    const cols = ['po_type','total_orders','received_count','pending_count','total_amount','total_paid','outstanding','supplier_count'];
    const labels = ['النوع','عدد الأوامر','المستلمة','المعلقة','الإجمالي','المدفوع','المتبقي','عدد الموردين'];
    if (getFormat(req) === 'xlsx') {
      await sendExcel(res, 'purchase-summary.xlsx', [{ name: 'ملخص المشتريات', data: rows, columns: cols, headerLabels: labels }]);
    } else {
      sendCSV(res, 'purchase-summary.csv', rows, cols, labels);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// 19. EXPORT CATALOG (lists available exports)
// ═══════════════════════════════════════════════
router.get('/catalog', requirePermission('reports', 'view'), (req, res) => {
  res.json([
    { key: 'suppliers', label: 'الموردين', icon: 'Users', description: 'بيانات الموردين وإحصائيات الشراء' },
    { key: 'fabric-usage', label: 'استهلاك الأقمشة', icon: 'Scissors', description: 'تحليل استخدام الأقمشة والمخزون' },
    { key: 'accessory-usage', label: 'استهلاك الاكسسوارات', icon: 'Package', description: 'تحليل استخدام الاكسسوارات' },
    { key: 'wo-cost-breakdown', label: 'تكاليف الإنتاج', icon: 'DollarSign', description: 'تفصيل تكاليف أوامر الإنتاج' },
    { key: 'model-profitability', label: 'ربحية الموديلات', icon: 'TrendingUp', description: 'تحليل أرباح كل موديل' },
    { key: 'po-by-supplier', label: 'المشتريات بالمورد', icon: 'Warehouse', description: 'أوامر الشراء مجمعة بالمورد' },
    { key: 'inventory-valuation', label: 'تقييم المخزون', icon: 'Package', description: 'قيمة المخزون الحالي' },
    { key: 'waste-analysis', label: 'تحليل الهدر', icon: 'AlertTriangle', description: 'تقرير هدر الأقمشة والتكاليف' },
    { key: 'financial-summary', label: 'الملخص المالي', icon: 'CreditCard', description: 'إيرادات ومصروفات وأرباح شهرية' },
    { key: 'customers', label: 'العملاء', icon: 'UserCheck', description: 'بيانات العملاء والمبيعات' },
    { key: 'quality-report', label: 'تقرير الجودة', icon: 'CheckCircle', description: 'نتائج فحوصات الجودة' },
    { key: 'payroll', label: 'الرواتب', icon: 'Receipt', description: 'تقرير المرتبات والبدلات' },
    { key: 'employees', label: 'الموظفون', icon: 'Users', description: 'بيانات الموظفين' },
    { key: 'machines', label: 'الماكينات', icon: 'Settings', description: 'بيانات الماكينات والصيانة' },
    { key: 'stage-progress', label: 'تقدم المراحل', icon: 'Layers', description: 'حالة مراحل الإنتاج لكل أمر' },
    { key: 'production-timeline', label: 'الخط الزمني للإنتاج', icon: 'Calendar', description: 'جدول أوامر الإنتاج والمواعيد' },
    { key: 'purchase-summary', label: 'ملخص المشتريات', icon: 'Warehouse', description: 'إحصائيات المشتريات حسب النوع' },
    { key: 'full-export', label: 'تصدير شامل', icon: 'FileText', description: 'جميع البيانات في ملف Excel واحد', excelOnly: true },
  ]);
});

module.exports = router;
