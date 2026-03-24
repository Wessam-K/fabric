const express = require('express');
const router = express.Router();
const db = require('../database');
const { requirePermission } = require('../middleware/auth');

// GET /api/stage-templates
router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM stage_templates ORDER BY sort_order').all());
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// POST /api/stage-templates
router.post('/', requirePermission('settings', 'edit'), (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM stage_templates').get().m || 0;
    const r = db.prepare('INSERT INTO stage_templates (name, sort_order, color, is_default) VALUES (?,?,?,1)')
      .run(name, sort_order ?? maxOrder + 1, color || '#6b7280');
    res.status(201).json(db.prepare('SELECT * FROM stage_templates WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// PUT /api/stage-templates/reorder — bulk update sort_order (MUST be before :id route)
router.put('/reorder', requirePermission('settings', 'edit'), (req, res) => {
  try {
    const { order } = req.body; // [{id, sort_order}]
    const upd = db.prepare('UPDATE stage_templates SET sort_order=? WHERE id=?');
    const transaction = db.transaction(() => {
      (order || []).forEach(item => upd.run(item.sort_order, item.id));
    });
    transaction();
    res.json(db.prepare('SELECT * FROM stage_templates ORDER BY sort_order').all());
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// PUT /api/stage-templates/:id
router.put('/:id', requirePermission('settings', 'edit'), (req, res) => {
  try {
    const { name, color, sort_order, is_default } = req.body;
    db.prepare('UPDATE stage_templates SET name=COALESCE(?,name), color=COALESCE(?,color), sort_order=COALESCE(?,sort_order), is_default=COALESCE(?,is_default) WHERE id=?')
      .run(name || null, color || null, sort_order ?? null, is_default ?? null, req.params.id);
    res.json(db.prepare('SELECT * FROM stage_templates WHERE id=?').get(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// DELETE /api/stage-templates/:id
router.delete('/:id', requirePermission('settings', 'delete'), (req, res) => {
  try {
    db.prepare('DELETE FROM stage_templates WHERE id=?').run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

module.exports = router;
