const Database = require('better-sqlite3');
const path = require('path');

const dbDir = process.env.WK_DB_DIR || __dirname;
const dbPath = path.join(dbDir, 'wk-hub.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  // ═══════════════════════════════════════════════
  // LAYER 1: MODELS (Simple master data catalog)
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      model_code      TEXT UNIQUE NOT NULL,
      serial_number   TEXT UNIQUE,
      model_name      TEXT,
      category        TEXT,
      gender          TEXT DEFAULT 'unisex' CHECK(gender IN ('male','female','kids','unisex')),
      model_image     TEXT,
      notes           TEXT,
      status          TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','discontinued')),
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
  `);

  // ═══════════════════════════════════════════════
  // MASTER DATA: Fabrics Registry
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS fabrics (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      code         TEXT UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      fabric_type  TEXT DEFAULT 'main' CHECK(fabric_type IN ('main','lining','both')),
      price_per_m  REAL NOT NULL DEFAULT 0,
      supplier_id  INTEGER REFERENCES suppliers(id),
      supplier     TEXT,
      color        TEXT,
      image_path   TEXT,
      status       TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      notes        TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  // ═══════════════════════════════════════════════
  // MASTER DATA: Accessories Registry
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS accessories (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      code         TEXT UNIQUE NOT NULL,
      acc_type     TEXT NOT NULL CHECK(acc_type IN ('button','zipper','thread','label','padding','interfacing','elastic','packaging','other')),
      name         TEXT NOT NULL,
      unit_price   REAL NOT NULL DEFAULT 0,
      unit         TEXT DEFAULT 'piece' CHECK(unit IN ('piece','meter','kg','roll')),
      supplier_id  INTEGER REFERENCES suppliers(id),
      supplier     TEXT,
      status       TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      notes        TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  // ═══════════════════════════════════════════════
  // LAYER 2: BOM TEMPLATES (Optional default recipes)
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS bom_templates (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id        INTEGER REFERENCES models(id) ON DELETE CASCADE,
      template_name   TEXT NOT NULL DEFAULT 'الافتراضي',
      is_default      INTEGER DEFAULT 0,
      masnaiya        REAL DEFAULT 90,
      masrouf         REAL DEFAULT 50,
      margin_pct      REAL DEFAULT 25,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bom_template_fabrics (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id      INTEGER REFERENCES bom_templates(id) ON DELETE CASCADE,
      fabric_code      TEXT REFERENCES fabrics(code),
      role             TEXT NOT NULL CHECK(role IN ('main','lining')),
      meters_per_piece REAL NOT NULL DEFAULT 1,
      waste_pct        REAL DEFAULT 5,
      color_note       TEXT,
      sort_order       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bom_template_accessories (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id     INTEGER REFERENCES bom_templates(id) ON DELETE CASCADE,
      accessory_code  TEXT REFERENCES accessories(code),
      accessory_name  TEXT,
      quantity        REAL NOT NULL DEFAULT 1,
      unit_price      REAL DEFAULT 0,
      notes           TEXT
    );

    CREATE TABLE IF NOT EXISTS bom_template_sizes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER REFERENCES bom_templates(id) ON DELETE CASCADE,
      color_label TEXT NOT NULL DEFAULT 'أساسي',
      qty_s       INTEGER DEFAULT 0,
      qty_m       INTEGER DEFAULT 0,
      qty_l       INTEGER DEFAULT 0,
      qty_xl      INTEGER DEFAULT 0,
      qty_2xl     INTEGER DEFAULT 0,
      qty_3xl     INTEGER DEFAULT 0
    );
  `);

  // ═══════════════════════════════════════════════
  // LAYER 3: WORK ORDERS (Core production)
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_number       TEXT UNIQUE NOT NULL,
      model_id        INTEGER REFERENCES models(id),
      template_id     INTEGER REFERENCES bom_templates(id),
      status          TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending','in_progress','completed','cancelled')),
      priority        TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
      assigned_to     TEXT,
      start_date      TEXT,
      due_date        TEXT,
      completed_date  TEXT,
      masnaiya        REAL DEFAULT 90,
      masrouf         REAL DEFAULT 50,
      margin_pct      REAL DEFAULT 25,
      consumer_price  REAL,
      wholesale_price REAL,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wo_fabrics (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id            INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      fabric_code      TEXT REFERENCES fabrics(code),
      role             TEXT NOT NULL CHECK(role IN ('main','lining')),
      meters_per_piece REAL NOT NULL DEFAULT 1,
      waste_pct        REAL DEFAULT 5,
      color_note       TEXT,
      planned_meters   REAL DEFAULT 0,
      actual_meters    REAL,
      sort_order       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wo_accessories (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id           INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      accessory_code  TEXT REFERENCES accessories(code),
      accessory_name  TEXT,
      quantity        REAL NOT NULL DEFAULT 1,
      unit_price      REAL NOT NULL DEFAULT 0,
      notes           TEXT
    );

    CREATE TABLE IF NOT EXISTS wo_sizes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id       INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      color_label TEXT NOT NULL DEFAULT 'أساسي',
      qty_s       INTEGER DEFAULT 0,
      qty_m       INTEGER DEFAULT 0,
      qty_l       INTEGER DEFAULT 0,
      qty_xl      INTEGER DEFAULT 0,
      qty_2xl     INTEGER DEFAULT 0,
      qty_3xl     INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wo_stages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id         INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      stage_name    TEXT NOT NULL,
      sort_order    INTEGER DEFAULT 0,
      status        TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped')),
      assigned_to   TEXT,
      started_at    TEXT,
      completed_at  TEXT,
      quantity_done INTEGER DEFAULT 0,
      notes         TEXT
    );
  `);

  // ═══════════════════════════════════════════════
  // MASTER DATA: Suppliers
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      supplier_type TEXT DEFAULT 'both' CHECK(supplier_type IN ('fabric','accessory','both','other')),
      phone         TEXT,
      email         TEXT,
      address       TEXT,
      contact_name  TEXT,
      payment_terms TEXT,
      rating        INTEGER DEFAULT 3 CHECK(rating BETWEEN 1 AND 5),
      status        TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      notes         TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `);

  // ═══════════════════════════════════════════════
  // PURCHASING: Purchase Orders
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number     TEXT UNIQUE NOT NULL,
      supplier_id   INTEGER REFERENCES suppliers(id),
      po_type       TEXT DEFAULT 'fabric' CHECK(po_type IN ('fabric','accessory','mixed')),
      status        TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','partial','received','cancelled')),
      order_date    TEXT DEFAULT (datetime('now')),
      expected_date TEXT,
      received_date TEXT,
      total_amount  REAL DEFAULT 0,
      paid_amount   REAL DEFAULT 0,
      notes         TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id          INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
      item_type      TEXT NOT NULL CHECK(item_type IN ('fabric','accessory','other')),
      fabric_code    TEXT,
      accessory_code TEXT,
      description    TEXT,
      quantity       REAL NOT NULL,
      unit           TEXT DEFAULT 'meter',
      unit_price     REAL NOT NULL,
      received_qty   REAL DEFAULT 0,
      notes          TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id          INTEGER REFERENCES purchase_orders(id),
      supplier_id    INTEGER REFERENCES suppliers(id),
      amount         REAL NOT NULL,
      payment_date   TEXT DEFAULT (datetime('now')),
      payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash','bank','check','other')),
      reference      TEXT,
      notes          TEXT
    );
  `);

  // ═══════════════════════════════════════════════
  // SALES: Invoices
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number  TEXT UNIQUE NOT NULL,
      customer_name   TEXT NOT NULL,
      customer_phone  TEXT,
      customer_email  TEXT,
      wo_id           INTEGER REFERENCES work_orders(id),
      status          TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue','cancelled')),
      tax_pct         REAL DEFAULT 0,
      discount        REAL DEFAULT 0,
      subtotal        REAL DEFAULT 0,
      total           REAL DEFAULT 0,
      notes           TEXT,
      due_date        TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id   INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      description  TEXT NOT NULL,
      model_code   TEXT,
      variant      TEXT,
      quantity     REAL NOT NULL,
      unit_price   REAL NOT NULL,
      total        REAL,
      sort_order   INTEGER DEFAULT 0
    );
  `);

  // ═══════════════════════════════════════════════
  // SYSTEM: Settings & Stage Templates
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key    TEXT PRIMARY KEY,
      value  TEXT
    );

    CREATE TABLE IF NOT EXISTS stage_templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      color       TEXT DEFAULT '#6b7280',
      sort_order  INTEGER DEFAULT 0,
      is_default  INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cost_snapshots (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id               INTEGER REFERENCES work_orders(id),
      model_id            INTEGER REFERENCES models(id),
      total_pieces        INTEGER,
      total_meters_main   REAL,
      total_meters_lining REAL,
      main_fabric_cost    REAL,
      lining_cost         REAL,
      accessories_cost    REAL,
      masnaiya            REAL,
      masrouf             REAL,
      waste_cost          REAL DEFAULT 0,
      extra_expenses      REAL DEFAULT 0,
      total_cost          REAL,
      cost_per_piece      REAL,
      snapshot_date       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  // ═══════════════════════════════════════════════
  // V4: Fabric Inventory Batches (PO-based costing)
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS fabric_inventory_batches (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_code       TEXT UNIQUE NOT NULL,
      fabric_code      TEXT NOT NULL REFERENCES fabrics(code),
      po_id            INTEGER REFERENCES purchase_orders(id),
      po_item_id       INTEGER REFERENCES purchase_order_items(id),
      supplier_id      INTEGER REFERENCES suppliers(id),
      ordered_meters   REAL NOT NULL DEFAULT 0,
      received_meters  REAL NOT NULL DEFAULT 0,
      used_meters      REAL NOT NULL DEFAULT 0,
      wasted_meters    REAL NOT NULL DEFAULT 0,
      available_meters REAL GENERATED ALWAYS AS (received_meters - used_meters - wasted_meters) STORED,
      price_per_meter  REAL NOT NULL,
      quantity_variance REAL GENERATED ALWAYS AS (received_meters - ordered_meters) STORED,
      variance_notes   TEXT,
      received_date    TEXT DEFAULT (datetime('now')),
      batch_status     TEXT DEFAULT 'available' CHECK(batch_status IN ('available','depleted','reserved')),
      notes            TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wo_fabric_batches (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id                   INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      batch_id                INTEGER NOT NULL REFERENCES fabric_inventory_batches(id),
      fabric_code             TEXT NOT NULL REFERENCES fabrics(code),
      role                    TEXT NOT NULL CHECK(role IN ('main','lining')),
      planned_meters_per_piece REAL NOT NULL DEFAULT 1,
      planned_total_meters    REAL NOT NULL DEFAULT 0,
      waste_pct               REAL DEFAULT 5,
      actual_meters_per_piece REAL,
      actual_total_meters     REAL,
      waste_meters            REAL DEFAULT 0,
      waste_cost              REAL DEFAULT 0,
      price_per_meter         REAL NOT NULL,
      planned_cost            REAL DEFAULT 0,
      actual_cost             REAL DEFAULT 0,
      color_note              TEXT,
      sort_order              INTEGER DEFAULT 0,
      created_at              TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wo_accessories_detail (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id              INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      accessory_code     TEXT REFERENCES accessories(code),
      accessory_name     TEXT NOT NULL,
      quantity_per_piece REAL NOT NULL DEFAULT 1,
      unit_price         REAL NOT NULL DEFAULT 0,
      planned_total_cost REAL DEFAULT 0,
      actual_quantity    REAL,
      actual_cost        REAL,
      notes              TEXT
    );

    CREATE TABLE IF NOT EXISTS wo_extra_expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id       INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount      REAL NOT NULL,
      stage_id    INTEGER,
      recorded_at TEXT DEFAULT (datetime('now')),
      notes       TEXT
    );

    CREATE TABLE IF NOT EXISTS partial_invoices (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id                   INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      invoice_id              INTEGER REFERENCES invoices(id),
      pieces_invoiced         INTEGER NOT NULL,
      cost_per_piece          REAL NOT NULL,
      invoice_price_per_piece REAL NOT NULL,
      notes                   TEXT,
      created_at              TEXT DEFAULT (datetime('now'))
    );
  `);

  // ═══════════════════════════════════════════════
  // DEFAULT DATA
  // ═══════════════════════════════════════════════
  db.exec(`
    INSERT OR IGNORE INTO settings (key, value) VALUES ('masnaiya_default', '90');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('masrouf_default', '50');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('waste_pct_default', '5');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('margin_default', '25');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('fabric_batch_auto', '1');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_waste_pct', '5');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_masnaiya', '90');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_masrouf', '50');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_margin', '25');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('low_stock_threshold', '20');
  `);

  // Seed default stage templates
  const stageCount = db.prepare('SELECT COUNT(*) as c FROM stage_templates').get().c;
  if (stageCount === 0) {
    const insertStage = db.prepare('INSERT INTO stage_templates (name, color, sort_order, is_default) VALUES (?, ?, ?, 1)');
    const defaultStages = [
      ['استلام قماش', '#3b82f6', 1],
      ['قص', '#8b5cf6', 2],
      ['خياطة', '#f59e0b', 3],
      ['تشطيب', '#10b981', 4],
      ['كي', '#06b6d4', 5],
      ['تغليف', '#a855f7', 6],
      ['مراجعة جودة', '#ef4444', 7],
      ['تسليم', '#22c55e', 8],
    ];
    for (const [name, color, order] of defaultStages) {
      insertStage.run(name, color, order);
    }
  }

  // ═══════════════════════════════════════════════
  // SAFE MIGRATIONS for existing data
  // ═══════════════════════════════════════════════
  runMigrations();

  db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (4)`);

  // ═══════════════════════════════════════════════
  // V5: Users, Auth, Audit Log, HR, Payroll
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      full_name     TEXT NOT NULL,
      email         TEXT,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'viewer'
                    CHECK(role IN ('superadmin','manager','accountant','production','hr','viewer')),
      department    TEXT,
      employee_id   INTEGER REFERENCES employees(id),
      status        TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','suspended')),
      last_login    TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      created_by    INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id),
      username    TEXT NOT NULL,
      action      TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id   TEXT,
      entity_label TEXT,
      old_values  TEXT,
      new_values  TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_code          TEXT UNIQUE NOT NULL,
      full_name         TEXT NOT NULL,
      national_id       TEXT UNIQUE,
      department        TEXT,
      job_title         TEXT,
      employment_type   TEXT DEFAULT 'full_time'
                        CHECK(employment_type IN ('full_time','part_time','daily','piece_work')),
      salary_type       TEXT DEFAULT 'monthly'
                        CHECK(salary_type IN ('monthly','daily','hourly','piece_work')),
      base_salary       REAL DEFAULT 0,
      standard_hours_per_day  REAL DEFAULT 8,
      standard_days_per_month INTEGER DEFAULT 26,
      housing_allowance       REAL DEFAULT 0,
      transport_allowance     REAL DEFAULT 0,
      food_allowance          REAL DEFAULT 0,
      other_allowances        REAL DEFAULT 0,
      social_insurance        REAL DEFAULT 0,
      tax_deduction           REAL DEFAULT 0,
      other_deductions_fixed  REAL DEFAULT 0,
      overtime_rate_multiplier REAL DEFAULT 1.5,
      hire_date         TEXT,
      termination_date  TEXT,
      status            TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','terminated')),
      phone             TEXT,
      address           TEXT,
      bank_account      TEXT,
      notes             TEXT,
      photo             TEXT,
      created_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance_imports (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      import_month  TEXT NOT NULL,
      filename      TEXT NOT NULL,
      imported_by   INTEGER REFERENCES users(id),
      records_count INTEGER DEFAULT 0,
      status        TEXT DEFAULT 'pending' CHECK(status IN ('pending','processed','error')),
      notes         TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER NOT NULL REFERENCES employees(id),
      work_date       TEXT NOT NULL,
      day_of_week     TEXT,
      scheduled_hours REAL DEFAULT 8,
      actual_hours    REAL DEFAULT 0,
      overtime_hours  REAL GENERATED ALWAYS AS (MAX(0.0, actual_hours - scheduled_hours)) STORED,
      attendance_status TEXT DEFAULT 'present'
                        CHECK(attendance_status IN ('present','absent','late','half_day','holiday','leave')),
      late_minutes    INTEGER DEFAULT 0,
      import_batch_id INTEGER REFERENCES attendance_imports(id),
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(employee_id, work_date)
    );

    CREATE TABLE IF NOT EXISTS payroll_periods (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      period_month  TEXT NOT NULL UNIQUE,
      period_name   TEXT,
      status        TEXT DEFAULT 'open'
                    CHECK(status IN ('open','calculated','approved','paid','locked')),
      total_gross   REAL DEFAULT 0,
      total_net     REAL DEFAULT 0,
      total_deductions REAL DEFAULT 0,
      notes         TEXT,
      calculated_at TEXT,
      approved_by   INTEGER REFERENCES users(id),
      approved_at   TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payroll_records (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id       INTEGER NOT NULL REFERENCES payroll_periods(id),
      employee_id     INTEGER NOT NULL REFERENCES employees(id),
      days_worked     REAL DEFAULT 0,
      hours_worked    REAL DEFAULT 0,
      overtime_hours  REAL DEFAULT 0,
      absent_days     REAL DEFAULT 0,
      base_pay        REAL DEFAULT 0,
      overtime_pay    REAL DEFAULT 0,
      housing_allowance     REAL DEFAULT 0,
      transport_allowance   REAL DEFAULT 0,
      food_allowance        REAL DEFAULT 0,
      other_allowances      REAL DEFAULT 0,
      bonuses         REAL DEFAULT 0,
      gross_pay       REAL DEFAULT 0,
      absence_deduction     REAL DEFAULT 0,
      late_deduction        REAL DEFAULT 0,
      social_insurance      REAL DEFAULT 0,
      tax_deduction         REAL DEFAULT 0,
      loans_deduction       REAL DEFAULT 0,
      other_deductions      REAL DEFAULT 0,
      total_deductions      REAL DEFAULT 0,
      net_pay         REAL DEFAULT 0,
      payment_status  TEXT DEFAULT 'pending'
                      CHECK(payment_status IN ('pending','paid','hold')),
      payment_date    TEXT,
      payment_method  TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash','bank','check')),
      notes           TEXT,
      UNIQUE(period_id, employee_id)
    );

    CREATE TABLE IF NOT EXISTS hr_adjustments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id   INTEGER NOT NULL REFERENCES employees(id),
      period_id     INTEGER REFERENCES payroll_periods(id),
      adj_type      TEXT NOT NULL
                    CHECK(adj_type IN ('bonus','deduction','loan','loan_repayment','advance')),
      amount        REAL NOT NULL,
      description   TEXT NOT NULL,
      applied       INTEGER DEFAULT 0,
      created_by    INTEGER REFERENCES users(id),
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (5)`);

  // ═══════════════════════════════════════════════
  // V6: Granular Permission System
  // ═══════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS permission_definitions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      module       TEXT NOT NULL,
      action       TEXT NOT NULL,
      label_ar     TEXT NOT NULL,
      description_ar TEXT,
      sort_order   INTEGER DEFAULT 0,
      UNIQUE(module, action)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      role     TEXT NOT NULL,
      module   TEXT NOT NULL,
      action   TEXT NOT NULL,
      allowed  INTEGER DEFAULT 0,
      UNIQUE(role, module, action)
    );

    CREATE TABLE IF NOT EXISTS user_permissions (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module   TEXT NOT NULL,
      action   TEXT NOT NULL,
      allowed  INTEGER NOT NULL,
      UNIQUE(user_id, module, action)
    );
  `);

  // Seed permission definitions
  const permDefCount = db.prepare('SELECT COUNT(*) as c FROM permission_definitions').get().c;
  if (permDefCount === 0) {
    const insPD = db.prepare('INSERT OR IGNORE INTO permission_definitions (module, action, label_ar, description_ar, sort_order) VALUES (?,?,?,?,?)');
    const permDefs = [
      ['dashboard',      'view',    'عرض لوحة التحكم',        'الوصول للوحة التحكم الرئيسية',    1],
      ['models',         'view',    'عرض الموديلات',          'عرض قائمة الموديلات وتفاصيلها',  10],
      ['models',         'create',  'إنشاء موديل',           'إنشاء موديلات جديدة',            11],
      ['models',         'edit',    'تعديل موديل',           'تعديل بيانات الموديلات',          12],
      ['models',         'delete',  'حذف موديل',             'حذف وتعطيل الموديلات',           13],
      ['fabrics',        'view',    'عرض الأقمشة',           'عرض قائمة الأقمشة والمخزون',     20],
      ['fabrics',        'create',  'إضافة قماش',            'إضافة أقمشة جديدة للمخزون',      21],
      ['fabrics',        'edit',    'تعديل قماش',            'تعديل بيانات الأقمشة',           22],
      ['fabrics',        'delete',  'حذف قماش',              'حذف وتعطيل الأقمشة',            23],
      ['accessories',    'view',    'عرض الاكسسوارات',       'عرض قائمة الاكسسوارات',          30],
      ['accessories',    'create',  'إضافة اكسسوار',         'إضافة اكسسوارات جديدة',          31],
      ['accessories',    'edit',    'تعديل اكسسوار',         'تعديل بيانات الاكسسوارات',       32],
      ['accessories',    'delete',  'حذف اكسسوار',           'حذف وتعطيل الاكسسوارات',        33],
      ['work_orders',    'view',    'عرض أوامر الإنتاج',     'عرض قائمة أوامر العمل وتفاصيلها', 40],
      ['work_orders',    'create',  'إنشاء أمر إنتاج',       'إنشاء أوامر عمل جديدة',          41],
      ['work_orders',    'edit',    'تعديل أمر إنتاج',       'تعديل أوامر العمل والمراحل',     42],
      ['work_orders',    'delete',  'إلغاء أمر إنتاج',       'إلغاء وحذف أوامر العمل',        43],
      ['invoices',       'view',    'عرض الفواتير',          'عرض قائمة الفواتير والتفاصيل',   50],
      ['invoices',       'create',  'إنشاء فاتورة',          'إنشاء فواتير جديدة',             51],
      ['invoices',       'edit',    'تعديل فاتورة',          'تعديل بيانات الفواتير',          52],
      ['invoices',       'delete',  'حذف فاتورة',            'حذف الفواتير',                   53],
      ['suppliers',      'view',    'عرض الموردين',          'عرض قائمة الموردين',             60],
      ['suppliers',      'create',  'إضافة مورد',            'إضافة موردين جدد',               61],
      ['suppliers',      'edit',    'تعديل مورد',            'تعديل بيانات الموردين',          62],
      ['suppliers',      'delete',  'حذف مورد',              'حذف وتعطيل الموردين',           63],
      ['purchase_orders','view',    'عرض أوامر الشراء',      'عرض أوامر الشراء والتفاصيل',     70],
      ['purchase_orders','create',  'إنشاء أمر شراء',        'إنشاء أوامر شراء جديدة',         71],
      ['purchase_orders','edit',    'تعديل أمر شراء',        'تعديل أوامر الشراء',             72],
      ['purchase_orders','delete',  'إلغاء أمر شراء',        'إلغاء أوامر الشراء',             73],
      ['inventory',      'view',    'عرض المخزون',           'عرض مخزون الأقمشة والدفعات',     80],
      ['reports',        'view',    'عرض التقارير',          'الوصول لمركز التقارير',           90],
      ['reports',        'export',  'تصدير التقارير',        'تصدير التقارير لـ Excel',         91],
      ['hr',             'view',    'عرض الموارد البشرية',   'عرض بيانات الموظفين والحضور',    100],
      ['hr',             'create',  'إنشاء بيانات HR',       'إضافة موظفين وبيانات الحضور',    101],
      ['hr',             'edit',    'تعديل بيانات HR',       'تعديل بيانات الموظفين والحضور',  102],
      ['hr',             'delete',  'حذف بيانات HR',         'حذف بيانات الموارد البشرية',     103],
      ['payroll',        'view',    'عرض الرواتب',           'عرض مسيرات الرواتب',             110],
      ['payroll',        'manage',  'إدارة الرواتب',         'حساب واعتماد وصرف الرواتب',      111],
      ['users',          'view',    'عرض المستخدمين',        'عرض قائمة المستخدمين',           120],
      ['users',          'create',  'إنشاء مستخدم',          'إنشاء حسابات مستخدمين جديدة',    121],
      ['users',          'edit',    'تعديل مستخدم',          'تعديل بيانات المستخدمين',        122],
      ['users',          'delete',  'حذف مستخدم',            'تعطيل حسابات المستخدمين',        123],
      ['audit',          'view',    'عرض سجل المراجعة',      'عرض سجل العمليات والتغييرات',    130],
      ['settings',       'view',    'عرض الإعدادات',         'عرض إعدادات النظام',             140],
      ['settings',       'edit',    'تعديل الإعدادات',       'تعديل إعدادات النظام',           141],
    ];
    for (const p of permDefs) { insPD.run(...p); }

    // Seed role_permissions (defaults)
    const insRP = db.prepare('INSERT OR IGNORE INTO role_permissions (role, module, action, allowed) VALUES (?,?,?,?)');
    const roles = {
      superadmin: '*',  // all permissions
      manager: [
        'dashboard:view','models:*','fabrics:*','accessories:*','work_orders:*',
        'invoices:*','suppliers:*','purchase_orders:*','inventory:view',
        'reports:*','hr:*','payroll:*','users:view','audit:view','settings:*'
      ],
      accountant: [
        'dashboard:view','models:view','fabrics:view','accessories:view','work_orders:view',
        'invoices:*','suppliers:*','purchase_orders:*','inventory:view',
        'reports:*','payroll:view'
      ],
      production: [
        'dashboard:view','models:*','fabrics:*','accessories:*','work_orders:*',
        'inventory:view','reports:view'
      ],
      hr: [
        'dashboard:view','hr:*','payroll:*','reports:view'
      ],
      viewer: [
        'dashboard:view','models:view','fabrics:view','accessories:view','work_orders:view',
        'invoices:view','suppliers:view','purchase_orders:view','inventory:view',
        'reports:view'
      ],
    };

    // Expand wildcard permissions and insert
    const allModules = [...new Set(permDefs.map(p => p[0]))];
    const allActions = {};
    for (const p of permDefs) {
      if (!allActions[p[0]]) allActions[p[0]] = [];
      allActions[p[0]].push(p[1]);
    }

    for (const [role, perms] of Object.entries(roles)) {
      if (perms === '*') {
        // superadmin gets everything
        for (const mod of allModules) {
          for (const act of allActions[mod]) {
            insRP.run(role, mod, act, 1);
          }
        }
      } else {
        // First, set all to 0
        for (const mod of allModules) {
          for (const act of allActions[mod]) {
            insRP.run(role, mod, act, 0);
          }
        }
        // Then enable specified
        for (const perm of perms) {
          const [mod, act] = perm.split(':');
          if (act === '*') {
            for (const a of (allActions[mod] || [])) {
              db.prepare('UPDATE role_permissions SET allowed=1 WHERE role=? AND module=? AND action=?').run(role, mod, a);
            }
          } else {
            db.prepare('UPDATE role_permissions SET allowed=1 WHERE role=? AND module=? AND action=?').run(role, mod, act);
          }
        }
      }
    }
  }

  db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (6)`);
}

function runMigrations() {
  const currentVersion = (() => {
    try {
      const row = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get();
      return row?.v || 0;
    } catch { return 0; }
  })();

  if (currentVersion < 3) {
    // Migration: Add new columns to existing tables safely
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch {}
    };

    // Models: add category, gender, updated_at if missing
    addColumnSafe('models', 'category', "TEXT");
    addColumnSafe('models', 'gender', "TEXT DEFAULT 'unisex'");
    addColumnSafe('models', 'updated_at', "TEXT DEFAULT (datetime('now'))");

    // Fabrics: add supplier_id if missing
    addColumnSafe('fabrics', 'supplier_id', 'INTEGER REFERENCES suppliers(id)');

    // Accessories: add supplier_id if missing
    addColumnSafe('accessories', 'supplier_id', 'INTEGER REFERENCES suppliers(id)');

    // Invoices: add wo_id if missing
    addColumnSafe('invoices', 'wo_id', 'INTEGER REFERENCES work_orders(id)');

    // Suppliers: add supplier_type, contact_name if table exists with old schema
    addColumnSafe('suppliers', 'supplier_type', "TEXT DEFAULT 'both'");
    addColumnSafe('suppliers', 'contact_name', 'TEXT');

    // Purchase orders: add po_type, order_date, total_amount, paid_amount
    addColumnSafe('purchase_orders', 'po_type', "TEXT DEFAULT 'fabric'");
    addColumnSafe('purchase_orders', 'order_date', "TEXT DEFAULT (datetime('now'))");
    addColumnSafe('purchase_orders', 'total_amount', 'REAL DEFAULT 0');
    addColumnSafe('purchase_orders', 'paid_amount', 'REAL DEFAULT 0');

    // Work orders: add template_id, masnaiya, masrouf, margin_pct, consumer_price, wholesale_price, completed_date
    addColumnSafe('work_orders', 'template_id', 'INTEGER');
    addColumnSafe('work_orders', 'masnaiya', 'REAL DEFAULT 90');
    addColumnSafe('work_orders', 'masrouf', 'REAL DEFAULT 50');
    addColumnSafe('work_orders', 'margin_pct', 'REAL DEFAULT 25');
    addColumnSafe('work_orders', 'consumer_price', 'REAL');
    addColumnSafe('work_orders', 'wholesale_price', 'REAL');
    addColumnSafe('work_orders', 'completed_date', 'TEXT');

    // Cost snapshots: add wo_id if missing
    addColumnSafe('cost_snapshots', 'wo_id', 'INTEGER');

    // Migrate existing model data into BOM templates if model_fabrics exist
    try {
      const hasModelFabrics = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='model_fabrics'").get();
      if (hasModelFabrics) {
        const modelsWithFabrics = db.prepare(`
          SELECT DISTINCT m.id FROM models m
          INNER JOIN model_fabrics mf ON mf.model_id = m.id
          WHERE m.id NOT IN (SELECT model_id FROM bom_templates WHERE model_id IS NOT NULL)
        `).all();

        for (const { id: modelId } of modelsWithFabrics) {
          const model = db.prepare('SELECT masnaiya, masrouf FROM models WHERE id = ?').get(modelId);
          const tmpl = db.prepare(`
            INSERT INTO bom_templates (model_id, template_name, is_default, masnaiya, masrouf, margin_pct)
            VALUES (?, 'الافتراضي', 1, ?, ?, 25)
          `).run(modelId, model?.masnaiya || 90, model?.masrouf || 50);
          const templateId = tmpl.lastInsertRowid;

          // Copy model_fabrics → bom_template_fabrics
          const fabrics = db.prepare('SELECT * FROM model_fabrics WHERE model_id = ?').all(modelId);
          const insertFab = db.prepare('INSERT INTO bom_template_fabrics (template_id, fabric_code, role, meters_per_piece, waste_pct, color_note, sort_order) VALUES (?,?,?,?,?,?,?)');
          for (const f of fabrics) {
            insertFab.run(templateId, f.fabric_code, f.role, f.meters_per_piece, f.waste_pct, f.color_note, f.sort_order);
          }

          // Copy model_accessories → bom_template_accessories
          const accs = db.prepare('SELECT * FROM model_accessories WHERE model_id = ?').all(modelId);
          const insertAcc = db.prepare('INSERT INTO bom_template_accessories (template_id, accessory_code, accessory_name, quantity, unit_price, notes) VALUES (?,?,?,?,?,?)');
          for (const a of accs) {
            insertAcc.run(templateId, a.accessory_code, a.accessory_name, a.quantity, a.unit_price, a.notes);
          }

          // Copy model_sizes → bom_template_sizes
          const sizes = db.prepare('SELECT * FROM model_sizes WHERE model_id = ?').all(modelId);
          const insertSz = db.prepare('INSERT INTO bom_template_sizes (template_id, color_label, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl) VALUES (?,?,?,?,?,?,?,?)');
          for (const s of sizes) {
            insertSz.run(templateId, s.color_label, s.qty_s, s.qty_m, s.qty_l, s.qty_xl, s.qty_2xl, s.qty_3xl);
          }
        }
      }
    } catch {}

    // Migrate old work_order_stages → wo_stages
    try {
      const hasOldStages = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='work_order_stages'").get();
      if (hasOldStages) {
        const oldStages = db.prepare(`
          SELECT wos.*, ps.name as stage_name, ps.sort_order
          FROM work_order_stages wos
          LEFT JOIN production_stages ps ON ps.id = wos.stage_id
          WHERE wos.work_order_id NOT IN (SELECT DISTINCT wo_id FROM wo_stages WHERE wo_id IS NOT NULL)
        `).all();
        const insertWoStage = db.prepare('INSERT INTO wo_stages (wo_id, stage_name, sort_order, status, started_at, completed_at) VALUES (?,?,?,?,?,?)');
        for (const s of oldStages) {
          insertWoStage.run(s.work_order_id, s.stage_name || 'مرحلة', s.sort_order || 0, s.status, s.started_at, s.completed_at);
        }
      }
    } catch {}

    // Migrate old bom_variants → bom_templates if needed
    try {
      const hasOldVariants = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bom_variants'").get();
      const hasBomTemplates = db.prepare("SELECT COUNT(*) as c FROM bom_templates").get().c;
      if (hasOldVariants && hasBomTemplates === 0) {
        const oldVariants = db.prepare('SELECT * FROM bom_variants').all();
        for (const v of oldVariants) {
          const tmpl = db.prepare(`INSERT INTO bom_templates (model_id, template_name, is_default, notes) VALUES (?,?,?,?)`).run(v.model_id, v.name, v.is_default, v.notes);
          const tid = tmpl.lastInsertRowid;
          const oldFabs = db.prepare('SELECT * FROM bom_variant_fabrics WHERE variant_id = ?').all(v.id);
          for (const f of oldFabs) {
            db.prepare('INSERT INTO bom_template_fabrics (template_id, fabric_code, role, meters_per_piece, waste_pct, color_note, sort_order) VALUES (?,?,?,?,?,?,?)').run(tid, f.fabric_code, f.role, f.meters_per_piece, f.waste_pct, f.color_note, f.sort_order);
          }
          const oldAccs = db.prepare('SELECT * FROM bom_variant_accessories WHERE variant_id = ?').all(v.id);
          for (const a of oldAccs) {
            db.prepare('INSERT INTO bom_template_accessories (template_id, accessory_code, accessory_name, quantity, unit_price, notes) VALUES (?,?,?,?,?,?)').run(tid, a.accessory_code, a.accessory_name, a.quantity, a.unit_price, a.notes);
          }
        }
      }
    } catch {}

    // Migrate production_stages → stage_templates
    try {
      const hasOldPS = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='production_stages'").get();
      const stCount = db.prepare('SELECT COUNT(*) as c FROM stage_templates').get().c;
      if (hasOldPS && stCount === 0) {
        const oldPS = db.prepare('SELECT * FROM production_stages WHERE is_active = 1 ORDER BY sort_order').all();
        for (const s of oldPS) {
          db.prepare('INSERT OR IGNORE INTO stage_templates (name, color, sort_order, is_default) VALUES (?,?,?,1)').run(s.name, s.color, s.sort_order);
        }
      }
    } catch {}
  }

  // ═══════════════════════════════════════════════
  // V4 Migrations: New columns for batch tracking, WIP, partial invoicing
  // ═══════════════════════════════════════════════
  if (currentVersion < 4) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch {}
    };

    // Work orders: production tracking columns
    addColumnSafe('work_orders', 'quantity', 'INTEGER DEFAULT 0');
    addColumnSafe('work_orders', 'pieces_completed', 'INTEGER DEFAULT 0');
    addColumnSafe('work_orders', 'actual_cost_per_piece', 'REAL');
    addColumnSafe('work_orders', 'waste_cost_total', 'REAL DEFAULT 0');
    addColumnSafe('work_orders', 'extra_expenses_total', 'REAL DEFAULT 0');
    addColumnSafe('work_orders', 'is_size_based', 'INTEGER DEFAULT 0');

    // WO stages: WIP quantities
    addColumnSafe('wo_stages', 'quantity_in_stage', 'INTEGER DEFAULT 0');
    addColumnSafe('wo_stages', 'quantity_completed', 'INTEGER DEFAULT 0');

    // Purchase order items: receiving variance
    addColumnSafe('purchase_order_items', 'received_qty_actual', 'REAL DEFAULT 0');
    addColumnSafe('purchase_order_items', 'quantity_variance', 'REAL DEFAULT 0');

    // Cost snapshots: new columns
    addColumnSafe('cost_snapshots', 'waste_cost', 'REAL DEFAULT 0');
    addColumnSafe('cost_snapshots', 'extra_expenses', 'REAL DEFAULT 0');
  }
}

initializeDatabase();

module.exports = db;
