const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/notifications/count — unread count only (lightweight poll) — MUST be before /:id
router.get('/count', (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=0').get(userId).count;
    res.json({ unread_count: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/notifications/read-all — MUST be before /:id
router.patch('/read-all', (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0').run(userId);
    res.json({ message: 'تم تحديث جميع الإشعارات' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/notifications/check-overdue
router.post('/check-overdue', (req, res) => {
  try {
    const adminUsers = db.prepare("SELECT id FROM users WHERE role IN ('superadmin','admin','manager') AND status='active'").all();
    if (adminUsers.length === 0) return res.json({ message: 'لا يوجد مستخدمين', created: 0 });
    let created = 0;

    // Overdue invoices
    try {
      const overdue = db.prepare(`SELECT id, invoice_number, customer_name, due_date FROM invoices WHERE status IN ('sent','partial') AND due_date < date('now')`).all();
      for (const inv of overdue) {
        for (const u of adminUsers) {
          const exists = db.prepare('SELECT 1 FROM notifications WHERE user_id=? AND reference_type=? AND reference_id=? AND type=? AND created_at > datetime("now","-1 day")').get(u.id, 'invoice', inv.id, 'overdue_invoice');
          if (!exists) { createNotification(u.id, 'overdue_invoice', 'فاتورة متأخرة', `الفاتورة ${inv.invoice_number} (${inv.customer_name}) متأخرة منذ ${inv.due_date}`, 'invoice', inv.id); created++; }
        }
      }
    } catch {}

    // Low stock accessories
    try {
      const lowStock = db.prepare('SELECT code, name, quantity_on_hand, low_stock_threshold FROM accessories WHERE quantity_on_hand <= low_stock_threshold AND status = "active"').all();
      for (const acc of lowStock) {
        for (const u of adminUsers) {
          const exists = db.prepare('SELECT 1 FROM notifications WHERE user_id=? AND reference_type=? AND reference_id=? AND type=? AND created_at > datetime("now","-1 day")').get(u.id, 'accessory', acc.code, 'low_stock');
          if (!exists) { createNotification(u.id, 'low_stock', 'مخزون منخفض', `${acc.name} (${acc.code}) — الكمية: ${acc.quantity_on_hand} أقل من الحد الأدنى ${acc.low_stock_threshold}`, 'accessory', acc.code); created++; }
        }
      }
    } catch {}

    // Maintenance orders overdue
    try {
      const overdueMO = db.prepare(`SELECT mo.id, mo.title, mo.scheduled_date, m.name as machine_name FROM maintenance_orders mo JOIN machines m ON m.id=mo.machine_id WHERE mo.status NOT IN ('completed','cancelled') AND mo.scheduled_date < date('now')`).all();
      for (const mt of overdueMO) {
        for (const u of adminUsers) {
          const exists = db.prepare('SELECT 1 FROM notifications WHERE user_id=? AND reference_type=? AND reference_id=? AND type=? AND created_at > datetime("now","-1 day")').get(u.id, 'maintenance', mt.id, 'overdue_maintenance');
          if (!exists) { createNotification(u.id, 'overdue_maintenance', 'أمر صيانة متأخر', `${mt.machine_name}: ${mt.title} — مجدول في ${mt.scheduled_date}`, 'maintenance', mt.id); created++; }
        }
      }
    } catch {}

    // Machines broken > 24h
    try {
      const broken = db.prepare(`SELECT id, name, updated_at FROM machines WHERE status='broken' AND updated_at < datetime('now','-24 hours')`).all();
      for (const m of broken) {
        for (const u of adminUsers) {
          const exists = db.prepare('SELECT 1 FROM notifications WHERE user_id=? AND reference_type=? AND reference_id=? AND type=? AND created_at > datetime("now","-1 day")').get(u.id, 'machine', m.id, 'machine_broken');
          if (!exists) { createNotification(u.id, 'machine_broken', 'ماكينة معطلة > 24 ساعة', `${m.name} — معطلة منذ ${m.updated_at}`, 'machine', m.id); created++; }
        }
      }
    } catch {}

    // Expenses pending > 24h
    try {
      const pending = db.prepare(`SELECT id, description, amount FROM expenses WHERE status='pending' AND created_at < datetime('now','-24 hours') AND is_deleted=0`).all();
      for (const exp of pending) {
        for (const u of adminUsers) {
          const exists = db.prepare('SELECT 1 FROM notifications WHERE user_id=? AND reference_type=? AND reference_id=? AND type=? AND created_at > datetime("now","-1 day")').get(u.id, 'expense', exp.id, 'expense_pending');
          if (!exists) { createNotification(u.id, 'expense_pending', 'مصروف بانتظار الاعتماد > 24 ساعة', `${exp.description} — ${exp.amount} ج.م`, 'expense', exp.id); created++; }
        }
      }
    } catch {}

    res.json({ message: `تم إنشاء ${created} إشعار جديد`, created });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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

// Mark notification as read — after all string routes
router.patch('/:id/read', (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const notif = db.prepare('SELECT * FROM notifications WHERE id=? AND user_id=?').get(req.params.id, userId);
    if (!notif) return res.status(404).json({ error: 'الإشعار غير موجود' });
    db.prepare('UPDATE notifications SET is_read=1 WHERE id=?').run(req.params.id);
    res.json({ message: 'تم التحديث' });
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

    // Overdue purchase orders (expected_date passed, still pending/partial)
    const overduePOs = db.prepare(`SELECT id, po_number, expected_date FROM purchase_orders
      WHERE status IN ('draft','sent','partial') AND expected_date IS NOT NULL AND expected_date < date('now')`).all();
    for (const po of overduePOs) {
      for (const u of adminUsers) {
        const exists = db.prepare(`SELECT id FROM notifications WHERE user_id=? AND reference_type='purchase_order' AND reference_id=? AND is_read=0 AND type='overdue'`).get(u.id, String(po.id));
        if (!exists) {
          createNotification(u.id, 'overdue', `أمر شراء متأخر: ${po.po_number}`, `تاريخ التوريد المتوقع ${po.expected_date} قد فات`, 'purchase_order', String(po.id));
        }
      }
    }

    // V17 — Pending expense approvals
    try {
      const pendingExpenses = db.prepare(`SELECT id, description, amount FROM expenses WHERE is_deleted=0 AND status='pending'`).all();
      for (const exp of pendingExpenses) {
        for (const u of adminUsers) {
          const exists = db.prepare(`SELECT id FROM notifications WHERE user_id=? AND reference_type='expense' AND reference_id=? AND is_read=0 AND type='expense_pending'`).get(u.id, String(exp.id));
          if (!exists) {
            createNotification(u.id, 'expense_pending', `مصروف بانتظار الاعتماد`, `${exp.description} — ${exp.amount} ج.م`, 'expense', String(exp.id));
          }
        }
      }
    } catch {}

    // V17 — Maintenance due within 7 days
    try {
      const upcoming = db.prepare(`SELECT mo.id, mo.title, mo.scheduled_date, m.name as machine_name
        FROM maintenance_orders mo JOIN machines m ON m.id=mo.machine_id
        WHERE mo.is_deleted=0 AND mo.status='pending' AND mo.scheduled_date BETWEEN date('now') AND date('now','+7 days')`).all();
      for (const mt of upcoming) {
        for (const u of adminUsers) {
          const exists = db.prepare(`SELECT id FROM notifications WHERE user_id=? AND reference_type='maintenance' AND reference_id=? AND is_read=0 AND type='maintenance_upcoming'`).get(u.id, String(mt.id));
          if (!exists) {
            createNotification(u.id, 'maintenance_upcoming', `صيانة قادمة: ${mt.machine_name}`, `${mt.title} — مجدولة في ${mt.scheduled_date}`, 'maintenance', String(mt.id));
          }
        }
      }
    } catch {}

    // V17 — Maintenance open > 48 hours
    try {
      const stale = db.prepare(`SELECT mo.id, mo.title, m.name as machine_name, mo.created_at
        FROM maintenance_orders mo JOIN machines m ON m.id=mo.machine_id
        WHERE mo.is_deleted=0 AND mo.status IN ('pending','in_progress') AND mo.created_at < datetime('now','-2 days')`).all();
      for (const mt of stale) {
        for (const u of adminUsers) {
          const exists = db.prepare(`SELECT id FROM notifications WHERE user_id=? AND reference_type='maintenance' AND reference_id=? AND is_read=0 AND type='maintenance_stale'`).get(u.id, String(mt.id));
          if (!exists) {
            createNotification(u.id, 'maintenance_stale', `صيانة مفتوحة أكثر من 48 ساعة`, `${mt.machine_name}: ${mt.title}`, 'maintenance', String(mt.id));
          }
        }
      }
    } catch {}
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
