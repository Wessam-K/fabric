const Database = require('better-sqlite3');
const path = require('path');

const dbDir = process.env.WK_DB_DIR || __dirname;
const dbPath = path.join(dbDir, 'wk-hub.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');
db.pragma('temp_store = MEMORY');

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
      status          TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','partially_paid','overdue','cancelled')),
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
    -- Removed duplicate default_* keys; canonical keys are masnaiya_default, masrouf_default, waste_pct_default, margin_default
    INSERT OR IGNORE INTO settings (key, value) VALUES ('low_stock_threshold', '20');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_rate', '14');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('working_hours_per_day', '8');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('working_days_per_month', '26');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_overtime_multiplier', '1.5');
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
      created_by    INTEGER REFERENCES users(id),
      must_change_password   INTEGER DEFAULT 0,
      failed_login_attempts  INTEGER DEFAULT 0,
      locked_until           TEXT,
      password_changed_at    TEXT
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

  // ═══════════════════════════════════════════════
  // V7 — Unified WIP Stage Panel + Movement Log
  // ═══════════════════════════════════════════════
  if (currentVersion < 7) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch {}
    };

    // wo_stages: track who started/completed + rejection count
    addColumnSafe('wo_stages', 'started_by_user_id', 'INTEGER REFERENCES users(id)');
    addColumnSafe('wo_stages', 'started_by_name', 'TEXT');
    addColumnSafe('wo_stages', 'completed_by_user_id', 'INTEGER REFERENCES users(id)');
    addColumnSafe('wo_stages', 'completed_by_name', 'TEXT');
    addColumnSafe('wo_stages', 'quantity_rejected', 'INTEGER DEFAULT 0');

    // Stage movement log table
    db.exec(`
      CREATE TABLE IF NOT EXISTS stage_movement_log (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        wo_id             INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        from_stage_id     INTEGER REFERENCES wo_stages(id),
        to_stage_id       INTEGER REFERENCES wo_stages(id),
        from_stage_name   TEXT,
        to_stage_name     TEXT,
        qty_moved         INTEGER NOT NULL DEFAULT 0,
        qty_rejected      INTEGER NOT NULL DEFAULT 0,
        rejection_reason  TEXT,
        moved_by_user_id  INTEGER REFERENCES users(id),
        moved_by_name     TEXT,
        moved_at          TEXT DEFAULT (datetime('now','localtime')),
        notes             TEXT
      );
    `);

    // One-time fix: set first stage quantity_in_stage = wo.quantity for existing WOs
    const brokenWOs = db.prepare(`
      SELECT wo.id, wo.quantity FROM work_orders wo
      WHERE wo.status IN ('draft','in_progress')
        AND wo.quantity > 0
        AND EXISTS (
          SELECT 1 FROM wo_stages ws WHERE ws.wo_id = wo.id AND ws.sort_order = (
            SELECT MIN(sort_order) FROM wo_stages WHERE wo_id = wo.id
          ) AND (ws.quantity_in_stage IS NULL OR ws.quantity_in_stage = 0)
        )
    `).all();
    for (const w of brokenWOs) {
      const firstStage = db.prepare('SELECT id FROM wo_stages WHERE wo_id=? ORDER BY sort_order LIMIT 1').get(w.id);
      if (firstStage) {
        db.prepare('UPDATE wo_stages SET quantity_in_stage=? WHERE id=?').run(w.quantity, firstStage.id);
      }
    }

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (7)`);
  }

  // ═══════════════════════════════════════════════
  // V8 — Fabric Consumption Tracking, Waste, Partial Invoicing Bridge, PO Variance
  // ═══════════════════════════════════════════════
  if (currentVersion < 8) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch {}
    };

    // wo_fabric_consumption: actual fabric used per WO, linked to PO batch
    db.exec(`
      CREATE TABLE IF NOT EXISTS wo_fabric_consumption (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        fabric_id INTEGER NOT NULL,
        fabric_code TEXT,
        po_id INTEGER REFERENCES purchase_orders(id),
        po_line_id INTEGER REFERENCES purchase_order_items(id),
        batch_id INTEGER REFERENCES fabric_inventory_batches(id),
        planned_meters REAL NOT NULL DEFAULT 0,
        actual_meters REAL,
        price_per_meter REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        notes TEXT,
        recorded_by_user_id INTEGER REFERENCES users(id),
        recorded_at TEXT DEFAULT (datetime('now','localtime')),
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // wo_accessory_consumption: actual accessories used per WO
    db.exec(`
      CREATE TABLE IF NOT EXISTS wo_accessory_consumption (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        accessory_id INTEGER NOT NULL,
        accessory_code TEXT,
        planned_qty REAL NOT NULL DEFAULT 0,
        actual_qty REAL,
        unit_price REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        recorded_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // wo_waste: per-WO waste record
    db.exec(`
      CREATE TABLE IF NOT EXISTS wo_waste (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        waste_meters REAL NOT NULL DEFAULT 0,
        price_per_meter REAL NOT NULL DEFAULT 0,
        waste_cost REAL DEFAULT 0,
        notes TEXT,
        recorded_by_user_id INTEGER REFERENCES users(id),
        recorded_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // wo_invoices bridge: link WO partial invoices to real invoices
    db.exec(`
      CREATE TABLE IF NOT EXISTS wo_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id),
        qty_invoiced INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // work_orders: new cost columns
    addColumnSafe('work_orders', 'total_production_cost', 'REAL DEFAULT 0');
    addColumnSafe('work_orders', 'cost_per_piece', 'REAL DEFAULT 0');
    addColumnSafe('work_orders', 'waste_cost_per_piece', 'REAL DEFAULT 0');
    addColumnSafe('work_orders', 'total_invoiced_qty', 'INTEGER DEFAULT 0');
    addColumnSafe('work_orders', 'completed_by_user_id', 'INTEGER REFERENCES users(id)');
    addColumnSafe('work_orders', 'waste_cost_total', 'REAL DEFAULT 0');

    // purchase_order_items: variance notes
    addColumnSafe('purchase_order_items', 'variance_notes', 'TEXT');

    // purchase_orders: received_by_user_id
    addColumnSafe('purchase_orders', 'received_by_user_id', 'INTEGER REFERENCES users(id)');

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (8)`);
  }

  // ═══════════════════════════════════════════════
  // V9 — Customers, Accessory Stock, Notifications, WO Cancel, Fabric Stock Movements
  // ═══════════════════════════════════════════════
  if (currentVersion < 9) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch {}
    };

    // 1.1 Customers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        code         TEXT UNIQUE NOT NULL,
        name         TEXT NOT NULL,
        phone        TEXT,
        email        TEXT,
        address      TEXT,
        city         TEXT,
        tax_number   TEXT,
        credit_limit REAL DEFAULT 0,
        balance      REAL DEFAULT 0,
        notes        TEXT,
        status       TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
        created_at   TEXT DEFAULT (datetime('now')),
        updated_at   TEXT DEFAULT (datetime('now'))
      );
    `);

    // 1.2 customer_id FK on work_orders and invoices
    addColumnSafe('work_orders', 'customer_id', 'INTEGER REFERENCES customers(id)');
    addColumnSafe('invoices', 'customer_id', 'INTEGER REFERENCES customers(id)');

    // 1.3 Accessory stock tracking columns
    addColumnSafe('accessories', 'quantity_on_hand', 'REAL DEFAULT 0');
    addColumnSafe('accessories', 'low_stock_threshold', 'REAL DEFAULT 10');
    addColumnSafe('accessories', 'reorder_qty', 'REAL DEFAULT 50');

    // Fabric stock tracking columns
    addColumnSafe('fabrics', 'available_meters', 'REAL DEFAULT 0');
    addColumnSafe('fabrics', 'low_stock_threshold', 'REAL DEFAULT 20');

    // Accessory stock movements
    db.exec(`
      CREATE TABLE IF NOT EXISTS accessory_stock_movements (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        accessory_code  TEXT NOT NULL REFERENCES accessories(code),
        movement_type   TEXT NOT NULL CHECK(movement_type IN ('in','out','adjustment','return')),
        qty             REAL NOT NULL,
        reference_type  TEXT,
        reference_id    INTEGER,
        notes           TEXT,
        created_by      INTEGER REFERENCES users(id),
        created_at      TEXT DEFAULT (datetime('now'))
      );
    `);

    // 1.4 Notifications table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER REFERENCES users(id),
        type           TEXT NOT NULL,
        title          TEXT NOT NULL,
        body           TEXT NOT NULL,
        reference_type TEXT,
        reference_id   INTEGER,
        is_read        INTEGER DEFAULT 0,
        created_at     TEXT DEFAULT (datetime('now'))
      );
    `);

    // 1.5 Fabric stock movements
    db.exec(`
      CREATE TABLE IF NOT EXISTS fabric_stock_movements (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        fabric_code     TEXT NOT NULL REFERENCES fabrics(code),
        movement_type   TEXT NOT NULL CHECK(movement_type IN ('in','out','adjustment','return','waste')),
        qty_meters      REAL NOT NULL,
        batch_id        INTEGER REFERENCES fabric_inventory_batches(id),
        reference_type  TEXT,
        reference_id    INTEGER,
        notes           TEXT,
        created_by      INTEGER REFERENCES users(id),
        created_at      TEXT DEFAULT (datetime('now'))
      );
    `);

    // 1.6 WO cancellation columns
    addColumnSafe('work_orders', 'cancel_reason', 'TEXT');
    addColumnSafe('work_orders', 'cancelled_by', 'INTEGER REFERENCES users(id)');
    addColumnSafe('work_orders', 'cancelled_at', 'TEXT');

    // 1.7 Ensure notifications has user_id
    addColumnSafe('notifications', 'user_id', 'INTEGER REFERENCES users(id)');

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (9)`);
  }

  // ═══════════════════════════════════════════════
  // V10 — Customers enhancement, QC, Machines, Accessory batches, Customer payments
  // ═══════════════════════════════════════════════
  if (currentVersion < 10) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch {}
    };

    // 10.1 Enhance customers table with missing columns
    addColumnSafe('customers', 'customer_type', "TEXT DEFAULT 'wholesale'");
    addColumnSafe('customers', 'contact_name', 'TEXT');
    addColumnSafe('customers', 'payment_terms', 'TEXT');

    // 10.2 Quality control checkpoints per stage
    db.exec(`
      CREATE TABLE IF NOT EXISTS wo_stage_qc (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        wo_id          INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        stage_id       INTEGER NOT NULL REFERENCES wo_stages(id) ON DELETE CASCADE,
        checked_by     INTEGER REFERENCES users(id),
        checked_at     TEXT DEFAULT (datetime('now','localtime')),
        items_checked  INTEGER NOT NULL DEFAULT 0,
        items_passed   INTEGER NOT NULL DEFAULT 0,
        items_failed   INTEGER NOT NULL DEFAULT 0,
        defect_notes   TEXT,
        qc_status      TEXT DEFAULT 'pending' CHECK(qc_status IN ('pending','passed','failed','partial'))
      );
    `);

    // 10.3 Machines / work centers
    // Drop old schema if it exists with restrictive CHECK constraint
    try {
      const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='machines'").get();
      if (info && info.sql && info.sql.includes("CHECK(machine_type IN")) {
        const count = db.prepare('SELECT COUNT(*) as c FROM machines').get().c;
        if (count === 0) {
          db.exec('DROP TABLE IF EXISTS machines');
        }
      }
    } catch {}
    db.exec(`
      CREATE TABLE IF NOT EXISTS machines (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        code            TEXT UNIQUE NOT NULL,
        name            TEXT NOT NULL,
        machine_type    TEXT DEFAULT 'other',
        location        TEXT,
        capacity_per_hour REAL,
        cost_per_hour   REAL,
        status          TEXT DEFAULT 'active' CHECK(status IN ('active','maintenance','inactive')),
        notes           TEXT,
        sort_order      INTEGER DEFAULT 0,
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now'))
      );
    `);
    // Ensure columns exist for DBs created with older schema
    addColumnSafe('machines', 'location', 'TEXT');
    addColumnSafe('machines', 'capacity_per_hour', 'REAL');
    addColumnSafe('machines', 'cost_per_hour', 'REAL');
    addColumnSafe('machines', 'sort_order', 'INTEGER DEFAULT 0');
    addColumnSafe('machines', 'updated_at', "TEXT DEFAULT (datetime('now'))");

    // 10.4 Link wo_stages to machines + add efficiency tracking
    addColumnSafe('wo_stages', 'machine_id', 'INTEGER REFERENCES machines(id)');
    addColumnSafe('wo_stages', 'color_variant', 'TEXT');
    addColumnSafe('wo_stages', 'planned_hours', 'REAL DEFAULT 0');
    addColumnSafe('wo_stages', 'actual_hours', 'REAL DEFAULT 0');

    // 10.5 Accessory inventory batches
    db.exec(`
      CREATE TABLE IF NOT EXISTS accessory_inventory_batches (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_code       TEXT UNIQUE NOT NULL,
        accessory_code   TEXT NOT NULL REFERENCES accessories(code),
        po_id            INTEGER REFERENCES purchase_orders(id),
        po_item_id       INTEGER REFERENCES purchase_order_items(id),
        supplier_id      INTEGER REFERENCES suppliers(id),
        ordered_qty      REAL NOT NULL DEFAULT 0,
        received_qty     REAL NOT NULL DEFAULT 0,
        used_qty         REAL NOT NULL DEFAULT 0,
        price_per_unit   REAL NOT NULL DEFAULT 0,
        unit             TEXT DEFAULT 'piece',
        batch_status     TEXT DEFAULT 'available' CHECK(batch_status IN ('available','depleted','reserved')),
        received_date    TEXT DEFAULT (datetime('now')),
        notes            TEXT,
        created_at       TEXT DEFAULT (datetime('now'))
      );
    `);

    // 10.6 Customer payments / receivables
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_payments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id     INTEGER NOT NULL REFERENCES customers(id),
        invoice_id      INTEGER REFERENCES invoices(id),
        amount          REAL NOT NULL,
        payment_date    TEXT DEFAULT (datetime('now')),
        payment_method  TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash','bank','check','other')),
        reference       TEXT,
        notes           TEXT,
        created_by      INTEGER REFERENCES users(id),
        created_at      TEXT DEFAULT (datetime('now'))
      );
    `);

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (10)`);

    // 10.7 Add new permission definitions for customers and machines
    try {
    const insPD10 = db.prepare('INSERT OR IGNORE INTO permission_definitions (module, action, label_ar, description_ar, sort_order) VALUES (?,?,?,?,?)');
    const newPerms = [
      ['customers', 'view',   'عرض العملاء',   'عرض قائمة العملاء',    65],
      ['customers', 'create', 'إضافة عميل',    'إضافة عملاء جدد',      66],
      ['customers', 'edit',   'تعديل عميل',    'تعديل بيانات العملاء',  67],
      ['customers', 'delete', 'حذف عميل',      'حذف وتعطيل العملاء',   68],
      ['machines',  'view',   'عرض الآلات',    'عرض قائمة الآلات',      75],
      ['machines',  'manage', 'إدارة الآلات',  'إضافة وتعديل الآلات',   76],
    ];
    for (const p of newPerms) { insPD10.run(...p); }

    // Grant new permissions to relevant roles
    const insRP10 = db.prepare('INSERT OR IGNORE INTO role_permissions (role, module, action, allowed) VALUES (?,?,?,?)');
    const custRoles = ['superadmin','manager','accountant'];
    for (const role of custRoles) {
      insRP10.run(role, 'customers', 'view', 1);
      insRP10.run(role, 'customers', 'create', 1);
      insRP10.run(role, 'customers', 'edit', 1);
      insRP10.run(role, 'customers', 'delete', 1);
    }
    insRP10.run('production', 'customers', 'view', 1);
    insRP10.run('viewer', 'customers', 'view', 1);
    const machRoles = ['superadmin','manager','production'];
    for (const role of machRoles) {
      insRP10.run(role, 'machines', 'view', 1);
      insRP10.run(role, 'machines', 'manage', 1);
    }
    } catch {} // permission_definitions may not exist on fresh DB — created in V6 after runMigrations
  }

  // ═══════════════════════════════════════════════
  // V11 — Work order tracking enhancements, model production summary view
  // ═══════════════════════════════════════════════
  if (currentVersion < 11) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch {}
    };

    // 11.1 Work order stage tracking columns
    addColumnSafe('work_orders', 'last_active_stage_name', 'TEXT');
    addColumnSafe('work_orders', 'fabric_variant_label', 'TEXT');

    // 11.2 Purchase order outstanding amount column
    addColumnSafe('purchase_orders', 'total_outstanding', 'REAL DEFAULT 0');

    // 11.3 Model production summary view
    db.exec(`DROP VIEW IF EXISTS model_production_summary`);
    db.exec(`
      CREATE VIEW IF NOT EXISTS model_production_summary AS
      SELECT
        m.id as model_id,
        m.model_code,
        m.model_name,
        m.category,
        m.gender,
        COUNT(DISTINCT wo.id) as total_wo,
        SUM(CASE WHEN wo.status='completed' THEN 1 ELSE 0 END) as completed_wo,
        SUM(CASE WHEN wo.status='in_progress' THEN 1 ELSE 0 END) as active_wo,
        SUM(CASE WHEN wo.status='draft' THEN 1 ELSE 0 END) as draft_wo,
        SUM(wo.quantity) as total_quantity,
        SUM(wo.pieces_completed) as total_pieces_completed,
        AVG(wo.cost_per_piece) as avg_cost_per_piece,
        MIN(wo.start_date) as earliest_wo_date,
        MAX(wo.completed_date) as latest_completion_date,
        COUNT(DISTINCT bt.id) as bom_template_count
      FROM models m
      LEFT JOIN work_orders wo ON wo.model_id = m.id AND wo.status != 'cancelled'
      LEFT JOIN bom_templates bt ON bt.model_id = m.id
      WHERE m.status = 'active'
      GROUP BY m.id
    `);

    // 11.4 Supplier ledger / payment tracking enhancements
    addColumnSafe('suppliers', 'total_paid', 'REAL DEFAULT 0');
    addColumnSafe('suppliers', 'credit_limit', 'REAL DEFAULT 0');
    addColumnSafe('supplier_payments', 'payment_type', "TEXT DEFAULT 'payment'");

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (11)`);
  }

  // ═══════════════════════════════════════════════
  // V12 — Accessory image support
  // ═══════════════════════════════════════════════
  if (currentVersion < 12) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch {}
    };

    addColumnSafe('accessories', 'image_path', 'TEXT');

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (12)`);
  }

  // ═══════════════════════════════════════════════
  // V13 — Auth hardening: lockout, must_change_password, password history, sessions
  // ═══════════════════════════════════════════════
  if (currentVersion < 13) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch {}
    };

    addColumnSafe('users', 'must_change_password', 'INTEGER DEFAULT 0');
    addColumnSafe('users', 'failed_login_attempts', 'INTEGER DEFAULT 0');
    addColumnSafe('users', 'locked_until', 'TEXT');
    addColumnSafe('users', 'password_changed_at', 'TEXT');

    db.exec(`
      CREATE TABLE IF NOT EXISTS password_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL,
        created_at    TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL,
        ip_address  TEXT,
        user_agent  TEXT,
        created_at  TEXT DEFAULT (datetime('now')),
        expires_at  TEXT,
        revoked     INTEGER DEFAULT 0
      );
    `);

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (13)`);
  }

  // ─── V14: Financial Accounting ────────────────────────
  if (currentVersion < 14) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        code        TEXT NOT NULL UNIQUE,
        name_ar     TEXT NOT NULL,
        type        TEXT NOT NULL CHECK(type IN ('asset','liability','equity','revenue','expense')),
        parent_id   INTEGER REFERENCES chart_of_accounts(id),
        is_active   INTEGER DEFAULT 1,
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_number  TEXT NOT NULL UNIQUE,
        entry_date    TEXT NOT NULL,
        description   TEXT,
        reference     TEXT,
        status        TEXT DEFAULT 'draft' CHECK(status IN ('draft','posted','void')),
        created_by    INTEGER REFERENCES users(id),
        created_at    TEXT DEFAULT (datetime('now')),
        posted_at     TEXT
      );

      CREATE TABLE IF NOT EXISTS journal_entry_lines (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id    INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id  INTEGER NOT NULL REFERENCES chart_of_accounts(id),
        debit       REAL DEFAULT 0,
        credit      REAL DEFAULT 0,
        description TEXT
      );
    `);

    // Seed default chart of accounts
    const coaInsert = db.prepare('INSERT OR IGNORE INTO chart_of_accounts (code, name_ar, type) VALUES (?,?,?)');
    const defaultCOA = [
      ['1000', 'النقدية', 'asset'],
      ['1100', 'البنك', 'asset'],
      ['1200', 'العملاء (ذمم مدينة)', 'asset'],
      ['1300', 'المخزون — أقمشة', 'asset'],
      ['1310', 'المخزون — اكسسوارات', 'asset'],
      ['2000', 'الموردين (ذمم دائنة)', 'liability'],
      ['2100', 'ضريبة القيمة المضافة', 'liability'],
      ['3000', 'رأس المال', 'equity'],
      ['3100', 'الأرباح المحتجزة', 'equity'],
      ['4000', 'إيرادات المبيعات', 'revenue'],
      ['4100', 'إيرادات أخرى', 'revenue'],
      ['5000', 'تكلفة البضاعة المباعة', 'expense'],
      ['5100', 'الرواتب والأجور', 'expense'],
      ['5200', 'مصاريف تشغيلية', 'expense'],
      ['5300', 'مصاريف إدارية', 'expense'],
    ];
    for (const [code, name, type] of defaultCOA) coaInsert.run(code, name, type);

    // Add accounting permissions
    try {
    const insAccPerm = db.prepare('INSERT OR IGNORE INTO permission_definitions (module, action, label_ar, description_ar, sort_order) VALUES (?,?,?,?,?)');
    const accPerms = [
      ['accounting', 'view',   'عرض المحاسبة',     'عرض دليل الحسابات والقيود',  120],
      ['accounting', 'create', 'إنشاء قيود',       'إنشاء قيود يومية جديدة',      121],
      ['accounting', 'edit',   'تعديل قيود',       'تعديل قيود يومية',            122],
      ['accounting', 'post',   'ترحيل قيود',       'ترحيل القيود اليومية',         123],
    ];
    for (const p of accPerms) insAccPerm.run(...p);

    // Grant accounting permissions — V14 used a roles table that doesn't exist,
    // so this block is wrapped in try/catch and harmlessly skips.
    } catch {} // permission_definitions or roles table may not exist

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (14)`);
  }

  // ──── V15 — Leave requests + Machine maintenance ────
  const v15 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 15').get();
  if (!v15) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        leave_type TEXT NOT NULL DEFAULT 'annual',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS machine_maintenance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER NOT NULL REFERENCES machines(id),
        maintenance_type TEXT NOT NULL DEFAULT 'routine',
        description TEXT,
        cost REAL DEFAULT 0,
        performed_by TEXT,
        performed_at TEXT DEFAULT (datetime('now')),
        next_due TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (15)`);
  }

  // ──── V16 — Expenses, Maintenance Orders, Machine enhancements ────
  const v16 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 16').get();
  if (!v16) {
    // 16.1 — Machine columns
    try { db.exec("ALTER TABLE machines ADD COLUMN barcode TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN purchase_date TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN last_maintenance_date TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN next_maintenance_date TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN total_expenses REAL DEFAULT 0"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN machine_value REAL DEFAULT 0"); } catch(e) {}
    // Auto-generate barcodes for machines missing them
    db.exec(`UPDATE machines SET barcode = 'MCH-' || id || '-' || CAST(id*1000+100 AS TEXT) WHERE barcode IS NULL OR barcode = ''`);

    // 16.2 — machine_maintenance enhancements
    try { db.exec("ALTER TABLE machine_maintenance ADD COLUMN title TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machine_maintenance ADD COLUMN status TEXT DEFAULT 'completed'"); } catch(e) {}
    try { db.exec("ALTER TABLE machine_maintenance ADD COLUMN parts_used TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machine_maintenance ADD COLUMN barcode TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machine_maintenance ADD COLUMN created_by INTEGER"); } catch(e) {}
    try { db.exec("ALTER TABLE machine_maintenance ADD COLUMN is_deleted INTEGER DEFAULT 0"); } catch(e) {}

    // 16.3 — expenses table
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_type TEXT NOT NULL DEFAULT 'other'
          CHECK(expense_type IN ('machine','maintenance','salary','utilities','raw_material','production','transport','other')),
        reference_id INTEGER,
        reference_type TEXT,
        amount REAL NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        expense_date TEXT NOT NULL DEFAULT (date('now')),
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        status TEXT DEFAULT 'pending'
          CHECK(status IN ('pending','approved','rejected')),
        receipt_url TEXT,
        notes TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 16.4 — maintenance_orders table
    db.exec(`
      CREATE TABLE IF NOT EXISTS maintenance_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER REFERENCES machines(id),
        maintenance_type TEXT NOT NULL DEFAULT 'preventive'
          CHECK(maintenance_type IN ('preventive','corrective','emergency','routine')),
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium'
          CHECK(priority IN ('low','medium','high','critical')),
        status TEXT DEFAULT 'pending'
          CHECK(status IN ('pending','in_progress','completed','cancelled')),
        scheduled_date TEXT,
        completed_date TEXT,
        performed_by TEXT,
        cost REAL DEFAULT 0,
        parts_used TEXT,
        notes TEXT,
        barcode TEXT UNIQUE,
        created_by INTEGER REFERENCES users(id),
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 16.5 — permissions for new modules
    try {
      const insPD16 = db.prepare('INSERT OR IGNORE INTO permission_definitions (module, action, label_ar, description_ar, sort_order) VALUES (?,?,?,?,?)');
      const newPerms16 = [
        ['expenses', 'view',    'عرض المصاريف',     'عرض قائمة المصاريف',      80],
        ['expenses', 'create',  'إضافة مصروف',      'إضافة مصاريف جديدة',      81],
        ['expenses', 'edit',    'تعديل المصاريف',    'تعديل بيانات المصاريف',    82],
        ['expenses', 'delete',  'حذف المصاريف',      'حذف المصاريف',            83],
        ['expenses', 'approve', 'اعتماد المصاريف',    'اعتماد أو رفض المصاريف',   84],
        ['maintenance', 'view',   'عرض الصيانة',      'عرض أوامر الصيانة',       90],
        ['maintenance', 'create', 'إضافة أمر صيانة',   'إضافة أوامر صيانة جديدة', 91],
        ['maintenance', 'edit',   'تعديل الصيانة',    'تعديل أوامر الصيانة',      92],
        ['maintenance', 'delete', 'حذف الصيانة',      'حذف أوامر الصيانة',       93],
      ];
      for (const p of newPerms16) insPD16.run(...p);

      // Grant to relevant roles
      const insRP16 = db.prepare('INSERT OR IGNORE INTO role_permissions (role, module, action, allowed) VALUES (?,?,?,?)');
      for (const role of ['superadmin','manager']) {
        for (const mod of ['expenses','maintenance']) {
          for (const act of ['view','create','edit','delete']) {
            insRP16.run(role, mod, act, 1);
          }
        }
        insRP16.run(role, 'expenses', 'approve', 1);
      }
      insRP16.run('accountant', 'expenses', 'view', 1);
      insRP16.run('accountant', 'expenses', 'create', 1);
      insRP16.run('accountant', 'expenses', 'edit', 1);
      insRP16.run('accountant', 'expenses', 'approve', 1);
      insRP16.run('production', 'maintenance', 'view', 1);
      insRP16.run('production', 'maintenance', 'create', 1);
      insRP16.run('production', 'expenses', 'view', 1);
      insRP16.run('viewer', 'expenses', 'view', 1);
      insRP16.run('viewer', 'maintenance', 'view', 1);
    } catch {} // permission_definitions may not exist on fresh DB

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (16)`);
  }

  // ──── V17 — Maintenance parts, machine enhancements ────
  const v17 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 17').get();
  if (!v17) {
    // 17.1 — maintenance_parts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS maintenance_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mo_id INTEGER NOT NULL REFERENCES maintenance_orders(id) ON DELETE CASCADE,
        part_name TEXT NOT NULL,
        part_number TEXT,
        quantity REAL DEFAULT 1,
        unit_cost REAL DEFAULT 0,
        supplier TEXT,
        notes TEXT
      )
    `);

    // 17.2 — Machine extra columns
    try { db.exec("ALTER TABLE machines ADD COLUMN brand TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN model_number TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN serial_number TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN purchase_price REAL DEFAULT 0"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN warranty_expires TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE machines ADD COLUMN total_downtime_hours REAL DEFAULT 0"); } catch(e) {}

    // 17.3 — Expense extra columns
    try { db.exec("ALTER TABLE expenses ADD COLUMN barcode TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'cash'"); } catch(e) {}
    try { db.exec("ALTER TABLE expenses ADD COLUMN vendor_name TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE expenses ADD COLUMN currency TEXT DEFAULT 'EGP'"); } catch(e) {}

    // Auto-generate expense barcodes
    try { db.exec(`UPDATE expenses SET barcode = 'EXP-' || strftime('%Y%m%d', expense_date) || '-' || printf('%04d', id) WHERE barcode IS NULL OR barcode = ''`); } catch(e) {}

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (17)`);
  }

  // ──── V18 — Enterprise polish: permissions, reports, help ────
  const v18 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 18').get();
  if (!v18) {
    // Ensure due_date index on invoices for overdue queries
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)"); } catch(e) {}
    // Ensure index on work_orders.due_date
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_wo_due_date ON work_orders(due_date)"); } catch(e) {}
    // Index on attendance.date for dashboard today queries
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(work_date)"); } catch(e) {}
    // Index on expenses.expense_date
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)"); } catch(e) {}

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (18)`);
  }

  // ──── V19 — size_config / size_mode on work_orders ────
  const v19 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 19').get();
  if (!v19) {
    try { db.exec("ALTER TABLE work_orders ADD COLUMN size_config TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE work_orders ADD COLUMN size_mode TEXT DEFAULT 'standard'"); } catch(e) {}

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (19)`);
  }

  // ──── V20 — Performance indexes ────
  const v20 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 20').get();
  if (!v20) {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_wo_model_id ON work_orders(model_id)',
      'CREATE INDEX IF NOT EXISTS idx_wo_priority ON work_orders(priority)',
      'CREATE INDEX IF NOT EXISTS idx_wo_stages_wo_id ON wo_stages(wo_id)',
      'CREATE INDEX IF NOT EXISTS idx_wo_stages_status ON wo_stages(status)',
      'CREATE INDEX IF NOT EXISTS idx_wo_stages_machine ON wo_stages(machine_id)',
      'CREATE INDEX IF NOT EXISTS idx_fabrics_code ON fabrics(code)',
      'CREATE INDEX IF NOT EXISTS idx_fabrics_status ON fabrics(status)',
      'CREATE INDEX IF NOT EXISTS idx_accessories_code ON accessories(code)',
      'CREATE INDEX IF NOT EXISTS idx_accessories_status ON accessories(status)',
      'CREATE INDEX IF NOT EXISTS idx_machines_barcode ON machines(barcode)',
      'CREATE INDEX IF NOT EXISTS idx_machines_code ON machines(code)',
      'CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number)',
      'CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON purchase_orders(supplier_id)',
      'CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number)',
      'CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON purchase_order_items(po_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read)',
    ];
    for (const sql of indexes) {
      try { db.exec(sql); } catch(e) {}
    }
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (20)`);
  }

  // ──── V21 — PO tax_pct and discount columns ────
  const v21 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 21').get();
  if (!v21) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch(e) {}
    };
    addColumnSafe('purchase_orders', 'tax_pct', 'REAL DEFAULT 0');
    addColumnSafe('purchase_orders', 'discount', 'REAL DEFAULT 0');
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (21)`);
  }

  // ──── V22 — Fix in_progress WOs with uninitialized first-stage quantities ────
  const v22 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 22').get();
  if (!v22) {
    // Find all in_progress WOs whose first stage has quantity_in_stage = 0
    const brokenWOs = db.prepare(`
      SELECT wo.id, wo.quantity, wo.is_size_based
      FROM work_orders wo
      WHERE wo.status = 'in_progress'
        AND EXISTS (
          SELECT 1 FROM wo_stages ws
          WHERE ws.wo_id = wo.id
            AND ws.sort_order = (SELECT MIN(sort_order) FROM wo_stages WHERE wo_id = wo.id)
            AND COALESCE(ws.quantity_in_stage, 0) = 0
            AND COALESCE(ws.quantity_completed, 0) = 0
        )
    `).all();

    for (const wo of brokenWOs) {
      let initQty = wo.quantity || 0;
      if (wo.is_size_based) {
        const szRows = db.prepare('SELECT * FROM wo_sizes WHERE wo_id=?').all(wo.id);
        if (szRows.length) {
          initQty = szRows.reduce((s, r) => s + (r.qty_s||0) + (r.qty_m||0) + (r.qty_l||0) + (r.qty_xl||0) + (r.qty_2xl||0) + (r.qty_3xl||0), 0);
        }
      }
      if (initQty > 0) {
        const firstStage = db.prepare('SELECT id FROM wo_stages WHERE wo_id=? ORDER BY sort_order LIMIT 1').get(wo.id);
        if (firstStage) {
          db.prepare("UPDATE wo_stages SET quantity_in_stage=?, status='in_progress', started_at=COALESCE(started_at, datetime('now','localtime')) WHERE id=?")
            .run(initQty, firstStage.id);
        }
      }
    }
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (22)`);
  }

  // ──── V23 — Phase 1-4: MRP, Shipping, Scheduling, QC, Quotations, Samples, Returns, Documents, Backup ────
  const v23 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 23').get();
  if (!v23) {
    const addColumnSafe = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch(e) {}
    };

    // ═══ MRP Tables ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS mrp_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_date TEXT DEFAULT (datetime('now','localtime')),
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','confirmed','cancelled')),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS mrp_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mrp_run_id INTEGER REFERENCES mrp_runs(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL CHECK(item_type IN ('fabric','accessory')),
        item_id INTEGER NOT NULL,
        item_code TEXT,
        item_name TEXT,
        required_qty REAL NOT NULL DEFAULT 0,
        on_hand_qty REAL NOT NULL DEFAULT 0,
        on_order_qty REAL NOT NULL DEFAULT 0,
        shortage_qty REAL NOT NULL DEFAULT 0,
        suggested_qty REAL NOT NULL DEFAULT 0,
        supplier_id INTEGER REFERENCES suppliers(id),
        supplier_name TEXT,
        unit_price REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        po_created INTEGER DEFAULT 0,
        po_id INTEGER REFERENCES purchase_orders(id),
        work_order_ids TEXT
      );
    `);

    // ═══ Shipping & Logistics ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shipment_number TEXT UNIQUE,
        shipment_type TEXT DEFAULT 'outbound' CHECK(shipment_type IN ('outbound','inbound','return')),
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','ready','shipped','in_transit','delivered','cancelled')),
        customer_id INTEGER REFERENCES customers(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        work_order_id INTEGER REFERENCES work_orders(id),
        invoice_id INTEGER REFERENCES invoices(id),
        carrier_name TEXT,
        tracking_number TEXT,
        shipping_method TEXT,
        shipping_cost REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        packages_count INTEGER DEFAULT 1,
        ship_date TEXT,
        expected_delivery TEXT,
        actual_delivery TEXT,
        shipping_address TEXT,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS shipment_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
        description TEXT,
        model_code TEXT,
        variant TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        weight REAL DEFAULT 0,
        notes TEXT
      );
      CREATE TABLE IF NOT EXISTS packing_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
        box_number INTEGER DEFAULT 1,
        contents TEXT,
        quantity REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        dimensions TEXT,
        notes TEXT
      );
    `);

    // ═══ Production Scheduling ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS production_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        capacity_per_day REAL DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','maintenance')),
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS production_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        production_line_id INTEGER REFERENCES production_lines(id),
        machine_id INTEGER REFERENCES machines(id),
        stage_id INTEGER REFERENCES wo_stages(id),
        planned_start TEXT NOT NULL,
        planned_end TEXT NOT NULL,
        actual_start TEXT,
        actual_end TEXT,
        priority INTEGER DEFAULT 5,
        status TEXT DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','delayed','cancelled')),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // ═══ Advanced QC ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS qc_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        model_code TEXT,
        description TEXT,
        aql_level TEXT DEFAULT 'II',
        inspection_type TEXT DEFAULT 'normal' CHECK(inspection_type IN ('normal','tightened','reduced')),
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS qc_template_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL REFERENCES qc_templates(id) ON DELETE CASCADE,
        check_point TEXT NOT NULL,
        category TEXT DEFAULT 'visual',
        severity TEXT DEFAULT 'minor' CHECK(severity IN ('critical','major','minor')),
        accept_criteria TEXT,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS qc_inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER REFERENCES work_orders(id),
        stage_id INTEGER REFERENCES wo_stages(id),
        template_id INTEGER REFERENCES qc_templates(id),
        inspection_number TEXT,
        inspector_id INTEGER REFERENCES users(id),
        inspection_date TEXT DEFAULT (datetime('now','localtime')),
        lot_size INTEGER DEFAULT 0,
        sample_size INTEGER DEFAULT 0,
        passed INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        result TEXT DEFAULT 'pending' CHECK(result IN ('pending','pass','fail','conditional')),
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS qc_inspection_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_id INTEGER NOT NULL REFERENCES qc_inspections(id) ON DELETE CASCADE,
        check_point TEXT NOT NULL,
        result TEXT DEFAULT 'pass' CHECK(result IN ('pass','fail','na')),
        defect_code TEXT,
        defect_count INTEGER DEFAULT 0,
        notes TEXT,
        image_url TEXT
      );
      CREATE TABLE IF NOT EXISTS qc_defect_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name_ar TEXT NOT NULL,
        category TEXT,
        severity TEXT DEFAULT 'minor' CHECK(severity IN ('critical','major','minor')),
        is_active INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS qc_ncr (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ncr_number TEXT UNIQUE,
        inspection_id INTEGER REFERENCES qc_inspections(id),
        work_order_id INTEGER REFERENCES work_orders(id),
        severity TEXT DEFAULT 'minor' CHECK(severity IN ('critical','major','minor')),
        description TEXT NOT NULL,
        root_cause TEXT,
        corrective_action TEXT,
        preventive_action TEXT,
        status TEXT DEFAULT 'open' CHECK(status IN ('open','investigating','resolved','closed','cancelled')),
        assigned_to INTEGER REFERENCES users(id),
        due_date TEXT,
        closed_date TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // ═══ Quotations & Sales Orders ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_number TEXT UNIQUE,
        customer_id INTEGER REFERENCES customers(id),
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired','converted')),
        valid_until TEXT,
        subtotal REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        notes TEXT,
        terms TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        model_code TEXT,
        description TEXT,
        variant TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        unit_price REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        notes TEXT
      );
      CREATE TABLE IF NOT EXISTS sales_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        so_number TEXT UNIQUE,
        quotation_id INTEGER REFERENCES quotations(id),
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','confirmed','in_production','partially_shipped','shipped','completed','cancelled')),
        order_date TEXT DEFAULT (datetime('now','localtime')),
        delivery_date TEXT,
        subtotal REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS sales_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
        model_code TEXT,
        description TEXT,
        variant TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        produced_qty REAL DEFAULT 0,
        shipped_qty REAL DEFAULT 0,
        unit_price REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        work_order_id INTEGER REFERENCES work_orders(id),
        notes TEXT
      );
    `);

    // ═══ Sample Management ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_number TEXT UNIQUE,
        model_code TEXT,
        customer_id INTEGER REFERENCES customers(id),
        status TEXT DEFAULT 'requested' CHECK(status IN ('requested','in_progress','completed','sent','approved','rejected','converted')),
        description TEXT,
        fabrics_used TEXT,
        accessories_used TEXT,
        cost REAL DEFAULT 0,
        requested_date TEXT DEFAULT (datetime('now','localtime')),
        completion_date TEXT,
        customer_feedback TEXT,
        work_order_id INTEGER REFERENCES work_orders(id),
        created_by INTEGER REFERENCES users(id),
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        deleted_by INTEGER,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // ═══ Returns Management ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE,
        invoice_id INTEGER REFERENCES invoices(id),
        customer_id INTEGER REFERENCES customers(id),
        return_date TEXT DEFAULT (datetime('now','localtime')),
        reason TEXT,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','approved','completed','cancelled')),
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS sales_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
        description TEXT,
        model_code TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        unit_price REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE,
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        return_date TEXT DEFAULT (datetime('now','localtime')),
        reason TEXT,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','approved','completed','cancelled')),
        subtotal REAL DEFAULT 0,
        total REAL DEFAULT 0,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS purchase_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        item_type TEXT DEFAULT 'fabric' CHECK(item_type IN ('fabric','accessory','other')),
        item_code TEXT,
        description TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        unit_price REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0
      );
    `);

    // ═══ Document Management ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER DEFAULT 0,
        category TEXT DEFAULT 'general',
        description TEXT,
        uploaded_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // ═══ Backup Management ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        backup_type TEXT DEFAULT 'manual' CHECK(backup_type IN ('manual','scheduled','auto')),
        status TEXT DEFAULT 'completed' CHECK(status IN ('completed','failed','in_progress')),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // ═══ Dynamic Sizes ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS size_grids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sizes TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // Seed default size grid
    try {
      db.prepare(`INSERT OR IGNORE INTO size_grids (id, name, sizes, is_default) VALUES (1, 'قياسي', '["S","M","L","XL","2XL","3XL"]', 1)`).run();
    } catch(e) {}

    // Seed default defect codes
    try {
      const insDefect = db.prepare('INSERT OR IGNORE INTO qc_defect_codes (code, name_ar, category, severity) VALUES (?,?,?,?)');
      insDefect.run('D001', 'خياطة غير منتظمة', 'خياطة', 'minor');
      insDefect.run('D002', 'بقعة على القماش', 'قماش', 'minor');
      insDefect.run('D003', 'ثقب في القماش', 'قماش', 'major');
      insDefect.run('D004', 'اختلاف لون', 'قماش', 'major');
      insDefect.run('D005', 'مقاس خاطئ', 'قياس', 'critical');
      insDefect.run('D006', 'زرار مفقود', 'إكسسوار', 'minor');
      insDefect.run('D007', 'سحاب معطل', 'إكسسوار', 'major');
      insDefect.run('D008', 'تلف في الكي', 'تشطيب', 'minor');
      insDefect.run('D009', 'خيط ظاهر', 'خياطة', 'minor');
      insDefect.run('D010', 'عدم تماثل', 'قص', 'major');
    } catch(e) {}

    // Seed default production line
    try {
      db.prepare(`INSERT OR IGNORE INTO production_lines (id, name, description, capacity_per_day) VALUES (1, 'خط الإنتاج الرئيسي', 'خط الإنتاج الأساسي', 500)`).run();
    } catch(e) {}

    // ═══ Permissions for new modules ═══
    try {
      const insPD = db.prepare('INSERT OR IGNORE INTO permission_definitions (module, action, label_ar, description_ar, sort_order) VALUES (?,?,?,?,?)');
      const insRP = db.prepare('INSERT OR IGNORE INTO role_permissions (role, module, action, allowed) VALUES (?,?,?,?)');

      const newModules = [
        { mod: 'mrp', label: 'تخطيط المواد', sort: 200 },
        { mod: 'shipping', label: 'الشحن', sort: 210 },
        { mod: 'scheduling', label: 'الجدولة', sort: 220 },
        { mod: 'quality', label: 'الجودة', sort: 230 },
        { mod: 'quotations', label: 'عروض الأسعار', sort: 240 },
        { mod: 'sales_orders', label: 'أوامر البيع', sort: 250 },
        { mod: 'samples', label: 'العينات', sort: 260 },
        { mod: 'returns', label: 'المرتجعات', sort: 270 },
        { mod: 'documents', label: 'المستندات', sort: 280 },
        { mod: 'backups', label: 'النسخ الاحتياطي', sort: 290 },
      ];

      const actions = ['view', 'create', 'edit', 'delete'];
      const roleDefaults = {
        superadmin: 1, manager: 1, accountant: 0, production: 0, hr: 0, viewer: 0
      };
      // Special overrides
      const roleOverrides = {
        quality: { production: 1 },
        scheduling: { production: 1 },
        mrp: { production: 1 },
        shipping: { accountant: 1 },
        quotations: { accountant: 1 },
        sales_orders: { accountant: 1 },
        returns: { accountant: 1 },
        samples: { production: 1 },
      };

      for (const { mod, label, sort } of newModules) {
        for (let i = 0; i < actions.length; i++) {
          const act = actions[i];
          const labelAr = act === 'view' ? `عرض ${label}` : act === 'create' ? `إنشاء ${label}` : act === 'edit' ? `تعديل ${label}` : `حذف ${label}`;
          insPD.run(mod, act, labelAr, labelAr, sort + i);

          for (const [role, defVal] of Object.entries(roleDefaults)) {
            let allowed = defVal;
            if (roleOverrides[mod]?.[role] !== undefined) allowed = roleOverrides[mod][role];
            if (act !== 'view' && role === 'viewer') allowed = 0;
            if (act === 'view' && role === 'viewer') allowed = 1;
            insRP.run(role, mod, act, allowed);
          }
        }
      }
    } catch(e) {}

    // Add auto-journal settings
    try {
      const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)');
      insSetting.run('auto_journal_invoice', '1');
      insSetting.run('auto_journal_po_receipt', '1');
      insSetting.run('auto_journal_expense', '1');
      insSetting.run('auto_journal_payroll', '1');
      insSetting.run('auto_journal_payment', '1');
      insSetting.run('shipment_number_prefix', 'SHP');
      insSetting.run('quotation_number_prefix', 'QTN');
      insSetting.run('so_number_prefix', 'SO');
      insSetting.run('sample_number_prefix', 'SMP');
      insSetting.run('sr_number_prefix', 'SR');
      insSetting.run('pr_number_prefix', 'PR');
      insSetting.run('ncr_number_prefix', 'NCR');
      insSetting.run('qc_number_prefix', 'QC');
      insSetting.run('backup_auto_enabled', '0');
      insSetting.run('backup_retention_days', '30');
    } catch(e) {}

    // Add new setting prefixes
    // (settings.js ALLOWED_PREFIXES will be updated separately)

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (23)`);
  }

  // ──── V24 — Audit Round 2: soft-delete documents, wholesale setting ────
  const v24 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 24').get();
  if (!v24) {
    try { db.exec("ALTER TABLE documents ADD COLUMN deleted_at TEXT DEFAULT NULL"); } catch(e) {}
    try {
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('wholesale_discount_pct', '22');
    } catch(e) {}
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (24)`);
  }

  // ──── V25 — Audit Round 3: performance indexes ────
  const v25 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 25').get();
  if (!v25) {
    const idxStmts = [
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`,
      `CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, work_date)`,
      `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id)`,
      `CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id)`,
      `CREATE INDEX IF NOT EXISTS idx_wo_stages_wo ON wo_stages(wo_id)`,
      `CREATE INDEX IF NOT EXISTS idx_wo_stages_name ON wo_stages(stage_name)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON invoices(status, due_date)`,
    ];
    for (const stmt of idxStmts) {
      try { db.exec(stmt); } catch(e) { /* table may not exist yet */ }
    }
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (25)`);
  }

  // ──── V26 — Audit Round 5: permission seed gaps + indexes ────
  const v26 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 26').get();
  if (!v26) {
    // 26.1 Add missing machines create/edit/delete permissions (V10 only seeded view+manage)
    try {
      const insPD26 = db.prepare('INSERT OR IGNORE INTO permission_definitions (module, action, label_ar, description_ar, sort_order) VALUES (?,?,?,?,?)');
      insPD26.run('machines', 'create', 'إضافة ماكينة', 'إضافة ماكينات جديدة', 77);
      insPD26.run('machines', 'edit', 'تعديل ماكينة', 'تعديل بيانات الماكينات', 78);
      insPD26.run('machines', 'delete', 'حذف ماكينة', 'حذف وتعطيل الماكينات', 79);
      insPD26.run('settings', 'delete', 'حذف الإعدادات', 'حذف قوالب المراحل وإعدادات النظام', 142);

      const insRP26 = db.prepare('INSERT OR IGNORE INTO role_permissions (role, module, action, allowed) VALUES (?,?,?,?)');
      for (const role of ['superadmin', 'manager', 'production']) {
        insRP26.run(role, 'machines', 'create', 1);
        insRP26.run(role, 'machines', 'edit', 1);
        insRP26.run(role, 'machines', 'delete', 1);
      }
      insRP26.run('superadmin', 'settings', 'delete', 1);
      insRP26.run('manager', 'settings', 'delete', 1);
    } catch {}

    // 26.2 Performance indexes for payment and movement tables
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customer_payments_invoice ON customer_payments(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_payments_po ON supplier_payments(po_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_stage_movement_log_wo ON stage_movement_log(wo_id);
    `);

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (26)`);
  }

  // V27 — Clean up duplicate settings keys (keep canonical *_default, remove default_*)
  const v27 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 27').get();
  if (!v27) {
    db.exec(`DELETE FROM settings WHERE key IN ('default_waste_pct', 'default_masnaiya', 'default_masrouf', 'default_margin')`);
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (27)`);
  }

  // ──── V28 — Numbering system standardization ────
  const v28 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 28').get();
  if (!v28) {
    // 28.1 — Add UNIQUE constraint on qc_inspections.inspection_number
    try {
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_qc_inspections_number ON qc_inspections(inspection_number)`);
    } catch(e) { console.error('V28: qc_inspections unique index:', e.message); }

    // 28.2 — Add settings entries for previously hardcoded prefixes
    const insSetting28 = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)');
    insSetting28.run('je_prefix', 'JE-');
    insSetting28.run('mnt_prefix', 'MNT-');
    insSetting28.run('mch_prefix', 'MCH-');
    insSetting28.run('cust_prefix', 'CUST-');
    insSetting28.run('emp_prefix', 'EMP-');
    insSetting28.run('fb_prefix', 'FB-');

    // 28.3 — Standardize V23-seeded prefix values to include trailing dash
    const prefixFixes = [
      ['shipment_number_prefix', 'SHP',  'SHP-'],
      ['quotation_number_prefix','QTN',  'QT-'],
      ['so_number_prefix',       'SO',   'SO-'],
      ['sample_number_prefix',   'SMP',  'SMP-'],
      ['sr_number_prefix',       'SR',   'SR-'],
      ['pr_number_prefix',       'PR',   'PR-'],
      ['ncr_number_prefix',      'NCR',  'NCR-'],
      ['qc_number_prefix',       'QC',   'QC-'],
    ];
    const updatePrefix = db.prepare('UPDATE settings SET value = ? WHERE key = ? AND value = ?');
    for (const [key, oldVal, newVal] of prefixFixes) {
      updatePrefix.run(newVal, key, oldVal);
    }

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (28)`);
  }

  // ──── V29 — Hardcoded defaults audit: new settings ────
  const v29 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 29').get();
  if (!v29) {
    try {
      const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
      // Accessory defaults
      insSetting.run('default_reorder_qty', '50');
      // Pagination default
      insSetting.run('default_page_size', '25');
      // Scheduling/maintenance defaults
      insSetting.run('default_schedule_priority', '5');
      insSetting.run('default_maintenance_priority', 'medium');
      // Shipping default
      insSetting.run('default_package_count', '1');
    } catch(e) { console.error('V29: new settings:', e.message); }

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (29)`);
  }

  // ──── V30 — Currency symbol and aging bucket settings ────
  const v30 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 30').get();
  if (!v30) {
    try {
      const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
      // Currency symbol for display
      insSetting.run('currency_symbol', 'ج.م');
      // Aging bucket thresholds (days)
      insSetting.run('aging_bucket_1', '30');
      insSetting.run('aging_bucket_2', '60');
      insSetting.run('aging_bucket_3', '90');
    } catch(e) { console.error('V30: currency/aging settings:', e.message); }

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (30)`);
  }

  // ──── V31 — Pagination/limit settings ────
  const v31 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 31').get();
  if (!v31) {
    try {
      const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
      // Notifications list limit
      insSetting.run('notification_list_limit', '50');
      // Reports default row limit
      insSetting.run('report_default_limit', '100');
    } catch(e) { console.error('V31: pagination settings:', e.message); }

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (31)`);
  }

  // ──── V32 — Dashboard and search limit settings ────
  const v32 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 32').get();
  if (!v32) {
    try {
      const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
      // Dashboard recent items limit
      insSetting.run('dashboard_list_limit', '5');
      // Dashboard machine board limit
      insSetting.run('dashboard_machine_limit', '30');
      // Global search results limit per category
      insSetting.run('search_results_limit', '8');
    } catch(e) { console.error('V32: dashboard/search settings:', e.message); }

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (32)`);
  }

  // ──── V33 — Auth, HR, quality, machine history limits ────
  const v33 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 33').get();
  if (!v33) {
    try {
      const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
      // Auth/security limits
      insSetting.run('password_history_limit', '5');
      insSetting.run('profile_activity_limit', '20');
      // HR employee detail limits
      insSetting.run('hr_attendance_history_limit', '30');
      insSetting.run('hr_payroll_history_limit', '12');
      insSetting.run('hr_adjustments_history_limit', '20');
      // Reports limits
      insSetting.run('cost_history_limit', '20');
      insSetting.run('quality_history_limit', '50');
      // Machine detail limit
      insSetting.run('machine_recent_stages_limit', '20');
    } catch(e) { console.error('V33: history limits settings:', e.message); }

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (33)`);
  }

  // ──── V34 — Add item_type/item_code to sales_return_items, tax_amount to purchase_returns ────
  const v34 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 34').get();
  if (!v34) {
    const addCol = (table, col, def) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {}
    };
    addCol('sales_return_items', 'item_type', "TEXT CHECK(item_type IN ('fabric','accessory','other'))");
    addCol('sales_return_items', 'item_code', 'TEXT');
    addCol('purchase_returns', 'tax_amount', 'REAL DEFAULT 0');

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (34)`);
  }

  // ──── V35 — Add missing indexes on foreign key and frequently-queried columns ────
  const v35 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 35').get();
  if (!v35) {
    const idx = (name, table, cols) => {
      try { db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${cols})`); } catch {}
    };
    // Work orders
    idx('idx_wo_customer', 'work_orders', 'customer_id');
    idx('idx_wo_model', 'work_orders', 'model_id');
    idx('idx_wo_status', 'work_orders', 'status');
    idx('idx_wo_created', 'work_orders', 'created_at');
    idx('idx_wo_due', 'work_orders', 'due_date');
    // WO detail tables
    idx('idx_wo_fabrics_wo', 'wo_fabrics', 'wo_id');
    idx('idx_wo_accessories_wo', 'wo_accessories', 'wo_id');
    idx('idx_wo_sizes_wo', 'wo_sizes', 'wo_id');
    idx('idx_wo_stages_wo', 'wo_stages', 'wo_id');
    idx('idx_wo_stages_status', 'wo_stages', 'status');
    idx('idx_wo_expenses_wo', 'wo_extra_expenses', 'wo_id');
    idx('idx_wo_fabric_batches_wo', 'wo_fabric_batches', 'wo_id');
    // Invoices
    idx('idx_inv_customer', 'invoices', 'customer_id');
    idx('idx_inv_wo', 'invoices', 'wo_id');
    idx('idx_inv_status', 'invoices', 'status');
    idx('idx_inv_items_inv', 'invoice_items', 'invoice_id');
    // Purchase orders
    idx('idx_po_supplier', 'purchase_orders', 'supplier_id');
    idx('idx_po_status', 'purchase_orders', 'status');
    idx('idx_poi_po', 'purchase_order_items', 'po_id');
    // HR
    idx('idx_att_employee', 'attendance', 'employee_id');
    idx('idx_att_date', 'attendance', 'work_date');
    idx('idx_payroll_employee', 'payroll_records', 'employee_id');
    idx('idx_payroll_period', 'payroll_records', 'period_id');
    idx('idx_leave_employee', 'leave_requests', 'employee_id');
    // Expenses
    idx('idx_exp_date', 'expenses', 'expense_date');
    idx('idx_exp_status', 'expenses', 'status');
    // Audit
    idx('idx_audit_user', 'audit_log', 'user_id');
    idx('idx_audit_entity', 'audit_log', 'entity_type, entity_id');
    idx('idx_audit_created', 'audit_log', 'created_at');
    // Notifications
    idx('idx_notif_user', 'notifications', 'user_id');
    idx('idx_notif_read', 'notifications', 'is_read');
    // Stock movements
    idx('idx_fsm_fabric', 'fabric_stock_movements', 'fabric_code');
    idx('idx_asm_accessory', 'accessory_stock_movements', 'accessory_code');
    // Documents
    idx('idx_doc_entity', 'documents', 'entity_type, entity_id');
    // Accounting
    idx('idx_je_date', 'journal_entries', 'entry_date');
    idx('idx_jel_je', 'journal_entry_lines', 'entry_id');
    idx('idx_jel_account', 'journal_entry_lines', 'account_id');

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (35)`);
  }

  // ──── V36 — Multi-location inventory, warehouses, transfers, stock valuation ────
  const v36 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 36').get();
  if (!v36) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        name_ar TEXT,
        address TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS warehouse_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        zone_type TEXT DEFAULT 'storage',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(warehouse_id, code)
      );

      CREATE TABLE IF NOT EXISTS fabric_location_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fabric_code TEXT NOT NULL REFERENCES fabrics(code),
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        zone_id INTEGER REFERENCES warehouse_zones(id),
        batch_id INTEGER REFERENCES fabric_inventory_batches(id),
        quantity_meters REAL NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS accessory_location_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accessory_code TEXT NOT NULL REFERENCES accessories(code),
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        zone_id INTEGER REFERENCES warehouse_zones(id),
        batch_id INTEGER REFERENCES accessory_inventory_batches(id),
        quantity REAL NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inventory_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_number TEXT NOT NULL UNIQUE,
        from_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        to_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_transit','completed','cancelled')),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inventory_transfer_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id INTEGER NOT NULL REFERENCES inventory_transfers(id),
        item_type TEXT NOT NULL CHECK(item_type IN ('fabric','accessory')),
        item_code TEXT NOT NULL,
        batch_id INTEGER,
        quantity REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_fls_fabric ON fabric_location_stock (fabric_code);
      CREATE INDEX IF NOT EXISTS idx_fls_warehouse ON fabric_location_stock (warehouse_id);
      CREATE INDEX IF NOT EXISTS idx_als_accessory ON accessory_location_stock (accessory_code);
      CREATE INDEX IF NOT EXISTS idx_als_warehouse ON accessory_location_stock (warehouse_id);
      CREATE INDEX IF NOT EXISTS idx_it_status ON inventory_transfers (status);
      CREATE INDEX IF NOT EXISTS idx_itl_transfer ON inventory_transfer_lines (transfer_id);

      INSERT OR IGNORE INTO warehouses (code, name, name_ar, is_default) VALUES ('MAIN', 'Main Warehouse', 'المخزن الرئيسي', 1);
    `);

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (36)`);
  }

  // ──── V37 — Employee hierarchy (reports_to) + leave_balances ────
  const v37 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 37').get();
  if (!v37) {
    const addCol = (table, col, def) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {}
    };
    addCol('employees', 'reports_to', 'INTEGER REFERENCES employees(id)');

    db.exec(`
      CREATE TABLE IF NOT EXISTS leave_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        leave_type TEXT NOT NULL DEFAULT 'annual',
        year INTEGER NOT NULL,
        entitled_days REAL NOT NULL DEFAULT 21,
        used_days REAL NOT NULL DEFAULT 0,
        carried_over REAL NOT NULL DEFAULT 0,
        UNIQUE(employee_id, leave_type, year)
      );
      CREATE INDEX IF NOT EXISTS idx_lb_employee ON leave_balances (employee_id);
    `);

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (37)`);
  }

  // ──── V38 — CRM: customer contacts, notes, interaction log ────
  const v38 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 38').get();
  if (!v38) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        name TEXT NOT NULL,
        title TEXT,
        phone TEXT,
        email TEXT,
        is_primary INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS customer_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        note TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_cc_customer ON customer_contacts (customer_id);
      CREATE INDEX IF NOT EXISTS idx_cn_customer ON customer_notes (customer_id);
    `);

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (38)`);
  }

  // ──── V39 — Fix missing columns used by routes ────
  const v39 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 39').get();
  if (!v39) {
    const addCol = (table, column, definition) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch(e) {}
    };
    // quotations route uses discount_percent / discount_amount / tax_percent
    addCol('quotations', 'discount_percent', 'REAL DEFAULT 0');
    addCol('quotations', 'discount_amount', 'REAL DEFAULT 0');
    addCol('quotations', 'tax_percent', 'REAL DEFAULT 0');
    // quotation_items route uses total_price
    addCol('quotation_items', 'total_price', 'REAL DEFAULT 0');
    addCol('quotation_items', 'unit', 'TEXT');
    // documents route uses deleted_at
    addCol('documents', 'deleted_at', 'TEXT');
    addCol('documents', 'title', 'TEXT');
    // backups route uses description
    addCol('backups', 'description', 'TEXT');
    // attendance clock uses check_in / check_out
    addCol('attendance', 'check_in', 'TEXT');
    addCol('attendance', 'check_out', 'TEXT');
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (39)`);
  }

  // v40: Recreate invoices table to add 'partially_paid' to CHECK constraint
  const v40 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 40').get();
  if (!v40) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS invoices_new (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_number  TEXT UNIQUE NOT NULL,
          customer_name   TEXT NOT NULL,
          customer_phone  TEXT,
          customer_email  TEXT,
          wo_id           INTEGER REFERENCES work_orders(id),
          customer_id     INTEGER REFERENCES customers(id),
          status          TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','partially_paid','overdue','cancelled')),
          tax_pct         REAL DEFAULT 0,
          discount        REAL DEFAULT 0,
          subtotal        REAL DEFAULT 0,
          total           REAL DEFAULT 0,
          notes           TEXT,
          due_date        TEXT,
          created_at      TEXT DEFAULT (datetime('now')),
          updated_at      TEXT DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO invoices_new SELECT id, invoice_number, customer_name, customer_phone, customer_email, wo_id, customer_id, status, tax_pct, discount, subtotal, total, notes, due_date, created_at, updated_at FROM invoices;
        DROP TABLE invoices;
        ALTER TABLE invoices_new RENAME TO invoices;
      `);
      db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (40)`);
    })();
  }

  // ──── V41 — password_reset_tokens table + 2FA columns on users ────
  const v41 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 41').get();
  if (!v41) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id),
        token_hash  TEXT NOT NULL,
        expires_at  TEXT NOT NULL,
        used_at     TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
      );
    `);
    const addCol = (table, col, def) => { try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {} };
    addCol('users', 'totp_enabled', 'INTEGER DEFAULT 0');
    addCol('users', 'totp_secret', 'TEXT');
    addCol('users', 'totp_backup_codes', 'TEXT');
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (41)`);
  }

  // ──── V43 — Additional performance indexes ────
  const v43 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 43').get();
  if (!v43) {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_fib_fabric_code ON fabric_inventory_batches(fabric_code)',
      'CREATE INDEX IF NOT EXISTS idx_fib_batch_status ON fabric_inventory_batches(batch_status)',
      'CREATE INDEX IF NOT EXISTS idx_fib_po_id ON fabric_inventory_batches(po_id)',
      'CREATE INDEX IF NOT EXISTS idx_fib_received_date ON fabric_inventory_batches(received_date)',
      'CREATE INDEX IF NOT EXISTS idx_fib_code_status ON fabric_inventory_batches(fabric_code, batch_status)',
      'CREATE INDEX IF NOT EXISTS idx_aib_accessory_code ON accessory_inventory_batches(accessory_code)',
      'CREATE INDEX IF NOT EXISTS idx_wo_fabric_batch_id ON wo_fabric_batches(batch_id)',
      'CREATE INDEX IF NOT EXISTS idx_expenses_status_date ON expenses(status, expense_date)',
    ];
    for (const sql of indexes) {
      try { db.exec(sql); } catch {}
    }
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (43)`);
  }

  // ═══ V44: FTS5 full-text search + additional indexes ═══
  if (currentVersion < 44) {
    try { db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS customers_fts USING fts5(name, phone, email, address, content='customers', content_rowid='id')`); } catch {}
    try { db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS work_orders_fts USING fts5(wo_number, notes, content='work_orders', content_rowid='id')`); } catch {}

    // Populate FTS from existing data
    try { db.exec("INSERT OR IGNORE INTO customers_fts(rowid, name, phone, email, address) SELECT id, COALESCE(name,''), COALESCE(phone,''), COALESCE(email,''), COALESCE(address,'') FROM customers"); } catch {}
    try { db.exec("INSERT OR IGNORE INTO work_orders_fts(rowid, wo_number, notes) SELECT id, COALESCE(wo_number,''), COALESCE(notes,'') FROM work_orders"); } catch {}

    // FTS sync triggers — drop old triggers first in case column names changed
    try { db.exec('DROP TRIGGER IF EXISTS work_orders_fts_ai'); } catch {}
    try { db.exec('DROP TRIGGER IF EXISTS work_orders_fts_ad'); } catch {}
    try { db.exec('DROP TRIGGER IF EXISTS work_orders_fts_au'); } catch {}
    // Recreate the FTS table with correct column names
    try { db.exec('DROP TABLE IF EXISTS work_orders_fts'); } catch {}
    try { db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS work_orders_fts USING fts5(wo_number, notes, content='work_orders', content_rowid='id')`); } catch {}
    try { db.exec("INSERT OR IGNORE INTO work_orders_fts(rowid, wo_number, notes) SELECT id, COALESCE(wo_number,''), COALESCE(notes,'') FROM work_orders"); } catch {}

    try { db.exec(`CREATE TRIGGER IF NOT EXISTS work_orders_fts_ai AFTER INSERT ON work_orders BEGIN INSERT INTO work_orders_fts(rowid, wo_number, notes) VALUES (new.id, COALESCE(new.wo_number,''), COALESCE(new.notes,'')); END`); } catch {}
    try { db.exec(`CREATE TRIGGER IF NOT EXISTS work_orders_fts_ad AFTER DELETE ON work_orders BEGIN INSERT INTO work_orders_fts(work_orders_fts, rowid, wo_number, notes) VALUES ('delete', old.id, COALESCE(old.wo_number,''), COALESCE(old.notes,'')); END`); } catch {}
    try { db.exec(`CREATE TRIGGER IF NOT EXISTS work_orders_fts_au AFTER UPDATE ON work_orders BEGIN INSERT INTO work_orders_fts(work_orders_fts, rowid, wo_number, notes) VALUES ('delete', old.id, COALESCE(old.wo_number,''), COALESCE(old.notes,'')); INSERT INTO work_orders_fts(rowid, wo_number, notes) VALUES (new.id, COALESCE(new.wo_number,''), COALESCE(new.notes,'')); END`); } catch {}

    // Additional performance indexes
    const v44indexes = [
      'CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_work_orders_created ON work_orders(created_at)',
    ];
    for (const sql of v44indexes) { try { db.exec(sql); } catch {} }

    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (44)`);
  }

  // ═══ V45: Scheduled reports table ═══
  if (currentVersion < 45) {
    db.exec(`CREATE TABLE IF NOT EXISTS report_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      report_type TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'weekly' CHECK(frequency IN ('daily','weekly','monthly')),
      day_of_week INTEGER DEFAULT 0,
      day_of_month INTEGER DEFAULT 1,
      hour INTEGER DEFAULT 8,
      recipients TEXT NOT NULL DEFAULT '[]',
      filters TEXT DEFAULT '{}',
      format TEXT DEFAULT 'xlsx' CHECK(format IN ('xlsx','csv')),
      enabled INTEGER DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (45)`);
  }

  // ═══ V46: Avatar column on users ═══
  if (currentVersion < 46) {
    try { db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`); } catch {}
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (46)`);
  }

  // ═══ V47: Fix work_orders_fts column name (wo_number not order_number) ═══
  if (currentVersion < 47) {
    try { db.exec('DROP TRIGGER IF EXISTS work_orders_fts_ai'); } catch {}
    try { db.exec('DROP TRIGGER IF EXISTS work_orders_fts_ad'); } catch {}
    try { db.exec('DROP TRIGGER IF EXISTS work_orders_fts_au'); } catch {}
    try { db.exec('DROP TABLE IF EXISTS work_orders_fts'); } catch {}
    try { db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS work_orders_fts USING fts5(wo_number, notes, content='work_orders', content_rowid='id')`); } catch {}
    try { db.exec("INSERT INTO work_orders_fts(rowid, wo_number, notes) SELECT id, COALESCE(wo_number,''), COALESCE(notes,'') FROM work_orders"); } catch {}
    try { db.exec(`CREATE TRIGGER work_orders_fts_ai AFTER INSERT ON work_orders BEGIN INSERT INTO work_orders_fts(rowid, wo_number, notes) VALUES (new.id, COALESCE(new.wo_number,''), COALESCE(new.notes,'')); END`); } catch {}
    try { db.exec(`CREATE TRIGGER work_orders_fts_ad AFTER DELETE ON work_orders BEGIN INSERT INTO work_orders_fts(work_orders_fts, rowid, wo_number, notes) VALUES ('delete', old.id, COALESCE(old.wo_number,''), COALESCE(old.notes,'')); END`); } catch {}
    try { db.exec(`CREATE TRIGGER work_orders_fts_au AFTER UPDATE ON work_orders BEGIN INSERT INTO work_orders_fts(work_orders_fts, rowid, wo_number, notes) VALUES ('delete', old.id, COALESCE(old.wo_number,''), COALESCE(old.notes,'')); INSERT INTO work_orders_fts(rowid, wo_number, notes) VALUES (new.id, COALESCE(new.wo_number,''), COALESCE(new.notes,'')); END`); } catch {}
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (47)`);
  }

  // V48: Add missing indexes on FK/join columns for query performance
  const v48 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 48').get();
  if (!v48) {
    const idxSafe = (name, table, cols) => {
      try { db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${cols})`); } catch {}
    };
    idxSafe('idx_wo_accessories_detail_wo', 'wo_accessories_detail', 'wo_id');
    idxSafe('idx_partial_invoices_wo', 'partial_invoices', 'wo_id');
    idxSafe('idx_partial_invoices_inv', 'partial_invoices', 'invoice_id');
    idxSafe('idx_wo_fabric_consumption_wo', 'wo_fabric_consumption', 'work_order_id');
    idxSafe('idx_wo_accessory_consumption_wo', 'wo_accessory_consumption', 'work_order_id');
    idxSafe('idx_wo_waste_wo', 'wo_waste', 'work_order_id');
    idxSafe('idx_wo_invoices_wo', 'wo_invoices', 'work_order_id');
    idxSafe('idx_wo_invoices_inv', 'wo_invoices', 'invoice_id');
    idxSafe('idx_wo_stage_qc_wo', 'wo_stage_qc', 'wo_id');
    idxSafe('idx_wo_stage_qc_stage', 'wo_stage_qc', 'stage_id');
    idxSafe('idx_machine_maintenance_machine', 'machine_maintenance', 'machine_id');
    idxSafe('idx_maintenance_orders_machine', 'maintenance_orders', 'machine_id');
    idxSafe('idx_maintenance_parts_mo', 'maintenance_parts', 'mo_id');
    idxSafe('idx_hr_adjustments_emp', 'hr_adjustments', 'employee_id');
    idxSafe('idx_hr_adjustments_period', 'hr_adjustments', 'period_id');
    idxSafe('idx_password_history_user', 'password_history', 'user_id');
    idxSafe('idx_user_sessions_user', 'user_sessions', 'user_id');
    idxSafe('idx_api_keys_user', 'api_keys', 'user_id');
    idxSafe('idx_qc_ncr_wo', 'qc_ncr', 'work_order_id');
    idxSafe('idx_quotation_items_q', 'quotation_items', 'quotation_id');
    idxSafe('idx_so_items_so', 'sales_order_items', 'sales_order_id');
    idxSafe('idx_sr_items_return', 'sales_return_items', 'return_id');
    idxSafe('idx_pr_items_return', 'purchase_return_items', 'return_id');
    idxSafe('idx_prod_schedule_wo', 'production_schedule', 'work_order_id');
    idxSafe('idx_shipment_items_ship', 'shipment_items', 'shipment_id');
    idxSafe('idx_packing_lists_ship', 'packing_lists', 'shipment_id');
    idxSafe('idx_att_imports_by', 'attendance_imports', 'imported_by');
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (48)`);
  }

  // ═══ V49: Add soft-delete columns to samples table ═══
  const v49 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 49').get();
  if (!v49) {
    const cols = db.prepare("PRAGMA table_info(samples)").all().map(c => c.name);
    if (!cols.includes('is_deleted')) db.exec("ALTER TABLE samples ADD COLUMN is_deleted INTEGER DEFAULT 0");
    if (!cols.includes('deleted_at')) db.exec("ALTER TABLE samples ADD COLUMN deleted_at TEXT");
    if (!cols.includes('deleted_by')) db.exec("ALTER TABLE samples ADD COLUMN deleted_by INTEGER");
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (49)`);
  }

  // ═══ V50: Add updated_at to expenses and maintenance_orders ═══
  const v50 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 50').get();
  if (!v50) {
    const expCols = db.prepare("PRAGMA table_info(expenses)").all().map(c => c.name);
    if (!expCols.includes('updated_at')) db.exec("ALTER TABLE expenses ADD COLUMN updated_at TEXT");
    const maintCols = db.prepare("PRAGMA table_info(maintenance_orders)").all().map(c => c.name);
    if (!maintCols.includes('updated_at')) db.exec("ALTER TABLE maintenance_orders ADD COLUMN updated_at TEXT");
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (50)`);
  }

  // ═══ V51: Create missing tables (import_jobs, user_preferences, user_invitations) ═══
  const v51 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 51').get();
  if (!v51) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS import_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        mode TEXT DEFAULT 'insert',
        total_rows INTEGER DEFAULT 0,
        processed_rows INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        errors TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        completed_at TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        preference_key TEXT NOT NULL,
        preference_value TEXT,
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, preference_key)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'viewer',
        department TEXT,
        token_hash TEXT NOT NULL UNIQUE,
        invited_by INTEGER NOT NULL,
        accepted_at TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (invited_by) REFERENCES users(id)
      );
    `);
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (51)`);
  }

  // ═══ V52: Ensure 2FA columns exist on users table + attendance clock columns ═══
  const v52 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 52').get();
  if (!v52) {
    const addCol = (table, col, def) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {}
    };
    // 2FA columns on users
    addCol('users', 'totp_enabled', 'INTEGER DEFAULT 0');
    addCol('users', 'totp_secret', 'TEXT');
    addCol('users', 'totp_backup_codes', 'TEXT');
    // Attendance clock columns
    addCol('attendance', 'check_in', 'TEXT');
    addCol('attendance', 'check_out', 'TEXT');
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (52)`);
  }

  // ═══ V53: Ensure attendance check_in/check_out exist (may have been missed by V39/V52 collision) ═══
  const v53 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 53').get();
  if (!v53) {
    const addCol53 = (table, col, def) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {}
    };
    addCol53('attendance', 'check_in', 'TEXT');
    addCol53('attendance', 'check_out', 'TEXT');
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (53)`);
  }

  // ═══ V54: Subcontracting fields on work_orders ═══
  const v54 = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 54').get();
  if (!v54) {
    const addCol54 = (table, col, def) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {}
    };
    addCol54('work_orders', 'is_subcontracted', 'INTEGER DEFAULT 0');
    addCol54('work_orders', 'subcontractor_id', 'INTEGER REFERENCES suppliers(id)');
    addCol54('work_orders', 'subcontractor_name', 'TEXT');
    addCol54('work_orders', 'subcontract_cost', 'REAL DEFAULT 0');
    addCol54('work_orders', 'subcontract_notes', 'TEXT');
    db.exec(`INSERT OR IGNORE INTO schema_migrations (version) VALUES (54)`);
  }
}

initializeDatabase();

module.exports = db;
