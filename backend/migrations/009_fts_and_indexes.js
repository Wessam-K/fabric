// Migration 009: FTS5 full-text search + additional indexes
module.exports = function migrate(db) {
  // FTS5 virtual tables for full-text search
  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS customers_fts USING fts5(
      name, phone, email, address,
      content='customers', content_rowid='id'
    )`);
  } catch {}

  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS work_orders_fts USING fts5(
      wo_number, notes,
      content='work_orders', content_rowid='id'
    )`);
  } catch {}

  // Populate FTS tables from existing data
  try { db.exec("INSERT OR IGNORE INTO customers_fts(rowid, name, phone, email, address) SELECT id, COALESCE(name,''), COALESCE(phone,''), COALESCE(email,''), COALESCE(address,'') FROM customers"); } catch {}
  try { db.exec("INSERT OR IGNORE INTO work_orders_fts(rowid, wo_number, notes) SELECT id, COALESCE(wo_number,''), COALESCE(notes,'') FROM work_orders"); } catch {}

  // FTS sync triggers for customers
  try {
    db.exec(`CREATE TRIGGER IF NOT EXISTS customers_ai AFTER INSERT ON customers BEGIN
      INSERT INTO customers_fts(rowid, name, phone, email, address) VALUES (new.id, COALESCE(new.name,''), COALESCE(new.phone,''), COALESCE(new.email,''), COALESCE(new.address,''));
    END`);
  } catch {}
  try {
    db.exec(`CREATE TRIGGER IF NOT EXISTS customers_ad AFTER DELETE ON customers BEGIN
      INSERT INTO customers_fts(customers_fts, rowid, name, phone, email, address) VALUES ('delete', old.id, COALESCE(old.name,''), COALESCE(old.phone,''), COALESCE(old.email,''), COALESCE(old.address,''));
    END`);
  } catch {}
  try {
    db.exec(`CREATE TRIGGER IF NOT EXISTS customers_au AFTER UPDATE ON customers BEGIN
      INSERT INTO customers_fts(customers_fts, rowid, name, phone, email, address) VALUES ('delete', old.id, COALESCE(old.name,''), COALESCE(old.phone,''), COALESCE(old.email,''), COALESCE(old.address,''));
      INSERT INTO customers_fts(rowid, name, phone, email, address) VALUES (new.id, COALESCE(new.name,''), COALESCE(new.phone,''), COALESCE(new.email,''), COALESCE(new.address,''));
    END`);
  } catch {}

  // FTS sync triggers for work_orders
  try {
    db.exec(`CREATE TRIGGER IF NOT EXISTS work_orders_ai AFTER INSERT ON work_orders BEGIN
      INSERT INTO work_orders_fts(rowid, wo_number, notes) VALUES (new.id, COALESCE(new.wo_number,''), COALESCE(new.notes,''));
    END`);
  } catch {}
  try {
    db.exec(`CREATE TRIGGER IF NOT EXISTS work_orders_ad AFTER DELETE ON work_orders BEGIN
      INSERT INTO work_orders_fts(work_orders_fts, rowid, wo_number, notes) VALUES ('delete', old.id, COALESCE(old.wo_number,''), COALESCE(old.notes,''));
    END`);
  } catch {}
  try {
    db.exec(`CREATE TRIGGER IF NOT EXISTS work_orders_au AFTER UPDATE ON work_orders BEGIN
      INSERT INTO work_orders_fts(work_orders_fts, rowid, wo_number, notes) VALUES ('delete', old.id, COALESCE(old.wo_number,''), COALESCE(old.notes,''));
      INSERT INTO work_orders_fts(rowid, wo_number, notes) VALUES (new.id, COALESCE(new.wo_number,''), COALESCE(new.notes,''));
    END`);
  } catch {}

  // Additional performance indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)',
    'CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id)',
    'CREATE INDEX IF NOT EXISTS idx_work_orders_created ON work_orders(created_at)',
  ];
  for (const sql of indexes) {
    try { db.exec(sql); } catch {}
  }
};
