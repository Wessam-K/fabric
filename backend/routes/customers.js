const express = require('express');
const router = express.Router();
const db = require('../database');

// ═══════════════════════════════════════════════
// GET /api/customers — list with search & filter
// ═══════════════════════════════════════════════
router.get('/', (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    let q = `SELECT * FROM customers WHERE 1=1`;
    const params = [];
    if (status) { q += ` AND status = ?`; params.push(status); }
    if (search) {
      q += ` AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    q += ` ORDER BY created_at DESC`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    q += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const rows = db.prepare(q).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('Customers list error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل العملاء' });
  }
});

// ═══════════════════════════════════════════════
// GET /api/customers/:id — single with invoice summary
// ═══════════════════════════════════════════════
router.get('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const invoiceSummary = db.prepare(`
      SELECT COUNT(*) as invoice_count,
        COALESCE(SUM(total), 0) as total_invoiced,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as total_paid
      FROM invoices WHERE customer_id = ?
    `).get(customer.id);

    customer.invoice_count = invoiceSummary.invoice_count;
    customer.total_invoiced = Math.round(invoiceSummary.total_invoiced * 100) / 100;
    customer.total_paid = Math.round(invoiceSummary.total_paid * 100) / 100;
    customer.outstanding = Math.round((invoiceSummary.total_invoiced - invoiceSummary.total_paid) * 100) / 100;

    res.json(customer);
  } catch (err) {
    console.error('Customer get error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل بيانات العميل' });
  }
});

// ═══════════════════════════════════════════════
// GET /api/customers/:id/invoices
// ═══════════════════════════════════════════════
router.get('/:id/invoices', (req, res) => {
  try {
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const invoices = db.prepare(`
      SELECT id, invoice_number, status, subtotal, total, due_date, created_at
      FROM invoices WHERE customer_id = ? ORDER BY created_at DESC
    `).all(customer.id);

    const totals = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_invoiced,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as total_paid
      FROM invoices WHERE customer_id = ?
    `).get(customer.id);

    res.json({
      invoices,
      total_invoiced: Math.round(totals.total_invoiced * 100) / 100,
      total_paid: Math.round(totals.total_paid * 100) / 100,
      outstanding: Math.round((totals.total_invoiced - totals.total_paid) * 100) / 100,
    });
  } catch (err) {
    console.error('Customer invoices error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل فواتير العميل' });
  }
});

// ═══════════════════════════════════════════════
// GET /api/customers/:id/balance
// ═══════════════════════════════════════════════
router.get('/:id/balance', (req, res) => {
  try {
    const customer = db.prepare('SELECT id, name FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const totals = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_invoiced,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as total_paid
      FROM invoices WHERE customer_id = ?
    `).get(customer.id);

    res.json({
      customer_id: customer.id,
      customer_name: customer.name,
      total_invoiced: Math.round(totals.total_invoiced * 100) / 100,
      total_paid: Math.round(totals.total_paid * 100) / 100,
      outstanding: Math.round((totals.total_invoiced - totals.total_paid) * 100) / 100,
    });
  } catch (err) {
    console.error('Customer balance error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء حساب رصيد العميل' });
  }
});

// ═══════════════════════════════════════════════
// POST /api/customers — create
// ═══════════════════════════════════════════════
router.post('/', (req, res) => {
  try {
    const { code, name, phone, email, address, city, tax_number, credit_limit, notes, customer_type, contact_name, payment_terms } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'اسم العميل مطلوب' });
    if (phone && phone.length > 20) return res.status(400).json({ error: 'رقم الهاتف يجب ألا يتجاوز 20 حرف' });
    if (credit_limit !== undefined && credit_limit < 0) return res.status(400).json({ error: 'حد الائتمان يجب أن يكون صفر أو أكثر' });

    // Auto-generate code if not provided
    let customerCode = code;
    if (!customerCode || !customerCode.trim()) {
      const last = db.prepare("SELECT code FROM customers WHERE code LIKE 'CUST-%' ORDER BY id DESC LIMIT 1").get();
      const nextNum = last ? parseInt(last.code.replace('CUST-', '')) + 1 : 1;
      customerCode = `CUST-${String(nextNum).padStart(3, '0')}`;
    }

    // Check duplicate code
    const existing = db.prepare('SELECT id FROM customers WHERE code = ?').get(customerCode);
    if (existing) return res.status(400).json({ error: 'كود العميل موجود مسبقاً، يرجى استخدام كود مختلف' });

    const result = db.prepare(`
      INSERT INTO customers (code, name, phone, email, address, city, tax_number, credit_limit, notes, customer_type, contact_name, payment_terms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customerCode, name.trim(), phone || null, email || null, address || null, city || null, tax_number || null, credit_limit || 0, notes || null, customer_type || 'retail', contact_name || null, payment_terms || null);

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(customer);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'كود العميل موجود مسبقاً، يرجى استخدام كود مختلف' });
    }
    console.error('Customer create error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء العميل' });
  }
});

// ═══════════════════════════════════════════════
// PATCH /api/customers/:id — update
// ═══════════════════════════════════════════════
router.patch('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const { name, phone, email, address, city, tax_number, credit_limit, notes, customer_type, contact_name, payment_terms } = req.body;
    if (name !== undefined && (!name || !name.trim())) return res.status(400).json({ error: 'اسم العميل مطلوب' });
    if (phone && phone.length > 20) return res.status(400).json({ error: 'رقم الهاتف يجب ألا يتجاوز 20 حرف' });

    db.prepare(`
      UPDATE customers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        tax_number = COALESCE(?, tax_number),
        credit_limit = COALESCE(?, credit_limit),
        notes = COALESCE(?, notes),
        customer_type = COALESCE(?, customer_type),
        contact_name = COALESCE(?, contact_name),
        payment_terms = COALESCE(?, payment_terms),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ? name.trim() : null, phone !== undefined ? phone : null,
      email !== undefined ? email : null, address !== undefined ? address : null,
      city !== undefined ? city : null, tax_number !== undefined ? tax_number : null,
      credit_limit !== undefined ? credit_limit : null, notes !== undefined ? notes : null,
      customer_type !== undefined ? customer_type : null, contact_name !== undefined ? contact_name : null,
      payment_terms !== undefined ? payment_terms : null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Customer update error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات العميل' });
  }
});

// ═══════════════════════════════════════════════
// DELETE /api/customers/:id — soft delete
// ═══════════════════════════════════════════════
router.delete('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    db.prepare("UPDATE customers SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ message: 'تم تعطيل العميل بنجاح', id: customer.id });
  } catch (err) {
    console.error('Customer delete error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف العميل' });
  }
});

// ═══════════════════════════════════════════════
// GET /api/customers/:id/payments — list payments
// ═══════════════════════════════════════════════
router.get('/:id/payments', (req, res) => {
  try {
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const payments = db.prepare(`
      SELECT cp.*, i.invoice_number
      FROM customer_payments cp
      LEFT JOIN invoices i ON i.id = cp.invoice_id
      WHERE cp.customer_id = ?
      ORDER BY cp.payment_date DESC
    `).all(customer.id);

    const totals = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM customer_payments WHERE customer_id = ?
    `).get(customer.id);

    res.json({ payments, total_paid: Math.round(totals.total_paid * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل المدفوعات' });
  }
});

// ═══════════════════════════════════════════════
// POST /api/customers/:id/payments — record payment
// ═══════════════════════════════════════════════
router.post('/:id/payments', (req, res) => {
  try {
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const { amount, payment_method, invoice_id, reference_number, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' });

    const validMethods = ['cash', 'bank', 'check', 'other'];
    if (payment_method && !validMethods.includes(payment_method)) {
      return res.status(400).json({ error: 'طريقة الدفع غير صالحة' });
    }

    if (invoice_id) {
      const inv = db.prepare('SELECT id FROM invoices WHERE id = ? AND customer_id = ?').get(invoice_id, customer.id);
      if (!inv) return res.status(400).json({ error: 'الفاتورة غير موجودة أو لا تخص هذا العميل' });
    }

    const result = db.prepare(`
      INSERT INTO customer_payments (customer_id, invoice_id, amount, payment_method, reference, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(customer.id, invoice_id || null, amount, payment_method || 'cash', reference_number || null, notes || null, req.user?.id || null);

    const payment = db.prepare('SELECT * FROM customer_payments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدفعة' });
  }
});

module.exports = router;
