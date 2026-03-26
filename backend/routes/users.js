const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');
const { requireRole, logAudit } = require('../middleware/auth');

// GET /api/users — list all (superadmin only)
router.get('/', requireRole('superadmin'), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, full_name, email, role, department, employee_id, status, last_login, created_at
      FROM users ORDER BY created_at DESC
    `).all();
    res.json(users);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/users — create user (superadmin only)
router.post('/', requireRole('superadmin'), (req, res) => {
  try {
    const { username, full_name, email, role, department, password, employee_id } = req.body;
    if (!username || !full_name || !password) return res.status(400).json({ error: 'الحقول الأساسية مطلوبة' });
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل مع حرف كبير ورقم' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });

    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, full_name, email, role, department, password_hash, employee_id, created_by) VALUES (?,?,?,?,?,?,?,?)'
    ).run(username, full_name, email || null, role || 'viewer', department || null, hash, employee_id || null, req.user.id);

    logAudit(req, 'CREATE', 'user', result.lastInsertRowid, full_name, null, { username, full_name, role, department });
    res.json({ id: result.lastInsertRowid, message: 'تم إنشاء المستخدم بنجاح' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/users/:id
router.get('/:id', requireRole('superadmin'), (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, full_name, email, role, department, employee_id, status, last_login, created_at, created_by
      FROM users WHERE id = ?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json(user);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/users/:id — update user (superadmin only)
router.put('/:id', requireRole('superadmin'), (req, res) => {
  try {
    const id = Number(req.params.id);
    const old = db.prepare('SELECT id, username, full_name, email, role, department, employee_id, status FROM users WHERE id = ?').get(id);
    if (!old) return res.status(404).json({ error: 'المستخدم غير موجود' });

    // Cannot change own role
    if (id === req.user.id && req.body.role && req.body.role !== old.role) {
      return res.status(400).json({ error: 'لا يمكنك تغيير صلاحيتك الخاصة' });
    }

    const { full_name, email, role, department, employee_id, status } = req.body;
    db.prepare(
      'UPDATE users SET full_name=?, email=?, role=?, department=?, employee_id=?, status=? WHERE id=?'
    ).run(full_name || old.full_name, email ?? old.email, role || old.role, department ?? old.department, employee_id ?? old.employee_id, status || old.status, id);

    logAudit(req, 'UPDATE', 'user', id, full_name || old.full_name, old, { full_name, email, role, department, status });
    res.json({ message: 'تم تحديث المستخدم بنجاح' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/users/:id/reset-password (superadmin only)
router.patch('/:id/reset-password', requireRole('superadmin'), (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8 || !/[A-Z]/.test(new_password) || !/\d/.test(new_password)) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل مع حرف كبير ورقم' });

    const user = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const hash = bcrypt.hashSync(new_password, 12);
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(hash, user.id);
    logAudit(req, 'UPDATE', 'user', user.id, user.full_name + ' (reset-password)');
    res.json({ message: 'تم إعادة تعيين كلمة المرور بنجاح' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/users/:id — soft delete (superadmin only)
router.delete('/:id', requireRole('superadmin'), (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });

    const user = db.prepare('SELECT id, full_name, role FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (user.role === 'superadmin') {
      const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='superadmin' AND status='active'").get().c;
      if (adminCount <= 1) return res.status(400).json({ error: 'لا يمكن حذف آخر مدير نظام' });
    }

    db.prepare("UPDATE users SET status='inactive' WHERE id=?").run(id);
    logAudit(req, 'DELETE', 'user', id, user.full_name);
    res.json({ message: 'تم تعطيل المستخدم' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
