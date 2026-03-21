const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit } = require('../middleware/auth');

// GET /api/purchase-orders — list
router.get('/', (req, res) => {
  try {
    const { search, status, supplier_id, type, date_from, date_to } = req.query;
    let q = `SELECT po.*, s.name as supplier_name, s.code as supplier_code
      FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE 1=1`;
    const p = [];
    if (status) { q += ' AND po.status=?'; p.push(status); }
    if (supplier_id) { q += ' AND po.supplier_id=?'; p.push(supplier_id); }
    if (type) { q += ' AND po.po_type=?'; p.push(type); }
    if (date_from) { q += ' AND po.order_date >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND po.order_date <= ?'; p.push(date_to); }
    if (search) { const s = `%${search}%`; q += ' AND (po.po_number LIKE ? OR s.name LIKE ?)'; p.push(s, s); }
    q += ' ORDER BY po.created_at DESC';
    const orders = db.prepare(q).all(...p);

    const totals = {
      total: orders.length,
      draft_total: orders.filter(o => o.status === 'draft').reduce((s, o) => s + (o.total_amount || 0), 0),
      pending_total: orders.filter(o => o.status === 'sent' || o.status === 'partial').reduce((s, o) => s + (o.total_amount || 0), 0),
      received_total: orders.filter(o => o.status === 'received').reduce((s, o) => s + (o.total_amount || 0), 0),
      outstanding: orders.filter(o => o.status !== 'cancelled' && o.status !== 'draft').reduce((s, o) => s + (o.total_amount || 0) - (o.paid_amount || 0), 0),
    };
    res.json({ orders, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/purchase-orders/next-number
router.get('/next-number', (req, res) => {
  try {
    const year = new Date().getFullYear();
    const last = db.prepare(`SELECT po_number FROM purchase_orders WHERE po_number LIKE ? ORDER BY id DESC LIMIT 1`).get(`PO-${year}-%`);
    if (!last) return res.json({ next_number: `PO-${year}-001` });
    const num = parseInt(last.po_number.split('-')[2], 10) || 0;
    res.json({ next_number: `PO-${year}-${String(num + 1).padStart(3, '0')}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/purchase-orders/export — CSV export
router.get('/export', (req, res) => {
  try {
    const rows = db.prepare(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id ORDER BY po.created_at DESC`).all();
    const header = 'po_number,supplier_name,po_type,status,order_date,delivery_date,total_amount,paid_amount,notes';
    const esc = v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows.map(r => [r.po_number,r.supplier_name,r.po_type,r.status,r.order_date,r.delivery_date,r.total_amount,r.paid_amount,r.notes].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=purchase-orders.csv');
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/purchase-orders/import — bulk import
router.post('/import', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'لا توجد بيانات للاستيراد' });
    let imported = 0, errors = [];
    const insert = db.prepare(`INSERT INTO purchase_orders (po_number,supplier_id,po_type,order_date,notes,total_amount) VALUES (?,?,?,?,?,?)`);
    db.transaction(() => {
      for (const item of items) {
        try {
          if (!item.po_number) { errors.push(`سطر بدون رقم أمر شراء`); continue; }
          const existing = db.prepare('SELECT id FROM purchase_orders WHERE po_number=?').get(item.po_number);
          if (existing) { errors.push(`${item.po_number}: موجود بالفعل`); continue; }
          const supplier = item.supplier_id ? db.prepare('SELECT id FROM suppliers WHERE id=?').get(item.supplier_id) : null;
          insert.run(item.po_number, supplier ? supplier.id : null, item.po_type||'fabric', item.order_date||new Date().toISOString().slice(0,10), item.notes||null, parseFloat(item.total_amount)||0);
          imported++;
        } catch (e) { errors.push(`${item.po_number}: ${e.message}`); }
      }
    })();
    logAudit(req, 'IMPORT', 'purchase_order', null, `imported:${imported}`);
    res.json({ imported, errors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/purchase-orders/:id — full PO
router.get('/:id', (req, res) => {
  try {
    const po = db.prepare(`SELECT po.*, s.name as supplier_name, s.code as supplier_code
      FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?`).get(req.params.id);
    if (!po) return res.status(404).json({ error: 'غير موجود' });
    po.items = db.prepare(`SELECT poi.*, f.name as fabric_name, a.name as accessory_name
      FROM purchase_order_items poi LEFT JOIN fabrics f ON f.code=poi.fabric_code LEFT JOIN accessories a ON a.code=poi.accessory_code
      WHERE poi.po_id=?`).all(po.id);
    po.payments = db.prepare('SELECT * FROM supplier_payments WHERE po_id=? ORDER BY payment_date DESC').all(po.id);
    po.balance = (po.total_amount || 0) - (po.paid_amount || 0);
    res.json(po);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/purchase-orders
router.post('/', (req, res) => {
  try {
    const { po_number, supplier_id, po_type, expected_date, items, notes } = req.body;
    if (!po_number || !supplier_id) return res.status(400).json({ error: 'رقم أمر الشراء ومعرف المورد مطلوبان' });

    const transaction = db.transaction(() => {
      const totalAmount = (items || []).reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
      const r = db.prepare(`INSERT INTO purchase_orders (po_number,supplier_id,po_type,expected_date,total_amount,notes) VALUES (?,?,?,?,?,?)`)
        .run(po_number, supplier_id, po_type || 'fabric', expected_date || null, totalAmount, notes || null);
      const poId = r.lastInsertRowid;

      if (items?.length) {
        const ins = db.prepare('INSERT INTO purchase_order_items (po_id,item_type,fabric_code,accessory_code,description,quantity,unit,unit_price) VALUES (?,?,?,?,?,?,?,?)');
        items.forEach(i => {
          ins.run(poId, i.item_type || 'fabric', i.fabric_code || null, i.accessory_code || null, i.description || null, i.quantity || 0, i.unit || 'meter', i.unit_price || 0);
        });
      }
      return poId;
    });

    const poId = transaction();
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    po.items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id=?').all(poId);
    logAudit(req, 'CREATE', 'purchase_order', poId, po_number);
    res.status(201).json(po);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'رقم أمر الشراء موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/purchase-orders/:id
router.put('/:id', (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    const { supplier_id, po_type, expected_date, items, notes } = req.body;

    const transaction = db.transaction(() => {
      const totalAmount = items ? items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0) : existing.total_amount;
      db.prepare(`UPDATE purchase_orders SET supplier_id=COALESCE(?,supplier_id),po_type=COALESCE(?,po_type),expected_date=?,total_amount=?,notes=COALESCE(?,notes) WHERE id=?`)
        .run(supplier_id ?? null, po_type || null, expected_date || null, totalAmount, notes || null, poId);

      if (items) {
        db.prepare('DELETE FROM purchase_order_items WHERE po_id=?').run(poId);
        const ins = db.prepare('INSERT INTO purchase_order_items (po_id,item_type,fabric_code,accessory_code,description,quantity,unit,unit_price) VALUES (?,?,?,?,?,?,?,?)');
        items.forEach(i => {
          ins.run(poId, i.item_type || 'fabric', i.fabric_code || null, i.accessory_code || null, i.description || null, i.quantity || 0, i.unit || 'meter', i.unit_price || 0);
        });
      }
    });

    transaction();
    const updated = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    logAudit(req, 'UPDATE', 'purchase_order', poId, existing.po_number, existing, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/purchase-orders/:id/status
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const sets = ['status=?'];
    const params = [status];
    if (status === 'received') sets.push("received_date=datetime('now')");
    db.prepare(`UPDATE purchase_orders SET ${sets.join(',')} WHERE id=?`).run(...params, parseInt(req.params.id));
    res.json(db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/purchase-orders/:id/payments
router.post('/:id/payments', (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    if (!po) return res.status(404).json({ error: 'أمر الشراء غير موجود' });
    const { amount, payment_method, reference, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'المبلغ المطلوب غير صالح' });

    db.prepare(`INSERT INTO supplier_payments (supplier_id,po_id,amount,payment_method,reference,notes) VALUES (?,?,?,?,?,?)`)
      .run(po.supplier_id, poId, parseFloat(amount), payment_method || 'cash', reference || null, notes || null);
    const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as v FROM supplier_payments WHERE po_id=?').get(poId).v;
    db.prepare('UPDATE purchase_orders SET paid_amount=? WHERE id=?').run(totalPaid, poId);

    const updated = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    updated.payments = db.prepare('SELECT * FROM supplier_payments WHERE po_id=? ORDER BY payment_date DESC').all(poId);
    updated.balance = (updated.total_amount || 0) - (updated.paid_amount || 0);
    res.status(201).json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/purchase-orders/:id/receive — receive items and create fabric batches
router.patch('/:id/receive', (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    const po = db.prepare(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?`).get(poId);
    if (!po) return res.status(404).json({ error: 'أمر الشراء غير موجود' });

    const { items, received_date } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'العناصر مطلوبة' });

    const userId = req.user?.id || null;

    const transaction = db.transaction(() => {
      let allFullyReceived = true;

      for (const item of items) {
        const poItem = db.prepare('SELECT * FROM purchase_order_items WHERE id=? AND po_id=?').get(item.item_id, poId);
        if (!poItem) throw new Error(`العنصر ${item.item_id} غير موجود`);

        const receivedQty = parseFloat(item.received_qty);
        if (isNaN(receivedQty) || receivedQty < 0) throw new Error('كمية غير صالحة');

        const totalReceived = (poItem.received_qty_actual || 0) + receivedQty;
        const variance = totalReceived - poItem.quantity;
        const varianceNotes = item.variance_notes || null;
        db.prepare('UPDATE purchase_order_items SET received_qty_actual=?, quantity_variance=?, variance_notes=COALESCE(?,variance_notes) WHERE id=?')
          .run(totalReceived, variance, varianceNotes, poItem.id);

        if (totalReceived < poItem.quantity) allFullyReceived = false;

        // Create fabric inventory batch for fabric items
        if (poItem.item_type === 'fabric' && poItem.fabric_code && receivedQty > 0) {
          const year = new Date().getFullYear();
          const last = db.prepare("SELECT batch_code FROM fabric_inventory_batches WHERE batch_code LIKE ? ORDER BY id DESC LIMIT 1").get(`FB-${year}-%`);
          let nextNum = 1;
          if (last) nextNum = (parseInt(last.batch_code.split('-')[2], 10) || 0) + 1;
          const batchCode = `FB-${year}-${String(nextNum).padStart(4, '0')}`;

          db.prepare(`INSERT INTO fabric_inventory_batches (batch_code,fabric_code,supplier_id,po_id,po_item_id,received_meters,price_per_meter,used_meters,wasted_meters,received_date,batch_status) VALUES (?,?,?,?,?,?,?,0,0,?,?)`)
            .run(batchCode, poItem.fabric_code, po.supplier_id, poId, poItem.id, receivedQty, poItem.unit_price, received_date || new Date().toISOString().split('T')[0], 'available');

          // Update fabric available_meters
          db.prepare('UPDATE fabrics SET available_meters = COALESCE(available_meters,0) + ? WHERE code=?')
            .run(receivedQty, poItem.fabric_code);

          // Record fabric stock movement
          const fabric = db.prepare('SELECT id, available_meters FROM fabrics WHERE code=?').get(poItem.fabric_code);
          if (fabric) {
            db.prepare(`INSERT INTO fabric_stock_movements (fabric_code, movement_type, qty_meters, reference_type, reference_id, notes, created_by) VALUES (?,?,?,?,?,?,?)`)
              .run(poItem.fabric_code, 'in', receivedQty, 'purchase_order', poId, 'استلام من أمر شراء ' + po.po_number, userId);
          }
        }

        // Restock accessories
        if (poItem.item_type === 'accessory' && poItem.accessory_code && receivedQty > 0) {
          const acc = db.prepare('SELECT id, quantity_on_hand FROM accessories WHERE code=?').get(poItem.accessory_code);
          if (acc) {
            const newQty = (acc.quantity_on_hand || 0) + receivedQty;
            db.prepare('UPDATE accessories SET quantity_on_hand=? WHERE id=?').run(newQty, acc.id);
            db.prepare(`INSERT INTO accessory_stock_movements (accessory_code, movement_type, qty, reference_type, reference_id, notes, created_by) VALUES (?,?,?,?,?,?,?)`)
              .run(poItem.accessory_code, 'in', receivedQty, 'purchase_order', poId, 'استلام من أمر شراء ' + po.po_number, userId);
          }
        }
      }

      const newStatus = allFullyReceived ? 'received' : 'partial';
      db.prepare(`UPDATE purchase_orders SET status=?, received_date=COALESCE(received_date,datetime('now','localtime')), received_by_user_id=? WHERE id=?`)
        .run(newStatus, userId, poId);
    });

    transaction();

    // Return full PO with items
    const updated = db.prepare(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?`).get(poId);
    updated.items = db.prepare(`SELECT poi.*, f.name as fabric_name, a.name as accessory_name FROM purchase_order_items poi LEFT JOIN fabrics f ON f.code=poi.fabric_code LEFT JOIN accessories a ON a.code=poi.accessory_code WHERE poi.po_id=?`).all(poId);
    updated.payments = db.prepare('SELECT * FROM supplier_payments WHERE po_id=? ORDER BY payment_date DESC').all(poId);
    updated.balance = (updated.total_amount || 0) - (updated.paid_amount || 0);
    res.json(updated);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/purchase-orders/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare("UPDATE purchase_orders SET status='cancelled' WHERE id=?").run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
