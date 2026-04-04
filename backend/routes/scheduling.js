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
    const cap = parseFloat(capacity_per_day) || 0;
    if (cap < 0) return res.status(400).json({ error: 'السعة لا يمكن أن تكون سالبة' });
    const result = db.prepare('INSERT INTO production_lines (name, description, capacity_per_day) VALUES (?,?,?)')
      .run(name, description || null, cap);
    logAudit(req, 'create', 'production_line', result.lastInsertRowid, name);
    res.status(201).json(db.prepare('SELECT * FROM production_lines WHERE id=?').get(result.lastInsertRowid));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/scheduling/lines/:id
router.put('/lines/:id', requirePermission('scheduling', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, capacity_per_day, status } = req.body;
    if (capacity_per_day !== undefined && parseFloat(capacity_per_day) < 0) return res.status(400).json({ error: 'السعة لا يمكن أن تكون سالبة' });
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

// ═══════════════════════════════════════════
// Gantt Chart & Advanced Scheduling
// ═══════════════════════════════════════════

// GET /api/scheduling/gantt — returns WOs with timing data for Gantt chart
router.get('/gantt', requirePermission('scheduling', 'view'), (req, res) => {
  try {
    const { start_date, end_date, status, line_id, customer_id } = req.query;
    let where = "wo.status NOT IN ('cancelled')";
    const params = [];
    if (start_date) { where += ' AND wo.due_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND wo.created_at <= ?'; params.push(end_date); }
    if (status) { where += ' AND wo.status = ?'; params.push(status); }
    if (line_id) { where += ' AND ps.production_line_id = ?'; params.push(parseInt(line_id)); }
    if (customer_id) { where += ' AND wo.customer_id = ?'; params.push(parseInt(customer_id)); }

    const items = db.prepare(`
      SELECT wo.id, wo.wo_number, wo.status, wo.quantity, wo.priority,
        wo.created_at, wo.start_date, wo.due_date, wo.completed_date,
        m.model_code, m.model_name,
        c.name as customer_name,
        ps.planned_start, ps.planned_end, ps.production_line_id,
        pl.name as line_name,
        (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id) as total_stages,
        (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id AND status='completed') as completed_stages
      FROM work_orders wo
      LEFT JOIN models m ON m.id = wo.model_id
      LEFT JOIN customers c ON c.id = wo.customer_id
      LEFT JOIN production_schedule ps ON ps.work_order_id = wo.id AND ps.status != 'cancelled'
      LEFT JOIN production_lines pl ON pl.id = ps.production_line_id
      WHERE ${where}
      ORDER BY COALESCE(ps.planned_start, wo.created_at) ASC
    `).all(...params);

    res.json(items);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/scheduling/:id/reschedule — drag-drop reschedule from Gantt
router.put('/:id/reschedule', requirePermission('scheduling', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { planned_start, planned_end } = req.body;
    if (!planned_start || !planned_end) return res.status(400).json({ error: 'تاريخ البداية والنهاية مطلوبان' });

    const old = db.prepare('SELECT * FROM production_schedule WHERE id=?').get(id);
    if (!old) return res.status(404).json({ error: 'غير موجود' });

    db.prepare("UPDATE production_schedule SET planned_start=?, planned_end=?, updated_at=datetime('now','localtime') WHERE id=?")
      .run(planned_start, planned_end, id);
    logAudit(req, 'reschedule', 'schedule', id, `Reschedule #${id}`, old, { planned_start, planned_end });
    res.json(db.prepare('SELECT * FROM production_schedule WHERE id=?').get(id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/scheduling/conflicts — detect overlapping resource allocations
router.get('/conflicts', requirePermission('scheduling', 'view'), (req, res) => {
  try {
    // Find machines double-booked
    const machineConflicts = db.prepare(`
      SELECT a.id as schedule_a, b.id as schedule_b, a.machine_id,
        m.name as machine_name,
        a.planned_start as a_start, a.planned_end as a_end,
        b.planned_start as b_start, b.planned_end as b_end
      FROM production_schedule a
      JOIN production_schedule b ON a.machine_id = b.machine_id AND a.id < b.id
      JOIN machines m ON m.id = a.machine_id
      WHERE a.status NOT IN ('cancelled','completed') AND b.status NOT IN ('cancelled','completed')
        AND a.machine_id IS NOT NULL
        AND a.planned_start < b.planned_end AND a.planned_end > b.planned_start
    `).all();

    // Find overloaded production lines
    const lineOverloads = db.prepare(`
      SELECT ps.production_line_id, pl.name as line_name,
        DATE(ps.planned_start) as work_date,
        SUM(wo.quantity) as total_scheduled,
        pl.capacity_per_day as capacity
      FROM production_schedule ps
      JOIN work_orders wo ON wo.id = ps.work_order_id
      JOIN production_lines pl ON pl.id = ps.production_line_id
      WHERE ps.status NOT IN ('cancelled','completed')
      GROUP BY ps.production_line_id, DATE(ps.planned_start)
      HAVING total_scheduled > capacity
    `).all();

    res.json({ machine_conflicts: machineConflicts, line_overloads: lineOverloads });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
