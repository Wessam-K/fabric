const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

// ═══════════════════════════════════════════════
// Production Lines CRUD
// ═══════════════════════════════════════════════

// GET /api/scheduling/lines
router.get('/lines', requirePermission('scheduling', 'view'), (req, res) => {
  try {
    const lines = db.prepare('SELECT * FROM production_lines ORDER BY name').all();
    res.json(lines);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/scheduling/lines
router.post('/lines', requirePermission('scheduling', 'create'), (req, res) => {
  try {
    const { name, description, capacity_per_day } = req.body;
    if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
    const result = db.prepare('INSERT INTO production_lines (name, description, capacity_per_day) VALUES (?,?,?)')
      .run(name, description || null, parseFloat(capacity_per_day) || 0);
    logAudit(req, 'create', 'production_line', result.lastInsertRowid, name);
    res.status(201).json(db.prepare('SELECT * FROM production_lines WHERE id=?').get(result.lastInsertRowid));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/scheduling/lines/:id
router.put('/lines/:id', requirePermission('scheduling', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, capacity_per_day, status } = req.body;
    db.prepare('UPDATE production_lines SET name=COALESCE(?,name), description=COALESCE(?,description), capacity_per_day=COALESCE(?,capacity_per_day), status=COALESCE(?,status) WHERE id=?')
      .run(name, description, capacity_per_day !== undefined ? capacity_per_day : null, status, id);
    res.json(db.prepare('SELECT * FROM production_lines WHERE id=?').get(id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// Production Schedule CRUD
// ═══════════════════════════════════════════════

// GET /api/scheduling — list schedule entries (for Gantt)
router.get('/', requirePermission('scheduling', 'view'), (req, res) => {
  try {
    const { start_date, end_date, line_id, status } = req.query;
    let where = '1=1';
    const params = [];
    if (start_date) { where += ' AND ps.planned_end >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND ps.planned_start <= ?'; params.push(end_date); }
    if (line_id) { where += ' AND ps.production_line_id=?'; params.push(parseInt(line_id)); }
    if (status) { where += ' AND ps.status=?'; params.push(status); }

    const data = db.prepare(`
      SELECT ps.*, wo.wo_number, md.model_name, wo.quantity as wo_quantity,
        pl.name as line_name, m.name as machine_name, ws.stage_name,
        u.full_name as created_by_name
      FROM production_schedule ps
      LEFT JOIN work_orders wo ON wo.id=ps.work_order_id
      LEFT JOIN models md ON md.id=wo.model_id
      LEFT JOIN production_lines pl ON pl.id=ps.production_line_id
      LEFT JOIN machines m ON m.id=ps.machine_id
      LEFT JOIN wo_stages ws ON ws.id=ps.stage_id
      LEFT JOIN users u ON u.id=ps.created_by
      WHERE ${where}
      ORDER BY ps.planned_start ASC
    `).all(...params);
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/scheduling/capacity
router.get('/capacity', requirePermission('scheduling', 'view'), (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const lines = db.prepare('SELECT * FROM production_lines WHERE status=?').all('active');
    const result = lines.map(line => {
      const scheduled = db.prepare(`
        SELECT COALESCE(SUM(wo.quantity),0) as total_qty
        FROM production_schedule ps
        JOIN work_orders wo ON wo.id=ps.work_order_id
        WHERE ps.production_line_id=? AND ps.planned_start <= ? AND ps.planned_end >= ? AND ps.status != 'cancelled'
      `).get(line.id, targetDate, targetDate);

      return {
        ...line,
        scheduled_qty: scheduled.total_qty,
        available_capacity: Math.max(0, (line.capacity_per_day || 0) - scheduled.total_qty),
        utilization_pct: line.capacity_per_day > 0 ? Math.round((scheduled.total_qty / line.capacity_per_day) * 100) : 0,
      };
    });
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/scheduling
router.post('/', requirePermission('scheduling', 'create'), (req, res) => {
  try {
    const { work_order_id, production_line_id, machine_id, stage_id,
      planned_start, planned_end, priority, notes } = req.body;
    if (!work_order_id || !planned_start || !planned_end) return res.status(400).json({ error: 'أمر العمل وتاريخ البداية والنهاية مطلوبة' });

    const result = db.prepare(`INSERT INTO production_schedule 
      (work_order_id, production_line_id, machine_id, stage_id, planned_start, planned_end, priority, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(work_order_id, production_line_id || null, machine_id || null, stage_id || null,
      planned_start, planned_end, parseInt(priority) || 5, notes || null, req.user?.id || null);

    logAudit(req, 'create', 'schedule', result.lastInsertRowid, `Schedule for WO #${work_order_id}`);
    res.status(201).json(db.prepare('SELECT * FROM production_schedule WHERE id=?').get(result.lastInsertRowid));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/scheduling/:id
router.put('/:id', requirePermission('scheduling', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = db.prepare('SELECT * FROM production_schedule WHERE id=?').get(id);
    if (!old) return res.status(404).json({ error: 'غير موجود' });

    const { production_line_id, machine_id, stage_id, planned_start, planned_end,
      actual_start, actual_end, priority, status, notes } = req.body;
    if (status && !['planned','in_progress','completed','delayed','cancelled'].includes(status)) return res.status(400).json({ error: 'الحالة غير صالحة' });

    db.prepare(`UPDATE production_schedule SET 
      production_line_id=COALESCE(?,production_line_id), machine_id=COALESCE(?,machine_id),
      stage_id=COALESCE(?,stage_id), planned_start=COALESCE(?,planned_start), planned_end=COALESCE(?,planned_end),
      actual_start=COALESCE(?,actual_start), actual_end=COALESCE(?,actual_end),
      priority=COALESCE(?,priority), status=COALESCE(?,status), notes=COALESCE(?,notes),
      updated_at=datetime('now','localtime')
      WHERE id=?`)
    .run(production_line_id, machine_id, stage_id, planned_start, planned_end,
      actual_start, actual_end, priority !== undefined ? priority : null, status, notes, id);

    logAudit(req, 'update', 'schedule', id, `Schedule #${id}`, old, req.body);
    res.json(db.prepare('SELECT * FROM production_schedule WHERE id=?').get(id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/scheduling/:id
router.delete('/:id', requirePermission('scheduling', 'delete'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = db.prepare('SELECT * FROM production_schedule WHERE id=?').get(id);
    if (!old) return res.status(404).json({ error: 'غير موجود' });
    db.prepare("UPDATE production_schedule SET status='cancelled', updated_at=datetime('now','localtime') WHERE id=?").run(id);
    logAudit(req, 'delete', 'schedule', id, `Schedule #${id}`, old, null);
    res.json({ message: 'تم إلغاء الجدول' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
