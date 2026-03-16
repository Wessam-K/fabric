require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database');
const fabricsRouter = require('./routes/fabrics');
const accessoriesRouter = require('./routes/accessories');
const modelsRouter = require('./routes/models');
const costsRouter = require('./routes/costs');
const settingsRouter = require('./routes/settings');
const invoicesRouter = require('./routes/invoices');
const workordersRouter = require('./routes/workorders');
const suppliersRouter = require('./routes/suppliers');
const purchaseordersRouter = require('./routes/purchaseorders');

const app = express();
const PORT = process.env.PORT || 9002;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/fabrics', fabricsRouter);
app.use('/api/accessories', accessoriesRouter);
app.use('/api/models', modelsRouter);
app.use('/api/reports', costsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/workorders', workordersRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/purchaseorders', purchaseordersRouter);

// Dashboard
app.get('/api/dashboard', (req, res) => {
  try {
    const totalModels = db.prepare("SELECT COUNT(*) as c FROM models WHERE status='active'").get().c;
    const totalFabrics = db.prepare("SELECT COUNT(*) as c FROM fabrics WHERE status='active'").get().c;
    const totalAccessories = db.prepare("SELECT COUNT(*) as c FROM accessories WHERE status='active'").get().c;
    const avgCost = db.prepare('SELECT AVG(cost_per_piece) as avg FROM cost_snapshots').get().avg || 0;
    const totalInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices").get().c;

    // New KPIs
    const activeWorkOrders = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='in_progress'").get().c;
    const pendingPOs = db.prepare("SELECT COUNT(*) as c FROM purchase_orders WHERE status IN ('sent','partial')").get().c;
    const outstandingPayables = db.prepare(`SELECT
      COALESCE(SUM(po.total),0) - COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp),0) as balance
      FROM purchase_orders po WHERE po.status NOT IN ('cancelled','draft')`).get().balance || 0;
    const totalSuppliers = db.prepare("SELECT COUNT(*) as c FROM suppliers WHERE status='active'").get().c;

    const recentModels = db.prepare(`SELECT * FROM models WHERE status='active' ORDER BY created_at DESC LIMIT 5`).all();
    const recentWorkOrders = db.prepare(`SELECT wo.*, m.model_code, m.model_name, ps.name as stage_name, ps.color as stage_color
      FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id LEFT JOIN production_stages ps ON ps.id=wo.current_stage_id
      ORDER BY wo.created_at DESC LIMIT 5`).all();

    res.json({
      total_models: totalModels,
      total_fabrics: totalFabrics,
      total_accessories: totalAccessories,
      total_invoices: totalInvoices,
      avg_cost_per_piece: Math.round(avgCost * 100) / 100,
      active_work_orders: activeWorkOrders,
      pending_pos: pendingPOs,
      outstanding_payables: Math.round(outstandingPayables * 100) / 100,
      total_suppliers: totalSuppliers,
      recent_models: recentModels,
      recent_work_orders: recentWorkOrders,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Global search
app.get('/api/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ models: [], fabrics: [], accessories: [], invoices: [], suppliers: [], workOrders: [] });
    const like = `%${q}%`;

    const models = db.prepare(`SELECT model_code, model_name, serial_number FROM models WHERE status='active' AND (model_code LIKE ? OR model_name LIKE ? OR serial_number LIKE ?) LIMIT 8`).all(like, like, like);
    const fabrics = db.prepare(`SELECT code, name, fabric_type, price_per_m FROM fabrics WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT 8`).all(like, like);
    const accessories = db.prepare(`SELECT code, name, acc_type, unit_price FROM accessories WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT 8`).all(like, like);
    const invoices = db.prepare(`SELECT id, invoice_number, customer_name, total, status FROM invoices WHERE invoice_number LIKE ? OR customer_name LIKE ? LIMIT 8`).all(like, like);
    const suppliers = db.prepare(`SELECT id, code, name, type FROM suppliers WHERE status='active' AND (code LIKE ? OR name LIKE ? OR contact_person LIKE ?) LIMIT 8`).all(like, like, like);
    const workOrders = db.prepare(`SELECT wo.id, wo.wo_number, wo.status, m.model_code FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id WHERE wo.wo_number LIKE ? OR m.model_code LIKE ? LIMIT 8`).all(like, like);

    res.json({ models, fabrics, accessories, invoices, suppliers, workOrders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve built frontend in production (Electron)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`WK-Hub Factory API running on http://localhost:${PORT}`);
});
