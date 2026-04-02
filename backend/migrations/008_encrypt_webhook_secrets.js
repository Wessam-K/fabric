/**
 * Migration 008: Encrypt existing webhook secrets with AES-256-GCM
 */
module.exports = {
  version: 42,
  name: 'encrypt_webhook_secrets',
  up(db) {
    // Only process if webhooks table exists and has rows with plaintext secrets
    try {
      const hooks = db.prepare("SELECT id, secret FROM webhooks WHERE secret IS NOT NULL AND secret != ''").all();
      if (!hooks.length) return;

      const crypto = require('crypto');
      const { JWT_SECRET } = require('../middleware/auth');
      const key = crypto.createHash('sha256').update(JWT_SECRET).digest();

      const update = db.prepare('UPDATE webhooks SET secret = ? WHERE id = ?');
      for (const hook of hooks) {
        // Skip already-encrypted secrets (contain ':')
        if (hook.secret.includes(':')) continue;

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(hook.secret, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag().toString('base64');
        const stored = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
        update.run(stored, hook.id);
      }
    } catch { /* webhooks table may not exist yet */ }
  }
};
