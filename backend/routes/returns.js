const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');
const { generateNextNumber } = require('../utils/numberGenerator');

// ═══════════════════════════════════════════════
// SALES RETURNS
// ═══════════════════════════════════════════════

// GET /api/returns/sales
router.get('/sales', requirePermission('returns', 'view'), (req, res) => {
  try {
    const { status, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1'; const params = [];
    if (status) { where += ' AND sr.status=?'; params.push(status); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM sales_returns sr WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT sr.*, c.name as customer_name, i.invoice_number
      FROM sales_returns sr LEFT JOIN customers c ON c.id=sr.customer_id LEFT JOIN invoices i ON i.id=sr.invoice_id
      WHERE ${where} ORDER BY sr.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/returns/sales
router.post('/sales', requirePermission('returns', 'create'), (req, res) => {
  try {
    const { customer_id, invoice_id, reason, notes, items } = req.body;
    if (!customer_id || !items?.length) return res.status(400).json({ error: 'العميل والأصناف مطلوبان' });

    const result = db.transaction(() => {
      const retNum = generateNextNumber(db, 'sales_return');
      let totalAmount = 0;
      for (const it of items) { totalAmount += (it.quantity || 0) * (it.unit_price || 0); }
      // Calculate tax from settings
      const taxRatePct = parseFloat(db.prepare("SELECT value FROM settings WHERE key='tax_rate'").get()?.value) || 14;
      const taxAmount = Math.round(totalAmount * taxRatePct) / 100;

      const r = db.prepare(`INSERT INTO sales_returns (return_number, customer_id, invoice_id, return_date, reason, notes, subtotal, tax_amount, total, status, created_by)
        VALUES (?,?,?,datetime('now','localtime'),?,?,?,?,?,'draft',?)`)
        .run(retNum, customer_id, invoice_id || null, reason || null, notes || null, totalAmount, taxAmount, totalAmount + taxAmount, req.user.id);
      const retId = r.lastInsertRowid;

      const ins = db.prepare('INSERT INTO sales_return_items (return_id, description, model_code, quantity, unit_price, total) VALUES (?,?,?,?,?,?)');
      for (const it of items) {
        ins.run(retId, it.description || it.product_description, it.model_code || null, it.quantity, it.unit_price, (it.quantity || 0) * (it.unit_price || 0));
      }

      return { id: retId, return_number: retNum };
    })();

    logAudit(req, 'CREATE', 'sales_return', result.id, result.return_number);
    res.status(201).json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/returns/sales/:id
router.get('/sales/:id', requirePermission('returns', 'view'), (req, res) => {
  try {
    const sr = db.prepare(`SELECT sr.*, c.name as customer_name FROM sales_returns sr LEFT JOIN customers c ON c.id=sr.customer_id WHERE sr.id=?`).get(req.params.id);
    if (!sr) return res.status(404).json({ error: 'مرتجع غير موجود' });
    sr.items = db.prepare('SELECT * FROM sales_return_items WHERE return_id=?').all(sr.id);
    res.json(sr);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/returns/sales/:id/approve — approve & adjust stock
router.patch('/sales/:id/approve', requirePermission('returns', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sr = db.prepare('SELECT * FROM sales_returns WHERE id=?').get(id);
    if (!sr) return res.status(404).json({ error: 'مرتجع غير موجود' });
    if (sr.status !== 'draft') return res.status(400).json({ error: 'المرتجع ليس في حالة مسودة' });

    db.transaction(() => {
      db.prepare("UPDATE sales_returns SET status='approved' WHERE id=?").run(id);
      // Adjust stock: return items back to inventory
      const items = db.prepare('SELECT * FROM sales_return_items WHERE return_id=?').all(id);
      for (const item of items) {
        if (item.item_type === 'fabric' && item.item_code) {
          db.prepare('UPDATE fabrics SET available_meters = available_meters + ? WHERE code = ?').run(item.quantity || 0, item.item_code);
        } else if (item.item_type === 'accessory' && item.item_code) {
          db.prepare('UPDATE accessories SET quantity_on_hand = quantity_on_hand + ? WHERE code = ?').run(item.quantity || 0, item.item_code);
        }
      }
    })();
    logAudit(req, 'APPROVE', 'sales_return', id, sr.return_number);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// PURCHASE RETURNS
// ═══════════════════════════════════════════════

// GET /api/returns/purchases
router.get('/purchases', requirePermission('returns', 'view'), (req, res) => {
  try {
    const { status, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1'; const params = [];
    if (status) { where += ' AND pr.status=?'; params.push(status); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM purchase_returns pr WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT pr.*, s.name as supplier_name, po.po_number
      FROM purchase_returns pr LEFT JOIN suppliers s ON s.id=pr.supplier_id LEFT JOIN purchase_orders po ON po.id=pr.purchase_order_id
      WHERE ${where} ORDER BY pr.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/returns/purchases
router.post('/purchases', requirePermission('returns', 'create'), (req, res) => {
  try {
    const { supplier_id, purchase_order_id, reason, notes, items } = req.body;
    if (!supplier_id || !items?.length) return res.status(400).json({ error: 'المورد والأصناف مطلوبان' });

    const result = db.transaction(() => {
      const retNum = generateNextNumber(db, 'purchase_return');
      let totalAmount = 0;
      for (const it of items) { totalAmount += (it.quantity || 0) * (it.unit_price || 0); }

      const r = db.prepare(`INSERT INTO purchase_returns (return_number, supplier_id, purchase_order_id, return_date, reason, notes, subtotal, total, status, created_by)
        VALUES (?,?,?,datetime('now','localtime'),?,?,?,?,'draft',?)`)
        .run(retNum, supplier_id, purchase_order_id || null, reason || null, notes || null, totalAmount, totalAmount, req.user.id);
      const retId = r.lastInsertRowid;

      const ins = db.prepare('INSERT INTO purchase_return_items (return_id, item_type, item_code, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?,?)');
      for (const it of items) {
        ins.run(retId, it.item_type || 'other', it.item_code || null, it.description || it.product_description, it.quantity, it.unit_price, (it.quantity || 0) * (it.unit_price || 0));
      }

      return { id: retId, return_number: retNum };
    })();

    logAudit(req, 'CREATE', 'purchase_return', result.id, result.return_number);
    res.status(201).json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/returns/purchases/:id
router.get('/purchases/:id', requirePermission('returns', 'view'), (req, res) => {
  try {
    const pr = db.prepare(`SELECT pr.*, s.name as supplier_name FROM purchase_returns pr LEFT JOIN suppliers s ON s.id=pr.supplier_id WHERE pr.id=?`).get(req.params.id);
    if (!pr) return res.status(404).json({ error: 'مرتجع غير موجود' });
    pr.items = db.prepare('SELECT * FROM purchase_return_items WHERE return_id=?').all(pr.id);
    res.json(pr);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/returns/purchases/:id/approve
router.patch('/purchases/:id/approve', requirePermission('returns', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pr = db.prepare('SELECT * FROM purchase_returns WHERE id=?').get(id);
    if (!pr) return res.status(404).json({ error: 'مرتجع غير موجود' });
    if (pr.status !== 'draft') return res.status(400).json({ error: 'المرتجع ليس في حالة مسودة' });

    db.transaction(() => {
      db.prepare("UPDATE purchase_returns SET status='approved' WHERE id=?").run(id);
      // Adjust stock: deduct returned items from inventory
      const items = db.prepare('SELECT * FROM purchase_return_items WHERE return_id=?').all(id);
      for (const item of items) {
        if (item.item_type === 'fabric' && item.item_code) {
          db.prepare('UPDATE fabrics SET available_meters = MAX(0, available_meters - ?) WHERE code = ?').run(item.quantity || 0, item.item_code);
        } else if (item.item_type === 'accessory' && item.item_code) {
          db.prepare('UPDATE accessories SET quantity_on_hand = MAX(0, quantity_on_hand - ?) WHERE code = ?').run(item.quantity || 0, item.item_code);
        }
      }
    })();
    logAudit(req, 'APPROVE', 'purchase_return', id, pr.return_number);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
