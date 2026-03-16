const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../database');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'models')),
  filename: (req, file, cb) => cb(null, `mdl-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

// Helper: get full model with nested data
function getFullModel(id) {
  const model = db.prepare('SELECT * FROM models WHERE id=?').get(id);
  if (!model) return null;
  model.fabrics = db.prepare(`
    SELECT mf.*, f.name as fabric_name, f.price_per_m as registry_price, f.image_path as fabric_image, f.fabric_type
    FROM model_fabrics mf LEFT JOIN fabrics f ON f.code = mf.fabric_code
    WHERE mf.model_id=? ORDER BY mf.sort_order, mf.role
  `).all(id);
  model.accessories = db.prepare(`
    SELECT ma.*, a.name as registry_name, a.unit as registry_unit
    FROM model_accessories ma LEFT JOIN accessories a ON a.code = ma.accessory_code
    WHERE ma.model_id=?
  `).all(id);
  model.sizes = db.prepare('SELECT * FROM model_sizes WHERE model_id=?').all(id);
  return model;
}

// Helper: calculate cost for a model
function calculateCost(model) {
  const grandTotal = model.sizes.reduce((sum, s) =>
    sum + (s.qty_s||0) + (s.qty_m||0) + (s.qty_l||0) + (s.qty_xl||0) + (s.qty_2xl||0) + (s.qty_3xl||0), 0);

  let mainFabricCost = 0, totalMetersMain = 0;
  let liningCost = 0, totalMetersLining = 0;

  for (const f of model.fabrics) {
    const price = f.registry_price || 0;
    const meters = (f.meters_per_piece || 0) * grandTotal;
    if (f.role === 'main') {
      const cost = meters * price * (1 + (f.waste_pct || 0) / 100);
      mainFabricCost += cost;
      totalMetersMain += meters;
    } else {
      const cost = meters * price;
      liningCost += cost;
      totalMetersLining += meters;
    }
  }

  const accCost = model.accessories.reduce((sum, a) => sum + (a.quantity || 0) * (a.unit_price || 0), 0);
  const masnaiya = model.masnaiya || 0;
  const masrouf = model.masrouf || 0;
  const totalCost = mainFabricCost + liningCost + accCost + masnaiya + masrouf;
  const costPerPiece = grandTotal > 0 ? totalCost / grandTotal : 0;

  return {
    grand_total_pieces: grandTotal,
    total_meters_main: Math.round(totalMetersMain * 100) / 100,
    total_meters_lining: Math.round(totalMetersLining * 100) / 100,
    main_fabric_cost: Math.round(mainFabricCost * 100) / 100,
    lining_cost: Math.round(liningCost * 100) / 100,
    accessories_cost: Math.round(accCost * 100) / 100,
    masnaiya, masrouf,
    total_cost: Math.round(totalCost * 100) / 100,
    cost_per_piece: Math.round(costPerPiece * 100) / 100,
  };
}

// GET /api/models — list all
router.get('/', (req, res) => {
  try {
    const { search, status } = req.query;
    let q = 'SELECT * FROM models WHERE 1=1';
    const p = [];
    if (status) { q += ' AND status = ?'; p.push(status); }
    else { q += " AND status = 'active'"; }
    if (search) { q += ' AND (serial_number LIKE ? OR model_code LIKE ? OR model_name LIKE ?)'; const s = `%${search}%`; p.push(s, s, s); }
    q += ' ORDER BY created_at DESC';
    const models = db.prepare(q).all(...p);

    const result = models.map(m => {
      const full = getFullModel(m.id);
      const cost = calculateCost(full);
      return { ...m, cost_summary: cost };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/models/next-serial — suggest next serial
router.get('/next-serial', (req, res) => {
  try {
    const last = db.prepare('SELECT serial_number FROM models ORDER BY id DESC LIMIT 1').get();
    if (!last) return res.json({ next_serial: '1-001' });
    const parts = last.serial_number.split('-');
    const num = parseInt(parts[parts.length - 1], 10) || 0;
    res.json({ next_serial: `${parts[0]}-${String(num + 1).padStart(3, '0')}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/models — create full model
router.post('/', (req, res) => {
  try {
    const { serial_number, model_code, model_name, masnaiya, masrouf, consumer_price, wholesale_price, notes, fabrics, accessories, sizes } = req.body;
    if (!serial_number || !model_code) return res.status(400).json({ error: 'serial_number and model_code required' });

    const transaction = db.transaction(() => {
      const r = db.prepare(`INSERT INTO models (serial_number,model_code,model_name,masnaiya,masrouf,consumer_price,wholesale_price,notes) VALUES (?,?,?,?,?,?,?,?)`)
        .run(serial_number, model_code, model_name || null, masnaiya ?? 90, masrouf ?? 50, consumer_price || null, wholesale_price || null, notes || null);
      const modelId = r.lastInsertRowid;

      if (fabrics && Array.isArray(fabrics)) {
        const ins = db.prepare('INSERT INTO model_fabrics (model_id,fabric_code,role,meters_per_piece,waste_pct,color_note,sort_order) VALUES (?,?,?,?,?,?,?)');
        fabrics.forEach((f, i) => {
          if (f.fabric_code && f.meters_per_piece) {
            ins.run(modelId, f.fabric_code, f.role || 'main', parseFloat(f.meters_per_piece), f.role === 'lining' ? 0 : (parseFloat(f.waste_pct) || 5), f.color_note || null, f.sort_order ?? i);
          }
        });
      }

      if (accessories && Array.isArray(accessories)) {
        const ins = db.prepare('INSERT INTO model_accessories (model_id,accessory_code,accessory_name,quantity,unit_price,notes) VALUES (?,?,?,?,?,?)');
        accessories.forEach(a => {
          if (a.quantity && a.unit_price) {
            ins.run(modelId, a.accessory_code || null, a.accessory_name || null, parseFloat(a.quantity), parseFloat(a.unit_price), a.notes || null);
          }
        });
      }

      if (sizes && Array.isArray(sizes)) {
        const ins = db.prepare('INSERT INTO model_sizes (model_id,color_label,qty_s,qty_m,qty_l,qty_xl,qty_2xl,qty_3xl) VALUES (?,?,?,?,?,?,?,?)');
        sizes.forEach(s => {
          if (s.color_label) {
            ins.run(modelId, s.color_label, s.qty_s||0, s.qty_m||0, s.qty_l||0, s.qty_xl||0, s.qty_2xl||0, s.qty_3xl||0);
          }
        });
      }

      return modelId;
    });

    const modelId = transaction();
    const full = getFullModel(modelId);
    const cost = calculateCost(full);
    res.status(201).json({ ...full, cost_summary: cost });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'الرقم التسلسلي أو كود الموديل موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/models/:code — full model
router.get('/:code', (req, res) => {
  try {
    const model = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'Not found' });
    const full = getFullModel(model.id);
    const cost = calculateCost(full);
    res.json({ ...full, cost_summary: cost });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/models/:code — update full model
router.put('/:code', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { model_name, masnaiya, masrouf, consumer_price, wholesale_price, notes, fabrics, accessories, sizes } = req.body;

    const transaction = db.transaction(() => {
      db.prepare(`UPDATE models SET model_name=COALESCE(?,model_name),masnaiya=COALESCE(?,masnaiya),masrouf=COALESCE(?,masrouf),consumer_price=?,wholesale_price=?,notes=COALESCE(?,notes) WHERE model_code=?`)
        .run(model_name||null, masnaiya??null, masrouf??null, consumer_price??null, wholesale_price??null, notes||null, req.params.code);

      if (fabrics && Array.isArray(fabrics)) {
        db.prepare('DELETE FROM model_fabrics WHERE model_id=?').run(existing.id);
        const ins = db.prepare('INSERT INTO model_fabrics (model_id,fabric_code,role,meters_per_piece,waste_pct,color_note,sort_order) VALUES (?,?,?,?,?,?,?)');
        fabrics.forEach((f, i) => {
          if (f.fabric_code && f.meters_per_piece) {
            ins.run(existing.id, f.fabric_code, f.role || 'main', parseFloat(f.meters_per_piece), f.role === 'lining' ? 0 : (parseFloat(f.waste_pct) || 5), f.color_note || null, f.sort_order ?? i);
          }
        });
      }

      if (accessories && Array.isArray(accessories)) {
        db.prepare('DELETE FROM model_accessories WHERE model_id=?').run(existing.id);
        const ins = db.prepare('INSERT INTO model_accessories (model_id,accessory_code,accessory_name,quantity,unit_price,notes) VALUES (?,?,?,?,?,?)');
        accessories.forEach(a => {
          if (a.quantity && a.unit_price) {
            ins.run(existing.id, a.accessory_code || null, a.accessory_name || null, parseFloat(a.quantity), parseFloat(a.unit_price), a.notes || null);
          }
        });
      }

      if (sizes && Array.isArray(sizes)) {
        db.prepare('DELETE FROM model_sizes WHERE model_id=?').run(existing.id);
        const ins = db.prepare('INSERT INTO model_sizes (model_id,color_label,qty_s,qty_m,qty_l,qty_xl,qty_2xl,qty_3xl) VALUES (?,?,?,?,?,?,?,?)');
        sizes.forEach(s => {
          if (s.color_label) {
            ins.run(existing.id, s.color_label, s.qty_s||0, s.qty_m||0, s.qty_l||0, s.qty_xl||0, s.qty_2xl||0, s.qty_3xl||0);
          }
        });
      }
    });

    transaction();
    const full = getFullModel(existing.id);
    const cost = calculateCost(full);
    res.json({ ...full, cost_summary: cost });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/models/:code — soft delete
router.delete('/:code', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare("UPDATE models SET status='inactive' WHERE model_code=?").run(req.params.code);
    res.json({ message: 'Deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/models/:code/cost — live cost calculation
router.get('/:code/cost', (req, res) => {
  try {
    const model = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'Not found' });
    const full = getFullModel(model.id);
    res.json(calculateCost(full));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/models/:code/snapshot — save cost snapshot
router.post('/:code/snapshot', (req, res) => {
  try {
    const model = db.prepare('SELECT * FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'Not found' });
    const full = getFullModel(model.id);
    const c = calculateCost(full);
    const r = db.prepare(`INSERT INTO cost_snapshots (model_id,total_pieces,total_meters_main,total_meters_lining,main_fabric_cost,lining_cost,accessories_cost,masnaiya,masrouf,total_cost,cost_per_piece,consumer_price,wholesale_price) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(model.id, c.grand_total_pieces, c.total_meters_main, c.total_meters_lining, c.main_fabric_cost, c.lining_cost, c.accessories_cost, c.masnaiya, c.masrouf, c.total_cost, c.cost_per_piece, model.consumer_price, model.wholesale_price);
    res.status(201).json(db.prepare('SELECT * FROM cost_snapshots WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/models/:code/image — upload model image
router.post('/:code/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image' });
    const image_path = `/uploads/models/${req.file.filename}`;
    db.prepare('UPDATE models SET model_image=? WHERE model_code=?').run(image_path, req.params.code);
    res.json({ image_path });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════ BOM Variants ═══════════════

// GET /api/models/:code/variants — list variants for a model
router.get('/:code/variants', (req, res) => {
  try {
    const model = db.prepare('SELECT id FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const variants = db.prepare('SELECT * FROM bom_variants WHERE model_id=? ORDER BY is_default DESC, id').all(model.id);
    for (const v of variants) {
      v.fabrics = db.prepare(`
        SELECT bvf.*, f.name AS fabric_name, f.price_per_m, f.fabric_type
        FROM bom_variant_fabrics bvf LEFT JOIN fabrics f ON f.code = bvf.fabric_code
        WHERE bvf.variant_id=? ORDER BY bvf.sort_order
      `).all(v.id);
      v.accessories = db.prepare(`
        SELECT bva.*, a.name AS registry_name, a.unit AS registry_unit
        FROM bom_variant_accessories bva LEFT JOIN accessories a ON a.code = bva.accessory_code
        WHERE bva.variant_id=?
      `).all(v.id);
    }
    res.json(variants);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/models/:code/variants — create a variant
router.post('/:code/variants', (req, res) => {
  try {
    const model = db.prepare('SELECT id FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const { name, is_default, notes, fabrics, accessories } = req.body;
    if (!name) return res.status(400).json({ error: 'Variant name required' });

    const transaction = db.transaction(() => {
      if (is_default) {
        db.prepare('UPDATE bom_variants SET is_default=0 WHERE model_id=?').run(model.id);
      }
      const r = db.prepare('INSERT INTO bom_variants (model_id,name,is_default,notes) VALUES (?,?,?,?)')
        .run(model.id, name, is_default ? 1 : 0, notes || null);
      const variantId = r.lastInsertRowid;

      if (fabrics && Array.isArray(fabrics)) {
        const ins = db.prepare('INSERT INTO bom_variant_fabrics (variant_id,fabric_code,role,meters_per_piece,waste_pct,color_note,sort_order) VALUES (?,?,?,?,?,?,?)');
        fabrics.forEach((f, i) => {
          if (f.fabric_code && f.meters_per_piece) {
            ins.run(variantId, f.fabric_code, f.role || 'main', parseFloat(f.meters_per_piece), parseFloat(f.waste_pct) || 5, f.color_note || null, i);
          }
        });
      }
      if (accessories && Array.isArray(accessories)) {
        const ins = db.prepare('INSERT INTO bom_variant_accessories (variant_id,accessory_code,accessory_name,quantity,unit_price,notes) VALUES (?,?,?,?,?,?)');
        accessories.forEach(a => {
          if (a.quantity && a.unit_price) {
            ins.run(variantId, a.accessory_code || null, a.accessory_name || null, parseFloat(a.quantity), parseFloat(a.unit_price), a.notes || null);
          }
        });
      }
      return variantId;
    });

    const variantId = transaction();
    const variant = db.prepare('SELECT * FROM bom_variants WHERE id=?').get(variantId);
    res.status(201).json(variant);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/models/:code/variants/:vid — update a variant
router.put('/:code/variants/:vid', (req, res) => {
  try {
    const model = db.prepare('SELECT id FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const variant = db.prepare('SELECT * FROM bom_variants WHERE id=? AND model_id=?').get(req.params.vid, model.id);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    const { name, is_default, notes, fabrics, accessories } = req.body;

    const transaction = db.transaction(() => {
      if (is_default) {
        db.prepare('UPDATE bom_variants SET is_default=0 WHERE model_id=?').run(model.id);
      }
      db.prepare('UPDATE bom_variants SET name=COALESCE(?,name), is_default=COALESCE(?,is_default), notes=? WHERE id=?')
        .run(name || null, is_default != null ? (is_default ? 1 : 0) : null, notes ?? variant.notes, variant.id);

      if (fabrics && Array.isArray(fabrics)) {
        db.prepare('DELETE FROM bom_variant_fabrics WHERE variant_id=?').run(variant.id);
        const ins = db.prepare('INSERT INTO bom_variant_fabrics (variant_id,fabric_code,role,meters_per_piece,waste_pct,color_note,sort_order) VALUES (?,?,?,?,?,?,?)');
        fabrics.forEach((f, i) => {
          if (f.fabric_code && f.meters_per_piece) {
            ins.run(variant.id, f.fabric_code, f.role || 'main', parseFloat(f.meters_per_piece), parseFloat(f.waste_pct) || 5, f.color_note || null, i);
          }
        });
      }
      if (accessories && Array.isArray(accessories)) {
        db.prepare('DELETE FROM bom_variant_accessories WHERE variant_id=?').run(variant.id);
        const ins = db.prepare('INSERT INTO bom_variant_accessories (variant_id,accessory_code,accessory_name,quantity,unit_price,notes) VALUES (?,?,?,?,?,?)');
        accessories.forEach(a => {
          if (a.quantity && a.unit_price) {
            ins.run(variant.id, a.accessory_code || null, a.accessory_name || null, parseFloat(a.quantity), parseFloat(a.unit_price), a.notes || null);
          }
        });
      }
    });

    transaction();
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/models/:code/variants/:vid — delete a variant
router.delete('/:code/variants/:vid', (req, res) => {
  try {
    const model = db.prepare('SELECT id FROM models WHERE model_code=?').get(req.params.code);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const variant = db.prepare('SELECT * FROM bom_variants WHERE id=? AND model_id=?').get(req.params.vid, model.id);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });
    db.prepare('DELETE FROM bom_variants WHERE id=?').run(variant.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
