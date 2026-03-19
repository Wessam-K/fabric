require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const db = require('./database');
const { requireAuth, logAudit } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const hrRouter = require('./routes/hr');
const auditRouter = require('./routes/auditlog');
const fabricsRouter = require('./routes/fabrics');
const accessoriesRouter = require('./routes/accessories');
const modelsRouter = require('./routes/models');
const reportsRouter = require('./routes/reports');
const settingsRouter = require('./routes/settings');
const invoicesRouter = require('./routes/invoices');
const workordersRouter = require('./routes/workorders');
const suppliersRouter = require('./routes/suppliers');
const purchaseordersRouter = require('./routes/purchaseorders');
const stageTemplatesRouter = require('./routes/stagetemplates');
const inventoryRouter = require('./routes/inventory');
const permissionsRouter = require('./routes/permissions');
const customersRouter = require('./routes/customers');
const notificationsRouter = require('./routes/notifications');
const machinesRouter = require('./routes/machines');

const app = express();
const PORT = process.env.PORT || 9002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ═══ Security headers ═══
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ═══ Simple rate limiter for auth endpoints ═══
const loginAttempts = new Map();
const RATE_WINDOW = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 20;
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of loginAttempts) {
    if (now - data.start > RATE_WINDOW) loginAttempts.delete(ip);
  }
}, 60000);

app.use('/api/auth/login', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry || (now - entry.start > RATE_WINDOW)) {
    entry = { count: 0, start: now };
    loginAttempts.set(ip, entry);
  }
  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'عدد المحاولات تجاوز الحد المسموح. حاول مرة أخرى بعد 15 دقيقة' });
  }
  next();
});

// ═══ Public routes (no auth) ═══
app.use('/api/auth', authRouter);

// Setup status (public)
app.get('/api/setup/status', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    res.json({ needs_setup: count === 0 });
  } catch (err) { res.json({ needs_setup: true }); }
});

app.post('/api/setup/create-admin', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    if (count > 0) return res.status(403).json({ error: 'تم إكمال الإعداد بالفعل' });
    const { username, full_name, password } = req.body;
    if (!username || !full_name || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare('INSERT INTO users (username, full_name, password_hash, role, status) VALUES (?,?,?,?,?)')
      .run(username, full_name, hash, 'superadmin', 'active');
    res.json({ message: 'تم إنشاء حساب مدير النظام', user_id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ Protected routes ═══
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/hr', requireAuth, hrRouter);
app.use('/api/audit-log', requireAuth, auditRouter);
app.use('/api/fabrics', requireAuth, fabricsRouter);
app.use('/api/accessories', requireAuth, accessoriesRouter);
app.use('/api/models', requireAuth, modelsRouter);
app.use('/api/reports', requireAuth, reportsRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/invoices', requireAuth, invoicesRouter);
app.use('/api/work-orders', requireAuth, workordersRouter);
app.use('/api/suppliers', requireAuth, suppliersRouter);
app.use('/api/purchase-orders', requireAuth, purchaseordersRouter);
app.use('/api/stage-templates', requireAuth, stageTemplatesRouter);
app.use('/api/inventory', requireAuth, inventoryRouter);
app.use('/api/permissions', requireAuth, permissionsRouter);
app.use('/api/customers', requireAuth, customersRouter);
app.use('/api/notifications', requireAuth, notificationsRouter);
app.use('/api/machines', requireAuth, machinesRouter);

// Dashboard
app.get('/api/dashboard', requireAuth, (req, res) => {
  try {
    const totalModels = db.prepare("SELECT COUNT(*) as c FROM models WHERE status='active'").get().c;
    const totalFabrics = db.prepare("SELECT COUNT(*) as c FROM fabrics WHERE status='active'").get().c;
    const totalAccessories = db.prepare("SELECT COUNT(*) as c FROM accessories WHERE status='active'").get().c;
    const totalInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices").get().c;
    const activeWorkOrders = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='in_progress'").get().c;
    const completedThisMonth = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed' AND completed_date >= date('now','start of month')").get().c;
    const urgentOrders = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE priority='urgent' AND status NOT IN ('completed','cancelled')").get().c;
    const pendingInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE status IN ('draft','sent','overdue')").get().c;
    const outstandingPayables = db.prepare(`SELECT COALESCE(SUM(total_amount - paid_amount), 0) as b FROM purchase_orders WHERE status NOT IN ('cancelled','draft')`).get().b || 0;
    const totalSuppliers = db.prepare("SELECT COUNT(*) as c FROM suppliers WHERE status='active'").get().c;

    const recentWorkOrders = db.prepare(`
      SELECT wo.*, m.model_code, m.model_name,
        (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id AND status='completed') as stages_done,
        (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id) as stages_total
      FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id
      ORDER BY wo.created_at DESC LIMIT 5`).all();

    const recentPOs = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id
      ORDER BY po.created_at DESC LIMIT 5`).all();

    // V9 — production pipeline
    const productionPipeline = db.prepare(`
      SELECT ws.stage_name, SUM(ws.quantity_in_stage) as pieces_in_stage,
        COUNT(DISTINCT ws.wo_id) as wo_count
      FROM wo_stages ws
      JOIN work_orders wo ON wo.id = ws.wo_id
      WHERE wo.status = 'in_progress' AND ws.status = 'in_progress'
      GROUP BY ws.stage_name
      ORDER BY SUM(ws.quantity_in_stage) DESC
    `).all();

    // V9 — low stock alerts
    const lowStockFabrics = db.prepare(`SELECT COUNT(*) as c FROM fabrics WHERE status='active' AND available_meters < low_stock_threshold AND low_stock_threshold > 0`).get().c;
    const lowStockAccessories = db.prepare(`SELECT COUNT(*) as c FROM accessories WHERE status='active' AND quantity_on_hand < low_stock_threshold AND low_stock_threshold > 0`).get().c;
    const overdueWorkOrders = db.prepare(`SELECT COUNT(*) as c FROM work_orders WHERE due_date < date('now') AND status NOT IN ('completed','cancelled')`).get().c;

    // V9 — monthly financials
    const monthlyRevenue = db.prepare(`SELECT COALESCE(SUM(total),0) as r FROM invoices WHERE status='paid' AND created_at >= date('now','start of month')`).get().r;
    const monthlyCost = db.prepare(`SELECT COALESCE(SUM(total_production_cost),0) as c FROM work_orders WHERE status='completed' AND completed_date >= date('now','start of month')`).get().c;

    // V10 — machines utilization
    const totalMachines = db.prepare("SELECT COUNT(*) as c FROM machines WHERE status='active'").get().c;
    const machinesInUse = db.prepare(`SELECT COUNT(DISTINCT machine_id) as c FROM wo_stages WHERE status='in_progress' AND machine_id IS NOT NULL`).get().c;

    // V10 — customer outstanding
    const totalCustomers = db.prepare("SELECT COUNT(*) as c FROM customers WHERE status='active'").get().c;
    const customerOutstanding = db.prepare(`SELECT COALESCE(SUM(total),0) - COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END),0) as v FROM invoices WHERE customer_id IS NOT NULL`).get().v;

    // V10 — overall quality (rejection rate)
    const totalPassed = db.prepare(`SELECT COALESCE(SUM(quantity_completed),0) as v FROM wo_stages`).get().v;
    const totalRejected = db.prepare(`SELECT COALESCE(SUM(quantity_rejected),0) as v FROM wo_stages`).get().v;
    const qualityRate = (totalPassed + totalRejected) > 0 ? Math.round((totalPassed / (totalPassed + totalRejected)) * 10000) / 100 : 100;

    res.json({
      total_models: totalModels, total_fabrics: totalFabrics, total_accessories: totalAccessories,
      total_invoices: totalInvoices, active_work_orders: activeWorkOrders,
      completed_this_month: completedThisMonth, urgent_orders: urgentOrders,
      pending_invoices: pendingInvoices, outstanding_payables: Math.round(outstandingPayables * 100) / 100,
      total_suppliers: totalSuppliers,
      recent_work_orders: recentWorkOrders, recent_pos: recentPOs,
      production_pipeline: productionPipeline,
      low_stock_fabrics: lowStockFabrics,
      low_stock_accessories: lowStockAccessories,
      overdue_work_orders: overdueWorkOrders,
      monthly_revenue: Math.round(monthlyRevenue * 100) / 100,
      monthly_cost: Math.round(monthlyCost * 100) / 100,
      total_machines: totalMachines,
      machines_in_use: machinesInUse,
      total_customers: totalCustomers,
      customer_outstanding: Math.round(customerOutstanding * 100) / 100,
      quality_rate: qualityRate,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Global search
app.get('/api/search', requireAuth, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ models: [], fabrics: [], accessories: [], invoices: [], suppliers: [], workOrders: [], purchaseOrders: [] });
    const like = `%${q}%`;
    const models = db.prepare(`SELECT model_code, model_name, serial_number, category FROM models WHERE status='active' AND (model_code LIKE ? OR model_name LIKE ? OR serial_number LIKE ?) LIMIT 8`).all(like, like, like);
    const fabrics = db.prepare(`SELECT code, name, fabric_type, price_per_m FROM fabrics WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT 8`).all(like, like);
    const accessories = db.prepare(`SELECT code, name, acc_type, unit_price FROM accessories WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT 8`).all(like, like);
    const invoices = db.prepare(`SELECT id, invoice_number, customer_name, total, status FROM invoices WHERE invoice_number LIKE ? OR customer_name LIKE ? LIMIT 8`).all(like, like);
    const suppliers = db.prepare(`SELECT id, code, name, supplier_type FROM suppliers WHERE status='active' AND (code LIKE ? OR name LIKE ? OR contact_name LIKE ?) LIMIT 8`).all(like, like, like);
    const workOrders = db.prepare(`SELECT wo.id, wo.wo_number, wo.status, wo.priority, wo.assigned_to, m.model_code, m.model_name FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id WHERE wo.wo_number LIKE ? OR m.model_code LIKE ? OR m.model_name LIKE ? OR wo.assigned_to LIKE ? LIMIT 8`).all(like, like, like, like);
    const purchaseOrders = db.prepare(`SELECT po.id, po.po_number, po.status, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.po_number LIKE ? OR s.name LIKE ? LIMIT 8`).all(like, like);
    const customers = db.prepare(`SELECT id, code, name, phone, city FROM customers WHERE status='active' AND (code LIKE ? OR name LIKE ? OR phone LIKE ?) LIMIT 8`).all(like, like, like);
    res.json({ models, fabrics, accessories, invoices, suppliers, workOrders, purchaseOrders, customers });
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
  console.log(`WK-Hub Factory API v9 running on http://localhost:${PORT}`);
  // Run notification generation on startup and every 5 minutes
  try { notificationsRouter.generateNotifications(); } catch (e) { console.error('Initial notification gen failed:', e.message); }
  setInterval(() => { try { notificationsRouter.generateNotifications(); } catch (e) { console.error('Notification gen failed:', e.message); } }, 5 * 60 * 1000);
});
