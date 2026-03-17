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
      return res.status(400).json({ error: 'Invalid source. Use: production, financial, hr, inventory' });
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/hr-summary — HR KPI overview
router.get('/hr-summary', (req, res) => {
  try {
    const totalEmployees = db.prepare("SELECT COUNT(*) as c FROM employees WHERE status='active'").get().c;
    const totalPayroll = db.prepare(`
      SELECT COALESCE(SUM(pr.net_salary),0) as total FROM payroll_records pr
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

module.exports = router;
