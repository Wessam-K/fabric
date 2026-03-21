const express = require('express');
const router = express.Router();
const multer = require('multer');
const { logAudit } = require('../middleware/auth');
const path = require('path');
const db = require('../database');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'fabrics')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `fab-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

router.get('/', (req, res) => {
  try {
    const { type, status, search, supplier_id, page, limit } = req.query;
    let q = 'SELECT f.*, s.name as supplier_name FROM fabrics f LEFT JOIN suppliers s ON s.id=f.supplier_id WHERE 1=1';
    const p = [];
    if (type) { q += ' AND f.fabric_type = ?'; p.push(type); }
    if (status) { q += ' AND f.status = ?'; p.push(status); }
    if (supplier_id) { q += ' AND f.supplier_id = ?'; p.push(supplier_id); }
    if (search) { q += ' AND (f.code LIKE ? OR f.name LIKE ? OR f.supplier LIKE ? OR s.name LIKE ?)'; const s = `%${search}%`; p.push(s, s, s, s); }
    q += ' ORDER BY f.created_at DESC';
    if (page && limit) {
      const countQ = q.replace(/SELECT f\.\*, s\.name as supplier_name/, 'SELECT COUNT(*) as total');
      const total = db.prepare(countQ).get(...p).total;
      const pg = parseInt(page) || 1;
      const lim = parseInt(limit) || 25;
      q += ' LIMIT ? OFFSET ?';
      p.push(lim, (pg - 1) * lim);
      const data = db.prepare(q).all(...p);
      return res.json({ data, total, page: pg, totalPages: Math.ceil(total / lim) });
    }
    res.json(db.prepare(q).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', upload.single('image'), (req, res) => {
  try {
    const { code, name, fabric_type, price_per_m, supplier, supplier_id, color, notes } = req.body;
    if (!code || !name || !price_per_m) return res.status(400).json({ error: 'الكود والاسم وسعر المتر مطلوبين' });
    const image_path = req.file ? `/uploads/fabrics/${req.file.filename}` : null;
    const r = db.prepare(`INSERT INTO fabrics (code,name,fabric_type,price_per_m,supplier,supplier_id,color,image_path,notes) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(code, name, fabric_type || 'main', parseFloat(price_per_m), supplier || null, supplier_id || null, color || null, image_path, notes || null);
    const created = db.prepare('SELECT * FROM fabrics WHERE id=?').get(r.lastInsertRowid);
    logAudit(req, 'CREATE', 'fabric', code, name);
    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود القماش موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:code', upload.single('image'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM fabrics WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    const { name, fabric_type, price_per_m, supplier, supplier_id, color, status, notes } = req.body;
    const image_path = req.file ? `/uploads/fabrics/${req.file.filename}` : existing.image_path;
    db.prepare(`UPDATE fabrics SET name=COALESCE(?,name),fabric_type=COALESCE(?,fabric_type),price_per_m=COALESCE(?,price_per_m),supplier=COALESCE(?,supplier),supplier_id=COALESCE(?,supplier_id),color=COALESCE(?,color),image_path=COALESCE(?,image_path),status=COALESCE(?,status),notes=COALESCE(?,notes) WHERE code=?`)
      .run(name||null, fabric_type||null, price_per_m?parseFloat(price_per_m):null, supplier||null, supplier_id||null, color||null, image_path, status||null, notes||null, req.params.code);
    const updated = db.prepare('SELECT * FROM fabrics WHERE code=?').get(req.params.code);
    logAudit(req, 'UPDATE', 'fabric', req.params.code, existing.name, existing, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:code/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لا توجد صورة' });
    const image_path = `/uploads/fabrics/${req.file.filename}`;
    db.prepare('UPDATE fabrics SET image_path=? WHERE code=?').run(image_path, req.params.code);
    res.json({ image_path });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:code', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM fabrics WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    db.prepare("UPDATE fabrics SET status='inactive' WHERE code=?").run(req.params.code);
    logAudit(req, 'DELETE', 'fabric', req.params.code, existing.name);
    res.json({ message: 'تم التعطيل', code: req.params.code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/fabrics/:code/batches — available inventory batches per fabric
router.get('/:code/batches', (req, res) => {
  try {
    const { status } = req.query;
    let q = `SELECT fib.*, s.name as supplier_name, po.po_number
      FROM fabric_inventory_batches fib
      LEFT JOIN suppliers s ON s.id=fib.supplier_id
      LEFT JOIN purchase_orders po ON po.id=fib.po_id
      WHERE fib.fabric_code=?`;
    const p = [req.params.code];
    if (status) { q += ' AND fib.batch_status=?'; p.push(status); }
    else { q += " AND fib.batch_status IN ('available','reserved')"; }
    q += ' ORDER BY fib.received_date DESC';
    res.json(db.prepare(q).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
