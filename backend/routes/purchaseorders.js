const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/purchaseorders — list with filters
router.get('/', (req, res) => {
  try {
    const { search, status, supplier_id, page = 1, limit = 50 } = req.query;
    let q = `SELECT po.*, s.name as supplier_name, s.code as supplier_code
             FROM purchase_orders po
             LEFT JOIN suppliers s ON s.id = po.supplier_id
             WHERE 1=1`;
    const p = [];

    if (search) {
      q += ' AND (po.po_number LIKE ? OR s.name LIKE ?)';
      const s = `%${search}%`;
      p.push(s, s);
    }
    if (status) { q += ' AND po.status = ?'; p.push(status); }
    if (supplier_id) { q += ' AND po.supplier_id = ?'; p.push(parseInt(supplier_id)); }

    q += ' ORDER BY po.created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    q += ' LIMIT ? OFFSET ?';
    p.push(parseInt(limit), offset);

    const orders = db.prepare(q).all(...p);

    const totals = db.prepare(`SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status='draft' THEN total ELSE 0 END),0) as draft_total,
      COALESCE(SUM(CASE WHEN status IN ('sent','partial') THEN total ELSE 0 END),0) as pending_total,
      COALESCE(SUM(CASE WHEN status='received' THEN total ELSE 0 END),0) as received_total
    FROM purchase_orders`).get();

    res.json({ orders, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/purchaseorders/next-number
router.get('/next-number', (req, res) => {
  try {
    const last = db.prepare("SELECT po_number FROM purchase_orders ORDER BY id DESC LIMIT 1").get();
    let next = 'PO-001';
    if (last) {
      const num = parseInt(last.po_number.replace(/\D/g, '') || '0') + 1;
      next = `PO-${String(num).padStart(3, '0')}`;
    }
    res.json({ next_number: next });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/purchaseorders/:id — single with items
router.get('/:id', (req, res) => {
  try {
    const po = db.prepare(`SELECT po.*, s.name as supplier_name, s.code as supplier_code, s.phone as supplier_phone
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ?`).get(req.params.id);
    if (!po) return res.status(404).json({ error: 'Not found' });

    po.items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY sort_order').all(po.id);

    // Get payments for this PO
    po.payments = db.prepare('SELECT * FROM supplier_payments WHERE po_id = ? ORDER BY payment_date DESC').all(po.id);
    po.total_paid = po.payments.reduce((s, p) => s + p.amount, 0);
    po.balance = po.total - po.total_paid;

    res.json(po);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/purchaseorders — create
router.post('/', (req, res) => {
  try {
    const { po_number, supplier_id, tax_pct, discount, expected_date, notes, items, status } = req.body;
    if (!po_number || !supplier_id) return res.status(400).json({ error: 'po_number and supplier_id required' });

    const exists = db.prepare('SELECT id FROM purchase_orders WHERE po_number=?').get(po_number);
    if (exists) return res.status(409).json({ error: 'رقم أمر الشراء موجود بالفعل' });

    const subtotal = (items || []).reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
    const taxAmt = subtotal * ((parseFloat(tax_pct) || 0) / 100);
    const total = subtotal + taxAmt - (parseFloat(discount) || 0);

    const r = db.prepare(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, tax_pct, discount, total, expected_date, notes, status)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(po_number, parseInt(supplier_id), subtotal, parseFloat(tax_pct) || 0, parseFloat(discount) || 0, total, expected_date || null, notes || null, status || 'draft');

    const poId = r.lastInsertRowid;

    // Insert items
    if (items?.length) {
      const ins = db.prepare('INSERT INTO purchase_order_items (po_id, item_type, item_code, description, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,?,?)');
      const insertItems = db.transaction((items) => {
        items.forEach((item, i) => {
          const qty = parseFloat(item.quantity) || 0;
          const price = parseFloat(item.unit_price) || 0;
          ins.run(poId, item.item_type || 'fabric', item.item_code || '', item.description || '', qty, price, qty * price, i);
        });
      });
      insertItems(items);
    }

    const created = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    created.items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id=?').all(poId);
    res.status(201).json(created);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/purchaseorders/:id — update
router.put('/:id', (req, res) => {
  try {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id);
    if (!po) return res.status(404).json({ error: 'Not found' });

    const { supplier_id, tax_pct, discount, expected_date, notes, items, status } = req.body;

    const subtotal = (items || []).reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
    const taxAmt = subtotal * ((parseFloat(tax_pct) || 0) / 100);
    const total = subtotal + taxAmt - (parseFloat(discount) || 0);

    let receivedDate = po.received_date;
    if (status === 'received' && !po.received_date) receivedDate = new Date().toISOString();

    db.prepare(`UPDATE purchase_orders SET supplier_id=COALESCE(?,supplier_id), subtotal=?, tax_pct=?, discount=?, total=?,
      expected_date=COALESCE(?,expected_date), notes=COALESCE(?,notes), status=COALESCE(?,status),
      received_date=COALESCE(?,received_date), updated_at=datetime('now') WHERE id=?`)
      .run(supplier_id ? parseInt(supplier_id) : null, subtotal, parseFloat(tax_pct) || 0, parseFloat(discount) || 0, total,
        expected_date || null, notes || null, status || null, receivedDate, req.params.id);

    // Replace items
    db.prepare('DELETE FROM purchase_order_items WHERE po_id=?').run(po.id);
    if (items?.length) {
      const ins = db.prepare('INSERT INTO purchase_order_items (po_id, item_type, item_code, description, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,?,?)');
      const insertItems = db.transaction((items) => {
        items.forEach((item, i) => {
          const qty = parseFloat(item.quantity) || 0;
          const price = parseFloat(item.unit_price) || 0;
          ins.run(po.id, item.item_type || 'fabric', item.item_code || '', item.description || '', qty, price, qty * price, i);
        });
      });
      insertItems(items);
    }

    const updated = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(po.id);
    updated.items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id=?').all(po.id);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/purchaseorders/:id/status
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'sent', 'partial', 'received', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    let receivedDate = null;
    if (status === 'received') receivedDate = new Date().toISOString();
    db.prepare("UPDATE purchase_orders SET status=?, received_date=COALESCE(?,received_date), updated_at=datetime('now') WHERE id=?")
      .run(status, receivedDate, req.params.id);
    res.json(db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/purchaseorders/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM purchase_order_items WHERE po_id=?').run(req.params.id);
    db.prepare('DELETE FROM purchase_orders WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
