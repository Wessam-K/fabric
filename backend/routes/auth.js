const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');
const { generateToken, requireAuth, logAudit, revokeToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { setCSRFCookie, clearCSRFCookie } = require('../middleware/csrf');
const jwt = require('jsonwebtoken');
const { validatePassword } = require('../utils/validators');

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = ?').get(username, 'active');
    // Account lockout check
    if (user?.locked_until) {
      const lockExpiry = new Date(user.locked_until);
      if (lockExpiry > new Date()) {
        const mins = Math.ceil((lockExpiry - new Date()) / 60000);
        return res.status(423).json({ error: `الحساب مقفل. حاول بعد ${mins} دقيقة` });
      }
      db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    }
    // Phase 1.7: Constant-time comparison — always run bcrypt even if user not found
    const DUMMY_HASH = '$2b$12$LJ3m4ys3Sz8RkO9kBZqiRuXzHpLmnKFVPGQa2tj8WknN0Fh.2vOu2';
    const valid = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid) {
      if (user) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        if (attempts >= 5) {
          const lockUntil = new Date(Date.now() + 15 * 60000).toISOString();
          db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockUntil, user.id);
          return res.status(423).json({ error: 'تم قفل الحساب لمدة 15 دقيقة بسبب محاولات كثيرة' });
        }
        db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id);
      }
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيح' });
    }

    // Reset failed attempts on success
    db.prepare('UPDATE users SET last_login = datetime(?), failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(new Date().toISOString(), user.id);

    // Phase 1.7: Check if 2FA is enabled
    if (user.totp_enabled) {
      const { totp_code } = req.body;
      if (!totp_code) {
        return res.json({ requires_2fa: true, user_id: user.id });
      }
      // Verify TOTP code or backup code
      let totpValid = false;
      try {
        const { authenticator } = require('otplib');
        totpValid = authenticator.check(totp_code, user.totp_secret);
      } catch { /* otplib not installed — skip */ }
      if (!totpValid) {
        // Check backup codes
        const backups = JSON.parse(user.totp_backup_codes || '[]');
        const idx = backups.indexOf(totp_code);
        if (idx !== -1) {
          backups.splice(idx, 1);
          db.prepare('UPDATE users SET totp_backup_codes = ? WHERE id = ?').run(JSON.stringify(backups), user.id);
          totpValid = true;
        }
      }
      if (!totpValid) {
        return res.status(401).json({ error: 'رمز المصادقة الثنائية غير صحيح' });
      }
    }

    const token = generateToken(user);
    // Phase 1.2: Set httpOnly cookie
    setAuthCookie(res, token);
    // Phase 1.1: Set CSRF cookie for double-submit pattern
    setCSRFCookie(res);
    try {
      db.prepare(`INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, entity_label) VALUES (?,?,?,?,?,?)`)
        .run(user.id, user.username, 'LOGIN', 'user', String(user.id), user.full_name);
    } catch(e) {}

    res.json({
      token,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, department: user.department, must_change_password: !!user.must_change_password }
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/auth/refresh — issue new token if current token still valid
router.post('/refresh', requireAuth, (req, res) => {
  try {
    // Verify user still exists and is active
    const user = db.prepare('SELECT id, username, full_name, role, status FROM users WHERE id = ? AND status = ?').get(req.user.id, 'active');
    if (!user) return res.status(401).json({ error: 'المستخدم غير نشط' });
    const token = generateToken(user);
    // Phase 1.2: Set httpOnly cookie
    setAuthCookie(res, token);
    // Phase 1.1: Refresh CSRF cookie too
    setCSRFCookie(res);
    res.json({ token });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  try {
    // D1: Revoke the token so it can't be reused
    if (req.token) revokeToken(req.token);
    // Phase 1.2: Clear httpOnly cookie
    clearAuthCookie(res);    // Phase 1.1: Clear CSRF cookie
    clearCSRFCookie(res);    logAudit(req, 'LOGOUT', 'user', req.user.id, req.user.full_name);
    res.json({ message: 'تم تسجيل الخروج' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, full_name, email, role, department, employee_id, status, last_login, created_at, must_change_password FROM users WHERE id = ? AND status = ?').get(req.user.id, 'active');
    if (!user) return res.status(401).json({ error: 'الحساب معطل أو غير موجود' });
    res.json(user);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/auth/change-password
router.put('/change-password', requireAuth, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    // Phase 1.5: Use centralized strong password validation
    const pwErr = validatePassword(new_password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const valid = bcrypt.compareSync(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });

    // Check password history (configurable limit)
    const passwordHistoryLimit = parseInt(db.prepare("SELECT value FROM settings WHERE key='password_history_limit'").get()?.value) || 5;
    const history = db.prepare('SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(req.user.id, passwordHistoryLimit);
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
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/auth/profile — detailed profile with recent activity
router.get('/profile', requireAuth, (req, res) => {
  try {
    // Dynamically get available columns to avoid errors with missing migration columns
    const cols = db.pragma('table_info(users)').map(c => c.name);
    const selectCols = ['id', 'username', 'full_name', 'email', 'role', 'department', 'employee_id', 'status', 'last_login', 'created_at', 'password_changed_at']
      .filter(c => cols.includes(c)).join(', ');
    const user = db.prepare(`SELECT ${selectCols} FROM users WHERE id = ?`).get(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const activityLimit = parseInt(db.prepare("SELECT value FROM settings WHERE key='profile_activity_limit'").get()?.value) || 20;
    const recentActivity = db.prepare('SELECT action, entity_type, entity_label, created_at FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(req.user.id, activityLimit);
    res.json({ ...user, recent_activity: recentActivity });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// NOTE: create-admin endpoint is defined in server.js with transaction safety.
// Removed duplicate here to prevent TOCTOU race condition (audit C2).

// ═══ Phase 1.8: Password Reset Flow ═══
const crypto = require('crypto');

// POST /api/auth/forgot-password — generate password reset token
router.post('/forgot-password', (req, res) => {
  try {
    const { username, email } = req.body;
    if (!username && !email) return res.status(400).json({ error: 'اسم المستخدم أو البريد الإلكتروني مطلوب' });

    const user = username
      ? db.prepare("SELECT id, email FROM users WHERE username = ? AND status = 'active'").get(username)
      : db.prepare("SELECT id, email FROM users WHERE email = ? AND status = 'active'").get(email);

    // Always return success to prevent user enumeration
    if (!user) return res.json({ message: 'إذا كان الحساب موجودًا، سيتم إرسال رابط إعادة التعيين' });

    // Generate token (valid 1 hour)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    try {
      db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)')
        .run(user.id, tokenHash, expiresAt);
    } catch {
      // Table may not exist yet if migration hasn't run — return generic message
      return res.json({ message: 'إذا كان الحساب موجودًا، سيتم إرسال رابط إعادة التعيين' });
    }

    // Send reset email (falls back to logger if SMTP not configured)
    const mailer = require('../utils/mailer');
    if (user.email) {
      mailer.sendPasswordReset(user.email, rawToken).catch(() => {});
    } else {
      logger.info('Password reset token generated (no email on file)', { userId: user.id });
    }

    const response = { message: 'إذا كان الحساب موجودًا، سيتم إرسال رابط إعادة التعيين' };
    // Expose token only in automated test mode (never in dev/production)
    if (process.env.NODE_ENV === 'test') {
      response.reset_token = rawToken;
    }
    res.json(response);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/auth/reset-password — consume reset token and set new password
router.post('/reset-password', (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'الرمز وكلمة المرور الجديدة مطلوبان' });

    const pwErr = validatePassword(new_password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    let row;
    try {
      row = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL').get(tokenHash);
    } catch {
      return res.status(400).json({ error: 'رابط إعادة التعيين غير صالح' });
    }

    if (!row) return res.status(400).json({ error: 'رابط إعادة التعيين غير صالح أو مستخدم بالفعل' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'رابط إعادة التعيين منتهي الصلاحية' });

    const hash = bcrypt.hashSync(new_password, 12);
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(hash, row.user_id);
      db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now','localtime') WHERE id = ?").run(row.id);
      // Save to password history
      try { db.prepare('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)').run(row.user_id, hash); } catch {}
    })();

    logAudit({ user: { id: row.user_id } }, 'RESET_PASSWORD', 'user', row.user_id, 'password-reset');
    res.json({ message: 'تم إعادة تعيين كلمة المرور بنجاح' });
  } catch (err) { console.error('Reset password error:', err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
