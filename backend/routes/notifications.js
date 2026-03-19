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

// GET /api/notifications/count — unread count only (lightweight poll)
router.get('/count', (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=0').get(userId).count;
    res.json({ unread_count: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Generate automatic notifications for low stock, overdue WOs, overdue invoices
function generateNotifications() {
  try {
    const adminUsers = db.prepare("SELECT id FROM users WHERE role IN ('superadmin','manager') AND status='active'").all();
    if (adminUsers.length === 0) return;

    // Low stock fabrics
    const lowFabrics = db.prepare(`SELECT code, name, available_meters, low_stock_threshold FROM fabrics
      WHERE status='active' AND available_meters <= COALESCE(low_stock_threshold, 10)`).all();
    for (const f of lowFabrics) {
      for (const u of adminUsers) {
        const exists = db.prepare(`SELECT id FROM notifications WHERE user_id=? AND reference_type='fabric' AND reference_id=? AND is_read=0 AND type='low_stock'`).get(u.id, f.code);
        if (!exists) {
          createNotification(u.id, 'low_stock', `مخزون قماش منخفض: ${f.name}`, `الكمية المتاحة ${f.available_meters} متر أقل من الحد الأدنى ${f.low_stock_threshold}`, 'fabric', f.code);
        }
      }
    }

    // Low stock accessories
    const lowAcc = db.prepare(`SELECT code, name, quantity_on_hand, low_stock_threshold FROM accessories
      WHERE status='active' AND quantity_on_hand <= COALESCE(low_stock_threshold, 10)`).all();
    for (const a of lowAcc) {
      for (const u of adminUsers) {
        const exists = db.prepare(`SELECT id FROM notifications WHERE user_id=? AND reference_type='accessory' AND reference_id=? AND is_read=0 AND type='low_stock'`).get(u.id, a.code);
        if (!exists) {
          createNotification(u.id, 'low_stock', `مخزون إكسسوار منخفض: ${a.name}`, `الكمية المتاحة ${a.quantity_on_hand} أقل من الحد الأدنى ${a.low_stock_threshold}`, 'accessory', a.code);
        }
      }
    }

    // Overdue work orders (due_date passed, still active)
    const overdueWOs = db.prepare(`SELECT id, wo_number, due_date FROM work_orders
      WHERE status IN ('pending','in_progress') AND due_date IS NOT NULL AND due_date < date('now')`).all();
    for (const wo of overdueWOs) {
      for (const u of adminUsers) {
        const exists = db.prepare(`SELECT id FROM notifications WHERE user_id=? AND reference_type='work_order' AND reference_id=? AND is_read=0 AND type='overdue'`).get(u.id, String(wo.id));
        if (!exists) {
          createNotification(u.id, 'overdue', `أمر عمل متأخر: ${wo.wo_number}`, `تاريخ التسليم المستهدف ${wo.due_date} قد فات`, 'work_order', String(wo.id));
        }
      }
    }

    // Overdue invoices (due_date passed, not paid/cancelled)
    const overdueInv = db.prepare(`SELECT id, invoice_number, due_date FROM invoices
      WHERE status NOT IN ('paid','cancelled') AND due_date < date('now')`).all();
    for (const inv of overdueInv) {
      for (const u of adminUsers) {
        const exists = db.prepare(`SELECT id FROM notifications WHERE user_id=? AND reference_type='invoice' AND reference_id=? AND is_read=0 AND type='overdue'`).get(u.id, String(inv.id));
        if (!exists) {
          createNotification(u.id, 'overdue', `فاتورة متأخرة: ${inv.invoice_number}`, `تاريخ الاستحقاق ${inv.due_date} قد فات`, 'invoice', String(inv.id));
        }
      }
    }
  } catch (err) { console.error('generateNotifications error:', err.message); }
}

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
router.generateNotifications = generateNotifications;

module.exports = router;
