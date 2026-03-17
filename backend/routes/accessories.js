const express = require('express');
const router = express.Router();
const db = require('../database');
const { logAudit } = require('../middleware/auth');

router.get('/', (req, res) => {
  try {
    const { type, search, status, supplier_id } = req.query;
    let q = 'SELECT a.*, s.name as supplier_name FROM accessories a LEFT JOIN suppliers s ON s.id=a.supplier_id WHERE 1=1';
    const p = [];
    if (type) { q += ' AND a.acc_type = ?'; p.push(type); }
    if (status) { q += ' AND a.status = ?'; p.push(status); }
    if (supplier_id) { q += ' AND a.supplier_id = ?'; p.push(supplier_id); }
    if (search) { q += ' AND (a.code LIKE ? OR a.name LIKE ? OR a.supplier LIKE ? OR s.name LIKE ?)'; const s = `%${search}%`; p.push(s, s, s, s); }
    q += ' ORDER BY a.created_at DESC';
    res.json(db.prepare(q).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { code, acc_type, name, unit_price, unit, supplier, supplier_id, notes } = req.body;
    if (!code || !acc_type || !name || unit_price == null) return res.status(400).json({ error: 'code, acc_type, name, unit_price required' });
    const r = db.prepare(`INSERT INTO accessories (code,acc_type,name,unit_price,unit,supplier,supplier_id,notes) VALUES (?,?,?,?,?,?,?,?)`)
      .run(code, acc_type, name, parseFloat(unit_price), unit || 'piece', supplier || null, supplier_id || null, notes || null);
    const created = db.prepare('SELECT * FROM accessories WHERE id=?').get(r.lastInsertRowid);
    logAudit(req, 'CREATE', 'accessory', code, name);
    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود الاكسسوار موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:code', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { acc_type, name, unit_price, unit, supplier, supplier_id, status, notes } = req.body;
    db.prepare(`UPDATE accessories SET acc_type=COALESCE(?,acc_type),name=COALESCE(?,name),unit_price=COALESCE(?,unit_price),unit=COALESCE(?,unit),supplier=COALESCE(?,supplier),supplier_id=COALESCE(?,supplier_id),status=COALESCE(?,status),notes=COALESCE(?,notes) WHERE code=?`)
      .run(acc_type||null, name||null, unit_price!=null?parseFloat(unit_price):null, unit||null, supplier||null, supplier_id||null, status||null, notes||null, req.params.code);
    const updated = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    logAudit(req, 'UPDATE', 'accessory', req.params.code, existing.name, existing, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:code', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare("UPDATE accessories SET status='inactive' WHERE code=?").run(req.params.code);
    logAudit(req, 'DELETE', 'accessory', req.params.code, existing.name);
    res.json({ message: 'Deactivated', code: req.params.code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
