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

    -- Insert default settings if not exist
    INSERT OR IGNORE INTO settings (key, value) VALUES ('masnaiya_default', '90');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('masrouf_default', '50');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('waste_pct_default', '5');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('margin_default', '30');
  `);
}

initializeDatabase();

module.exports = db;
