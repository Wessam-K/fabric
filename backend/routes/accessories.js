const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');
// Phase 1.4: Magic byte validation for uploaded images
const { validateOrRemove } = require('../utils/fileValidation');
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const fs = require('fs');
const uploadDir = path.join(process.env.WK_DB_DIR || path.join(__dirname, '..'), 'uploads', 'accessories');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const MIME_TO_EXT = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
    cb(null, `acc-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

router.get('/', requirePermission('accessories', 'view'), (req, res) => {
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

router.post('/', upload.single('image'), requirePermission('accessories', 'create'), async (req, res) => {
  try {
    const { code, acc_type, name, unit_price, unit, supplier, supplier_id, notes, quantity_on_hand, low_stock_threshold, reorder_qty } = req.body;
    if (!code || !acc_type || !name || unit_price == null) return res.status(400).json({ error: 'الكود والنوع والاسم وسعر الوحدة مطلوبين' });
    if (parseFloat(unit_price) < 0) return res.status(400).json({ error: 'سعر الوحدة لا يمكن أن يكون سالباً' });
    // Phase 1.4: Validate image magic bytes
    if (req.file) {
      const check = await validateOrRemove(req.file.path, ALLOWED_IMAGE_MIMES);
      if (!check.valid) return res.status(400).json({ error: 'محتوى الملف لا يتطابق مع نوعه' });
    }
    const image_path = req.file ? `/uploads/accessories/${req.file.filename}` : null;
    // Get defaults from settings
    const defLowStock = parseInt(db.prepare("SELECT value FROM settings WHERE key='low_stock_threshold'").get()?.value) || 20;
    const defReorderQty = parseInt(db.prepare("SELECT value FROM settings WHERE key='default_reorder_qty'").get()?.value) || 50;
    const r = db.prepare(`INSERT INTO accessories (code,acc_type,name,unit_price,unit,supplier,supplier_id,notes,quantity_on_hand,low_stock_threshold,reorder_qty,image_path) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(code, acc_type, name, parseFloat(unit_price), unit || 'piece', supplier || null, supplier_id || null, notes || null, quantity_on_hand || 0, low_stock_threshold || defLowStock, reorder_qty || defReorderQty, image_path);
    const created = db.prepare('SELECT * FROM accessories WHERE id=?').get(r.lastInsertRowid);
    logAudit(req, 'CREATE', 'accessory', code, name);
    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود الاكسسوار موجود بالفعل' });
    console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' });
  }
});

// GET /api/accessories/export — CSV export
router.get('/export', requirePermission('accessories', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT a.*, s.name as supplier_name FROM accessories a LEFT JOIN suppliers s ON s.id=a.supplier_id ORDER BY a.created_at DESC`).all();
    const header = 'code,acc_type,name,unit_price,unit,supplier_name,quantity_on_hand,low_stock_threshold,reorder_qty,status,notes';
    const esc = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows.map(r => [r.code,r.acc_type,r.name,r.unit_price,r.unit,r.supplier_name||r.supplier,r.quantity_on_hand,r.low_stock_threshold,r.reorder_qty,r.status,r.notes].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=accessories.csv');
    res.send('\uFEFF' + csv);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/accessories/import — bulk import
router.post('/import', requirePermission('accessories', 'create'), (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'لا توجد بيانات للاستيراد' });
    let imported = 0, updated = 0, errors = [];
    const insert = db.prepare(`INSERT INTO accessories (code,acc_type,name,unit_price,unit,quantity_on_hand,low_stock_threshold,reorder_qty,notes) VALUES (?,?,?,?,?,?,?,?,?)`);
    const update = db.prepare(`UPDATE accessories SET acc_type=?,name=?,unit_price=?,unit=?,low_stock_threshold=?,reorder_qty=?,notes=? WHERE code=?`);
    // Hoist settings queries outside loop
    const defLowStock = parseInt(db.prepare("SELECT value FROM settings WHERE key='low_stock_threshold'").get()?.value) || 20;
    const defReorderQty = parseInt(db.prepare("SELECT value FROM settings WHERE key='default_reorder_qty'").get()?.value) || 50;
    db.transaction(() => {
      for (const item of items) {
        try {
          if (!item.code || !item.name) { errors.push(`سطر بدون كود أو اسم`); continue; }
          const existing = db.prepare('SELECT id FROM accessories WHERE code=?').get(item.code);
          if (existing) { update.run(item.acc_type||'other', item.name, parseFloat(item.unit_price)||0, item.unit||'piece', parseInt(item.low_stock_threshold)||defLowStock, parseInt(item.reorder_qty)||defReorderQty, item.notes||null, item.code); updated++; }
          else { insert.run(item.code, item.acc_type||'other', item.name, parseFloat(item.unit_price)||0, item.unit||'piece', parseInt(item.quantity_on_hand)||0, parseInt(item.low_stock_threshold)||defLowStock, parseInt(item.reorder_qty)||defReorderQty, item.notes||null); imported++; }
        } catch (e) { errors.push(`${item.code}: ${e.message}`); }
      }
    })();
    logAudit(req, 'IMPORT', 'accessory', null, `imported:${imported} updated:${updated}`);
    res.json({ imported, updated, errors });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

router.put('/:code', upload.single('image'), requirePermission('accessories', 'edit'), async (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    const { acc_type, name, unit_price, unit, supplier, supplier_id, status, notes, low_stock_threshold, reorder_qty } = req.body;
    // Phase 1.4: Validate image magic bytes
    if (req.file) {
      const check = await validateOrRemove(req.file.path, ALLOWED_IMAGE_MIMES);
      if (!check.valid) return res.status(400).json({ error: 'محتوى الملف لا يتطابق مع نوعه' });
    }
    const image_path = req.file ? `/uploads/accessories/${req.file.filename}` : existing.image_path;
    db.prepare(`UPDATE accessories SET acc_type=COALESCE(?,acc_type),name=COALESCE(?,name),unit_price=COALESCE(?,unit_price),unit=COALESCE(?,unit),supplier=COALESCE(?,supplier),supplier_id=COALESCE(?,supplier_id),status=COALESCE(?,status),notes=COALESCE(?,notes),low_stock_threshold=COALESCE(?,low_stock_threshold),reorder_qty=COALESCE(?,reorder_qty),image_path=? WHERE code=?`)
      .run(acc_type||null, name||null, unit_price!=null?parseFloat(unit_price):null, unit||null, supplier||null, supplier_id||null, status||null, notes||null, low_stock_threshold!=null?parseInt(low_stock_threshold):null, reorder_qty!=null?parseInt(reorder_qty):null, image_path, req.params.code);
    const updated = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    logAudit(req, 'UPDATE', 'accessory', req.params.code, existing.name, existing, updated);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

router.delete('/:code', requirePermission('accessories', 'delete'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    db.prepare("UPDATE accessories SET status='inactive' WHERE code=?").run(req.params.code);
    logAudit(req, 'DELETE', 'accessory', req.params.code, existing.name);
    res.json({ message: 'تم التعطيل', code: req.params.code });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// Upload / replace accessory image
router.post('/:code/image', requirePermission('accessories', 'edit'), upload.single('image'), async (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'الاكسسوار غير موجود' });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع صورة' });
    // Phase 1.4: Validate image magic bytes
    const check = await validateOrRemove(req.file.path, ALLOWED_IMAGE_MIMES);
    if (!check.valid) return res.status(400).json({ error: 'محتوى الملف لا يتطابق مع نوعه' });
    const image_path = `/uploads/accessories/${req.file.filename}`;
    db.prepare('UPDATE accessories SET image_path=? WHERE code=?').run(image_path, req.params.code);
    logAudit(req, 'UPDATE', 'accessory', req.params.code, existing.name, { image_path: existing.image_path }, { image_path });
    res.json({ image_path });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// Stock management
router.get('/:code/stock', requirePermission('accessories', 'view'), (req, res) => {
  try {
    const acc = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!acc) return res.status(404).json({ error: 'الاكسسوار غير موجود' });
    const movements = db.prepare(`SELECT asm.*, u.full_name as user_name FROM accessory_stock_movements asm LEFT JOIN users u ON u.id=asm.created_by WHERE asm.accessory_code=? ORDER BY asm.created_at DESC LIMIT 50`).all(acc.code);
    const low_stock = acc.quantity_on_hand <= acc.low_stock_threshold;
    res.json({ accessory: acc, movements, low_stock });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

router.post('/:code/stock/adjust', requirePermission('accessories', 'edit'), (req, res) => {
  try {
    const acc = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!acc) return res.status(404).json({ error: 'الاكسسوار غير موجود' });
    const { qty_change, notes } = req.body;
    const change = parseFloat(qty_change);
    if (isNaN(change) || change === 0) return res.status(400).json({ error: 'الكمية مطلوبة ويجب أن لا تساوي صفر' });
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
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
