const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

const uploadDir = path.join(process.env.WK_DB_DIR || path.join(__dirname, '..'), 'uploads', 'documents');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('نوع الملف غير مدعوم'));
  }
});

// GET /api/documents
router.get('/', requirePermission('documents', 'view'), (req, res) => {
  try {
    const { entity_type, entity_id, category, search, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1'; const params = [];
    if (entity_type) { where += ' AND d.entity_type=?'; params.push(entity_type); }
    if (entity_id) { where += ' AND d.entity_id=?'; params.push(entity_id); }
    if (category) { where += ' AND d.category=?'; params.push(category); }
    if (search) { where += ' AND (d.description LIKE ? OR d.file_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM documents d WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT d.*, u.full_name as uploaded_by_name
      FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by
      WHERE ${where} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/documents/upload
router.post('/upload', requirePermission('documents', 'create'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'الملف مطلوب' });

    // D2: MIME type validation — check magic bytes
    const filePath = req.file.path;
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);
    const hex = buffer.toString('hex').toLowerCase();
    const validMagic = [
      '25504446',     // PDF
      '504b0304',     // ZIP/DOCX/XLSX
      'ffd8ff',       // JPEG
      '89504e47',     // PNG
      '52494646',     // WEBP (RIFF)
      'd0cf11e0',     // DOC/XLS (OLE)
    ];
    const isMagicValid = validMagic.some(m => hex.startsWith(m));
    if (!isMagicValid) {
      fs.unlinkSync(filePath); // Remove suspicious file
      return res.status(400).json({ error: 'نوع الملف غير متطابق مع المحتوى' });
    }

    const { title, entity_type, entity_id, category, notes } = req.body;

    const result = db.prepare(`INSERT INTO documents 
      (title, file_name, file_path, file_size, mime_type, entity_type, entity_id, category, notes, uploaded_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(
        title || req.file.originalname,
        req.file.originalname,
        `/uploads/documents/${req.file.filename}`,
        req.file.size,
        req.file.mimetype,
        entity_type || null,
        entity_id || null,
        category || null,
        notes || null,
        req.user.id
      );

    logAudit(req, 'UPLOAD', 'document', result.lastInsertRowid, title || req.file.originalname);
    res.status(201).json({ id: result.lastInsertRowid, file_path: `/uploads/documents/${req.file.filename}` });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/documents/:id
router.get('/:id', requirePermission('documents', 'view'), (req, res) => {
  try {
    const doc = db.prepare('SELECT d.*, u.full_name as uploaded_by_name FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by WHERE d.id=?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'المستند غير موجود' });
    res.json(doc);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/documents/:id
router.put('/:id', requirePermission('documents', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, category, notes } = req.body;
    db.prepare('UPDATE documents SET title=COALESCE(?,title), category=COALESCE(?,category), notes=COALESCE(?,notes), updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(title, category, notes, id);
    logAudit(req, 'UPDATE', 'document', id, title);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/documents/:id
router.delete('/:id', requirePermission('documents', 'delete'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(id);
    if (!doc) return res.status(404).json({ error: 'المستند غير موجود' });
    db.prepare("UPDATE documents SET deleted_at=datetime('now','localtime') WHERE id=?").run(id);
    logAudit(req, 'DELETE', 'document', id, doc?.title);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  Print-Ready HTML Templates
// ═══════════════════════════════════════════

const templateHeader = (title, companyName) => `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',sans-serif}
  body{padding:20px;font-size:12px;color:#333}
  .header{display:flex;justify-content:space-between;border-bottom:2px solid #1e40af;padding-bottom:10px;margin-bottom:20px}
  .company{font-size:18px;font-weight:bold;color:#1e40af}
  .doc-title{font-size:16px;font-weight:bold;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;margin:15px 0}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:right}
  th{background:#f3f4f6;font-weight:600}
  .total-row{font-weight:bold;background:#f0f9ff}
  .footer{margin-top:30px;text-align:center;color:#666;font-size:10px;border-top:1px solid #ddd;padding-top:10px}
  @media print{body{padding:0}.no-print{display:none}}
</style></head><body>
<div class="header"><div class="company">${companyName}</div><div>طباعة: ${new Date().toLocaleDateString('ar-EG')}</div></div>`;

const templateFooter = `<div class="footer">WK-Factory ERP — نسخة مطبوعة</div></body></html>`;

// GET /api/documents/template/invoice/:id — printable invoice HTML
router.get('/template/invoice/:id', requirePermission('invoices', 'view'), (req, res) => {
  try {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
    const company = db.prepare("SELECT value FROM settings WHERE key='company_name'").get()?.value || 'WK-Factory';

    let html = templateHeader(`فاتورة ${inv.invoice_number}`, company);
    html += `<div class="doc-title">فاتورة رقم: ${inv.invoice_number}</div>`;
    html += `<p>العميل: ${inv.customer_name || '-'} | التاريخ: ${inv.invoice_date || inv.created_at} | الحالة: ${inv.status}</p>`;
    html += `<table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>`;
    items.forEach((item, i) => {
      html += `<tr><td>${i + 1}</td><td>${item.description || item.item_code || '-'}</td><td>${item.quantity}</td><td>${item.unit_price}</td><td>${item.total_price}</td></tr>`;
    });
    html += `</tbody></table>`;
    html += `<table><tr class="total-row"><td colspan="4">الإجمالي</td><td>${inv.total}</td></tr>`;
    if (inv.tax_amount) html += `<tr><td colspan="4">الضريبة</td><td>${inv.tax_amount}</td></tr>`;
    html += `</table>`;
    html += templateFooter;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/documents/template/quotation/:id — printable quotation HTML
router.get('/template/quotation/:id', requirePermission('quotations', 'view'), (req, res) => {
  try {
    const q = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
    if (!q) return res.status(404).json({ error: 'عرض السعر غير موجود' });
    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(q.id);
    const company = db.prepare("SELECT value FROM settings WHERE key='company_name'").get()?.value || 'WK-Factory';

    let html = templateHeader(`عرض سعر ${q.quotation_number}`, company);
    html += `<div class="doc-title">عرض سعر رقم: ${q.quotation_number}</div>`;
    html += `<p>العميل: ${q.customer_name || '-'} | التاريخ: ${q.quotation_date || q.created_at} | الحالة: ${q.status}</p>`;
    if (q.notes) html += `<p>ملاحظات: ${q.notes}</p>`;
    html += `<table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>`;
    items.forEach((item, i) => {
      html += `<tr><td>${i + 1}</td><td>${item.description || '-'}</td><td>${item.quantity}</td><td>${item.unit_price}</td><td>${item.total_price || (item.quantity * item.unit_price)}</td></tr>`;
    });
    html += `</tbody></table>`;
    html += `<table><tr class="total-row"><td colspan="4">الإجمالي</td><td>${q.total || '-'}</td></tr></table>`;
    html += templateFooter;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/documents/template/payslip/:periodId/:employeeId — printable pay slip
router.get('/template/payslip/:periodId/:employeeId', requirePermission('hr', 'view'), (req, res) => {
  try {
    const p = db.prepare('SELECT * FROM payroll WHERE period_id = ? AND employee_id = ?').get(req.params.periodId, req.params.employeeId);
    if (!p) return res.status(404).json({ error: 'كشف الراتب غير موجود' });
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(p.employee_id);
    const period = db.prepare('SELECT * FROM payroll_periods WHERE id = ?').get(p.period_id);
    const company = db.prepare("SELECT value FROM settings WHERE key='company_name'").get()?.value || 'WK-Factory';

    let html = templateHeader(`كشف راتب - ${emp?.full_name || ''}`, company);
    html += `<div class="doc-title">كشف راتب — ${period?.period_month || ''} / ${period?.period_year || ''}</div>`;
    html += `<p>الموظف: ${emp?.full_name || '-'} (${emp?.emp_code || '-'}) | القسم: ${emp?.department || '-'} | الوظيفة: ${emp?.job_title || '-'}</p>`;
    html += `<table><thead><tr><th>البند</th><th>المبلغ</th></tr></thead><tbody>`;
    html += `<tr><td>الراتب الأساسي</td><td>${p.base_salary || 0}</td></tr>`;
    if (p.total_allowances) html += `<tr><td>البدلات</td><td>${p.total_allowances}</td></tr>`;
    if (p.overtime_amount) html += `<tr><td>العمل الإضافي</td><td>${p.overtime_amount}</td></tr>`;
    if (p.bonus) html += `<tr><td>مكافآت</td><td>${p.bonus}</td></tr>`;
    if (p.total_deductions) html += `<tr style="color:#dc2626"><td>الخصومات</td><td>-${p.total_deductions}</td></tr>`;
    html += `<tr class="total-row"><td>صافي الراتب</td><td>${p.net_salary || 0}</td></tr>`;
    html += `</tbody></table>`;
    html += templateFooter;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
