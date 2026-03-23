const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');
const { toCSV } = require('../utils/csv');

// ═══════════════════════════════════════════════
// GET /api/maintenance/stats
// ═══════════════════════════════════════════════
router.get('/stats', requirePermission('maintenance', 'view'), (req, res) => {
  try {
    const pending_count = db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE is_deleted=0 AND status='pending'").get().c;
    const in_progress_count = db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE is_deleted=0 AND status='in_progress'").get().c;
    const completed_this_month = db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE is_deleted=0 AND status='completed' AND completed_date >= date('now','start of month')").get().c;
    const critical_count = db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE is_deleted=0 AND priority='critical' AND status NOT IN ('completed','cancelled')").get().c;
    const total_cost_this_month = db.prepare("SELECT COALESCE(SUM(cost),0) as v FROM maintenance_orders WHERE is_deleted=0 AND status='completed' AND completed_date >= date('now','start of month')").get().v;
    const avg_resolution_days = db.prepare("SELECT AVG(JULIANDAY(completed_date) - JULIANDAY(scheduled_date)) as v FROM maintenance_orders WHERE is_deleted=0 AND status='completed' AND scheduled_date IS NOT NULL AND completed_date IS NOT NULL").get().v || 0;
    const overdue_count = db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE is_deleted=0 AND scheduled_date < date('now') AND status='pending'").get().c;
    const total_orders = db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE is_deleted=0").get().c;
    res.json({ pending_count, in_progress_count, completed_this_month, critical_count, total_cost_this_month, avg_resolution_days: Math.round(avg_resolution_days * 10) / 10, overdue_count, total_orders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// GET /api/maintenance/export
// ═══════════════════════════════════════════════
router.get('/export', requirePermission('maintenance', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT mo.*, m.name as machine_name FROM maintenance_orders mo LEFT JOIN machines m ON m.id=mo.machine_id WHERE mo.is_deleted=0 ORDER BY mo.created_at DESC`).all();
    const columns = ['barcode','title','maintenance_type','priority','status','machine_name','scheduled_date','completed_date','performed_by','cost','description','notes'];
    const csv = toCSV(rows, columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="maintenance_orders.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// GET /api/maintenance/barcode/:barcode
// ═══════════════════════════════════════════════
router.get('/barcode/:barcode', requirePermission('maintenance', 'view'), (req, res) => {
  try {
    const order = db.prepare(`SELECT mo.*, m.name as machine_name, m.barcode as machine_barcode
      FROM maintenance_orders mo LEFT JOIN machines m ON m.id=mo.machine_id
      WHERE mo.barcode=? AND mo.is_deleted=0`).get(req.params.barcode);
    if (!order) return res.status(404).json({ error: 'أمر الصيانة غير موجود' });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// GET /api/maintenance — list with filters
// ═══════════════════════════════════════════════
router.get('/', requirePermission('maintenance', 'view'), (req, res) => {
  try {
    const { machine_id, status, priority, maintenance_type, date_from, date_to, search, page = 1, limit = 50 } = req.query;
    let where = 'WHERE mo.is_deleted = 0';
    const params = [];
    if (machine_id) { where += ' AND mo.machine_id = ?'; params.push(machine_id); }
    if (status) { where += ' AND mo.status = ?'; params.push(status); }
    if (priority) { where += ' AND mo.priority = ?'; params.push(priority); }
    if (maintenance_type) { where += ' AND mo.maintenance_type = ?'; params.push(maintenance_type); }
    if (date_from) { where += ' AND mo.scheduled_date >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND mo.scheduled_date <= ?'; params.push(date_to); }
    if (search) { where += ' AND (mo.title LIKE ? OR mo.barcode LIKE ? OR mo.description LIKE ? OR m.name LIKE ?)'; const s = `%${search}%`; params.push(s, s, s, s); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM maintenance_orders mo LEFT JOIN machines m ON m.id=mo.machine_id ${where}`).get(...params).c;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const data = db.prepare(`
      SELECT mo.*, m.name as machine_name, m.barcode as machine_barcode, m.code as machine_code
      FROM maintenance_orders mo
      LEFT JOIN machines m ON m.id = mo.machine_id
      ${where} ORDER BY mo.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({ data, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// GET /api/maintenance/:id
// ═══════════════════════════════════════════════
router.get('/:id', requirePermission('maintenance', 'view'), (req, res) => {
  try {
    const order = db.prepare(`SELECT mo.*, m.name as machine_name, m.barcode as machine_barcode, m.code as machine_code, m.location as machine_location
      FROM maintenance_orders mo LEFT JOIN machines m ON m.id=mo.machine_id
      WHERE mo.id=? AND mo.is_deleted=0`).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'أمر الصيانة غير موجود' });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// GET /api/maintenance/:id/history
// ═══════════════════════════════════════════════
router.get('/:id/history', requirePermission('maintenance', 'view'), (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM audit_log WHERE entity_type='maintenance_orders' AND entity_id=? ORDER BY created_at DESC").all(String(req.params.id));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// POST /api/maintenance — create
// ═══════════════════════════════════════════════
router.post('/', requirePermission('maintenance', 'create'), (req, res) => {
  try {
    const { machine_id, maintenance_type, title, description, priority, scheduled_date, performed_by, cost, parts_used, notes } = req.body;
    if (!title) return res.status(400).json({ error: 'عنوان أمر الصيانة مطلوب' });
    const barcode = 'MNT-' + Date.now().toString().slice(-8);
    const result = db.prepare(`INSERT INTO maintenance_orders (machine_id, maintenance_type, title, description, priority, scheduled_date, performed_by, cost, parts_used, notes, barcode, created_by, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending')`)
      .run(machine_id || null, maintenance_type || 'preventive', title, description || null, priority || 'medium',
        scheduled_date || null, performed_by || null, cost || 0, parts_used || null, notes || null, barcode, req.user.id);
    const order = db.prepare('SELECT * FROM maintenance_orders WHERE id=?').get(result.lastInsertRowid);
    logAudit(req, 'create', 'maintenance_orders', order.id, title, null, order);
    res.status(201).json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// PUT /api/maintenance/:id — update
// ═══════════════════════════════════════════════
router.put('/:id', requirePermission('maintenance', 'edit'), (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM maintenance_orders WHERE id=? AND is_deleted=0').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'أمر الصيانة غير موجود' });
    const { machine_id, maintenance_type, title, description, priority, status, scheduled_date, completed_date, performed_by, cost, parts_used, notes } = req.body;

    let finalCompletedDate = completed_date !== undefined ? completed_date : old.completed_date;
    if (status === 'completed' && !finalCompletedDate) {
      finalCompletedDate = new Date().toISOString().slice(0, 10);
    }

    db.prepare(`UPDATE maintenance_orders SET
      machine_id=COALESCE(?,machine_id), maintenance_type=COALESCE(?,maintenance_type),
      title=COALESCE(?,title), description=COALESCE(?,description),
      priority=COALESCE(?,priority), status=COALESCE(?,status),
      scheduled_date=COALESCE(?,scheduled_date), completed_date=?,
      performed_by=COALESCE(?,performed_by), cost=COALESCE(?,cost),
      parts_used=COALESCE(?,parts_used), notes=COALESCE(?,notes)
      WHERE id=?`).run(
      machine_id !== undefined ? machine_id : null, maintenance_type || null,
      title || null, description !== undefined ? description : null,
      priority || null, status || null,
      scheduled_date !== undefined ? scheduled_date : null, finalCompletedDate,
      performed_by !== undefined ? performed_by : null, cost !== undefined ? cost : null,
      parts_used !== undefined ? parts_used : null, notes !== undefined ? notes : null,
      req.params.id);

    // Update machine's last_maintenance_date if completed
    if (status === 'completed' && (machine_id || old.machine_id)) {
      const mid = machine_id || old.machine_id;
      try { db.prepare("UPDATE machines SET last_maintenance_date=date('now') WHERE id=?").run(mid); } catch {}
    }

    const updated = db.prepare('SELECT * FROM maintenance_orders WHERE id=?').get(req.params.id);
    logAudit(req, 'update', 'maintenance_orders', old.id, old.title, old, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// DELETE /api/maintenance/:id — soft delete
// ═══════════════════════════════════════════════
router.delete('/:id', requirePermission('maintenance', 'delete'), (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM maintenance_orders WHERE id=? AND is_deleted=0').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'أمر الصيانة غير موجود' });
    db.prepare('UPDATE maintenance_orders SET is_deleted=1 WHERE id=?').run(req.params.id);
    logAudit(req, 'delete', 'maintenance_orders', old.id, old.title, old, null);
    res.json({ message: 'تم حذف أمر الصيانة بنجاح' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// POST /api/maintenance/import
// ═══════════════════════════════════════════════
router.post('/import', requirePermission('maintenance', 'create'), (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'يجب إرسال مصفوفة' });
    let inserted = 0; const errors = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const r = items[i];
        if (!r.title) { errors.push({ row: i+1, error: 'العنوان مطلوب' }); continue; }
        const barcode = 'MNT-' + Date.now().toString().slice(-8) + '-' + i;
        db.prepare(`INSERT INTO maintenance_orders (machine_id, maintenance_type, title, description, priority, scheduled_date, performed_by, cost, notes, barcode, created_by, status)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending')`)
          .run(r.machine_id||null, r.maintenance_type||'preventive', r.title, r.description||null,
            r.priority||'medium', r.scheduled_date||null, r.performed_by||null, r.cost||0,
            r.notes||null, barcode, req.user.id);
        inserted++;
      } catch (e) { errors.push({ row: i+1, error: e.message }); }
    }
    res.json({ inserted, errors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
