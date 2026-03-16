const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/settings — return all settings as object
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings — update settings
router.put('/', (req, res) => {
  try {
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof key === 'string' && (key.endsWith('_default') || key.startsWith('default_'))) {
          upsert.run(key, String(value));
        }
      }
    });
    transaction();
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === Production Stages ===

// GET /api/settings/stages
router.get('/stages', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM production_stages ORDER BY sort_order').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/stages
router.post('/stages', (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM production_stages').get().m || 0;
    const r = db.prepare('INSERT INTO production_stages (name, sort_order, color) VALUES (?,?,?)')
      .run(name, sort_order ?? maxOrder + 1, color || '#3b82f6');
    res.status(201).json(db.prepare('SELECT * FROM production_stages WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/stages/:id
router.put('/stages/:id', (req, res) => {
  try {
    const { name, color, sort_order, is_active } = req.body;
    db.prepare('UPDATE production_stages SET name=COALESCE(?,name), color=COALESCE(?,color), sort_order=COALESCE(?,sort_order), is_active=COALESCE(?,is_active) WHERE id=?')
      .run(name || null, color || null, sort_order ?? null, is_active ?? null, req.params.id);
    res.json(db.prepare('SELECT * FROM production_stages WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/settings/stages/:id
router.delete('/stages/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM production_stages WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/stages/reorder — bulk update sort_order
router.put('/stages/reorder', (req, res) => {
  try {
    const { order } = req.body; // [{id, sort_order}]
    const upd = db.prepare('UPDATE production_stages SET sort_order=? WHERE id=?');
    const transaction = db.transaction(() => {
      (order || []).forEach(item => upd.run(item.sort_order, item.id));
    });
    transaction();
    res.json(db.prepare('SELECT * FROM production_stages ORDER BY sort_order').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
