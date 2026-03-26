/**
 * Database Migration Manager for Electron updates.
 * 
 * Works alongside the backend's existing runMigrations() in database.js.
 * This module handles:
 *   - Pre-migration DB backup
 *   - Version-aware migration detection
 *   - Rollback on failure
 *   - Migration status reporting for the Electron UI
 */
const fs = require('fs');
const path = require('path');

/**
 * Get current DB schema version.
 * @param {string} dbPath - Full path to wk-hub.db
 * @returns {number} Current schema version
 */
function getSchemaVersion(dbPath) {
  let db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get();
    return row?.v || 0;
  } catch {
    return 0;
  } finally {
    if (db) try { db.close(); } catch {}
  }
}

/**
 * Create a timestamped backup of the database.
 * @param {string} dbPath - Full path to wk-hub.db
 * @param {string} backupDir - Directory to store backups
 * @returns {{ success: boolean, backupPath?: string, error?: string }}
 */
function backupDatabase(dbPath, backupDir) {
  if (!fs.existsSync(dbPath)) {
    return { success: false, error: 'Database file not found' };
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const version = getSchemaVersion(dbPath);
  const backupName = `wk-hub_v${version}_${timestamp}.db`;
  const backupPath = path.join(backupDir, backupName);

  try {
    // Use SQLite's online backup API via better-sqlite3
    const Database = require('better-sqlite3');
    const src = new Database(dbPath, { readonly: true });
    src.backup(backupPath).then(() => {
      src.close();
    }).catch(() => {
      src.close();
      // Fallback: file copy
      fs.copyFileSync(dbPath, backupPath);
    });

    // Synchronous fallback if backup file doesn't exist yet
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }

    return { success: true, backupPath };
  } catch (err) {
    // Last resort: raw file copy
    try {
      fs.copyFileSync(dbPath, backupPath);
      return { success: true, backupPath };
    } catch (copyErr) {
      return { success: false, error: copyErr.message };
    }
  }
}

/**
 * Restore database from a backup file.
 * @param {string} backupPath - Full path to backup file
 * @param {string} dbPath - Full path to target wk-hub.db
 * @returns {{ success: boolean, error?: string }}
 */
function restoreDatabase(backupPath, dbPath) {
  if (!fs.existsSync(backupPath)) {
    return { success: false, error: 'Backup file not found' };
  }

  try {
    // Remove WAL and SHM files first
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    fs.copyFileSync(backupPath, dbPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * List available backups.
 * @param {string} backupDir
 * @returns {Array<{ name: string, path: string, size: number, date: string }>}
 */
function listBackups(backupDir) {
  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.db') && f.startsWith('wk-hub_'))
    .map(f => {
      const fp = path.join(backupDir, f);
      const stat = fs.statSync(fp);
      return {
        name: f,
        path: fp,
        size: stat.size,
        date: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Clean old backups, keeping only the most recent N.
 * @param {string} backupDir
 * @param {number} keep - Number of backups to keep (default 10)
 */
function pruneBackups(backupDir, keep = 10) {
  const backups = listBackups(backupDir);
  if (backups.length <= keep) return 0;

  let removed = 0;
  for (const b of backups.slice(keep)) {
    try {
      fs.unlinkSync(b.path);
      removed++;
    } catch { /* ignore */ }
  }
  return removed;
}

/**
 * Get database file info.
 * @param {string} dbPath
 * @returns {{ exists: boolean, size?: number, version?: number, path: string }}
 */
function getDbInfo(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return { exists: false, path: dbPath };
  }
  const stat = fs.statSync(dbPath);
  return {
    exists: true,
    size: stat.size,
    version: getSchemaVersion(dbPath),
    path: dbPath,
    modified: stat.mtime.toISOString(),
  };
}

module.exports = {
  getSchemaVersion,
  backupDatabase,
  restoreDatabase,
  listBackups,
  pruneBackups,
  getDbInfo,
};
