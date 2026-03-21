const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');
const { generateToken, requireAuth, logAudit } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = ?').get(username, 'active');
    if (!user) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيح' });

    // Account lockout check
    if (user.locked_until) {
      const lockExpiry = new Date(user.locked_until);
      if (lockExpiry > new Date()) {
        const mins = Math.ceil((lockExpiry - new Date()) / 60000);
        return res.status(423).json({ error: `الحساب مقفل. حاول بعد ${mins} دقيقة` });
      }
      // Lock expired, reset
      db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60000).toISOString();
        db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockUntil, user.id);
        return res.status(423).json({ error: 'تم قفل الحساب لمدة 15 دقيقة بسبب محاولات كثيرة' });
      }
      db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id);
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيح' });
    }

    // Reset failed attempts on success
    db.prepare('UPDATE users SET last_login = datetime(?), failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(new Date().toISOString(), user.id);

    const token = generateToken(user);
    
    // Log login
    try {
      db.prepare(`INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, entity_label) VALUES (?,?,?,?,?,?)`)
        .run(user.id, user.username, 'LOGIN', 'user', String(user.id), user.full_name);
    } catch(e) {}

    res.json({
      token,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, department: user.department, must_change_password: !!user.must_change_password }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  try {
    logAudit(req, 'LOGOUT', 'user', req.user.id, req.user.full_name);
    res.json({ message: 'تم تسجيل الخروج' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, full_name, email, role, department, employee_id, status, last_login, created_at, must_change_password FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/auth/change-password
router.put('/change-password', requireAuth, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    if (new_password.length < 8) return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
    if (!/[A-Z]/.test(new_password) || !/[0-9]/.test(new_password)) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تحتوي على حرف كبير ورقم على الأقل' });
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const valid = bcrypt.compareSync(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });

    // Check password history (last 5)
    const history = db.prepare('SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(req.user.id);
    for (const h of history) {
      if (bcrypt.compareSync(new_password, h.password_hash)) {
        return res.status(400).json({ error: 'لا يمكن استخدام كلمة مرور سابقة' });
      }
    }

    const hash = bcrypt.hashSync(new_password, 12);
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = datetime(?) WHERE id = ?').run(hash, new Date().toISOString(), req.user.id);
    // Save to password history
    db.prepare('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)').run(req.user.id, hash);
    logAudit(req, 'UPDATE', 'user', req.user.id, 'change-password');
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/auth/profile — detailed profile with recent activity
router.get('/profile', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, full_name, email, role, department, employee_id, status, last_login, created_at, password_changed_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const recentActivity = db.prepare('SELECT action, entity_type, entity_label, created_at FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
    res.json({ ...user, recent_activity: recentActivity });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/create-admin — first-run only
router.post('/create-admin', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    if (count > 0) return res.status(403).json({ error: 'تم إنشاء حساب المدير مسبقاً' });

    const { username, full_name, password } = req.body;
    if (!username || !full_name || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, full_name, password_hash, role, status) VALUES (?,?,?,?,?)'
    ).run(username, full_name, hash, 'superadmin', 'active');

    res.json({ message: 'تم إنشاء حساب مدير النظام', user_id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
