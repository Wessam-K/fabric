const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit, requirePermission } = require('../middleware/auth');
const { generateNextNumber } = require('../utils/numberGenerator');
const { fireWebhook } = require('../utils/webhooks');
const { round2, safeMultiply, safeAdd, safeSubtract } = require('../utils/money');

// GET /api/purchase-orders — list
router.get('/', requirePermission('purchase_orders', 'view'), (req, res) => {
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

    // V59: Compute totals via SQL GROUP BY instead of JS reduce
    const totalsQ = q.replace(
      /SELECT po\.\*, s\.name as supplier_name, s\.code as supplier_code/,
      `SELECT COUNT(*) as cnt,
        COALESCE(SUM(CASE WHEN po.status='draft' THEN po.total_amount ELSE 0 END),0) as draft_total,
        COALESCE(SUM(CASE WHEN po.status IN ('sent','partial') THEN po.total_amount ELSE 0 END),0) as pending_total,
        COALESCE(SUM(CASE WHEN po.status='received' THEN po.total_amount ELSE 0 END),0) as received_total,
        COALESCE(SUM(CASE WHEN po.status NOT IN ('cancelled','draft') THEN (po.total_amount - po.paid_amount) ELSE 0 END),0) as outstanding`
    ).replace(/ ORDER BY po\.created_at DESC/, '');
    const t = db.prepare(totalsQ).get(...p);
    const totals = {
      total: t.cnt,
      draft_total: t.draft_total,
      pending_total: t.pending_total,
      received_total: t.received_total,
      outstanding: t.outstanding,
    };

    const { page, limit: lim } = req.query;
    if (page && lim) {
      const pg = Math.max(1, parseInt(page));
      const perPage = Math.min(200, Math.max(1, parseInt(lim)));
      const orders = db.prepare(q + ' LIMIT ? OFFSET ?').all(...p, perPage, (pg - 1) * perPage);
      return res.json({ orders, totals, page: pg, pages: Math.ceil(totals.total / perPage) });
    }
    const orders = db.prepare(q).all(...p);
    res.json({ orders, totals });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/purchase-orders/next-number
router.get('/next-number', requirePermission('purchase_orders', 'view'), (req, res) => {
  try {
    res.json({ next_number: generateNextNumber(db, 'purchase_order') });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/purchase-orders/export — CSV export
router.get('/export', requirePermission('purchase_orders', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id ORDER BY po.created_at DESC`).all();
    const header = 'po_number,supplier_name,po_type,status,order_date,expected_date,total_amount,paid_amount,notes';
    const esc = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header, ...rows.map(r => [r.po_number,r.supplier_name,r.po_type,r.status,r.order_date,r.expected_date,r.total_amount,r.paid_amount,r.notes].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=purchase-orders.csv');
    res.send('\uFEFF' + csv);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/purchase-orders/import — bulk import
router.post('/import', requirePermission('purchase_orders', 'create'), (req, res) => {
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
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/purchase-orders/:id — full PO
router.get('/:id', requirePermission('purchase_orders', 'view'), (req, res) => {
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
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/purchase-orders
router.post('/', requirePermission('purchase_orders', 'create'), (req, res) => {
  try {
    const { po_number, supplier_id, po_type, expected_date, items, notes, tax_pct, discount } = req.body;
    if (!po_number || !supplier_id) return res.status(400).json({ error: 'رقم أمر الشراء ومعرف المورد مطلوبان' });

    const validItemTypes = ['fabric', 'accessory', 'other'];
    if (items?.length) {
      for (const i of items) {
        if (i.item_type && !validItemTypes.includes(i.item_type)) {
          return res.status(400).json({ error: 'نوع الصنف غير صالح' });
        }
      }
    }

    if (tax_pct != null && (parseFloat(tax_pct) < 0 || parseFloat(tax_pct) > 100)) return res.status(400).json({ error: 'نسبة الضريبة يجب أن تكون بين 0 و 100' });
    if (discount != null && parseFloat(discount) < 0) return res.status(400).json({ error: 'الخصم لا يمكن أن يكون سالباً' });
    const preSubtotal = (items || []).reduce((s, i) => safeAdd(s, safeMultiply(i.quantity || 0, i.unit_price || 0)), 0);
    if ((parseFloat(discount) || 0) > preSubtotal) return res.status(400).json({ error: 'الخصم لا يمكن أن يتجاوز المجموع الفرعي' });

    const transaction = db.transaction(() => {
      const subtotal = preSubtotal;
      const disc = parseFloat(discount) || 0;
      const taxAmt = round2(safeSubtract(subtotal, disc) * ((parseFloat(tax_pct) || 0) / 100));
      const totalAmount = round2(safeAdd(safeSubtract(subtotal, disc), taxAmt));
      const r = db.prepare(`INSERT INTO purchase_orders (po_number,supplier_id,po_type,expected_date,total_amount,tax_pct,discount,notes) VALUES (?,?,?,?,?,?,?,?)`)
        .run(po_number, supplier_id, po_type || 'fabric', expected_date || null, totalAmount, parseFloat(tax_pct) || 0, parseFloat(discount) || 0, notes || null);
      const poId = r.lastInsertRowid;

      if (items?.length) {
        const ins = db.prepare('INSERT INTO purchase_order_items (po_id,item_type,fabric_code,accessory_code,description,quantity,unit,unit_price) VALUES (?,?,?,?,?,?,?,?)');
        items.forEach(i => {
          const type = i.item_type || 'fabric';
          const code = i.item_code || i.fabric_code || i.accessory_code || null;
          ins.run(poId, type, type === 'fabric' ? code : null, type === 'accessory' ? code : null, i.description || null, i.quantity || 0, i.unit || 'meter', i.unit_price || 0);
        });
      }
      return poId;
    });

    const poId = transaction();
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    po.items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id=?').all(poId);
    logAudit(req, 'CREATE', 'purchase_order', poId, po_number);
    fireWebhook('purchaseorder.created', { id: poId, po_number, supplier_id: po.supplier_id, total: po.total_amount });
    res.status(201).json(po);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'رقم أمر الشراء موجود بالفعل' });
    console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' });
  }
});

// PUT /api/purchase-orders/:id
router.put('/:id', requirePermission('purchase_orders', 'edit'), (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    if (!existing) return res.status(404).json({ error: 'غير موجود' });
    const { supplier_id, po_type, expected_date, items, notes, tax_pct, discount } = req.body;
    if (tax_pct != null && (parseFloat(tax_pct) < 0 || parseFloat(tax_pct) > 100)) return res.status(400).json({ error: 'نسبة الضريبة يجب أن تكون بين 0 و 100' });
    if (discount != null && parseFloat(discount) < 0) return res.status(400).json({ error: 'الخصم لا يمكن أن يكون سالباً' });

    const transaction = db.transaction(() => {
      let subtotal;
      if (items) {
        subtotal = items.reduce((s, i) => safeAdd(s, safeMultiply(i.quantity || 0, i.unit_price || 0)), 0);
      } else {
        // Recalculate from existing items when tax/discount changes
        const existingItems = db.prepare('SELECT quantity, unit_price FROM purchase_order_items WHERE po_id=?').all(poId);
        subtotal = existingItems.reduce((s, i) => safeAdd(s, safeMultiply(i.quantity || 0, i.unit_price || 0)), 0);
      }
      const taxPct = tax_pct !== undefined ? parseFloat(tax_pct) || 0 : existing.tax_pct || 0;
      const disc = discount !== undefined ? parseFloat(discount) || 0 : existing.discount || 0;
      const afterDisc = safeSubtract(subtotal, disc);
      const totalAmount = round2(safeAdd(afterDisc, round2(afterDisc * (taxPct / 100))));
      db.prepare(`UPDATE purchase_orders SET supplier_id=COALESCE(?,supplier_id),po_type=COALESCE(?,po_type),expected_date=?,total_amount=?,tax_pct=?,discount=?,notes=COALESCE(?,notes) WHERE id=?`)
        .run(supplier_id ?? null, po_type || null, expected_date || null, totalAmount, taxPct, disc, notes || null, poId);

      if (items) {
        db.prepare('DELETE FROM purchase_order_items WHERE po_id=?').run(poId);
        const ins = db.prepare('INSERT INTO purchase_order_items (po_id,item_type,fabric_code,accessory_code,description,quantity,unit,unit_price) VALUES (?,?,?,?,?,?,?,?)');
        items.forEach(i => {
          const type = i.item_type || 'fabric';
          const code = i.item_code || i.fabric_code || i.accessory_code || null;
          ins.run(poId, type, type === 'fabric' ? code : null, type === 'accessory' ? code : null, i.description || null, i.quantity || 0, i.unit || 'meter', i.unit_price || 0);
        });
      }
    });

    transaction();
    const updated = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    logAudit(req, 'UPDATE', 'purchase_order', poId, existing.po_number, existing, updated);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/purchase-orders/:id/status
router.patch('/:id/status', requirePermission('purchase_orders', 'edit'), (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['draft', 'sent', 'partial', 'received', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(parseInt(req.params.id));
    if (!po) return res.status(404).json({ error: 'غير موجود' });
    // Status transition rules
    const transitions = {
      draft: ['sent', 'cancelled'],
      sent: ['partial', 'received', 'cancelled'],
      partial: ['received', 'cancelled'],
      received: [],
      cancelled: ['draft']
    };
    const allowed = transitions[po.status] || [];
    if (!allowed.includes(status)) return res.status(400).json({ error: `لا يمكن تغيير الحالة من ${po.status} إلى ${status}` });
    const sets = ['status=?'];
    const params = [status];
    if (status === 'received' && !po.received_date) sets.push("received_date=datetime('now')");
    db.prepare(`UPDATE purchase_orders SET ${sets.join(',')} WHERE id=?`).run(...params, po.id);
    res.json(db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(po.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// POST /api/purchase-orders/:id/payments
router.post('/:id/payments', requirePermission('purchase_orders', 'edit'), (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    if (!po) return res.status(404).json({ error: 'أمر الشراء غير موجود' });
    const { amount, payment_method, reference, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'المبلغ المطلوب غير صالح' });

    db.transaction(() => {
      db.prepare(`INSERT INTO supplier_payments (supplier_id,po_id,amount,payment_method,reference,notes) VALUES (?,?,?,?,?,?)`)
        .run(po.supplier_id, poId, round2(parseFloat(amount)), payment_method || 'cash', reference || null, notes || null);
      const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as v FROM supplier_payments WHERE po_id=?').get(poId).v;
      db.prepare('UPDATE purchase_orders SET paid_amount=? WHERE id=?').run(round2(totalPaid), poId);
    })();

    const updated = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId);
    updated.payments = db.prepare('SELECT * FROM supplier_payments WHERE po_id=? ORDER BY payment_date DESC').all(poId);
    updated.balance = (updated.total_amount || 0) - (updated.paid_amount || 0);
    res.status(201).json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// PATCH /api/purchase-orders/:id/receive — receive items and create fabric batches
router.patch('/:id/receive', requirePermission('purchase_orders', 'edit'), (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    const po = db.prepare(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?`).get(poId);
    if (!po) return res.status(404).json({ error: 'أمر الشراء غير موجود' });
    if (['cancelled', 'draft'].includes(po.status)) return res.status(400).json({ error: 'لا يمكن استلام أصناف لأمر شراء في حالة ' + po.status });

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
        if (totalReceived > poItem.quantity * 1.1) throw new Error(`الكمية المستلمة (${totalReceived}) تتجاوز 110% من الكمية المطلوبة (${poItem.quantity})`);
        const variance = totalReceived - poItem.quantity;
        const varianceNotes = item.variance_notes || null;
        db.prepare('UPDATE purchase_order_items SET received_qty_actual=?, quantity_variance=?, variance_notes=COALESCE(?,variance_notes) WHERE id=?')
          .run(totalReceived, variance, varianceNotes, poItem.id);

        if (totalReceived < poItem.quantity) allFullyReceived = false;

        // Create fabric inventory batch for fabric items
        if (poItem.item_type === 'fabric' && poItem.fabric_code && receivedQty > 0) {
          const batchCode = generateNextNumber(db, 'fabric_batch');

          db.prepare(`INSERT INTO fabric_inventory_batches (batch_code,fabric_code,supplier_id,po_id,po_item_id,ordered_meters,received_meters,price_per_meter,used_meters,wasted_meters,received_date,batch_status) VALUES (?,?,?,?,?,?,?,?,0,0,?,?)`)
            .run(batchCode, poItem.fabric_code, po.supplier_id, poId, poItem.id, poItem.quantity, receivedQty, poItem.unit_price, received_date || new Date().toISOString().split('T')[0], 'available');

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء استلام أمر الشراء' });
  }
});

// DELETE /api/purchase-orders/:id
router.delete('/:id', requirePermission('purchase_orders', 'delete'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const po = db.prepare('SELECT status FROM purchase_orders WHERE id=?').get(id);
    if (!po) return res.status(404).json({ error: 'غير موجود' });
    if (po.status === 'received') return res.status(400).json({ error: 'لا يمكن إلغاء أمر شراء تم استلامه بالكامل' });
    if (po.status === 'cancelled') return res.status(400).json({ error: 'أمر الشراء ملغي بالفعل' });
    db.prepare("UPDATE purchase_orders SET status='cancelled' WHERE id=?").run(id);
    logAudit(req, 'DELETE', 'purchase_order', id, `PO#${id}`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

module.exports = router;
