const express = require('express');
const router = express.Router();
const db = require('../database');
const { requirePermission, logAudit } = require('../middleware/auth');

// ═══════════════════════════════════════════
//  Chart of Accounts
// ═══════════════════════════════════════════

// GET /api/accounting/coa
router.get('/coa', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT c.*, p.code AS parent_code, p.name_ar AS parent_name
      FROM chart_of_accounts c
      LEFT JOIN chart_of_accounts p ON c.parent_id = p.id
      ORDER BY c.code
    `).all();
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/accounting/coa
router.post('/coa', requirePermission('accounting', 'create'), (req, res) => {
  try {
    const { code, name_ar, type, parent_id } = req.body;
    if (!code || !name_ar || !type) return res.status(400).json({ error: 'الكود والاسم والنوع مطلوبين' });
    const result = db.prepare('INSERT INTO chart_of_accounts (code, name_ar, type, parent_id) VALUES (?,?,?,?)')
      .run(code, name_ar, type, parent_id || null);
    logAudit(req, 'CREATE', 'chart_of_accounts', result.lastInsertRowid, `${code} — ${name_ar}`);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود الحساب موجود بالفعل' });
    console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' });
  }
});

// PUT /api/accounting/coa/:id
router.put('/coa/:id', requirePermission('accounting', 'edit'), (req, res) => {
  try {
    const { code, name_ar, type, parent_id, is_active } = req.body;
    db.prepare('UPDATE chart_of_accounts SET code=?, name_ar=?, type=?, parent_id=?, is_active=? WHERE id=?')
      .run(code, name_ar, type, parent_id || null, is_active ?? 1, req.params.id);
    logAudit(req, 'UPDATE', 'chart_of_accounts', req.params.id, `${code}`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  Journal Entries
// ═══════════════════════════════════════════

// GET /api/accounting/journal
router.get('/journal', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const { status, search, from, to } = req.query;
    let sql = `SELECT je.*, u.full_name AS created_by_name,
      (SELECT SUM(debit) FROM journal_entry_lines WHERE entry_id = je.id) AS total_debit
      FROM journal_entries je LEFT JOIN users u ON je.created_by = u.id WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND je.status = ?'; params.push(status); }
    if (search) { sql += ' AND (je.entry_number LIKE ? OR je.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (from) { sql += ' AND je.entry_date >= ?'; params.push(from); }
    if (to) { sql += ' AND je.entry_date <= ?'; params.push(to); }
    sql += ' ORDER BY je.entry_date DESC, je.id DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/accounting/journal/next-number
router.get('/journal/next-number', requirePermission('accounting', 'create'), (req, res) => {
  try {
    const last = db.prepare("SELECT entry_number FROM journal_entries ORDER BY id DESC LIMIT 1").get();
    const num = last ? parseInt(last.entry_number.replace(/\D/g, '')) + 1 : 1;
    res.json({ next: `JE-${String(num).padStart(4, '0')}` });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/accounting/journal/:id
router.get('/journal/:id', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const entry = db.prepare(`SELECT je.*, u.full_name AS created_by_name
      FROM journal_entries je LEFT JOIN users u ON je.created_by = u.id WHERE je.id = ?`).get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'القيد غير موجود' });
    entry.lines = db.prepare(`SELECT jl.*, c.code AS account_code, c.name_ar AS account_name
      FROM journal_entry_lines jl JOIN chart_of_accounts c ON jl.account_id = c.id
      WHERE jl.entry_id = ? ORDER BY jl.id`).all(req.params.id);
    res.json(entry);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/accounting/journal
router.post('/journal', requirePermission('accounting', 'create'), (req, res) => {
  try {
    const { entry_number, entry_date, description, reference, lines } = req.body;
    if (!entry_number || !entry_date || !lines?.length) return res.status(400).json({ error: 'البيانات الأساسية مطلوبة' });

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) return res.status(400).json({ error: 'القيد غير متوازن — المدين لا يساوي الدائن' });

    const insertEntry = db.prepare('INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by) VALUES (?,?,?,?,?)');
    const insertLine = db.prepare('INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)');

    const trx = db.transaction(() => {
      const r = insertEntry.run(entry_number, entry_date, description || '', reference || '', req.user.id);
      for (const line of lines) {
        insertLine.run(r.lastInsertRowid, line.account_id, line.debit || 0, line.credit || 0, line.description || '');
      }
      return r.lastInsertRowid;
    });
    const id = trx();
    logAudit(req, 'CREATE', 'journal_entry', id, `${entry_number}`);
    res.json({ id });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'رقم القيد موجود بالفعل' });
    console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' });
  }
});

// PATCH /api/accounting/journal/:id/post
router.patch('/journal/:id/post', requirePermission('accounting', 'post'), (req, res) => {
  try {
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'القيد غير موجود' });
    if (entry.status === 'posted') return res.status(400).json({ error: 'القيد مرحّل بالفعل' });
    if (entry.status === 'void') return res.status(400).json({ error: 'لا يمكن ترحيل قيد ملغى' });
    db.prepare("UPDATE journal_entries SET status = 'posted', posted_at = datetime('now') WHERE id = ?").run(req.params.id);
    logAudit(req, 'POST', 'journal_entry', req.params.id, `${entry.entry_number}`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/accounting/journal/:id/void
router.patch('/journal/:id/void', requirePermission('accounting', 'post'), (req, res) => {
  try {
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'القيد غير موجود' });
    if (entry.status === 'void') return res.status(400).json({ error: 'القيد ملغى بالفعل' });
    db.prepare("UPDATE journal_entries SET status = 'void' WHERE id = ?").run(req.params.id);
    logAudit(req, 'VOID', 'journal_entry', req.params.id, `${entry.entry_number}`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  Trial Balance
// ═══════════════════════════════════════════
router.get('/trial-balance', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const { from, to } = req.query;
    let dateCond = "je.status = 'posted'";
    const params = [];
    if (from) { dateCond += ' AND je.entry_date >= ?'; params.push(from); }
    if (to) { dateCond += ' AND je.entry_date <= ?'; params.push(to); }

    const rows = db.prepare(`
      SELECT c.id, c.code, c.name_ar, c.type,
        COALESCE(SUM(jl.debit), 0)  AS total_debit,
        COALESCE(SUM(jl.credit), 0) AS total_credit,
        COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS balance
      FROM chart_of_accounts c
      LEFT JOIN journal_entry_lines jl ON c.id = jl.account_id
        AND jl.entry_id IN (SELECT id FROM journal_entries je WHERE ${dateCond})
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.code
    `).all(...params);

    const totals = rows.reduce((acc, r) => {
      acc.total_debit += r.total_debit;
      acc.total_credit += r.total_credit;
      return acc;
    }, { total_debit: 0, total_credit: 0 });

    res.json({ accounts: rows, totals });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  VAT Summary
// ═══════════════════════════════════════════
router.get('/vat-summary', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const { from, to } = req.query;
    let dateCond = '1=1';
    const params = [];
    if (from) { dateCond += ' AND i.created_at >= ?'; params.push(from); }
    if (to) { dateCond += ' AND i.created_at <= ?'; params.push(to); }

    const sales = db.prepare(`
      SELECT COUNT(*) AS count, COALESCE(SUM(subtotal), 0) AS subtotal,
        COALESCE(SUM(total - subtotal + discount), 0) AS tax, COALESCE(SUM(total), 0) AS total
      FROM invoices i WHERE ${dateCond} AND status != 'cancelled'
    `).get(...params);

    let purchaseDateCond = '1=1';
    const purchaseParams = [];
    if (from) { purchaseDateCond += ' AND po.created_at >= ?'; purchaseParams.push(from); }
    if (to) { purchaseDateCond += ' AND po.created_at <= ?'; purchaseParams.push(to); }

    const purchases = db.prepare(`
      SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total,
        COALESCE(SUM(CASE WHEN COALESCE(tax_pct,0) > 0 THEN total_amount * tax_pct / (100 + tax_pct) ELSE 0 END), 0) AS tax
      FROM purchase_orders po WHERE ${purchaseDateCond} AND status != 'cancelled'
    `).get(...purchaseParams);

    const purchaseVat = purchases.tax;

    res.json({
      sales_vat: sales.tax,
      purchase_vat: Math.round(purchaseVat * 100) / 100,
      net_vat: Math.round((sales.tax - purchaseVat) * 100) / 100,
      sales_total: sales.total,
      purchases_total: purchases.total,
      period: { from: from || 'all', to: to || 'all' },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
