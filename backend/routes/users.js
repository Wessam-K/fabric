const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const inviteRouter = express.Router();
const db = require('../database');
const { requireRole, logAudit } = require('../middleware/auth');
const { validatePassword } = require('../utils/validators');
const { requireUserLimit } = require('../middleware/licenseGuard');

// Avatar upload setup
const avatarDir = path.join(process.env.WK_DB_DIR || path.join(__dirname, '..'), 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '.jpg';
    cb(null, `avatar-${req.params.id}-${Date.now()}${ext}`);
  }
});
const avatarUpload = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

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

    // Send invitation email (falls back to logger if SMTP not configured)
    const mailer = require('../utils/mailer');
    mailer.sendInvitation(email, rawToken, role || 'viewer').catch(() => {});

    const response = { message: 'تم إرسال الدعوة بنجاح', email };
    // Expose token only in automated test mode (never in dev/production)
    if (process.env.NODE_ENV === 'test') {
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

// GET /api/users/invite/validate/:token — validate invitation token (public)
router.get('/invite/validate/:token', (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const invite = db.prepare(
      "SELECT id, email, role, department FROM user_invitations WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > datetime('now','localtime')"
    ).get(tokenHash);
    if (!invite) return res.status(404).json({ error: 'رابط الدعوة غير صالح أو منتهي الصلاحية' });
    res.json({ email: invite.email, role: invite.role, department: invite.department });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// Public invite router (mounted without auth in server.js)
inviteRouter.get('/validate/:token', (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const invite = db.prepare(
      "SELECT id, email, role, department FROM user_invitations WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > datetime('now','localtime')"
    ).get(tokenHash);
    if (!invite) return res.status(404).json({ error: 'رابط الدعوة غير صالح أو منتهي الصلاحية' });
    res.json({ email: invite.email, role: invite.role, department: invite.department });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/users/invite/accept — accept invitation and create user (public)
router.post('/invite/accept', (req, res) => {
  try {
    const { token, username, full_name, password } = req.body;
    if (!token || !username || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    if (username.length < 3) return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' });

    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ error: passErr });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = db.prepare(
      "SELECT id, email, role, department FROM user_invitations WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > datetime('now','localtime')"
    ).get(tokenHash);
    if (!invite) return res.status(400).json({ error: 'رابط الدعوة غير صالح أو منتهي الصلاحية' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, full_name, email, password_hash, role, department, status) VALUES (?,?,?,?,?,?,?)'
    ).run(username, full_name || username, invite.email, hash, invite.role, invite.department, 'active');

    db.prepare("UPDATE user_invitations SET accepted_at = datetime('now','localtime') WHERE id = ?").run(invite.id);

    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user_id: result.lastInsertRowid });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// Public invite accept (mounted without auth)
inviteRouter.post('/accept', (req, res) => {
  try {
    const { token, username, full_name, password } = req.body;
    if (!token || !username || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    if (username.length < 3) return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' });

    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ error: passErr });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = db.prepare(
      "SELECT id, email, role, department FROM user_invitations WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > datetime('now','localtime')"
    ).get(tokenHash);
    if (!invite) return res.status(400).json({ error: 'رابط الدعوة غير صالح أو منتهي الصلاحية' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, full_name, email, password_hash, role, department, status) VALUES (?,?,?,?,?,?,?)'
    ).run(username, full_name || username, invite.email, hash, invite.role, invite.department, 'active');

    db.prepare("UPDATE user_invitations SET accepted_at = datetime('now','localtime') WHERE id = ?").run(invite.id);

    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user_id: result.lastInsertRowid });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/users — list all (superadmin only)
router.get('/', requireRole('superadmin'), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, full_name, email, role, department, employee_id, status, last_login, created_at, locked_until, failed_login_attempts
      FROM users ORDER BY created_at DESC
    `).all();
    res.json(users);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/users — create user (superadmin only, license user limit enforced)
router.post('/', requireRole('superadmin'), requireUserLimit(), (req, res) => {
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

// POST /api/users/import — import users from CSV/XLSX (superadmin only)
router.post('/import', requireRole('superadmin'), avatarUpload.single('file'), async (req, res) => {
  try {
    let rows = [];
    if (req.body.users) {
      rows = JSON.parse(req.body.users);
    } else if (req.file) {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(req.file.path);
      const ws = wb.worksheets[0];
      const headers = [];
      ws.getRow(1).eachCell((cell, i) => { headers[i] = String(cell.value).trim().toLowerCase(); });
      ws.eachRow((row, i) => {
        if (i === 1) return;
        const obj = {};
        row.eachCell((cell, ci) => { if (headers[ci]) obj[headers[ci]] = String(cell.value || '').trim(); });
        if (obj.username) rows.push(obj);
      });
      const fs = require('fs'); try { fs.unlinkSync(req.file.path); } catch {}
    }
    if (!rows.length) return res.status(400).json({ error: 'لا توجد بيانات للاستيراد' });
    const created = [];
    const errors = [];
    for (const row of rows) {
      const { username, full_name, email, role, department, password } = row;
      if (!username || !full_name) { errors.push({ username, error: 'الاسم واسم المستخدم مطلوبين' }); continue; }
      const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username);
      if (exists) { errors.push({ username, error: 'موجود مسبقاً' }); continue; }
      const hash = bcrypt.hashSync(password || 'Change@123', 10);
      const validRole = ROLES_LIST.includes(role) ? role : 'viewer';
      db.prepare('INSERT INTO users (username, full_name, email, role, department, password_hash, must_change_password) VALUES (?,?,?,?,?,?,1)')
        .run(username, full_name, email || '', validRole, department || '', hash);
      created.push(username);
    }
    logAudit(req, 'IMPORT', 'user', null, `imported ${created.length} users`);
    res.json({ created: created.length, errors });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

const ROLES_LIST = ['superadmin', 'manager', 'accountant', 'production', 'hr', 'viewer'];

// POST /api/users/bulk — bulk operations (superadmin only)
router.post('/bulk', requireRole('superadmin'), (req, res) => {
  try {
    const { ids, action, role } = req.body;
    if (!Array.isArray(ids) || !ids.length || !action) return res.status(400).json({ error: 'بيانات غير صالحة' });
    const validActions = ['activate', 'deactivate', 'change_role'];
    if (!validActions.includes(action)) return res.status(400).json({ error: 'عملية غير صالحة' });
    // Prevent self-deactivation
    if (action === 'deactivate' && ids.includes(req.user.id)) return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك' });
    const placeholders = ids.map(() => '?').join(',');
    if (action === 'activate') {
      db.prepare(`UPDATE users SET status='active' WHERE id IN (${placeholders})`).run(...ids);
    } else if (action === 'deactivate') {
      db.prepare(`UPDATE users SET status='inactive' WHERE id IN (${placeholders})`).run(...ids);
    } else if (action === 'change_role') {
      if (!role) return res.status(400).json({ error: 'الدور مطلوب' });
      db.prepare(`UPDATE users SET role=? WHERE id IN (${placeholders})`).run(role, ...ids);
    }
    logAudit(req, 'BULK_UPDATE', 'user', null, `${action} ${ids.length} users`);
    res.json({ success: true, count: ids.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/users/:id/avatar — upload avatar image
router.post('/:id/avatar', avatarUpload.single('avatar'), (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user.id !== userId && req.user.role !== 'superadmin') return res.status(403).json({ error: 'ممنوع' });
    if (!req.file) return res.status(400).json({ error: 'يرجى اختيار صورة' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    // Remove old avatar file if exists
    const old = db.prepare('SELECT avatar_url FROM users WHERE id=?').get(userId);
    if (old?.avatar_url) {
      const oldPath = path.join(process.env.WK_DB_DIR || path.join(__dirname, '..'), old.avatar_url);
      try { fs.unlinkSync(oldPath); } catch {}
    }
    db.prepare('UPDATE users SET avatar_url=? WHERE id=?').run(avatarUrl, userId);
    res.json({ avatar_url: avatarUrl });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/users/:id/unlock — unlock a locked account (superadmin only)
router.post('/:id/unlock', requireRole('superadmin'), (req, res) => {
  try {
    const user = db.prepare('SELECT id, full_name, locked_until FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    logAudit(req, 'UPDATE', 'user', user.id, user.full_name + ' (unlock)');
    res.json({ message: 'تم فك قفل الحساب بنجاح' });
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
module.exports.inviteRouter = inviteRouter;
