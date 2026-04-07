const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');
const { generateNextNumber } = require('../utils/numberGenerator');

// ═══════════════════════════════════════════════
// QC TEMPLATES
// ═══════════════════════════════════════════════

// GET /api/quality/templates
router.get('/templates', requirePermission('quality', 'view'), (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const total = db.prepare('SELECT COUNT(*) as c FROM qc_templates WHERE is_active=1').get().c;
    const rows = db.prepare(`SELECT qt.*, 
      (SELECT COUNT(*) FROM qc_template_items WHERE template_id=qt.id) as item_count
      FROM qc_templates qt WHERE qt.is_active=1 ORDER BY qt.name LIMIT ? OFFSET ?`).all(limit, (page - 1) * limit);
    res.json({ data: rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/quality/templates
router.post('/templates', requirePermission('quality', 'create'), (req, res) => {
  try {
    const { name, description, product_type, items } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم القالب مطلوب' });

    const templateId = db.transaction(() => {
      const validTypes = ['normal','tightened','reduced'];
      const insType = validTypes.includes(product_type) ? product_type : 'normal';
      const result = db.prepare('INSERT INTO qc_templates (name, description, inspection_type) VALUES (?,?,?)')
        .run(name, description || null, insType);
      const tid = result.lastInsertRowid;

      if (items?.length) {
        const ins = db.prepare('INSERT INTO qc_template_items (template_id, check_point, category, accept_criteria, sort_order) VALUES (?,?,?,?,?)');
        items.forEach((it, i) => ins.run(tid, it.check_point, it.category || it.check_type || null, it.accept_criteria || it.acceptable_range || null, it.sort_order ?? i));
      }

      return tid;
    })();

    logAudit(req, 'CREATE', 'qc_template', templateId, name);
    res.status(201).json({ id: templateId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/quality/templates/:id
router.get('/templates/:id', requirePermission('quality', 'view'), (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM qc_templates WHERE id=? AND is_active=1').get(req.params.id);
    if (!template) return res.status(404).json({ error: 'القالب غير موجود' });
    template.items = db.prepare('SELECT * FROM qc_template_items WHERE template_id=? ORDER BY sort_order').all(template.id);
    res.json(template);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/quality/templates/:id
router.put('/templates/:id', requirePermission('quality', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = db.prepare('SELECT * FROM qc_templates WHERE id=? AND is_active=1').get(id);
    if (!old) return res.status(404).json({ error: 'القالب غير موجود' });
    const { name, description, product_type, items } = req.body;
    const validTypes = ['normal','tightened','reduced'];
    const insType = product_type && validTypes.includes(product_type) ? product_type : undefined;

    db.transaction(() => {
      db.prepare('UPDATE qc_templates SET name=COALESCE(?,name), description=COALESCE(?,description), inspection_type=COALESCE(?,inspection_type) WHERE id=?')
        .run(name, description, insType, id);

      if (items) {
        db.prepare('DELETE FROM qc_template_items WHERE template_id=?').run(id);
        const ins = db.prepare('INSERT INTO qc_template_items (template_id, check_point, category, accept_criteria, sort_order) VALUES (?,?,?,?,?)');
        items.forEach((it, i) => ins.run(id, it.check_point, it.category || it.check_type || null, it.accept_criteria || it.acceptable_range || null, it.sort_order ?? i));
      }
    })();

    logAudit(req, 'UPDATE', 'qc_template', id, name || old.name, old, { name, description, product_type });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/quality/templates/:id
router.delete('/templates/:id', requirePermission('quality', 'delete'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare('UPDATE qc_templates SET is_active=0 WHERE id=?').run(id);
    logAudit(req, 'DELETE', 'qc_template', id);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// QC DEFECT CODES
// ═══════════════════════════════════════════════

// GET /api/quality/defect-codes
router.get('/defect-codes', requirePermission('quality', 'view'), (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM qc_defect_codes WHERE is_active=1 ORDER BY code').all());
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/quality/defect-codes
router.post('/defect-codes', requirePermission('quality', 'create'), (req, res) => {
  try {
    const { code, name_ar, severity, category } = req.body;
    if (!code || !name_ar) return res.status(400).json({ error: 'الكود والاسم مطلوبان' });
    const validSeverities = ['minor', 'major', 'critical'];
    if (severity && !validSeverities.includes(severity)) return res.status(400).json({ error: 'الخطورة يجب أن تكون minor أو major أو critical' });
    const result = db.prepare('INSERT INTO qc_defect_codes (code, name_ar, severity, category) VALUES (?,?,?,?)')
      .run(code, name_ar, severity || 'minor', category || null);
    logAudit(req, 'CREATE', 'qc_defect_code', result.lastInsertRowid, code);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// QC INSPECTIONS
// ═══════════════════════════════════════════════

// GET /api/quality/inspections
router.get('/inspections', requirePermission('quality', 'view'), (req, res) => {
  try {
    const { status, work_order_id, page = 1, limit: rawLimit = 25 } = req.query;
    const limit = Math.min(Math.max(parseInt(rawLimit) || 25, 1), 500);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND qi.result=?'; params.push(status); }
    if (work_order_id) { where += ' AND qi.work_order_id=?'; params.push(work_order_id); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM qc_inspections qi WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT qi.*, wo.wo_number, qt.name as template_name, u.full_name as inspector_name
      FROM qc_inspections qi
      LEFT JOIN work_orders wo ON wo.id=qi.work_order_id
      LEFT JOIN qc_templates qt ON qt.id=qi.template_id
      LEFT JOIN users u ON u.id=qi.inspector_id
      WHERE ${where} ORDER BY qi.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/quality/inspections
router.post('/inspections', requirePermission('quality', 'create'), (req, res) => {
  try {
    const { work_order_id, template_id, inspection_type, sample_size, items } = req.body;
    if (!work_order_id) return res.status(400).json({ error: 'أمر العمل مطلوب' });

    const inspResult = db.transaction(() => {
      const num = generateNextNumber(db, 'qc_inspection');
      const result = db.prepare(`INSERT INTO qc_inspections 
        (inspection_number, work_order_id, template_id, inspector_id, lot_size, sample_size)
        VALUES (?,?,?,?,?,?)`)
        .run(num, work_order_id, template_id || null, req.user.id, sample_size || 0, sample_size || 0);
      const inspId = result.lastInsertRowid;

      if (items?.length) {
        const ins = db.prepare('INSERT INTO qc_inspection_items (inspection_id, check_point, result, defect_code, defect_count, notes) VALUES (?,?,?,?,?,?)');
        for (const it of items) {
          ins.run(inspId, it.check_point, it.result || 'pass', it.defect_code || null, it.defect_count || 0, it.notes || null);
        }
      }

      return { id: inspId, inspection_number: num };
    })();

    logAudit(req, 'CREATE', 'qc_inspection', inspResult.id, inspResult.inspection_number);
    res.status(201).json(inspResult);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/quality/inspections/:id
router.get('/inspections/:id', requirePermission('quality', 'view'), (req, res) => {
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
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/quality/inspections/:id/complete
router.patch('/inspections/:id/complete', requirePermission('quality', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { passed_qty, failed_qty, result, notes } = req.body;
    const validResults = ['pass', 'fail', 'conditional'];
    if (result && !validResults.includes(result)) return res.status(400).json({ error: 'النتيجة يجب أن تكون pass أو fail أو conditional' });
    const existing = db.prepare('SELECT id FROM qc_inspections WHERE id=?').get(id);
    if (!existing) return res.status(404).json({ error: 'الفحص غير موجود' });
    
    db.prepare(`UPDATE qc_inspections SET result=?, passed=?, failed=?, 
      notes=COALESCE(?,notes) WHERE id=?`)
      .run(result || 'pass', passed_qty || 0, failed_qty || 0, notes, id);

    logAudit(req, 'COMPLETE', 'qc_inspection', id, `Result: ${result}`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// NCR — Non-Conformance Reports
// ═══════════════════════════════════════════════

// GET /api/quality/ncr
router.get('/ncr', requirePermission('quality', 'view'), (req, res) => {
  try {
    const { status, page = 1, limit: rawLimit = 25 } = req.query;
    const limit = Math.min(Math.max(parseInt(rawLimit) || 25, 1), 500);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
    let where = '1=1'; const params = [];
    if (status) { where += ' AND n.status=?'; params.push(status); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM qc_ncr n WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT n.*, wo.wo_number, u.full_name as created_by_name 
      FROM qc_ncr n LEFT JOIN work_orders wo ON wo.id=n.work_order_id LEFT JOIN users u ON u.id=n.created_by
      WHERE ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/quality/ncr
router.post('/ncr', requirePermission('quality', 'create'), (req, res) => {
  try {
    const { work_order_id, inspection_id, description, severity, root_cause, corrective_action, preventive_action, assigned_to, due_date } = req.body;
    if (!description) return res.status(400).json({ error: 'الوصف مطلوب' });

    const ncrNum = generateNextNumber(db, 'ncr');
    const result = db.prepare(`INSERT INTO qc_ncr 
      (ncr_number, work_order_id, inspection_id, description, severity, root_cause, corrective_action, preventive_action, assigned_to, due_date, created_by, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'open')`)
      .run(ncrNum, work_order_id || null, inspection_id || null, description, severity || 'minor',
        root_cause || null, corrective_action || null, preventive_action || null, assigned_to || null, due_date || null, req.user.id);

    logAudit(req, 'CREATE', 'qc_ncr', result.lastInsertRowid, ncrNum);
    res.status(201).json({ id: result.lastInsertRowid, ncr_number: ncrNum });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/quality/ncr/:id
router.patch('/ncr/:id', requirePermission('quality', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, root_cause, corrective_action, preventive_action, assigned_to } = req.body;
    const existing = db.prepare('SELECT id FROM qc_ncr WHERE id=?').get(id);
    if (!existing) return res.status(404).json({ error: 'تقرير عدم المطابقة غير موجود' });
    const validStatuses = ['open', 'investigating', 'corrective_action', 'closed'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'الحالة غير صالحة' });

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
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
