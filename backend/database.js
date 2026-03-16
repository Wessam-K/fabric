const Database = require('better-sqlite3');
const path = require('path');

const dbDir = process.env.WK_DB_DIR || __dirname;
const dbPath = path.join(dbDir, 'wk-hub.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fabrics (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      code         TEXT UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      fabric_type  TEXT DEFAULT 'main' CHECK(fabric_type IN ('main','lining','both')),
      price_per_m  REAL NOT NULL,
      supplier     TEXT,
      color        TEXT,
      image_path   TEXT,
      status       TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      notes        TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accessories (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      code         TEXT UNIQUE NOT NULL,
      acc_type     TEXT NOT NULL CHECK(acc_type IN ('button','zipper','thread','label','padding','interfacing','other')),
      name         TEXT NOT NULL,
      unit_price   REAL NOT NULL,
      unit         TEXT DEFAULT 'piece' CHECK(unit IN ('piece','meter','kg','roll')),
      supplier     TEXT,
      status       TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      notes        TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS models (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      serial_number   TEXT UNIQUE NOT NULL,
      model_code      TEXT UNIQUE NOT NULL,
      model_name      TEXT,
      model_image     TEXT,
      masnaiya        REAL DEFAULT 90,
      masrouf         REAL DEFAULT 50,
      consumer_price  REAL,
      wholesale_price REAL,
      notes           TEXT,
      status          TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS model_fabrics (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id         INTEGER REFERENCES models(id) ON DELETE CASCADE,
      fabric_code      TEXT REFERENCES fabrics(code),
      role             TEXT NOT NULL CHECK(role IN ('main','lining')),
      meters_per_piece REAL NOT NULL,
      waste_pct        REAL DEFAULT 5,
      color_note       TEXT,
      sort_order       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS model_accessories (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id        INTEGER REFERENCES models(id) ON DELETE CASCADE,
      accessory_code  TEXT REFERENCES accessories(code),
      accessory_name  TEXT,
      quantity        REAL NOT NULL,
      unit_price      REAL NOT NULL,
      notes           TEXT
    );

    CREATE TABLE IF NOT EXISTS model_sizes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id    INTEGER REFERENCES models(id) ON DELETE CASCADE,
      color_label TEXT NOT NULL,
      qty_s       INTEGER DEFAULT 0,
      qty_m       INTEGER DEFAULT 0,
      qty_l       INTEGER DEFAULT 0,
      qty_xl      INTEGER DEFAULT 0,
      qty_2xl     INTEGER DEFAULT 0,
      qty_3xl     INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cost_snapshots (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id            INTEGER REFERENCES models(id),
      total_pieces        INTEGER,
      total_meters_main   REAL,
      total_meters_lining REAL,
      main_fabric_cost    REAL,
      lining_cost         REAL,
      accessories_cost    REAL,
      masnaiya            REAL,
      masrouf             REAL,
      total_cost          REAL,
      cost_per_piece      REAL,
      consumer_price      REAL,
      wholesale_price     REAL,
      snapshot_date       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number  TEXT UNIQUE NOT NULL,
      customer_name   TEXT NOT NULL,
      customer_phone  TEXT,
      customer_email  TEXT,
      notes           TEXT,
      subtotal        REAL DEFAULT 0,
      tax_pct         REAL DEFAULT 0,
      discount        REAL DEFAULT 0,
      total           REAL DEFAULT 0,
      status          TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue','cancelled')),
      due_date        TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id      INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      model_code      TEXT,
      description     TEXT NOT NULL,
      variant         TEXT,
      quantity        REAL NOT NULL,
      unit_price      REAL NOT NULL,
      total           REAL NOT NULL,
      sort_order      INTEGER DEFAULT 0
    );

    -- BOM Variants
    CREATE TABLE IF NOT EXISTS bom_variants (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id    INTEGER REFERENCES models(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      is_default  INTEGER DEFAULT 0,
      notes       TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bom_variant_fabrics (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id       INTEGER REFERENCES bom_variants(id) ON DELETE CASCADE,
      fabric_code      TEXT REFERENCES fabrics(code),
      role             TEXT NOT NULL CHECK(role IN ('main','lining')),
      meters_per_piece REAL NOT NULL,
      waste_pct        REAL DEFAULT 5,
      color_note       TEXT,
      sort_order       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bom_variant_accessories (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id      INTEGER REFERENCES bom_variants(id) ON DELETE CASCADE,
      accessory_code  TEXT REFERENCES accessories(code),
      accessory_name  TEXT,
      quantity        REAL NOT NULL,
      unit_price      REAL NOT NULL,
      notes           TEXT
    );

    -- Production Stages
    CREATE TABLE IF NOT EXISTS production_stages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      color      TEXT DEFAULT '#3b82f6',
      is_active  INTEGER DEFAULT 1
    );

    -- Work Orders
    CREATE TABLE IF NOT EXISTS work_orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_number       TEXT UNIQUE NOT NULL,
      model_id        INTEGER REFERENCES models(id),
      variant_id      INTEGER REFERENCES bom_variants(id),
      quantity         INTEGER NOT NULL,
      priority        TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
      status          TEXT DEFAULT 'draft' CHECK(status IN ('draft','in_progress','completed','cancelled')),
      current_stage_id INTEGER REFERENCES production_stages(id),
      assigned_to     TEXT,
      due_date        TEXT,
      start_date      TEXT,
      end_date        TEXT,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_order_stages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      stage_id      INTEGER REFERENCES production_stages(id),
      status        TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped')),
      started_at    TEXT,
      completed_at  TEXT,
      notes         TEXT
    );

    CREATE TABLE IF NOT EXISTS work_order_fabric_usage (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      fabric_code   TEXT REFERENCES fabrics(code),
      planned_meters REAL,
      actual_meters  REAL,
      notes         TEXT
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      code         TEXT UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      contact_person TEXT,
      phone        TEXT,
      email        TEXT,
      address      TEXT,
      type         TEXT DEFAULT 'fabric' CHECK(type IN ('fabric','accessory','both','other')),
      payment_terms TEXT,
      rating       INTEGER DEFAULT 3 CHECK(rating BETWEEN 1 AND 5),
      status       TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      notes        TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- Purchase Orders
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number       TEXT UNIQUE NOT NULL,
      supplier_id     INTEGER REFERENCES suppliers(id),
      status          TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','partial','received','cancelled')),
      subtotal        REAL DEFAULT 0,
      tax_pct         REAL DEFAULT 0,
      discount        REAL DEFAULT 0,
      total           REAL DEFAULT 0,
      expected_date   TEXT,
      received_date   TEXT,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id           INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
      item_type       TEXT NOT NULL CHECK(item_type IN ('fabric','accessory')),
      item_code       TEXT NOT NULL,
      description     TEXT,
      quantity        REAL NOT NULL,
      unit_price      REAL NOT NULL,
      total           REAL NOT NULL,
      received_qty    REAL DEFAULT 0,
      sort_order      INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id   INTEGER REFERENCES suppliers(id),
      po_id         INTEGER REFERENCES purchase_orders(id),
      amount        REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash','bank_transfer','check','other')),
      reference     TEXT,
      notes         TEXT,
      payment_date  TEXT DEFAULT (datetime('now'))
    );

    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT DEFAULT (datetime('now')),
      description TEXT
    );

    -- Insert default settings if not exist
    INSERT OR IGNORE INTO settings (key, value) VALUES ('masnaiya_default', '90');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('masrouf_default', '50');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('waste_pct_default', '5');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('margin_default', '30');

    -- Insert default production stages if not exist
    INSERT OR IGNORE INTO production_stages (id, name, sort_order, color) VALUES (1, 'القص', 1, '#3b82f6');
    INSERT OR IGNORE INTO production_stages (id, name, sort_order, color) VALUES (2, 'الطباعة / التطريز', 2, '#8b5cf6');
    INSERT OR IGNORE INTO production_stages (id, name, sort_order, color) VALUES (3, 'الخياطة', 3, '#f59e0b');
    INSERT OR IGNORE INTO production_stages (id, name, sort_order, color) VALUES (4, 'التشطيب', 4, '#10b981');
    INSERT OR IGNORE INTO production_stages (id, name, sort_order, color) VALUES (5, 'الكي والتغليف', 5, '#06b6d4');
    INSERT OR IGNORE INTO production_stages (id, name, sort_order, color) VALUES (6, 'مراقبة الجودة', 6, '#ef4444');

    -- Insert schema version
    INSERT OR IGNORE INTO schema_version (version, description) VALUES (1, 'Initial schema');
    INSERT OR IGNORE INTO schema_version (version, description) VALUES (2, 'Added BOM variants, work orders, suppliers, purchase orders');
  `);
}

initializeDatabase();

module.exports = db;
