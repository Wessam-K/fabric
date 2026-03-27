const express = require('express');
const router = express.Router();
const multer = require('multer');
const { logAudit, requirePermission } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const db = require('../database');

const uploadDir = path.join(__dirname, '..', 'uploads', 'fabrics');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const MIME_TO_EXT = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
    cb(null, `fab-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

router.get('/', requirePermission('fabrics', 'view'), (req, res) => {
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
      const defaultPageSize = parseInt(db.prepare("SELECT value FROM settings WHERE key='default_page_size'").get()?.value) || 25;
      const lim = parseInt(limit) || defaultPageSize;
      q += ' LIMIT ? OFFSET ?';
      p.push(lim, (pg - 1) * lim);
      const data = db.prepare(q).all(...p);
      return res.json({ data, total, page: pg, totalPages: Math.ceil(total / lim) });
    }
    res.json(db.prepare(q).all(...p));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

router.post('/', upload.single('image'), requirePermission('fabrics', 'create'), (req, res) => {
  try {
    const { code, name, fabric_type, price_per_m, supplier, supplier_id, color, notes } = req.body;
    if (!code || !name || !price_per_m) return res.status(400).json({ error: 'الكود والاسم وسعر المتر مطلوبين' });
    if (parseFloat(price_per_m) < 0) return res.status(400).json({ error: 'سعر المتر لا يمكن أن يكون سالباً' });
    const image_path = req.file ? `/uploads/fabrics/${req.file.filename}` : null;
    const r = db.prepare(`INSERT INTO fabrics (code,name,fabric_type,price_per_m,supplier,supplier_id,color,image_path,notes) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(code, name, fabric_type || 'main', parseFloat(price_per_m), supplier || null, supplier_id || null, color || null, image_path, notes || null);
    const created = db.prepare('SELECT * FROM fabrics WHERE id=?').get(r.lastInsertRowid);
    logAudit(req, 'CREATE', 'fabric', code, name);
    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود القماش موجود بالفعل' });
    console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' });
  }
});

// GET /api/fabrics/export — CSV export
router.get('/export', requirePermission('fabrics', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT f.*, s.name as supplier_name FROM fabrics f LEFT JOIN suppliers s ON s.id=f.supplier_id ORDER BY f.created_at DESC`).all();
    const header = 'code,name,fabric_type,color,price_per_m,supplier_name,available_meters,low_stock_threshold,status,notes';
    const esc = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows.map(r => [r.code,r.name,r.fabric_type,r.color,r.price_per_m,r.supplier_name||r.supplier,r.available_meters,r.low_stock_threshold,r.status,r.notes].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=fabrics.csv');
    res.send('\uFEFF' + csv);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/fabrics/import — bulk import
router.post('/import', requirePermission('fabrics', 'create'), (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'لا توجد بيانات للاستيراد' });
    let imported = 0, updated = 0, errors = [];
    const insert = db.prepare(`INSERT INTO fabrics (code,name,fabric_type,price_per_m,color,notes) VALUES (?,?,?,?,?,?)`);
    const update = db.prepare(`UPDATE fabrics SET name=?,fabric_type=?,price_per_m=?,color=?,notes=? WHERE code=?`);
    db.transaction(() => {
      for (const item of items) {
        try {
          if (!item.code || !item.name) { errors.push(`سطر بدون كود أو اسم`); continue; }
          const existing = db.prepare('SELECT id FROM fabrics WHERE code=?').get(item.code);
          if (existing) { update.run(item.name, item.fabric_type||'main', parseFloat(item.price_per_m)||0, item.color||null, item.notes||null, item.code); updated++; }
          else { insert.run(item.code, item.name, item.fabric_type||'main', parseFloat(item.price_per_m)||0, item.color||null, item.notes||null); imported++; }
        } catch (e) { errors.push(`${item.code}: ${e.message}`); }
      }
    })();
    logAudit(req, 'IMPORT', 'fabric', null, `imported:${imported} updated:${updated}`);
    res.json({ imported, updated, errors });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

router.put('/:code', upload.single('image'), requirePermission('fabrics', 'edit'), (req, res) => {
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
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

router.post('/:code/image', requirePermission('fabrics', 'edit'), upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لا توجد صورة' });
    const image_path = `/uploads/fabrics/${req.file.filename}`;
    db.prepare('UPDATE fabrics SET image_path=? WHERE code=?').run(image_path, req.params.code);
    res.json({ image_path });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

router.delete('/:code', requirePermission('fabrics', 'delete'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM fabrics WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    db.prepare("UPDATE fabrics SET status='inactive' WHERE code=?").run(req.params.code);
    logAudit(req, 'DELETE', 'fabric', req.params.code, existing.name);
    res.json({ message: 'تم التعطيل', code: req.params.code });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/fabrics/:code/po-batches — PO line items for this fabric
router.get('/:code/po-batches', requirePermission('fabrics', 'view'), (req, res) => {
  try {
    const fabricCode = req.params.code;
    const batches = db.prepare(`
      SELECT 
        pi.id as item_id,
        pi.fabric_code,
        pi.quantity as quantity_ordered,
        pi.received_qty as quantity_received,
        pi.unit_price,
        (pi.quantity * pi.unit_price) as total_price,
        po.po_number,
        po.order_date,
        po.status as po_status,
        po.expected_date as delivery_date,
        s.name as supplier_name,
        s.code as supplier_code,
        COALESCE(pi.received_qty, pi.quantity) as received_meters,
        pi.unit_price as price_per_meter
      FROM purchase_order_items pi
      JOIN purchase_orders po ON po.id = pi.po_id
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE pi.fabric_code = ? AND po.status != 'cancelled'
      ORDER BY po.order_date DESC
    `).all(fabricCode);
    res.json({ batches, latest_price: batches[0]?.price_per_meter || 0 });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/fabrics/:code/batches — available inventory batches per fabric
router.get('/:code/batches', requirePermission('fabrics', 'view'), (req, res) => {
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
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
