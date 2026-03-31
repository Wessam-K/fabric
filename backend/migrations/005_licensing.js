/**
 * Migration 005: Licensing support table
 */
module.exports = {
  version: 5,
  description: 'License activation and tracking table',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS license_info (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        license_key    TEXT,
        license_type   TEXT DEFAULT 'trial' CHECK(license_type IN ('trial','standard','professional','enterprise')),
        activated_at   TEXT,
        expires_at     TEXT,
        max_users      INTEGER DEFAULT 3,
        features       TEXT DEFAULT '{}',
        hardware_id    TEXT,
        status         TEXT DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
        updated_at     TEXT DEFAULT (datetime('now'))
      );
    `);
  },
  down(db) {
    db.exec('DROP TABLE IF EXISTS license_info');
  }
};
