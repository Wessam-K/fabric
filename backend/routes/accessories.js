const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../database');
const { logAudit } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'accessories')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `acc-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

router.get('/', (req, res) => {
  try {
    const { type, search, status, supplier_id, page, limit } = req.query;
    let q = 'SELECT a.*, s.name as supplier_name FROM accessories a LEFT JOIN suppliers s ON s.id=a.supplier_id WHERE 1=1';
    const p = [];
    if (type) { q += ' AND a.acc_type = ?'; p.push(type); }
    if (status) { q += ' AND a.status = ?'; p.push(status); }
    if (supplier_id) { q += ' AND a.supplier_id = ?'; p.push(supplier_id); }
    if (search) { q += ' AND (a.code LIKE ? OR a.name LIKE ? OR a.supplier LIKE ? OR s.name LIKE ?)'; const s = `%${search}%`; p.push(s, s, s, s); }
    q += ' ORDER BY a.created_at DESC';
    if (page && limit) {
      const countQ = q.replace(/SELECT a\.\*, s\.name as supplier_name/, 'SELECT COUNT(*) as total');
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
    const { code, acc_type, name, unit_price, unit, supplier, supplier_id, notes, quantity_on_hand, low_stock_threshold, reorder_qty } = req.body;
    if (!code || !acc_type || !name || unit_price == null) return res.status(400).json({ error: 'الكود والنوع والاسم وسعر الوحدة مطلوبين' });
    const image_path = req.file ? `/uploads/accessories/${req.file.filename}` : null;
    const r = db.prepare(`INSERT INTO accessories (code,acc_type,name,unit_price,unit,supplier,supplier_id,notes,quantity_on_hand,low_stock_threshold,reorder_qty,image_path) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(code, acc_type, name, parseFloat(unit_price), unit || 'piece', supplier || null, supplier_id || null, notes || null, quantity_on_hand || 0, low_stock_threshold || 10, reorder_qty || 50, image_path);
    const created = db.prepare('SELECT * FROM accessories WHERE id=?').get(r.lastInsertRowid);
    logAudit(req, 'CREATE', 'accessory', code, name);
    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود الاكسسوار موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/accessories/export — CSV export
router.get('/export', (req, res) => {
  try {
    const rows = db.prepare(`SELECT a.*, s.name as supplier_name FROM accessories a LEFT JOIN suppliers s ON s.id=a.supplier_id ORDER BY a.created_at DESC`).all();
    const header = 'code,acc_type,name,unit_price,unit,supplier_name,quantity_on_hand,low_stock_threshold,reorder_qty,status,notes';
    const esc = v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows.map(r => [r.code,r.acc_type,r.name,r.unit_price,r.unit,r.supplier_name||r.supplier,r.quantity_on_hand,r.low_stock_threshold,r.reorder_qty,r.status,r.notes].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=accessories.csv');
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/accessories/import — bulk import
router.post('/import', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'لا توجد بيانات للاستيراد' });
    let imported = 0, updated = 0, errors = [];
    const insert = db.prepare(`INSERT INTO accessories (code,acc_type,name,unit_price,unit,quantity_on_hand,low_stock_threshold,reorder_qty,notes) VALUES (?,?,?,?,?,?,?,?,?)`);
    const update = db.prepare(`UPDATE accessories SET acc_type=?,name=?,unit_price=?,unit=?,low_stock_threshold=?,reorder_qty=?,notes=? WHERE code=?`);
    db.transaction(() => {
      for (const item of items) {
        try {
          if (!item.code || !item.name) { errors.push(`سطر بدون كود أو اسم`); continue; }
          const existing = db.prepare('SELECT id FROM accessories WHERE code=?').get(item.code);
          if (existing) { update.run(item.acc_type||'other', item.name, parseFloat(item.unit_price)||0, item.unit||'piece', parseInt(item.low_stock_threshold)||10, parseInt(item.reorder_qty)||50, item.notes||null, item.code); updated++; }
          else { insert.run(item.code, item.acc_type||'other', item.name, parseFloat(item.unit_price)||0, item.unit||'piece', parseInt(item.quantity_on_hand)||0, parseInt(item.low_stock_threshold)||10, parseInt(item.reorder_qty)||50, item.notes||null); imported++; }
        } catch (e) { errors.push(`${item.code}: ${e.message}`); }
      }
    })();
    logAudit(req, 'IMPORT', 'accessory', null, `imported:${imported} updated:${updated}`);
    res.json({ imported, updated, errors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:code', upload.single('image'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    const { acc_type, name, unit_price, unit, supplier, supplier_id, status, notes, low_stock_threshold, reorder_qty } = req.body;
    const image_path = req.file ? `/uploads/accessories/${req.file.filename}` : existing.image_path;
    db.prepare(`UPDATE accessories SET acc_type=COALESCE(?,acc_type),name=COALESCE(?,name),unit_price=COALESCE(?,unit_price),unit=COALESCE(?,unit),supplier=COALESCE(?,supplier),supplier_id=COALESCE(?,supplier_id),status=COALESCE(?,status),notes=COALESCE(?,notes),low_stock_threshold=COALESCE(?,low_stock_threshold),reorder_qty=COALESCE(?,reorder_qty),image_path=? WHERE code=?`)
      .run(acc_type||null, name||null, unit_price!=null?parseFloat(unit_price):null, unit||null, supplier||null, supplier_id||null, status||null, notes||null, low_stock_threshold!=null?parseInt(low_stock_threshold):null, reorder_qty!=null?parseInt(reorder_qty):null, image_path, req.params.code);
    const updated = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    logAudit(req, 'UPDATE', 'accessory', req.params.code, existing.name, existing, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:code', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    db.prepare("UPDATE accessories SET status='inactive' WHERE code=?").run(req.params.code);
    logAudit(req, 'DELETE', 'accessory', req.params.code, existing.name);
    res.json({ message: 'تم التعطيل', code: req.params.code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload / replace accessory image
router.post('/:code/image', upload.single('image'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'الاكسسوار غير موجود' });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع صورة' });
    const image_path = `/uploads/accessories/${req.file.filename}`;
    db.prepare('UPDATE accessories SET image_path=? WHERE code=?').run(image_path, req.params.code);
    logAudit(req, 'UPDATE', 'accessory', req.params.code, existing.name, { image_path: existing.image_path }, { image_path });
    res.json({ image_path });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stock management
router.get('/:code/stock', (req, res) => {
  try {
    const acc = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!acc) return res.status(404).json({ error: 'الاكسسوار غير موجود' });
    const movements = db.prepare(`SELECT asm.*, u.full_name as user_name FROM accessory_stock_movements asm LEFT JOIN users u ON u.id=asm.created_by WHERE asm.accessory_code=? ORDER BY asm.created_at DESC LIMIT 50`).all(acc.code);
    const low_stock = acc.quantity_on_hand <= acc.low_stock_threshold;
    res.json({ accessory: acc, movements, low_stock });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:code/stock/adjust', (req, res) => {
  try {
    const acc = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!acc) return res.status(404).json({ error: 'الاكسسوار غير موجود' });
    const { qty_change, notes } = req.body;
    if (qty_change == null || qty_change === 0) return res.status(400).json({ error: 'الكمية مطلوبة ويجب أن لا تساوي صفر' });
    const change = parseInt(qty_change);
    const newQty = acc.quantity_on_hand + change;
    if (newQty < 0) return res.status(400).json({ error: 'الكمية الناتجة لا يمكن أن تكون سالبة' });
    const userId = req.user ? req.user.id : null;
    db.transaction(() => {
      db.prepare('UPDATE accessories SET quantity_on_hand=? WHERE id=?').run(newQty, acc.id);
      db.prepare(`INSERT INTO accessory_stock_movements (accessory_code, movement_type, qty, reference_type, notes, created_by) VALUES (?,?,?,?,?,?)`)
        .run(acc.code, 'adjustment', change, 'manual', notes || null, userId);
    })();
    const updated = db.prepare('SELECT * FROM accessories WHERE id=?').get(acc.id);
    logAudit(req, 'STOCK_ADJUST', 'accessory', acc.code, acc.name, { old_qty: acc.quantity_on_hand }, { new_qty: newQty });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
