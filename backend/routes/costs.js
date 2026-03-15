const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/reports — paginated snapshots
router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 20, date_from, date_to } = req.query;
    let q = `SELECT cs.*, m.serial_number, m.model_code, m.model_name
             FROM cost_snapshots cs JOIN models m ON m.id = cs.model_id WHERE 1=1`;
    const p = [];
    if (date_from) { q += ' AND cs.snapshot_date >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND cs.snapshot_date <= ?'; p.push(date_to + 'T23:59:59'); }
    q += ' ORDER BY cs.snapshot_date DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    q += ` LIMIT ? OFFSET ?`;
    p.push(parseInt(limit), offset);
    res.json(db.prepare(q).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/summary — overall KPI summary
router.get('/summary', (req, res) => {
  try {
    const totalModels = db.prepare("SELECT COUNT(*) as c FROM models WHERE status='active'").get().c;
    const totalFabrics = db.prepare("SELECT COUNT(*) as c FROM fabrics WHERE status='active'").get().c;
    const totalAccessories = db.prepare("SELECT COUNT(*) as c FROM accessories WHERE status='active'").get().c;
    const avgCost = db.prepare('SELECT AVG(cost_per_piece) as avg FROM cost_snapshots').get().avg || 0;
    const totalPieces = db.prepare('SELECT SUM(total_pieces) as s FROM cost_snapshots').get().s || 0;
    const totalCost = db.prepare('SELECT SUM(total_cost) as s FROM cost_snapshots').get().s || 0;
    const minCostPiece = db.prepare('SELECT MIN(cost_per_piece) as m FROM cost_snapshots').get().m || 0;
    const maxCostPiece = db.prepare('SELECT MAX(cost_per_piece) as m FROM cost_snapshots').get().m || 0;

    res.json({
      total_models: totalModels,
      total_fabrics: totalFabrics,
      total_accessories: totalAccessories,
      avg_cost_per_piece: Math.round(avgCost * 100) / 100,
      total_pieces: totalPieces,
      total_cost: Math.round(totalCost * 100) / 100,
      min_cost_per_piece: Math.round(minCostPiece * 100) / 100,
      max_cost_per_piece: Math.round(maxCostPiece * 100) / 100,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/by-fabric — fabric usage across models
router.get('/by-fabric', (req, res) => {
  try {
    const { search, date_from, date_to } = req.query;
    let where = "m.status = 'active'";
    const p = [];
    if (search) { where += ' AND (f.code LIKE ? OR f.name LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    if (date_from) { where += ' AND m.created_at >= ?'; p.push(date_from); }
    if (date_to) { where += ' AND m.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    const rows = db.prepare(`
      SELECT f.code, f.name, f.fabric_type, f.price_per_m,
        COUNT(DISTINCT mf.model_id) as model_count,
        SUM(mf.meters_per_piece) as total_meters_per_piece,
        SUM(mf.meters_per_piece * ms_totals.total_pieces) as total_meters
      FROM model_fabrics mf
      JOIN fabrics f ON f.code = mf.fabric_code
      JOIN models m ON m.id = mf.model_id AND ${where}
      LEFT JOIN (
        SELECT model_id, SUM(qty_s + qty_m + qty_l + qty_xl + qty_2xl + qty_3xl) as total_pieces
        FROM model_sizes GROUP BY model_id
      ) ms_totals ON ms_totals.model_id = mf.model_id
      GROUP BY f.code
      ORDER BY total_meters DESC
    `).all(...p);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/by-accessory — accessory usage across models
router.get('/by-accessory', (req, res) => {
  try {
    const { search, date_from, date_to } = req.query;
    let where = "m.status = 'active'";
    const p = [];
    if (search) { where += ' AND (a.code LIKE ? OR a.name LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    if (date_from) { where += ' AND m.created_at >= ?'; p.push(date_from); }
    if (date_to) { where += ' AND m.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    const rows = db.prepare(`
      SELECT a.code, a.name, a.acc_type, a.unit_price,
        COUNT(DISTINCT ma.model_id) as model_count,
        SUM(ma.quantity) as total_quantity,
        SUM(ma.quantity * ma.unit_price) as total_cost
      FROM model_accessories ma
      JOIN accessories a ON a.code = ma.accessory_code
      JOIN models m ON m.id = ma.model_id AND ${where}
      GROUP BY a.code
      ORDER BY total_cost DESC
    `).all(...p);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/by-model — per-model cost breakdown
router.get('/by-model', (req, res) => {
  try {
    const { search, date_from, date_to } = req.query;
    let where = "m.status = 'active'";
    const p = [];
    if (search) { where += ' AND (m.model_code LIKE ? OR m.model_name LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    if (date_from) { where += ' AND m.created_at >= ?'; p.push(date_from); }
    if (date_to) { where += ' AND m.created_at <= ?'; p.push(date_to + 'T23:59:59'); }

    const rows = db.prepare(`
      SELECT m.model_code, m.model_name, m.serial_number, m.masnaiya, m.masrouf,
        m.consumer_price, m.wholesale_price, m.created_at,
        cs.total_pieces, cs.main_fabric_cost, cs.lining_cost,
        cs.accessories_cost, cs.total_cost, cs.cost_per_piece
      FROM models m
      LEFT JOIN (
        SELECT model_id, total_pieces, main_fabric_cost, lining_cost,
               accessories_cost, total_cost, cost_per_piece,
               MAX(snapshot_date) as latest
        FROM cost_snapshots GROUP BY model_id
      ) cs ON cs.model_id = m.id
      WHERE ${where}
      ORDER BY m.created_at DESC
    `).all(...p);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/costs — cost breakdown aggregates
router.get('/costs', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT m.model_code, m.model_name,
        cs.main_fabric_cost, cs.lining_cost, cs.accessories_cost,
        cs.masnaiya, cs.masrouf, cs.total_cost, cs.cost_per_piece,
        cs.total_pieces, cs.snapshot_date
      FROM cost_snapshots cs
      JOIN models m ON m.id = cs.model_id AND m.status = 'active'
      ORDER BY cs.snapshot_date DESC
    `).all();

    const totals = rows.reduce((acc, r) => ({
      main_fabric_cost: acc.main_fabric_cost + (r.main_fabric_cost || 0),
      lining_cost: acc.lining_cost + (r.lining_cost || 0),
      accessories_cost: acc.accessories_cost + (r.accessories_cost || 0),
      masnaiya: acc.masnaiya + (r.masnaiya || 0),
      masrouf: acc.masrouf + (r.masrouf || 0),
      total_cost: acc.total_cost + (r.total_cost || 0),
    }), { main_fabric_cost: 0, lining_cost: 0, accessories_cost: 0, masnaiya: 0, masrouf: 0, total_cost: 0 });

    res.json({ snapshots: rows, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
