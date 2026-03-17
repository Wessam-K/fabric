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

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيح' });

    db.prepare('UPDATE users SET last_login = datetime(?) WHERE id = ?').run(new Date().toISOString(), user.id);

    const token = generateToken(user);
    
    // Log login
    try {
      db.prepare(`INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, entity_label) VALUES (?,?,?,?,?,?)`)
        .run(user.id, user.username, 'LOGIN', 'user', String(user.id), user.full_name);
    } catch(e) {}

    res.json({
      token,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, department: user.department }
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
    const user = db.prepare('SELECT id, username, full_name, email, role, department, employee_id, status, last_login, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/auth/change-password
router.put('/change-password', requireAuth, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    if (new_password.length < 6) return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const valid = bcrypt.compareSync(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });

    const hash = bcrypt.hashSync(new_password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    logAudit(req, 'UPDATE', 'user', req.user.id, 'change-password');
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
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
