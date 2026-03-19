const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit } = require('../middleware/auth');

// ═══════════════════════════════════════════════
// COST CALCULATION (used by multiple endpoints)
// ═══════════════════════════════════════════════
function calculateWOCost(woId) {
  const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
  if (!wo) return null;

  // Total pieces: from sizes or direct quantity
  let totalPieces = wo.quantity || 0;
  if (wo.is_size_based) {
    const szTotal = db.prepare('SELECT COALESCE(SUM(qty_s+qty_m+qty_l+qty_xl+qty_2xl+qty_3xl),0) as t FROM wo_sizes WHERE wo_id=?').get(woId).t;
    if (szTotal > 0) totalPieces = szTotal;
  }
  if (!totalPieces) {
    totalPieces = db.prepare('SELECT COALESCE(SUM(qty_s+qty_m+qty_l+qty_xl+qty_2xl+qty_3xl),0) as t FROM wo_sizes WHERE wo_id=?').get(woId).t || 0;
  }

  // V4 batch-based fabrics
  const batchFabrics = db.prepare('SELECT * FROM wo_fabric_batches WHERE wo_id=?').all(woId);
  // V3 legacy fabrics
  const legacyFabrics = db.prepare('SELECT wf.*, f.price_per_m FROM wo_fabrics wf LEFT JOIN fabrics f ON f.code=wf.fabric_code WHERE wf.wo_id=?').all(woId);

  let main_fabric_cost = 0, lining_cost = 0, waste_cost = 0;
  let total_meters_main = 0, total_meters_lining = 0;

  if (batchFabrics.length > 0) {
    for (const f of batchFabrics) {
      const meters = f.actual_total_meters ?? f.planned_total_meters;
      const cost = meters * f.price_per_meter;
      const wCost = (f.waste_meters || 0) * f.price_per_meter;
      if (f.role === 'lining') { lining_cost += cost; total_meters_lining += meters; }
      else { main_fabric_cost += cost; total_meters_main += meters; }
      waste_cost += wCost;
    }
  } else {
    for (const f of legacyFabrics) {
      const price = f.price_per_m || 0;
      const meters = (f.meters_per_piece || 0) * (totalPieces || 1);
      if (f.role === 'lining') { lining_cost += meters * price; total_meters_lining += meters; }
      else { main_fabric_cost += meters * price * (1 + (f.waste_pct || 0) / 100); total_meters_main += meters; }
    }
  }

  // Accessories: prefer v4 detail, fallback to v3
  const detailAcc = db.prepare('SELECT * FROM wo_accessories_detail WHERE wo_id=?').all(woId);
  const legacyAcc = db.prepare('SELECT * FROM wo_accessories WHERE wo_id=?').all(woId);
  let accessories_cost = 0;
  if (detailAcc.length > 0) {
    for (const a of detailAcc) {
      const qty = a.actual_quantity ?? (a.quantity_per_piece * totalPieces);
      accessories_cost += qty * a.unit_price;
    }
  } else {
    for (const a of legacyAcc) accessories_cost += (a.quantity || 0) * (a.unit_price || 0);
  }

  // Extra expenses
  const expenses = db.prepare('SELECT * FROM wo_extra_expenses WHERE wo_id=?').all(woId);
  let extra_expenses = 0;
  for (const e of expenses) extra_expenses += e.amount;

  const masnaiya_total = (wo.masnaiya || 0) * totalPieces;
  const masrouf_total = (wo.masrouf || 0) * totalPieces;
  const total_cost = main_fabric_cost + lining_cost + accessories_cost + masnaiya_total + masrouf_total + waste_cost + extra_expenses;
  const cost_per_piece = totalPieces > 0 ? total_cost / totalPieces : 0;
  const waste_cost_per_piece = totalPieces > 0 ? waste_cost / totalPieces : 0;
  const extra_cost_per_piece = totalPieces > 0 ? extra_expenses / totalPieces : 0;
  const margin = wo.margin_pct || 0;
  const suggested_consumer = cost_per_piece * (1 + margin / 100);

  const round2 = v => Math.round((v || 0) * 100) / 100;
  return {
    total_pieces: totalPieces,
    grand_total_pieces: totalPieces,
    total_meters_main: round2(total_meters_main),
    total_meters_lining: round2(total_meters_lining),
    main_fabric_cost: round2(main_fabric_cost),
    lining_cost: round2(lining_cost),
    accessories_cost: round2(accessories_cost),
    masnaiya_total: round2(masnaiya_total),
    masrouf_total: round2(masrouf_total),
    masnaiya: wo.masnaiya || 0,
    masrouf: wo.masrouf || 0,
    waste_cost: round2(waste_cost),
    waste_cost_per_piece: round2(waste_cost_per_piece),
    extra_expenses: round2(extra_expenses),
    extra_cost_per_piece: round2(extra_cost_per_piece),
    total_cost: round2(total_cost),
    cost_per_piece: round2(cost_per_piece),
    suggested_consumer_price: round2(suggested_consumer),
    suggested_wholesale: round2(suggested_consumer * 0.78),
    consumer_price: wo.consumer_price,
    wholesale_price: wo.wholesale_price,
    margin_pct: margin,
    pieces_completed: wo.pieces_completed || 0,
  };
}

// ═══════════════════════════════════════════════
// HELPER: get full work order with all nested data
// ═══════════════════════════════════════════════
function getFullWO(id) {
  const wo = db.prepare(`
    SELECT wo.*, m.model_code, m.model_name, m.model_image, m.category,
      bt.template_name
    FROM work_orders wo
    LEFT JOIN models m ON m.id=wo.model_id
    LEFT JOIN bom_templates bt ON bt.id=wo.template_id
    WHERE wo.id=?
  `).get(id);
  if (!wo) return null;

  wo.fabrics = db.prepare(`
    SELECT wf.*, f.name as fabric_name, f.price_per_m, f.fabric_type, f.image_path as fabric_image, f.color as fabric_color
    FROM wo_fabrics wf LEFT JOIN fabrics f ON f.code = wf.fabric_code
    WHERE wf.wo_id=? ORDER BY wf.sort_order, wf.role
  `).all(id);

  wo.accessories = db.prepare(`
    SELECT wa.*, a.name as registry_name, a.unit as registry_unit
    FROM wo_accessories wa LEFT JOIN accessories a ON a.code = wa.accessory_code
    WHERE wa.wo_id=?
  `).all(id);

  wo.fabric_batches = db.prepare(`
    SELECT wfb.*, f.name as fabric_name, f.fabric_type, f.image_path as fabric_image,
      fib.batch_code, fib.available_meters as batch_available, fib.batch_status,
      s.name as supplier_name, po.po_number
    FROM wo_fabric_batches wfb
    LEFT JOIN fabrics f ON f.code = wfb.fabric_code
    LEFT JOIN fabric_inventory_batches fib ON fib.id = wfb.batch_id
    LEFT JOIN suppliers s ON s.id = fib.supplier_id
    LEFT JOIN purchase_orders po ON po.id = fib.po_id
    WHERE wfb.wo_id=? ORDER BY wfb.sort_order, wfb.role
  `).all(id);

  wo.accessories_detail = db.prepare(`
    SELECT wad.*, a.name as registry_name, a.unit as registry_unit
    FROM wo_accessories_detail wad LEFT JOIN accessories a ON a.code = wad.accessory_code
    WHERE wad.wo_id=?
  `).all(id);

  wo.sizes = db.prepare('SELECT * FROM wo_sizes WHERE wo_id=?').all(id);
  wo.stages = db.prepare(`
    SELECT ws.*, st.color as stage_color
    FROM wo_stages ws
    LEFT JOIN stage_templates st ON st.name = ws.stage_name
    WHERE ws.wo_id=? ORDER BY ws.sort_order
  `).all(id);
  wo.extra_expenses = db.prepare('SELECT * FROM wo_extra_expenses WHERE wo_id=? ORDER BY recorded_at').all(id);
  wo.partial_invoices = db.prepare('SELECT * FROM partial_invoices WHERE wo_id=? ORDER BY created_at').all(id);
  wo.cost_summary = calculateWOCost(id);

  // V7: Movement log
  wo.movement_log = db.prepare('SELECT * FROM stage_movement_log WHERE wo_id=? ORDER BY moved_at DESC').all(id);

  // V8: Fabric consumption
  wo.fabric_consumption = db.prepare(`
    SELECT wfc.*, f.name as fabric_name, f.color as fabric_color, f.fabric_type,
      po.po_number, fib.batch_code
    FROM wo_fabric_consumption wfc
    LEFT JOIN fabrics f ON f.id = wfc.fabric_id OR f.code = wfc.fabric_code
    LEFT JOIN purchase_orders po ON po.id = wfc.po_id
    LEFT JOIN fabric_inventory_batches fib ON fib.id = wfc.batch_id
    WHERE wfc.work_order_id = ?
    ORDER BY wfc.created_at
  `).all(id);

  // V8: Accessory consumption
  wo.accessory_consumption = db.prepare(`
    SELECT wac.*, a.name as accessory_name, a.unit as accessory_unit
    FROM wo_accessory_consumption wac
    LEFT JOIN accessories a ON a.id = wac.accessory_id OR a.code = wac.accessory_code
    WHERE wac.work_order_id = ?
  `).all(id);

  // V8: Waste records
  wo.waste_records = db.prepare('SELECT * FROM wo_waste WHERE work_order_id=? ORDER BY recorded_at DESC').all(id);

  // V8: WO invoices bridge
  wo.wo_invoices = db.prepare(`
    SELECT wi.*, i.invoice_number, i.status as invoice_status, i.total as invoice_total
    FROM wo_invoices wi LEFT JOIN invoices i ON i.id = wi.invoice_id
    WHERE wi.work_order_id = ?
    ORDER BY wi.created_at
  `).all(id);

  // V8: Consumption cost summaries
  wo.total_fabric_consumption_cost = db.prepare('SELECT COALESCE(SUM(total_cost),0) as v FROM wo_fabric_consumption WHERE work_order_id=?').get(id).v;
  wo.total_accessory_consumption_cost = db.prepare('SELECT COALESCE(SUM(total_cost),0) as v FROM wo_accessory_consumption WHERE work_order_id=?').get(id).v;
  wo.total_waste_cost = db.prepare('SELECT COALESCE(SUM(waste_cost),0) as v FROM wo_waste WHERE work_order_id=?').get(id).v;

  wo.stage_wip_summary = wo.stages.map(s => ({
    stage_id: s.id,
    stage_name: s.stage_name,
    sort_order: s.sort_order,
    status: s.status,
    quantity_in_stage: s.quantity_in_stage || 0,
    quantity_completed: s.quantity_completed || 0,
    quantity_rejected: s.quantity_rejected || 0,
    started_by_name: s.started_by_name || null,
    completed_by_name: s.completed_by_name || null,
    started_at: s.started_at,
    completed_at: s.completed_at,
  }));

  // V7: Quantity integrity check
  const totalInStages = wo.stages.reduce((sum, s) => sum + (s.quantity_in_stage || 0), 0);
  const totalCompleted = wo.stages.reduce((sum, s) => sum + (s.quantity_completed || 0), 0);
  const totalRejected = wo.stages.reduce((sum, s) => sum + (s.quantity_rejected || 0), 0);
  wo.quantity_integrity = {
    ok: (totalInStages + totalCompleted + totalRejected) === (wo.quantity || 0),
    balanced: (totalInStages + totalCompleted + totalRejected) === (wo.quantity || 0),
    total_ordered: wo.quantity || 0,
    total_in_stages: totalInStages,
    total_completed: totalCompleted,
    total_rejected: totalRejected,
    difference: (wo.quantity || 0) - (totalInStages + totalCompleted + totalRejected),
  };

  return wo;
}

// ═══════════════════════════════════════════════
// GET /api/work-orders — list
// ═══════════════════════════════════════════════
router.get('/', (req, res) => {
  try {
    const { search, status, priority, model_code, date_from, date_to } = req.query;
    let q = `SELECT wo.*, m.model_code, m.model_name,
      (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id AND status='completed') as stages_done,
      (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id) as stages_total
      FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id WHERE 1=1`;
    const p = [];
    if (status) { q += ' AND wo.status=?'; p.push(status); }
    if (priority) { q += ' AND wo.priority=?'; p.push(priority); }
    if (model_code) { q += ' AND m.model_code=?'; p.push(model_code); }
    if (date_from) { q += ' AND wo.created_at >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND wo.created_at <= ?'; p.push(date_to); }
    if (search) { const s = `%${search}%`; q += ' AND (wo.wo_number LIKE ? OR m.model_code LIKE ? OR m.model_name LIKE ? OR wo.assigned_to LIKE ?)'; p.push(s, s, s, s); }
    q += ' ORDER BY wo.created_at DESC';
    const work_orders = db.prepare(q).all(...p);

    const stats = {
      draft: db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='draft'").get().c,
      pending: db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='pending'").get().c,
      in_progress: db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='in_progress'").get().c,
      completed: db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed'").get().c,
      cancelled: db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='cancelled'").get().c,
      urgent: db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE priority='urgent' AND status NOT IN ('completed','cancelled')").get().c,
    };

    res.json({ work_orders, stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/work-orders/next-number
router.get('/next-number', (req, res) => {
  try {
    const year = new Date().getFullYear();
    const last = db.prepare(`SELECT wo_number FROM work_orders WHERE wo_number LIKE ? ORDER BY id DESC LIMIT 1`).get(`WO-${year}-%`);
    if (!last) return res.json({ next_number: `WO-${year}-001` });
    const num = parseInt(last.wo_number.split('-')[2], 10) || 0;
    res.json({ next_number: `WO-${year}-${String(num + 1).padStart(3, '0')}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/work-orders/by-stage
router.get('/by-stage', (req, res) => {
  try {
    const data = db.prepare(`
      SELECT ws.stage_name, ws.status, COUNT(*) as count
      FROM wo_stages ws
      INNER JOIN work_orders wo ON wo.id = ws.wo_id AND wo.status NOT IN ('cancelled')
      GROUP BY ws.stage_name, ws.status
    `).all();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// POST /api/work-orders — create (v4 expanded)
// ═══════════════════════════════════════════════
router.post('/', (req, res) => {
  try {
    const { model_id, template_id, wo_number, priority, due_date, assigned_to,
            masnaiya, masrouf, margin_pct, consumer_price, wholesale_price,
            quantity, is_size_based,
            fabrics, accessories, sizes, stages, notes,
            fabric_batches, accessories_detail, extra_expenses } = req.body;
    if (!wo_number) return res.status(400).json({ error: 'رقم أمر العمل مطلوب' });

    const transaction = db.transaction(() => {
      const r = db.prepare(`INSERT INTO work_orders (wo_number,model_id,template_id,priority,due_date,assigned_to,masnaiya,masrouf,margin_pct,consumer_price,wholesale_price,notes,quantity,is_size_based) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(wo_number, model_id || null, template_id || null, priority || 'normal', due_date || null, assigned_to || null, masnaiya ?? 90, masrouf ?? 50, margin_pct ?? 25, consumer_price || null, wholesale_price || null, notes || null, quantity || 0, is_size_based ? 1 : 0);
      const woId = r.lastInsertRowid;

      // V3 legacy fabrics
      let useFabrics = fabrics || [];
      let useAccessories = accessories || [];
      let useSizes = sizes || [];

      if (template_id && !useFabrics.length && !useAccessories.length && !useSizes.length && !(fabric_batches || []).length) {
        useFabrics = db.prepare('SELECT fabric_code,role,meters_per_piece,waste_pct,color_note,sort_order FROM bom_template_fabrics WHERE template_id=?').all(template_id);
        useAccessories = db.prepare('SELECT accessory_code,accessory_name,quantity,unit_price,notes FROM bom_template_accessories WHERE template_id=?').all(template_id);
        useSizes = db.prepare('SELECT color_label,qty_s,qty_m,qty_l,qty_xl,qty_2xl,qty_3xl FROM bom_template_sizes WHERE template_id=?').all(template_id);
      }

      if (useFabrics.length) {
        const ins = db.prepare('INSERT INTO wo_fabrics (wo_id,fabric_code,role,meters_per_piece,waste_pct,color_note,sort_order) VALUES (?,?,?,?,?,?,?)');
        useFabrics.forEach((f, i) => { if (f.fabric_code) ins.run(woId, f.fabric_code, f.role || 'main', f.meters_per_piece || 1, f.role === 'lining' ? 0 : (f.waste_pct ?? 5), f.color_note || null, f.sort_order ?? i); });
      }
      if (useAccessories.length) {
        const ins = db.prepare('INSERT INTO wo_accessories (wo_id,accessory_code,accessory_name,quantity,unit_price,notes) VALUES (?,?,?,?,?,?)');
        useAccessories.forEach(a => { ins.run(woId, a.accessory_code || null, a.accessory_name || null, a.quantity || 1, a.unit_price || 0, a.notes || null); });
      }
      if (useSizes.length) {
        const ins = db.prepare('INSERT INTO wo_sizes (wo_id,color_label,qty_s,qty_m,qty_l,qty_xl,qty_2xl,qty_3xl) VALUES (?,?,?,?,?,?,?,?)');
        useSizes.forEach(s => { if (s.color_label) ins.run(woId, s.color_label, s.qty_s||0, s.qty_m||0, s.qty_l||0, s.qty_xl||0, s.qty_2xl||0, s.qty_3xl||0); });
      }

      // V4 batch fabrics
      if (fabric_batches?.length) {
        let totalPieces = quantity || 0;
        if (is_size_based && useSizes.length) {
          totalPieces = useSizes.reduce((s, r) => s + (r.qty_s||0) + (r.qty_m||0) + (r.qty_l||0) + (r.qty_xl||0) + (r.qty_2xl||0) + (r.qty_3xl||0), 0);
        }
        const ins = db.prepare(`INSERT INTO wo_fabric_batches (wo_id,batch_id,fabric_code,role,planned_meters_per_piece,planned_total_meters,waste_pct,price_per_meter,planned_cost,color_note,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
        for (const [i, fb] of fabric_batches.entries()) {
          const batch = db.prepare('SELECT * FROM fabric_inventory_batches WHERE id=?').get(fb.batch_id);
          if (!batch) throw new Error(`الدفعة ${fb.batch_id} غير موجودة`);
          const plannedMPP = fb.planned_meters_per_piece || 1;
          const plannedTotal = plannedMPP * (totalPieces || 1);
          const wastePct = fb.waste_pct ?? 5;
          const plannedWithWaste = plannedTotal * (1 + wastePct / 100);
          if (batch.available_meters < plannedWithWaste) {
            throw new Error(`الأمتار المتاحة في الدفعة ${batch.batch_code} غير كافية (متاح: ${batch.available_meters} م، مطلوب: ${plannedWithWaste.toFixed(1)} م)`);
          }
          const pricePerMeter = batch.price_per_meter;
          const plannedCost = plannedTotal * pricePerMeter;
          ins.run(woId, fb.batch_id, fb.fabric_code, fb.role || 'main', plannedMPP, plannedTotal, wastePct, pricePerMeter, plannedCost, fb.color_note || null, fb.sort_order ?? i);
        }
      }

      // V4 detailed accessories
      if (accessories_detail?.length) {
        let totalPieces = quantity || 0;
        if (is_size_based && useSizes.length) {
          totalPieces = useSizes.reduce((s, r) => s + (r.qty_s||0) + (r.qty_m||0) + (r.qty_l||0) + (r.qty_xl||0) + (r.qty_2xl||0) + (r.qty_3xl||0), 0);
        }
        const ins = db.prepare('INSERT INTO wo_accessories_detail (wo_id,accessory_code,accessory_name,quantity_per_piece,unit_price,planned_total_cost,notes) VALUES (?,?,?,?,?,?,?)');
        for (const a of accessories_detail) {
          const totalCost = (a.quantity_per_piece || 1) * (a.unit_price || 0) * totalPieces;
          ins.run(woId, a.accessory_code || null, a.accessory_name || '', a.quantity_per_piece || 1, a.unit_price || 0, totalCost, a.notes || null);
        }
      }

      // V4 extra expenses
      if (extra_expenses?.length) {
        const ins = db.prepare('INSERT INTO wo_extra_expenses (wo_id,description,amount,stage_id,notes) VALUES (?,?,?,?,?)');
        let total = 0;
        for (const e of extra_expenses) {
          ins.run(woId, e.description, e.amount || 0, e.stage_id || null, e.notes || null);
          total += e.amount || 0;
        }
        db.prepare('UPDATE work_orders SET extra_expenses_total=? WHERE id=?').run(total, woId);
      }

      // Stages
      let useStages = stages || [];
      if (!useStages.length) {
        useStages = db.prepare('SELECT name as stage_name, sort_order FROM stage_templates WHERE is_default=1 ORDER BY sort_order').all();
      }
      if (useStages.length) {
        const ins = db.prepare('INSERT INTO wo_stages (wo_id,stage_name,sort_order,assigned_to) VALUES (?,?,?,?)');
        useStages.forEach((s, i) => { ins.run(woId, s.stage_name, s.sort_order ?? i, s.assigned_to || null); });
        // V7: Init first stage quantity_in_stage from WO quantity
        const firstStage = db.prepare('SELECT id FROM wo_stages WHERE wo_id=? ORDER BY sort_order LIMIT 1').get(woId);
        if (firstStage && quantity > 0) {
          db.prepare('UPDATE wo_stages SET quantity_in_stage=? WHERE id=?').run(quantity, firstStage.id);
        }
      }

      return woId;
    });

    const woId = transaction();
    logAudit(req, 'CREATE', 'work_order', woId, wo_number);
    res.status(201).json(getFullWO(woId));
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'رقم أمر الشغل موجود بالفعل' });
    res.status(400).json({ error: err.message });
  }
});

// GET /api/work-orders/:id
router.get('/:id', (req, res) => {
  try {
    if (req.params.id === 'next-number' || req.params.id === 'by-stage') return;
    const wo = getFullWO(parseInt(req.params.id));
    if (!wo) return res.status(404).json({ error: 'غير موجود' });
    res.json(wo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/work-orders/:id/cost-summary
router.get('/:id/cost-summary', (req, res) => {
  try {
    const cost = calculateWOCost(parseInt(req.params.id));
    if (!cost) return res.status(404).json({ error: 'غير موجود' });
    res.json(cost);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/work-orders/:id
router.put('/:id', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    const { model_id, priority, due_date, assigned_to, masnaiya, masrouf, margin_pct,
            consumer_price, wholesale_price, quantity, is_size_based,
            fabrics, accessories, sizes, notes,
            fabric_batches, accessories_detail } = req.body;

    const transaction = db.transaction(() => {
      db.prepare(`UPDATE work_orders SET model_id=COALESCE(?,model_id),priority=COALESCE(?,priority),due_date=?,assigned_to=COALESCE(?,assigned_to),masnaiya=COALESCE(?,masnaiya),masrouf=COALESCE(?,masrouf),margin_pct=COALESCE(?,margin_pct),consumer_price=?,wholesale_price=?,notes=COALESCE(?,notes),quantity=COALESCE(?,quantity),is_size_based=COALESCE(?,is_size_based),updated_at=datetime('now') WHERE id=?`)
        .run(model_id ?? null, priority || null, due_date || null, assigned_to || null, masnaiya ?? null, masrouf ?? null, margin_pct ?? null, consumer_price ?? null, wholesale_price ?? null, notes || null, quantity ?? null, is_size_based ?? null, woId);

      if (fabrics) {
        db.prepare('DELETE FROM wo_fabrics WHERE wo_id=?').run(woId);
        const ins = db.prepare('INSERT INTO wo_fabrics (wo_id,fabric_code,role,meters_per_piece,waste_pct,color_note,sort_order) VALUES (?,?,?,?,?,?,?)');
        fabrics.forEach((f, i) => { if (f.fabric_code) ins.run(woId, f.fabric_code, f.role || 'main', f.meters_per_piece || 1, f.role === 'lining' ? 0 : (f.waste_pct ?? 5), f.color_note || null, f.sort_order ?? i); });
      }
      if (accessories) {
        db.prepare('DELETE FROM wo_accessories WHERE wo_id=?').run(woId);
        const ins = db.prepare('INSERT INTO wo_accessories (wo_id,accessory_code,accessory_name,quantity,unit_price,notes) VALUES (?,?,?,?,?,?)');
        accessories.forEach(a => { ins.run(woId, a.accessory_code || null, a.accessory_name || null, a.quantity || 1, a.unit_price || 0, a.notes || null); });
      }
      if (sizes) {
        db.prepare('DELETE FROM wo_sizes WHERE wo_id=?').run(woId);
        const ins = db.prepare('INSERT INTO wo_sizes (wo_id,color_label,qty_s,qty_m,qty_l,qty_xl,qty_2xl,qty_3xl) VALUES (?,?,?,?,?,?,?,?)');
        sizes.forEach(s => { if (s.color_label) ins.run(woId, s.color_label, s.qty_s||0, s.qty_m||0, s.qty_l||0, s.qty_xl||0, s.qty_2xl||0, s.qty_3xl||0); });
      }
      if (fabric_batches) {
        db.prepare('DELETE FROM wo_fabric_batches WHERE wo_id=?').run(woId);
        let totalPieces = quantity || existing.quantity || 0;
        const szRows = sizes || db.prepare('SELECT * FROM wo_sizes WHERE wo_id=?').all(woId);
        if ((is_size_based ?? existing.is_size_based) && szRows.length) {
          totalPieces = szRows.reduce((s, r) => s + (r.qty_s||0) + (r.qty_m||0) + (r.qty_l||0) + (r.qty_xl||0) + (r.qty_2xl||0) + (r.qty_3xl||0), 0);
        }
        const ins = db.prepare(`INSERT INTO wo_fabric_batches (wo_id,batch_id,fabric_code,role,planned_meters_per_piece,planned_total_meters,waste_pct,price_per_meter,planned_cost,color_note,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
        for (const [i, fb] of fabric_batches.entries()) {
          const batch = db.prepare('SELECT * FROM fabric_inventory_batches WHERE id=?').get(fb.batch_id);
          if (!batch) throw new Error(`الدفعة ${fb.batch_id} غير موجودة`);
          const plannedMPP = fb.planned_meters_per_piece || 1;
          const plannedTotal = plannedMPP * (totalPieces || 1);
          const pricePerMeter = batch.price_per_meter;
          ins.run(woId, fb.batch_id, fb.fabric_code, fb.role || 'main', plannedMPP, plannedTotal, fb.waste_pct ?? 5, pricePerMeter, plannedTotal * pricePerMeter, fb.color_note || null, fb.sort_order ?? i);
        }
      }
      if (accessories_detail) {
        db.prepare('DELETE FROM wo_accessories_detail WHERE wo_id=?').run(woId);
        let totalPieces = quantity || existing.quantity || 0;
        const ins = db.prepare('INSERT INTO wo_accessories_detail (wo_id,accessory_code,accessory_name,quantity_per_piece,unit_price,planned_total_cost,notes) VALUES (?,?,?,?,?,?,?)');
        for (const a of accessories_detail) {
          ins.run(woId, a.accessory_code || null, a.accessory_name || '', a.quantity_per_piece || 1, a.unit_price || 0, (a.quantity_per_piece || 1) * (a.unit_price || 0) * totalPieces, a.notes || null);
        }
      }
    });

    transaction();
    res.json(getFullWO(woId));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/work-orders/:id/status
router.patch('/:id/status', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'الحالة مطلوبة' });
    const updates = [`status=?`, `updated_at=datetime('now')`];
    const params = [status];
    if (status === 'in_progress') updates.push(`start_date=COALESCE(start_date,datetime('now'))`);
    if (status === 'completed') updates.push(`completed_date=datetime('now')`);
    db.prepare(`UPDATE work_orders SET ${updates.join(',')} WHERE id=?`).run(...params, woId);
    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/work-orders/:id/stages/:stageId
router.patch('/:id/stages/:stageId', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const stageId = parseInt(req.params.stageId);
    const { status, assigned_to, quantity_done, quantity_in_stage, quantity_completed, notes } = req.body;

    const stage = db.prepare('SELECT * FROM wo_stages WHERE id=? AND wo_id=?').get(stageId, woId);
    if (!stage) return res.status(404).json({ error: 'المرحلة غير موجودة' });

    const sets = [];
    const params = [];
    if (status) {
      sets.push('status=?'); params.push(status);
      if (status === 'in_progress' && !stage.started_at) sets.push("started_at=datetime('now')");
      if (status === 'completed') sets.push("completed_at=datetime('now')");
    }
    if (assigned_to !== undefined) { sets.push('assigned_to=?'); params.push(assigned_to); }
    if (quantity_done !== undefined) { sets.push('quantity_done=?'); params.push(quantity_done); }
    if (quantity_in_stage !== undefined) { sets.push('quantity_in_stage=?'); params.push(quantity_in_stage); }
    if (quantity_completed !== undefined) { sets.push('quantity_completed=?'); params.push(quantity_completed); }
    if (notes !== undefined) { sets.push('notes=?'); params.push(notes); }

    if (sets.length) {
      db.prepare(`UPDATE wo_stages SET ${sets.join(',')} WHERE id=?`).run(...params, stageId);
    }

    // Recalculate pieces_completed from last stage
    const lastStage = db.prepare('SELECT quantity_completed FROM wo_stages WHERE wo_id=? ORDER BY sort_order DESC LIMIT 1').get(woId);
    if (lastStage) db.prepare('UPDATE work_orders SET pieces_completed=? WHERE id=?').run(lastStage.quantity_completed || 0, woId);

    // Auto-complete if all stages done
    const allStages = db.prepare('SELECT status FROM wo_stages WHERE wo_id=?').all(woId);
    const allDone = allStages.length > 0 && allStages.every(s => s.status === 'completed' || s.status === 'skipped');
    if (allDone) {
      db.prepare("UPDATE work_orders SET status='completed', completed_date=datetime('now'), updated_at=datetime('now') WHERE id=? AND status != 'completed'").run(woId);
    } else if (status === 'in_progress') {
      db.prepare("UPDATE work_orders SET status='in_progress', start_date=COALESCE(start_date,datetime('now')), updated_at=datetime('now') WHERE id=? AND status IN ('draft','pending')").run(woId);
    }

    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/work-orders/:id/stage-quantity — WIP tracking
router.patch('/:id/stage-quantity', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const { stage_id, quantity_in_stage, quantity_completed, assigned_to, notes } = req.body;
    if (!stage_id) return res.status(400).json({ error: 'معرف المرحلة مطلوب' });

    const stage = db.prepare('SELECT * FROM wo_stages WHERE id=? AND wo_id=?').get(stage_id, woId);
    if (!stage) return res.status(404).json({ error: 'المرحلة غير موجودة' });

    const sets = [];
    const params = [];
    if (quantity_in_stage !== undefined) { sets.push('quantity_in_stage=?'); params.push(quantity_in_stage); }
    if (quantity_completed !== undefined) { sets.push('quantity_completed=?'); params.push(quantity_completed); }
    if (assigned_to !== undefined) { sets.push('assigned_to=?'); params.push(assigned_to); }
    if (notes !== undefined) { sets.push('notes=?'); params.push(notes); }

    if (sets.length) db.prepare(`UPDATE wo_stages SET ${sets.join(',')} WHERE id=?`).run(...params, stage_id);

    const lastStage = db.prepare('SELECT quantity_completed FROM wo_stages WHERE wo_id=? ORDER BY sort_order DESC LIMIT 1').get(woId);
    if (lastStage) db.prepare('UPDATE work_orders SET pieces_completed=? WHERE id=?').run(lastStage.quantity_completed || 0, woId);

    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/work-orders/:id/actual-fabric — record actual usage
router.patch('/:id/actual-fabric', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const { batch_id, actual_meters_per_piece, actual_total_meters, waste_meters } = req.body;
    if (!batch_id) return res.status(400).json({ error: 'معرف الدفعة مطلوب' });

    const wfb = db.prepare('SELECT * FROM wo_fabric_batches WHERE wo_id=? AND batch_id=?').get(woId, batch_id);
    if (!wfb) return res.status(404).json({ error: 'دفعة القماش غير موجودة في أمر العمل' });

    const transaction = db.transaction(() => {
      const actualMeters = actual_total_meters ?? wfb.actual_total_meters ?? wfb.planned_total_meters;
      const wasteM = waste_meters ?? wfb.waste_meters ?? 0;
      const wasteCost = wasteM * wfb.price_per_meter;
      const actualCost = actualMeters * wfb.price_per_meter;

      // Reverse previous actual usage from batch, then add new
      const prevActual = wfb.actual_total_meters || 0;
      const prevWaste = wfb.waste_meters || 0;

      db.prepare(`UPDATE wo_fabric_batches SET actual_meters_per_piece=?,actual_total_meters=?,waste_meters=?,waste_cost=?,actual_cost=? WHERE id=?`)
        .run(actual_meters_per_piece || null, actualMeters, wasteM, wasteCost, actualCost, wfb.id);

      db.prepare(`UPDATE fabric_inventory_batches SET used_meters=used_meters-?+?, wasted_meters=wasted_meters-?+? WHERE id=?`)
        .run(prevActual, actualMeters, prevWaste, wasteM, batch_id);

      // Update waste total
      const totalWaste = db.prepare('SELECT COALESCE(SUM(waste_cost),0) as v FROM wo_fabric_batches WHERE wo_id=?').get(woId).v;
      db.prepare('UPDATE work_orders SET waste_cost_total=? WHERE id=?').run(totalWaste, woId);

      // Check if batch depleted
      const inv = db.prepare('SELECT available_meters FROM fabric_inventory_batches WHERE id=?').get(batch_id);
      if (inv && inv.available_meters <= 0) {
        db.prepare("UPDATE fabric_inventory_batches SET batch_status='depleted' WHERE id=?").run(batch_id);
      } else {
        db.prepare("UPDATE fabric_inventory_batches SET batch_status='available' WHERE id=?").run(batch_id);
      }
    });

    transaction();
    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work-orders/:id/expenses
router.post('/:id/expenses', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const { description, amount, stage_id, notes } = req.body;
    if (!description || !amount) return res.status(400).json({ error: 'الوصف والمبلغ مطلوبان' });

    db.prepare('INSERT INTO wo_extra_expenses (wo_id,description,amount,stage_id,notes) VALUES (?,?,?,?,?)')
      .run(woId, description, parseFloat(amount), stage_id || null, notes || null);
    const total = db.prepare('SELECT COALESCE(SUM(amount),0) as v FROM wo_extra_expenses WHERE wo_id=?').get(woId).v;
    db.prepare('UPDATE work_orders SET extra_expenses_total=? WHERE id=?').run(total, woId);

    res.status(201).json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/work-orders/:id/expenses/:expId
router.delete('/:id/expenses/:expId', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    db.prepare('DELETE FROM wo_extra_expenses WHERE id=? AND wo_id=?').run(parseInt(req.params.expId), woId);
    const total = db.prepare('SELECT COALESCE(SUM(amount),0) as v FROM wo_extra_expenses WHERE wo_id=?').get(woId).v;
    db.prepare('UPDATE work_orders SET extra_expenses_total=? WHERE id=?').run(total, woId);
    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work-orders/:id/finalize — close production with real cost calculation
router.post('/:id/finalize', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
    if (!wo) return res.status(404).json({ error: 'أمر العمل غير موجود' });
    const { pieces_produced, extra_notes } = req.body;
    const userId = req.user?.id || null;

    let warning = null;

    const transaction = db.transaction(() => {
      // Finalize batch statuses
      const batchFabrics = db.prepare('SELECT * FROM wo_fabric_batches WHERE wo_id=?').all(woId);
      for (const bf of batchFabrics) {
        const inv = db.prepare('SELECT available_meters FROM fabric_inventory_batches WHERE id=?').get(bf.batch_id);
        if (inv && inv.available_meters <= 0) {
          db.prepare("UPDATE fabric_inventory_batches SET batch_status='depleted' WHERE id=?").run(bf.batch_id);
        }
      }

      // V8: Calculate real cost from consumption tables
      const fabricCost = db.prepare('SELECT COALESCE(SUM(total_cost),0) as v FROM wo_fabric_consumption WHERE work_order_id=?').get(woId).v;
      const accessoryCost = db.prepare('SELECT COALESCE(SUM(total_cost),0) as v FROM wo_accessory_consumption WHERE work_order_id=?').get(woId).v;
      const wasteFromWoWaste = db.prepare('SELECT COALESCE(SUM(waste_cost),0) as v FROM wo_waste WHERE work_order_id=?').get(woId).v;
      const wasteFromBatches = db.prepare('SELECT COALESCE(SUM(waste_cost),0) as v FROM wo_fabric_batches WHERE wo_id=? AND waste_cost > 0').get(woId).v;
      const wasteCost = wasteFromWoWaste + wasteFromBatches;

      // Fall back to calculated cost if no consumption recorded
      const cost = calculateWOCost(woId);
      const useFabricCost = fabricCost > 0 ? fabricCost : (cost.main_fabric_cost + cost.lining_cost);
      const useAccessoryCost = accessoryCost > 0 ? accessoryCost : cost.accessories_cost;

      if (fabricCost === 0) warning = 'لم يتم تسجيل استهلاك القماش — التكلفة غير دقيقة';

      const masnaiyaTotal = cost.masnaiya_total;
      const masroufTotal = cost.masrouf_total;
      const totalCost = useFabricCost + useAccessoryCost + wasteCost + masnaiyaTotal + masroufTotal + cost.extra_expenses;
      const qty = pieces_produced || wo.pieces_completed || wo.quantity || 0;
      const costPerPiece = qty > 0 ? totalCost / qty : 0;
      const wasteCostPerPiece = qty > 0 ? wasteCost / qty : 0;

      const round2 = v => Math.round((v || 0) * 100) / 100;

      db.prepare(`UPDATE work_orders SET 
        status='completed', completed_date=datetime('now','localtime'),
        actual_cost_per_piece=?, pieces_completed=COALESCE(?,pieces_completed),
        total_production_cost=?, cost_per_piece=?, waste_cost_per_piece=?,
        completed_by_user_id=?, updated_at=datetime('now','localtime')
        WHERE id=?`)
        .run(round2(costPerPiece), pieces_produced || null, round2(totalCost), round2(costPerPiece), round2(wasteCostPerPiece), userId, woId);

      db.prepare(`INSERT INTO cost_snapshots (wo_id,model_id,total_pieces,total_meters_main,total_meters_lining,main_fabric_cost,lining_cost,accessories_cost,masnaiya,masrouf,waste_cost,extra_expenses,total_cost,cost_per_piece) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(woId, wo.model_id, qty, cost.total_meters_main, cost.total_meters_lining, round2(useFabricCost), 0, round2(useAccessoryCost), round2(masnaiyaTotal), round2(masroufTotal), round2(wasteCost), round2(cost.extra_expenses), round2(totalCost), round2(costPerPiece));

      if (extra_notes) {
        db.prepare("UPDATE work_orders SET notes=COALESCE(notes||'\n'||?,?) WHERE id=?").run(extra_notes, extra_notes, woId);
      }
    });

    transaction();
    logAudit(req, 'WO_FINALIZED', 'work_order', woId, 'اكتمل الإنتاج');
    const result = getFullWO(woId);
    if (warning) result.warning = warning;
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work-orders/:id/partial-invoice
router.post('/:id/partial-invoice', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
    if (!wo) return res.status(404).json({ error: 'غير موجود' });
    const { pieces_invoiced, cost_per_piece, invoice_price_per_piece, notes } = req.body;
    if (!pieces_invoiced || pieces_invoiced <= 0) return res.status(400).json({ error: 'عدد القطع المفوترة مطلوب' });

    const alreadyInvoiced = db.prepare('SELECT COALESCE(SUM(pieces_invoiced),0) as v FROM partial_invoices WHERE wo_id=?').get(woId).v;
    const totalPieces = wo.pieces_completed || wo.quantity || 0;
    if (alreadyInvoiced + pieces_invoiced > totalPieces) {
      return res.status(400).json({ error: `لا يمكن فوترة أكثر من القطع المكتملة (متاح: ${totalPieces - alreadyInvoiced} قطعة)` });
    }

    const cost = calculateWOCost(woId);
    db.prepare('INSERT INTO partial_invoices (wo_id,pieces_invoiced,cost_per_piece,invoice_price_per_piece,notes) VALUES (?,?,?,?,?)')
      .run(woId, pieces_invoiced, cost_per_piece ?? cost.cost_per_piece, invoice_price_per_piece ?? cost.suggested_consumer_price, notes || null);

    res.status(201).json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work-orders/:id/cost-snapshot
router.post('/:id/cost-snapshot', (req, res) => {
  try {
    const wo = getFullWO(parseInt(req.params.id));
    if (!wo) return res.status(404).json({ error: 'غير موجود' });
    const c = wo.cost_summary;
    const r = db.prepare(`INSERT INTO cost_snapshots (wo_id,model_id,total_pieces,total_meters_main,total_meters_lining,main_fabric_cost,lining_cost,accessories_cost,masnaiya,masrouf,waste_cost,extra_expenses,total_cost,cost_per_piece) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(wo.id, wo.model_id, c.total_pieces, c.total_meters_main, c.total_meters_lining, c.main_fabric_cost, c.lining_cost, c.accessories_cost, c.masnaiya_total, c.masrouf_total, c.waste_cost, c.extra_expenses, c.total_cost, c.cost_per_piece);
    res.status(201).json(db.prepare('SELECT * FROM cost_snapshots WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/work-orders/:id — soft delete
router.delete('/:id', (req, res) => {
  try {
    db.prepare("UPDATE work_orders SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(parseInt(req.params.id));
    logAudit(req, 'DELETE', 'work_order', req.params.id, `WO#${req.params.id}`);
    res.json({ message: 'تم الإلغاء' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// V7 — Stage Advance (move pieces between stages)
// ═══════════════════════════════════════════════
router.patch('/:id/stage-advance', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const { from_stage_id, qty_to_pass, qty_rejected, rejection_reason, notes } = req.body;

    if (!from_stage_id || !qty_to_pass) return res.status(400).json({ error: 'from_stage_id و qty_to_pass مطلوبان' });
    const qPass = parseInt(qty_to_pass) || 0;
    const qReject = parseInt(qty_rejected) || 0;
    if (qPass < 0 || qReject < 0) return res.status(400).json({ error: 'الكميات يجب أن تكون موجبة' });

    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
    if (!wo) return res.status(404).json({ error: 'أمر الشغل غير موجود' });
    if (wo.status !== 'in_progress') return res.status(400).json({ error: 'أمر الشغل ليس قيد التنفيذ' });

    const fromStage = db.prepare('SELECT * FROM wo_stages WHERE id=? AND wo_id=?').get(from_stage_id, woId);
    if (!fromStage) return res.status(404).json({ error: 'المرحلة غير موجودة' });

    const available = (fromStage.quantity_in_stage || 0);
    if (qPass + qReject > available) {
      return res.status(400).json({ error: `الكمية المتاحة في المرحلة ${available} فقط — لا يمكن تمرير ${qPass} ورفض ${qReject}` });
    }

    // Find next stage
    const nextStage = db.prepare('SELECT * FROM wo_stages WHERE wo_id=? AND sort_order > ? ORDER BY sort_order LIMIT 1').get(woId, fromStage.sort_order);

    // Get user info
    const userId = req.user?.id || null;
    const userName = req.user?.full_name || req.user?.username || 'نظام';

    const doAdvance = db.transaction(() => {
      // Deduct from current stage
      db.prepare('UPDATE wo_stages SET quantity_in_stage = quantity_in_stage - ?, quantity_completed = quantity_completed + ?, quantity_rejected = COALESCE(quantity_rejected,0) + ? WHERE id=?')
        .run(qPass + qReject, qPass, qReject, from_stage_id);

      // Mark from stage completed if fully processed
      const updatedFrom = db.prepare('SELECT * FROM wo_stages WHERE id=?').get(from_stage_id);
      if ((updatedFrom.quantity_in_stage || 0) === 0 && (updatedFrom.quantity_completed || 0) > 0) {
        db.prepare("UPDATE wo_stages SET status='completed', completed_at=datetime('now','localtime'), completed_by_user_id=?, completed_by_name=? WHERE id=? AND status != 'completed'")
          .run(userId, userName, from_stage_id);
      }

      // Add to next stage (if exists)
      let toStageId = null;
      let toStageName = null;
      if (nextStage && qPass > 0) {
        toStageId = nextStage.id;
        toStageName = nextStage.stage_name;
        db.prepare('UPDATE wo_stages SET quantity_in_stage = COALESCE(quantity_in_stage,0) + ? WHERE id=?').run(qPass, nextStage.id);
        // Auto-start next stage
        if (nextStage.status === 'pending') {
          db.prepare("UPDATE wo_stages SET status='in_progress', started_at=datetime('now','localtime'), started_by_user_id=?, started_by_name=? WHERE id=?")
            .run(userId, userName, nextStage.id);
        }
      }

      // Log movement
      db.prepare(`INSERT INTO stage_movement_log (wo_id, from_stage_id, to_stage_id, from_stage_name, to_stage_name, qty_moved, qty_rejected, rejection_reason, moved_by_user_id, moved_by_name, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(woId, from_stage_id, toStageId, fromStage.stage_name, toStageName, qPass, qReject, rejection_reason || null, userId, userName, notes || null);

      // Update pieces_completed from last stage
      const lastStage = db.prepare('SELECT quantity_completed FROM wo_stages WHERE wo_id=? ORDER BY sort_order DESC LIMIT 1').get(woId);
      if (lastStage) db.prepare('UPDATE work_orders SET pieces_completed=? WHERE id=?').run(lastStage.quantity_completed || 0, woId);

      // Auto-complete WO if all stages done
      const allStages = db.prepare('SELECT status, quantity_in_stage FROM wo_stages WHERE wo_id=?').all(woId);
      const allDone = allStages.length > 0 && allStages.every(s => (s.status === 'completed' || s.status === 'skipped') && (s.quantity_in_stage || 0) === 0);
      if (allDone) {
        db.prepare("UPDATE work_orders SET status='completed', completed_date=datetime('now','localtime'), updated_at=datetime('now','localtime') WHERE id=? AND status != 'completed'").run(woId);
      }
    });

    doAdvance();
    logAudit(req, 'STAGE_ADVANCE', 'work_order', woId, `${fromStage.stage_name}: ${qPass} passed, ${qReject} rejected`);
    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// V7 — Stage Start (explicitly start a stage)
// ═══════════════════════════════════════════════
router.patch('/:id/stage-start', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const { stage_id } = req.body;
    if (!stage_id) return res.status(400).json({ error: 'stage_id مطلوب' });

    const stage = db.prepare('SELECT * FROM wo_stages WHERE id=? AND wo_id=?').get(stage_id, woId);
    if (!stage) return res.status(404).json({ error: 'المرحلة غير موجودة' });
    if (stage.status !== 'pending') return res.status(400).json({ error: 'المرحلة ليست معلقة' });

    const userId = req.user?.id || null;
    const userName = req.user?.full_name || req.user?.username || 'نظام';

    db.prepare("UPDATE wo_stages SET status='in_progress', started_at=datetime('now','localtime'), started_by_user_id=?, started_by_name=? WHERE id=?")
      .run(userId, userName, stage_id);

    // Also update WO status
    db.prepare("UPDATE work_orders SET status='in_progress', start_date=COALESCE(start_date,datetime('now','localtime')), updated_at=datetime('now','localtime') WHERE id=? AND status IN ('draft','pending')").run(woId);

    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// V7 — Movement Log
// ═══════════════════════════════════════════════
router.get('/:id/movement-log', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const logs = db.prepare('SELECT * FROM stage_movement_log WHERE wo_id=? ORDER BY moved_at DESC').all(woId);
    res.json(logs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// V8 — Fabric Consumption Tracking
// ═══════════════════════════════════════════════

// GET /api/work-orders/:id/fabric-consumption
router.get('/:id/fabric-consumption', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
    if (!wo) return res.status(404).json({ error: 'أمر العمل غير موجود' });

    const consumption = db.prepare(`
      SELECT wfc.*, f.name as fabric_name, f.color as fabric_color, f.fabric_type,
        po.po_number, fib.batch_code, fib.available_meters as batch_available
      FROM wo_fabric_consumption wfc
      LEFT JOIN fabrics f ON f.id = wfc.fabric_id OR f.code = wfc.fabric_code
      LEFT JOIN purchase_orders po ON po.id = wfc.po_id
      LEFT JOIN fabric_inventory_batches fib ON fib.id = wfc.batch_id
      WHERE wfc.work_order_id = ?
      ORDER BY wfc.created_at
    `).all(woId);

    // Available PO batches for each fabric in the WO
    const woFabricCodes = db.prepare(`
      SELECT DISTINCT fabric_code FROM wo_fabrics WHERE wo_id = ?
      UNION SELECT DISTINCT fabric_code FROM wo_fabric_batches WHERE wo_id = ?
    `).all(woId, woId).map(r => r.fabric_code).filter(Boolean);

    const available_batches = {};
    for (const code of woFabricCodes) {
      available_batches[code] = db.prepare(`
        SELECT fib.id as batch_id, fib.batch_code, fib.po_id, fib.price_per_meter,
          fib.available_meters, fib.received_meters, fib.received_date,
          po.po_number, s.name as supplier_name
        FROM fabric_inventory_batches fib
        LEFT JOIN purchase_orders po ON po.id = fib.po_id
        LEFT JOIN suppliers s ON s.id = fib.supplier_id
        WHERE fib.fabric_code = ? AND fib.batch_status = 'available' AND fib.available_meters > 0
        ORDER BY fib.received_date
      `).all(code);
    }

    res.json({ consumption, available_batches });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work-orders/:id/fabric-consumption
router.post('/:id/fabric-consumption', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
    if (!wo) return res.status(404).json({ error: 'أمر العمل غير موجود' });
    const { fabric_id, fabric_code, po_id, po_line_id, batch_id, planned_meters, actual_meters, price_per_meter, notes } = req.body;
    if (!fabric_id && !fabric_code) return res.status(400).json({ error: 'يجب تحديد القماش' });
    if (!actual_meters || actual_meters <= 0) return res.status(400).json({ error: 'يجب تحديد الكمية المستهلكة' });

    // Get price from batch if not provided
    let price = parseFloat(price_per_meter) || 0;
    if (!price && batch_id) {
      const batch = db.prepare('SELECT price_per_meter FROM fabric_inventory_batches WHERE id=?').get(batch_id);
      if (batch) price = batch.price_per_meter;
    }

    const totalCost = (parseFloat(actual_meters) || 0) * price;
    const userId = req.user?.id || null;

    const transaction = db.transaction(() => {
      db.prepare(`INSERT INTO wo_fabric_consumption (work_order_id, fabric_id, fabric_code, po_id, po_line_id, batch_id, planned_meters, actual_meters, price_per_meter, total_cost, notes, recorded_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(woId, fabric_id || 0, fabric_code || null, po_id || null, po_line_id || null, batch_id || null, planned_meters || 0, actual_meters, price, totalCost, notes || null, userId);

      // Update batch used_meters if batch linked
      if (batch_id) {
        db.prepare('UPDATE fabric_inventory_batches SET used_meters = used_meters + ? WHERE id=?').run(parseFloat(actual_meters), batch_id);
        const inv = db.prepare('SELECT available_meters FROM fabric_inventory_batches WHERE id=?').get(batch_id);
        if (inv && inv.available_meters <= 0) {
          db.prepare("UPDATE fabric_inventory_batches SET batch_status='depleted' WHERE id=?").run(batch_id);
        }
      }
    });
    transaction();

    logAudit(req, 'FABRIC_CONSUMPTION', 'work_order', woId, `${actual_meters}م من ${fabric_code || fabric_id}`);
    res.status(201).json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/work-orders/:id/fabric-consumption/:consumptionId
router.patch('/:id/fabric-consumption/:consumptionId', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const cId = parseInt(req.params.consumptionId);
    const record = db.prepare('SELECT * FROM wo_fabric_consumption WHERE id=? AND work_order_id=?').get(cId, woId);
    if (!record) return res.status(404).json({ error: 'سجل الاستهلاك غير موجود' });

    const { actual_meters, price_per_meter, notes } = req.body;
    const newMeters = actual_meters !== undefined ? parseFloat(actual_meters) : record.actual_meters;
    const newPrice = price_per_meter !== undefined ? parseFloat(price_per_meter) : record.price_per_meter;
    const newCost = (newMeters || 0) * (newPrice || 0);

    const transaction = db.transaction(() => {
      db.prepare('UPDATE wo_fabric_consumption SET actual_meters=?, price_per_meter=?, total_cost=?, notes=COALESCE(?,notes) WHERE id=?')
        .run(newMeters, newPrice, newCost, notes, cId);

      // Update batch used_meters delta
      if (record.batch_id && actual_meters !== undefined) {
        const delta = newMeters - (record.actual_meters || 0);
        db.prepare('UPDATE fabric_inventory_batches SET used_meters = used_meters + ? WHERE id=?').run(delta, record.batch_id);
        const inv = db.prepare('SELECT available_meters FROM fabric_inventory_batches WHERE id=?').get(record.batch_id);
        if (inv && inv.available_meters <= 0) {
          db.prepare("UPDATE fabric_inventory_batches SET batch_status='depleted' WHERE id=?").run(record.batch_id);
        } else if (inv) {
          db.prepare("UPDATE fabric_inventory_batches SET batch_status='available' WHERE id=?").run(record.batch_id);
        }
      }
    });
    transaction();

    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/work-orders/:id/fabric-consumption/:consumptionId
router.delete('/:id/fabric-consumption/:consumptionId', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const cId = parseInt(req.params.consumptionId);
    const record = db.prepare('SELECT * FROM wo_fabric_consumption WHERE id=? AND work_order_id=?').get(cId, woId);
    if (!record) return res.status(404).json({ error: 'سجل الاستهلاك غير موجود' });

    const transaction = db.transaction(() => {
      if (record.batch_id && record.actual_meters) {
        db.prepare('UPDATE fabric_inventory_batches SET used_meters = MAX(0, used_meters - ?) WHERE id=?').run(record.actual_meters, record.batch_id);
        db.prepare("UPDATE fabric_inventory_batches SET batch_status='available' WHERE id=? AND batch_status='depleted'").run(record.batch_id);
      }
      db.prepare('DELETE FROM wo_fabric_consumption WHERE id=?').run(cId);
    });
    transaction();

    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// V8 — Waste Tracking
// ═══════════════════════════════════════════════

// GET /api/work-orders/:id/waste
router.get('/:id/waste', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const waste = db.prepare('SELECT * FROM wo_waste WHERE work_order_id=? ORDER BY recorded_at DESC').all(woId);
    res.json(waste);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work-orders/:id/waste
router.post('/:id/waste', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
    if (!wo) return res.status(404).json({ error: 'أمر العمل غير موجود' });
    const { waste_meters, price_per_meter, notes } = req.body;
    if (!waste_meters || waste_meters <= 0) return res.status(400).json({ error: 'يجب تحديد كمية الهدر' });

    const price = parseFloat(price_per_meter) || 0;
    const wasteCost = parseFloat(waste_meters) * price;
    const userId = req.user?.id || null;

    db.prepare(`INSERT INTO wo_waste (work_order_id, waste_meters, price_per_meter, waste_cost, notes, recorded_by_user_id) VALUES (?,?,?,?,?,?)`)
      .run(woId, parseFloat(waste_meters), price, wasteCost, notes || null, userId);

    // Update waste_cost_per_piece on WO
    const totalWaste = db.prepare('SELECT COALESCE(SUM(waste_cost),0) as v FROM wo_waste WHERE work_order_id=?').get(woId).v;
    const piecesCompleted = wo.pieces_completed || wo.quantity || 1;
    db.prepare('UPDATE work_orders SET waste_cost_total=?, waste_cost_per_piece=? WHERE id=?')
      .run(totalWaste, totalWaste / piecesCompleted, woId);

    logAudit(req, 'WASTE_RECORDED', 'work_order', woId, `${waste_meters}م × ${price} = ${wasteCost} ج`);
    res.status(201).json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// V8 — Partial Invoice from Work Order (creates real invoice)
// ═══════════════════════════════════════════════
router.post('/:id/create-invoice', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const wo = db.prepare('SELECT wo.*, m.model_code, m.model_name FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id WHERE wo.id=?').get(woId);
    if (!wo) return res.status(404).json({ error: 'أمر العمل غير موجود' });
    const { qty_to_invoice, unit_price, customer_name, notes } = req.body;
    if (!qty_to_invoice || qty_to_invoice <= 0) return res.status(400).json({ error: 'يجب تحديد عدد القطع' });

    const invoiced = wo.total_invoiced_qty || 0;
    const completed = wo.pieces_completed || 0;
    const available = completed - invoiced;
    if (qty_to_invoice > available) {
      return res.status(400).json({ error: `لا توجد قطع كافية للفوترة (متاح: ${available} قطعة)` });
    }

    const price = parseFloat(unit_price) || 0;
    const total = qty_to_invoice * price;

    const transaction = db.transaction(() => {
      // Generate invoice number
      const year = new Date().getFullYear();
      const last = db.prepare("SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1").get(`INV-${year}-%`);
      let nextNum = 1;
      if (last) nextNum = (parseInt(last.invoice_number.split('-')[2], 10) || 0) + 1;
      const invoiceNumber = `INV-${year}-${String(nextNum).padStart(3, '0')}`;

      // Create invoice
      const inv = db.prepare(`INSERT INTO invoices (invoice_number, customer_name, wo_id, status, subtotal, total, notes) VALUES (?,?,?,'draft',?,?,?)`)
        .run(invoiceNumber, customer_name || '', woId, total, total, notes || `فاتورة جزئية من أمر العمل ${wo.wo_number}`);
      const invoiceId = inv.lastInsertRowid;

      // Create invoice line
      db.prepare(`INSERT INTO invoice_items (invoice_id, description, model_code, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,1)`)
        .run(invoiceId, `${wo.model_name || wo.model_code || ''} — ${wo.wo_number}`, wo.model_code || '', qty_to_invoice, price, total);

      // Create WO-Invoice bridge
      db.prepare('INSERT INTO wo_invoices (work_order_id, invoice_id, qty_invoiced, unit_price) VALUES (?,?,?,?)')
        .run(woId, invoiceId, qty_to_invoice, price);

      // Update WO total_invoiced_qty
      db.prepare('UPDATE work_orders SET total_invoiced_qty = COALESCE(total_invoiced_qty,0) + ? WHERE id=?').run(qty_to_invoice, woId);

      return { invoice_id: invoiceId, invoice_number: invoiceNumber, qty_invoiced: qty_to_invoice };
    });

    const result = transaction();
    logAudit(req, 'INVOICE_FROM_WO', 'work_order', woId, `فاتورة ${result.invoice_number} — ${qty_to_invoice} قطعة`);
    res.status(201).json({ ...result, wo: getFullWO(woId) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/work-orders/:id/cancel — cancel a WO
router.post('/:id/cancel', (req, res) => {
  try {
    const woId = parseInt(req.params.id);
    const wo = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
    if (!wo) return res.status(404).json({ error: 'أمر التشغيل غير موجود' });

    // Cannot cancel already completed/cancelled/delivered WOs
    const forbidden = ['completed', 'cancelled', 'delivered'];
    if (forbidden.includes(wo.status)) {
      return res.status(400).json({ error: 'لا يمكن إلغاء أمر تشغيل في حالة: ' + wo.status });
    }

    // Check for invoices
    const invoiceCount = db.prepare('SELECT COUNT(*) as c FROM wo_invoices WHERE work_order_id=?').get(woId).c;
    if (invoiceCount > 0) {
      return res.status(400).json({ error: 'لا يمكن إلغاء أمر تشغيل له فواتير مرتبطة' });
    }

    const { cancel_reason } = req.body;
    if (!cancel_reason || !cancel_reason.trim()) {
      return res.status(400).json({ error: 'سبب الإلغاء مطلوب' });
    }

    const userId = req.user ? req.user.id : null;

    db.transaction(() => {
      db.prepare(`UPDATE work_orders SET status='cancelled', cancel_reason=?, cancelled_by=?, cancelled_at=datetime('now','localtime') WHERE id=?`)
        .run(cancel_reason.trim(), userId, woId);

      // Return allocated fabric batches
      const wfBatches = db.prepare('SELECT * FROM wo_fabric_batches WHERE wo_id=?').all(woId);
      for (const wfb of wfBatches) {
        const meters = wfb.actual_total_meters || wfb.planned_total_meters || 0;
        if (meters > 0) {
          db.prepare('UPDATE fabric_inventory_batches SET used_meters = MAX(0, used_meters - ?), batch_status = CASE WHEN used_meters - ? <= 0 THEN ? ELSE batch_status END WHERE id=?')
            .run(meters, meters, 'available', wfb.batch_id);
          // Update fabric available_meters
          const batch = db.prepare('SELECT fabric_code FROM fabric_inventory_batches WHERE id=?').get(wfb.batch_id);
          if (batch) {
            db.prepare('UPDATE fabrics SET available_meters = COALESCE(available_meters,0) + ? WHERE code=?')
              .run(meters, batch.fabric_code);
            const fabric = db.prepare('SELECT id, available_meters FROM fabrics WHERE code=?').get(batch.fabric_code);
            if (fabric) {
              db.prepare(`INSERT INTO fabric_stock_movements (fabric_code, movement_type, qty_meters, reference_type, reference_id, notes, created_by) VALUES (?,?,?,?,?,?,?)`)
                .run(batch.fabric_code, 'return', meters, 'work_order', woId, 'إرجاع قماش - إلغاء أمر تشغيل ' + wo.wo_number, userId);
            }
          }
        }
      }

      // Return allocated accessories
      const accDetails = db.prepare('SELECT * FROM wo_accessories_detail WHERE wo_id=?').all(woId);
      for (const ad of accDetails) {
        if (ad.total_qty > 0) {
          const acc = db.prepare('SELECT id, quantity_on_hand FROM accessories WHERE code=?').get(ad.accessory_code);
          if (acc) {
            const newQty = (acc.quantity_on_hand || 0) + ad.total_qty;
            db.prepare('UPDATE accessories SET quantity_on_hand=? WHERE id=?').run(newQty, acc.id);
            db.prepare(`INSERT INTO accessory_stock_movements (accessory_code, movement_type, qty, reference_type, reference_id, notes, created_by) VALUES (?,?,?,?,?,?,?)`)
              .run(ad.accessory_code, 'return', ad.total_qty, 'work_order', woId, 'إرجاع إكسسوار - إلغاء أمر تشغيل ' + wo.wo_number, userId);
          }
        }
      }
    })();

    logAudit(req, 'CANCEL', 'work_order', woId, wo.wo_number + ' — ' + cancel_reason.trim());
    res.json(getFullWO(woId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
