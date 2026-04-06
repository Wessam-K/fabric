// Migration 009: FTS5 full-text search + additional indexes
// Already applied by database.js V44 inline migration
module.exports = {
  version: 44,
  description: 'FTS5 full-text search + additional indexes (baseline marker)',
  up(db) {
    // Already applied by database.js V44
  },
  down(db) {
    try { db.exec('DROP TABLE IF EXISTS customers_fts'); } catch {}
    try { db.exec('DROP TABLE IF EXISTS work_orders_fts'); } catch {}
  }
};
