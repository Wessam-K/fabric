const express = require('express');
const router = express.Router();
const db = require('../database');
const { requirePermission, logAudit } = require('../middleware/auth');
const { generateNextNumber } = require('../utils/numberGenerator');
const { fireWebhook } = require('../utils/webhooks');

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
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود الحساب موجود بالفعل' });
    console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' });
  }
});

// PUT /api/accounting/coa/:id
router.put('/coa/:id', requirePermission('accounting', 'edit'), (req, res) => {
  try {
    const { code, name_ar, type, parent_id, is_active } = req.body;
    if (!code || !name_ar || !type) return res.status(400).json({ error: 'الكود والاسم والنوع مطلوبين' });
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
    const { status, search, from, to, page, limit: lim } = req.query;
    let sql = `SELECT je.*, u.full_name AS created_by_name,
      (SELECT SUM(debit) FROM journal_entry_lines WHERE entry_id = je.id) AS total_debit
      FROM journal_entries je LEFT JOIN users u ON je.created_by = u.id WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND je.status = ?'; params.push(status); }
    if (search) { sql += ' AND (je.entry_number LIKE ? OR je.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (from) { sql += ' AND je.entry_date >= ?'; params.push(from); }
    if (to) { sql += ' AND je.entry_date <= ?'; params.push(to); }

    let countSql = `SELECT COUNT(DISTINCT je.id) as c FROM journal_entries je LEFT JOIN users u ON je.created_by = u.id WHERE 1=1`;
    if (status) { countSql += ' AND je.status = ?'; }
    if (search) { countSql += ' AND (je.entry_number LIKE ? OR je.description LIKE ?)'; }
    if (from) { countSql += ' AND je.entry_date >= ?'; }
    if (to) { countSql += ' AND je.entry_date <= ?'; }
    const total = db.prepare(countSql).get(...params)?.c || 0;

    sql += ' ORDER BY je.entry_date DESC, je.id DESC';
    const pageNum = Math.max(1, parseInt(page) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(lim) || 50));
    sql += ' LIMIT ? OFFSET ?';
    params.push(perPage, (pageNum - 1) * perPage);

    const rows = db.prepare(sql).all(...params);
    res.json({ data: rows, total, page: pageNum, pages: Math.ceil(total / perPage) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/accounting/journal/next-number
router.get('/journal/next-number', requirePermission('accounting', 'create'), (req, res) => {
  try {
    res.json({ next: generateNextNumber(db, 'journal_entry') });
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

    // Enforce period lock
    const closedDate = db.prepare("SELECT value FROM settings WHERE key='accounting_period_closed_date'").get()?.value;
    if (closedDate && entry_date <= closedDate) {
      return res.status(400).json({ error: `لا يمكن إنشاء قيد في فترة مغلقة (مغلق حتى ${closedDate})` });
    }

    // Validate each line has either debit or credit (not both zero or negative)
    for (const line of lines) {
      const debit = parseFloat(line.debit) || 0;
      const credit = parseFloat(line.credit) || 0;
      if (debit < 0 || credit < 0) return res.status(400).json({ error: 'المبالغ لا يمكن أن تكون سالبة' });
      if (debit === 0 && credit === 0) return res.status(400).json({ error: 'كل سطر يجب أن يحتوي على مبلغ مدين أو دائن' });
      if (!line.account_id) return res.status(400).json({ error: 'الحساب مطلوب لكل سطر' });
    }

    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
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
    fireWebhook('journal.created', { id, entry_number });
    res.status(201).json({ id });
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
    const closedDate = db.prepare("SELECT value FROM settings WHERE key='accounting_period_closed_date'").get()?.value;
    if (closedDate && entry.entry_date <= closedDate) {
      return res.status(400).json({ error: `لا يمكن ترحيل قيد في فترة مغلقة (مغلق حتى ${closedDate})` });
    }
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
    const closedDate = db.prepare("SELECT value FROM settings WHERE key='accounting_period_closed_date'").get()?.value;
    if (closedDate && entry.entry_date <= closedDate) {
      return res.status(400).json({ error: `لا يمكن إلغاء قيد في فترة مغلقة (مغلق حتى ${closedDate})` });
    }
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

// ═══════════════════════════════════════════
//  Financial Statements
// ═══════════════════════════════════════════

// GET /api/accounting/income-statement — P&L statement
router.get('/income-statement', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const getBalance = (type) => db.prepare(`
      SELECT c.id, c.code, c.name_ar,
        COALESCE(SUM(jl.debit), 0) as total_debit,
        COALESCE(SUM(jl.credit), 0) as total_credit
      FROM chart_of_accounts c
      LEFT JOIN journal_entry_lines jl ON c.id = jl.account_id
        AND jl.entry_id IN (SELECT id FROM journal_entries WHERE status='posted' AND entry_date BETWEEN ? AND ?)
      WHERE c.type = ? AND c.is_active = 1
      GROUP BY c.id HAVING (total_debit != 0 OR total_credit != 0)
      ORDER BY c.code
    `).all(fromDate, toDate, type);

    const revenue = getBalance('revenue');
    const expenses = getBalance('expense');

    // COGS: accounts starting with code '5' that are expense type (convention: 5xxx = cost accounts)
    const cogsAccounts = expenses.filter(a => a.code.startsWith('5'));
    const operatingExpenses = expenses.filter(a => !a.code.startsWith('5'));

    const totalRevenue = revenue.reduce((s, r) => s + (r.total_credit - r.total_debit), 0);
    const totalCOGS = cogsAccounts.reduce((s, r) => s + (r.total_debit - r.total_credit), 0);
    const totalExpenses = operatingExpenses.reduce((s, r) => s + (r.total_debit - r.total_credit), 0);
    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpenses;

    res.json({
      period: { from: fromDate, to: toDate },
      revenue: { accounts: revenue, total: Math.round(totalRevenue * 100) / 100 },
      cogs: { accounts: cogsAccounts, total: Math.round(totalCOGS * 100) / 100 },
      gross_profit: Math.round(grossProfit * 100) / 100,
      expenses: { accounts: operatingExpenses, total: Math.round(totalExpenses * 100) / 100 },
      net_profit: Math.round(netProfit * 100) / 100,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/accounting/balance-sheet — Balance Sheet as of date
router.get('/balance-sheet', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const asOf = req.query.date || new Date().toISOString().slice(0, 10);

    const getBalance = (type) => db.prepare(`
      SELECT c.id, c.code, c.name_ar,
        COALESCE(SUM(jl.debit), 0) as total_debit,
        COALESCE(SUM(jl.credit), 0) as total_credit
      FROM chart_of_accounts c
      LEFT JOIN journal_entry_lines jl ON c.id = jl.account_id
        AND jl.entry_id IN (SELECT id FROM journal_entries WHERE status='posted' AND entry_date <= ?)
      WHERE c.type = ? AND c.is_active = 1
      GROUP BY c.id HAVING (total_debit != 0 OR total_credit != 0)
      ORDER BY c.code
    `).all(asOf, type);

    const assets = getBalance('asset');
    const liabilities = getBalance('liability');
    const equity = getBalance('equity');

    const totalAssets = assets.reduce((s, r) => s + (r.total_debit - r.total_credit), 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + (r.total_credit - r.total_debit), 0);
    const totalEquity = equity.reduce((s, r) => s + (r.total_credit - r.total_debit), 0);

    // Include retained earnings (revenue - expenses from all posted entries up to date)
    const retainedEarnings = (() => {
      try {
        const rev = db.prepare("SELECT COALESCE(SUM(jl.credit - jl.debit), 0) as v FROM journal_entry_lines jl JOIN chart_of_accounts c ON c.id=jl.account_id JOIN journal_entries je ON je.id=jl.entry_id WHERE c.type='revenue' AND je.status='posted' AND je.entry_date <= ?").get(asOf).v;
        const exp = db.prepare("SELECT COALESCE(SUM(jl.debit - jl.credit), 0) as v FROM journal_entry_lines jl JOIN chart_of_accounts c ON c.id=jl.account_id JOIN journal_entries je ON je.id=jl.entry_id WHERE c.type='expense' AND je.status='posted' AND je.entry_date <= ?").get(asOf).v;
        return rev - exp;
      } catch { return 0; }
    })();

    res.json({
      as_of: asOf,
      assets: { accounts: assets, total: Math.round(totalAssets * 100) / 100 },
      liabilities: { accounts: liabilities, total: Math.round(totalLiabilities * 100) / 100 },
      equity: { accounts: equity, total: Math.round(totalEquity * 100) / 100, retained_earnings: Math.round(retainedEarnings * 100) / 100 },
      total_liabilities_equity: Math.round((totalLiabilities + totalEquity + retainedEarnings) * 100) / 100,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + retainedEarnings)) < 0.01,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/accounting/general-ledger — GL detail for one account
router.get('/general-ledger', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const { account_id, from, to, page, limit: lim } = req.query;
    if (!account_id) return res.status(400).json({ error: 'رقم الحساب مطلوب' });

    const account = db.prepare('SELECT * FROM chart_of_accounts WHERE id = ?').get(account_id);
    if (!account) return res.status(404).json({ error: 'الحساب غير موجود' });

    let where = "jl.account_id = ? AND je.status = 'posted'";
    const params = [parseInt(account_id)];
    if (from) { where += ' AND je.entry_date >= ?'; params.push(from); }
    if (to) { where += ' AND je.entry_date <= ?'; params.push(to); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM journal_entry_lines jl JOIN journal_entries je ON je.id=jl.entry_id WHERE ${where}`).get(...params).c;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(lim) || 50));

    const entries = db.prepare(`
      SELECT jl.*, je.entry_number, je.entry_date, je.description as entry_description, je.reference
      FROM journal_entry_lines jl
      JOIN journal_entries je ON je.id = jl.entry_id
      WHERE ${where}
      ORDER BY je.entry_date, je.id
      LIMIT ? OFFSET ?
    `).all(...params, perPage, (pageNum - 1) * perPage);

    // Running balance
    const openingBalance = db.prepare(`
      SELECT COALESCE(SUM(jl.debit - jl.credit), 0) as v
      FROM journal_entry_lines jl JOIN journal_entries je ON je.id=jl.entry_id
      WHERE jl.account_id = ? AND je.status='posted' ${from ? "AND je.entry_date < ?" : ''}
    `).get(parseInt(account_id), ...(from ? [from] : [])).v;

    res.json({ account, entries, opening_balance: Math.round(openingBalance * 100) / 100, total, page: pageNum, pages: Math.ceil(total / perPage) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/accounting/aged-receivables — AR aging report
router.get('/aged-receivables', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT i.customer_id, i.customer_name,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(i.due_date) < 0 THEN i.total ELSE 0 END) as current_due,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(i.due_date) >= 0 AND JULIANDAY('now') - JULIANDAY(i.due_date) <= 30 THEN i.total ELSE 0 END) as days_0_30,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(i.due_date) > 30 AND JULIANDAY('now') - JULIANDAY(i.due_date) <= 60 THEN i.total ELSE 0 END) as days_31_60,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(i.due_date) > 60 AND JULIANDAY('now') - JULIANDAY(i.due_date) <= 90 THEN i.total ELSE 0 END) as days_61_90,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(i.due_date) > 90 THEN i.total ELSE 0 END) as days_90_plus,
        SUM(i.total) as total_outstanding
      FROM invoices i
      WHERE i.status NOT IN ('paid','cancelled','draft') AND i.due_date IS NOT NULL
      GROUP BY i.customer_id
      ORDER BY total_outstanding DESC
    `).all();
    const totals = customers.reduce((acc, c) => {
      acc.current_due += c.current_due; acc.days_0_30 += c.days_0_30; acc.days_31_60 += c.days_31_60;
      acc.days_61_90 += c.days_61_90; acc.days_90_plus += c.days_90_plus;
      acc.total += c.total_outstanding;
      return acc;
    }, { current_due: 0, days_0_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0, total: 0 });
    res.json({ customers, totals });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/accounting/aged-payables — AP aging report
router.get('/aged-payables', requirePermission('accounting', 'view'), (req, res) => {
  try {
    const suppliers = db.prepare(`
      SELECT po.supplier_id, s.name as supplier_name,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(po.expected_date) < 0 THEN (po.total_amount - COALESCE(po.paid_amount,0)) ELSE 0 END) as current_due,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(po.expected_date) >= 0 AND JULIANDAY('now') - JULIANDAY(po.expected_date) <= 30 THEN (po.total_amount - COALESCE(po.paid_amount,0)) ELSE 0 END) as days_0_30,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(po.expected_date) > 30 AND JULIANDAY('now') - JULIANDAY(po.expected_date) <= 60 THEN (po.total_amount - COALESCE(po.paid_amount,0)) ELSE 0 END) as days_31_60,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(po.expected_date) > 60 AND JULIANDAY('now') - JULIANDAY(po.expected_date) <= 90 THEN (po.total_amount - COALESCE(po.paid_amount,0)) ELSE 0 END) as days_61_90,
        SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(po.expected_date) > 90 THEN (po.total_amount - COALESCE(po.paid_amount,0)) ELSE 0 END) as days_90_plus,
        SUM(po.total_amount - COALESCE(po.paid_amount,0)) as total_outstanding
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.status NOT IN ('cancelled','draft') AND po.expected_date IS NOT NULL
        AND (po.total_amount - COALESCE(po.paid_amount,0)) > 0
      GROUP BY po.supplier_id
      ORDER BY total_outstanding DESC
    `).all();
    const totals = suppliers.reduce((acc, s) => {
      acc.current_due += s.current_due; acc.days_0_30 += s.days_0_30; acc.days_31_60 += s.days_31_60;
      acc.days_61_90 += s.days_61_90; acc.days_90_plus += s.days_90_plus;
      acc.total += s.total_outstanding;
      return acc;
    }, { current_due: 0, days_0_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0, total: 0 });
    res.json({ suppliers, totals });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/accounting/period-close — Close accounting period
router.post('/period-close', requirePermission('accounting', 'post'), (req, res) => {
  try {
    const { period_end_date } = req.body;
    if (!period_end_date) return res.status(400).json({ error: 'تاريخ نهاية الفترة مطلوب' });

    // Check all entries up to date are posted
    const unposted = db.prepare("SELECT COUNT(*) as c FROM journal_entries WHERE status='draft' AND entry_date <= ?").get(period_end_date).c;
    if (unposted > 0) return res.status(400).json({ error: `يوجد ${unposted} قيد غير مرحّل قبل تاريخ الإقفال` });

    // Store closed period in settings to enforce locking
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('accounting_period_closed_date', ?)").run(period_end_date);
    logAudit(req, 'PERIOD_CLOSE', 'accounting', null, `Period closed up to ${period_end_date}`);
    res.json({ message: `تم إقفال الفترة حتى ${period_end_date}`, unposted: 0 });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
