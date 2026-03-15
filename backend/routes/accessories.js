const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    const { type, search, status } = req.query;
    let q = 'SELECT * FROM accessories WHERE 1=1';
    const p = [];
    if (type) { q += ' AND acc_type = ?'; p.push(type); }
    if (status) { q += ' AND status = ?'; p.push(status); }
    if (search) { q += ' AND (code LIKE ? OR name LIKE ? OR supplier LIKE ?)'; const s = `%${search}%`; p.push(s, s, s); }
    q += ' ORDER BY created_at DESC';
    res.json(db.prepare(q).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { code, acc_type, name, unit_price, unit, supplier, notes } = req.body;
    if (!code || !acc_type || !name || unit_price == null) return res.status(400).json({ error: 'code, acc_type, name, unit_price required' });
    const r = db.prepare(`INSERT INTO accessories (code,acc_type,name,unit_price,unit,supplier,notes) VALUES (?,?,?,?,?,?,?)`)
      .run(code, acc_type, name, parseFloat(unit_price), unit || 'piece', supplier || null, notes || null);
    res.status(201).json(db.prepare('SELECT * FROM accessories WHERE id=?').get(r.lastInsertRowid));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود الاكسسوار موجود بالفعل' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:code', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { acc_type, name, unit_price, unit, supplier, status, notes } = req.body;
    db.prepare(`UPDATE accessories SET acc_type=COALESCE(?,acc_type),name=COALESCE(?,name),unit_price=COALESCE(?,unit_price),unit=COALESCE(?,unit),supplier=COALESCE(?,supplier),status=COALESCE(?,status),notes=COALESCE(?,notes) WHERE code=?`)
      .run(acc_type||null, name||null, unit_price!=null?parseFloat(unit_price):null, unit||null, supplier||null, status||null, notes||null, req.params.code);
    res.json(db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:code', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM accessories WHERE code=?').get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare("UPDATE accessories SET status='inactive' WHERE code=?").run(req.params.code);
    res.json({ message: 'Deactivated', code: req.params.code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
