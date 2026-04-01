const express = require('express');
const router = express.Router();
const db = require('../database');
const { requirePermission } = require('../middleware/auth');
const { fireWebhook } = require('../utils/webhooks');

// GET /api/inventory/fabric-stock — aggregated fabric inventory
router.get('/fabric-stock', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const { search, low_stock_only } = req.query;
    const threshold = db.prepare("SELECT value FROM settings WHERE key='low_stock_threshold'").get();
    const lowThreshold = parseFloat(threshold?.value) || 20;

    let q = `SELECT f.code, f.name, f.fabric_type, f.color, f.image_path, f.price_per_m as registry_price,
      COALESCE(SUM(fib.received_meters),0) as total_received,
      COALESCE(SUM(fib.used_meters),0) as total_used,
      COALESCE(SUM(fib.wasted_meters),0) as total_wasted,
      COALESCE(SUM(fib.received_meters - fib.used_meters - fib.wasted_meters),0) as total_available,
      COUNT(fib.id) as batch_count,
      AVG(fib.price_per_meter) as avg_price
      FROM fabrics f
      LEFT JOIN fabric_inventory_batches fib ON fib.fabric_code=f.code AND fib.batch_status!='cancelled'
      WHERE f.status='active'`;
    const p = [];
    if (search) { q += ' AND (f.code LIKE ? OR f.name LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    q += ' GROUP BY f.code';
    if (low_stock_only === '1') { q += ' HAVING total_available < ? AND total_available > 0'; p.push(lowThreshold); }
    q += ' ORDER BY total_available ASC';

    const rows = db.prepare(q).all(...p);
    res.json({ rows, low_stock_threshold: lowThreshold });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/inventory/batches — all batches with filters
router.get('/batches', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const { fabric_code, supplier_id, status, search } = req.query;
    let q = `SELECT fib.*, f.name as fabric_name, f.fabric_type, f.color,
      s.name as supplier_name, po.po_number
      FROM fabric_inventory_batches fib
      LEFT JOIN fabrics f ON f.code=fib.fabric_code
      LEFT JOIN suppliers s ON s.id=fib.supplier_id
      LEFT JOIN purchase_orders po ON po.id=fib.po_id
      WHERE 1=1`;
    const p = [];
    if (fabric_code) { q += ' AND fib.fabric_code=?'; p.push(fabric_code); }
    if (supplier_id) { q += ' AND fib.supplier_id=?'; p.push(supplier_id); }
    if (status) { q += ' AND fib.batch_status=?'; p.push(status); }
    if (search) { q += ' AND (fib.batch_code LIKE ? OR f.name LIKE ? OR po.po_number LIKE ?)'; p.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    q += ' ORDER BY fib.received_date DESC';
    res.json(db.prepare(q).all(...p));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/inventory/accessory-stock — aggregated accessory inventory
router.get('/accessory-stock', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const { search, type, low_stock_only } = req.query;
    let q = `SELECT a.code, a.name, a.acc_type, a.unit, a.unit_price, a.image_path,
      a.quantity_on_hand, a.low_stock_threshold, a.reorder_qty,
      (a.quantity_on_hand <= a.low_stock_threshold) as is_low_stock,
      (SELECT COUNT(*) FROM accessory_stock_movements asm WHERE asm.accessory_code=a.code) as movement_count
      FROM accessories a WHERE a.status='active'`;
    const p = [];
    if (type) { q += ' AND a.acc_type=?'; p.push(type); }
    if (search) { q += ' AND (a.code LIKE ? OR a.name LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    if (low_stock_only === '1') q += ' AND a.quantity_on_hand <= a.low_stock_threshold';
    q += ' ORDER BY a.quantity_on_hand ASC';
    res.json(db.prepare(q).all(...p));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  Warehouse Management
// ═══════════════════════════════════════════

// GET /api/inventory/warehouses — list warehouses
router.get('/warehouses', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT w.*, 
      (SELECT COUNT(*) FROM warehouse_zones wz WHERE wz.warehouse_id = w.id) as zone_count
      FROM warehouses w ORDER BY w.is_default DESC, w.name`).all();
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/inventory/warehouses — create warehouse
router.post('/warehouses', requirePermission('inventory', 'edit'), (req, res) => {
  try {
    const { code, name, name_ar, address } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'الرمز والاسم مطلوبان' });
    const existing = db.prepare('SELECT id FROM warehouses WHERE code = ?').get(code);
    if (existing) return res.status(409).json({ error: 'رمز المخزن موجود مسبقاً' });
    const r = db.prepare('INSERT INTO warehouses (code, name, name_ar, address) VALUES (?, ?, ?, ?)').run(code, name, name_ar || null, address || null);
    res.status(201).json({ id: r.lastInsertRowid, code, name });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/inventory/warehouses/:id — update warehouse
router.put('/warehouses/:id', requirePermission('inventory', 'edit'), (req, res) => {
  try {
    const { name, name_ar, address, is_active } = req.body;
    db.prepare('UPDATE warehouses SET name=COALESCE(?,name), name_ar=COALESCE(?,name_ar), address=COALESCE(?,address), is_active=COALESCE(?,is_active) WHERE id=?')
      .run(name, name_ar, address, is_active, req.params.id);
    res.json({ message: 'تم التحديث' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/inventory/warehouses/:id/zones — list zones in a warehouse
router.get('/warehouses/:id/zones', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const zones = db.prepare('SELECT * FROM warehouse_zones WHERE warehouse_id = ? ORDER BY code').all(req.params.id);
    res.json(zones);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/inventory/warehouses/:id/zones — create zone
router.post('/warehouses/:id/zones', requirePermission('inventory', 'edit'), (req, res) => {
  try {
    const { code, name, zone_type } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'الرمز والاسم مطلوبان' });
    const r = db.prepare('INSERT INTO warehouse_zones (warehouse_id, code, name, zone_type) VALUES (?, ?, ?, ?)').run(req.params.id, code, name, zone_type || 'storage');
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'رمز المنطقة موجود في هذا المخزن' });
    console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' });
  }
});

// ═══════════════════════════════════════════
//  Stock by Location
// ═══════════════════════════════════════════

// GET /api/inventory/stock-by-location — fabric + accessory stock per warehouse
router.get('/stock-by-location', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const { warehouse_id } = req.query;
    let fWhere = '1=1', aWhere = '1=1';
    const fParams = [], aParams = [];
    if (warehouse_id) { fWhere = 'fls.warehouse_id = ?'; aWhere = 'als.warehouse_id = ?'; fParams.push(warehouse_id); aParams.push(warehouse_id); }

    const fabrics = db.prepare(`
      SELECT fls.warehouse_id, w.name as warehouse_name, fls.fabric_code, f.name as fabric_name,
        SUM(fls.quantity_meters) as total_meters
      FROM fabric_location_stock fls
      JOIN warehouses w ON w.id = fls.warehouse_id
      JOIN fabrics f ON f.code = fls.fabric_code
      WHERE ${fWhere} AND fls.quantity_meters > 0
      GROUP BY fls.warehouse_id, fls.fabric_code
      ORDER BY w.name, f.name
    `).all(...fParams);

    const accessories = db.prepare(`
      SELECT als.warehouse_id, w.name as warehouse_name, als.accessory_code, a.name as accessory_name, a.unit,
        SUM(als.quantity) as total_quantity
      FROM accessory_location_stock als
      JOIN warehouses w ON w.id = als.warehouse_id
      JOIN accessories a ON a.code = als.accessory_code
      WHERE ${aWhere} AND als.quantity > 0
      GROUP BY als.warehouse_id, als.accessory_code
      ORDER BY w.name, a.name
    `).all(...aParams);

    res.json({ fabrics, accessories });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  Inventory Transfers
// ═══════════════════════════════════════════

// GET /api/inventory/transfers — list transfers
router.get('/transfers', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const { status } = req.query;
    let q = `SELECT it.*, wf.name as from_warehouse, wt.name as to_warehouse, u.full_name as created_by_name,
      (SELECT COUNT(*) FROM inventory_transfer_lines itl WHERE itl.transfer_id = it.id) as line_count
      FROM inventory_transfers it
      JOIN warehouses wf ON wf.id = it.from_warehouse_id
      JOIN warehouses wt ON wt.id = it.to_warehouse_id
      LEFT JOIN users u ON u.id = it.created_by
      WHERE 1=1`;
    const params = [];
    if (status) { q += ' AND it.status = ?'; params.push(status); }
    q += ' ORDER BY it.created_at DESC';
    res.json(db.prepare(q).all(...params));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/inventory/transfers — create transfer
router.post('/transfers', requirePermission('inventory', 'edit'), (req, res) => {
  try {
    const { from_warehouse_id, to_warehouse_id, lines, notes } = req.body;
    if (!from_warehouse_id || !to_warehouse_id || !lines?.length) 
      return res.status(400).json({ error: 'المخازن وبنود التحويل مطلوبة' });
    if (from_warehouse_id === to_warehouse_id) 
      return res.status(400).json({ error: 'لا يمكن التحويل إلى نفس المخزن' });

    const num = `TRF-${Date.now()}`;
    const txn = db.transaction(() => {
      const r = db.prepare('INSERT INTO inventory_transfers (transfer_number, from_warehouse_id, to_warehouse_id, notes, created_by) VALUES (?,?,?,?,?)')
        .run(num, from_warehouse_id, to_warehouse_id, notes || null, req.user?.id || null);
      const insertLine = db.prepare('INSERT INTO inventory_transfer_lines (transfer_id, item_type, item_code, batch_id, quantity) VALUES (?,?,?,?,?)');
      for (const line of lines) {
        insertLine.run(r.lastInsertRowid, line.item_type, line.item_code, line.batch_id || null, line.quantity);
      }
      return r.lastInsertRowid;
    });

    const id = txn();
    fireWebhook('stock.transfer_created', { id, transfer_number: num, from_warehouse_id, to_warehouse_id });
    res.status(201).json({ id, transfer_number: num });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/inventory/transfers/:id/complete — complete a transfer (move stock)
router.put('/transfers/:id/complete', requirePermission('inventory', 'edit'), (req, res) => {
  try {
    const transfer = db.prepare('SELECT * FROM inventory_transfers WHERE id = ?').get(req.params.id);
    if (!transfer) return res.status(404).json({ error: 'التحويل غير موجود' });
    if (transfer.status !== 'draft' && transfer.status !== 'in_transit') 
      return res.status(400).json({ error: 'لا يمكن إكمال هذا التحويل' });

    const lines = db.prepare('SELECT * FROM inventory_transfer_lines WHERE transfer_id = ?').all(transfer.id);

    const txn = db.transaction(() => {
      for (const line of lines) {
        if (line.item_type === 'fabric') {
          // Decrease from source
          db.prepare(`UPDATE fabric_location_stock SET quantity_meters = quantity_meters - ?, updated_at = datetime('now')
            WHERE fabric_code = ? AND warehouse_id = ? AND (batch_id = ? OR (batch_id IS NULL AND ? IS NULL))`).run(line.quantity, line.item_code, transfer.from_warehouse_id, line.batch_id, line.batch_id);
          // Increase at destination (insert or update)
          const existing = db.prepare('SELECT id FROM fabric_location_stock WHERE fabric_code = ? AND warehouse_id = ? AND (batch_id = ? OR (batch_id IS NULL AND ? IS NULL))').get(line.item_code, transfer.to_warehouse_id, line.batch_id, line.batch_id);
          if (existing) {
            db.prepare("UPDATE fabric_location_stock SET quantity_meters = quantity_meters + ?, updated_at = datetime('now') WHERE id = ?").run(line.quantity, existing.id);
          } else {
            db.prepare('INSERT INTO fabric_location_stock (fabric_code, warehouse_id, batch_id, quantity_meters) VALUES (?,?,?,?)').run(line.item_code, transfer.to_warehouse_id, line.batch_id, line.quantity);
          }
        } else {
          // Accessory
          db.prepare(`UPDATE accessory_location_stock SET quantity = quantity - ?, updated_at = datetime('now')
            WHERE accessory_code = ? AND warehouse_id = ? AND (batch_id = ? OR (batch_id IS NULL AND ? IS NULL))`).run(line.quantity, line.item_code, transfer.from_warehouse_id, line.batch_id, line.batch_id);
          const existing = db.prepare('SELECT id FROM accessory_location_stock WHERE accessory_code = ? AND warehouse_id = ? AND (batch_id = ? OR (batch_id IS NULL AND ? IS NULL))').get(line.item_code, transfer.to_warehouse_id, line.batch_id, line.batch_id);
          if (existing) {
            db.prepare("UPDATE accessory_location_stock SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?").run(line.quantity, existing.id);
          } else {
            db.prepare('INSERT INTO accessory_location_stock (accessory_code, warehouse_id, batch_id, quantity) VALUES (?,?,?,?)').run(line.item_code, transfer.to_warehouse_id, line.batch_id, line.quantity);
          }
        }
      }
      db.prepare("UPDATE inventory_transfers SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(transfer.id);
    });

    txn();
    res.json({ message: 'تم إكمال التحويل', transfer_number: transfer.transfer_number });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  Stock Valuation (FIFO costing)
// ═══════════════════════════════════════════

// GET /api/inventory/stock-valuation — FIFO-based inventory valuation
router.get('/stock-valuation', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const fabricVal = db.prepare(`
      SELECT f.code, f.name, f.fabric_type,
        COALESCE(SUM(fib.received_meters - fib.used_meters - fib.wasted_meters), 0) as available_meters,
        COALESCE(SUM((fib.received_meters - fib.used_meters - fib.wasted_meters) * fib.price_per_meter), 0) as total_value,
        CASE WHEN COALESCE(SUM(fib.received_meters - fib.used_meters - fib.wasted_meters), 0) > 0
          THEN COALESCE(SUM((fib.received_meters - fib.used_meters - fib.wasted_meters) * fib.price_per_meter), 0)
            / SUM(fib.received_meters - fib.used_meters - fib.wasted_meters)
          ELSE 0 END as weighted_avg_cost
      FROM fabrics f
      LEFT JOIN fabric_inventory_batches fib ON fib.fabric_code = f.code
        AND (fib.received_meters - fib.used_meters - fib.wasted_meters) > 0
      WHERE f.status = 'active'
      GROUP BY f.code
      HAVING COALESCE(SUM(fib.received_meters - fib.used_meters - fib.wasted_meters), 0) > 0
      ORDER BY total_value DESC
    `).all();

    const accessoryVal = db.prepare(`
      SELECT a.code, a.name, a.acc_type, a.unit,
        a.quantity_on_hand as available_qty,
        COALESCE(SUM((aib.received_qty - aib.used_qty) * aib.price_per_unit), 0) as total_value,
        CASE WHEN a.quantity_on_hand > 0
          THEN COALESCE(SUM((aib.received_qty - aib.used_qty) * aib.price_per_unit), 0) / a.quantity_on_hand
          ELSE a.unit_price END as weighted_avg_cost
      FROM accessories a
      LEFT JOIN accessory_inventory_batches aib ON aib.accessory_code = a.code
        AND (aib.received_qty - aib.used_qty) > 0
      WHERE a.status = 'active' AND a.quantity_on_hand > 0
      GROUP BY a.code
      ORDER BY total_value DESC
    `).all();

    const fabricTotal = fabricVal.reduce((s, r) => s + r.total_value, 0);
    const accessoryTotal = accessoryVal.reduce((s, r) => s + r.total_value, 0);

    res.json({
      fabrics: fabricVal,
      accessories: accessoryVal,
      summary: {
        fabric_value: Math.round(fabricTotal * 100) / 100,
        accessory_value: Math.round(accessoryTotal * 100) / 100,
        total_inventory_value: Math.round((fabricTotal + accessoryTotal) * 100) / 100,
      },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/inventory/reorder-alerts — items below reorder point
router.get('/reorder-alerts', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const lowThreshold = parseFloat(db.prepare("SELECT value FROM settings WHERE key='low_stock_threshold'").get()?.value) || 20;

    const fabricAlerts = db.prepare(`
      SELECT f.code, f.name, 'fabric' as item_type,
        COALESCE(SUM(fib.received_meters - fib.used_meters - fib.wasted_meters), 0) as available,
        f.low_stock_threshold as reorder_point,
        f.low_stock_threshold as suggested_reorder_qty
      FROM fabrics f
      LEFT JOIN fabric_inventory_batches fib ON fib.fabric_code = f.code
      WHERE f.status = 'active'
      GROUP BY f.code
      HAVING available <= COALESCE(f.low_stock_threshold, ?)
      ORDER BY available ASC
    `).all(lowThreshold);

    const accessoryAlerts = db.prepare(`
      SELECT a.code, a.name, 'accessory' as item_type, a.unit,
        a.quantity_on_hand as available,
        a.low_stock_threshold as reorder_point,
        a.reorder_qty as suggested_reorder_qty
      FROM accessories a
      WHERE a.status = 'active' AND a.quantity_on_hand <= a.low_stock_threshold
      ORDER BY a.quantity_on_hand ASC
    `).all();

    res.json({ fabric_alerts: fabricAlerts, accessory_alerts: accessoryAlerts, total_alerts: fabricAlerts.length + accessoryAlerts.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
