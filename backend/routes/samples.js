const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

// GET /api/samples
router.get('/', requirePermission('samples', 'read'), (req, res) => {
  try {
    const { status, customer_id, search, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1'; const params = [];
    if (status) { where += ' AND s.status=?'; params.push(status); }
    if (customer_id) { where += ' AND s.customer_id=?'; params.push(customer_id); }
    if (search) { where += ' AND (s.sample_number LIKE ? OR s.model_code LIKE ? OR s.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM samples s WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT s.*, c.name as customer_name, u.full_name as created_by_name
      FROM samples s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.created_by
      WHERE ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/samples/next-number
router.get('/next-number', requirePermission('samples', 'read'), (req, res) => {
  try {
    const prefix = db.prepare("SELECT value FROM settings WHERE key='sample_number_prefix'").get()?.value || 'SMP-';
    const last = db.prepare('SELECT sample_number FROM samples ORDER BY id DESC LIMIT 1').get();
    const num = last ? parseInt(String(last.sample_number).replace(/\D/g, '')) + 1 : 1;
    res.json({ next_number: `${prefix}${String(num).padStart(5, '0')}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/samples/:id
router.get('/:id', requirePermission('samples', 'read'), (req, res) => {
  try {
    const s = db.prepare(`SELECT s.*, c.name as customer_name, u.full_name as created_by_name
      FROM samples s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.created_by
      WHERE s.id=?`).get(req.params.id);
    if (!s) return res.status(404).json({ error: 'العينة غير موجودة' });
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/samples
router.post('/', requirePermission('samples', 'create'), (req, res) => {
  try {
    const { sample_number, customer_id, model_code, description, fabrics_used, accessories_used, cost, requested_date } = req.body;
    if (!model_code && !description) return res.status(400).json({ error: 'كود الموديل أو الوصف مطلوب' });

    const result = db.prepare(`INSERT INTO samples 
      (sample_number, model_code, customer_id, description, fabrics_used, accessories_used,
       cost, requested_date, status, created_by)
      VALUES (?,?,?,?,?,?,?,?,'requested',?)`)
      .run(sample_number, model_code || null, customer_id || null, description || null,
        fabrics_used || null, accessories_used || null,
        cost || null, requested_date || null, req.user.id);

    logAudit(req, 'CREATE', 'sample', result.lastInsertRowid, sample_number || model_code);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/samples/:id
router.put('/:id', requirePermission('samples', 'update'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = db.prepare('SELECT * FROM samples WHERE id=?').get(id);
    if (!old) return res.status(404).json({ error: 'العينة غير موجودة' });

    const { model_code, description, fabrics_used, accessories_used,
      cost, requested_date, completion_date, status, customer_feedback } = req.body;

    db.prepare(`UPDATE samples SET model_code=COALESCE(?,model_code), description=COALESCE(?,description),
      fabrics_used=COALESCE(?,fabrics_used), accessories_used=COALESCE(?,accessories_used),
      cost=COALESCE(?,cost), requested_date=COALESCE(?,requested_date),
      completion_date=COALESCE(?,completion_date), status=COALESCE(?,status),
      customer_feedback=COALESCE(?,customer_feedback) WHERE id=?`)
      .run(model_code, description, fabrics_used, accessories_used,
        cost, requested_date, completion_date, status, customer_feedback, id);

    logAudit(req, 'UPDATE', 'sample', id, old.sample_number || old.model_code, old, req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/samples/:id/convert-to-wo
router.post('/:id/convert-to-wo', requirePermission('workorders', 'create'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const s = db.prepare('SELECT * FROM samples WHERE id=?').get(id);
    if (!s) return res.status(404).json({ error: 'العينة غير موجودة' });
    if (s.status !== 'approved') return res.status(400).json({ error: 'يمكن التحويل فقط من عينة معتمدة' });

    const lastWo = db.prepare('SELECT wo_number FROM work_orders ORDER BY id DESC LIMIT 1').get();
    const woNum = lastWo ? parseInt(String(lastWo.wo_number).replace(/\D/g, '')) + 1 : 1;
    const woNumber = `WO-${String(woNum).padStart(5, '0')}`;
    const { quantity: targetQty } = req.body;

    const result = db.prepare(`INSERT INTO work_orders 
      (wo_number, customer_id, start_date, status, quantity, notes, created_by)
      VALUES (?,?,datetime('now','localtime'),'pending',?,?,?)`)
      .run(woNumber, s.customer_id, targetQty || 1, `من عينة ${s.sample_number}: ${s.model_code}`, req.user.id);

    db.prepare("UPDATE samples SET status='in_production' WHERE id=?").run(id);

    logAudit(req, 'CONVERT', 'sample', id, `${s.sample_number} → ${woNumber}`);
    res.status(201).json({ id: result.lastInsertRowid, wo_number: woNumber });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/samples/:id
router.delete('/:id', requirePermission('samples', 'delete'), (req, res) => {
  try {
    db.prepare("UPDATE samples SET status='cancelled' WHERE id=?").run(req.params.id);
    logAudit(req, 'DELETE', 'sample', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
