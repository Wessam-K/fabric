const express = require('express');
const router = express.Router();
const db = require('../database');
const { notFound, validationError, dbError, serverError, sanitize } = require('../utils/errors');

// ═══════════════════════════════════════════════
// GET /api/machines — list with search & filter
// ═══════════════════════════════════════════════
router.get('/', (req, res) => {
  try {
    const { search, status, type } = req.query;
    let q = 'SELECT * FROM machines WHERE 1=1';
    const params = [];
    if (status) { q += ' AND status = ?'; params.push(status); }
    if (type) { q += ' AND machine_type = ?'; params.push(type); }
    if (search) {
      q += ' AND (name LIKE ? OR code LIKE ? OR location LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    q += ' ORDER BY sort_order, name';
    const machines = db.prepare(q).all(...params);

    // Add utilization stats
    for (const m of machines) {
      const stats = db.prepare(`
        SELECT COUNT(*) as total_stages,
          SUM(CASE WHEN ws.status = 'in_progress' THEN 1 ELSE 0 END) as active_stages,
          COALESCE(SUM(ws.actual_hours), 0) as total_hours
        FROM wo_stages ws WHERE ws.machine_id = ?
      `).get(m.id);
      m.total_stages = stats.total_stages;
      m.active_stages = stats.active_stages;
      m.total_hours = Math.round((stats.total_hours || 0) * 100) / 100;
    }

    res.json(machines);
  } catch (err) {
    serverError(res, err);
  }
});

// ═══════════════════════════════════════════════
// GET /api/machines/:id — single with stats
// ═══════════════════════════════════════════════
router.get('/:id', (req, res) => {
  try {
    const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return notFound(res, 'الماكينة');

    machine.recent_stages = db.prepare(`
      SELECT ws.*, wo.wo_number, m.model_name
      FROM wo_stages ws
      LEFT JOIN work_orders wo ON wo.id = ws.wo_id
      LEFT JOIN models m ON m.id = wo.model_id
      WHERE ws.machine_id = ?
      ORDER BY ws.started_at DESC LIMIT 20
    `).all(machine.id);

    res.json(machine);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل بيانات الماكينة' });
  }
});

// ═══════════════════════════════════════════════
// POST /api/machines — create
// ═══════════════════════════════════════════════
router.post('/', (req, res) => {
  try {
    const { code, name, machine_type, location, capacity_per_hour, cost_per_hour, notes, sort_order } = req.body;
    if (!name || !name.trim()) return validationError(res, 'اسم الماكينة مطلوب', 'name');

    let machineCode = code;
    if (!machineCode || !machineCode.trim()) {
      const last = db.prepare("SELECT code FROM machines WHERE code LIKE 'MCH-%' ORDER BY id DESC LIMIT 1").get();
      const nextNum = last ? parseInt(last.code.replace('MCH-', '')) + 1 : 1;
      machineCode = `MCH-${String(nextNum).padStart(3, '0')}`;
    }

    const existing = db.prepare('SELECT id FROM machines WHERE code = ?').get(machineCode);
    if (existing) return validationError(res, 'كود الماكينة موجود مسبقاً', 'code');

    const result = db.prepare(`
      INSERT INTO machines (code, name, machine_type, location, capacity_per_hour, cost_per_hour, notes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(machineCode, sanitize(name.trim()), machine_type || null, location || null,
      capacity_per_hour || null, cost_per_hour || null, notes || null, sort_order || 0);

    const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(machine);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'كود الماكينة موجود مسبقاً' });
    }
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الماكينة' });
  }
});

// ═══════════════════════════════════════════════
// PATCH /api/machines/:id — update
// ═══════════════════════════════════════════════
router.patch('/:id', (req, res) => {
  try {
    const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return res.status(404).json({ error: 'الماكينة غير موجودة' });

    const { name, machine_type, location, capacity_per_hour, cost_per_hour, status, notes, sort_order } = req.body;
    if (name !== undefined && (!name || !name.trim())) return res.status(400).json({ error: 'اسم الماكينة مطلوب' });

    const validStatuses = ['active', 'maintenance', 'inactive'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'حالة الماكينة غير صالحة' });

    db.prepare(`
      UPDATE machines SET
        name = COALESCE(?, name),
        machine_type = COALESCE(?, machine_type),
        location = COALESCE(?, location),
        capacity_per_hour = COALESCE(?, capacity_per_hour),
        cost_per_hour = COALESCE(?, cost_per_hour),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        sort_order = COALESCE(?, sort_order),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ? name.trim() : null, machine_type !== undefined ? machine_type : null,
      location !== undefined ? location : null, capacity_per_hour !== undefined ? capacity_per_hour : null,
      cost_per_hour !== undefined ? cost_per_hour : null, status || null,
      notes !== undefined ? notes : null, sort_order !== undefined ? sort_order : null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات الماكينة' });
  }
});

// ═══════════════════════════════════════════════
// DELETE /api/machines/:id — soft delete
// ═══════════════════════════════════════════════
router.delete('/:id', (req, res) => {
  try {
    const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return res.status(404).json({ error: 'الماكينة غير موجودة' });

    const inUse = db.prepare("SELECT COUNT(*) as c FROM wo_stages WHERE machine_id = ? AND status = 'in_progress'").get(machine.id);
    if (inUse.c > 0) return res.status(400).json({ error: 'لا يمكن حذف ماكينة قيد الاستخدام في مراحل نشطة' });

    db.prepare("UPDATE machines SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ message: 'تم تعطيل الماكينة بنجاح', id: machine.id });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الماكينة' });
  }
});

// ═══════════════════════════════════════════════
// MAINTENANCE LOG
// ═══════════════════════════════════════════════

// GET /api/machines/:id/maintenance
router.get('/:id/maintenance', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM machine_maintenance WHERE machine_id = ? ORDER BY performed_at DESC').all(req.params.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/machines/:id/maintenance
router.post('/:id/maintenance', (req, res) => {
  try {
    const machine = db.prepare('SELECT id FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return res.status(404).json({ error: 'الماكينة غير موجودة' });

    const { maintenance_type, description, cost, performed_by, performed_at, next_due, notes } = req.body;
    if (!maintenance_type) return res.status(400).json({ error: 'نوع الصيانة مطلوب' });

    const validTypes = ['routine', 'repair', 'emergency', 'calibration'];
    if (!validTypes.includes(maintenance_type)) return res.status(400).json({ error: 'نوع الصيانة غير صالح' });

    const result = db.prepare(`
      INSERT INTO machine_maintenance (machine_id, maintenance_type, description, cost, performed_by, performed_at, next_due, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, maintenance_type, description || null, cost || 0, performed_by || null,
      performed_at || new Date().toISOString(), next_due || null, notes || null);

    res.status(201).json(db.prepare('SELECT * FROM machine_maintenance WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
