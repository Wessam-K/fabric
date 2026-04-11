const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');
const { generateNextNumber } = require('../utils/numberGenerator');
const { fireWebhook } = require('../utils/webhooks');
const { round2, safeSubtract } = require('../utils/money');

// ═══════════════════════════════════════════════
// GET /api/customers — list with search & filter
// ═══════════════════════════════════════════════
router.get('/', requirePermission('customers', 'view'), (req, res) => {
  try {
    const { search, status, page = 1, limit: rawLimit = 50 } = req.query;
    const limit = Math.min(Math.max(parseInt(rawLimit) || 50, 1), 500);
    let where = `WHERE 1=1`;
    const params = [];
    if (status) { where += ` AND status = ?`; params.push(status); }
    if (search) {
      where += ` AND (name LIKE ? OR code LIKE ? OR phone LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    const total = db.prepare(`SELECT COUNT(*) as c FROM customers ${where}`).get(...params).c;
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
    const rows = db.prepare(`SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    res.json({ customers: rows, total });
  } catch (err) {
    console.error('Customers list error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل العملاء' });
  }
});

// ═══════════════════════════════════════════════
// GET /api/customers/export — CSV export
// ═══════════════════════════════════════════════
router.get('/export', requirePermission('customers', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM customers ORDER BY created_at DESC`).all();
    const header = 'code,name,customer_type,phone,email,address,city,tax_number,credit_limit,contact_name,payment_terms,status,notes';
    const esc = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows.map(r => [r.code,r.name,r.customer_type,r.phone,r.email,r.address,r.city,r.tax_number,r.credit_limit,r.contact_name,r.payment_terms,r.status,r.notes].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
    res.send('\uFEFF' + csv);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/customers/import — bulk import
router.post('/import', requirePermission('customers', 'create'), (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'لا توجد بيانات للاستيراد' });
    let imported = 0, updated = 0, errors = [];
    const insert = db.prepare(`INSERT INTO customers (code,name,customer_type,phone,email,address,city,tax_number,credit_limit,contact_name,payment_terms,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const update = db.prepare(`UPDATE customers SET name=?,customer_type=?,phone=?,email=?,address=?,city=?,tax_number=?,credit_limit=?,contact_name=?,payment_terms=?,notes=? WHERE code=?`);
    // Batch-load existing codes to avoid N+1
    const allCodes = items.filter(i => i.code).map(i => i.code);
    const existingSet = new Set();
    if (allCodes.length) {
      const ph = allCodes.map(() => '?').join(',');
      const rows = db.prepare(`SELECT code FROM customers WHERE code IN (${ph})`).all(...allCodes);
      rows.forEach(r => existingSet.add(r.code));
    }
    db.transaction(() => {
      for (const item of items) {
        try {
          if (!item.code || !item.name) { errors.push(`سطر بدون كود أو اسم`); continue; }
          if (existingSet.has(item.code)) { update.run(item.name, item.customer_type||'wholesale', item.phone||null, item.email||null, item.address||null, item.city||null, item.tax_number||null, parseFloat(item.credit_limit)||0, item.contact_name||null, item.payment_terms||null, item.notes||null, item.code); updated++; }
          else { insert.run(item.code, item.name, item.customer_type||'wholesale', item.phone||null, item.email||null, item.address||null, item.city||null, item.tax_number||null, parseFloat(item.credit_limit)||0, item.contact_name||null, item.payment_terms||null, item.notes||null); imported++; }
        } catch (e) { errors.push(`${item.code}: ${e.message}`); }
      }
    })();
    res.json({ imported, updated, errors });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// GET /api/customers/:id — single with invoice summary
// ═══════════════════════════════════════════════
router.get('/:id', requirePermission('customers', 'view'), (req, res) => {
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
    customer.total_invoiced = round2(invoiceSummary.total_invoiced);
    customer.total_paid = round2(invoiceSummary.total_paid);
    customer.outstanding = round2(safeSubtract(invoiceSummary.total_invoiced, invoiceSummary.total_paid));

    res.json(customer);
  } catch (err) {
    console.error('Customer get error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل بيانات العميل' });
  }
});

// ═══════════════════════════════════════════════
// GET /api/customers/:id/invoices
// ═══════════════════════════════════════════════
router.get('/:id/invoices', requirePermission('customers', 'view'), (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
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
      total_invoiced: round2(totals.total_invoiced),
      total_paid: round2(totals.total_paid),
      outstanding: round2(safeSubtract(totals.total_invoiced, totals.total_paid)),
    });
  } catch (err) {
    console.error('Customer invoices error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل فواتير العميل' });
  }
});

// ═══════════════════════════════════════════════
// GET /api/customers/:id/balance
// ═══════════════════════════════════════════════
router.get('/:id/balance', requirePermission('customers', 'view'), (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const totals = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_invoiced,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as total_paid
      FROM invoices WHERE customer_id = ?
    `).get(customer.id);

    res.json({
      customer_id: customer.id,
      customer_name: customer.name,
      total_invoiced: round2(totals.total_invoiced),
      total_paid: round2(totals.total_paid),
      outstanding: round2(safeSubtract(totals.total_invoiced, totals.total_paid)),
    });
  } catch (err) {
    console.error('Customer balance error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء حساب رصيد العميل' });
  }
});

// ═══════════════════════════════════════════════
// POST /api/customers — create
// ═══════════════════════════════════════════════
router.post('/', requirePermission('customers', 'create'), (req, res) => {
  try {
    const { code, name, phone, email, address, city, tax_number, credit_limit, notes, customer_type, contact_name, payment_terms } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'اسم العميل مطلوب' });
    if (phone && phone.length > 20) return res.status(400).json({ error: 'رقم الهاتف يجب ألا يتجاوز 20 حرف' });
    if (credit_limit !== undefined && credit_limit < 0) return res.status(400).json({ error: 'حد الائتمان يجب أن يكون صفر أو أكثر' });
    if (code === null) return res.status(400).json({ error: 'كود العميل لا يمكن أن يكون فارغاً' });

    // Auto-generate code if not provided
    let customerCode = code;
    if (!customerCode || !customerCode.trim()) {
      customerCode = generateNextNumber(db, 'customer');
    }

    // Check duplicate code
    const existing = db.prepare('SELECT id FROM customers WHERE code = ?').get(customerCode);
    if (existing) return res.status(400).json({ error: 'كود العميل موجود مسبقاً، يرجى استخدام كود مختلف' });

    const result = db.prepare(`
      INSERT INTO customers (code, name, phone, email, address, city, tax_number, credit_limit, notes, customer_type, contact_name, payment_terms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customerCode, name.trim(), phone || null, email || null, address || null, city || null, tax_number || null, credit_limit || 0, notes || null, customer_type || 'wholesale', contact_name || null, payment_terms || null);

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req, 'CREATE', 'customer', customer.id, customer.name);
    fireWebhook('customer.created', { id: customer.id, code: customer.code, name: customer.name });
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
router.patch('/:id', requirePermission('customers', 'edit'), (req, res) => {
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
    logAudit(req, 'UPDATE', 'customer', customer.id, customer.name, customer, updated);
    res.json(updated);
  } catch (err) {
    console.error('Customer update error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات العميل' });
  }
});

// ═══════════════════════════════════════════════
// DELETE /api/customers/:id — soft delete
// ═══════════════════════════════════════════════
router.delete('/:id', requirePermission('customers', 'delete'), (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });
    if (customer.status === 'inactive') return res.status(400).json({ error: 'هذا العميل معطل بالفعل' });
    // Check for open invoices
    const openInv = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE customer_id=? AND status NOT IN ('paid','cancelled')").get(req.params.id).c;
    if (openInv > 0) return res.status(409).json({ error: 'لا يمكن تعطيل هذا العميل لأنه مرتبط بفواتير غير مسددة', blocking_count: openInv });
    // Check for active work orders
    const activeWO = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE customer_id=? AND status IN ('pending','in_progress','paused')").get(req.params.id).c;
    if (activeWO > 0) return res.status(409).json({ error: 'لا يمكن تعطيل هذا العميل لأنه مرتبط بأوامر عمل نشطة', blocking_count: activeWO });
    db.prepare("UPDATE customers SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    logAudit(req, 'DEACTIVATE', 'customer', customer.id, customer.name);
    res.json({ message: 'تم تعطيل العميل بنجاح — لا يمكن الحذف النهائي من النظام', id: customer.id });
  } catch (err) {
    console.error('Customer deactivate error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تعطيل العميل' });
  }
});

// ═══════════════════════════════════════════════
// GET /api/customers/:id/payments — list payments
// ═══════════════════════════════════════════════
router.get('/:id/payments', requirePermission('customers', 'view'), (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
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

    res.json({ payments, total_paid: round2(totals.total_paid) });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل المدفوعات' });
  }
});

// ═══════════════════════════════════════════════
// POST /api/customers/:id/payments — record payment
// ═══════════════════════════════════════════════
router.post('/:id/payments', requirePermission('customers', 'edit'), (req, res) => {
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
      const inv = db.prepare('SELECT id, total, status FROM invoices WHERE id = ? AND customer_id = ?').get(invoice_id, customer.id);
      if (!inv) return res.status(400).json({ error: 'الفاتورة غير موجودة أو لا تخص هذا العميل' });
      if (['cancelled', 'paid'].includes(inv.status)) return res.status(400).json({ error: 'لا يمكن تسجيل دفعة على فاتورة ملغاة أو مدفوعة بالكامل' });
      const alreadyPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as v FROM customer_payments WHERE invoice_id=?').get(invoice_id).v;
      const remaining = inv.total - alreadyPaid;
      if (amount > remaining) {
        return res.status(400).json({ error: `المبلغ يتجاوز المتبقي على الفاتورة (${remaining.toFixed(2)})` });
      }
    }

    const payment = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO customer_payments (customer_id, invoice_id, amount, payment_method, reference, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(customer.id, invoice_id || null, amount, payment_method || 'cash', reference_number || null, notes || null, req.user?.id || null);

      // Auto-update invoice status if linked
      if (invoice_id) {
        const inv = db.prepare('SELECT total FROM invoices WHERE id=?').get(invoice_id);
        if (inv) {
          const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as v FROM customer_payments WHERE invoice_id=?').get(invoice_id).v;
          if (totalPaid >= inv.total) {
            db.prepare("UPDATE invoices SET status='paid', updated_at=datetime('now') WHERE id=?").run(invoice_id);
          } else if (totalPaid > 0) {
            db.prepare("UPDATE invoices SET status='partially_paid', updated_at=datetime('now') WHERE id=? AND status NOT IN ('paid','cancelled')").run(invoice_id);
          }
        }
      }

      return db.prepare('SELECT * FROM customer_payments WHERE id = ?').get(result.lastInsertRowid);
    })();

    logAudit(req, 'CREATE', 'customer_payment', payment.id, `${amount}`);
    fireWebhook('payment.received', { id: payment.id, customer_id: payment.customer_id, amount: payment.amount });
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدفعة' });
  }
});

// ═══════════════════════════════════════════
//  CRM — Customer Timeline
// ═══════════════════════════════════════════

// GET /api/customers/:id/timeline — unified activity timeline
router.get('/:id/timeline', requirePermission('customers', 'view'), (req, res) => {
  try {
    const customerId = req.params.id;
    const limit = Math.min(100, parseInt(req.query.limit) || 50);

    const events = [];

    // Work orders
    db.prepare(`SELECT 'work_order' as type, id as ref_id, wo_number as ref, status, created_at as date, 'أمر عمل: ' || wo_number as summary FROM work_orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`).all(customerId, limit).forEach(r => events.push(r));

    // Invoices
    db.prepare(`SELECT 'invoice' as type, id as ref_id, invoice_number as ref, status, created_at as date, 'فاتورة: ' || invoice_number || ' - ' || total as summary FROM invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`).all(customerId, limit).forEach(r => events.push(r));

    // Quotations
    db.prepare(`SELECT 'quotation' as type, id as ref_id, quotation_number as ref, status, created_at as date, 'عرض سعر: ' || quotation_number as summary FROM quotations WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`).all(customerId, limit).forEach(r => events.push(r));

    // Payments
    db.prepare(`SELECT 'payment' as type, id as ref_id, '' as ref, 'completed' as status, payment_date as date, 'دفعة: ' || amount as summary FROM customer_payments WHERE customer_id = ? ORDER BY payment_date DESC LIMIT ?`).all(customerId, limit).forEach(r => events.push(r));

    // Notes
    db.prepare(`SELECT 'note' as type, cn.id as ref_id, '' as ref, 'info' as status, cn.created_at as date, cn.note as summary FROM customer_notes cn WHERE cn.customer_id = ? ORDER BY cn.created_at DESC LIMIT ?`).all(customerId, limit).forEach(r => events.push(r));

    // Sort chronologically (newest first)
    events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    res.json(events.slice(0, limit));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/customers/:id/profitability — customer profitability analysis
router.get('/:id/profitability', requirePermission('customers', 'view'), (req, res) => {
  try {
    const customerId = req.params.id;

    const invoiceTotals = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as collected,
        COALESCE(SUM(CASE WHEN status NOT IN ('paid','cancelled') THEN total ELSE 0 END), 0) as outstanding,
        COUNT(*) as invoice_count
      FROM invoices WHERE customer_id = ?
    `).get(customerId);

    const woStats = db.prepare(`
      SELECT COUNT(*) as total_orders,
        COALESCE(SUM(quantity), 0) as total_pieces,
        AVG(CASE WHEN completed_date IS NOT NULL THEN JULIANDAY(completed_date) - JULIANDAY(created_at) END) as avg_lead_days
      FROM work_orders WHERE customer_id = ?
    `).get(customerId);

    const materialCost = db.prepare(`
      SELECT COALESCE(SUM(wfb.actual_cost), 0) as fabric_cost
      FROM wo_fabric_batches wfb
      JOIN work_orders wo ON wo.id = wfb.wo_id
      WHERE wo.customer_id = ?
    `).get(customerId).fabric_cost;

    const payments = db.prepare('SELECT COALESCE(SUM(amount), 0) as total_paid FROM customer_payments WHERE customer_id = ?').get(customerId).total_paid;

    res.json({
      revenue: invoiceTotals.total_revenue,
      collected: invoiceTotals.collected,
      outstanding: invoiceTotals.outstanding,
      invoice_count: invoiceTotals.invoice_count,
      material_cost: materialCost,
      gross_margin: invoiceTotals.total_revenue - materialCost,
      total_orders: woStats.total_orders,
      total_pieces: woStats.total_pieces,
      avg_lead_days: woStats.avg_lead_days ? Math.round(woStats.avg_lead_days * 10) / 10 : null,
      total_paid: payments,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  CRM — Customer Contacts
// ═══════════════════════════════════════════

// GET /api/customers/:id/contacts
router.get('/:id/contacts', requirePermission('customers', 'view'), (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM customer_contacts WHERE customer_id = ? ORDER BY is_primary DESC, name').all(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/customers/:id/contacts
router.post('/:id/contacts', requirePermission('customers', 'edit'), (req, res) => {
  try {
    const { name, title, phone, email, is_primary } = req.body;
    if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
    const r = db.prepare('INSERT INTO customer_contacts (customer_id, name, title, phone, email, is_primary) VALUES (?,?,?,?,?,?)').run(req.params.id, name, title || null, phone || null, email || null, is_primary ? 1 : 0);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/customers/:id/contacts/:contactId
router.delete('/:id/contacts/:contactId', requirePermission('customers', 'delete'), (req, res) => {
  try {
    db.prepare('DELETE FROM customer_contacts WHERE id = ? AND customer_id = ?').run(req.params.contactId, req.params.id);
    res.json({ message: 'تم الحذف' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  CRM — Customer Notes
// ═══════════════════════════════════════════

// GET /api/customers/:id/notes
router.get('/:id/notes', requirePermission('customers', 'view'), (req, res) => {
  try {
    res.json(db.prepare(`SELECT cn.*, u.full_name as created_by_name FROM customer_notes cn LEFT JOIN users u ON u.id = cn.created_by WHERE cn.customer_id = ? ORDER BY cn.created_at DESC`).all(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/customers/:id/notes
router.post('/:id/notes', requirePermission('customers', 'edit'), (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'الملاحظة مطلوبة' });
    const r = db.prepare('INSERT INTO customer_notes (customer_id, note, created_by) VALUES (?,?,?)').run(req.params.id, note, req.user?.id || null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
