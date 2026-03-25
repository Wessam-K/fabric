const express = require('express');
const router = express.Router();
const db = require('../database');
const { requirePermission } = require('../middleware/auth');

// GET /api/reports/summary — KPI overview
router.get('/summary', requirePermission('reports', 'view'), (req, res) => {
  try {
    const totalModels = db.prepare("SELECT COUNT(*) as c FROM models WHERE status='active'").get().c;
    const totalFabrics = db.prepare("SELECT COUNT(*) as c FROM fabrics WHERE status='active'").get().c;
    const totalAccessories = db.prepare("SELECT COUNT(*) as c FROM accessories WHERE status='active'").get().c;
    const totalSuppliers = db.prepare("SELECT COUNT(*) as c FROM suppliers WHERE status='active'").get().c;
    const activeWO = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status IN ('pending','in_progress')").get().c;
    const completedWO = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed'").get().c;

    const costStats = db.prepare(`SELECT
      AVG(cost_per_piece) as avg_cost,
      MIN(cost_per_piece) as min_cost,
      MAX(cost_per_piece) as max_cost,
      SUM(total_cost) as total_cost,
      SUM(total_pieces) as total_pieces
      FROM cost_snapshots`).get();

    const outstandingPayables = db.prepare(`SELECT COALESCE(SUM(total_amount - paid_amount),0) as v FROM purchase_orders WHERE status NOT IN ('cancelled','draft')`).get().v;
    const pendingInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE status IN ('draft','sent')").get().c;

    res.json({
      total_models: totalModels,
      total_fabrics: totalFabrics,
      total_accessories: totalAccessories,
      total_suppliers: totalSuppliers,
      active_work_orders: activeWO,
      completed_work_orders: completedWO,
      avg_cost_per_piece: Math.round((costStats.avg_cost || 0) * 100) / 100,
      total_pieces: costStats.total_pieces || 0,
      total_cost: Math.round((costStats.total_cost || 0) * 100) / 100,
      min_cost_per_piece: Math.round((costStats.min_cost || 0) * 100) / 100,
      max_cost_per_piece: Math.round((costStats.max_cost || 0) * 100) / 100,
      outstanding_payables: Math.round(outstandingPayables * 100) / 100,
      pending_invoices: pendingInvoices,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/work-orders — WO-based production report
router.get('/work-orders', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { status, date_from, date_to, search } = req.query;
    let q = `SELECT wo.*, m.model_code, m.model_name, m.category, m.gender,
      (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id AND status='completed') as stages_done,
      (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id) as stages_total,
      (SELECT COALESCE(SUM(qty_s+qty_m+qty_l+qty_xl+qty_2xl+qty_3xl),0) FROM wo_sizes WHERE wo_id=wo.id) as total_pieces
      FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id WHERE 1=1`;
    const p = [];
    if (status) { q += ' AND wo.status=?'; p.push(status); }
    if (date_from) { q += ' AND wo.created_at >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND wo.created_at <= ?'; p.push(date_to + 'T23:59:59'); }
    if (search) { const s = `%${search}%`; q += ' AND (wo.wo_number LIKE ? OR m.model_code LIKE ? OR m.model_name LIKE ?)'; p.push(s, s, s); }
    q += ' ORDER BY wo.created_at DESC';
    res.json(db.prepare(q).all(...p));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/by-fabric — fabric usage from work orders
router.get('/by-fabric', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { search, date_from, date_to } = req.query;
    let where = '1=1';
    const p = [];
    if (search) { where += ' AND (f.code LIKE ? OR f.name LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    if (date_from) { where += ' AND wo.created_at >= ?'; p.push(date_from); }
    if (date_to) { where += ' AND wo.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    const rows = db.prepare(`
      SELECT f.code, f.name, f.fabric_type, f.price_per_m,
        COUNT(DISTINCT wf.wo_id) as wo_count,
        SUM(wf.meters_per_piece) as total_meters_per_piece,
        SUM(COALESCE(wf.actual_meters, wf.planned_meters)) as total_meters,
        SUM(COALESCE(wf.actual_meters, wf.planned_meters) * f.price_per_m) as total_cost
      FROM wo_fabrics wf
      JOIN fabrics f ON f.code = wf.fabric_code
      JOIN work_orders wo ON wo.id = wf.wo_id AND wo.status != 'cancelled'
      WHERE ${where}
      GROUP BY f.code
      ORDER BY total_cost DESC
    `).all(...p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/by-accessory — accessory usage from work orders
router.get('/by-accessory', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { search, date_from, date_to } = req.query;
    let where = '1=1';
    const p = [];
    if (search) { where += ' AND (a.code LIKE ? OR a.name LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    if (date_from) { where += ' AND wo.created_at >= ?'; p.push(date_from); }
    if (date_to) { where += ' AND wo.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    const rows = db.prepare(`
      SELECT a.code, a.name, a.acc_type, a.unit_price as registry_price,
        COUNT(DISTINCT wa.wo_id) as wo_count,
        SUM(wa.quantity) as total_quantity,
        SUM(wa.quantity * wa.unit_price) as total_cost
      FROM wo_accessories wa
      JOIN accessories a ON a.code = wa.accessory_code
      JOIN work_orders wo ON wo.id = wa.wo_id AND wo.status != 'cancelled'
      WHERE ${where}
      GROUP BY a.code
      ORDER BY total_cost DESC
    `).all(...p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/suppliers — supplier spending report
router.get('/suppliers', requirePermission('reports', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT s.id, s.code, s.name, s.supplier_type,
        COUNT(DISTINCT po.id) as po_count,
        COALESCE(SUM(po.total_amount),0) as total_ordered,
        COALESCE(SUM(po.paid_amount),0) as total_paid,
        COALESCE(SUM(po.total_amount - po.paid_amount),0) as balance
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id=s.id AND po.status != 'cancelled'
      WHERE s.status='active'
      GROUP BY s.id
      ORDER BY total_ordered DESC
    `).all();
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/by-model — per-model WO cost breakdown
router.get('/by-model', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { search, date_from, date_to } = req.query;
    let where = "m.status='active'";
    const p = [];
    if (search) { where += ' AND (m.model_code LIKE ? OR m.model_name LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    if (date_from) { where += ' AND m.created_at >= ?'; p.push(date_from); }
    if (date_to) { where += ' AND m.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    const rows = db.prepare(`
      SELECT m.model_code, m.model_name, m.category, m.gender,
        COUNT(DISTINCT wo.id) as wo_count,
        SUM(CASE WHEN wo.status='completed' THEN 1 ELSE 0 END) as completed_count,
        cs_latest.total_pieces, cs_latest.main_fabric_cost, cs_latest.lining_cost,
        cs_latest.accessories_cost, cs_latest.masnaiya, cs_latest.masrouf,
        cs_latest.total_cost, cs_latest.cost_per_piece
      FROM models m
      LEFT JOIN work_orders wo ON wo.model_id=m.id AND wo.status!='cancelled'
      LEFT JOIN (
        SELECT wo_id, total_pieces, main_fabric_cost, lining_cost,
               accessories_cost, masnaiya, masrouf, total_cost, cost_per_piece,
               ROW_NUMBER() OVER (PARTITION BY wo_id ORDER BY snapshot_date DESC) as rn
        FROM cost_snapshots WHERE wo_id IS NOT NULL
      ) cs_latest ON cs_latest.wo_id=wo.id AND cs_latest.rn=1
      WHERE ${where}
      GROUP BY m.id
      ORDER BY wo_count DESC
    `).all(...p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/model-detail/:code — full model breakdown
router.get('/model-detail/:code', requirePermission('reports', 'view'), (req, res) => {
  try {
    const model = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'الموديل غير موجود' });

    // Production summary from view (if v11 migration ran)
    let summary = null;
    try {
      summary = db.prepare('SELECT * FROM model_production_summary WHERE model_code=?').get(req.params.code);
    } catch {}

    // BOM templates with costs
    const templates = db.prepare('SELECT * FROM bom_templates WHERE model_id=? ORDER BY is_default DESC').all(model.id);
    const templateDetails = templates.map(t => {
      const fabrics = db.prepare(`SELECT btf.*, f.name as fabric_name, f.price_per_m FROM bom_template_fabrics btf LEFT JOIN fabrics f ON f.code=btf.fabric_code WHERE btf.template_id=?`).all(t.id);
      const accessories = db.prepare(`SELECT bta.*, a.name as registry_name FROM bom_template_accessories bta LEFT JOIN accessories a ON a.code=bta.accessory_code WHERE bta.template_id=?`).all(t.id);
      const sizes = db.prepare('SELECT * FROM bom_template_sizes WHERE template_id=?').all(t.id);
      const grandTotal = sizes.reduce((s, sz) => s + (sz.qty_s||0) + (sz.qty_m||0) + (sz.qty_l||0) + (sz.qty_xl||0) + (sz.qty_2xl||0) + (sz.qty_3xl||0), 0);
      return { ...t, fabrics, accessories, sizes, grand_total: grandTotal };
    });

    // Work orders for this model
    const workOrders = db.prepare(`SELECT wo.*, 
      (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id AND status='completed') as stages_done,
      (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id) as stages_total
      FROM work_orders wo WHERE wo.model_id=? AND wo.status!='cancelled' ORDER BY wo.created_at DESC`).all(model.id);

    // Cost history from snapshots
    const costHistory = db.prepare(`SELECT cs.* FROM cost_snapshots cs 
      INNER JOIN work_orders wo ON wo.id=cs.wo_id WHERE wo.model_id=? 
      ORDER BY cs.snapshot_date DESC LIMIT 20`).all(model.id);

    res.json({ model, summary, templates: templateDetails, work_orders: workOrders, cost_history: costHistory });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports — cost snapshots (paginated)
router.get('/', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { page = 1, limit = 20, date_from, date_to, wo_id } = req.query;
    let q = `SELECT cs.*, m.model_code, m.model_name, wo.wo_number
             FROM cost_snapshots cs
             LEFT JOIN models m ON m.id=cs.model_id
             LEFT JOIN work_orders wo ON wo.id=cs.wo_id
             WHERE 1=1`;
    const p = [];
    if (wo_id) { q += ' AND cs.wo_id=?'; p.push(wo_id); }
    if (date_from) { q += ' AND cs.snapshot_date >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND cs.snapshot_date <= ?'; p.push(date_to + 'T23:59:59'); }
    q += ' ORDER BY cs.snapshot_date DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    q += ` LIMIT ? OFFSET ?`;
    p.push(parseInt(limit), offset);
    res.json(db.prepare(q).all(...p));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/production-by-stage — WIP pipeline
router.get('/production-by-stage', requirePermission('reports', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT ws.stage_name,
        COUNT(DISTINCT ws.wo_id) as wo_count,
        SUM(ws.quantity_in_stage) as total_in_stage,
        SUM(ws.quantity_completed) as total_completed,
        SUM(CASE WHEN ws.status='in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN ws.status='completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN ws.status='pending' THEN 1 ELSE 0 END) as pending
      FROM wo_stages ws
      INNER JOIN work_orders wo ON wo.id=ws.wo_id AND wo.status NOT IN ('cancelled','completed')
      GROUP BY ws.stage_name
      ORDER BY MIN(ws.sort_order)
    `).all();
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/costs — cost breakdown from cost_snapshots
router.get('/costs', requirePermission('reports', 'view'), (req, res) => {
  try {
    const totals = db.prepare(`SELECT
      COALESCE(SUM(main_fabric_cost),0) as main_fabric_cost,
      COALESCE(SUM(lining_cost),0) as lining_cost,
      COALESCE(SUM(accessories_cost),0) as accessories_cost,
      COALESCE(SUM(masnaiya),0) as masnaiya,
      COALESCE(SUM(masrouf),0) as masrouf,
      COALESCE(SUM(total_cost),0) as total_cost,
      COALESCE(SUM(total_pieces),0) as total_pieces
      FROM cost_snapshots WHERE wo_id IS NOT NULL`).get();
    const snapshots = db.prepare(`SELECT cs.*, wo.wo_number, m.model_code, m.model_name
      FROM cost_snapshots cs
      LEFT JOIN work_orders wo ON wo.id=cs.wo_id
      LEFT JOIN models m ON m.id=cs.model_id
      WHERE cs.wo_id IS NOT NULL
      ORDER BY cs.snapshot_date DESC`).all();
    res.json({ totals, snapshots });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/fabric-consumption — fabric usage from batches
router.get('/fabric-consumption', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let where = "wo.status != 'cancelled'";
    const p = [];
    if (date_from) { where += ' AND wo.created_at >= ?'; p.push(date_from); }
    if (date_to) { where += ' AND wo.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    const rows = db.prepare(`
      SELECT f.code, f.name, f.fabric_type,
        COALESCE(SUM(wfb.planned_total_meters),0) as planned_meters,
        COALESCE(SUM(wfb.actual_total_meters),0) as actual_meters,
        COALESCE(SUM(wfb.waste_meters),0) as waste_meters,
        COALESCE(SUM(wfb.planned_cost),0) as planned_cost,
        COALESCE(SUM(wfb.actual_cost),0) as actual_cost,
        COALESCE(SUM(wfb.waste_cost),0) as waste_cost,
        COUNT(DISTINCT wfb.wo_id) as wo_count
      FROM wo_fabric_batches wfb
      JOIN fabrics f ON f.code=wfb.fabric_code
      JOIN work_orders wo ON wo.id=wfb.wo_id
      WHERE ${where}
      GROUP BY f.code
      ORDER BY actual_cost DESC
    `).all(...p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/supplier-fabric — fabric purchased by supplier
router.get('/supplier-fabric', requirePermission('reports', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT s.id, s.name as supplier_name, s.code as supplier_code,
        f.code as fabric_code, f.name as fabric_name,
        COALESCE(SUM(fib.received_meters),0) as total_meters,
        COALESCE(SUM(fib.used_meters),0) as used_meters,
        COALESCE(SUM(fib.wasted_meters),0) as wasted_meters,
        AVG(fib.price_per_meter) as avg_price,
        COALESCE(SUM(fib.received_meters * fib.price_per_meter),0) as total_value,
        COUNT(fib.id) as batch_count
      FROM fabric_inventory_batches fib
      JOIN suppliers s ON s.id=fib.supplier_id
      JOIN fabrics f ON f.code=fib.fabric_code
      WHERE fib.batch_status!='cancelled'
      GROUP BY s.id, f.code
      ORDER BY s.name, total_value DESC
    `).all();
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/waste-analysis — waste tracking
router.get('/waste-analysis', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let where = "wo.status != 'cancelled'";
    const p = [];
    if (date_from) { where += ' AND wo.created_at >= ?'; p.push(date_from); }
    if (date_to) { where += ' AND wo.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    const rows = db.prepare(`
      SELECT wo.wo_number, wo.id as wo_id, m.model_code, m.model_name,
        COALESCE(SUM(wfb.waste_meters),0) as waste_meters,
        COALESCE(SUM(wfb.waste_cost),0) as waste_cost,
        COALESCE(SUM(wfb.planned_total_meters),0) as planned_meters,
        COALESCE(SUM(wfb.actual_total_meters),0) as actual_meters,
        CASE WHEN SUM(wfb.actual_total_meters)>0 THEN ROUND(SUM(wfb.waste_meters)*100.0/SUM(wfb.actual_total_meters),2) ELSE 0 END as waste_pct
      FROM wo_fabric_batches wfb
      JOIN work_orders wo ON wo.id=wfb.wo_id
      LEFT JOIN models m ON m.id=wo.model_id
      WHERE ${where}
      GROUP BY wfb.wo_id
      HAVING waste_meters>0
      ORDER BY waste_cost DESC
    `).all(...p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/cost-variance — planned vs actual
router.get('/cost-variance', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let where = "wo.status NOT IN ('cancelled','draft')";
    const p = [];
    if (date_from) { where += ' AND wo.created_at >= ?'; p.push(date_from); }
    if (date_to) { where += ' AND wo.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    const rows = db.prepare(`
      SELECT wo.id, wo.wo_number, m.model_code, m.model_name, wo.status,
        COALESCE(SUM(wfb.planned_cost),0) as planned_fabric_cost,
        COALESCE(SUM(wfb.actual_cost),0) as actual_fabric_cost,
        COALESCE(SUM(wfb.waste_cost),0) as waste_cost,
        wo.extra_expenses_total,
        cs.total_cost as snapshot_total,
        cs.cost_per_piece as snapshot_cpp
      FROM work_orders wo
      LEFT JOIN models m ON m.id=wo.model_id
      LEFT JOIN wo_fabric_batches wfb ON wfb.wo_id=wo.id
      LEFT JOIN (
        SELECT wo_id, total_cost, cost_per_piece, ROW_NUMBER() OVER (PARTITION BY wo_id ORDER BY snapshot_date DESC) as rn
        FROM cost_snapshots
      ) cs ON cs.wo_id=wo.id AND cs.rn=1
      WHERE ${where}
      GROUP BY wo.id
      ORDER BY wo.created_at DESC
    `).all(...p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/pivot — Dynamic pivot table data
router.get('/pivot', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { source } = req.query; // production, financial, hr, inventory
    let rows = [];
    if (source === 'production') {
      rows = db.prepare(`
        SELECT wo.wo_number, m.model_code, m.model_name, m.category, m.gender, wo.status,
          wo.created_at, wo.target_date,
          (SELECT COALESCE(SUM(qty_s+qty_m+qty_l+qty_xl+qty_2xl+qty_3xl),0) FROM wo_sizes WHERE wo_id=wo.id) as total_pieces,
          cs.total_cost, cs.cost_per_piece, cs.main_fabric_cost, cs.lining_cost, cs.accessories_cost,
          cs.masnaiya, cs.masrouf
        FROM work_orders wo
        LEFT JOIN models m ON m.id=wo.model_id
        LEFT JOIN (
          SELECT wo_id, total_cost, cost_per_piece, main_fabric_cost, lining_cost, accessories_cost, masnaiya, masrouf,
            ROW_NUMBER() OVER (PARTITION BY wo_id ORDER BY snapshot_date DESC) as rn
          FROM cost_snapshots WHERE wo_id IS NOT NULL
        ) cs ON cs.wo_id=wo.id AND cs.rn=1
        WHERE wo.status != 'cancelled'
        ORDER BY wo.created_at DESC
      `).all();
    } else if (source === 'financial') {
      rows = db.prepare(`
        SELECT po.po_number, s.name as supplier_name, s.supplier_type, po.status,
          po.total_amount, po.paid_amount, (po.total_amount - po.paid_amount) as balance,
          po.order_date, po.delivery_date,
          (SELECT COUNT(*) FROM purchase_order_items WHERE po_id=po.id) as item_count
        FROM purchase_orders po
        LEFT JOIN suppliers s ON s.id=po.supplier_id
        WHERE po.status != 'cancelled'
        ORDER BY po.order_date DESC
      `).all();
    } else if (source === 'hr') {
      rows = db.prepare(`
        SELECT e.emp_code, e.full_name, e.department, e.job_title, e.salary_type,
          e.base_salary, e.employment_type, e.hire_date, e.status,
          (SELECT COUNT(*) FROM attendance a WHERE a.employee_id=e.id AND a.attendance_status='present') as present_days,
          (SELECT COUNT(*) FROM attendance a WHERE a.employee_id=e.id AND a.attendance_status='absent') as absent_days,
          (SELECT COALESCE(SUM(a.overtime_hours),0) FROM attendance a WHERE a.employee_id=e.id) as total_overtime,
          (SELECT pr.net_pay FROM payroll_records pr JOIN payroll_periods pp ON pp.id=pr.period_id WHERE pr.employee_id=e.id ORDER BY pp.period_month DESC LIMIT 1) as last_net_salary
        FROM employees e
        WHERE e.status != 'terminated'
        ORDER BY e.emp_code
      `).all();
    } else if (source === 'inventory') {
      rows = db.prepare(`
        SELECT f.code, f.name, f.fabric_type, f.color, f.supplier,
          f.price_per_m, f.available_meters, f.low_stock_threshold as min_stock,
          CASE WHEN f.available_meters < f.low_stock_threshold THEN 'low' ELSE 'ok' END as stock_status,
          (f.available_meters * f.price_per_m) as stock_value
        FROM fabrics f WHERE f.status='active'
        UNION ALL
        SELECT a.code, a.name, a.acc_type as fabric_type, '' as color, a.supplier,
          a.unit_price as price_per_m, a.quantity_on_hand as available_meters, a.low_stock_threshold as min_stock,
          CASE WHEN a.quantity_on_hand < a.low_stock_threshold THEN 'low' ELSE 'ok' END as stock_status,
          (a.quantity_on_hand * a.unit_price) as stock_value
        FROM accessories a WHERE a.status='active'
        ORDER BY name
      `).all();
    } else {
      return res.status(400).json({ error: 'مصدر غير صالح. استخدم: production, financial, hr, inventory' });
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/hr-summary — HR KPI overview
router.get('/hr-summary', requirePermission('reports', 'view'), (req, res) => {
  try {
    const totalEmployees = db.prepare("SELECT COUNT(*) as c FROM employees WHERE status='active'").get().c;
    const totalPayroll = db.prepare(`
      SELECT COALESCE(SUM(pr.net_pay),0) as total FROM payroll_records pr
      JOIN payroll_periods pp ON pp.id=pr.period_id
      WHERE pp.period_month = strftime('%Y-%m','now')
    `).get().total;
    const avgSalary = db.prepare("SELECT COALESCE(AVG(base_salary),0) as v FROM employees WHERE status='active'").get().v;
    const deptBreakdown = db.prepare(`
      SELECT COALESCE(department,'بدون قسم') as department, COUNT(*) as count,
        SUM(base_salary) as total_salary
      FROM employees WHERE status='active'
      GROUP BY department ORDER BY count DESC
    `).all();
    const typeBreakdown = db.prepare(`
      SELECT salary_type, COUNT(*) as count FROM employees WHERE status='active'
      GROUP BY salary_type
    `).all();

    res.json({
      total_employees: totalEmployees,
      total_payroll: Math.round(totalPayroll * 100) / 100,
      avg_salary: Math.round(avgSalary * 100) / 100,
      dept_breakdown: deptBreakdown,
      type_breakdown: typeBreakdown,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// V8 — Enhanced production-by-stage with WO details
// ═══════════════════════════════════════════════
router.get('/production-by-stage-detail', requirePermission('reports', 'view'), (req, res) => {
  try {
    const stages = db.prepare(`
      SELECT ws.stage_name, st.color,
        COUNT(DISTINCT ws.wo_id) as wo_count,
        COALESCE(SUM(ws.quantity_in_stage),0) as total_in_stage,
        COALESCE(SUM(ws.quantity_completed),0) as total_completed,
        COALESCE(SUM(ws.quantity_rejected),0) as total_rejected
      FROM wo_stages ws
      INNER JOIN work_orders wo ON wo.id=ws.wo_id AND wo.status IN ('in_progress','pending','draft')
      LEFT JOIN stage_templates st ON st.name=ws.stage_name
      GROUP BY ws.stage_name
      ORDER BY MIN(ws.sort_order)
    `).all();

    for (const stage of stages) { stage.work_orders = []; }
    const stageMap = Object.fromEntries(stages.map(s => [s.stage_name, s]));

    const allStageWOs = db.prepare(`
      SELECT ws.stage_name, wo.id, wo.wo_number, m.model_name, m.model_code,
        ws.quantity_in_stage, ws.quantity_completed, ws.quantity_rejected, ws.status as stage_status
      FROM wo_stages ws
      JOIN work_orders wo ON wo.id=ws.wo_id AND wo.status IN ('in_progress','pending','draft')
      LEFT JOIN models m ON m.id=wo.model_id
      WHERE ws.quantity_in_stage > 0 OR ws.status='in_progress'
      ORDER BY wo.wo_number
    `).all();
    for (const row of allStageWOs) {
      if (stageMap[row.stage_name]) stageMap[row.stage_name].work_orders.push(row);
    }

    res.json(stages);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// V8 — Production by model
router.get('/production-by-model', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { search } = req.query;
    let where = "wo.status != 'cancelled'";
    const p = [];
    if (search) { where += " AND (m.model_code LIKE ? OR m.model_name LIKE ?)"; p.push(`%${search}%`, `%${search}%`); }

    const rows = db.prepare(`
      SELECT m.id as model_id, m.model_code, m.model_name, m.category,
        COUNT(wo.id) as wo_count,
        COALESCE(SUM(wo.quantity),0) as total_pieces,
        COALESCE(SUM(wo.pieces_completed),0) as total_completed,
        COALESCE(SUM(CASE WHEN wo.status='in_progress' THEN 1 ELSE 0 END),0) as in_progress_count,
        COALESCE(AVG(wo.actual_cost_per_piece),0) as avg_cost_per_piece,
        MAX(wo.created_at) as last_wo_date,
        GROUP_CONCAT(DISTINCT wo.wo_number) as wo_numbers
      FROM work_orders wo
      JOIN models m ON m.id=wo.model_id
      WHERE ${where}
      GROUP BY m.id
      ORDER BY last_wo_date DESC
    `).all(...p);

    // For each model, get fabric usage
    for (const row of rows) {
      row.fabric_usage = db.prepare(`
        SELECT DISTINCT f.code as fabric_code, f.name as fabric_name, f.fabric_type
        FROM wo_fabrics wf
        JOIN work_orders wo ON wo.id=wf.wo_id AND wo.model_id=?
        JOIN fabrics f ON f.code=wf.fabric_code
        UNION
        SELECT DISTINCT f.code, f.name, f.fabric_type
        FROM wo_fabric_batches wfb
        JOIN work_orders wo ON wo.id=wfb.wo_id AND wo.model_id=?
        JOIN fabrics f ON f.code=wfb.fabric_code
      `).all(row.model_id, row.model_id);
    }

    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// V8 — Fabric consumption by supplier (aggregated)
router.get('/fabric-consumption-by-supplier', requirePermission('reports', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT s.id as supplier_id, s.name as supplier_name,
        COUNT(DISTINCT poi.id) as item_count,
        COALESCE(SUM(poi.received_qty_actual), 0) as total_meters,
        COALESCE(SUM(poi.received_qty_actual * poi.unit_price), 0) as total_cost
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id=poi.po_id AND po.status != 'cancelled'
      JOIN suppliers s ON s.id=po.supplier_id
      WHERE poi.item_type='fabric'
      GROUP BY s.id
      ORDER BY total_cost DESC
    `).all();

    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/customer-summary — revenue + balance per customer
router.get('/customer-summary', requirePermission('reports', 'view'), (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT c.id, c.code, c.name, c.phone, c.city, c.credit_limit, c.balance, c.status,
        (SELECT COUNT(*) FROM invoices i WHERE i.customer_id=c.id) as invoice_count,
        (SELECT COALESCE(SUM(i.total),0) FROM invoices i WHERE i.customer_id=c.id) as total_revenue,
        (SELECT COALESCE(SUM(i.total),0) FROM invoices i WHERE i.customer_id=c.id AND i.status NOT IN ('cancelled','paid')) as outstanding,
        (SELECT COUNT(*) FROM work_orders wo WHERE wo.customer_id=c.id) as wo_count,
        (SELECT COUNT(*) FROM work_orders wo WHERE wo.customer_id=c.id AND wo.status IN ('pending','in_progress')) as active_wos
      FROM customers c WHERE c.status='active' ORDER BY total_revenue DESC
    `).all();
    const totals = {
      total_customers: customers.length,
      total_revenue: Math.round(customers.reduce((s, c) => s + c.total_revenue, 0) * 100) / 100,
      total_outstanding: Math.round(customers.reduce((s, c) => s + c.outstanding, 0) * 100) / 100,
    };
    res.json({ customers, totals });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/inventory-status — fabric + accessory stock overview
router.get('/inventory-status', requirePermission('reports', 'view'), (req, res) => {
  try {
    const threshold = parseFloat(db.prepare("SELECT value FROM settings WHERE key='low_stock_threshold'").get()?.value) || 20;

    const fabrics = db.prepare(`
      SELECT f.id, f.code, f.name, f.color, f.available_meters, f.low_stock_threshold,
        CASE WHEN COALESCE(f.available_meters,0) <= COALESCE(f.low_stock_threshold,?) THEN 1 ELSE 0 END as is_low_stock,
        (SELECT COUNT(*) FROM fabric_inventory_batches b WHERE b.fabric_code=f.code AND b.batch_status='available') as available_batches,
        (SELECT COALESCE(SUM(b.received_meters - b.used_meters - b.wasted_meters),0) FROM fabric_inventory_batches b WHERE b.fabric_code=f.code AND b.batch_status='available') as batch_available_meters
      FROM fabrics f WHERE f.status='active' ORDER BY is_low_stock DESC, f.name
    `).all(threshold);

    const accessories = db.prepare(`
      SELECT a.id, a.code, a.name, a.acc_type, a.quantity_on_hand, a.low_stock_threshold, a.reorder_qty, a.unit,
        CASE WHEN COALESCE(a.quantity_on_hand,0) <= COALESCE(a.low_stock_threshold,?) THEN 1 ELSE 0 END as is_low_stock
      FROM accessories a WHERE a.status='active' ORDER BY is_low_stock DESC, a.name
    `).all(threshold);

    res.json({
      fabrics,
      accessories,
      low_stock_fabrics: fabrics.filter(f => f.is_low_stock).length,
      low_stock_accessories: accessories.filter(a => a.is_low_stock).length,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/quality — quality & rejection report
router.get('/quality', requirePermission('reports', 'view'), (req, res) => {
  try {
    // Per-stage rejection rates
    const stageQuality = db.prepare(`
      SELECT ws.stage_name,
        COUNT(DISTINCT ws.wo_id) as wo_count,
        SUM(ws.quantity_completed) as total_passed,
        SUM(ws.quantity_rejected) as total_rejected,
        CASE WHEN (SUM(ws.quantity_completed) + SUM(ws.quantity_rejected)) > 0
          THEN ROUND(CAST(SUM(ws.quantity_completed) AS FLOAT) / (SUM(ws.quantity_completed) + SUM(ws.quantity_rejected)) * 100, 1)
          ELSE 100 END as pass_rate
      FROM wo_stages ws
      GROUP BY ws.stage_name
      ORDER BY total_rejected DESC
    `).all();

    // Recent rejections with reasons
    const recentRejections = db.prepare(`
      SELECT sml.*, wo.wo_number, m.model_name
      FROM stage_movement_log sml
      LEFT JOIN work_orders wo ON wo.id = sml.wo_id
      LEFT JOIN models m ON m.id = wo.model_id
      WHERE sml.qty_rejected > 0
      ORDER BY sml.moved_at DESC LIMIT 50
    `).all();

    // Overall stats — final stage only (highest sort_order per WO)
    const overall = db.prepare(`
      SELECT COALESCE(SUM(fs.quantity_completed),0) as total_passed,
        COALESCE(SUM(fs.quantity_rejected),0) as total_rejected
      FROM wo_stages fs
      INNER JOIN (
        SELECT wo_id, MAX(sort_order) as max_order FROM wo_stages GROUP BY wo_id
      ) last ON last.wo_id = fs.wo_id AND fs.sort_order = last.max_order
    `).get();

    const overallRate = (overall.total_passed + overall.total_rejected) > 0
      ? Math.round((overall.total_passed / (overall.total_passed + overall.total_rejected)) * 10000) / 100
      : 100;

    // QC checkpoints
    const qcCheckpoints = db.prepare(`
      SELECT qc.*, ws.stage_name, wo.wo_number
      FROM wo_stage_qc qc
      LEFT JOIN wo_stages ws ON ws.id = qc.stage_id
      LEFT JOIN work_orders wo ON wo.id = qc.wo_id
      ORDER BY qc.checked_at DESC LIMIT 50
    `).all();

    res.json({
      stage_quality: stageQuality,
      recent_rejections: recentRejections,
      overall_pass_rate: overallRate,
      total_passed: overall.total_passed,
      total_rejected: overall.total_rejected,
      qc_checkpoints: qcCheckpoints,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/machines — machine utilization report
router.get('/machines', requirePermission('reports', 'view'), (req, res) => {
  try {
    const machines = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM wo_stages ws WHERE ws.machine_id = m.id) as total_stages,
        (SELECT COUNT(*) FROM wo_stages ws WHERE ws.machine_id = m.id AND ws.status = 'in_progress') as active_stages,
        (SELECT COALESCE(SUM(ws.actual_hours), 0) FROM wo_stages ws WHERE ws.machine_id = m.id) as total_hours,
        (SELECT COALESCE(SUM(ws.quantity_completed), 0) FROM wo_stages ws WHERE ws.machine_id = m.id) as total_pieces
      FROM machines m
      ORDER BY total_hours DESC
    `).all();

    res.json({ machines });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/ar-aging — accounts receivable aging
router.get('/ar-aging', requirePermission('reports', 'view'), (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT i.id, i.invoice_number, i.customer_name, i.total, i.status, i.due_date, i.created_at,
        COALESCE(cp.total_paid, 0) as paid_amount,
        (i.total - COALESCE(cp.total_paid, 0)) as outstanding
      FROM invoices i
      LEFT JOIN (SELECT invoice_id, SUM(amount) as total_paid FROM customer_payments GROUP BY invoice_id) cp ON cp.invoice_id=i.id
      WHERE i.status NOT IN ('cancelled','paid') AND (i.total - COALESCE(cp.total_paid, 0)) > 0
      ORDER BY i.due_date ASC
    `).all();

    const now = new Date();
    // Get aging bucket thresholds from settings (default: 30, 60, 90)
    const agingBucket1 = parseInt(db.prepare("SELECT value FROM settings WHERE key='aging_bucket_1'").get()?.value) || 30;
    const agingBucket2 = parseInt(db.prepare("SELECT value FROM settings WHERE key='aging_bucket_2'").get()?.value) || 60;
    const agingBucket3 = parseInt(db.prepare("SELECT value FROM settings WHERE key='aging_bucket_3'").get()?.value) || 90;
    
    const buckets = { current: [], days_30: [], days_60: [], days_90: [], over_90: [] };
    let totals = { current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0, grand_total: 0 };

    for (const inv of invoices) {
      const due = inv.due_date ? new Date(inv.due_date) : new Date(inv.created_at);
      const daysOverdue = Math.max(0, Math.floor((now - due) / 86400000));
      inv.days_overdue = daysOverdue;

      if (daysOverdue <= 0) { buckets.current.push(inv); totals.current += inv.outstanding; }
      else if (daysOverdue <= agingBucket1) { buckets.days_30.push(inv); totals.days_30 += inv.outstanding; }
      else if (daysOverdue <= agingBucket2) { buckets.days_60.push(inv); totals.days_60 += inv.outstanding; }
      else if (daysOverdue <= agingBucket3) { buckets.days_90.push(inv); totals.days_90 += inv.outstanding; }
      else { buckets.over_90.push(inv); totals.over_90 += inv.outstanding; }
      totals.grand_total += inv.outstanding;
    }

    res.json({ buckets, totals, total_invoices: invoices.length, aging_thresholds: { bucket_1: agingBucket1, bucket_2: agingBucket2, bucket_3: agingBucket3 } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/inventory-valuation — fabric + accessory stock with monetary values
router.get('/inventory-valuation', requirePermission('reports', 'view'), (req, res) => {
  try {
    const fabrics = db.prepare(`
      SELECT f.code, f.name, f.color, f.price_per_m as unit_price,
        COALESCE(f.available_meters, 0) AS qty,
        COALESCE(f.available_meters, 0) * COALESCE(f.price_per_m, 0) AS value
      FROM fabrics f WHERE f.status='active' ORDER BY value DESC
    `).all();

    const accessories = db.prepare(`
      SELECT a.code, a.name, a.acc_type, a.unit_price,
        COALESCE(a.quantity_on_hand, 0) AS qty,
        COALESCE(a.quantity_on_hand, 0) * COALESCE(a.unit_price, 0) AS value
      FROM accessories a WHERE a.status='active' ORDER BY value DESC
    `).all();

    const fabricTotal = fabrics.reduce((s, f) => s + f.value, 0);
    const accessoryTotal = accessories.reduce((s, a) => s + a.value, 0);

    res.json({
      fabrics, accessories,
      fabric_total: fabricTotal,
      accessory_total: accessoryTotal,
      grand_total: fabricTotal + accessoryTotal,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/machine-utilization — machine usage statistics
router.get('/machine-utilization', requirePermission('reports', 'view'), (req, res) => {
  try {
    const machines = db.prepare(`SELECT m.*, 
      (SELECT COUNT(*) FROM maintenance_orders mo WHERE mo.machine_id=m.id AND mo.is_deleted=0) as total_maintenance,
      (SELECT COUNT(*) FROM maintenance_orders mo WHERE mo.machine_id=m.id AND mo.is_deleted=0 AND mo.status='completed') as completed_maintenance,
      (SELECT COALESCE(SUM(cost),0) FROM maintenance_orders mo WHERE mo.machine_id=m.id AND mo.is_deleted=0) as maintenance_cost
      FROM machines m WHERE m.status='active' ORDER BY maintenance_cost DESC`).all();
    const totalMachines = machines.length;
    const totalMaintenanceCost = machines.reduce((s, m) => s + (m.maintenance_cost || 0), 0);
    const avgMaintenancePerMachine = totalMachines ? Math.round(totalMaintenanceCost / totalMachines * 100) / 100 : 0;
    const needsMaintenance = machines.filter(m => m.next_maintenance_date && m.next_maintenance_date <= new Date().toISOString().slice(0, 10)).length;
    res.json({ machines, summary: { total_machines: totalMachines, total_maintenance_cost: totalMaintenanceCost, avg_maintenance_per_machine: avgMaintenancePerMachine, needs_maintenance: needsMaintenance } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/maintenance-cost — maintenance cost analysis
router.get('/maintenance-cost', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let q = `SELECT mo.*, m.name as machine_name, m.machine_type, u.full_name as created_by_name
      FROM maintenance_orders mo LEFT JOIN machines m ON m.id=mo.machine_id LEFT JOIN users u ON u.id=mo.created_by WHERE mo.is_deleted=0`;
    const p = [];
    if (date_from) { q += ' AND mo.created_at >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND mo.created_at <= ?'; p.push(date_to + 'T23:59:59'); }
    q += ' ORDER BY mo.cost DESC';
    const orders = db.prepare(q).all(...p);
    const byType = {};
    for (const o of orders) {
      const t = o.maintenance_type || 'other';
      if (!byType[t]) byType[t] = { count: 0, cost: 0 };
      byType[t].count++;
      byType[t].cost += o.cost || 0;
    }
    const byPriority = {};
    for (const o of orders) {
      const pr = o.priority || 'medium';
      if (!byPriority[pr]) byPriority[pr] = { count: 0, cost: 0 };
      byPriority[pr].count++;
      byPriority[pr].cost += o.cost || 0;
    }
    const totalCost = orders.reduce((s, o) => s + (o.cost || 0), 0);
    res.json({ orders, by_type: byType, by_priority: byPriority, total_cost: totalCost, total_orders: orders.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/expense-analysis — expense breakdown
router.get('/expense-analysis', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let q = `SELECT e.*, u.full_name as created_by_name FROM expenses e LEFT JOIN users u ON u.id=e.created_by WHERE e.is_deleted=0`;
    const p = [];
    if (date_from) { q += ' AND e.expense_date >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND e.expense_date <= ?'; p.push(date_to); }
    q += ' ORDER BY e.expense_date DESC';
    const expenses = db.prepare(q).all(...p);
    const byCategory = {};
    for (const e of expenses) {
      const cat = e.expense_type || 'other';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, amount: 0 };
      byCategory[cat].count++;
      byCategory[cat].amount += e.amount || 0;
    }
    const byStatus = {};
    for (const e of expenses) {
      const st = e.status || 'pending';
      if (!byStatus[st]) byStatus[st] = { count: 0, amount: 0 };
      byStatus[st].count++;
      byStatus[st].amount += e.amount || 0;
    }
    const monthlyData = {};
    for (const e of expenses) {
      const m = (e.expense_date || '').slice(0, 7);
      if (!monthlyData[m]) monthlyData[m] = { count: 0, amount: 0 };
      monthlyData[m].count++;
      monthlyData[m].amount += e.amount || 0;
    }
    const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    res.json({ expenses, by_category: byCategory, by_status: byStatus, monthly: monthlyData, total_amount: totalAmount, total_expenses: expenses.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/financial/pl — Profit & Loss report
router.get('/financial/pl', requirePermission('reports', 'view'), (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const yearStr = String(year);
    const months = [];

    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const monthStart = `${yearStr}-${mm}-01`;
      const monthEnd = m < 12 ? `${yearStr}-${String(m + 1).padStart(2, '0')}-01` : `${year + 1}-01-01`;

      // Revenue: paid invoices
      const revenue = db.prepare(
        `SELECT COALESCE(SUM(total), 0) as total FROM invoices
         WHERE status = 'paid' AND created_at >= ? AND created_at < ?`
      ).get(monthStart, monthEnd).total;

      // Cost of goods: PO amounts received
      const materialCost = db.prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders
         WHERE status NOT IN ('cancelled','draft') AND order_date >= ? AND order_date < ?`
      ).get(monthStart, monthEnd).total;

      // Operating expenses
      const opex = db.prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
         WHERE is_deleted = 0 AND status != 'rejected' AND expense_date >= ? AND expense_date < ?`
      ).get(monthStart, monthEnd).total;

      // Maintenance costs
      const maintenance = db.prepare(
        `SELECT COALESCE(SUM(cost), 0) as total FROM maintenance_orders
         WHERE status = 'completed' AND completed_date >= ? AND completed_date < ?`
      ).get(monthStart, monthEnd).total;

      const totalCost = materialCost + opex + maintenance;
      const profit = revenue - totalCost;

      months.push({
        month: m,
        label: `${yearStr}-${mm}`,
        revenue: Math.round(revenue * 100) / 100,
        material_cost: Math.round(materialCost * 100) / 100,
        operating_expenses: Math.round(opex * 100) / 100,
        maintenance_cost: Math.round(maintenance * 100) / 100,
        total_cost: Math.round(totalCost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin_pct: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
      });
    }

    const totals = months.reduce((acc, m) => ({
      revenue: acc.revenue + m.revenue,
      material_cost: acc.material_cost + m.material_cost,
      operating_expenses: acc.operating_expenses + m.operating_expenses,
      maintenance_cost: acc.maintenance_cost + m.maintenance_cost,
      total_cost: acc.total_cost + m.total_cost,
      profit: acc.profit + m.profit,
    }), { revenue: 0, material_cost: 0, operating_expenses: 0, maintenance_cost: 0, total_cost: 0, profit: 0 });
    totals.margin_pct = totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 10000) / 100 : 0;

    res.json({ year, months, totals });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/production/efficiency — Production efficiency metrics
router.get('/production/efficiency', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let dateFilter = '';
    const p = [];
    if (date_from) { dateFilter += ' AND wo.start_date >= ?'; p.push(date_from); }
    if (date_to) { dateFilter += ' AND wo.start_date <= ?'; p.push(date_to); }

    // Per-WO efficiency
    const wos = db.prepare(`
      SELECT wo.id, wo.wo_number, wo.status, wo.start_date, wo.completed_date,
        m.model_code, m.model_name,
        (SELECT COALESCE(SUM(qty_s+qty_m+qty_l+qty_xl+qty_2xl+qty_3xl),0) FROM wo_sizes WHERE wo_id=wo.id) as total_pieces,
        (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id) as total_stages,
        (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id AND status='completed') as completed_stages,
        (SELECT COALESCE(SUM(quantity_done),0) FROM wo_stages WHERE wo_id=wo.id AND status='completed') as pieces_completed
      FROM work_orders wo
      LEFT JOIN models m ON m.id = wo.model_id
      WHERE wo.status IN ('in_progress','completed') ${dateFilter}
      ORDER BY wo.start_date DESC
    `).all(...p);

    const efficiency = wos.map(wo => {
      const stagePct = wo.total_stages > 0 ? Math.round((wo.completed_stages / wo.total_stages) * 100) : 0;
      let daysElapsed = null;
      if (wo.start_date) {
        const end = wo.completed_date || new Date().toISOString().slice(0, 10);
        daysElapsed = Math.max(1, Math.ceil((new Date(end) - new Date(wo.start_date)) / 86400000));
      }
      const piecesPerDay = daysElapsed && wo.pieces_completed > 0 ? Math.round((wo.pieces_completed / daysElapsed) * 10) / 10 : 0;
      return {
        wo_number: wo.wo_number,
        model_code: wo.model_code,
        model_name: wo.model_name,
        status: wo.status,
        total_pieces: wo.total_pieces,
        pieces_completed: wo.pieces_completed,
        completion_pct: wo.total_pieces > 0 ? Math.round((wo.pieces_completed / wo.total_pieces) * 100) : 0,
        stage_progress_pct: stagePct,
        days_elapsed: daysElapsed,
        pieces_per_day: piecesPerDay,
      };
    });

    // Aggregate stats
    const totalPieces = efficiency.reduce((s, e) => s + e.total_pieces, 0);
    const totalCompleted = efficiency.reduce((s, e) => s + e.pieces_completed, 0);
    const avgPiecesPerDay = efficiency.filter(e => e.pieces_per_day > 0).length > 0
      ? Math.round(efficiency.filter(e => e.pieces_per_day > 0).reduce((s, e) => s + e.pieces_per_day, 0) / efficiency.filter(e => e.pieces_per_day > 0).length * 10) / 10
      : 0;
    const completedWos = efficiency.filter(e => e.status === 'completed').length;

    res.json({
      work_orders: efficiency,
      summary: {
        total_work_orders: efficiency.length,
        completed_work_orders: completedWos,
        total_pieces_planned: totalPieces,
        total_pieces_completed: totalCompleted,
        overall_completion_pct: totalPieces > 0 ? Math.round((totalCompleted / totalPieces) * 100) : 0,
        avg_pieces_per_day: avgPiecesPerDay,
      }
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/cash-flow — monthly inflows vs outflows
router.get('/cash-flow', requirePermission('reports', 'view'), (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const data = [];
    for (let i = months - 1; i >= 0; i--) {
      const { sd, ed } = db.prepare(`SELECT date('now','start of month','-' || ? || ' months') as sd, date('now','start of month','-' || ? || ' months') as ed`).get(i, i - 1);

      const inflows = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM customer_payments WHERE payment_date >= ? AND payment_date < ?`).get(sd, ed).v;
      const poPayments = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM supplier_payments WHERE payment_date >= ? AND payment_date < ?`).get(sd, ed).v;
      const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE is_deleted=0 AND status!='rejected' AND expense_date >= ? AND expense_date < ?`).get(sd, ed).v;
      let payroll = 0;
      try { payroll = db.prepare(`SELECT COALESCE(SUM(pr.net_pay),0) as v FROM payroll_records pr JOIN payroll_periods pp ON pp.id=pr.period_id WHERE pp.period_month >= strftime('%Y-%m',?) AND pp.period_month < strftime('%Y-%m',?)`).get(sd, ed).v; } catch {}

      const label = sd.slice(0, 7);
      data.push({
        month: label,
        inflows: Math.round(inflows * 100) / 100,
        outflows: Math.round((poPayments + expenses + payroll) * 100) / 100,
        net: Math.round((inflows - poPayments - expenses - payroll) * 100) / 100,
      });
    }
    res.json({ months: data });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/tax-summary — VAT collected vs paid
router.get('/tax-summary', requirePermission('reports', 'view'), (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const vatSetting = db.prepare("SELECT value FROM settings WHERE key='tax_rate'").get();
    const taxRate = parseFloat(vatSetting?.value) || 14;
    const vr = taxRate / 100;
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const ms = `${year}-${mm}-01`;
      const me = m < 12 ? `${year}-${String(m + 1).padStart(2, '0')}-01` : `${year + 1}-01-01`;
      const collected = db.prepare(`SELECT COALESCE(SUM(total - subtotal),0) as v FROM invoices WHERE status IN ('paid','partial','sent') AND created_at >= ? AND created_at < ?`).get(ms, me).v;
      const paid = db.prepare(`SELECT COALESCE(SUM(total_amount * ? / (1 + ?)),0) as v FROM purchase_orders WHERE status NOT IN ('cancelled','draft') AND order_date >= ? AND order_date < ?`).get(vr, vr, ms, me).v;
      months.push({ month: `${year}-${mm}`, vat_collected: Math.round(collected * 100) / 100, vat_paid: Math.round(paid * 100) / 100, net_vat: Math.round((collected - paid) * 100) / 100 });
    }
    const totals = months.reduce((a, m) => ({ vat_collected: a.vat_collected + m.vat_collected, vat_paid: a.vat_paid + m.vat_paid, net_vat: a.net_vat + m.net_vat }), { vat_collected: 0, vat_paid: 0, net_vat: 0 });
    res.json({ year, months, summary: { total_output_vat: totals.vat_collected, total_input_vat: totals.vat_paid, net_vat: totals.net_vat, tax_rate: taxRate } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/ap-aging — accounts payable aging by supplier
router.get('/ap-aging', requirePermission('reports', 'view'), (req, res) => {
  try {
    // Get aging bucket thresholds from settings (default: 30, 60, 90)
    const agingBucket1 = parseInt(db.prepare("SELECT value FROM settings WHERE key='aging_bucket_1'").get()?.value) || 30;
    const agingBucket2 = parseInt(db.prepare("SELECT value FROM settings WHERE key='aging_bucket_2'").get()?.value) || 60;
    const agingBucket3 = parseInt(db.prepare("SELECT value FROM settings WHERE key='aging_bucket_3'").get()?.value) || 90;
    
    const pos = db.prepare(`SELECT po.*, s.name as supplier_name, s.code as supplier_code
      FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id
      WHERE po.status NOT IN ('cancelled','draft','received') AND po.total_amount > po.paid_amount`).all();
    const today = new Date();
    const buckets = pos.map(po => {
      const due = po.expected_date ? new Date(po.expected_date) : new Date(po.order_date);
      const days = Math.floor((today - due) / 86400000);
      const outstanding = (po.total_amount || 0) - (po.paid_amount || 0);
      return { po_number: po.po_number, supplier_name: po.supplier_name, supplier_code: po.supplier_code, total: po.total_amount, paid: po.paid_amount, outstanding, expected_date: po.expected_date, days_overdue: Math.max(0, days), bucket: days <= 0 ? 'current' : days <= agingBucket1 ? '1-30' : days <= agingBucket2 ? '31-60' : days <= agingBucket3 ? '61-90' : '90+' };
    });
    const summary = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    buckets.forEach(b => { summary[b.bucket] += b.outstanding; });
    res.json({ items: buckets, summary, total_outstanding: buckets.reduce((s, b) => s + b.outstanding, 0), aging_thresholds: { bucket_1: agingBucket1, bucket_2: agingBucket2, bucket_3: agingBucket3 } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/employee-productivity — per-employee metrics
router.get('/employee-productivity', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let dateFilter = '';
    const p = [];
    if (date_from) { dateFilter += ' AND a.work_date >= ?'; p.push(date_from); }
    if (date_to) { dateFilter += ' AND a.work_date <= ?'; p.push(date_to); }

    const employees = db.prepare(`SELECT e.id, e.full_name as name, e.emp_code as employee_code, e.department, e.job_title as position,
      (SELECT COUNT(*) FROM attendance a WHERE a.employee_id=e.id AND a.attendance_status='present' ${dateFilter}) as days_present,
      (SELECT COUNT(*) FROM attendance a WHERE a.employee_id=e.id ${dateFilter}) as total_days,
      (SELECT COALESCE(SUM(a.overtime_hours),0) FROM attendance a WHERE a.employee_id=e.id ${dateFilter}) as overtime_hours,
      (SELECT COALESCE(SUM(p2.net_pay),0) FROM payroll_records p2 WHERE p2.employee_id=e.id) as total_salary
      FROM employees e WHERE e.status='active'`).all(...p, ...p, ...p);

    const result = employees.map(emp => ({
      ...emp,
      attendance_rate: emp.total_days > 0 ? Math.round((emp.days_present / emp.total_days) * 100) : 0,
    }));
    res.json({ employees: result });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/barcode-activity — recent barcode scan activity (from audit_log)
router.get('/barcode-activity', requirePermission('reports', 'view'), (req, res) => {
  try {
    const defaultReportLimit = parseInt(db.prepare("SELECT value FROM settings WHERE key='report_default_limit'").get()?.value) || 100;
    const limit = parseInt(req.query.limit) || defaultReportLimit;
    const scans = db.prepare(`SELECT al.*, u.full_name as user_name FROM audit_log al LEFT JOIN users u ON u.id=al.user_id
      WHERE al.action LIKE '%barcode%' OR al.action LIKE '%scan%' OR al.entity_type='barcode'
      ORDER BY al.created_at DESC LIMIT ?`).all(limit);
    res.json({ scans, total: scans.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/pl-monthly — monthly P&L (last 12 months)
router.get('/pl-monthly', requirePermission('reports', 'view'), (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const data = [];
    for (let i = 0; i < months; i++) {
      const { sd, ed } = db.prepare(`SELECT date('now','start of month','-' || ? || ' months') as sd, date('now','start of month','-' || ? || ' months') as ed`).get(i, i - 1);
      const monthLabel = sd.slice(0, 7);
      
      const revenue = db.prepare(`SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status='paid' AND created_at >= ? AND created_at < ?`).get(sd, ed)?.v || 0;
      const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE is_deleted=0 AND status='approved' AND expense_date >= ? AND expense_date < ?`).get(sd, ed)?.v || 0;
      const maintenance = db.prepare(`SELECT COALESCE(SUM(cost),0) as v FROM maintenance_orders WHERE is_deleted=0 AND status='completed' AND completed_date >= ? AND completed_date < ?`).get(sd, ed)?.v || 0;
      let payroll = 0;
      try { payroll = db.prepare(`SELECT COALESCE(SUM(pr.net_pay),0) as v FROM payroll_records pr JOIN payroll_periods pp ON pp.id=pr.period_id WHERE pp.period_month >= strftime('%Y-%m',?) AND pp.period_month < strftime('%Y-%m',?)`).get(sd, ed)?.v || 0; } catch {}
      
      const totalCost = expenses + maintenance + payroll;
      data.push({ month: monthLabel, revenue, expenses, maintenance, payroll, total_cost: totalCost, net_profit: revenue - totalCost });
    }
    res.json({ months: data.reverse() });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/pl-detail — detailed P&L with category breakdown
router.get('/pl-detail', requirePermission('reports', 'view'), (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || `${new Date().getFullYear()}-01-01`;
    const to = date_to || new Date().toISOString().slice(0, 10);
    
    // Revenue breakdown by customer
    const revenueByCustomer = db.prepare(`SELECT customer_name, COALESCE(SUM(total),0) as total FROM invoices WHERE status='paid' AND created_at >= ? AND created_at <= ? GROUP BY customer_name ORDER BY total DESC LIMIT 10`).all(from, to);
    const totalRevenue = db.prepare(`SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status='paid' AND created_at >= ? AND created_at <= ?`).get(from, to)?.v || 0;
    
    // Expenses by category
    const expensesByCategory = db.prepare(`SELECT expense_type, COALESCE(SUM(amount),0) as total FROM expenses WHERE is_deleted=0 AND status='approved' AND expense_date >= ? AND expense_date <= ? GROUP BY expense_type ORDER BY total DESC`).all(from, to);
    const totalExpenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE is_deleted=0 AND status='approved' AND expense_date >= ? AND expense_date <= ?`).get(from, to)?.v || 0;
    
    // Maintenance costs
    const maintenanceCost = db.prepare(`SELECT COALESCE(SUM(cost),0) as v FROM maintenance_orders WHERE is_deleted=0 AND status='completed' AND completed_date >= ? AND completed_date <= ?`).get(from, to)?.v || 0;
    
    // Payroll cost
    let payrollCost = 0;
    try { payrollCost = db.prepare(`SELECT COALESCE(SUM(pr.net_pay),0) as v FROM payroll_records pr JOIN payroll_periods pp ON pp.id=pr.period_id WHERE pp.period_month >= strftime('%Y-%m',?) AND pp.period_month <= strftime('%Y-%m',?)`).get(from, to)?.v || 0; } catch {}
    
    const totalCost = totalExpenses + maintenanceCost + payrollCost;
    
    res.json({
      date_range: { from, to },
      revenue: { total: totalRevenue, by_customer: revenueByCustomer },
      expenses: { total: totalExpenses, by_category: expensesByCategory },
      maintenance_cost: maintenanceCost,
      payroll_cost: payrollCost,
      total_cost: totalCost,
      net_profit: totalRevenue - totalCost,
      profit_margin: totalRevenue > 0 ? Math.round((totalRevenue - totalCost) / totalRevenue * 10000) / 100 : 0
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/quality-by-model — rejection/rework rate per model
router.get('/quality-by-model', requirePermission('reports', 'view'), (req, res) => {
  try {
    const models = db.prepare(`
      SELECT m.model_code, m.model_name, m.category,
        COUNT(DISTINCT wo.id) as total_wo,
        COALESCE(SUM(ws.quantity_completed),0) as qty_completed,
        COALESCE(SUM(ws.quantity_rejected),0) as qty_rejected,
        CASE WHEN COALESCE(SUM(ws.quantity_completed),0) + COALESCE(SUM(ws.quantity_rejected),0) > 0
          THEN ROUND(CAST(COALESCE(SUM(ws.quantity_rejected),0) AS REAL) / (COALESCE(SUM(ws.quantity_completed),0) + COALESCE(SUM(ws.quantity_rejected),0)) * 100, 2)
          ELSE 0 END as rejection_rate,
        CASE WHEN COALESCE(SUM(ws.quantity_completed),0) + COALESCE(SUM(ws.quantity_rejected),0) > 0
          THEN ROUND(CAST(COALESCE(SUM(ws.quantity_completed),0) AS REAL) / (COALESCE(SUM(ws.quantity_completed),0) + COALESCE(SUM(ws.quantity_rejected),0)) * 100, 2)
          ELSE 100 END as quality_score
      FROM models m
      LEFT JOIN work_orders wo ON wo.model_id = m.id
      LEFT JOIN wo_stages ws ON ws.wo_id = wo.id
      WHERE m.status = 'active'
      GROUP BY m.id
      ORDER BY rejection_rate DESC
    `).all();
    
    // By stage breakdown
    const byStage = db.prepare(`
      SELECT ws.stage_name,
        COALESCE(SUM(ws.quantity_completed),0) as qty_completed,
        COALESCE(SUM(ws.quantity_rejected),0) as qty_rejected,
        CASE WHEN COALESCE(SUM(ws.quantity_completed),0) + COALESCE(SUM(ws.quantity_rejected),0) > 0
          THEN ROUND(CAST(COALESCE(SUM(ws.quantity_rejected),0) AS REAL) / (COALESCE(SUM(ws.quantity_completed),0) + COALESCE(SUM(ws.quantity_rejected),0)) * 100, 2)
          ELSE 0 END as rejection_rate
      FROM wo_stages ws
      GROUP BY ws.stage_name
      ORDER BY rejection_rate DESC
    `).all();
    
    res.json({ by_model: models, by_stage: byStage });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
