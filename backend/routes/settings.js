const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

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
router.put('/', requirePermission('settings', 'edit'), (req, res) => {
  try {
    const ALLOWED_PREFIXES = [
      'masnaiya_', 'masrouf_', 'waste_', 'margin_', 'default_',
      'factory_', 'currency', 'tax_', 'low_stock_', 'working_',
      'maintenance_', 'expense_', 'invoice_', 'po_', 'wo_', 'mo_',
      'backup_', 'session_', 'date_',
    ];
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof key === 'string' && ALLOWED_PREFIXES.some(p => key.startsWith(p))) {
          upsert.run(key, String(value));
        }
      }
    });
    transaction();
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    logAudit(req, 'UPDATE', 'settings', null, 'settings');
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === Production Stages ===

// GET /api/settings/stages
router.get('/stages', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM stage_templates ORDER BY sort_order').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/stages
router.post('/stages', requirePermission('settings', 'edit'), (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM stage_templates').get().m || 0;
    const r = db.prepare('INSERT INTO stage_templates (name, sort_order, color, is_default) VALUES (?,?,?,1)')
      .run(name, sort_order ?? maxOrder + 1, color || '#6b7280');
    res.status(201).json(db.prepare('SELECT * FROM stage_templates WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/stages/:id
router.put('/stages/:id', requirePermission('settings', 'edit'), (req, res) => {
  try {
    const { name, color, sort_order, is_default } = req.body;
    db.prepare('UPDATE stage_templates SET name=COALESCE(?,name), color=COALESCE(?,color), sort_order=COALESCE(?,sort_order), is_default=COALESCE(?,is_default) WHERE id=?')
      .run(name || null, color || null, sort_order ?? null, is_default ?? null, req.params.id);
    res.json(db.prepare('SELECT * FROM stage_templates WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/settings/stages/:id
router.delete('/stages/:id', requirePermission('settings', 'delete'), (req, res) => {
  try {
    db.prepare('DELETE FROM stage_templates WHERE id=?').run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/stages/reorder — bulk update sort_order
router.put('/stages/reorder', requirePermission('settings', 'edit'), (req, res) => {
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
