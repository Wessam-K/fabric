/**
 * Migration 004: Enterprise hardening tables
 * Adds tables for API keys, webhooks, revoked tokens, and notifications.
 */
module.exports = {
  version: 4,
  description: 'API keys, webhooks, revoked_tokens, notifications, backups tables',
  up(db) {
    // API keys table (Phase 3.5)
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        key_hash    TEXT UNIQUE NOT NULL,
        key_prefix  TEXT NOT NULL,
        user_id     INTEGER REFERENCES users(id),
        permissions TEXT DEFAULT '{}',
        last_used   TEXT,
        expires_at  TEXT,
        status      TEXT DEFAULT 'active' CHECK(status IN ('active','revoked')),
        created_at  TEXT DEFAULT (datetime('now'))
      );
    `);

    // Webhooks table (Phase 3.6)
    db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        url             TEXT NOT NULL,
        events          TEXT NOT NULL DEFAULT '[]',
        secret          TEXT,
        status          TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
        failure_count   INTEGER DEFAULT 0,
        last_triggered  TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );
    `);

    // Backups table for tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        filename    TEXT NOT NULL,
        size_bytes  INTEGER,
        status      TEXT DEFAULT 'completed' CHECK(status IN ('completed','failed')),
        trigger     TEXT DEFAULT 'manual',
        created_at  TEXT DEFAULT (datetime('now'))
      );
    `);
  },
  down(db) {
    db.exec('DROP TABLE IF EXISTS api_keys');
    db.exec('DROP TABLE IF EXISTS webhooks');
    db.exec('DROP TABLE IF EXISTS backups');
  }
};
