/**
 * WK-Hub Database Backup Utility
 * Creates timestamped backup of the SQLite database
 */
const fs = require('fs');
const path = require('path');

const DB_DIR = process.env.WK_DB_DIR || __dirname;
const DB_PATH = path.join(DB_DIR, 'wk-hub.db');
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const MAX_BACKUPS = 10;

function backup() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('Database file not found:', DB_PATH);
    process.exit(1);
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = path.join(BACKUP_DIR, `wk-hub_${timestamp}.db`);

  // Use SQLite's WAL checkpoint before backup
  try {
    const db = require('./database');
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {}

  fs.copyFileSync(DB_PATH, backupFile);

  // V59: Verify backup integrity
  try {
    const BetterSqlite3 = require('better-sqlite3');
    const backupDb = new BetterSqlite3(backupFile, { readonly: true });
    const check = backupDb.pragma('quick_check');
    backupDb.close();
    if (!check || !check.length || check[0].quick_check !== 'ok') {
      console.error('Backup integrity check FAILED — removing corrupt backup');
      fs.unlinkSync(backupFile);
      process.exit(1);
    }
    console.log('Backup integrity verified: OK');
  } catch (err) {
    console.error('Backup integrity check error:', err.message);
    fs.unlinkSync(backupFile);
    process.exit(1);
  }

  console.log(`Backup created: ${backupFile}`);

  // Copy WAL file if exists
  const walPath = DB_PATH + '-wal';
  if (fs.existsSync(walPath)) {
    fs.copyFileSync(walPath, backupFile + '-wal');
  }

  // Rotate old backups
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('wk-hub_') && f.endsWith('.db'))
    .sort()
    .reverse();

  if (backups.length > MAX_BACKUPS) {
    for (const old of backups.slice(MAX_BACKUPS)) {
      const oldPath = path.join(BACKUP_DIR, old);
      fs.unlinkSync(oldPath);
      // Remove associated WAL file
      const oldWal = oldPath + '-wal';
      if (fs.existsSync(oldWal)) fs.unlinkSync(oldWal);
      console.log(`Removed old backup: ${old}`);
    }
  }

  console.log(`Total backups: ${Math.min(backups.length, MAX_BACKUPS)}`);
}

if (require.main === module) {
  backup();
}

module.exports = backup;
