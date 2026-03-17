const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit } = require('../middleware/auth');

// GET /api/invoices — list with search, status filter, date range
router.get('/', (req, res) => {
  try {
    const { search, status, date_from, date_to, page = 1, limit = 50 } = req.query;
    let q = 'SELECT * FROM invoices WHERE 1=1';
    const p = [];

    if (search) {
      q += ' AND (invoice_number LIKE ? OR customer_name LIKE ?)';
      const s = `%${search}%`;
      p.push(s, s);
    }
    if (status) { q += ' AND status = ?'; p.push(status); }
    if (date_from) { q += ' AND created_at >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    q += ' ORDER BY created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    q += ' LIMIT ? OFFSET ?';
    p.push(parseInt(limit), offset);

    const invoices = db.prepare(q).all(...p);

    // Get totals for KPI
    const totals = db.prepare(`SELECT
      COUNT(*) as total_count,
      COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END),0) as total_paid,
      COALESCE(SUM(CASE WHEN status IN ('sent','overdue') THEN total ELSE 0 END),0) as total_unpaid,
      COALESCE(SUM(CASE WHEN status='draft' THEN total ELSE 0 END),0) as total_draft
    FROM invoices`).get();

    res.json({ invoices, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/invoices/next-number — suggest next invoice number
router.get('/next-number', (req, res) => {
  try {
    const last = db.prepare("SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1").get();
    let next = 'INV-001';
    if (last) {
      const num = parseInt(last.invoice_number.replace(/\D/g, '') || '0') + 1;
      next = `INV-${String(num).padStart(3, '0')}`;
    }
    res.json({ next_number: next });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/invoices/:id — single invoice with items
router.get('/:id', (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(invoice.id);
    res.json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/invoices — create invoice
router.post('/', (req, res) => {
  try {
    const { invoice_number, customer_name, customer_phone, customer_email, notes, tax_pct, discount, due_date, items, status } = req.body;
    if (!invoice_number || !customer_name) return res.status(400).json({ error: 'invoice_number and customer_name required' });

    // Check duplicate
    const exists = db.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(invoice_number);
    if (exists) return res.status(409).json({ error: 'Invoice number already exists' });

    const subtotal = (items || []).reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
    const taxAmt = subtotal * ((parseFloat(tax_pct) || 0) / 100);
    const total = subtotal + taxAmt - (parseFloat(discount) || 0);

    const ins = db.prepare(`INSERT INTO invoices (invoice_number, customer_name, customer_phone, customer_email, notes, subtotal, tax_pct, discount, total, status, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const result = ins.run(invoice_number, customer_name, customer_phone || null, customer_email || null, notes || null,
      subtotal, parseFloat(tax_pct) || 0, parseFloat(discount) || 0, total, status || 'draft', due_date || null);

    const invoiceId = result.lastInsertRowid;

    // Insert items
    const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, model_code, description, variant, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,?,?)');
    const insertItems = db.transaction((items) => {
      items.forEach((item, i) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        insItem.run(invoiceId, item.model_code || null, item.description, item.variant || null, qty, price, qty * price, i);
      });
    });
    if (items?.length) insertItems(items);

    const created = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    created.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
    logAudit(req, 'CREATE', 'invoice', invoiceId, invoice_number);
    res.status(201).json(created);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/invoices/:id — update invoice
router.put('/:id', (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Not found' });

    const { customer_name, customer_phone, customer_email, notes, tax_pct, discount, due_date, items, status } = req.body;

    const subtotal = (items || []).reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
    const taxAmt = subtotal * ((parseFloat(tax_pct) || 0) / 100);
    const total = subtotal + taxAmt - (parseFloat(discount) || 0);

    db.prepare(`UPDATE invoices SET customer_name=?, customer_phone=?, customer_email=?, notes=?, subtotal=?, tax_pct=?, discount=?, total=?, status=?, due_date=?, updated_at=datetime('now')
      WHERE id=?`).run(
      customer_name || invoice.customer_name, customer_phone ?? invoice.customer_phone, customer_email ?? invoice.customer_email,
      notes ?? invoice.notes, subtotal, parseFloat(tax_pct) ?? invoice.tax_pct, parseFloat(discount) ?? invoice.discount,
      total, status || invoice.status, due_date ?? invoice.due_date, invoice.id
    );

    // Replace items
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice.id);
    const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, model_code, description, variant, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,?,?)');
    const insertItems = db.transaction((items) => {
      items.forEach((item, i) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        insItem.run(invoice.id, item.model_code || null, item.description, item.variant || null, qty, price, qty * price, i);
      });
    });
    if (items?.length) insertItems(items);

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);
    updated.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoice.id);
    logAudit(req, 'UPDATE', 'invoice', invoice.id, invoice.invoice_number, invoice, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/invoices/:id/status — quick status update
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    db.prepare("UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
    res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/invoices/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    logAudit(req, 'DELETE', 'invoice', req.params.id, `INV#${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
