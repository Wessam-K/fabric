const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

// ═══════════════════════════════════════════════
// QC TEMPLATES
// ═══════════════════════════════════════════════

// GET /api/quality/templates
router.get('/templates', requirePermission('quality', 'read'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT qt.*, 
      (SELECT COUNT(*) FROM qc_template_items WHERE template_id=qt.id) as item_count
      FROM qc_templates qt WHERE qt.is_active=1 ORDER BY qt.name`).all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/quality/templates
router.post('/templates', requirePermission('quality', 'create'), (req, res) => {
  try {
    const { name, description, product_type, items } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم القالب مطلوب' });

    const result = db.prepare('INSERT INTO qc_templates (name, description, inspection_type) VALUES (?,?,?)')
      .run(name, description || null, product_type || 'inline');
    const templateId = result.lastInsertRowid;

    if (items?.length) {
      const ins = db.prepare('INSERT INTO qc_template_items (template_id, check_point, category, accept_criteria, sort_order) VALUES (?,?,?,?,?)');
      items.forEach((it, i) => ins.run(templateId, it.check_point, it.category || it.check_type || null, it.accept_criteria || it.acceptable_range || null, it.sort_order ?? i));
    }

    logAudit(req, 'CREATE', 'qc_template', templateId, name);
    res.status(201).json({ id: templateId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/quality/templates/:id
router.get('/templates/:id', requirePermission('quality', 'read'), (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM qc_templates WHERE id=? AND is_active=1').get(req.params.id);
    if (!template) return res.status(404).json({ error: 'القالب غير موجود' });
    template.items = db.prepare('SELECT * FROM qc_template_items WHERE template_id=? ORDER BY sort_order').all(template.id);
    res.json(template);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/quality/templates/:id
router.put('/templates/:id', requirePermission('quality', 'update'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = db.prepare('SELECT * FROM qc_templates WHERE id=? AND is_active=1').get(id);
    if (!old) return res.status(404).json({ error: 'القالب غير موجود' });
    const { name, description, product_type, items } = req.body;

    db.prepare('UPDATE qc_templates SET name=COALESCE(?,name), description=COALESCE(?,description), inspection_type=COALESCE(?,inspection_type) WHERE id=?')
      .run(name, description, product_type, id);

    if (items) {
      db.prepare('DELETE FROM qc_template_items WHERE template_id=?').run(id);
      const ins = db.prepare('INSERT INTO qc_template_items (template_id, check_point, category, accept_criteria, sort_order) VALUES (?,?,?,?,?)');
      items.forEach((it, i) => ins.run(id, it.check_point, it.category || it.check_type || null, it.accept_criteria || it.acceptable_range || null, it.sort_order ?? i));
    }

    logAudit(req, 'UPDATE', 'qc_template', id, name || old.name, old, { name, description, product_type });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/quality/templates/:id
router.delete('/templates/:id', requirePermission('quality', 'delete'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare('UPDATE qc_templates SET is_active=0 WHERE id=?').run(id);
    logAudit(req, 'DELETE', 'qc_template', id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// QC DEFECT CODES
// ═══════════════════════════════════════════════

// GET /api/quality/defect-codes
router.get('/defect-codes', requirePermission('quality', 'read'), (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM qc_defect_codes WHERE is_active=1 ORDER BY code').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/quality/defect-codes
router.post('/defect-codes', requirePermission('quality', 'create'), (req, res) => {
  try {
    const { code, name_ar, name_en, severity, category } = req.body;
    if (!code || !name_ar) return res.status(400).json({ error: 'الكود والاسم مطلوبان' });
    const result = db.prepare('INSERT INTO qc_defect_codes (code, name_ar, name_en, severity, category) VALUES (?,?,?,?,?)')
      .run(code, name_ar, name_en || null, severity || 'minor', category || null);
    logAudit(req, 'CREATE', 'qc_defect_code', result.lastInsertRowid, code);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// QC INSPECTIONS
// ═══════════════════════════════════════════════

// GET /api/quality/inspections
router.get('/inspections', requirePermission('quality', 'read'), (req, res) => {
  try {
    const { status, work_order_id, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND qi.status=?'; params.push(status); }
    if (work_order_id) { where += ' AND qi.work_order_id=?'; params.push(work_order_id); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM qc_inspections qi WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT qi.*, wo.wo_number, qt.name as template_name, u.full_name as inspector_name
      FROM qc_inspections qi
      LEFT JOIN work_orders wo ON wo.id=qi.work_order_id
      LEFT JOIN qc_templates qt ON qt.id=qi.template_id
      LEFT JOIN users u ON u.id=qi.inspector_id
      WHERE ${where} ORDER BY qi.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/quality/inspections
router.post('/inspections', requirePermission('quality', 'create'), (req, res) => {
  try {
    const { work_order_id, template_id, inspection_type, sample_size, items } = req.body;
    if (!work_order_id) return res.status(400).json({ error: 'أمر العمل مطلوب' });

    const num = `QC-${String(Date.now()).slice(-8)}`;
    const result = db.prepare(`INSERT INTO qc_inspections 
      (inspection_number, work_order_id, template_id, inspector_id, lot_size, sample_size)
      VALUES (?,?,?,?,?,?)`)
      .run(num, work_order_id, template_id || null, req.user.id, sample_size || 0, sample_size || 0);
    const inspId = result.lastInsertRowid;

    if (items?.length) {
      const ins = db.prepare('INSERT INTO qc_inspection_items (inspection_id, check_point, result, defect_code, defect_count, notes) VALUES (?,?,?,?,?,?)');
      for (const it of items) {
        ins.run(inspId, it.check_point, it.result || 'pending', it.defect_code || null, it.defect_count || 0, it.notes || null);
      }
    }

    logAudit(req, 'CREATE', 'qc_inspection', inspId, num);
    res.status(201).json({ id: inspId, inspection_number: num });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/quality/inspections/:id
router.get('/inspections/:id', requirePermission('quality', 'read'), (req, res) => {
  try {
    const insp = db.prepare(`SELECT qi.*, wo.wo_number, qt.name as template_name, u.full_name as inspector_name
      FROM qc_inspections qi 
      LEFT JOIN work_orders wo ON wo.id=qi.work_order_id
      LEFT JOIN qc_templates qt ON qt.id=qi.template_id
      LEFT JOIN users u ON u.id=qi.inspector_id
      WHERE qi.id=?`).get(req.params.id);
    if (!insp) return res.status(404).json({ error: 'الفحص غير موجود' });
    
    insp.items = db.prepare(`SELECT qii.*
      FROM qc_inspection_items qii
      WHERE qii.inspection_id=?`).all(insp.id);
    res.json(insp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/quality/inspections/:id/complete
router.patch('/inspections/:id/complete', requirePermission('quality', 'update'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { passed_qty, failed_qty, result, notes } = req.body;
    
    db.prepare(`UPDATE qc_inspections SET result=?, passed=?, failed=?, 
      notes=COALESCE(?,notes) WHERE id=?`)
      .run(result || 'pass', passed_qty || 0, failed_qty || 0, notes, id);

    logAudit(req, 'COMPLETE', 'qc_inspection', id, `Result: ${result}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// NCR — Non-Conformance Reports
// ═══════════════════════════════════════════════

// GET /api/quality/ncr
router.get('/ncr', requirePermission('quality', 'read'), (req, res) => {
  try {
    const { status, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1'; const params = [];
    if (status) { where += ' AND n.status=?'; params.push(status); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM qc_ncr n WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT n.*, wo.wo_number, u.full_name as created_by_name 
      FROM qc_ncr n LEFT JOIN work_orders wo ON wo.id=n.work_order_id LEFT JOIN users u ON u.id=n.created_by
      WHERE ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/quality/ncr
router.post('/ncr', requirePermission('quality', 'create'), (req, res) => {
  try {
    const { work_order_id, inspection_id, description, severity, root_cause, corrective_action, preventive_action, assigned_to, due_date } = req.body;
    if (!description) return res.status(400).json({ error: 'الوصف مطلوب' });

    const ncrNum = `NCR-${String(Date.now()).slice(-8)}`;
    const result = db.prepare(`INSERT INTO qc_ncr 
      (ncr_number, work_order_id, inspection_id, description, severity, root_cause, corrective_action, preventive_action, assigned_to, due_date, created_by, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'open')`)
      .run(ncrNum, work_order_id || null, inspection_id || null, description, severity || 'minor',
        root_cause || null, corrective_action || null, preventive_action || null, assigned_to || null, due_date || null, req.user.id);

    logAudit(req, 'CREATE', 'qc_ncr', result.lastInsertRowid, ncrNum);
    res.status(201).json({ id: result.lastInsertRowid, ncr_number: ncrNum });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/quality/ncr/:id
router.patch('/ncr/:id', requirePermission('quality', 'update'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, root_cause, corrective_action, preventive_action, assigned_to } = req.body;

    const sets = []; const vals = [];
    if (status) { sets.push('status=?'); vals.push(status); }
    if (root_cause) { sets.push('root_cause=?'); vals.push(root_cause); }
    if (corrective_action) { sets.push('corrective_action=?'); vals.push(corrective_action); }
    if (preventive_action) { sets.push('preventive_action=?'); vals.push(preventive_action); }
    if (assigned_to) { sets.push('assigned_to=?'); vals.push(assigned_to); }
    if (status === 'closed') { sets.push("closed_date=datetime('now','localtime')"); }
    sets.push('updated_at=CURRENT_TIMESTAMP');

    db.prepare(`UPDATE qc_ncr SET ${sets.join(',')} WHERE id=?`).run(...vals, id);
    logAudit(req, 'UPDATE', 'qc_ncr', id, `Status: ${status}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
