const express = require('express');
const router = express.Router();
const db = require('../database');
const { requirePermission } = require('../middleware/auth');

// GET /api/audit-log — filterable list
router.get('/', requirePermission('audit', 'view'), (req, res) => {
  try {
    const { user_id, action, entity_type, date_from, date_to, search, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];

    if (user_id) { conditions.push('a.user_id = ?'); params.push(user_id); }
    if (action) { conditions.push('a.action = ?'); params.push(action); }
    if (entity_type) { conditions.push('a.entity_type = ?'); params.push(entity_type); }
    if (date_from) { conditions.push('a.created_at >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('a.created_at <= ?'); params.push(date_to + ' 23:59:59'); }
    if (search) { conditions.push('(a.entity_label LIKE ? OR a.username LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (Number(page) - 1) * Number(limit);

    const total = db.prepare(`SELECT COUNT(*) as c FROM audit_log a ${where}`).get(...params).c;
    const logs = db.prepare(`
      SELECT a.* FROM audit_log a ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    res.json({ logs, total, page: Number(page), limit: Number(limit) });
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

module.exports = router;
