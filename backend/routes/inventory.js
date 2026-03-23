const express = require('express');
const router = express.Router();
const db = require('../database');
const { requirePermission } = require('../middleware/auth');

// GET /api/inventory/fabric-stock — aggregated fabric inventory
router.get('/fabric-stock', requirePermission('inventory', 'view'), (req, res) => {
  try {
    const { search, low_stock_only } = req.query;
    const threshold = db.prepare("SELECT value FROM settings WHERE key='low_stock_threshold'").get();
    const lowThreshold = parseFloat(threshold?.value) || 10;

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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
