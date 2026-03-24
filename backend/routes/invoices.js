const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

// GET /api/invoices — list with search, status filter, date range
router.get('/', requirePermission('invoices', 'view'), (req, res) => {
  try {
    const { search, status, date_from, date_to, customer_id, page = 1, limit = 50 } = req.query;
    let q = `SELECT i.*, c.name as customer_name_linked FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE 1=1`;
    const p = [];

    if (customer_id) { q += ' AND i.customer_id = ?'; p.push(customer_id); }
    if (search) {
      q += ' AND (i.invoice_number LIKE ? OR i.customer_name LIKE ? OR c.name LIKE ?)';
      const s = `%${search}%`;
      p.push(s, s, s);
    }
    if (status) { q += ' AND i.status = ?'; p.push(status); }
    if (date_from) { q += ' AND i.created_at >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND i.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

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
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// GET /api/invoices/next-number — suggest next invoice number
router.get('/next-number', requirePermission('invoices', 'view'), (req, res) => {
  try {
    const last = db.prepare("SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1").get();
    let next = 'INV-001';
    if (last) {
      const trailingDigits = last.invoice_number.match(/(\d+)$/);
      const num = (trailingDigits ? parseInt(trailingDigits[1], 10) : 0) + 1;
      next = `INV-${String(num).padStart(3, '0')}`;
    }
    res.json({ next_number: next });
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// GET /api/invoices/export — CSV export
router.get('/export', requirePermission('invoices', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT i.*, c.name as customer_name_linked FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id ORDER BY i.created_at DESC`).all();
    const header = 'invoice_number,customer_name,status,subtotal,discount,tax_pct,total,due_date,notes,created_at';
    const esc = v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows.map(r => [r.invoice_number,r.customer_name_linked||r.customer_name,r.status,r.subtotal,r.discount,r.tax_pct,r.total,r.due_date,r.notes,r.created_at].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=invoices.csv');
    res.send('\uFEFF' + csv);
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// GET /api/invoices/:id — single invoice with items
router.get('/:id', requirePermission('invoices', 'view'), (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(invoice.id);
    res.json(invoice);
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// POST /api/invoices — create invoice
router.post('/', requirePermission('invoices', 'create'), (req, res) => {
  try {
    const { invoice_number, customer_name, customer_phone, customer_email, customer_id, notes, tax_pct, discount, due_date, items, status } = req.body;
    if (!invoice_number || !customer_name) return res.status(400).json({ error: 'رقم الفاتورة واسم العميل مطلوبين' });

    // Validate item values
    if (items?.length) {
      for (const item of items) {
        if ((parseFloat(item.quantity) || 0) < 0 || (parseFloat(item.unit_price) || 0) < 0) {
          return res.status(400).json({ error: 'الكمية والسعر يجب أن تكون قيم موجبة' });
        }
      }
    }

    // Check duplicate
    const exists = db.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(invoice_number);
    if (exists) return res.status(409).json({ error: 'رقم الفاتورة موجود بالفعل' });

    const subtotal = (items || []).reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
    const discountAmt = parseFloat(discount) || 0;
    const taxAmt = (subtotal - discountAmt) * ((parseFloat(tax_pct) || 0) / 100);
    const total = subtotal - discountAmt + taxAmt;

    const ins = db.prepare(`INSERT INTO invoices (invoice_number, customer_name, customer_phone, customer_email, customer_id, notes, subtotal, tax_pct, discount, total, status, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const result = ins.run(invoice_number, customer_name, customer_phone || null, customer_email || null, customer_id || null, notes || null,
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
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// PUT /api/invoices/:id — update invoice
router.put('/:id', requirePermission('invoices', 'edit'), (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'غير موجود' });

    const { customer_name, customer_phone, customer_email, customer_id, notes, tax_pct, discount, due_date, items, status } = req.body;

    // Only recalculate totals if items are provided
    let subtotal = invoice.subtotal;
    let total = invoice.total;
    if (items) {
      subtotal = items.reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
      const disc = parseFloat(discount) || invoice.discount || 0;
      const taxAmt = (subtotal - disc) * ((parseFloat(tax_pct) || invoice.tax_pct || 0) / 100);
      total = subtotal - disc + taxAmt;
    } else if (tax_pct !== undefined || discount !== undefined) {
      subtotal = invoice.subtotal;
      const disc = (parseFloat(discount) ?? invoice.discount) || 0;
      const taxAmt = (subtotal - disc) * (((parseFloat(tax_pct) ?? invoice.tax_pct) || 0) / 100);
      total = subtotal - disc + taxAmt;
    }

    db.prepare(`UPDATE invoices SET customer_name=?, customer_phone=?, customer_email=?, customer_id=?, notes=?, subtotal=?, tax_pct=?, discount=?, total=?, status=?, due_date=?, updated_at=datetime('now')
      WHERE id=?`).run(
      customer_name || invoice.customer_name, customer_phone ?? invoice.customer_phone, customer_email ?? invoice.customer_email,
      customer_id !== undefined ? customer_id : invoice.customer_id, notes ?? invoice.notes, subtotal, parseFloat(tax_pct) ?? invoice.tax_pct, parseFloat(discount) ?? invoice.discount,
      total, status || invoice.status, due_date ?? invoice.due_date, invoice.id
    );

    // Only replace items if they were sent in the request
    if (items) {
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice.id);
      const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, model_code, description, variant, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,?,?)');
      const insertItems = db.transaction((items) => {
        items.forEach((item, i) => {
          const qty = parseFloat(item.quantity) || 0;
          const price = parseFloat(item.unit_price) || 0;
          insItem.run(invoice.id, item.model_code || null, item.description, item.variant || null, qty, price, qty * price, i);
        });
      });
      if (items.length) insertItems(items);
    }

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);
    updated.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoice.id);
    logAudit(req, 'UPDATE', 'invoice', invoice.id, invoice.invoice_number, invoice, updated);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// PATCH /api/invoices/:id/status — quick status update
router.patch('/:id/status', requirePermission('invoices', 'edit'), (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'حالة غير صالحة' });
    }
    const invoice = db.prepare('SELECT id, status FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    // Status transition validation
    const validTransitions = {
      draft: ['sent', 'cancelled'],
      sent: ['paid', 'overdue', 'cancelled'],
      overdue: ['paid', 'cancelled'],
      paid: [],
      cancelled: ['draft'],
    };
    const allowed = validTransitions[invoice.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `لا يمكن تغيير الحالة من "${invoice.status}" إلى "${status}"` });
    }

    db.prepare("UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
    res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// DELETE /api/invoices/:id — soft-cancel (preserve audit trail)
router.delete('/:id', requirePermission('invoices', 'delete'), (req, res) => {
  try {
    const invoice = db.prepare('SELECT id, status FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'لا يمكن حذف فاتورة مدفوعة' });
    db.prepare("UPDATE invoices SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(req.params.id);
    logAudit(req, 'DELETE', 'invoice', req.params.id, `INV#${req.params.id} cancelled`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

module.exports = router;
