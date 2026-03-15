const express = require('express');
const router = express.Router();
const multer = require('multer');
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
    const { type, status, search } = req.query;
    let q = 'SELECT * FROM fabrics WHERE 1=1';
    const p = [];
    if (type) { q += ' AND fabric_type = ?'; p.push(type); }
    if (status) { q += ' AND status = ?'; p.push(status); }
    if (search) { q += ' AND (code LIKE ? OR name LIKE ? OR supplier LIKE ?)'; const s = `%${search}%`; p.push(s, s, s); }
    q += ' ORDER BY created_at DESC';
    res.json(db.prepare(q).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', upload.single('image'), (req, res) => {
  try {
    const { code, name, fabric_type, price_per_m, supplier, color, notes } = req.body;
    if (!code || !name || !price_per_m) return res.status(400).json({ error: 'code, name, price_per_m required' });
    const image_path = req.file ? `/uploads/fabrics/${req.file.filename}` : null;
    const r = db.prepare(`INSERT INTO fabrics (code,name,fabric_type,price_per_m,supplier,color,image_path,notes) VALUES (?,?,?,?,?,?,?,?)`)
      .run(code, name, fabric_type || 'main', parseFloat(price_per_m), supplier || null, color || null, image_path, notes || null);
    res.status(201).json(db.prepare('SELECT * FROM fabrics WHERE id=?').get(r.lastInsertRowid));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود القماش موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:code', upload.single('image'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM fabrics WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name, fabric_type, price_per_m, supplier, color, status, notes } = req.body;
    const image_path = req.file ? `/uploads/fabrics/${req.file.filename}` : existing.image_path;
    db.prepare(`UPDATE fabrics SET name=COALESCE(?,name),fabric_type=COALESCE(?,fabric_type),price_per_m=COALESCE(?,price_per_m),supplier=COALESCE(?,supplier),color=COALESCE(?,color),image_path=COALESCE(?,image_path),status=COALESCE(?,status),notes=COALESCE(?,notes) WHERE code=?`)
      .run(name||null, fabric_type||null, price_per_m?parseFloat(price_per_m):null, supplier||null, color||null, image_path, status||null, notes||null, req.params.code);
    res.json(db.prepare('SELECT * FROM fabrics WHERE code=?').get(req.params.code));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:code/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image' });
    const image_path = `/uploads/fabrics/${req.file.filename}`;
    db.prepare('UPDATE fabrics SET image_path=? WHERE code=?').run(image_path, req.params.code);
    res.json({ image_path });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:code', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM fabrics WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare("UPDATE fabrics SET status='inactive' WHERE code=?").run(req.params.code);
    res.json({ message: 'Deactivated', code: req.params.code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
