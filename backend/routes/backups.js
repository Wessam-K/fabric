const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

const backupDir = path.join(process.env.WK_DB_DIR || path.join(__dirname, '..'), 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// GET /api/backups
router.get('/', requirePermission('backups', 'view'), (req, res) => {
  try {
    const rows = db.prepare('SELECT b.*, u.full_name as created_by_name FROM backups b LEFT JOIN users u ON u.id=b.created_by ORDER BY b.created_at DESC').all();
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/backups — create a database backup
router.post('/', requirePermission('backups', 'create'), (req, res) => {
  try {
    const { description } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `wk-hub_backup_${timestamp}.db`;
    const filePath = path.join(backupDir, filename);

    // Use SQLite backup API (better-sqlite3)
    db.backup(filePath).then(() => {
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);
      const sizeMB = (sizeKB / 1024).toFixed(2);

      const result = db.prepare(`INSERT INTO backups (file_name, file_path, file_size, description, status, created_by)
        VALUES (?,?,?,?,'completed',?)`)
        .run(filename, filePath, `${sizeMB} MB`, description || `نسخة احتياطية ${timestamp}`, req.user.id);

      logAudit(req, 'BACKUP', 'database', result.lastInsertRowid, filename);
      res.status(201).json({ id: result.lastInsertRowid, file_name: filename, size: `${sizeMB} MB` });
    }).catch(err => {
      console.error('Backup failed:', err);
      db.prepare("INSERT INTO backups (file_name, file_path, file_size, description, status, created_by) VALUES (?,?,?,'0','failed',?)")
        .run(filename, filePath, 'backup_error', req.user.id);
      res.status(500).json({ error: 'فشل النسخ الاحتياطي' });
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/backups/:id/restore — restore from a backup
router.post('/:id/restore', requirePermission('backups', 'create'), (req, res) => {
  try {
    const backup = db.prepare('SELECT * FROM backups WHERE id=?').get(req.params.id);
    if (!backup) return res.status(404).json({ error: 'النسخة الاحتياطية غير موجودة' });
    // Reconstruct path safely from filename only
    const safePath = path.join(backupDir, path.basename(backup.file_name));
    if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'ملف النسخة الاحتياطية غير موجود' });

    // For safety, we don't auto-restore — just provide the file path
    // Restoration must be done by an admin who stops the server first
    logAudit(req, 'RESTORE_REQUEST', 'database', backup.id, backup.file_name);
    res.json({ 
      message: 'لاستعادة النسخة الاحتياطية، يجب إيقاف الخادم واستبدال ملف قاعدة البيانات يدوياً',
      file_name: backup.file_name
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/backups/:id
router.delete('/:id', requirePermission('backups', 'delete'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const backup = db.prepare('SELECT * FROM backups WHERE id=?').get(id);
    if (!backup) return res.status(404).json({ error: 'النسخة الاحتياطية غير موجودة' });

    // Delete the file — safely reconstruct path
    const safePath = path.join(backupDir, path.basename(backup.file_name));
    if (fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
    }
    db.prepare('DELETE FROM backups WHERE id=?').run(id);
    logAudit(req, 'DELETE', 'backup', id, backup.file_name);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
