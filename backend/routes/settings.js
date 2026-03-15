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

module.exports = router;
