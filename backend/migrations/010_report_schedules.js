/**
 * Migration 010: Scheduled reports table
 * Adds report_schedules for automated report generation and delivery
 */
module.exports = function migrate(db) {
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
};
