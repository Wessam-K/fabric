const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/reports/summary — KPI overview
router.get('/summary', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/work-orders — WO-based production report
router.get('/work-orders', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/by-fabric — fabric usage from work orders
router.get('/by-fabric', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/by-accessory — accessory usage from work orders
router.get('/by-accessory', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/suppliers — supplier spending report
router.get('/suppliers', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/by-model — per-model WO cost breakdown
router.get('/by-model', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/model-detail/:code — full model breakdown
router.get('/model-detail/:code', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports — cost snapshots (paginated)
router.get('/', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/production-by-stage — WIP pipeline
router.get('/production-by-stage', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/fabric-consumption — fabric usage from batches
router.get('/fabric-consumption', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/supplier-fabric — fabric purchased by supplier
router.get('/supplier-fabric', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/waste-analysis — waste tracking
router.get('/waste-analysis', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/cost-variance — planned vs actual
router.get('/cost-variance', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/pivot — Dynamic pivot table data
router.get('/pivot', (req, res) => {
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
          (SELECT COUNT(*) FROM po_items WHERE po_id=po.id) as item_count
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
          (SELECT pr.net_salary FROM payroll_records pr JOIN payroll_periods pp ON pp.id=pr.period_id WHERE pr.employee_id=e.id ORDER BY pp.period_month DESC LIMIT 1) as last_net_salary
        FROM employees e
        WHERE e.status != 'terminated'
        ORDER BY e.emp_code
      `).all();
    } else if (source === 'inventory') {
      rows = db.prepare(`
        SELECT f.code, f.name, f.fabric_type, f.color, f.supplier,
          f.price_per_m, f.available_meters, f.min_stock,
          CASE WHEN f.available_meters < f.min_stock THEN 'low' ELSE 'ok' END as stock_status,
          (f.available_meters * f.price_per_m) as stock_value
        FROM fabrics f WHERE f.status='active'
        UNION ALL
        SELECT a.code, a.name, a.acc_type as fabric_type, '' as color, a.supplier,
          a.unit_price as price_per_m, a.available_quantity as available_meters, a.min_stock,
          CASE WHEN a.available_quantity < a.min_stock THEN 'low' ELSE 'ok' END as stock_status,
          (a.available_quantity * a.unit_price) as stock_value
        FROM accessories a WHERE a.status='active'
        ORDER BY name
      `).all();
    } else {
      return res.status(400).json({ error: 'مصدر غير صالح. استخدم: production, financial, hr, inventory' });
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/hr-summary — HR KPI overview
router.get('/hr-summary', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// V8 — Enhanced production-by-stage with WO details
// ═══════════════════════════════════════════════
router.get('/production-by-stage-detail', (req, res) => {
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

    for (const stage of stages) {
      stage.work_orders = db.prepare(`
        SELECT wo.id, wo.wo_number, m.model_name, m.model_code,
          ws.quantity_in_stage, ws.quantity_completed, ws.quantity_rejected, ws.status as stage_status
        FROM wo_stages ws
        JOIN work_orders wo ON wo.id=ws.wo_id AND wo.status IN ('in_progress','pending','draft')
        LEFT JOIN models m ON m.id=wo.model_id
        WHERE ws.stage_name=? AND (ws.quantity_in_stage > 0 OR ws.status='in_progress')
        ORDER BY wo.wo_number
      `).all(stage.stage_name);
    }

    res.json(stages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// V8 — Production by model
router.get('/production-by-model', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// V8 — Fabric consumption by supplier (aggregated)
router.get('/fabric-consumption-by-supplier', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/customer-summary — revenue + balance per customer
router.get('/customer-summary', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/inventory-status — fabric + accessory stock overview
router.get('/inventory-status', (req, res) => {
  try {
    const fabrics = db.prepare(`
      SELECT f.id, f.code, f.name, f.color, f.available_meters, f.low_stock_threshold,
        CASE WHEN COALESCE(f.available_meters,0) <= COALESCE(f.low_stock_threshold,10) THEN 1 ELSE 0 END as is_low_stock,
        (SELECT COUNT(*) FROM fabric_inventory_batches b WHERE b.fabric_code=f.code AND b.batch_status='available') as available_batches,
        (SELECT COALESCE(SUM(b.received_meters - b.used_meters - b.wasted_meters),0) FROM fabric_inventory_batches b WHERE b.fabric_code=f.code AND b.batch_status='available') as batch_available_meters
      FROM fabrics f WHERE f.status='active' ORDER BY is_low_stock DESC, f.name
    `).all();

    const accessories = db.prepare(`
      SELECT a.id, a.code, a.name, a.acc_type, a.quantity_on_hand, a.low_stock_threshold, a.reorder_qty, a.unit,
        CASE WHEN COALESCE(a.quantity_on_hand,0) <= COALESCE(a.low_stock_threshold,10) THEN 1 ELSE 0 END as is_low_stock
      FROM accessories a WHERE a.status='active' ORDER BY is_low_stock DESC, a.name
    `).all();

    res.json({
      fabrics,
      accessories,
      low_stock_fabrics: fabrics.filter(f => f.is_low_stock).length,
      low_stock_accessories: accessories.filter(a => a.is_low_stock).length,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/quality — quality & rejection report
router.get('/quality', (req, res) => {
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

    // Overall stats
    const overall = db.prepare(`
      SELECT COALESCE(SUM(quantity_completed),0) as total_passed,
        COALESCE(SUM(quantity_rejected),0) as total_rejected
      FROM wo_stages
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/machines — machine utilization report
router.get('/machines', (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/ar-aging — accounts receivable aging
router.get('/ar-aging', (req, res) => {
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
    const buckets = { current: [], days_30: [], days_60: [], days_90: [], over_90: [] };
    let totals = { current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0, grand_total: 0 };

    for (const inv of invoices) {
      const due = inv.due_date ? new Date(inv.due_date) : new Date(inv.created_at);
      const daysOverdue = Math.max(0, Math.floor((now - due) / 86400000));
      inv.days_overdue = daysOverdue;

      if (daysOverdue <= 0) { buckets.current.push(inv); totals.current += inv.outstanding; }
      else if (daysOverdue <= 30) { buckets.days_30.push(inv); totals.days_30 += inv.outstanding; }
      else if (daysOverdue <= 60) { buckets.days_60.push(inv); totals.days_60 += inv.outstanding; }
      else if (daysOverdue <= 90) { buckets.days_90.push(inv); totals.days_90 += inv.outstanding; }
      else { buckets.over_90.push(inv); totals.over_90 += inv.outstanding; }
      totals.grand_total += inv.outstanding;
    }

    res.json({ buckets, totals, total_invoices: invoices.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
