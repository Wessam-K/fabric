const express = require('express');
const router = express.Router();
const db = require('../database');
const { notFound, validationError, dbError, serverError, sanitize } = require('../utils/errors');
const { logAudit, requirePermission } = require('../middleware/auth');
const { toCSV } = require('../utils/csv');

// ═══════════════════════════════════════════════
// GET /api/machines/stats
// ═══════════════════════════════════════════════
router.get('/stats', requirePermission('machines', 'view'), (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as c FROM machines").get().c;
    const active = db.prepare("SELECT COUNT(*) as c FROM machines WHERE status='active'").get().c;
    const under_maintenance = db.prepare("SELECT COUNT(*) as c FROM machines WHERE status='maintenance'").get().c;
    const inactive = db.prepare("SELECT COUNT(*) as c FROM machines WHERE status='inactive'").get().c;
    const machines_in_use = db.prepare("SELECT COUNT(DISTINCT machine_id) as c FROM wo_stages WHERE status='in_progress' AND machine_id IS NOT NULL").get().c;
    const total_maintenance_cost_this_month = db.prepare("SELECT COALESCE(SUM(cost),0) as v FROM machine_maintenance WHERE performed_at >= date('now','start of month') AND is_deleted=0").get().v;
    let upcoming_maintenance_count = 0;
    try { upcoming_maintenance_count = db.prepare("SELECT COUNT(*) as c FROM machines WHERE next_maintenance_date IS NOT NULL AND next_maintenance_date <= date('now','+7 days') AND status='active'").get().c; } catch {}
    res.json({ total, active, under_maintenance, inactive, machines_in_use, total_maintenance_cost_this_month, upcoming_maintenance_count });
  } catch (err) { serverError(res, err); }
});

// ═══════════════════════════════════════════════
// GET /api/machines/export
// ═══════════════════════════════════════════════
router.get('/export', requirePermission('machines', 'view'), (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM machines WHERE status != 'inactive' ORDER BY sort_order, name").all();
    const columns = ['barcode','code','name','machine_type','status','location','purchase_date','machine_value','last_maintenance_date','next_maintenance_date','notes'];
    const csv = toCSV(rows, columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="machines.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) { serverError(res, err); }
});

// ═══════════════════════════════════════════════
// GET /api/machines/barcode/:barcode
// ═══════════════════════════════════════════════
router.get('/barcode/:barcode', requirePermission('machines', 'view'), (req, res) => {
  try {
    const machine = db.prepare('SELECT * FROM machines WHERE barcode = ?').get(req.params.barcode);
    if (!machine) return notFound(res, 'الماكينة');
    res.json(machine);
  } catch (err) { serverError(res, err); }
});

// ═══════════════════════════════════════════════
// GET /api/machines — list with search & filter
// ═══════════════════════════════════════════════
router.get('/', requirePermission('machines', 'view'), (req, res) => {
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
router.get('/:id', requirePermission('machines', 'view'), (req, res) => {
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
router.post('/', requirePermission('machines', 'create'), (req, res) => {
  try {
    const { code, name, machine_type, location, capacity_per_hour, cost_per_hour, notes, sort_order } = req.body;
    if (!name || !name.trim()) return validationError(res, 'اسم الماكينة مطلوب', 'name');
    if (capacity_per_hour != null && capacity_per_hour < 0) return validationError(res, 'الطاقة لا يمكن أن تكون سالبة', 'capacity_per_hour');
    if (cost_per_hour != null && cost_per_hour < 0) return validationError(res, 'التكلفة لا يمكن أن تكون سالبة', 'cost_per_hour');

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
    // Auto-generate barcode
    if (!machine.barcode) {
      const barcode = 'MCH-' + result.lastInsertRowid + '-' + Date.now().toString().slice(-6);
      db.prepare('UPDATE machines SET barcode=? WHERE id=?').run(barcode, result.lastInsertRowid);
      machine.barcode = barcode;
    }
    logAudit(req, 'CREATE', 'machine', machine.id, machine.name);
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
router.patch('/:id', requirePermission('machines', 'edit'), (req, res) => {
  try {
    const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return res.status(404).json({ error: 'الماكينة غير موجودة' });

    const { name, machine_type, location, capacity_per_hour, cost_per_hour, status, notes, sort_order } = req.body;
    if (name !== undefined && (!name || !name.trim())) return res.status(400).json({ error: 'اسم الماكينة مطلوب' });
    if (capacity_per_hour != null && capacity_per_hour < 0) return res.status(400).json({ error: 'الطاقة لا يمكن أن تكون سالبة' });
    if (cost_per_hour != null && cost_per_hour < 0) return res.status(400).json({ error: 'التكلفة لا يمكن أن تكون سالبة' });

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
    logAudit(req, 'UPDATE', 'machine', machine.id, machine.name, machine, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات الماكينة' });
  }
});

// ═══════════════════════════════════════════════
// DELETE /api/machines/:id — soft delete
// ═══════════════════════════════════════════════
router.delete('/:id', requirePermission('machines', 'delete'), (req, res) => {
  try {
    const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return res.status(404).json({ error: 'الماكينة غير موجودة' });

    const inUse = db.prepare("SELECT COUNT(*) as c FROM wo_stages WHERE machine_id = ? AND status = 'in_progress'").get(machine.id);
    if (inUse.c > 0) return res.status(400).json({ error: 'لا يمكن حذف ماكينة قيد الاستخدام في مراحل نشطة' });

    db.prepare("UPDATE machines SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    logAudit(req, 'DELETE', 'machine', machine.id, machine.name);
    res.json({ message: 'تم تعطيل الماكينة بنجاح', id: machine.id });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الماكينة' });
  }
});

// ═══════════════════════════════════════════════
// MAINTENANCE LOG
// ═══════════════════════════════════════════════

// GET /api/machines/:id/maintenance
router.get('/:id/maintenance', requirePermission('machines', 'view'), (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM machine_maintenance WHERE machine_id = ? AND is_deleted=0 ORDER BY performed_at DESC').all(req.params.id);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/machines/:id/maintenance
router.post('/:id/maintenance', requirePermission('machines', 'edit'), (req, res) => {
  try {
    const machine = db.prepare('SELECT id FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return res.status(404).json({ error: 'الماكينة غير موجودة' });

    const { maintenance_type, description, cost, performed_by, performed_at, next_due, notes, title } = req.body;
    if (!maintenance_type) return res.status(400).json({ error: 'نوع الصيانة مطلوب' });

    const validTypes = ['routine', 'repair', 'emergency', 'calibration', 'preventive', 'corrective'];
    if (!validTypes.includes(maintenance_type)) return res.status(400).json({ error: 'نوع الصيانة غير صالح' });

    const barcode = 'MCH-MNT-' + Date.now().toString().slice(-8);
    const result = db.prepare(`
      INSERT INTO machine_maintenance (machine_id, maintenance_type, description, cost, performed_by, performed_at, next_due, notes, title, barcode, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, maintenance_type, description || null, cost || 0, performed_by || null,
      performed_at || new Date().toISOString(), next_due || null, notes || null, title || null, barcode, req.user?.id || null);

    const newRecord = db.prepare('SELECT * FROM machine_maintenance WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req, 'CREATE', 'machine_maintenance', newRecord.id, maintenance_type);
    res.status(201).json(newRecord);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/machines/:id/maintenance/:mid
router.put('/:id/maintenance/:mid', requirePermission('machines', 'edit'), (req, res) => {
  try {
    const record = db.prepare('SELECT * FROM machine_maintenance WHERE id=? AND machine_id=? AND is_deleted=0').get(req.params.mid, req.params.id);
    if (!record) return notFound(res, 'سجل الصيانة');
    const { maintenance_type, description, cost, performed_by, performed_at, next_due, notes, title, status } = req.body;
    db.prepare(`UPDATE machine_maintenance SET
      maintenance_type=COALESCE(?,maintenance_type), description=COALESCE(?,description),
      cost=COALESCE(?,cost), performed_by=COALESCE(?,performed_by),
      performed_at=COALESCE(?,performed_at), next_due=COALESCE(?,next_due),
      notes=COALESCE(?,notes), title=COALESCE(?,title), status=COALESCE(?,status)
      WHERE id=?`).run(maintenance_type||null, description!==undefined?description:null,
      cost!==undefined?cost:null, performed_by!==undefined?performed_by:null,
      performed_at||null, next_due!==undefined?next_due:null,
      notes!==undefined?notes:null, title!==undefined?title:null, status||null, req.params.mid);
    const updated = db.prepare('SELECT * FROM machine_maintenance WHERE id=?').get(req.params.mid);
    logAudit(req, 'UPDATE', 'machine_maintenance', record.id, record.maintenance_type, record, updated);
    res.json(updated);
  } catch (err) { serverError(res, err); }
});

// ═══════════════════════════════════════════════
// GET /api/machines/:id/expenses
// ═══════════════════════════════════════════════
router.get('/:id/expenses', requirePermission('machines', 'view'), (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM expenses WHERE reference_type='machine' AND reference_id=? AND is_deleted=0 ORDER BY expense_date DESC").all(req.params.id);
    res.json(rows);
  } catch (err) { serverError(res, err); }
});

// ═══════════════════════════════════════════════
// POST /api/machines/:id/expenses
// ═══════════════════════════════════════════════
router.post('/:id/expenses', requirePermission('machines', 'edit'), (req, res) => {
  try {
    const machine = db.prepare('SELECT id FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return notFound(res, 'الماكينة');
    const { amount, description, expense_date, notes } = req.body;
    if (!amount || !description) return validationError(res, 'المبلغ والوصف مطلوبان');
    const result = db.prepare(`INSERT INTO expenses (expense_type, reference_id, reference_type, amount, description, expense_date, created_by, status, notes)
      VALUES ('machine', ?, 'machine', ?, ?, ?, ?, 'pending', ?)`).run(req.params.id, amount, description, expense_date || new Date().toISOString().slice(0,10), req.user?.id || null, notes || null);
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req, 'CREATE', 'machine_expense', expense.id, description);
    res.status(201).json(expense);
  } catch (err) { serverError(res, err); }
});

// ═══════════════════════════════════════════════
// POST /api/machines/import
// ═══════════════════════════════════════════════
router.post('/import', requirePermission('machines', 'create'), (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return validationError(res, 'يجب إرسال مصفوفة من الماكينات');
    let inserted = 0, updated = 0, errors = [];

    const importResult = db.transaction(() => {
      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          if (!item.name) { errors.push({ row: i+1, error: 'الاسم مطلوب' }); continue; }
          const existing = item.barcode ? db.prepare('SELECT id FROM machines WHERE barcode = ?').get(item.barcode) : null;
          if (existing) {
            db.prepare('UPDATE machines SET name=?, machine_type=?, location=?, status=?, notes=?, updated_at=datetime(\'now\') WHERE id=?')
              .run(item.name, item.machine_type || 'other', item.location || null, item.status || 'active', item.notes || null, existing.id);
            updated++;
          } else {
            const code = item.code || ('MCH-IMP-' + Date.now().toString().slice(-6) + '-' + i);
            const result = db.prepare('INSERT INTO machines (code, name, machine_type, location, status, notes) VALUES (?,?,?,?,?,?)')
              .run(code, item.name, item.machine_type || 'other', item.location || null, item.status || 'active', item.notes || null);
            const barcode = item.barcode || ('MCH-' + result.lastInsertRowid + '-' + Date.now().toString().slice(-6));
            db.prepare('UPDATE machines SET barcode=? WHERE id=?').run(barcode, result.lastInsertRowid);
            inserted++;
          }
        } catch (e) { errors.push({ row: i+1, error: e.message }); }
      }
      return { inserted, updated };
    })();

    res.json({ inserted: importResult.inserted, updated: importResult.updated, errors });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
