const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/suppliers — list with filters
router.get('/', (req, res) => {
  try {
    const { search, type, status } = req.query;
    let q = 'SELECT * FROM suppliers WHERE 1=1';
    const p = [];
    if (type) { q += ' AND type = ?'; p.push(type); }
    if (status) { q += ' AND status = ?'; p.push(status); }
    else { q += " AND status = 'active'"; }
    if (search) {
      q += ' AND (code LIKE ? OR name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)';
      const s = `%${search}%`;
      p.push(s, s, s, s);
    }
    q += ' ORDER BY created_at DESC';

    const suppliers = db.prepare(q).all(...p);

    // Add outstanding balance for each supplier
    const balanceStmt = db.prepare(`SELECT
      COALESCE(SUM(po.total),0) as total_ordered,
      COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id=?),0) as total_paid
    FROM purchase_orders po WHERE po.supplier_id=? AND po.status NOT IN ('cancelled','draft')`);

    const result = suppliers.map(s => {
      const bal = balanceStmt.get(s.id, s.id);
      return { ...s, total_ordered: bal.total_ordered, total_paid: bal.total_paid, balance: bal.total_ordered - bal.total_paid };
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/suppliers/:id — single with POs and payments
router.get('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Not found' });

    supplier.purchase_orders = db.prepare('SELECT * FROM purchase_orders WHERE supplier_id=? ORDER BY created_at DESC').all(supplier.id);
    supplier.payments = db.prepare('SELECT * FROM supplier_payments WHERE supplier_id=? ORDER BY payment_date DESC').all(supplier.id);

    const totals = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','draft') THEN total ELSE 0 END),0) as total_ordered,
      COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id=?),0) as total_paid
    FROM purchase_orders WHERE supplier_id=?`).get(supplier.id, supplier.id);

    supplier.total_ordered = totals.total_ordered;
    supplier.total_paid = totals.total_paid;
    supplier.balance = totals.total_ordered - totals.total_paid;

    res.json(supplier);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/suppliers — create
router.post('/', (req, res) => {
  try {
    const { code, name, contact_person, phone, email, address, type, payment_terms, rating, notes } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name required' });

    const r = db.prepare(`INSERT INTO suppliers (code,name,contact_person,phone,email,address,type,payment_terms,rating,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(code, name, contact_person || null, phone || null, email || null, address || null,
        type || 'fabric', payment_terms || null, rating || 3, notes || null);

    res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(r.lastInsertRowid));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود المورد موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/suppliers/:id — update
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { name, contact_person, phone, email, address, type, payment_terms, rating, status, notes } = req.body;
    db.prepare(`UPDATE suppliers SET name=COALESCE(?,name), contact_person=COALESCE(?,contact_person),
      phone=COALESCE(?,phone), email=COALESCE(?,email), address=COALESCE(?,address),
      type=COALESCE(?,type), payment_terms=COALESCE(?,payment_terms), rating=COALESCE(?,rating),
      status=COALESCE(?,status), notes=COALESCE(?,notes) WHERE id=?`)
      .run(name||null, contact_person||null, phone||null, email||null, address||null,
        type||null, payment_terms||null, rating||null, status||null, notes||null, req.params.id);

    res.json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/suppliers/:id/payments — record payment
router.post('/:id/payments', (req, res) => {
  try {
    const { po_id, amount, payment_method, reference, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const r = db.prepare(`INSERT INTO supplier_payments (supplier_id, po_id, amount, payment_method, reference, notes)
      VALUES (?,?,?,?,?,?)`)
      .run(req.params.id, po_id || null, parseFloat(amount), payment_method || 'cash', reference || null, notes || null);

    res.status(201).json(db.prepare('SELECT * FROM supplier_payments WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/suppliers/:id — soft delete
router.delete('/:id', (req, res) => {
  try {
    db.prepare("UPDATE suppliers SET status='inactive' WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
