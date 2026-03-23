const express = require('express');
const router = express.Router();
const db = require('../database');

// ═══════════════════════════════════════════════════════════════
// Universal Barcode Lookup
// GET /api/barcode/:code — searches ALL barcode-enabled entities
// Returns { type, id, data } or 404
// ═══════════════════════════════════════════════════════════════
router.get('/:code', (req, res) => {
  try {
    const { code } = req.params;
    if (!code || code.length < 3) {
      return res.status(400).json({ error: 'الباركود يجب أن يكون 3 أحرف على الأقل' });
    }

    // 1. Check machines
    const machine = db.prepare(`
      SELECT id, code, name, machine_type, location, status, barcode,
             last_maintenance_date, next_maintenance_date
      FROM machines WHERE barcode = ? AND status != 'deleted'
    `).get(code);
    if (machine) {
      return res.json({ type: 'machine', id: machine.id, data: machine });
    }

    // 2. Check maintenance orders
    const maintenance = db.prepare(`
      SELECT mo.id, mo.barcode, mo.title, mo.maintenance_type, mo.priority, mo.status,
             mo.scheduled_date, mo.completed_date, mo.cost, mo.machine_id,
             m.name as machine_name, m.code as machine_code
      FROM maintenance_orders mo
      LEFT JOIN machines m ON m.id = mo.machine_id
      WHERE mo.barcode = ? AND mo.is_deleted = 0
    `).get(code);
    if (maintenance) {
      return res.json({ type: 'maintenance', id: maintenance.id, data: maintenance });
    }

    // 3. Check fabrics
    const fabric = db.prepare(`
      SELECT id, code, name, fabric_type, color, width, available_meters, price_per_m, status
      FROM fabrics WHERE code = ? AND status = 'active'
    `).get(code);
    if (fabric) {
      return res.json({ type: 'fabric', id: fabric.id, data: fabric });
    }

    // 4. Check accessories
    const accessory = db.prepare(`
      SELECT id, code, name, acc_type, quantity_on_hand, unit_price, status
      FROM accessories WHERE code = ? AND status = 'active'
    `).get(code);
    if (accessory) {
      return res.json({ type: 'accessory', id: accessory.id, data: accessory });
    }

    // 5. Check models
    const model = db.prepare(`
      SELECT id, model_code, model_name, serial_number, category, status, total_cost
      FROM models WHERE model_code = ? OR serial_number = ?
    `).get(code, code);
    if (model) {
      return res.json({ type: 'model', id: model.id, data: model });
    }

    // 6. Check work orders by WO number
    const workOrder = db.prepare(`
      SELECT wo.id, wo.wo_number, wo.status, wo.priority, wo.quantity,
             wo.due_date, wo.completed_date, wo.total_production_cost,
             m.model_code, m.model_name
      FROM work_orders wo
      LEFT JOIN models m ON m.id = wo.model_id
      WHERE wo.wo_number = ?
    `).get(code);
    if (workOrder) {
      return res.json({ type: 'work_order', id: workOrder.id, data: workOrder });
    }

    // 7. Check suppliers
    const supplier = db.prepare(`
      SELECT id, code, name, supplier_type, contact_name, phone, status
      FROM suppliers WHERE code = ? AND status = 'active'
    `).get(code);
    if (supplier) {
      return res.json({ type: 'supplier', id: supplier.id, data: supplier });
    }

    // 8. Check customers
    const customer = db.prepare(`
      SELECT id, code, name, phone, city, balance, status
      FROM customers WHERE code = ? AND status = 'active'
    `).get(code);
    if (customer) {
      return res.json({ type: 'customer', id: customer.id, data: customer });
    }

    // 9. Check invoices
    const invoice = db.prepare(`
      SELECT id, invoice_number, customer_name, total, status, created_at
      FROM invoices WHERE invoice_number = ?
    `).get(code);
    if (invoice) {
      return res.json({ type: 'invoice', id: invoice.id, data: invoice });
    }

    // 10. Check purchase orders
    const po = db.prepare(`
      SELECT po.id, po.po_number, po.status, po.total_amount, po.created_at,
             s.name as supplier_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.po_number = ?
    `).get(code);
    if (po) {
      return res.json({ type: 'purchase_order', id: po.id, data: po });
    }

    // Not found
    res.status(404).json({ error: 'لم يتم العثور على عنصر بهذا الباركود', code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
