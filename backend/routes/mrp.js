const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');

// ═══════════════════════════════════════════════
// POST /api/mrp/calculate — Run MRP calculation
// ═══════════════════════════════════════════════
router.post('/calculate', requirePermission('mrp', 'create'), (req, res) => {
  try {
    const { notes, wo_status_filter } = req.body;
    const statusFilter = wo_status_filter || 'in_progress';

    // Get active work orders
    const workOrders = db.prepare(`
      SELECT id, wo_number, quantity, is_size_based FROM work_orders 
      WHERE status IN ('pending', ?)
    `).all(statusFilter);

    if (!workOrders.length) return res.status(400).json({ error: 'لا توجد أوامر عمل نشطة' });

    // Create MRP run
    const run = db.prepare(`INSERT INTO mrp_runs (notes, created_by) VALUES (?, ?)`)
      .run(notes || null, req.user?.id || null);
    const runId = run.lastInsertRowid;

    // Batch-load all sizes, fabrics, fabric batches, accessories for active WOs
    const woIds = workOrders.map(w => w.id);
    const woIdPlaceholders = woIds.map(() => '?').join(',');

    const allSizes = db.prepare(`SELECT * FROM wo_sizes WHERE wo_id IN (${woIdPlaceholders})`).all(...woIds);
    const sizesMap = {};
    for (const s of allSizes) { (sizesMap[s.wo_id] ||= []).push(s); }

    const allWoFabrics = db.prepare(`SELECT * FROM wo_fabrics WHERE wo_id IN (${woIdPlaceholders})`).all(...woIds);
    const woFabricsMap = {};
    for (const f of allWoFabrics) { (woFabricsMap[f.wo_id] ||= []).push(f); }

    const allWoBatches = db.prepare(`SELECT * FROM wo_fabric_batches WHERE wo_id IN (${woIdPlaceholders})`).all(...woIds);
    const woBatchesMap = {};
    for (const b of allWoBatches) { (woBatchesMap[b.wo_id] ||= []).push(b); }

    const allWoAcc = db.prepare(`SELECT * FROM wo_accessories_detail WHERE wo_id IN (${woIdPlaceholders})`).all(...woIds);
    const woAccMap = {};
    for (const a of allWoAcc) { (woAccMap[a.wo_id] ||= []).push(a); }

    const fabricNeeds = {};
    const accessoryNeeds = {};

    for (const wo of workOrders) {
      let totalPieces = wo.quantity || 0;
      if (wo.is_size_based) {
        const sz = sizesMap[wo.id] || [];
        if (sz.length) totalPieces = sz.reduce((s, r) => s + (r.qty_s||0) + (r.qty_m||0) + (r.qty_l||0) + (r.qty_xl||0) + (r.qty_2xl||0) + (r.qty_3xl||0), 0);
      }

      // Fabric requirements from wo_fabrics (V3 legacy)
      const woFabrics = woFabricsMap[wo.id] || [];
      for (const wf of woFabrics) {
        const key = wf.fabric_code || `id_${wf.fabric_id}`;
        if (!fabricNeeds[key]) fabricNeeds[key] = { id: wf.fabric_id, code: wf.fabric_code, required: 0, woIds: [] };
        fabricNeeds[key].required += (wf.meters_per_piece || 0) * totalPieces;
        fabricNeeds[key].woIds.push(wo.id);
      }

      // Fabric requirements from wo_fabric_batches (V4 batch-based)
      if (!woFabrics.length) {
        const woBatches = woBatchesMap[wo.id] || [];
        for (const bf of woBatches) {
          const key = bf.fabric_code;
          if (!fabricNeeds[key]) fabricNeeds[key] = { id: 0, code: bf.fabric_code, required: 0, woIds: [] };
          fabricNeeds[key].required += bf.planned_total_meters || ((bf.planned_meters_per_piece || 0) * totalPieces);
          if (!fabricNeeds[key].woIds.includes(wo.id)) fabricNeeds[key].woIds.push(wo.id);
        }
      }

      // Accessory requirements
      const woAcc = woAccMap[wo.id] || [];
      for (const wa of woAcc) {
        const key = wa.accessory_code || `id_${wa.accessory_id}`;
        if (!accessoryNeeds[key]) accessoryNeeds[key] = { id: wa.accessory_id, code: wa.accessory_code, required: 0, woIds: [] };
        accessoryNeeds[key].required += (wa.quantity_per_piece || 0) * totalPieces;
        accessoryNeeds[key].woIds.push(wo.id);
      }
    }

    const insertSugg = db.prepare(`INSERT INTO mrp_suggestions 
      (mrp_run_id, item_type, item_id, item_code, item_name, required_qty, on_hand_qty, on_order_qty, shortage_qty, suggested_qty, supplier_id, supplier_name, unit_price, total_cost, work_order_ids)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    const transaction = db.transaction(() => {
      // Process fabric needs
      for (const [code, need] of Object.entries(fabricNeeds)) {
        const fabric = db.prepare('SELECT f.*, s.name as supplier_name FROM fabrics f LEFT JOIN suppliers s ON s.id=f.supplier_id WHERE f.code=? OR f.id=?').get(need.code, need.id);
        if (!fabric) continue;

        const onHand = db.prepare('SELECT COALESCE(SUM(available_meters),0) as v FROM fabric_inventory_batches WHERE fabric_code=? AND batch_status=?').get(fabric.code, 'available')?.v || 0;
        const onOrder = db.prepare(`SELECT COALESCE(SUM(poi.quantity - poi.received_qty),0) as v FROM purchase_order_items poi 
          JOIN purchase_orders po ON po.id=poi.po_id 
          WHERE poi.fabric_code=? AND po.status IN ('sent','partial')`).get(fabric.code)?.v || 0;

        const shortage = Math.max(0, need.required - onHand - onOrder);
        if (shortage > 0) {
          const price = fabric.price_per_meter || 0;
          insertSugg.run(runId, 'fabric', fabric.id, fabric.code, fabric.name, need.required, onHand, onOrder, shortage, shortage, fabric.supplier_id, fabric.supplier_name, price, shortage * price, JSON.stringify(need.woIds));
        }
      }

      // Process accessory needs
      for (const [code, need] of Object.entries(accessoryNeeds)) {
        const acc = db.prepare('SELECT a.*, s.name as supplier_name FROM accessories a LEFT JOIN suppliers s ON s.id=a.supplier_id WHERE a.code=? OR a.id=?').get(need.code, need.id);
        if (!acc) continue;

        const onHand = acc.quantity_on_hand || 0;
        const onOrder = db.prepare(`SELECT COALESCE(SUM(poi.quantity - poi.received_qty),0) as v FROM purchase_order_items poi 
          JOIN purchase_orders po ON po.id=poi.po_id 
          WHERE poi.accessory_code=? AND po.status IN ('sent','partial')`).get(acc.code)?.v || 0;

        const shortage = Math.max(0, need.required - onHand - onOrder);
        if (shortage > 0) {
          const price = acc.price || 0;
          insertSugg.run(runId, 'accessory', acc.id, acc.code, acc.name, need.required, onHand, onOrder, shortage, shortage, acc.supplier_id, acc.supplier_name, price, shortage * price, JSON.stringify(need.woIds));
        }
      }
    });
    transaction();

    const suggestions = db.prepare('SELECT * FROM mrp_suggestions WHERE mrp_run_id=?').all(runId);
    const runData = db.prepare('SELECT * FROM mrp_runs WHERE id=?').get(runId);

    logAudit(req, 'create', 'mrp', runId, `MRP Run #${runId} — ${suggestions.length} suggestions`);
    res.status(201).json({ run: runData, suggestions });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// GET /api/mrp — List MRP runs
// ═══════════════════════════════════════════════
router.get('/', requirePermission('mrp', 'view'), (req, res) => {
  try {
    const runs = db.prepare(`
      SELECT mr.*, u.full_name as created_by_name,
        (SELECT COUNT(*) FROM mrp_suggestions WHERE mrp_run_id=mr.id) as suggestion_count,
        (SELECT COALESCE(SUM(total_cost),0) FROM mrp_suggestions WHERE mrp_run_id=mr.id) as total_cost
      FROM mrp_runs mr
      LEFT JOIN users u ON u.id=mr.created_by
      ORDER BY mr.created_at DESC
    `).all();
    res.json(runs);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// GET /api/mrp/:id — MRP run detail
// ═══════════════════════════════════════════════
router.get('/:id', requirePermission('mrp', 'view'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const run = db.prepare('SELECT mr.*, u.full_name as created_by_name FROM mrp_runs mr LEFT JOIN users u ON u.id=mr.created_by WHERE mr.id=?').get(id);
    if (!run) return res.status(404).json({ error: 'غير موجود' });
    run.suggestions = db.prepare('SELECT * FROM mrp_suggestions WHERE mrp_run_id=? ORDER BY item_type, shortage_qty DESC').all(id);
    res.json(run);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════════
// POST /api/mrp/:id/auto-po — Create POs from suggestions
// ═══════════════════════════════════════════════
router.post('/:id/auto-po', requirePermission('mrp', 'create'), (req, res) => {
  try {
    const runId = parseInt(req.params.id);
    const run = db.prepare('SELECT * FROM mrp_runs WHERE id=?').get(runId);
    if (!run) return res.status(404).json({ error: 'غير موجود' });

    const suggestions = db.prepare('SELECT * FROM mrp_suggestions WHERE mrp_run_id=? AND po_created=0 AND shortage_qty > 0').all(runId);
    if (!suggestions.length) return res.status(400).json({ error: 'لا توجد اقتراحات لإنشاء أوامر شراء' });

    // Group by supplier
    const bySupplier = {};
    for (const s of suggestions) {
      const sid = s.supplier_id || 0;
      if (!bySupplier[sid]) bySupplier[sid] = { supplier_id: s.supplier_id, supplier_name: s.supplier_name, items: [] };
      bySupplier[sid].items.push(s);
    }

    const createdPOs = [];
    const transaction = db.transaction(() => {
      for (const [sid, group] of Object.entries(bySupplier)) {
        const poPrefix = db.prepare("SELECT value FROM settings WHERE key='po_prefix'").get()?.value || 'PO-';
        const lastPO = db.prepare('SELECT po_number FROM purchase_orders ORDER BY id DESC LIMIT 1').get();
        const nextNum = lastPO ? parseInt(String(lastPO.po_number).replace(/\D/g, '')) + 1 : 1;
        const poNumber = `${poPrefix}${String(nextNum).padStart(5, '0')}`;

        const totalAmount = group.items.reduce((s, i) => s + i.total_cost, 0);
        const poResult = db.prepare(`INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, notes, created_by) VALUES (?,?,?,?,?,?)`)
          .run(poNumber, group.supplier_id, 'draft', totalAmount, `تم الإنشاء تلقائياً من MRP #${runId}`, req.user?.id || null);
        const poId = poResult.lastInsertRowid;

        for (const item of group.items) {
          db.prepare(`INSERT INTO purchase_order_items (po_id, item_type, fabric_code, accessory_code, description, quantity, unit_price) VALUES (?,?,?,?,?,?,?)`)
            .run(poId, item.item_type, item.item_type === 'fabric' ? item.item_code : null, item.item_type === 'accessory' ? item.item_code : null, item.item_name, item.suggested_qty, item.unit_price);
          db.prepare('UPDATE mrp_suggestions SET po_created=1, po_id=? WHERE id=?').run(poId, item.id);
        }

        createdPOs.push({ po_id: poId, po_number: poNumber, supplier: group.supplier_name, items: group.items.length });
      }

      db.prepare("UPDATE mrp_runs SET status='confirmed' WHERE id=?").run(runId);
    });
    transaction();

    logAudit(req, 'MRP_AUTO_PO', 'mrp', runId, `Created ${createdPOs.length} POs from MRP #${runId}`);
    res.json({ created_pos: createdPOs });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/mrp/:id
router.delete('/:id', requirePermission('mrp', 'delete'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const run = db.prepare('SELECT * FROM mrp_runs WHERE id=?').get(id);
    if (!run) return res.status(404).json({ error: 'غير موجود' });
    db.prepare("UPDATE mrp_runs SET status='cancelled' WHERE id=?").run(id);
    logAudit(req, 'delete', 'mrp', id, `MRP Run #${id}`);
    res.json({ message: 'تم إلغاء تشغيل MRP' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
