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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/fabrics', fabricsRouter);
app.use('/api/accessories', accessoriesRouter);
app.use('/api/models', modelsRouter);
app.use('/api/reports', costsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/invoices', invoicesRouter);

// Dashboard
app.get('/api/dashboard', (req, res) => {
  try {
    const totalModels = db.prepare("SELECT COUNT(*) as c FROM models WHERE status='active'").get().c;
    const totalFabrics = db.prepare("SELECT COUNT(*) as c FROM fabrics WHERE status='active'").get().c;
    const totalAccessories = db.prepare("SELECT COUNT(*) as c FROM accessories WHERE status='active'").get().c;
    const avgCost = db.prepare('SELECT AVG(cost_per_piece) as avg FROM cost_snapshots').get().avg || 0;
    const totalInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices").get().c;

    const recentModels = db.prepare(`SELECT * FROM models WHERE status='active' ORDER BY created_at DESC LIMIT 10`).all();

    res.json({
      total_models: totalModels,
      total_fabrics: totalFabrics,
      total_accessories: totalAccessories,
      total_invoices: totalInvoices,
      avg_cost_per_piece: Math.round(avgCost * 100) / 100,
      recent_models: recentModels,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Global search
app.get('/api/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ models: [], fabrics: [], accessories: [], invoices: [] });
    const like = `%${q}%`;

    const models = db.prepare(`SELECT model_code, model_name, serial_number FROM models WHERE status='active' AND (model_code LIKE ? OR model_name LIKE ? OR serial_number LIKE ?) LIMIT 8`).all(like, like, like);
    const fabrics = db.prepare(`SELECT code, name, fabric_type, price_per_m FROM fabrics WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT 8`).all(like, like);
    const accessories = db.prepare(`SELECT code, name, acc_type, unit_price FROM accessories WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT 8`).all(like, like);
    const invoices = db.prepare(`SELECT id, invoice_number, customer_name, total, status FROM invoices WHERE invoice_number LIKE ? OR customer_name LIKE ? LIMIT 8`).all(like, like);

    res.json({ models, fabrics, accessories, invoices });
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
