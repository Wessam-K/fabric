const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/stage-templates
router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM stage_templates ORDER BY sort_order').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/stage-templates
router.post('/', (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM stage_templates').get().m || 0;
    const r = db.prepare('INSERT INTO stage_templates (name, sort_order, color, is_default) VALUES (?,?,?,1)')
      .run(name, sort_order ?? maxOrder + 1, color || '#6b7280');
    res.status(201).json(db.prepare('SELECT * FROM stage_templates WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/stage-templates/:id
router.put('/:id', (req, res) => {
  try {
    const { name, color, sort_order, is_default } = req.body;
    db.prepare('UPDATE stage_templates SET name=COALESCE(?,name), color=COALESCE(?,color), sort_order=COALESCE(?,sort_order), is_default=COALESCE(?,is_default) WHERE id=?')
      .run(name || null, color || null, sort_order ?? null, is_default ?? null, req.params.id);
    res.json(db.prepare('SELECT * FROM stage_templates WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/stage-templates/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM stage_templates WHERE id=?').run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/stage-templates/reorder — bulk update sort_order
router.put('/reorder', (req, res) => {
  try {
    const { order } = req.body; // [{id, sort_order}]
    const upd = db.prepare('UPDATE stage_templates SET sort_order=? WHERE id=?');
    const transaction = db.transaction(() => {
      (order || []).forEach(item => upd.run(item.sort_order, item.id));
    });
    transaction();
    res.json(db.prepare('SELECT * FROM stage_templates ORDER BY sort_order').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
