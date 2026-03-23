const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

// ═══════════════════════════════════════════════
// Auto-Journal Entry Helper
// ═══════════════════════════════════════════════
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row?.value;
}

function isAutoEnabled(type) {
  return getSetting(`auto_journal_${type}`) === '1';
}

function getAccount(type) {
  // Map transaction types to default account codes
  const map = {
    sales_revenue: '4000', accounts_receivable: '1200', cash: '1000',
    cogs: '5000', inventory: '1400', accounts_payable: '2000',
    salary_expense: '5100', salary_payable: '2100',
    general_expense: '5200', tax_payable: '2200', tax_receivable: '1300',
  };
  const code = map[type];
  if (!code) return null;
  return db.prepare('SELECT id, code, name FROM chart_of_accounts WHERE code=?').get(code);
}

function createJournalEntry(req, description, lines, refType, refId) {
  // Generate JE number
  const last = db.prepare('SELECT entry_number FROM journal_entries ORDER BY id DESC LIMIT 1').get();
  const num = last ? parseInt(String(last.entry_number).replace(/\D/g, '')) + 1 : 1;
  const entryNumber = `JE-${String(num).padStart(5, '0')}`;

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) return null; // Unbalanced

  const result = db.prepare(`INSERT INTO journal_entries 
    (entry_number, entry_date, description, reference_type, reference_id, status, total_debit, total_credit, created_by)
    VALUES (?, datetime('now','localtime'), ?, ?, ?, 'posted', ?, ?, ?)`)
  .run(entryNumber, description, refType || null, refId || null, totalDebit, totalCredit, req.user?.id || null);

  const jeId = result.lastInsertRowid;
  const insLine = db.prepare('INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?,?,?,?,?)');
  for (const l of lines) {
    insLine.run(jeId, l.account_id, l.description || description, l.debit || 0, l.credit || 0);
  }

  return { id: jeId, entry_number: entryNumber };
}

// ═══════════════════════════════════════════════
// POST /api/auto-journal/invoice/:id
// ═══════════════════════════════════════════════
router.post('/invoice/:id', requirePermission('accounting', 'create'), (req, res) => {
  try {
    if (!isAutoEnabled('invoice')) return res.status(400).json({ error: 'القيود التلقائية للفواتير معطلة' });
    const id = parseInt(req.params.id);
    const invoice = db.prepare('SELECT * FROM invoices WHERE id=?').get(id);
    if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const ar = getAccount('accounts_receivable');
    const revenue = getAccount('sales_revenue');
    const taxPayable = getAccount('tax_payable');
    if (!ar || !revenue) return res.status(400).json({ error: 'حسابات مطلوبة غير موجودة في دليل الحسابات' });

    const lines = [];
    const totalWithTax = invoice.total || 0;
    const taxAmount = invoice.tax_amount || 0;
    const netAmount = totalWithTax - taxAmount;

    lines.push({ account_id: ar.id, description: `ذمم مدينة - فاتورة ${invoice.invoice_number}`, debit: totalWithTax, credit: 0 });
    lines.push({ account_id: revenue.id, description: `إيراد مبيعات - فاتورة ${invoice.invoice_number}`, debit: 0, credit: netAmount });
    if (taxAmount > 0 && taxPayable) {
      lines.push({ account_id: taxPayable.id, description: `ضريبة مستحقة - فاتورة ${invoice.invoice_number}`, debit: 0, credit: taxAmount });
    }

    const je = createJournalEntry(req, `قيد تلقائي - فاتورة ${invoice.invoice_number}`, lines, 'invoice', id);
    if (!je) return res.status(400).json({ error: 'القيد غير متوازن' });

    logAudit(req, 'AUTO_JOURNAL', 'invoice', id, `JE ${je.entry_number} for Invoice ${invoice.invoice_number}`);
    res.status(201).json(je);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// POST /api/auto-journal/po-receipt/:id
// ═══════════════════════════════════════════════
router.post('/po-receipt/:id', requirePermission('accounting', 'create'), (req, res) => {
  try {
    if (!isAutoEnabled('po_receipt')) return res.status(400).json({ error: 'القيود التلقائية لأوامر الشراء معطلة' });
    const id = parseInt(req.params.id);
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(id);
    if (!po) return res.status(404).json({ error: 'أمر الشراء غير موجود' });

    const inventory = getAccount('inventory');
    const ap = getAccount('accounts_payable');
    const taxRecv = getAccount('tax_receivable');
    if (!inventory || !ap) return res.status(400).json({ error: 'حسابات مطلوبة غير موجودة' });

    const totalAmount = po.total_amount || 0;
    const taxRate = parseFloat(getSetting('tax_rate') || '0') / 100;
    const taxAmount = totalAmount * taxRate / (1 + taxRate);
    const netAmount = totalAmount - taxAmount;

    const lines = [
      { account_id: inventory.id, description: `مخزون - أمر شراء ${po.po_number}`, debit: netAmount, credit: 0 },
      { account_id: ap.id, description: `ذمم دائنة - أمر شراء ${po.po_number}`, debit: 0, credit: totalAmount },
    ];
    if (taxAmount > 0 && taxRecv) {
      lines.push({ account_id: taxRecv.id, description: `ضريبة مدخلات - ${po.po_number}`, debit: taxAmount, credit: 0 });
    }

    const je = createJournalEntry(req, `قيد تلقائي - استلام أمر شراء ${po.po_number}`, lines, 'purchase_order', id);
    if (!je) return res.status(400).json({ error: 'القيد غير متوازن' });

    logAudit(req, 'AUTO_JOURNAL', 'purchase_order', id, `JE ${je.entry_number} for PO ${po.po_number}`);
    res.status(201).json(je);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// POST /api/auto-journal/expense/:id
// ═══════════════════════════════════════════════
router.post('/expense/:id', requirePermission('accounting', 'create'), (req, res) => {
  try {
    if (!isAutoEnabled('expense')) return res.status(400).json({ error: 'القيود التلقائية للمصروفات معطلة' });
    const id = parseInt(req.params.id);
    const expense = db.prepare('SELECT * FROM expenses WHERE id=? AND is_deleted=0').get(id);
    if (!expense) return res.status(404).json({ error: 'المصروف غير موجود' });

    const expenseAccount = getAccount('general_expense');
    const cash = getAccount('cash');
    if (!expenseAccount || !cash) return res.status(400).json({ error: 'حسابات مطلوبة غير موجودة' });

    const lines = [
      { account_id: expenseAccount.id, description: `${expense.description || expense.expense_type}`, debit: expense.amount, credit: 0 },
      { account_id: cash.id, description: `دفع مصروف - ${expense.description}`, debit: 0, credit: expense.amount },
    ];

    const je = createJournalEntry(req, `قيد تلقائي - مصروف: ${expense.description}`, lines, 'expense', id);
    if (!je) return res.status(400).json({ error: 'القيد غير متوازن' });

    logAudit(req, 'AUTO_JOURNAL', 'expense', id, `JE ${je.entry_number}`);
    res.status(201).json(je);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// POST /api/auto-journal/payroll/:periodId
// ═══════════════════════════════════════════════
router.post('/payroll/:periodId', requirePermission('accounting', 'create'), (req, res) => {
  try {
    if (!isAutoEnabled('payroll')) return res.status(400).json({ error: 'القيود التلقائية للرواتب معطلة' });
    const periodId = parseInt(req.params.periodId);
    const period = db.prepare('SELECT * FROM payroll_periods WHERE id=?').get(periodId);
    if (!period) return res.status(404).json({ error: 'فترة الرواتب غير موجودة' });

    const totalNet = db.prepare('SELECT COALESCE(SUM(net_salary),0) as v FROM payroll_records WHERE period_id=?').get(periodId).v;
    const totalDeductions = db.prepare('SELECT COALESCE(SUM(total_deductions),0) as v FROM payroll_records WHERE period_id=?').get(periodId).v;
    const totalGross = totalNet + totalDeductions;

    const salaryExp = getAccount('salary_expense');
    const salaryPay = getAccount('salary_payable');
    if (!salaryExp || !salaryPay) return res.status(400).json({ error: 'حسابات مطلوبة غير موجودة' });

    const lines = [
      { account_id: salaryExp.id, description: `رواتب ${period.month}`, debit: totalGross, credit: 0 },
      { account_id: salaryPay.id, description: `رواتب مستحقة ${period.month}`, debit: 0, credit: totalGross },
    ];

    const je = createJournalEntry(req, `قيد تلقائي - رواتب ${period.month}`, lines, 'payroll', periodId);
    if (!je) return res.status(400).json({ error: 'القيد غير متوازن' });

    logAudit(req, 'AUTO_JOURNAL', 'payroll', periodId, `JE ${je.entry_number} for Payroll ${period.month}`);
    res.status(201).json(je);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// POST /api/auto-journal/payment — customer/supplier payment
// ═══════════════════════════════════════════════
router.post('/payment', requirePermission('accounting', 'create'), (req, res) => {
  try {
    if (!isAutoEnabled('payment')) return res.status(400).json({ error: 'القيود التلقائية معطلة' });
    const { payment_type, amount, reference_label } = req.body;
    if (!payment_type || !amount) return res.status(400).json({ error: 'نوع الدفع والمبلغ مطلوبان' });

    const cash = getAccount('cash');
    let counterAccount;
    if (payment_type === 'customer') counterAccount = getAccount('accounts_receivable');
    else if (payment_type === 'supplier') counterAccount = getAccount('accounts_payable');
    if (!cash || !counterAccount) return res.status(400).json({ error: 'حسابات مطلوبة غير موجودة' });

    const lines = payment_type === 'customer'
      ? [
          { account_id: cash.id, description: `تحصيل من عميل - ${reference_label || ''}`, debit: parseFloat(amount), credit: 0 },
          { account_id: counterAccount.id, description: `تسوية ذمم مدينة`, debit: 0, credit: parseFloat(amount) },
        ]
      : [
          { account_id: counterAccount.id, description: `سداد مورد - ${reference_label || ''}`, debit: parseFloat(amount), credit: 0 },
          { account_id: cash.id, description: `دفع نقدي`, debit: 0, credit: parseFloat(amount) },
        ];

    const je = createJournalEntry(req, `قيد تلقائي - ${payment_type === 'customer' ? 'تحصيل' : 'سداد'}: ${reference_label || ''}`, lines, 'payment', null);
    if (!je) return res.status(400).json({ error: 'القيد غير متوازن' });

    res.status(201).json(je);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
