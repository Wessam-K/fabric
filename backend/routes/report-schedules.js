const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit } = require('../middleware/auth');

// List all schedules
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM report_schedules ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({ ...r, recipients: JSON.parse(r.recipients || '[]'), filters: JSON.parse(r.filters || '{}') })));
});

// Create schedule
router.post('/', (req, res) => {
  const { name, report_type, frequency, day_of_week, day_of_month, hour, recipients, filters, format } = req.body;
  if (!name || !report_type || !recipients?.length) return res.status(400).json({ error: 'الاسم ونوع التقرير والمستلمين مطلوبين' });

  const nextRun = computeNextRun(frequency || 'weekly', day_of_week, day_of_month, hour);
  const result = db.prepare(
    'INSERT INTO report_schedules (name, report_type, frequency, day_of_week, day_of_month, hour, recipients, filters, format, next_run_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(name, report_type, frequency || 'weekly', day_of_week || 0, day_of_month || 1, hour ?? 8, JSON.stringify(recipients), JSON.stringify(filters || {}), format || 'xlsx', nextRun, req.user.id);
  logAudit(req, 'create', 'report_schedule', result.lastInsertRowid, name);
  res.status(201).json({ id: result.lastInsertRowid });
});

// Update schedule
router.put('/:id', (req, res) => {
  const schedule = db.prepare('SELECT * FROM report_schedules WHERE id=?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'غير موجود' });
  const { name, report_type, frequency, day_of_week, day_of_month, hour, recipients, filters, format, enabled } = req.body;
  const nextRun = computeNextRun(frequency || schedule.frequency, day_of_week ?? schedule.day_of_week, day_of_month ?? schedule.day_of_month, hour ?? schedule.hour);
  db.prepare(
    'UPDATE report_schedules SET name=?, report_type=?, frequency=?, day_of_week=?, day_of_month=?, hour=?, recipients=?, filters=?, format=?, enabled=?, next_run_at=? WHERE id=?'
  ).run(
    name || schedule.name, report_type || schedule.report_type, frequency || schedule.frequency,
    day_of_week ?? schedule.day_of_week, day_of_month ?? schedule.day_of_month, hour ?? schedule.hour,
    JSON.stringify(recipients || JSON.parse(schedule.recipients)), JSON.stringify(filters || JSON.parse(schedule.filters)),
    format || schedule.format, enabled ?? schedule.enabled, nextRun, req.params.id
  );
  logAudit(req, 'update', 'report_schedule', parseInt(req.params.id), name);
  res.json({ success: true });
});

// Delete schedule
router.delete('/:id', (req, res) => {
  const schedule = db.prepare('SELECT * FROM report_schedules WHERE id=?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'غير موجود' });
  db.prepare('DELETE FROM report_schedules WHERE id=?').run(req.params.id);
  logAudit(req, 'delete', 'report_schedule', parseInt(req.params.id), schedule.name);
  res.json({ success: true });
});

// Toggle enabled
router.post('/:id/toggle', (req, res) => {
  const schedule = db.prepare('SELECT * FROM report_schedules WHERE id=?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'غير موجود' });
  const newEnabled = schedule.enabled ? 0 : 1;
  db.prepare('UPDATE report_schedules SET enabled=? WHERE id=?').run(newEnabled, req.params.id);
  res.json({ enabled: newEnabled });
});

function computeNextRun(frequency, dayOfWeek, dayOfMonth, hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour ?? 8, 0, 0, 0);

  if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    const day = dayOfWeek ?? 0;
    next.setDate(next.getDate() + ((7 + day - next.getDay()) % 7 || 7));
    if (next <= now) next.setDate(next.getDate() + 7);
  } else if (frequency === 'monthly') {
    const d = dayOfMonth ?? 1;
    next.setDate(d);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = router;
