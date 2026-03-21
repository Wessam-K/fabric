const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit } = require('../middleware/auth');

// GET /api/suppliers — list
router.get('/', (req, res) => {
  try {
    const { search, type, status } = req.query;
    let q = 'SELECT * FROM suppliers WHERE 1=1';
    const p = [];
    if (type) { q += ' AND supplier_type = ?'; p.push(type); }
    if (status) { q += ' AND status = ?'; p.push(status); }
    else { q += " AND status = 'active'"; }
    if (search) {
      q += ' AND (code LIKE ? OR name LIKE ? OR contact_name LIKE ? OR phone LIKE ?)';
      const s = `%${search}%`; p.push(s, s, s, s);
    }
    q += ' ORDER BY created_at DESC';
    const suppliers = db.prepare(q).all(...p);

    const balanceStmt = db.prepare(`SELECT
      COALESCE(SUM(total_amount),0) as total_ordered
      FROM purchase_orders WHERE supplier_id=? AND status NOT IN ('cancelled','draft')`);
    const paidStmt = db.prepare(`SELECT COALESCE(SUM(amount),0) as total_paid FROM supplier_payments WHERE supplier_id=?`);

    const result = suppliers.map(s => {
      const ord = balanceStmt.get(s.id);
      const pd = paidStmt.get(s.id);
      return { ...s, total_ordered: ord.total_ordered, total_paid: pd.total_paid, balance: ord.total_ordered - pd.total_paid };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/suppliers/:id — single with stats
router.get('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'غير موجود' });
    supplier.purchase_orders = db.prepare('SELECT * FROM purchase_orders WHERE supplier_id=? ORDER BY created_at DESC LIMIT 20').all(supplier.id);
    supplier.payments = db.prepare('SELECT * FROM supplier_payments WHERE supplier_id=? ORDER BY payment_date DESC').all(supplier.id);
    const totOrd = db.prepare(`SELECT COALESCE(SUM(total_amount),0) as v FROM purchase_orders WHERE supplier_id=? AND status NOT IN ('cancelled','draft')`).get(supplier.id).v;
    const totPaid = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM supplier_payments WHERE supplier_id=?`).get(supplier.id).v;
    supplier.total_ordered = totOrd;
    supplier.total_paid = totPaid;
    supplier.balance = totOrd - totPaid;
    supplier.total_pos = db.prepare('SELECT COUNT(*) as c FROM purchase_orders WHERE supplier_id=?').get(supplier.id).c;
    res.json(supplier);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/suppliers
router.post('/', (req, res) => {
  try {
    const { code, name, supplier_type, phone, email, address, contact_name, payment_terms, rating, notes } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'الكود والاسم مطلوبين' });
    const r = db.prepare(`INSERT INTO suppliers (code,name,supplier_type,phone,email,address,contact_name,payment_terms,rating,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(code, name, supplier_type || 'both', phone || null, email || null, address || null, contact_name || null, payment_terms || null, rating || 3, notes || null);
    const created = db.prepare('SELECT * FROM suppliers WHERE id=?').get(r.lastInsertRowid);
    logAudit(req, 'CREATE', 'supplier', code, name);
    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود المورد موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    const { name, supplier_type, phone, email, address, contact_name, payment_terms, rating, status, notes } = req.body;
    db.prepare(`UPDATE suppliers SET name=COALESCE(?,name),supplier_type=COALESCE(?,supplier_type),phone=COALESCE(?,phone),email=COALESCE(?,email),address=COALESCE(?,address),contact_name=COALESCE(?,contact_name),payment_terms=COALESCE(?,payment_terms),rating=COALESCE(?,rating),status=COALESCE(?,status),notes=COALESCE(?,notes) WHERE id=?`)
      .run(name||null, supplier_type||null, phone||null, email||null, address||null, contact_name||null, payment_terms||null, rating||null, status||null, notes||null, req.params.id);
    const updated = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
    logAudit(req, 'UPDATE', 'supplier', req.params.id, existing.name, existing, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/suppliers/:id/payments
router.post('/:id/payments', (req, res) => {
  try {
    const { po_id, amount, payment_method, payment_type, reference, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'المبلغ المطلوب غير صالح' });
    const r = db.prepare(`INSERT INTO supplier_payments (supplier_id,po_id,amount,payment_method,payment_type,reference,notes) VALUES (?,?,?,?,?,?,?)`)
      .run(parseInt(req.params.id), po_id || null, parseFloat(amount), payment_method || 'cash', payment_type || 'payment', reference || null, notes || null);
    // Update paid_amount on PO if po_id provided
    if (po_id) {
      const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as v FROM supplier_payments WHERE po_id=?').get(po_id).v;
      db.prepare('UPDATE purchase_orders SET paid_amount=? WHERE id=?').run(totalPaid, po_id);
      // Update total_outstanding on PO
      const po = db.prepare('SELECT total_amount, paid_amount FROM purchase_orders WHERE id=?').get(po_id);
      if (po) {
        db.prepare('UPDATE purchase_orders SET total_outstanding=? WHERE id=?').run((po.total_amount || 0) - (po.paid_amount || 0), po_id);
      }
    }
    // Update total_paid on supplier
    const suppId = parseInt(req.params.id);
    const suppTotalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as v FROM supplier_payments WHERE supplier_id=?').get(suppId).v;
    db.prepare('UPDATE suppliers SET total_paid=? WHERE id=?').run(suppTotalPaid, suppId);

    logAudit(req, 'CREATE', 'supplier_payment', r.lastInsertRowid, `payment ${amount}`);
    res.status(201).json(db.prepare('SELECT * FROM supplier_payments WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/suppliers/:id/ledger — full financial ledger
router.get('/:id/ledger', (req, res) => {
  try {
    const supplier = db.prepare('SELECT id, code, name FROM suppliers WHERE id=?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'غير موجود' });
    // Get all POs as debits
    const pos = db.prepare(`SELECT id, po_number, total_amount, paid_amount, status, order_date, received_date
      FROM purchase_orders WHERE supplier_id=? AND status NOT IN ('cancelled','draft') ORDER BY order_date DESC`).all(supplier.id);
    // Get all payments as credits
    const payments = db.prepare(`SELECT id, po_id, amount, payment_method, payment_type, payment_date, reference, notes
      FROM supplier_payments WHERE supplier_id=? ORDER BY payment_date DESC`).all(supplier.id);
    // Build ledger entries (chronological)
    const entries = [];
    for (const po of pos) {
      entries.push({ type: 'debit', date: po.order_date || po.received_date, description: `أمر شراء ${po.po_number}`, amount: po.total_amount, reference_id: po.id, reference_type: 'purchase_order' });
    }
    for (const p of payments) {
      entries.push({ type: 'credit', date: p.payment_date, description: p.payment_type === 'advance' ? 'دفعة مقدمة' : `دفعة — ${p.payment_method}`, amount: p.amount, reference: p.reference, reference_id: p.id, reference_type: 'payment', po_id: p.po_id });
    }
    entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    // Running balance
    let balance = 0;
    for (const e of entries) {
      if (e.type === 'debit') balance += e.amount;
      else balance -= e.amount;
      e.running_balance = balance;
    }
    const totalOrdered = pos.reduce((s, p) => s + (p.total_amount || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    res.json({ supplier, entries, summary: { total_ordered: totalOrdered, total_paid: totalPaid, balance: totalOrdered - totalPaid } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/suppliers/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare("UPDATE suppliers SET status='inactive' WHERE id=?").run(parseInt(req.params.id));
    logAudit(req, 'DELETE', 'supplier', req.params.id, `supplier#${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
