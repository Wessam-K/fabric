const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');
const { generateNextNumber } = require('../utils/numberGenerator');
const { round2, safeMultiply, safeAdd, safeSubtract } = require('../utils/money');

// ═══════════════════════════════════════════════
// QUOTATIONS
// ═══════════════════════════════════════════════

// GET /api/quotations
router.get('/', requirePermission('quotations', 'view'), (req, res) => {
  try {
    const { status, customer_id, search, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1'; const params = [];
    if (status) { where += ' AND q.status=?'; params.push(status); }
    if (customer_id) { where += ' AND q.customer_id=?'; params.push(customer_id); }
    if (search) { where += ' AND (q.quotation_number LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT q.*, c.name as customer_name, u.full_name as created_by_name
      FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id LEFT JOIN users u ON u.id=q.created_by
      WHERE ${where} ORDER BY q.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/quotations/next-number
router.get('/next-number', requirePermission('quotations', 'view'), (req, res) => {
  try {
    res.json({ next_number: generateNextNumber(db, 'quotation') });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/quotations/:id
router.get('/:id', requirePermission('quotations', 'view'), (req, res) => {
  try {
    const q = db.prepare(`SELECT q.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
      FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id WHERE q.id=?`).get(req.params.id);
    if (!q) return res.status(404).json({ error: 'عرض السعر غير موجود' });
    q.items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY id').all(q.id);
    res.json(q);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/quotations
router.post('/', requirePermission('quotations', 'create'), (req, res) => {
  try {
    const { quotation_number, customer_id, valid_until, notes, discount_percent, tax_percent, items } = req.body;
    if (!customer_id || !items?.length) return res.status(400).json({ error: 'العميل والأصناف مطلوبان' });
    if (discount_percent != null && (parseFloat(discount_percent) < 0 || parseFloat(discount_percent) > 100)) return res.status(400).json({ error: 'نسبة الخصم يجب أن تكون بين 0 و 100' });
    if (tax_percent != null && (parseFloat(tax_percent) < 0 || parseFloat(tax_percent) > 100)) return res.status(400).json({ error: 'نسبة الضريبة يجب أن تكون بين 0 و 100' });

    let subtotal = 0;
    for (const it of items) { subtotal = safeAdd(subtotal, safeMultiply(it.quantity || 0, it.unit_price || 0)); }
    const discountAmt = round2(subtotal * (parseFloat(discount_percent) || 0) / 100);
    const afterDiscount = safeSubtract(subtotal, discountAmt);
    const taxAmt = round2(afterDiscount * (parseFloat(tax_percent) || 0) / 100);
    const total = safeAdd(afterDiscount, taxAmt);

    const qId = db.transaction(() => {
      const result = db.prepare(`INSERT INTO quotations 
        (quotation_number, customer_id, valid_until, notes, subtotal, discount, tax_rate, tax_amount, total, status, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,'draft',?)`)
        .run(quotation_number, customer_id, valid_until || null, notes || null, subtotal, discount_percent || 0, tax_percent || 0, taxAmt, total, req.user.id);

      const id = result.lastInsertRowid;
      const ins = db.prepare('INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, total, notes) VALUES (?,?,?,?,?,?)');
      for (const it of items) {
        ins.run(id, it.description, it.quantity, it.unit_price, safeMultiply(it.quantity || 0, it.unit_price || 0), it.notes || null);
      }
      return id;
    })();

    logAudit(req, 'CREATE', 'quotation', qId, quotation_number);
    res.status(201).json({ id: qId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/quotations/:id
router.put('/:id', requirePermission('quotations', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = db.prepare('SELECT * FROM quotations WHERE id=?').get(id);
    if (!old) return res.status(404).json({ error: 'عرض السعر غير موجود' });
    if (old.status === 'accepted') return res.status(400).json({ error: 'لا يمكن تعديل عرض سعر مقبول' });

    const { customer_id, valid_until, notes, discount_percent, tax_percent, items, status } = req.body;
    if (discount_percent != null && (parseFloat(discount_percent) < 0 || parseFloat(discount_percent) > 100)) return res.status(400).json({ error: 'نسبة الخصم يجب أن تكون بين 0 و 100' });
    if (tax_percent != null && (parseFloat(tax_percent) < 0 || parseFloat(tax_percent) > 100)) return res.status(400).json({ error: 'نسبة الضريبة يجب أن تكون بين 0 و 100' });

    db.transaction(() => {
      let subtotal = old.subtotal;
      if (items?.length) {
        subtotal = 0;
        for (const it of items) { subtotal = safeAdd(subtotal, safeMultiply(it.quantity || 0, it.unit_price || 0)); }
      }
      const dp = discount_percent ?? old.discount ?? 0;
      const tp = tax_percent ?? old.tax_rate ?? 0;
      const discountAmt = round2(subtotal * dp / 100);
      const taxAmt = round2(safeSubtract(subtotal, discountAmt) * tp / 100);
      const total = safeAdd(safeSubtract(subtotal, discountAmt), taxAmt);

      db.prepare(`UPDATE quotations SET customer_id=COALESCE(?,customer_id), valid_until=COALESCE(?,valid_until),
        notes=COALESCE(?,notes), subtotal=?, discount=?, tax_rate=?, tax_amount=?, total=?,
        status=COALESCE(?,status), updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(customer_id, valid_until, notes, subtotal, dp, tp, taxAmt, total, status, id);

      if (items?.length) {
        db.prepare('DELETE FROM quotation_items WHERE quotation_id=?').run(id);
        const ins = db.prepare('INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, total, notes) VALUES (?,?,?,?,?,?)');
        for (const it of items) {
          ins.run(id, it.description, it.quantity, it.unit_price, safeMultiply(it.quantity || 0, it.unit_price || 0), it.notes || null);
        }
      }
    })();

    logAudit(req, 'UPDATE', 'quotation', id, old.quotation_number, old, req.body);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/quotations/:id/convert-to-so
router.post('/:id/convert-to-so', requirePermission('sales_orders', 'create'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(id);
    if (!q) return res.status(404).json({ error: 'عرض السعر غير موجود' });
    if (q.status !== 'sent' && q.status !== 'draft') return res.status(400).json({ error: 'لا يمكن التحويل إلا من حالة مسودة أو مرسل' });
    if (!q.customer_id) return res.status(400).json({ error: 'عرض السعر يجب أن يكون مرتبط بعميل' });

    const soNumber = generateNextNumber(db, 'sales_order');

    const soId = db.transaction(() => {
      const soResult = db.prepare(`INSERT INTO sales_orders 
        (so_number, quotation_id, customer_id, order_date, delivery_date, notes, subtotal, discount, tax_rate, tax_amount, total, status, created_by)
        VALUES (?,?,?,datetime('now','localtime'),?,?,?,?,?,?,?,'confirmed',?)`)
        .run(soNumber, id, q.customer_id, q.valid_until, q.notes, q.subtotal, q.discount || 0, q.tax_rate || 0, q.tax_amount || 0, q.total, req.user.id);

      const sid = soResult.lastInsertRowid;
      const qItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id=?').all(id);
      const ins = db.prepare('INSERT INTO sales_order_items (sales_order_id, description, quantity, unit_price, total) VALUES (?,?,?,?,?)');
      for (const it of qItems) {
        ins.run(sid, it.description, it.quantity, it.unit_price, it.total);
      }

      db.prepare("UPDATE quotations SET status='accepted', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
      return sid;
    })();

    logAudit(req, 'CONVERT', 'quotation', id, `${q.quotation_number} → ${soNumber}`);
    res.status(201).json({ id: soId, so_number: soNumber });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/quotations/:id
router.delete('/:id', requirePermission('quotations', 'delete'), (req, res) => {
  try {
    db.prepare('UPDATE quotations SET status=\'cancelled\', updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    logAudit(req, 'DELETE', 'quotation', req.params.id);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// SALES ORDERS
// ═══════════════════════════════════════════════

// GET /api/quotations/sales-orders
router.get('/sales-orders/list', requirePermission('sales_orders', 'view'), (req, res) => {
  try {
    const { status, customer_id, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1'; const params = [];
    if (status) { where += ' AND so.status=?'; params.push(status); }
    if (customer_id) { where += ' AND so.customer_id=?'; params.push(customer_id); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM sales_orders so WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT so.*, c.name as customer_name
      FROM sales_orders so LEFT JOIN customers c ON c.id=so.customer_id
      WHERE ${where} ORDER BY so.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/quotations/sales-orders/:id
router.get('/sales-orders/:id', requirePermission('sales_orders', 'view'), (req, res) => {
  try {
    const so = db.prepare(`SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON c.id=so.customer_id WHERE so.id=?`).get(req.params.id);
    if (!so) return res.status(404).json({ error: 'أمر البيع غير موجود' });
    so.items = db.prepare('SELECT * FROM sales_order_items WHERE sales_order_id=?').all(so.id);
    res.json(so);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/quotations/sales-orders/:id/convert-to-wo
router.post('/sales-orders/:id/convert-to-wo', requirePermission('work_orders', 'create'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const so = db.prepare('SELECT * FROM sales_orders WHERE id=?').get(id);
    if (!so) return res.status(404).json({ error: 'أمر البيع غير موجود' });
    if (!['confirmed','draft'].includes(so.status)) return res.status(400).json({ error: 'لا يمكن التحويل إلا من حالة مؤكد أو مسودة' });

    const woNumber = generateNextNumber(db, 'work_order');

    const soItems = db.prepare('SELECT * FROM sales_order_items WHERE sales_order_id=?').all(id);
    const totalQty = soItems.reduce((s, i) => s + (i.quantity || 0), 0);
    const desc = soItems.map(i => i.description).join(', ');

    const woId = db.transaction(() => {
      const result = db.prepare(`INSERT INTO work_orders 
        (wo_number, customer_id, start_date, due_date, status, quantity, notes, created_by)
        VALUES (?,?,datetime('now','localtime'),?,'pending',?,?,?)`)
        .run(woNumber, so.customer_id, so.delivery_date, totalQty, `من أمر بيع ${so.so_number}: ${desc}`, req.user.id);

      db.prepare("UPDATE sales_orders SET status='in_production', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
      return result.lastInsertRowid;
    })();

    logAudit(req, 'CONVERT', 'sales_order', id, `${so.so_number} → ${woNumber}`);
    res.status(201).json({ id: woId, wo_number: woNumber });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/quotations/sales-orders/:id/status
router.patch('/sales-orders/:id/status', requirePermission('sales_orders', 'edit'), (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['confirmed','in_production','shipped','delivered','cancelled'];
    if (!status || !validStatuses.includes(status)) return res.status(400).json({ error: 'الحالة غير صالحة' });
    const so = db.prepare('SELECT * FROM sales_orders WHERE id=?').get(req.params.id);
    if (!so) return res.status(404).json({ error: 'أمر البيع غير موجود' });
    db.prepare('UPDATE sales_orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.params.id);
    logAudit(req, 'STATUS_CHANGE', 'sales_order', req.params.id, status);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
