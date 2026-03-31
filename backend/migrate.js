/**
 * Database Migration Runner
 * Scans backend/migrations/ for numbered migration files and applies them in order.
 * Each migration must export { version, description, up(db), down(db) }.
 */
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function getCurrentVersion(db) {
  try {
    db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT (datetime(\'now\')))');
    const row = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get();
    return row?.v || 0;
  } catch {
    return 0;
  }
}

function loadMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js') && /^\d+/.test(f))
    .sort()
    .map(f => {
      const mod = require(path.join(MIGRATIONS_DIR, f));
      return { file: f, ...mod };
    });
}

function migrate(db) {
  const current = getCurrentVersion(db);
  const migrations = loadMigrations();
  const pending = migrations.filter(m => m.version > current);

  if (pending.length === 0) return { applied: 0, current };

  const applied = [];
  for (const m of pending) {
    try {
      db.transaction(() => {
        m.up(db);
        db.prepare('INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)').run(m.version);
      })();
      applied.push({ version: m.version, description: m.description });
    } catch (err) {
      console.error(`Migration ${m.file} failed:`, err.message);
      throw err;
    }
  }

  return { applied: applied.length, current: getCurrentVersion(db), details: applied };
}

function rollback(db, targetVersion) {
  const current = getCurrentVersion(db);
  if (targetVersion >= current) return { rolled_back: 0, current };

  const migrations = loadMigrations()
    .filter(m => m.version > targetVersion && m.version <= current)
    .reverse();

  for (const m of migrations) {
    db.transaction(() => {
      m.down(db);
      db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(m.version);
    })();
  }

  return { rolled_back: migrations.length, current: getCurrentVersion(db) };
}

module.exports = { migrate, rollback, getCurrentVersion, loadMigrations };
