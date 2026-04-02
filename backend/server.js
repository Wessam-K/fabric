require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const db = require('./database');
const { requireAuth, requirePermission, canUser, logAudit } = require('./middleware/auth');
const { apiKeyAuth } = require('./middleware/apiKey'); // Phase 3.5
const { csrfProtection } = require('./middleware/csrf'); // Phase 1.1: CSRF
const { contentTypeEnforcement } = require('./middleware/contentType'); // Phase 1.2: Content-Type enforcement
const logger = require('./utils/logger'); // Phase 6.1: Structured logging
const { migrate } = require('./migrate'); // Phase 2.1: Migration runner
const { LicenseManager } = require('./lib/license'); // Phase 5.1: Licensing
const { initWebSocket, broadcast, getClientCount } = require('./utils/websocket'); // Phase 3.7: WebSocket

// Phase 5.3: Sentry error tracking (optional — only if DSN configured)
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `wk-factory@${require('./package.json').version}`,
    tracesSampleRate: 0.2,
  });
}

// Phase 2.1: Run pending migrations on startup
try {
  const result = migrate(db);
  if (result.applied > 0) logger.info('Migrations applied', result);
} catch (err) {
  logger.error('Migration failed', { error: err.message });
}

// Phase 5.1: Initialize license manager
const licenseManager = new LicenseManager(db);
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
const exportsRouter = require('./routes/exports');

const app = express();
const PORT = process.env.PORT || 9002;

const isElectron = process.env.ELECTRON_APP === '1';

app.use((req, res, next) => {
  if (!isElectron) {
    // Generate per-request nonce for CSP
    req.cspNonce = crypto.randomBytes(16).toString('base64');
  }
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isElectron
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
        : ["'self'", (req, res) => `'nonce-${req.cspNonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
if (process.env.NODE_ENV !== 'test') {
  morgan.token('request-id', (req) => req.requestId || '-');
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms [:request-id]'));
}
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:9173', 'http://localhost:9174', `http://localhost:${PORT}`, 'app://.'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
// Phase 1.2: Parse cookies for httpOnly JWT auth
app.use(require('cookie-parser')());
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));

// ═══ D3: Request ID tracing — every request gets a unique ID ═══
const crypto = require('crypto');
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// ═══ Response caching — safe Cache-Control for GET endpoints ═══
app.use((req, res, next) => {
  if (req.method === 'GET') {
    // Default short cache (private, 60s) — individual routes can override
    res.setHeader('Cache-Control', 'private, max-age=60');
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// ═══ D4: Input field length limits — prevent excessively long text fields ═══
const MAX_FIELD_LENGTH = 10000;
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const checkLengths = (obj) => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && v.length > MAX_FIELD_LENGTH) {
          return k;
        }
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const bad = checkLengths(v);
          if (bad) return bad;
        }
      }
      return null;
    };
    const badField = checkLengths(req.body);
    if (badField) return res.status(400).json({ error: `الحقل ${badField} يتجاوز الحد الأقصى المسموح (${MAX_FIELD_LENGTH} حرف)` });
  }
  next();
});

// ═══ Input sanitization — strip HTML tags from string fields ═══
function stripTags(str) {
  if (typeof str !== 'string') return str;
  // Multi-pass to handle nested/malformed tags like <<script>
  let prev;
  do { prev = str; str = str.replace(/<[^>]*>?/g, ''); } while (str !== prev);
  return str;
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
  // Sanitize query parameters too (H10)
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') req.query[k] = stripTags(v);
    }
  }
  next();
});

// ── Upload directory: use WK_DB_DIR (userData) in production, local in dev ──
const UPLOADS_DIR = path.join(process.env.WK_DB_DIR || __dirname, 'uploads');
const fsMod = require('fs');
if (!fsMod.existsSync(UPLOADS_DIR)) fsMod.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use('/uploads', requireAuth, express.static(UPLOADS_DIR));

// ═══ Pagination ceiling — prevent DoS via huge limit values ═══
const MAX_PAGE_SIZE = 500;
app.use((req, res, next) => {
  if (req.query.limit) {
    const parsed = parseInt(req.query.limit);
    req.query.limit = String(Math.min(Math.max(parsed || 50, 1), MAX_PAGE_SIZE));
  }
  next();
});

// ═══ Phase 1.6: Global + targeted rate limiting (express-rate-limit) ═══
const rateLimit = require('express-rate-limit');

// Global API rate limit: 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'عدد الطلبات تجاوز الحد المسموح. حاول مرة أخرى بعد قليل' },
  skip: (req) => process.env.NODE_ENV === 'test',
});
app.use('/api', globalLimiter);

// Strict auth rate limit: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'عدد المحاولات تجاوز الحد المسموح. حاول مرة أخرى بعد 15 دقيقة' },
  skip: (req) => process.env.NODE_ENV === 'test',
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/change-password', authLimiter);
app.use('/api/setup/create-admin', authLimiter);

// Phase 3.5: API key auth — runs before requireAuth, sets req.user if valid key
app.use('/api', apiKeyAuth);
app.use('/api/v1', apiKeyAuth);

// Phase 1.1: CSRF protection (after cookie-parser, before routes)
app.use('/api', csrfProtection);

// Phase 1.2: Content-Type enforcement (JSON required on POST/PUT/PATCH)
app.use('/api', contentTypeEnforcement);

// ═══ Health check (public, no auth) ═══
app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  let dbStatus = 'ok';
  try {
    db.prepare('SELECT 1').get();
  } catch (e) { dbStatus = 'error'; }
  res.json({ status: 'ok', app: 'WK-Factory', database: dbStatus });
});

// ═══ Readiness check (public, no auth) ═══
app.get('/api/readiness', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  const checks = { database: false, tables: false };
  try {
    db.prepare('SELECT 1').get();
    checks.database = true;
    const tableCount = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").get().c;
    checks.tables = tableCount > 0;
  } catch {}
  const ready = checks.database && checks.tables;
  res.status(ready ? 200 : 503).json({ ready, checks });
});

// Phase 3.4: Swagger API documentation (public)
try {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./swagger');
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'WK-Factory API Docs',
  }));
  app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
} catch (e) { logger.warn('Swagger UI not available', { error: e.message }); }

// Phase 5.1: License status endpoint
app.get('/api/license/status', requireAuth, (req, res) => {
  try {
    res.json(licenseManager.getStatus());
  } catch (err) { res.status(500).json({ error: 'خطأ في التحقق من الترخيص' }); }
});
app.post('/api/license/activate', requireAuth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'ممنوع' });
  const { licenseKey } = req.body;
  if (!licenseKey) return res.status(400).json({ error: 'مفتاح الترخيص مطلوب' });
  const result = licenseManager.activate(licenseKey);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

// Phase 5.6: Detailed monitoring endpoint (requires auth)
app.get('/api/monitoring', requireAuth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'ممنوع' });
  try {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
    const userCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get().c;
    const woCount = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status IN ('pending','in_progress')").get().c;
    const backupCount = db.prepare("SELECT COUNT(*) as c FROM backups WHERE status='completed'").get().c;
    const lastBackup = db.prepare("SELECT created_at FROM backups WHERE status='completed' ORDER BY created_at DESC LIMIT 1").get();

    res.json({
      status: 'ok',
      uptime_seconds: Math.round(uptime),
      uptime_human: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`,
      memory: {
        rss_mb: Math.round(mem.rss / 1048576),
        heap_used_mb: Math.round(mem.heapUsed / 1048576),
        heap_total_mb: Math.round(mem.heapTotal / 1048576),
      },
      database: {
        size_mb: dbSize ? Math.round(dbSize.size / 1048576 * 100) / 100 : null,
        active_users: userCount,
        active_work_orders: woCount,
      },
      backups: {
        total: backupCount,
        last_backup: lastBackup?.created_at || null,
      },
      websocket_clients: getClientCount(),
      license: licenseManager.getStatus(),
      node_version: process.version,
    });
  } catch (err) { logger.error('Monitoring error', { error: err.message }); res.status(500).json({ error: 'خطأ في المراقبة' }); }
});

// ═══ Public routes (no auth) ═══
app.use('/api/auth', authRouter);

// Phase 1.7: 2FA routes (requires auth)
const twofaRouter = require('./routes/twofa');
app.use('/api/auth/2fa', requireAuth, twofaRouter);

// ═══ Phase 2.3: Session management endpoints ═══
// GET /api/sessions — list active sessions for current user
app.get('/api/sessions', requireAuth, (req, res) => {
  try {
    const sessions = db.prepare("SELECT id, ip_address, user_agent, created_at, expires_at FROM user_sessions WHERE user_id = ? AND (revoked = 0 OR revoked IS NULL) ORDER BY created_at DESC").all(req.user.id);
    res.json(sessions);
  } catch { res.json([]); }
});

// DELETE /api/sessions/:id — revoke a session
app.delete('/api/sessions/:id', requireAuth, (req, res) => {
  try {
    db.prepare("UPDATE user_sessions SET revoked = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ message: 'تم إلغاء الجلسة' });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// DELETE /api/sessions — revoke all sessions except current
app.delete('/api/sessions', requireAuth, (req, res) => {
  try {
    db.prepare("UPDATE user_sessions SET revoked = 1 WHERE user_id = ? AND (revoked = 0 OR revoked IS NULL)").run(req.user.id);
    res.json({ message: 'تم إلغاء جميع الجلسات' });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══ Phase 2.4: Data retention policy endpoint (superadmin) ═══
app.get('/api/admin/retention', requireAuth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'ممنوع' });
  try {
    const auditDays = parseInt(db.prepare("SELECT value FROM settings WHERE key='audit_retention_days'").get()?.value) || 365;
    const backupDays = parseInt(db.prepare("SELECT value FROM settings WHERE key='backup_retention_days'").get()?.value) || 30;
    const auditCount = db.prepare("SELECT COUNT(*) as c FROM audit_log").get().c;
    const oldAuditCount = db.prepare("SELECT COUNT(*) as c FROM audit_log WHERE created_at < datetime('now', '-' || ? || ' days')").get(auditDays).c;
    res.json({ audit_retention_days: auditDays, backup_retention_days: backupDays, total_audit_records: auditCount, purgeable_audit_records: oldAuditCount });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

app.post('/api/admin/retention/purge', requireAuth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'ممنوع' });
  try {
    const auditDays = parseInt(db.prepare("SELECT value FROM settings WHERE key='audit_retention_days'").get()?.value) || 365;
    const result = db.prepare("DELETE FROM audit_log WHERE created_at < datetime('now', '-' || ? || ' days')").run(auditDays);
    logAudit(req, 'PURGE', 'audit_log', null, `Purged ${result.changes} old records`);
    res.json({ purged: result.changes });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══ Phase 3.1: Import job progress tracking ═══
app.get('/api/import/jobs/:id', requireAuth, (req, res) => {
  try {
    const job = db.prepare('SELECT * FROM import_jobs WHERE id = ?').get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ ...job, errors: job.errors ? JSON.parse(job.errors) : [] });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══ Phase 4.4: User preferences (server-side persistence) ═══
app.get('/api/users/preferences/:key', requireAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT preference_value FROM user_preferences WHERE user_id = ? AND preference_key = ?')
      .get(req.user.id, req.params.key);
    res.json({ value: row ? JSON.parse(row.preference_value) : null });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

app.put('/api/users/preferences/:key', requireAuth, (req, res) => {
  try {
    const { value } = req.body;
    db.prepare(`INSERT INTO user_preferences (user_id, preference_key, preference_value, updated_at)
      VALUES (?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(user_id, preference_key) DO UPDATE SET preference_value = excluded.preference_value, updated_at = excluded.updated_at`)
      .run(req.user.id, req.params.key, JSON.stringify(value));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// Setup status (public)
app.get('/api/setup/status', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    res.json({ needs_setup: count === 0 });
  } catch (err) { res.json({ needs_setup: true }); }
});

app.post('/api/setup/create-admin', (req, res) => {
  try {
    const { username, full_name, password } = req.body;
    if (!username || !full_name || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    // Phase 1.5: Use centralized strong password validation
    const { validatePassword } = require('./utils/validators');
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    const hash = bcrypt.hashSync(password, 12);
    const createAdmin = db.transaction(() => {
      const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
      if (count > 0) return null;
      return db.prepare('INSERT INTO users (username, full_name, password_hash, role, status) VALUES (?,?,?,?,?)')
        .run(username, full_name, hash, 'superadmin', 'active');
    });
    const result = createAdmin();
    if (!result) return res.status(403).json({ error: 'تم إكمال الإعداد بالفعل' });
    res.json({ message: 'تم إنشاء حساب مدير النظام', user_id: result.lastInsertRowid });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب' }); }
});

// ═══ Protected routes ═══
// Phase 6.1: License tier enforcement
const { requireFeature, requireTier } = require('./middleware/licenseGuard');

// Phase 3.6: Webhook management endpoints (superadmin only, requires professional+)
const { createWebhook, listWebhooks, deleteWebhook, getWebhookLogs } = require('./utils/webhooks');
app.get('/api/webhooks', requireAuth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'ممنوع' });
  res.json(listWebhooks());
});
app.post('/api/webhooks', requireAuth, requireFeature('webhooks'), (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'ممنوع' });
  const { name, url, events, secret } = req.body;
  if (!name || !url || !events?.length) return res.status(400).json({ error: 'الاسم والرابط والأحداث مطلوبة' });
  const id = createWebhook(name, url, events, secret, req.user.id);
  res.status(201).json({ id });
});
app.get('/api/webhooks/:id/logs', requireAuth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'ممنوع' });
  res.json(getWebhookLogs(parseInt(req.params.id)));
});
app.delete('/api/webhooks/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'ممنوع' });
  deleteWebhook(parseInt(req.params.id));
  res.json({ success: true });
});

// Phase 3.1: API versioning — mount under both /api and /api/v1 for forward compatibility
const apiRouter = express.Router();
const { validateQueryParams } = require('./utils/validators');
apiRouter.use(validateQueryParams);
apiRouter.use('/users', usersRouter);
apiRouter.use('/hr', hrRouter);
apiRouter.use('/audit-log', auditRouter);
apiRouter.use('/fabrics', fabricsRouter);
apiRouter.use('/accessories', accessoriesRouter);
apiRouter.use('/models', modelsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/invoices', invoicesRouter);
apiRouter.use('/work-orders', workordersRouter);
apiRouter.use('/suppliers', suppliersRouter);
apiRouter.use('/purchase-orders', purchaseordersRouter);
apiRouter.use('/stage-templates', stageTemplatesRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/permissions', permissionsRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/machines', machinesRouter);
apiRouter.use('/accounting', accountingRouter);
apiRouter.use('/expenses', expensesRouter);
apiRouter.use('/maintenance', maintenanceRouter);
apiRouter.use('/barcode', barcodeRouter);
apiRouter.use('/mrp', mrpRouter);
apiRouter.use('/shipping', shippingRouter);
apiRouter.use('/scheduling', schedulingRouter);
apiRouter.use('/quality', qualityRouter);
apiRouter.use('/quotations', quotationsRouter);
apiRouter.use('/samples', samplesRouter);
apiRouter.use('/returns', returnsRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/backups', backupsRouter);
apiRouter.use('/auto-journal', autojournalRouter);
apiRouter.use('/exports', exportsRouter);

// Public invite endpoints (no auth required — must be before requireAuth router)
app.use('/api/users/invite', require('./routes/users').inviteRouter || express.Router());

app.use('/api', requireAuth, apiRouter);
app.use('/api/v1', requireAuth, apiRouter);

// Dashboard
app.get('/api/dashboard', requireAuth, requirePermission('dashboard', 'view'), (req, res) => {
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
    } catch (e) { logger.debug('dashboard cancelled count', e.message); }
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

    // V10 — overall quality (rejection rate) — only final stage per WO to avoid double-counting
    const totalPassed = db.prepare(`SELECT COALESCE(SUM(ws.quantity_completed),0) as v FROM wo_stages ws WHERE ws.sort_order = (SELECT MAX(ws2.sort_order) FROM wo_stages ws2 WHERE ws2.wo_id=ws.wo_id)`).get().v;
    const totalRejected = db.prepare(`SELECT COALESCE(SUM(ws.quantity_rejected),0) as v FROM wo_stages ws WHERE ws.sort_order = (SELECT MAX(ws2.sort_order) FROM wo_stages ws2 WHERE ws2.wo_id=ws.wo_id)`).get().v;
    const qualityRate = (totalPassed + totalRejected) > 0 ? Math.round((totalPassed / (totalPassed + totalRejected)) * 10000) / 100 : 100;

    // V11 — top models by production volume
    let topModels = [];
    try {
      topModels = db.prepare(`SELECT model_code, model_name, total_wo, completed_wo, total_quantity, total_pieces_completed, avg_cost_per_piece
        FROM model_production_summary ORDER BY total_wo DESC LIMIT ?`).all(dashboardListLimit);
    } catch (e) { logger.debug('dashboard topModels', e.message); }

    // V11 — stage bottleneck detection (stages with most WIP)
    let stageBottlenecks = [];
    try {
      stageBottlenecks = db.prepare(`SELECT ws.stage_name, SUM(ws.quantity_in_stage) as total_wip, COUNT(DISTINCT ws.wo_id) as wo_count,
        AVG(JULIANDAY('now') - JULIANDAY(ws.started_at)) as avg_days_in_stage
        FROM wo_stages ws JOIN work_orders wo ON wo.id=ws.wo_id
        WHERE wo.status='in_progress' AND ws.status='in_progress' AND ws.quantity_in_stage > 0
        GROUP BY ws.stage_name ORDER BY total_wip DESC LIMIT ?`).all(dashboardListLimit);
    } catch (e) { logger.debug('dashboard stageBottlenecks', e.message); }

    // V17 — Machine status board
    let machineStatusBoard = [];
    try {
      machineStatusBoard = db.prepare(`SELECT id, code, name, status, location, machine_type FROM machines ORDER BY sort_order, name LIMIT ?`).all(dashboardMachineLimit);
    } catch (e) { logger.debug('dashboard machineStatusBoard', e.message); }

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
    } catch (e) { logger.debug('dashboard todaySummary', e.message); todaySummary = { attendance: 0, deliveries: 0, due_today: 0, expenses: 0, invoices: 0 }; }

    // V18 — Overdue invoices
    let overdueInvoicesList = [];
    try {
      overdueInvoicesList = db.prepare(`SELECT id, invoice_number, customer_name, total, due_date FROM invoices WHERE status='overdue' ORDER BY due_date ASC LIMIT ?`).all(dashboardListLimit);
    } catch (e) { logger.debug('dashboard overdueInvoices', e.message); }

    // V18 — Overdue work orders list (detailed)
    let overdueWOList = [];
    try {
      overdueWOList = db.prepare(`SELECT wo.id, wo.wo_number, wo.due_date, wo.status, m.model_code, m.model_name
        FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id
        WHERE wo.due_date < date('now') AND wo.status NOT IN ('completed','cancelled')
        ORDER BY wo.due_date ASC LIMIT ?`).all(dashboardListLimit);
    } catch (e) { logger.debug('dashboard overdueWOList', e.message); }

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
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══ Dashboard KPI Endpoints ═══

// GET /api/dashboard/chart/revenue-trend — monthly revenue last 12 months
app.get('/api/dashboard/chart/revenue-trend', requireAuth, requirePermission('dashboard', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month,
        COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END),0) as revenue,
        COUNT(*) as invoice_count
      FROM invoices WHERE created_at >= date('now','-12 months')
      GROUP BY month ORDER BY month
    `).all();
    res.json(rows);
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/dashboard/chart/production-status — WO status distribution
app.get('/api/dashboard/chart/production-status', requireAuth, requirePermission('dashboard', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`SELECT status, COUNT(*) as count FROM work_orders GROUP BY status`).all();
    res.json(rows);
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/dashboard/chart/top-customers — top 10 customers by revenue
app.get('/api/dashboard/chart/top-customers', requireAuth, requirePermission('dashboard', 'view'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT customer_name, SUM(total) as total_revenue, COUNT(*) as invoice_count
      FROM invoices WHERE status NOT IN ('cancelled','draft') AND customer_id IS NOT NULL
      GROUP BY customer_id, customer_name ORDER BY total_revenue DESC LIMIT 10
    `).all();
    res.json(rows);
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/dashboard/chart/inventory-alerts — low stock items summary
app.get('/api/dashboard/chart/inventory-alerts', requireAuth, requirePermission('dashboard', 'view'), (req, res) => {
  try {
    const fabrics = db.prepare(`SELECT code, name, available_meters as qty, low_stock_threshold as threshold, 'fabric' as type FROM fabrics WHERE status='active' AND available_meters < COALESCE(low_stock_threshold,10) AND COALESCE(low_stock_threshold,10) > 0`).all();
    const accessories = db.prepare(`SELECT code, name, quantity_on_hand as qty, low_stock_threshold as threshold, 'accessory' as type FROM accessories WHERE status='active' AND quantity_on_hand < COALESCE(low_stock_threshold,10) AND COALESCE(low_stock_threshold,10) > 0`).all();
    res.json([...fabrics, ...accessories]);
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/dashboard/kpis/production — production KPIs with period comparison
app.get('/api/dashboard/kpis/production', requireAuth, requirePermission('dashboard', 'view'), (req, res) => {
  try {
    const thisMonth = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed' AND completed_date >= date('now','start of month')").get().c;
    const lastMonth = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed' AND completed_date >= date('now','start of month','-1 month') AND completed_date < date('now','start of month')").get().c;
    const avgCycleTime = db.prepare("SELECT AVG(JULIANDAY(completed_date) - JULIANDAY(created_at)) as v FROM work_orders WHERE status='completed' AND completed_date IS NOT NULL AND created_at IS NOT NULL").get().v || 0;
    const onTimeCount = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed' AND completed_date <= due_date AND due_date IS NOT NULL").get().c;
    const totalWithDue = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed' AND due_date IS NOT NULL").get().c;
    const onTimeRate = totalWithDue > 0 ? Math.round((onTimeCount / totalWithDue) * 100) : 100;
    res.json({
      completed_this_month: thisMonth,
      completed_last_month: lastMonth,
      completion_change_pct: lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0,
      avg_cycle_days: Math.round(avgCycleTime * 10) / 10,
      on_time_delivery_rate: onTimeRate,
    });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/dashboard/kpis/finance — financial KPIs
app.get('/api/dashboard/kpis/finance', requireAuth, requirePermission('dashboard', 'view'), (req, res) => {
  try {
    const revenueThisMonth = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status='paid' AND created_at >= date('now','start of month')").get().v;
    const revenueSameMonthLastYear = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status='paid' AND strftime('%m', created_at) = strftime('%m','now') AND strftime('%Y', created_at) = CAST(CAST(strftime('%Y','now') AS INTEGER) - 1 AS TEXT)").get().v;
    const arOverdue = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status='overdue'").get().v;
    // AR aging
    const ar030 = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status NOT IN ('paid','cancelled','draft') AND due_date >= date('now','-30 days')").get().v;
    const ar3160 = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status NOT IN ('paid','cancelled','draft') AND due_date < date('now','-30 days') AND due_date >= date('now','-60 days')").get().v;
    const ar6190 = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status NOT IN ('paid','cancelled','draft') AND due_date < date('now','-60 days') AND due_date >= date('now','-90 days')").get().v;
    const ar90plus = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status NOT IN ('paid','cancelled','draft') AND due_date < date('now','-90 days')").get().v;
    res.json({
      revenue_this_month: Math.round(revenueThisMonth * 100) / 100,
      revenue_same_month_ly: Math.round(revenueSameMonthLastYear * 100) / 100,
      ar_overdue: Math.round(arOverdue * 100) / 100,
      ar_aging: {
        '0_30': Math.round(ar030 * 100) / 100,
        '31_60': Math.round(ar3160 * 100) / 100,
        '61_90': Math.round(ar6190 * 100) / 100,
        '90_plus': Math.round(ar90plus * 100) / 100,
      },
    });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/dashboard/kpis/hr — HR KPIs
app.get('/api/dashboard/kpis/hr', requireAuth, requirePermission('dashboard', 'view'), (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const totalEmployees = db.prepare("SELECT COUNT(*) as c FROM employees WHERE status='active'").get().c;
    const presentToday = db.prepare("SELECT COUNT(*) as c FROM attendance WHERE work_date=? AND attendance_status != 'absent'").get(today).c;
    const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;
    const pendingLeaves = db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status='pending'").get().c;
    const payrollThisMonth = db.prepare("SELECT COALESCE(SUM(net_pay),0) as v FROM payroll_records pr JOIN payroll_periods pp ON pp.id=pr.period_id WHERE pp.period_month=strftime('%Y-%m','now')").get().v;
    // Department headcount
    const departments = db.prepare("SELECT department, COUNT(*) as count FROM employees WHERE status='active' AND department IS NOT NULL GROUP BY department ORDER BY count DESC").all();
    res.json({
      total_employees: totalEmployees,
      present_today: presentToday,
      attendance_rate: attendanceRate,
      pending_leave_requests: pendingLeaves,
      payroll_this_month: Math.round(payrollThisMonth * 100) / 100,
      departments,
    });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  BI Reports
// ═══════════════════════════════════════════

// GET /api/reports/executive-summary — high-level KPIs
app.get('/api/reports/executive-summary', requireAuth, (req, res) => {
  try {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const revenue = db.prepare("SELECT COALESCE(SUM(total), 0) as v FROM invoices WHERE status = 'paid' AND created_at LIKE ?").get(`${thisMonth}%`).v;
    const expenses = db.prepare("SELECT COALESCE(SUM(amount), 0) as v FROM expenses WHERE is_deleted = 0 AND expense_date LIKE ?").get(`${thisMonth}%`).v;
    const activeWOs = db.prepare("SELECT COUNT(*) as v FROM work_orders WHERE status NOT IN ('completed','cancelled')").get().v;
    const completedWOs = db.prepare("SELECT COUNT(*) as v FROM work_orders WHERE status = 'completed' AND completed_date LIKE ?").get(`${thisMonth}%`).v;
    const pendingInvoices = db.prepare("SELECT COUNT(*) as v FROM invoices WHERE status IN ('sent','partially_paid','overdue')").get().v;
    const totalAR = db.prepare("SELECT COALESCE(SUM(total), 0) as v FROM invoices WHERE status NOT IN ('paid','cancelled','draft')").get().v;
    const employeeCount = db.prepare("SELECT COUNT(*) as v FROM employees WHERE status = 'active'").get().v;
    res.json({ month: thisMonth, revenue, expenses, net_income: revenue - expenses, active_work_orders: activeWOs, completed_this_month: completedWOs, pending_invoices: pendingInvoices, total_receivables: totalAR, active_employees: employeeCount });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/cost-analysis — production cost breakdown
app.get('/api/reports/cost-analysis', requireAuth, (req, res) => {
  try {
    const fabricCost = db.prepare("SELECT COALESCE(SUM(actual_cost), 0) as v FROM wo_fabric_batches").get().v;
    let accessoryCost = 0;
    try { accessoryCost = db.prepare("SELECT COALESCE(SUM(total_cost), 0) as v FROM wo_accessory_consumption").get().v; } catch {}
    const laborCost = db.prepare("SELECT COALESCE(SUM(net_pay), 0) as v FROM payroll_records").get().v;
    const overheadCost = db.prepare("SELECT COALESCE(SUM(amount), 0) as v FROM expenses WHERE is_deleted = 0").get().v;
    const woRevenue = db.prepare("SELECT COALESCE(SUM(i.total), 0) as v FROM invoices i WHERE i.status != 'cancelled'").get().v;
    const totalCost = fabricCost + accessoryCost + laborCost + overheadCost;
    res.json({ fabric_cost: fabricCost, accessory_cost: accessoryCost, labor_cost: laborCost, overhead_cost: overheadCost, total_cost: totalCost, total_revenue: woRevenue, gross_margin: woRevenue - totalCost, margin_pct: woRevenue > 0 ? Math.round((woRevenue - totalCost) / woRevenue * 10000) / 100 : 0 });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/inventory-abc — ABC analysis of inventory items
app.get('/api/reports/inventory-abc', requireAuth, (req, res) => {
  try {
    const items = db.prepare(`
      SELECT f.code, f.name, 'fabric' as type,
        COALESCE(SUM((fib.received_meters - fib.used_meters - fib.wasted_meters) * fib.price_per_meter), 0) as value
      FROM fabrics f
      LEFT JOIN fabric_inventory_batches fib ON fib.fabric_code = f.code AND fib.batch_status != 'cancelled'
      WHERE f.status = 'active'
      GROUP BY f.code
      HAVING value > 0
      ORDER BY value DESC
    `).all();

    const totalValue = items.reduce((s, i) => s + i.value, 0);
    let cumulative = 0;
    for (const item of items) {
      cumulative += item.value;
      const pct = totalValue > 0 ? (cumulative / totalValue) * 100 : 0;
      item.cumulative_pct = Math.round(pct * 100) / 100;
      item.category = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C';
    }
    res.json({ items, total_value: totalValue });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/reports/hr-analytics — HR metrics
app.get('/api/reports/hr-analytics', requireAuth, (req, res) => {
  try {
    const deptDist = db.prepare("SELECT department, COUNT(*) as count FROM employees WHERE status='active' GROUP BY department ORDER BY count DESC").all();
    const avgTenure = db.prepare("SELECT AVG(JULIANDAY('now') - JULIANDAY(hire_date)) / 365.25 as v FROM employees WHERE status='active' AND hire_date IS NOT NULL").get().v;
    const turnover = db.prepare("SELECT COUNT(*) as v FROM employees WHERE status='terminated' AND termination_date >= date('now','-12 months')").get().v;
    const totalActive = db.prepare("SELECT COUNT(*) as v FROM employees WHERE status='active'").get().v;
    const recentHires = db.prepare("SELECT COUNT(*) as v FROM employees WHERE status='active' AND hire_date >= date('now','-3 months')").get().v;
    const avgSalary = db.prepare("SELECT AVG(base_salary) as v FROM employees WHERE status='active' AND base_salary > 0").get().v;
    const leaveStats = db.prepare("SELECT leave_type, COUNT(*) as count, SUM(CAST(JULIANDAY(end_date) - JULIANDAY(start_date) + 1 AS INTEGER)) as total_days FROM leave_requests WHERE status='approved' AND start_date >= date('now','-12 months') GROUP BY leave_type").all();
    res.json({ department_distribution: deptDist, avg_tenure_years: avgTenure ? Math.round(avgTenure * 10) / 10 : null, turnover_12m: turnover, active_employees: totalActive, turnover_rate: totalActive > 0 ? Math.round(turnover / totalActive * 10000) / 100 : 0, recent_hires_3m: recentHires, avg_salary: avgSalary ? Math.round(avgSalary) : null, leave_stats: leaveStats });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// ═══════════════════════════════════════════
//  Bulk Import Wizard
// ═══════════════════════════════════════════

// POST /api/import/bulk — unified bulk import for any entity
app.post('/api/import/bulk', requireAuth, (req, res) => {
  try {
    const { entity, rows } = req.body;
    if (!entity || !Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'الكيان والبيانات مطلوبة' });
    if (rows.length > 1000) return res.status(400).json({ error: 'الحد الأقصى 1000 سجل للدفعة الواحدة' });

    const u = req.user;
    const results = { imported: 0, skipped: 0, errors: [] };

    const importMap = {
      suppliers: { perm: 'suppliers', stmt: 'INSERT OR IGNORE INTO suppliers (code, name, supplier_type, contact_name, phone, email, address) VALUES (?,?,?,?,?,?,?)', fields: ['code','name','supplier_type','contact_name','phone','email','address'] },
      customers: { perm: 'customers', stmt: 'INSERT OR IGNORE INTO customers (code, name, customer_type, phone, email, address, city, tax_number, contact_name) VALUES (?,?,?,?,?,?,?,?,?)', fields: ['code','name','customer_type','phone','email','address','city','tax_number','contact_name'] },
      fabrics: { perm: 'fabrics', stmt: 'INSERT OR IGNORE INTO fabrics (code, name, fabric_type, price_per_m, color) VALUES (?,?,?,?,?)', fields: ['code','name','fabric_type','price_per_m','color'] },
      accessories: { perm: 'accessories', stmt: 'INSERT OR IGNORE INTO accessories (code, name, acc_type, unit_price, unit) VALUES (?,?,?,?,?)', fields: ['code','name','acc_type','unit_price','unit'] },
    };

    const config = importMap[entity];
    if (!config) return res.status(400).json({ error: 'كيان غير مدعوم', supported: Object.keys(importMap) });
    if (!canUser(u, config.perm, 'create')) return res.status(403).json({ error: 'لا تملك صلاحية الإضافة' });

    const stmt = db.prepare(config.stmt);
    const txn = db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const vals = config.fields.map(f => row[f] ?? null);
          const r = stmt.run(...vals);
          if (r.changes > 0) results.imported++; else results.skipped++;
        } catch (e) { results.errors.push({ row: i, error: e.message }); results.skipped++; }
      }
    });
    txn();

    logAudit(req, 'BULK_IMPORT', entity, null, `Imported ${results.imported} of ${rows.length}`);
    res.json(results);
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/import/templates — list available import templates
app.get('/api/import/templates', requireAuth, (req, res) => {
  res.json([
    { entity: 'suppliers', fields: ['code','name','supplier_type','contact_name','phone','email','address'], required: ['code','name'] },
    { entity: 'customers', fields: ['code','name','customer_type','phone','email','address','city','tax_number','contact_name'], required: ['code','name'] },
    { entity: 'fabrics', fields: ['code','name','fabric_type','price_per_m','color'], required: ['code','name'] },
    { entity: 'accessories', fields: ['code','name','acc_type','unit_price','unit'], required: ['code','name'] },
  ]);
});

// ═══════════════════════════════════════════
//  Activity Feed & Session Management
// ═══════════════════════════════════════════

// GET /api/activity-feed — recent actions across the system
app.get('/api/activity-feed', requireAuth, (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 30);
    const feed = db.prepare(`
      SELECT al.id, al.action, al.entity_type, al.entity_id, al.entity_label as details, al.created_at,
        u.full_name as user_name
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(limit);
    res.json(feed);
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// GET /api/sessions/current — current session info
app.get('/api/sessions/current', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const loginTime = db.prepare("SELECT created_at FROM audit_log WHERE user_id = ? AND action = 'LOGIN' ORDER BY created_at DESC LIMIT 1").get(user.id);
    res.json({ user_id: user.id, username: user.username, full_name: user.full_name, role: user.role, last_login: loginTime?.created_at || null });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
});

// Global search — filter by user module permissions
app.get('/api/search', requireAuth, (req, res) => {
  try {
    const { q, category } = req.query;
    if (!q || q.length < 2 || q.length > 100) return res.json({ models: [], fabrics: [], accessories: [], invoices: [], suppliers: [], workOrders: [], purchaseOrders: [], total: 0 });
    const searchLimit = parseInt(db.prepare("SELECT value FROM settings WHERE key='search_results_limit'").get()?.value) || 8;
    const like = `%${q}%`;
    const u = req.user;

    // Category filter: if specified, only search that category
    const shouldSearch = (cat) => !category || category === cat;

    const models = shouldSearch('models') && canUser(u,'models','view') ? db.prepare(`SELECT model_code, model_name, serial_number, category FROM models WHERE status='active' AND (model_code LIKE ? OR model_name LIKE ? OR serial_number LIKE ?) LIMIT ?`).all(like, like, like, searchLimit) : [];
    const fabrics = shouldSearch('fabrics') && canUser(u,'fabrics','view') ? db.prepare(`SELECT code, name, fabric_type, price_per_m FROM fabrics WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT ?`).all(like, like, searchLimit) : [];
    const accessories = shouldSearch('accessories') && canUser(u,'accessories','view') ? db.prepare(`SELECT code, name, acc_type, unit_price FROM accessories WHERE status='active' AND (code LIKE ? OR name LIKE ?) LIMIT ?`).all(like, like, searchLimit) : [];
    const invoices = shouldSearch('invoices') && canUser(u,'invoices','view') ? db.prepare(`SELECT id, invoice_number, customer_name, total, status FROM invoices WHERE invoice_number LIKE ? OR customer_name LIKE ? LIMIT ?`).all(like, like, searchLimit) : [];
    const suppliers = shouldSearch('suppliers') && canUser(u,'suppliers','view') ? db.prepare(`SELECT id, code, name, supplier_type FROM suppliers WHERE status='active' AND (code LIKE ? OR name LIKE ? OR contact_name LIKE ?) LIMIT ?`).all(like, like, like, searchLimit) : [];
    const workOrders = shouldSearch('workOrders') && canUser(u,'work_orders','view') ? db.prepare(`SELECT wo.id, wo.wo_number, wo.status, wo.priority, wo.assigned_to, m.model_code, m.model_name FROM work_orders wo LEFT JOIN models m ON m.id=wo.model_id WHERE wo.wo_number LIKE ? OR m.model_code LIKE ? OR m.model_name LIKE ? OR wo.assigned_to LIKE ? LIMIT ?`).all(like, like, like, like, searchLimit) : [];
    const purchaseOrders = shouldSearch('purchaseOrders') && canUser(u,'purchase_orders','view') ? db.prepare(`SELECT po.id, po.po_number, po.status, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.po_number LIKE ? OR s.name LIKE ? LIMIT ?`).all(like, like, searchLimit) : [];
    const customers = shouldSearch('customers') && canUser(u,'customers','view') ? db.prepare(`SELECT id, code, name, phone, city FROM customers WHERE status='active' AND (code LIKE ? OR name LIKE ? OR phone LIKE ?) LIMIT ?`).all(like, like, like, searchLimit) : [];

    let maintenanceOrders = [], expensesResults = [], machines = [], employees = [], accounts = [];
    try {
      if (shouldSearch('machines') && canUser(u,'machines','view')) machines = db.prepare(`SELECT id, code, name, barcode, machine_type, status FROM machines WHERE status != 'inactive' AND (code LIKE ? OR name LIKE ? OR barcode LIKE ?) LIMIT ?`).all(like, like, like, searchLimit);
    } catch (e) { logger.debug('search machines', { error: e.message }); }
    try {
      if (shouldSearch('maintenance') && canUser(u,'maintenance','view')) maintenanceOrders = db.prepare(`SELECT mo.id, mo.barcode, mo.title, mo.status, mo.priority, m.name as machine_name FROM maintenance_orders mo LEFT JOIN machines m ON m.id=mo.machine_id WHERE mo.is_deleted=0 AND (mo.title LIKE ? OR mo.barcode LIKE ? OR m.name LIKE ?) LIMIT ?`).all(like, like, like, searchLimit);
      if (shouldSearch('expenses') && canUser(u,'expenses','view')) expensesResults = db.prepare(`SELECT id, description, amount, expense_type, status, expense_date FROM expenses WHERE is_deleted=0 AND (description LIKE ? OR expense_type LIKE ?) LIMIT ?`).all(like, like, searchLimit);
    } catch (e) { logger.debug('search maintenance/expenses', { error: e.message }); }
    try {
      if (shouldSearch('employees') && canUser(u,'hr','view')) employees = db.prepare(`SELECT id, emp_code, full_name, department, job_title FROM employees WHERE status='active' AND (emp_code LIKE ? OR full_name LIKE ? OR department LIKE ?) LIMIT ?`).all(like, like, like, searchLimit);
    } catch (e) { logger.debug('search employees', { error: e.message }); }
    try {
      if (shouldSearch('accounts') && canUser(u,'accounting','view')) accounts = db.prepare(`SELECT id, code, name_ar, type FROM chart_of_accounts WHERE is_active=1 AND (code LIKE ? OR name_ar LIKE ?) LIMIT ?`).all(like, like, searchLimit);
    } catch (e) { logger.debug('search accounts', { error: e.message }); }

    const result = { models, fabrics, accessories, invoices, suppliers, workOrders, purchaseOrders, customers, maintenanceOrders, expenses: expensesResults, machines, employees, accounts };
    // Add counts per category and total
    const counts = {};
    let total = 0;
    for (const [key, arr] of Object.entries(result)) { counts[key] = arr.length; total += arr.length; }
    res.json({ ...result, counts, total });
  } catch (err) { logger.error('Server error', { error: err.message }); res.status(500).json({ error: 'حدث خطأ داخلي' }); }
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
    // Inject CSP nonce into script tags for non-Electron deployments
    if (req.cspNonce) {
      const indexPath = path.join(frontendDist, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf8');
      html = html.replace(/<script/g, `<script nonce="${req.cspNonce}"`);
      return res.send(html);
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ═══ Global error handler ═══
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.stack || err.message || err });
  // Phase 5.3: Report to Sentry if configured
  if (process.env.SENTRY_DSN) { try { require('@sentry/node').captureException(err); } catch {} }
  res.status(err.status || 500).json({ error: 'خطأ داخلي في الخادم' });
});

const server = app.listen(PORT, () => {
  logger.info(`WK-Factory API running on http://localhost:${PORT}`);

  // Phase 3.7: Initialize WebSocket server
  initWebSocket(server);
  logger.info('WebSocket server initialized on /ws');

  // Run notification generation on startup and every 5 minutes
  try { notificationsRouter.generateNotifications(); } catch (e) { logger.error('Initial notification gen failed', { error: e.message }); }
  setInterval(() => { try { notificationsRouter.generateNotifications(); } catch (e) { logger.error('Notification gen failed', { error: e.message }); } }, 5 * 60 * 1000);

  // Phase 2.5: Auto-scheduled backup every 6 hours (configurable via AUTO_BACKUP_HOURS env)
  const backupIntervalHours = parseInt(process.env.AUTO_BACKUP_HOURS) || 6;
  const backupFn = require('./backup');
  setInterval(() => {
    try { backupFn(); logger.info('Auto-backup completed'); }
    catch (e) { logger.error('Auto-backup failed', { error: e.message }); }
  }, backupIntervalHours * 60 * 60 * 1000);

  // Phase 2.5: Data retention cleanup — run daily at midnight
  const { runAllCleanups } = require('./utils/cleanup');
  if (process.env.NODE_ENV !== 'test') {
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight - now;
    };
    setTimeout(() => {
      runAllCleanups();
      setInterval(runAllCleanups, 24 * 60 * 60 * 1000);
    }, msUntilMidnight());
  }
});

// ═══ Graceful shutdown ═══
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    try { db.close(); } catch (e) { /* already closed */ }
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => { process.exit(1); }, 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

