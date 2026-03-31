/**
 * Migration 039: Security hardening — soft delete, 2FA, password reset tokens, invitations
 */
module.exports = {
  version: 39,
  description: 'Soft delete flags, 2FA TOTP, password reset tokens, user invitations',
  up(db) {
    // ── Soft-delete columns on major tables ──
    const tables = [
      'fabrics', 'accessories', 'models', 'invoices', 'work_orders',
      'suppliers', 'purchase_orders', 'customers', 'quotations', 'samples'
    ];
    for (const t of tables) {
      try {
        db.exec(`ALTER TABLE ${t} ADD COLUMN is_deleted INTEGER DEFAULT 0`);
      } catch { /* column may already exist */ }
      try {
        db.exec(`ALTER TABLE ${t} ADD COLUMN deleted_at TEXT`);
      } catch { /* column may already exist */ }
      try {
        db.exec(`ALTER TABLE ${t} ADD COLUMN deleted_by INTEGER`);
      } catch { /* column may already exist */ }
    }

    // ── 2FA TOTP columns on users ──
    try { db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`); } catch {}
    try { db.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0`); } catch {}
    try { db.exec(`ALTER TABLE users ADD COLUMN totp_backup_codes TEXT`); } catch {}

    // ── Password reset tokens ──
    db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        token_hash  TEXT NOT NULL UNIQUE,
        expires_at  TEXT NOT NULL,
        used_at     TEXT,
        created_at  TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // ── User sessions — add revoked_at column if missing ──
    try { db.exec(`ALTER TABLE user_sessions ADD COLUMN revoked_at TEXT`); } catch {}

    // ── API key per-key rate limit tracking ──
    try { db.exec(`ALTER TABLE api_keys ADD COLUMN rate_limit INTEGER DEFAULT 100`); } catch {}
    try { db.exec(`ALTER TABLE api_keys ADD COLUMN rate_window_seconds INTEGER DEFAULT 60`); } catch {}

    // ── User invitations ──
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_invitations (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        email       TEXT NOT NULL,
        role        TEXT DEFAULT 'viewer',
        department  TEXT,
        token_hash  TEXT NOT NULL UNIQUE,
        invited_by  INTEGER NOT NULL,
        accepted_at TEXT,
        expires_at  TEXT NOT NULL,
        created_at  TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (invited_by) REFERENCES users(id)
      );
    `);
  },
  down(db) {
    // Remove soft-delete columns via table rebuild is complex in SQLite;
    // just drop the new tables
    db.exec('DROP TABLE IF EXISTS password_reset_tokens');
    db.exec('DROP TABLE IF EXISTS user_sessions');
    db.exec('DROP TABLE IF EXISTS user_invitations');
  }
};
