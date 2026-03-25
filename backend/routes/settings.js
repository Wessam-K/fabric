const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

// GET /api/settings — return all settings as object
router.get('/', requirePermission('settings', 'view'), (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/settings — update settings
router.put('/', requirePermission('settings', 'edit'), (req, res) => {
  try {
    const ALLOWED_PREFIXES = [
      'masnaiya_', 'masrouf_', 'waste_', 'margin_', 'default_',
      'factory_', 'currency', 'tax_', 'low_stock_', 'working_',
      'maintenance_', 'expense_', 'invoice_', 'po_', 'wo_', 'mo_',
      'backup_', 'session_', 'date_', 'hr_',
      'auto_journal_', 'shipment_', 'quotation_', 'so_', 'sample_',
      'sr_', 'pr_', 'ncr_', 'qc_',
      'je_', 'mnt_', 'mch_', 'cust_', 'emp_', 'fb_',
      'aging_', 'notification_', 'report_', 'dashboard_', 'search_',
    ];
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    const rejected = [];
    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof key === 'string' && ALLOWED_PREFIXES.some(p => key.startsWith(p))) {
          upsert.run(key, String(value));
        } else {
          rejected.push(key);
        }
      }
    });
    transaction();
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    logAudit(req, 'UPDATE', 'settings', null, 'settings');
    const response = { ...settings };
    if (rejected.length > 0) response._rejected_keys = rejected;
    res.json(response);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// NOTE: Stage template CRUD is handled by /api/stage-templates (stagetemplates.js)
// Removed duplicate routes that were previously here

module.exports = router;
