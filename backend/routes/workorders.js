const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/workorders — list with filters
router.get('/', (req, res) => {
  try {
    const { search, status, priority, page = 1, limit = 50 } = req.query;
    let q = `SELECT wo.*, m.model_code, m.model_name, m.serial_number,
             bv.name as variant_name,
             ps.name as stage_name, ps.color as stage_color
             FROM work_orders wo
             LEFT JOIN models m ON m.id = wo.model_id
             LEFT JOIN bom_variants bv ON bv.id = wo.variant_id
             LEFT JOIN production_stages ps ON ps.id = wo.current_stage_id
             WHERE 1=1`;
    const p = [];

    if (search) {
      q += ' AND (wo.wo_number LIKE ? OR m.model_code LIKE ? OR m.model_name LIKE ? OR wo.assigned_to LIKE ?)';
      const s = `%${search}%`;
      p.push(s, s, s, s);
    }
    if (status) { q += ' AND wo.status = ?'; p.push(status); }
    if (priority) { q += ' AND wo.priority = ?'; p.push(priority); }

    q += ' ORDER BY wo.created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    q += ' LIMIT ? OFFSET ?';
    p.push(parseInt(limit), offset);

    const workOrders = db.prepare(q).all(...p);

    // Get stage progress for each work order
    const stageStmt = db.prepare(`SELECT wos.*, ps.name as stage_name, ps.color, ps.sort_order
      FROM work_order_stages wos
      JOIN production_stages ps ON ps.id = wos.stage_id
      WHERE wos.work_order_id = ?
      ORDER BY ps.sort_order`);

    const result = workOrders.map(wo => ({
      ...wo,
      stages: stageStmt.all(wo.id),
    }));

    // KPI totals
    const totals = db.prepare(`SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft_count,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as active_count,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN priority='urgent' AND status='in_progress' THEN 1 ELSE 0 END) as urgent_count
    FROM work_orders`).get();

    res.json({ workOrders: result, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/workorders/next-number
router.get('/next-number', (req, res) => {
  try {
    const last = db.prepare("SELECT wo_number FROM work_orders ORDER BY id DESC LIMIT 1").get();
    let next = 'WO-001';
    if (last) {
      const num = parseInt(last.wo_number.replace(/\D/g, '') || '0') + 1;
      next = `WO-${String(num).padStart(3, '0')}`;
    }
    res.json({ next_number: next });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/workorders/stages — list production stages
router.get('/stages', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM production_stages WHERE is_active=1 ORDER BY sort_order').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/workorders/:id — single with full details
router.get('/:id', (req, res) => {
  try {
    const wo = db.prepare(`SELECT wo.*, m.model_code, m.model_name, m.serial_number,
      bv.name as variant_name
      FROM work_orders wo
      LEFT JOIN models m ON m.id = wo.model_id
      LEFT JOIN bom_variants bv ON bv.id = wo.variant_id
      WHERE wo.id = ?`).get(req.params.id);
    if (!wo) return res.status(404).json({ error: 'Not found' });

    wo.stages = db.prepare(`SELECT wos.*, ps.name as stage_name, ps.color, ps.sort_order
      FROM work_order_stages wos
      JOIN production_stages ps ON ps.id = wos.stage_id
      WHERE wos.work_order_id = ?
      ORDER BY ps.sort_order`).all(wo.id);

    wo.fabric_usage = db.prepare(`SELECT wofu.*, f.name as fabric_name
      FROM work_order_fabric_usage wofu
      LEFT JOIN fabrics f ON f.code = wofu.fabric_code
      WHERE wofu.work_order_id = ?`).all(wo.id);

    res.json(wo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/workorders — create
router.post('/', (req, res) => {
  try {
    const { wo_number, model_id, variant_id, quantity, priority, assigned_to, due_date, notes } = req.body;
    if (!wo_number || !model_id || !quantity) {
      return res.status(400).json({ error: 'wo_number, model_id, quantity required' });
    }

    const transaction = db.transaction(() => {
      const r = db.prepare(`INSERT INTO work_orders (wo_number, model_id, variant_id, quantity, priority, assigned_to, due_date, notes)
        VALUES (?,?,?,?,?,?,?,?)`).run(wo_number, model_id, variant_id || null, parseInt(quantity), priority || 'normal', assigned_to || null, due_date || null, notes || null);
      const woId = r.lastInsertRowid;

      // Auto-create stage checklist from active production stages
      const stages = db.prepare('SELECT id FROM production_stages WHERE is_active=1 ORDER BY sort_order').all();
      const ins = db.prepare('INSERT INTO work_order_stages (work_order_id, stage_id) VALUES (?,?)');
      stages.forEach(s => ins.run(woId, s.id));

      // Set current stage to first stage
      if (stages.length > 0) {
        db.prepare('UPDATE work_orders SET current_stage_id=? WHERE id=?').run(stages[0].id, woId);
      }

      return woId;
    });

    const woId = transaction();
    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
    wo.stages = db.prepare(`SELECT wos.*, ps.name as stage_name, ps.color, ps.sort_order
      FROM work_order_stages wos
      JOIN production_stages ps ON ps.id = wos.stage_id
      WHERE wos.work_order_id = ? ORDER BY ps.sort_order`).all(woId);
    res.status(201).json(wo);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'رقم أمر العمل موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/workorders/:id — update
router.put('/:id', (req, res) => {
  try {
    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(req.params.id);
    if (!wo) return res.status(404).json({ error: 'Not found' });

    const { quantity, priority, status, assigned_to, due_date, notes } = req.body;

    let endDate = null;
    if (status === 'completed' && wo.status !== 'completed') endDate = new Date().toISOString();
    let startDate = wo.start_date;
    if (status === 'in_progress' && !wo.start_date) startDate = new Date().toISOString();

    db.prepare(`UPDATE work_orders SET quantity=COALESCE(?,quantity), priority=COALESCE(?,priority),
      status=COALESCE(?,status), assigned_to=COALESCE(?,assigned_to), due_date=COALESCE(?,due_date),
      notes=COALESCE(?,notes), start_date=COALESCE(?,start_date), end_date=COALESCE(?,end_date),
      updated_at=datetime('now') WHERE id=?`)
      .run(quantity ? parseInt(quantity) : null, priority || null, status || null,
        assigned_to || null, due_date || null, notes || null, startDate, endDate, req.params.id);

    res.json(db.prepare('SELECT * FROM work_orders WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/workorders/:id/stage — update a stage's status
router.patch('/:id/stage', (req, res) => {
  try {
    const { stage_id, status } = req.body;
    if (!stage_id || !status) return res.status(400).json({ error: 'stage_id and status required' });

    const now = new Date().toISOString();
    const updates = {};
    if (status === 'in_progress') updates.started_at = now;
    if (status === 'completed') updates.completed_at = now;

    db.prepare(`UPDATE work_order_stages SET status=?, started_at=COALESCE(?,started_at), completed_at=COALESCE(?,completed_at), notes=COALESCE(?,notes)
      WHERE work_order_id=? AND stage_id=?`)
      .run(status, updates.started_at || null, updates.completed_at || null, req.body.notes || null, req.params.id, stage_id);

    // Auto-advance current_stage_id to next incomplete stage
    const nextStage = db.prepare(`SELECT wos.stage_id FROM work_order_stages wos
      JOIN production_stages ps ON ps.id = wos.stage_id
      WHERE wos.work_order_id=? AND wos.status NOT IN ('completed','skipped')
      ORDER BY ps.sort_order LIMIT 1`).get(req.params.id);

    if (nextStage) {
      db.prepare('UPDATE work_orders SET current_stage_id=?, updated_at=datetime(\'now\') WHERE id=?').run(nextStage.stage_id, req.params.id);
    } else {
      // All stages done — auto-complete work order
      db.prepare("UPDATE work_orders SET status='completed', end_date=datetime('now'), updated_at=datetime('now') WHERE id=?").run(req.params.id);
    }

    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(req.params.id);
    wo.stages = db.prepare(`SELECT wos.*, ps.name as stage_name, ps.color, ps.sort_order
      FROM work_order_stages wos
      JOIN production_stages ps ON ps.id = wos.stage_id
      WHERE wos.work_order_id = ? ORDER BY ps.sort_order`).all(req.params.id);
    res.json(wo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/workorders/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM work_order_fabric_usage WHERE work_order_id=?').run(req.params.id);
    db.prepare('DELETE FROM work_order_stages WHERE work_order_id=?').run(req.params.id);
    db.prepare('DELETE FROM work_orders WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
