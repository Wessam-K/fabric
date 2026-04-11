/**
 * Phase 1.7: Two-Factor Authentication (TOTP) routes
 * Uses otplib for TOTP generation/verification and qrcode for QR code generation
 * V59: Backup codes are bcrypt-hashed before storage
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAuth, logAudit } = require('../middleware/auth');

let authenticator, totp;
try {
  const otplib = require('otplib');
  authenticator = otplib.authenticator;
  totp = otplib.totp;
} catch (e) {
  console.error('FATAL: otplib not available — 2FA will be disabled:', e.message);
}

let QRCode;
try { QRCode = require('qrcode'); } catch {}

// POST /api/auth/2fa/setup — generate TOTP secret and QR code
router.post('/setup', requireAuth, async (req, res) => {
  if (!authenticator) return res.status(501).json({ error: '2FA not available — otplib not installed' });
  try {
    const user = db.prepare('SELECT id, username, totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (user.totp_enabled) return res.status(400).json({ error: '2FA is already enabled' });

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.username, 'WK-Factory', secret);

    // Store secret temporarily (not enabled until verified)
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, user.id);

    let qrDataUrl = null;
    if (QRCode) {
      qrDataUrl = await QRCode.toDataURL(otpauth);
    }

    // Generate backup codes — show plaintext to user, store hashed
    const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex'));
    const hashedCodes = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 10)));
    db.prepare('UPDATE users SET totp_backup_codes = ? WHERE id = ?').run(JSON.stringify(hashedCodes), user.id);

    res.json({ secret, otpauth, qr: qrDataUrl, backup_codes: backupCodes });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/auth/2fa/verify — verify TOTP code and enable 2FA
router.post('/verify', requireAuth, (req, res) => {
  if (!authenticator) return res.status(501).json({ error: '2FA not available' });
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'رمز التحقق مطلوب' });

    const user = db.prepare('SELECT id, totp_secret, totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.totp_secret) return res.status(400).json({ error: 'Setup 2FA first' });
    if (user.totp_enabled) return res.status(400).json({ error: '2FA is already enabled' });

    const isValid = authenticator.check(code, user.totp_secret);
    if (!isValid) return res.status(400).json({ error: 'رمز التحقق غير صحيح' });

    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
    logAudit(req, 'ENABLE_2FA', 'user', user.id, req.user.full_name);
    res.json({ message: 'تم تفعيل المصادقة الثنائية بنجاح' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/auth/2fa/disable — disable 2FA
router.post('/disable', requireAuth, async (req, res) => {
  if (!authenticator) return res.status(501).json({ error: '2FA not available' });
  try {
    const { code, password } = req.body;
    if (!password) return res.status(400).json({ error: 'كلمة المرور مطلوبة' });

    const user = db.prepare('SELECT id, password_hash, totp_secret, totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });

    const bcrypt = require('bcryptjs');
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }

    // Verify TOTP or backup code
    let valid = false;
    if (code && authenticator.check(code, user.totp_secret)) {
      valid = true;
    } else if (code) {
      // Check backup codes (hashed with bcrypt)
      const backups = JSON.parse(user.totp_backup_codes || '[]');
      for (let i = 0; i < backups.length; i++) {
        if (await bcrypt.compare(code, backups[i])) {
          backups.splice(i, 1);
          db.prepare('UPDATE users SET totp_backup_codes = ? WHERE id = ?').run(JSON.stringify(backups), user.id);
          valid = true;
          break;
        }
      }
    }
    if (!valid) return res.status(400).json({ error: 'رمز التحقق غير صحيح' });

    db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_backup_codes = NULL WHERE id = ?').run(user.id);
    logAudit(req, 'DISABLE_2FA', 'user', user.id, req.user.full_name);
    res.json({ message: 'تم إلغاء تفعيل المصادقة الثنائية' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
