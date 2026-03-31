const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const db = require('../database');
const { requireRole, logAudit } = require('../middleware/auth');
const { validatePassword } = require('../utils/validators');

// ═══ Phase 2.1: User Invitations (MUST be before /:id routes) ═══

// POST /api/users/invite — create user invitation (superadmin only)
router.post('/invite', requireRole('superadmin'), (req, res) => {
  try {
    const { email, role, department } = req.body;
    if (!email) return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });

    try {
      const existing = db.prepare("SELECT id FROM user_invitations WHERE email = ? AND accepted_at IS NULL AND expires_at > datetime('now','localtime')").get(email);
      if (existing) return res.status(400).json({ error: 'تم إرسال دعوة بالفعل لهذا البريد' });
    } catch { /* table may not exist yet */ }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      db.prepare('INSERT INTO user_invitations (email, role, department, token_hash, invited_by, expires_at) VALUES (?,?,?,?,?,?)')
        .run(email, role || 'viewer', department || null, tokenHash, req.user.id, expiresAt);
    } catch {
      return res.status(500).json({ error: 'خطأ في إنشاء الدعوة — تأكد من تشغيل migration 006' });
    }

    logAudit(req, 'INVITE', 'user', null, email);
    const response = { message: 'تم إرسال الدعوة بنجاح', email };
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      response.invite_token = rawToken;
    }
    res.status(201).json(response);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/users/invitations — list pending invitations
router.get('/invitations', requireRole('superadmin'), (req, res) => {
  try {
    const invitations = db.prepare(`
      SELECT ui.id, ui.email, ui.role, ui.department, ui.expires_at, ui.created_at, ui.accepted_at,
        u.full_name as invited_by_name
      FROM user_invitations ui LEFT JOIN users u ON u.id = ui.invited_by
      ORDER BY ui.created_at DESC
    `).all();
    res.json(invitations);
  } catch (err) { res.json([]); }
});

// DELETE /api/users/invitations/:id — revoke invitation
router.delete('/invitations/:id', requireRole('superadmin'), (req, res) => {
  try {
    db.prepare('DELETE FROM user_invitations WHERE id = ? AND accepted_at IS NULL').run(req.params.id);
    res.json({ message: 'تم إلغاء الدعوة' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

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
    // Phase 1.5: Strong password validation
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });

    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, full_name, email, role, department, password_hash, employee_id, created_by) VALUES (?,?,?,?,?,?,?,?)'
    ).run(username, full_name, email || null, role || 'viewer', department || null, hash, employee_id || null, req.user.id);

    logAudit(req, 'CREATE', 'user', result.lastInsertRowid, full_name, null, { username, full_name, role, department });
    res.status(201).json({ id: result.lastInsertRowid, message: 'تم إنشاء المستخدم بنجاح' });
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
    // Phase 1.5: Strong password validation
    const pwErr = validatePassword(new_password);
    if (pwErr) return res.status(400).json({ error: pwErr });

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
