require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');

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
const accountingRouter = require('./routes/accounting');
const expensesRouter = require('./routes/expenses');
const maintenanceRouter = require('./routes/maintenance');
const barcodeRouter = require('./routes/barcode');
const mrpRouter = require('./routes/mrp');
const shippingRouter = require('./routes/shipping');
const schedulingRouter = require('./routes/scheduling');
const qualityRouter = require('./routes/quality');
const quotationsRouter = require('./routes/quotations');
const samplesRouter = require('./routes/samples');
const returnsRouter = require('./routes/returns');
const documentsRouter = require('./routes/documents');
const backupsRouter = require('./routes/backups');
const autojournalRouter = require('./routes/autojournal');

const app = express();
const PORT = process.env.PORT || 9002;

app.use(helmet({
  contentSecurityPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
if (process.env.NODE_ENV !== 'test') app.use(morgan('short'));
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:9173', 'http://localhost:9174', 'app://.'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ═══ Input sanitization — strip HTML tags from string fields ═══
function stripTags(str) {
  return typeof str === 'string' ? str.replace(/<[^>]*>?/g, '') : str;
}
function sanitizeBody(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeBody);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? stripTags(v) : typeof v === 'object' ? sanitizeBody(v) : v;
  }
  return out;
}
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = sanitizeBody(req.body);
  next();
});

app.use('/uploads', requireAuth, express.static(path.join(__dirname, 'uploads')));

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

// ═══ Health check (public, no auth) ═══
app.get('/api/health', (req, res) => {
  let dbStatus = 'ok', dbVersion = null, userCount = null;
  try {
    const ver = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get();
    dbVersion = ver?.v;
    userCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get().c;
  } catch (e) { dbStatus = 'error: ' + e.message; }
  res.json({
    status: 'ok', app: 'WK-Hub', version: 'v20-enterprise',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    database: { status: dbStatus, schema_version: dbVersion, active_users: userCount },
    node_version: process.version,
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
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
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل مع حرف كبير ورقم' });
    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare('INSERT INTO users (username, full_name, password_hash, role, status) VALUES (?,?,?,?,?)')
      .run(username, full_name, hash, 'superadmin', 'active');
    res.json({ message: 'تم إنشاء حساب مدير النظام', user_id: result.lastInsertRowid });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب' }); }
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
app.use('/api/accounting', requireAuth, accountingRouter);
app.use('/api/expenses', requireAuth, expensesRouter);
app.use('/api/maintenance', requireAuth, maintenanceRouter);
app.use('/api/barcode', requireAuth, barcodeRouter);
app.use('/api/mrp', requireAuth, mrpRouter);
app.use('/api/shipping', requireAuth, shippingRouter);
app.use('/api/scheduling', requireAuth, schedulingRouter);
app.use('/api/quality', requireAuth, qualityRouter);
app.use('/api/quotations', requireAuth, quotationsRouter);
app.use('/api/samples', requireAuth, samplesRouter);
app.use('/api/returns', requireAuth, returnsRouter);
app.use('/api/documents', requireAuth, documentsRouter);
app.use('/api/backups', requireAuth, backupsRouter);
app.use('/api/auto-journal', requireAuth, autojournalRouter);

// Dashboard
app.get('/api/dashboard', requireAuth, (req, res) => {
  try {
    // Get configurable limits from settings
    const dashboardListLimit = parseInt(db.prepare("SELECT value FROM settings WHERE key='dashboard_list_limit'").get()?.value) || 5;
    const dashboardMachineLimit = parseInt(db.prepare("SELECT value FROM settings WHERE key='dashboard_machine_limit'").get()?.value) || 30;
    
    const totalModels = db.prepare("SELECT COUNT(*) as c FROM models WHERE status='active'").get().c;
    const totalFabrics = db.prepare("SELECT COUNT(*) as c FROM fabrics WHERE status='active'").get().c;
    const totalAccessories = db.prepare("SELECT COUNT(*) as c FROM accessories WHERE status='active'").get().c;
    const totalInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices").get().c;
    const activeWorkOrders = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='in_progress'").get().c;
    const completedThisMonth = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed' AND completed_date >= date('now','start of month')").get().c;
    const urgentOrders = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE priority='urgent' AND status NOT IN ('completed','cancelled')").get().c;
    const pendingInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE status IN ('draft','sent','overdue')").get().c;
    const outstandingPayables = db.prepare(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as b FROM purchase_orders WHERE status NOT IN ('cancelled','draft')`).get().b || 0;
    const totalSuppliers = db.prepare("SELECT COUNT(*) as c FROM suppliers WHERE status='active'").get().c;

    const recentWorkOrders = db.prepare(`
      SELECT wo.*, m.model_code, m.model_name,
        (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id AND status='completed') as stages_done,
        (SELECT COUNT(*) FROM wo_stages WHERE wo_id=wo.id) as stages_total
      FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id
      ORDER BY wo.created_at DESC LIMIT ?`).all(dashboardListLimit);

    const recentPOs = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id
      ORDER BY po.created_at DESC LIMIT ?`).all(dashboardListLimit);

    // V9 — production pipeline (WO status counts for dashboard chart)
    const pipelineRows = db.prepare(`SELECT status, COUNT(*) as count FROM work_orders WHERE status NOT IN ('cancelled') GROUP BY status`).all();
    const productionPipeline = { draft: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    try {
      const cancelledCount = db.prepare(`SELECT COUNT(*) as c FROM work_orders WHERE status='cancelled'`).get().c;
      productionPipeline.cancelled = cancelledCount;
    } catch (e) { console.error('dashboard cancelled count:', e.message); }
    pipelineRows.forEach(r => { if (productionPipeline.hasOwnProperty(r.status)) productionPipeline[r.status] = r.count; });

    // V9 — low stock alerts (return arrays for frontend iteration)
    const lowStockFabrics = db.prepare(`SELECT code, name, available_meters, low_stock_threshold FROM fabrics WHERE status='active' AND available_meters < COALESCE(low_stock_threshold, 10) AND COALESCE(low_stock_threshold, 10) > 0`).all();
    const lowStockAccessories = db.prepare(`SELECT code, name, quantity_on_hand, unit, low_stock_threshold FROM accessories WHERE status='active' AND quantity_on_hand < COALESCE(low_stock_threshold, 10) AND COALESCE(low_stock_threshold, 10) > 0`).all();
    const overdueWorkOrdersCount = db.prepare(`SELECT COUNT(*) as c FROM work_orders WHERE due_date < date('now') AND status NOT IN ('completed','cancelled')`).get().c;

    // Recent models
    const recentModels = db.prepare(`SELECT model_code, model_name, model_image, category, created_at FROM models WHERE status='active' ORDER BY created_at DESC LIMIT ?`).all(dashboardListLimit);

    // V9 — monthly financials
    const monthlyRevenue = db.prepare(`SELECT COALESCE(SUM(total),0) as r FROM invoices WHERE status='paid' AND created_at >= date('now','start of month')`).get().r;
    const monthlyCost = db.prepare(`SELECT COALESCE(SUM(total_production_cost),0) as c FROM work_orders WHERE status='completed' AND completed_date >= date('now','start of month')`).get().c;

    // V10 — machines utilization
    const totalMachines = db.prepare("SELECT COUNT(*) as c FROM machines WHERE status='active'").get().c;
    const machinesInUse = db.prepare(`SELECT COUNT(DISTINCT machine_id) as c FROM wo_stages WHERE status='in_progress' AND machine_id IS NOT NULL`).get().c;

    // V10 — customer outstanding
    const totalCustomers = db.prepare("SELECT COUNT(*) as c FROM customers WHERE status='active'").get().c;
    const customerOutstanding = db.prepare(`SELECT COALESCE(SUM(total),0) - COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END),0) as v FROM invoices WHERE customer_id IS NOT NULL AND status NOT IN ('cancelled','draft')`).get().v;

    // V10 — overall quality (rejection rate)
    const totalPassed = db.prepare(`SELECT COALESCE(SUM(quantity_completed),0) as v FROM wo_stages`).get().v;
    const totalRejected = db.prepare(`SELECT COALESCE(SUM(quantity_rejected),0) as v FROM wo_stages`).get().v;
    const qualityRate = (totalPassed + totalRejected) > 0 ? Math.round((totalPassed / (totalPassed + totalRejected)) * 10000) / 100 : 100;

    // V11 — top models by production volume
    let topModels = [];
    try {
      topModels = db.prepare(`SELECT model_code, model_name, total_wo, completed_wo, total_quantity, total_pieces_completed, avg_cost_per_piece
        FROM model_production_summary ORDER BY total_wo DESC LIMIT ?`).all(dashboardListLimit);
    } catch (e) { console.error('dashboard topModels:', e.message); }

    // V11 — stage bottleneck detection (stages with most WIP)
    let stageBottlenecks = [];
    try {
      stageBottlenecks = db.prepare(`SELECT ws.stage_name, SUM(ws.quantity_in_stage) as total_wip, COUNT(DISTINCT ws.wo_id) as wo_count,
        AVG(JULIANDAY('now') - JULIANDAY(ws.started_at)) as avg_days_in_stage
        FROM wo_stages ws JOIN work_orders wo ON wo.id=ws.wo_id
        WHERE wo.status='in_progress' AND ws.status='in_progress' AND ws.quantity_in_stage > 0
        GROUP BY ws.stage_name ORDER BY total_wip DESC LIMIT ?`).all(dashboardListLimit);
    } catch (e) { console.error('dashboard stageBottlenecks:', e.message); }

    // V17 — Machine status board
    let machineStatusBoard = [];
    try {
      machineStatusBoard = db.prepare(`SELECT id, code, name, status, location, machine_type FROM machines ORDER BY sort_order, name LIMIT ?`).all(dashboardMachineLimit);
    } catch (e) { console.error('dashboard machineStatusBoard:', e.message); }

    // V18 — Today's summary
    const today = new Date().toISOString().slice(0, 10);
    let todaySummary = {};
    try {
      const todayAttendance = db.prepare("SELECT COUNT(*) as c FROM attendance WHERE work_date=? AND attendance_status != 'absent'").get(today)?.c || 0;
      const todayDeliveries = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed' AND completed_date=?").get(today)?.c || 0;
      const dueTodayWO = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE due_date=? AND status NOT IN ('completed','cancelled')").get(today)?.c || 0;
      const todayExpenses = db.prepare("SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE is_deleted=0 AND expense_date=?").get(today)?.v || 0;
      const todayInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE DATE(created_at)=?").get(today)?.c || 0;
      todaySummary = { attendance: todayAttendance, deliveries: todayDeliveries, due_today: dueTodayWO, expenses: Math.round(todayExpenses * 100) / 100, invoices: todayInvoices };
    } catch (e) { console.error('dashboard todaySummary:', e.message); todaySummary = { attendance: 0, deliveries: 0, due_today: 0, expenses: 0, invoices: 0 }; }

    // V18 — Overdue invoices
    let overdueInvoicesList = [];
    try {
      overdueInvoicesList = db.prepare(`SELECT id, invoice_number, customer_name, total, due_date FROM invoices WHERE status='overdue' ORDER BY due_date ASC LIMIT ?`).all(dashboardListLimit);
    } catch (e) { console.error('dashboard overdueInvoices:', e.message); }

    // V18 — Overdue work orders list (detailed)
    let overdueWOList = [];
    try {
      overdueWOList = db.prepare(`SELECT wo.id, wo.wo_number, wo.due_date, wo.status, m.model_code, m.model_name
        FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id
        WHERE wo.due_date < date('now') AND wo.status NOT IN ('completed','cancelled')
        ORDER BY wo.due_date ASC LIMIT ?`).all(dashboardListLimit);
    } catch (e) { console.error('dashboard overdueWOList:', e.message); }

    res.json({
      total_models: totalModels, total_fabrics: totalFabrics, total_accessories: totalAccessories,
      total_invoices: totalInvoices, active_work_orders: activeWorkOrders,
      completed_this_month: completedThisMonth, urgent_orders: urgentOrders,
      pending_invoices: pendingInvoices, outstanding_payables: Math.round(outstandingPayables * 100) / 100,
      total_suppliers: totalSuppliers,
      recent_work_orders: recentWorkOrders, recent_pos: recentPOs,
      recent_models: recentModels,
      production_pipeline: productionPipeline,
      low_stock_fabrics: lowStockFabrics,
      low_stock_accessories: lowStockAccessories,
      overdue_work_orders_count: overdueWorkOrdersCount,
      monthly_revenue: Math.round(monthlyRevenue * 100) / 100,
      monthly_cost: Math.round(monthlyCost * 100) / 100,
      total_machines: totalMachines,
      machines_in_use: machinesInUse,
      total_customers: totalCustomers,
      customer_outstanding: Math.round(customerOutstanding * 100) / 100,
      quality_rate: qualityRate,
      top_models: topModels,
      stage_bottlenecks: stageBottlenecks,
      total_expenses_this_month: (() => { try { return db.prepare("SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE is_deleted=0 AND status='approved' AND expense_date >= date('now','start of month')").get().v; } catch { return 0; } })(),
      pending_maintenance_count: (() => { try { return db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE is_deleted=0 AND status='pending'").get().c; } catch { return 0; } })(),
      critical_maintenance_count: (() => { try { return db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE is_deleted=0 AND priority='critical' AND status NOT IN ('completed','cancelled')").get().c; } catch { return 0; } })(),
      machine_status_board: machineStatusBoard,
      today_summary: todaySummary,
      overdue_invoices: overdueInvoicesList,
      overdue_work_orders: overdueWOList,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// Global search
app.get('/api/search', requireAuth, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ models: [], fabrics: [], accessories: [], invoices: [], suppliers: [], workOrders: [], purchaseOrders: [] });
    const searchLimit = parseInt(db.prepare("SELECT value FROM settings WHERE key='search_results_limit'").get()?.value) || 8;
    const like = `%${q}%`;
    const models = db.prepare(`SELECT model_code, model_name, serial_number, category FROM models WHERE status='active' AND (model_code LIKE ? OR model_name LIKE ? OR serial_number LIKE ?) LIMIT ?`).all(like, like, like, searchLimit);
    const fabrics = db.prepare(`SELECT code, name, fabric_type, price_per_m FROM fabrics WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT ?`).all(like, like, searchLimit);
    const accessories = db.prepare(`SELECT code, name, acc_type, unit_price FROM accessories WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT ?`).all(like, like, searchLimit);
    const invoices = db.prepare(`SELECT id, invoice_number, customer_name, total, status FROM invoices WHERE invoice_number LIKE ? OR customer_name LIKE ? LIMIT ?`).all(like, like, searchLimit);
    const suppliers = db.prepare(`SELECT id, code, name, supplier_type FROM suppliers WHERE status='active' AND (code LIKE ? OR name LIKE ? OR contact_name LIKE ?) LIMIT ?`).all(like, like, like, searchLimit);
    const workOrders = db.prepare(`SELECT wo.id, wo.wo_number, wo.status, wo.priority, wo.assigned_to, m.model_code, m.model_name FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id WHERE wo.wo_number LIKE ? OR m.model_code LIKE ? OR m.model_name LIKE ? OR wo.assigned_to LIKE ? LIMIT ?`).all(like, like, like, like, searchLimit);
    const purchaseOrders = db.prepare(`SELECT po.id, po.po_number, po.status, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.po_number LIKE ? OR s.name LIKE ? LIMIT ?`).all(like, like, searchLimit);
    const customers = db.prepare(`SELECT id, code, name, phone, city FROM customers WHERE status='active' AND (code LIKE ? OR name LIKE ? OR phone LIKE ?) LIMIT ?`).all(like, like, like, searchLimit);
    let maintenanceOrders = [], expensesResults = [];
    let machines = [];
    try {
      machines = db.prepare(`SELECT id, code, name, barcode, machine_type, status FROM machines WHERE status != 'inactive' AND (code LIKE ? OR name LIKE ? OR barcode LIKE ?) LIMIT ?`).all(like, like, like, searchLimit);
    } catch (e) { console.error('search machines:', e.message); }
    try {
      maintenanceOrders = db.prepare(`SELECT mo.id, mo.barcode, mo.title, mo.status, mo.priority, m.name as machine_name FROM maintenance_orders mo LEFT JOIN machines m ON m.id=mo.machine_id WHERE mo.is_deleted=0 AND (mo.title LIKE ? OR mo.barcode LIKE ? OR m.name LIKE ?) LIMIT ?`).all(like, like, like, searchLimit);
      expensesResults = db.prepare(`SELECT id, description, amount, expense_type, status, expense_date FROM expenses WHERE is_deleted=0 AND (description LIKE ? OR expense_type LIKE ?) LIMIT ?`).all(like, like, searchLimit);
    } catch (e) { console.error('search maintenance/expenses:', e.message); }
    res.json({ models, fabrics, accessories, invoices, suppliers, workOrders, purchaseOrders, customers, maintenanceOrders, expenses: expensesResults, machines });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// Serve built frontend in production (Electron)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ═══ Global error handler ═══
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.stack || err.message || err);
  res.status(err.status || 500).json({ error: 'خطأ داخلي في الخادم' });
});

const server = app.listen(PORT, () => {
  console.log(`WK-Hub Factory API v20-enterprise running on http://localhost:${PORT}`);
  // Run notification generation on startup and every 5 minutes
  try { notificationsRouter.generateNotifications(); } catch (e) { console.error('Initial notification gen failed:', e.message); }
  setInterval(() => { try { notificationsRouter.generateNotifications(); } catch (e) { console.error('Notification gen failed:', e.message); } }, 5 * 60 * 1000);
});

// ═══ Graceful shutdown ═══
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully`);
  server.close(() => {
    try { db.close(); } catch (e) { /* already closed */ }
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => { process.exit(1); }, 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
