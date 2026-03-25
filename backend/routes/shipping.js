const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');
const { generateNextNumber } = require('../utils/numberGenerator');

// GET /api/shipping — list shipments
router.get('/', requirePermission('shipping', 'view'), (req, res) => {
  try {
    const { status, type, search, page = 1, limit = 50 } = req.query;
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND s.status=?'; params.push(status); }
    if (type) { where += ' AND s.shipment_type=?'; params.push(type); }
    if (search) { where += ' AND (s.shipment_number LIKE ? OR s.tracking_number LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM shipments s LEFT JOIN customers c ON c.id=s.customer_id WHERE ${where}`).get(...params).c;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    const data = db.prepare(`
      SELECT s.*, c.name as customer_name, sup.name as supplier_name, wo.wo_number,
        (SELECT COUNT(*) FROM shipment_items WHERE shipment_id=s.id) as item_count
      FROM shipments s
      LEFT JOIN customers c ON c.id=s.customer_id
      LEFT JOIN suppliers sup ON sup.id=s.supplier_id
      LEFT JOIN work_orders wo ON wo.id=s.work_order_id
      WHERE ${where}
      ORDER BY s.created_at DESC LIMIT ? OFFSET ?
    `).all(...params);
    res.json({ data, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/shipping/next-number
router.get('/next-number', requirePermission('shipping', 'view'), (req, res) => {
  res.json({ number: generateNextNumber(db, 'shipment') });
});

// GET /api/shipping/:id
router.get('/:id', requirePermission('shipping', 'view'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const shipment = db.prepare(`
      SELECT s.*, c.name as customer_name, sup.name as supplier_name, wo.wo_number, u.full_name as created_by_name
      FROM shipments s
      LEFT JOIN customers c ON c.id=s.customer_id
      LEFT JOIN suppliers sup ON sup.id=s.supplier_id
      LEFT JOIN work_orders wo ON wo.id=s.work_order_id
      LEFT JOIN users u ON u.id=s.created_by
      WHERE s.id=?
    `).get(id);
    if (!shipment) return res.status(404).json({ error: 'الشحنة غير موجودة' });
    shipment.items = db.prepare('SELECT * FROM shipment_items WHERE shipment_id=?').all(id);
    shipment.packing_lists = db.prepare('SELECT * FROM packing_lists WHERE shipment_id=?').all(id);
    res.json(shipment);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/shipping
router.post('/', requirePermission('shipping', 'create'), (req, res) => {
  try {
    const { shipment_number, shipment_type, customer_id, supplier_id, work_order_id, invoice_id,
      carrier_name, tracking_number, shipping_method, shipping_cost, weight, packages_count,
      ship_date, expected_delivery, shipping_address, notes, items } = req.body;
    if (shipment_type && !['outbound','inbound','return'].includes(shipment_type)) return res.status(400).json({ error: 'نوع الشحنة غير صالح' });

    const created = db.transaction(() => {
      const num = shipment_number || generateNextNumber(db, 'shipment');
      const result = db.prepare(`INSERT INTO shipments 
        (shipment_number, shipment_type, customer_id, supplier_id, work_order_id, invoice_id,
         carrier_name, tracking_number, shipping_method, shipping_cost, weight, packages_count,
         ship_date, expected_delivery, shipping_address, notes, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(num, shipment_type || 'outbound', customer_id || null, supplier_id || null,
        work_order_id || null, invoice_id || null, carrier_name || null, tracking_number || null,
        shipping_method || null, parseFloat(shipping_cost) || 0, parseFloat(weight) || 0,
        parseInt(packages_count) || 1, ship_date || null, expected_delivery || null,
        shipping_address || null, notes || null, req.user?.id || null);

      const shipId = result.lastInsertRowid;

      if (items?.length) {
        const ins = db.prepare('INSERT INTO shipment_items (shipment_id, description, model_code, variant, quantity, unit, weight, notes) VALUES (?,?,?,?,?,?,?,?)');
        for (const it of items) {
          ins.run(shipId, it.description, it.model_code || null, it.variant || null,
            parseFloat(it.quantity) || 0, it.unit || 'pcs', parseFloat(it.weight) || 0, it.notes || null);
        }
      }

      const ship = db.prepare('SELECT * FROM shipments WHERE id=?').get(shipId);
      ship.items = db.prepare('SELECT * FROM shipment_items WHERE shipment_id=?').all(shipId);
      return ship;
    })();

    logAudit(req, 'create', 'shipment', created.id, created.shipment_number);
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PUT /api/shipping/:id
router.put('/:id', requirePermission('shipping', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = db.prepare('SELECT * FROM shipments WHERE id=?').get(id);
    if (!old) return res.status(404).json({ error: 'غير موجود' });

    const { carrier_name, tracking_number, shipping_method, shipping_cost, weight, packages_count,
      ship_date, expected_delivery, actual_delivery, shipping_address, notes, items } = req.body;

    db.transaction(() => {
      db.prepare(`UPDATE shipments SET 
        carrier_name=COALESCE(?,carrier_name), tracking_number=COALESCE(?,tracking_number),
        shipping_method=COALESCE(?,shipping_method), shipping_cost=COALESCE(?,shipping_cost),
        weight=COALESCE(?,weight), packages_count=COALESCE(?,packages_count),
        ship_date=COALESCE(?,ship_date), expected_delivery=COALESCE(?,expected_delivery),
        actual_delivery=COALESCE(?,actual_delivery), shipping_address=COALESCE(?,shipping_address),
        notes=COALESCE(?,notes), updated_at=datetime('now','localtime')
        WHERE id=?`)
      .run(carrier_name, tracking_number, shipping_method, shipping_cost !== undefined ? shipping_cost : null,
        weight !== undefined ? weight : null, packages_count !== undefined ? packages_count : null,
        ship_date, expected_delivery, actual_delivery, shipping_address, notes, id);

      if (items) {
        db.prepare('DELETE FROM shipment_items WHERE shipment_id=?').run(id);
        const ins = db.prepare('INSERT INTO shipment_items (shipment_id, description, model_code, variant, quantity, unit, weight, notes) VALUES (?,?,?,?,?,?,?,?)');
        for (const it of items) {
          ins.run(id, it.description, it.model_code || null, it.variant || null,
            parseFloat(it.quantity) || 0, it.unit || 'pcs', parseFloat(it.weight) || 0, it.notes || null);
        }
      }
    })();

    logAudit(req, 'update', 'shipment', id, old.shipment_number, old, req.body);
    res.json(db.prepare('SELECT * FROM shipments WHERE id=?').get(id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/shipping/:id/status
router.patch('/:id/status', requirePermission('shipping', 'edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const validStatuses = ['draft', 'ready', 'shipped', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });
    const old = db.prepare('SELECT * FROM shipments WHERE id=?').get(id);
    if (!old) return res.status(404).json({ error: 'غير موجود' });
    if (old.status === 'delivered') return res.status(400).json({ error: 'لا يمكن تغيير حالة شحنة تم تسليمها' });
    if (old.status === 'cancelled' && status !== 'draft') return res.status(400).json({ error: 'لا يمكن تغيير حالة شحنة ملغاة إلا إلى مسودة' });

    const updates = { status };
    if (status === 'delivered') updates.actual_delivery = new Date().toISOString().slice(0, 10);

    db.prepare(`UPDATE shipments SET status=?, actual_delivery=COALESCE(?,actual_delivery), updated_at=datetime('now','localtime') WHERE id=?`)
      .run(status, updates.actual_delivery || null, id);

    logAudit(req, 'update', 'shipment', id, old.shipment_number, { status: old.status }, { status });
    res.json(db.prepare('SELECT * FROM shipments WHERE id=?').get(id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/shipping/:id/packing-list
router.post('/:id/packing-list', requirePermission('shipping', 'edit'), (req, res) => {
  try {
    const shipId = parseInt(req.params.id);
    const shipment = db.prepare('SELECT * FROM shipments WHERE id=?').get(shipId);
    if (!shipment) return res.status(404).json({ error: 'غير موجود' });

    const { box_number, contents, quantity, weight, dimensions, notes } = req.body;
    db.prepare('INSERT INTO packing_lists (shipment_id, box_number, contents, quantity, weight, dimensions, notes) VALUES (?,?,?,?,?,?,?)')
      .run(shipId, box_number || 1, contents, parseFloat(quantity) || 0, parseFloat(weight) || 0, dimensions || null, notes || null);

    const lists = db.prepare('SELECT * FROM packing_lists WHERE shipment_id=?').all(shipId);
    res.status(201).json(lists);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/shipping/:id
router.delete('/:id', requirePermission('shipping', 'delete'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = db.prepare('SELECT * FROM shipments WHERE id=?').get(id);
    if (!old) return res.status(404).json({ error: 'غير موجود' });
    db.prepare("UPDATE shipments SET status='cancelled', updated_at=datetime('now','localtime') WHERE id=?").run(id);
    logAudit(req, 'delete', 'shipment', id, old.shipment_number, old, null);
    res.json({ message: 'تم إلغاء الشحنة' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
