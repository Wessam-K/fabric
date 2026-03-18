const express = require('express');
const router = express.Router();
const db = require('../database');

// Get notifications for current user
router.get('/', (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { unread_only, limit } = req.query;
    let q = 'SELECT * FROM notifications WHERE user_id=?';
    const p = [userId];
    if (unread_only === 'true') { q += ' AND is_read=0'; }
    q += ' ORDER BY created_at DESC LIMIT ?';
    p.push(parseInt(limit) || 50);
    const notifications = db.prepare(q).all(...p);
    const unread_count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=0').get(userId).count;
    res.json({ notifications, unread_count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark notification as read
router.patch('/:id/read', (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const notif = db.prepare('SELECT * FROM notifications WHERE id=? AND user_id=?').get(req.params.id, userId);
    if (!notif) return res.status(404).json({ error: 'الإشعار غير موجود' });
    db.prepare('UPDATE notifications SET is_read=1 WHERE id=?').run(req.params.id);
    res.json({ message: 'تم التحديث' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark all as read
router.patch('/read-all', (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0').run(userId);
    res.json({ message: 'تم تحديث جميع الإشعارات' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete notification
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const notif = db.prepare('SELECT * FROM notifications WHERE id=? AND user_id=?').get(req.params.id, userId);
    if (!notif) return res.status(404).json({ error: 'الإشعار غير موجود' });
    db.prepare('DELETE FROM notifications WHERE id=?').run(req.params.id);
    res.json({ message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Helper: create notification (used by other routes)
function createNotification(userId, type, title, body, referenceType, referenceId) {
  try {
    db.prepare(`INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id) VALUES (?,?,?,?,?,?)`)
      .run(userId, type, title, body, referenceType || null, referenceId || null);
  } catch (err) { console.error('Notification creation failed:', err.message); }
}

// Broadcast to all users with a specific role
function notifyRole(role, type, title, body, referenceType, referenceId) {
  try {
    const users = db.prepare('SELECT id FROM users WHERE role=? AND status=?').all(role, 'active');
    for (const u of users) {
      createNotification(u.id, type, title, body, referenceType, referenceId);
    }
  } catch (err) { console.error('Role notification failed:', err.message); }
}

router.createNotification = createNotification;
router.notifyRole = notifyRole;

module.exports = router;
