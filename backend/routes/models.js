const express = require('express');
const router = express.Router();
const multer = require('multer');
const { logAudit, requirePermission } = require('../middleware/auth');
const path = require('path');
const db = require('../database');

const fs = require('fs');
const uploadDir = path.join(process.env.WK_DB_DIR || path.join(__dirname, '..'), 'uploads', 'models');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const MIME_TO_EXT = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `mdl-${Date.now()}${MIME_TO_EXT[file.mimetype] || '.jpg'}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

// GET /api/models — list all
router.get('/', requirePermission('models', 'view'), (req, res) => {
  try {
    const { search, status, category, gender, page, limit } = req.query;
    let q = 'SELECT * FROM models WHERE 1=1';
    const p = [];
    if (status) { q += ' AND status = ?'; p.push(status); }
    else { q += " AND status = 'active'"; }
    if (category) { q += ' AND category = ?'; p.push(category); }
    if (gender) { q += ' AND gender = ?'; p.push(gender); }
    if (search) { q += ' AND (serial_number LIKE ? OR model_code LIKE ? OR model_name LIKE ?)'; const s = `%${search}%`; p.push(s, s, s); }
    q += ' ORDER BY created_at DESC';

    const countStmt = db.prepare('SELECT COUNT(*) as c FROM bom_templates WHERE model_id = ?');

    if (page && limit) {
      const pg = Math.max(1, parseInt(page));
      const lim = Math.min(200, Math.max(1, parseInt(limit)));
      const total = db.prepare(q.replace('SELECT *', 'SELECT COUNT(*) as c')).get(...p).c;
      const rows = db.prepare(q + ' LIMIT ? OFFSET ?').all(...p, lim, (pg - 1) * lim);
      const data = rows.map(m => ({ ...m, bom_template_count: countStmt.get(m.id).c }));
      return res.json({ data, total, page: pg, totalPages: Math.ceil(total / lim) });
    }

    const models = db.prepare(q).all(...p);
    const result = models.map(m => ({ ...m, bom_template_count: countStmt.get(m.id).c }));
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/models/next-serial — suggest next serial
router.get('/next-serial', requirePermission('models', 'view'), (req, res) => {
  try {
    const last = db.prepare('SELECT serial_number FROM models WHERE serial_number IS NOT NULL ORDER BY id DESC LIMIT 1').get();
    if (!last) return res.json({ next_serial: '1-001' });
    const parts = last.serial_number.split('-');
    const num = parseInt(parts[parts.length - 1], 10) || 0;
    res.json({ next_serial: `${parts[0]}-${String(num + 1).padStart(3, '0')}` });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/models — create (SIMPLIFIED: no fabrics/accessories/sizes)
router.post('/', requirePermission('models', 'create'), (req, res) => {
  try {
    const { serial_number, model_code, model_name, category, gender, notes } = req.body;
    if (!model_code) return res.status(400).json({ error: 'كود الموديل مطلوب' });
    if (gender && !['male','female','kids','unisex'].includes(gender)) return res.status(400).json({ error: 'قيمة الجنس غير صالحة' });
    const r = db.prepare(`INSERT INTO models (serial_number,model_code,model_name,category,gender,notes) VALUES (?,?,?,?,?,?)`)
      .run(serial_number || null, model_code, model_name || null, category || null, gender || 'unisex', notes || null);
    const model = db.prepare('SELECT * FROM models WHERE id=?').get(r.lastInsertRowid);
    logAudit(req, 'CREATE', 'model', model_code, model_name || model_code);
    res.status(201).json(model);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'الرقم التسلسلي أو كود الموديل موجود بالفعل' });
    console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' });
  }
});

// GET /api/models/:code — single model + BOM templates list
router.get('/:code', requirePermission('models', 'view'), (req, res) => {
  try {
    const model = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'غير موجود' });
    model.bom_templates = db.prepare('SELECT id, template_name, is_default, masnaiya, masrouf, margin_pct, created_at FROM bom_templates WHERE model_id=? ORDER BY is_default DESC, id').all(model.id);
    res.json(model);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/models/:code — update basic info
router.put('/:code', requirePermission('models', 'edit'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    const { model_name, category, gender, notes } = req.body;
    if (gender && !['male','female','kids','unisex'].includes(gender)) return res.status(400).json({ error: 'قيمة الجنس غير صالحة' });
    db.prepare(`UPDATE models SET model_name=COALESCE(?,model_name),category=COALESCE(?,category),gender=COALESCE(?,gender),notes=COALESCE(?,notes),updated_at=datetime('now') WHERE model_code=?`)
      .run(model_name || null, category || null, gender || null, notes || null, req.params.code);
    const updated = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    logAudit(req, 'UPDATE', 'model', req.params.code, existing.model_name, existing, updated);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/models/:code — soft delete
router.delete('/:code', requirePermission('models', 'delete'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    db.prepare("UPDATE models SET status='inactive',updated_at=datetime('now') WHERE model_code=?").run(req.params.code);
    logAudit(req, 'DELETE', 'model', req.params.code, existing.model_name || existing.model_code);
    res.json({ message: 'تم التعطيل' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/models/:code/image — upload model image
router.post('/:code/image', requirePermission('models', 'edit'), upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لا توجد صورة' });
    const image_path = `/uploads/models/${req.file.filename}`;
    db.prepare("UPDATE models SET model_image=?,updated_at=datetime('now') WHERE model_code=?").run(image_path, req.params.code);
    res.json({ image_path });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════ BOM TEMPLATES ═══════════════

function getFullTemplate(templateId) {
  const tmpl = db.prepare('SELECT * FROM bom_templates WHERE id=?').get(templateId);
  if (!tmpl) return null;
  tmpl.fabrics = db.prepare(`
    SELECT btf.*, f.name as fabric_name, f.price_per_m, f.fabric_type, f.image_path as fabric_image
    FROM bom_template_fabrics btf LEFT JOIN fabrics f ON f.code = btf.fabric_code
    WHERE btf.template_id=? ORDER BY btf.sort_order, btf.role
  `).all(templateId);
  tmpl.accessories = db.prepare(`
    SELECT bta.*, a.name as registry_name, a.unit as registry_unit
    FROM bom_template_accessories bta LEFT JOIN accessories a ON a.code = bta.accessory_code
    WHERE bta.template_id=?
  `).all(templateId);
  tmpl.sizes = db.prepare('SELECT * FROM bom_template_sizes WHERE template_id=?').all(templateId);
  return tmpl;
}

// GET /api/models/:code/bom-matrix — compare all BOM template variants side by side
router.get('/:code/bom-matrix', requirePermission('models', 'view'), (req, res) => {
  try {
    const model = db.prepare('SELECT id FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'الموديل غير موجود' });
    const templates = db.prepare('SELECT * FROM bom_templates WHERE model_id=? ORDER BY is_default DESC, id').all(model.id);
    const fabricLookup = {};
    for (const f of db.prepare('SELECT code, name, price_per_m, fabric_type FROM fabrics').all()) {
      fabricLookup[f.code] = f;
    }
    const variants = templates.map(t => {
      const full = getFullTemplate(t.id);
      const sizes = full.sizes || [];
      const grandTotal = sizes.reduce((s, sz) => s + (sz.qty_s||0) + (sz.qty_m||0) + (sz.qty_l||0) + (sz.qty_xl||0) + (sz.qty_2xl||0) + (sz.qty_3xl||0), 0);
      const calcFabricCost = (fabrics) => (fabrics || []).reduce((sum, f) => {
        if (!f.fabric_code || !f.meters_per_piece) return sum;
        const reg = fabricLookup[f.fabric_code];
        const price = reg?.price_per_m || 0;
        const mpp = parseFloat(f.meters_per_piece) || 0;
        const waste = parseFloat(f.waste_pct) || 0;
        return sum + mpp * (1 + waste / 100) * price * grandTotal;
      }, 0);
      const mainFabrics = (full.fabrics || []).filter(f => f.role === 'main');
      const linings = (full.fabrics || []).filter(f => f.role === 'lining');
      const mainCost = calcFabricCost(mainFabrics);
      const liningCost = calcFabricCost(linings);
      const accCost = (full.accessories || []).reduce((sum, a) => sum + ((parseFloat(a.quantity)||0) * (parseFloat(a.unit_price)||0) * grandTotal), 0);
      const masCost = (parseFloat(full.masnaiya) || 0) * grandTotal;
      const masrCost = (parseFloat(full.masrouf) || 0) * grandTotal;
      const total = mainCost + liningCost + accCost + masCost + masrCost;
      const perPiece = grandTotal > 0 ? total / grandTotal : 0;
      const margin = parseFloat(full.margin_pct) || 0;
      return {
        id: t.id,
        template_name: t.template_name,
        is_default: t.is_default,
        grand_total: grandTotal,
        fabric_count: mainFabrics.length + linings.length,
        accessory_count: (full.accessories || []).length,
        main_fabric_cost: mainCost,
        lining_cost: liningCost,
        accessories_cost: accCost,
        masnaiya: masCost,
        masrouf: masrCost,
        total_cost: total,
        cost_per_piece: perPiece,
        margin_pct: margin,
        suggested_price: perPiece * (1 + margin / 100),
        fabrics: (full.fabrics || []).map(f => ({
          fabric_code: f.fabric_code,
          fabric_name: f.fabric_name || fabricLookup[f.fabric_code]?.name,
          role: f.role,
          meters_per_piece: f.meters_per_piece,
          waste_pct: f.waste_pct,
        })),
      };
    });
    res.json(variants);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/models/:code/bom-templates — list all BOM templates
router.get('/:code/bom-templates', requirePermission('models', 'view'), (req, res) => {
  try {
    const model = db.prepare('SELECT id FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'الموديل غير موجود' });
    const templates = db.prepare('SELECT * FROM bom_templates WHERE model_id=? ORDER BY is_default DESC, id').all(model.id);
    // Attach summary counts
    for (const t of templates) {
      t.fabric_count = db.prepare('SELECT COUNT(*) as c FROM bom_template_fabrics WHERE template_id=?').get(t.id).c;
      t.accessory_count = db.prepare('SELECT COUNT(*) as c FROM bom_template_accessories WHERE template_id=?').get(t.id).c;
      t.size_count = db.prepare('SELECT COUNT(*) as c FROM bom_template_sizes WHERE template_id=?').get(t.id).c;
    }
    res.json(templates);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/models/:code/bom-templates — create new BOM template
router.post('/:code/bom-templates', requirePermission('models', 'edit'), (req, res) => {
  try {
    const model = db.prepare('SELECT id FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'الموديل غير موجود' });
    const { template_name, is_default, masnaiya, masrouf, margin_pct, notes, fabrics, accessories, sizes } = req.body;

    // Load defaults from settings when values not provided
    const getSetting = (key, fallback) => {
      const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
      return row ? parseFloat(row.value) || fallback : fallback;
    };
    const defMasnaiya = masnaiya ?? getSetting('masnaiya_default', 90);
    const defMasrouf = masrouf ?? getSetting('masrouf_default', 50);
    const defMargin = margin_pct ?? getSetting('margin_default', 25);

    const transaction = db.transaction(() => {
      if (is_default) db.prepare('UPDATE bom_templates SET is_default=0 WHERE model_id=?').run(model.id);
      const r = db.prepare('INSERT INTO bom_templates (model_id,template_name,is_default,masnaiya,masrouf,margin_pct,notes) VALUES (?,?,?,?,?,?,?)')
        .run(model.id, template_name || 'الافتراضي', is_default ? 1 : 0, defMasnaiya, defMasrouf, defMargin, notes || null);
      const tid = r.lastInsertRowid;

      if (fabrics?.length) {
        const defWastePct = getSetting('waste_pct_default', 5);
        const ins = db.prepare('INSERT INTO bom_template_fabrics (template_id,fabric_code,role,meters_per_piece,waste_pct,color_note,sort_order) VALUES (?,?,?,?,?,?,?)');
        fabrics.forEach((f, i) => { if (f.fabric_code) ins.run(tid, f.fabric_code, f.role || 'main', f.meters_per_piece || 1, f.role === 'lining' ? 0 : (f.waste_pct ?? defWastePct), f.color_note || null, f.sort_order ?? i); });
      }
      if (accessories?.length) {
        const ins = db.prepare('INSERT INTO bom_template_accessories (template_id,accessory_code,accessory_name,quantity,unit_price,notes) VALUES (?,?,?,?,?,?)');
        accessories.forEach(a => { if (a.accessory_code || a.accessory_name) ins.run(tid, a.accessory_code || null, a.accessory_name || null, a.quantity || 1, a.unit_price || 0, a.notes || null); });
      }
      if (sizes?.length) {
        const ins = db.prepare('INSERT INTO bom_template_sizes (template_id,color_label,qty_s,qty_m,qty_l,qty_xl,qty_2xl,qty_3xl) VALUES (?,?,?,?,?,?,?,?)');
        sizes.forEach(s => { if (s.color_label) ins.run(tid, s.color_label, s.qty_s||0, s.qty_m||0, s.qty_l||0, s.qty_xl||0, s.qty_2xl||0, s.qty_3xl||0); });
      }
      return tid;
    });

    const tid = transaction();
    res.status(201).json(getFullTemplate(tid));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/models/:code/bom-templates/:templateId — full template
router.get('/:code/bom-templates/:templateId', requirePermission('models', 'view'), (req, res) => {
  try {
    const tmpl = getFullTemplate(parseInt(req.params.templateId));
    if (!tmpl) return res.status(404).json({ error: 'القالب غير موجود' });
    res.json(tmpl);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/models/:code/bom-templates/:templateId — update template
router.put('/:code/bom-templates/:templateId', requirePermission('models', 'edit'), (req, res) => {
  try {
    const tid = parseInt(req.params.templateId);
    const tmpl = db.prepare('SELECT * FROM bom_templates WHERE id=?').get(tid);
    if (!tmpl) return res.status(404).json({ error: 'القالب غير موجود' });
    const { template_name, is_default, masnaiya, masrouf, margin_pct, notes, fabrics, accessories, sizes } = req.body;

    const transaction = db.transaction(() => {
      if (is_default) db.prepare('UPDATE bom_templates SET is_default=0 WHERE model_id=?').run(tmpl.model_id);
      db.prepare('UPDATE bom_templates SET template_name=COALESCE(?,template_name),is_default=?,masnaiya=COALESCE(?,masnaiya),masrouf=COALESCE(?,masrouf),margin_pct=COALESCE(?,margin_pct),notes=COALESCE(?,notes) WHERE id=?')
        .run(template_name || null, is_default ? 1 : 0, masnaiya ?? null, masrouf ?? null, margin_pct ?? null, notes || null, tid);

      if (fabrics) {
        db.prepare('DELETE FROM bom_template_fabrics WHERE template_id=?').run(tid);
        const ins = db.prepare('INSERT INTO bom_template_fabrics (template_id,fabric_code,role,meters_per_piece,waste_pct,color_note,sort_order) VALUES (?,?,?,?,?,?,?)');
        fabrics.forEach((f, i) => { if (f.fabric_code) ins.run(tid, f.fabric_code, f.role || 'main', f.meters_per_piece || 1, f.role === 'lining' ? 0 : (f.waste_pct ?? 5), f.color_note || null, f.sort_order ?? i); });
      }
      if (accessories) {
        db.prepare('DELETE FROM bom_template_accessories WHERE template_id=?').run(tid);
        const ins = db.prepare('INSERT INTO bom_template_accessories (template_id,accessory_code,accessory_name,quantity,unit_price,notes) VALUES (?,?,?,?,?,?)');
        accessories.forEach(a => { if (a.accessory_code || a.accessory_name) ins.run(tid, a.accessory_code || null, a.accessory_name || null, a.quantity || 1, a.unit_price || 0, a.notes || null); });
      }
      if (sizes) {
        db.prepare('DELETE FROM bom_template_sizes WHERE template_id=?').run(tid);
        const ins = db.prepare('INSERT INTO bom_template_sizes (template_id,color_label,qty_s,qty_m,qty_l,qty_xl,qty_2xl,qty_3xl) VALUES (?,?,?,?,?,?,?,?)');
        sizes.forEach(s => { if (s.color_label) ins.run(tid, s.color_label, s.qty_s||0, s.qty_m||0, s.qty_l||0, s.qty_xl||0, s.qty_2xl||0, s.qty_3xl||0); });
      }
    });

    transaction();
    res.json(getFullTemplate(tid));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/models/:code/bom-templates/:templateId — delete
router.delete('/:code/bom-templates/:templateId', requirePermission('models', 'delete'), (req, res) => {
  try {
    const model = db.prepare('SELECT id FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'الموديل غير موجود' });
    const count = db.prepare('SELECT COUNT(*) as c FROM bom_templates WHERE model_id=?').get(model.id).c;
    if (count <= 1) return res.status(400).json({ error: 'لا يمكن حذف آخر وصفة' });
    db.prepare('DELETE FROM bom_templates WHERE id=?').run(parseInt(req.params.templateId));
    res.json({ message: 'تم الحذف' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/models/:code/bom-templates/:templateId/set-default
router.post('/:code/bom-templates/:templateId/set-default', requirePermission('models', 'edit'), (req, res) => {
  try {
    const model = db.prepare('SELECT id FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'الموديل غير موجود' });
    db.prepare('UPDATE bom_templates SET is_default=0 WHERE model_id=?').run(model.id);
    db.prepare('UPDATE bom_templates SET is_default=1 WHERE id=?').run(parseInt(req.params.templateId));
    res.json({ message: 'تم التعيين كافتراضي' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
