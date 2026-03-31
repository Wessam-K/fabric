/**
 * Migration 040: Import jobs table for async bulk import with progress tracking
 */
module.exports = {
  version: 40,
  description: 'Import jobs table for progress tracking, user_preferences table',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS import_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        mode TEXT DEFAULT 'insert',
        total_rows INTEGER DEFAULT 0,
        processed_rows INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        errors TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        completed_at TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        preference_key TEXT NOT NULL,
        preference_value TEXT,
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, preference_key)
      );
    `);
  }
};
