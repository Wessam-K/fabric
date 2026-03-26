const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

const uploadDir = path.join(process.env.WK_DB_DIR || path.join(__dirname, '..'), 'uploads', 'documents');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('نوع الملف غير مدعوم'));
  }
});

// GET /api/documents
router.get('/', requirePermission('documents', 'view'), (req, res) => {
  try {
    const { entity_type, entity_id, category, search, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1 AND d.deleted_at IS NULL'; const params = [];
    if (entity_type) { where += ' AND d.entity_type=?'; params.push(entity_type); }
    if (entity_id) { where += ' AND d.entity_id=?'; params.push(entity_id); }
    if (category) { where += ' AND d.category=?'; params.push(category); }
    if (search) { where += ' AND (d.title LIKE ? OR d.file_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM documents d WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT d.*, u.full_name as uploaded_by_name
      FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by
      WHERE ${where} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/documents/upload
router.post('/upload', requirePermission('documents', 'create'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'الملف مطلوب' });
    const { title, entity_type, entity_id, category, notes } = req.body;

    const result = db.prepare(`INSERT INTO documents 
      (title, file_name, file_path, file_size, mime_type, entity_type, entity_id, category, notes, uploaded_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(
        title || req.file.originalname,
        req.file.originalname,
        `/uploads/documents/${req.file.filename}`,
        req.file.size,
        req.file.mimetype,
        entity_type || null,
        entity_id || null,
        category || null,
        notes || null,
        req.user.id
      );

    logAudit(req, 'UPLOAD', 'document', result.lastInsertRowid, title || req.file.originalname);
    res.status(201).json({ id: result.lastInsertRowid, file_path: `/uploads/documents/${req.file.filename}` });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/documents/:id
router.get('/:id', requirePermission('documents', 'view'), (req, res) => {
  try {
    const doc = db.prepare('SELECT d.*, u.full_name as uploaded_by_name FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by WHERE d.id=?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'المستند غير موجود' });
    res.json(doc);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/documents/:id
router.put('/:id', requirePermission('documents', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, category, notes } = req.body;
    db.prepare('UPDATE documents SET title=COALESCE(?,title), category=COALESCE(?,category), notes=COALESCE(?,notes), updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(title, category, notes, id);
    logAudit(req, 'UPDATE', 'document', id, title);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/documents/:id
router.delete('/:id', requirePermission('documents', 'delete'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(id);
    if (!doc) return res.status(404).json({ error: 'المستند غير موجود' });
    db.prepare("UPDATE documents SET deleted_at=datetime('now','localtime') WHERE id=?").run(id);
    logAudit(req, 'DELETE', 'document', id, doc?.title);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
