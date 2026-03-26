const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');
const { toCSV } = require('../utils/csv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(process.env.WK_DB_DIR || path.join(__dirname, '..'), 'uploads', 'receipts');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `rcpt-${Date.now()}${path.extname(file.originalname)}`)
});
const receiptUpload = multer({
  storage: receiptStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp)|application\/pdf/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images and PDFs allowed'));
  }
});

// ═══════════════════════════════════════════════
// GET /api/expenses/summary
// ═══════════════════════════════════════════════
router.get('/summary', requirePermission('expenses', 'view'), (req, res) => {
  try {
    const total_this_month = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE is_deleted=0 AND status='approved' AND expense_date >= date('now','start of month')`).get().v;
    const total_this_year = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE is_deleted=0 AND status='approved' AND expense_date >= date('now','start of year')`).get().v;
    const by_type = db.prepare(`SELECT expense_type, COALESCE(SUM(amount),0) as total FROM expenses WHERE is_deleted=0 AND status='approved' GROUP BY expense_type ORDER BY total DESC`).all();
    const by_month = db.prepare(`SELECT strftime('%Y-%m', expense_date) as month, COALESCE(SUM(amount),0) as total FROM expenses WHERE is_deleted=0 AND status='approved' AND expense_date >= date('now','-6 months') GROUP BY month ORDER BY month DESC`).all();
    const pending_count = db.prepare(`SELECT COUNT(*) as c FROM expenses WHERE is_deleted=0 AND status='pending'`).get().c;
    const pending_total = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE is_deleted=0 AND status='pending'`).get().v;
    res.json({ total_this_month, total_this_year, by_type, by_month, pending_count, pending_total });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// GET /api/expenses/export
// ═══════════════════════════════════════════════
router.get('/export', requirePermission('expenses', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT e.*, u.full_name as created_by_name FROM expenses e LEFT JOIN users u ON u.id=e.created_by WHERE e.is_deleted=0 ORDER BY e.expense_date DESC`).all();
    const columns = ['id','expense_type','description','amount','expense_date','status','reference_type','reference_id','notes','created_by_name'];
    const csv = toCSV(rows, columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// GET /api/expenses — list with filters
// ═══════════════════════════════════════════════
router.get('/', requirePermission('expenses', 'view'), (req, res) => {
  try {
    const { type, status, date_from, date_to, search, page = 1, limit = 50 } = req.query;
    let where = 'WHERE e.is_deleted = 0';
    const params = [];
    if (type) { where += ' AND e.expense_type = ?'; params.push(type); }
    if (status) { where += ' AND e.status = ?'; params.push(status); }
    if (date_from) { where += ' AND e.expense_date >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND e.expense_date <= ?'; params.push(date_to); }
    if (search) { where += ' AND (e.description LIKE ? OR e.expense_type LIKE ? OR e.notes LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM expenses e ${where}`).get(...params).c;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const data = db.prepare(`
      SELECT e.*, u1.full_name as created_by_name, u2.full_name as approved_by_name
      FROM expenses e
      LEFT JOIN users u1 ON u1.id = e.created_by
      LEFT JOIN users u2 ON u2.id = e.approved_by
      ${where} ORDER BY e.expense_date DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({ data, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// GET /api/expenses/:id
// ═══════════════════════════════════════════════
router.get('/:id', requirePermission('expenses', 'view'), (req, res) => {
  try {
    const expense = db.prepare(`SELECT e.*, u1.full_name as created_by_name, u2.full_name as approved_by_name
      FROM expenses e LEFT JOIN users u1 ON u1.id=e.created_by LEFT JOIN users u2 ON u2.id=e.approved_by
      WHERE e.id=? AND e.is_deleted=0`).get(req.params.id);
    if (!expense) return res.status(404).json({ error: 'المصروف غير موجود' });
    res.json(expense);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// POST /api/expenses — create
// ═══════════════════════════════════════════════
router.post('/', requirePermission('expenses', 'create'), (req, res) => {
  try {
    const { expense_type, amount, description, expense_date, reference_type, reference_id, notes, receipt_url } = req.body;
    if (!expense_type || !amount || !description || !expense_date) {
      return res.status(400).json({ error: 'النوع والمبلغ والوصف والتاريخ مطلوبون' });
    }
    const validExpenseTypes = ['machine','maintenance','salary','utilities','raw_material','production','transport','other'];
    if (!validExpenseTypes.includes(expense_type)) return res.status(400).json({ error: 'نوع المصروف غير صالح' });
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من صفر' });
    }
    const result = db.prepare(`INSERT INTO expenses (expense_type, amount, description, expense_date, reference_type, reference_id, notes, receipt_url, created_by, status)
      VALUES (?,?,?,?,?,?,?,?,?,'pending')`).run(expense_type, amount, description, expense_date, reference_type || null, reference_id || null, notes || null, receipt_url || null, req.user.id);
    const expense = db.prepare('SELECT * FROM expenses WHERE id=?').get(result.lastInsertRowid);
    logAudit(req, 'create', 'expenses', expense.id, description, null, expense);
    res.status(201).json(expense);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// PUT /api/expenses/:id — update
// ═══════════════════════════════════════════════
router.put('/:id', requirePermission('expenses', 'edit'), (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM expenses WHERE id=? AND is_deleted=0').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'المصروف غير موجود' });
    if (old.status === 'approved' && req.user.role !== 'superadmin') {
      return res.status(400).json({ error: 'لا يمكن تعديل مصروف معتمد' });
    }
    const { expense_type, amount, description, expense_date, reference_type, reference_id, notes, receipt_url } = req.body;
    db.prepare(`UPDATE expenses SET expense_type=COALESCE(?,expense_type), amount=COALESCE(?,amount),
      description=COALESCE(?,description), expense_date=COALESCE(?,expense_date),
      reference_type=COALESCE(?,reference_type), reference_id=COALESCE(?,reference_id),
      notes=COALESCE(?,notes), receipt_url=COALESCE(?,receipt_url) WHERE id=?`)
      .run(expense_type||null, amount!=null?amount:null, description||null, expense_date||null,
        reference_type!==undefined?reference_type:null, reference_id!==undefined?reference_id:null,
        notes!==undefined?notes:null, receipt_url!==undefined?receipt_url:null, req.params.id);
    const updated = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
    logAudit(req, 'update', 'expenses', old.id, old.description, old, updated);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// PUT /api/expenses/:id/approve
// ═══════════════════════════════════════════════
router.put('/:id/approve', requirePermission('expenses', 'approve'), (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM expenses WHERE id=? AND is_deleted=0').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'المصروف غير موجود' });
    db.prepare("UPDATE expenses SET status='approved', approved_by=? WHERE id=?").run(req.user.id, req.params.id);
    logAudit(req, 'approve', 'expenses', old.id, old.description, { status: old.status }, { status: 'approved' });
    res.json(db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// PUT /api/expenses/:id/reject
// ═══════════════════════════════════════════════
router.put('/:id/reject', requirePermission('expenses', 'approve'), (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM expenses WHERE id=? AND is_deleted=0').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'المصروف غير موجود' });
    if (!req.body.reason) return res.status(400).json({ error: 'سبب الرفض مطلوب' });
    db.prepare("UPDATE expenses SET status='rejected', approved_by=?, notes=COALESCE(notes||' | ','') || ? WHERE id=?")
      .run(req.user.id, 'سبب الرفض: ' + req.body.reason, req.params.id);
    logAudit(req, 'reject', 'expenses', old.id, old.description, { status: old.status }, { status: 'rejected', reason: req.body.reason });
    res.json(db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// DELETE /api/expenses/:id — soft delete
// ═══════════════════════════════════════════════
router.delete('/:id', requirePermission('expenses', 'delete'), (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM expenses WHERE id=? AND is_deleted=0').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'المصروف غير موجود' });
    db.prepare('UPDATE expenses SET is_deleted=1 WHERE id=?').run(req.params.id);
    logAudit(req, 'delete', 'expenses', old.id, old.description, old, null);
    res.json({ message: 'تم حذف المصروف بنجاح' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// POST /api/expenses/import
// ═══════════════════════════════════════════════
router.post('/import', requirePermission('expenses', 'create'), (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'يجب إرسال مصفوفة' });
    const errors = [];
    // Validate first, then insert all in one transaction
    const valid = [];
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      if (!r.amount || !r.description) { errors.push({ row: i+1, error: 'المبلغ والوصف مطلوبان' }); continue; }
      valid.push(r);
    }
    const inserted = db.transaction(() => {
      const ins = db.prepare(`INSERT INTO expenses (expense_type, amount, description, expense_date, reference_type, reference_id, notes, created_by, status)
        VALUES (?,?,?,?,?,?,?,?,'pending')`);
      let count = 0;
      for (const r of valid) {
        ins.run(r.expense_type||'other', r.amount, r.description, r.expense_date||new Date().toISOString().slice(0,10),
          r.reference_type||null, r.reference_id||null, r.notes||null, req.user.id);
        count++;
      }
      return count;
    })();
    res.json({ inserted, errors });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/expenses/:id/receipt — upload receipt image/PDF
router.post('/:id/receipt', requirePermission('expenses', 'edit'), receiptUpload.single('receipt'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const expense = db.prepare('SELECT * FROM expenses WHERE id=? AND is_deleted=0').get(id);
    if (!expense) return res.status(404).json({ error: 'المصروف غير موجود' });
    if (!req.file) return res.status(400).json({ error: 'يجب رفع ملف' });

    const receiptUrl = `/uploads/receipts/${req.file.filename}`;
    db.prepare('UPDATE expenses SET receipt_url=? WHERE id=?').run(receiptUrl, id);
    logAudit(req, 'update', 'expenses', id, 'رفع إيصال', { receipt_url: expense.receipt_url }, { receipt_url: receiptUrl });
    res.json({ receipt_url: receiptUrl });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
