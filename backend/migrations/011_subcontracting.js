/**
 * Migration 011: Subcontracting fields on work_orders
 * Already applied by database.js V54 inline migration
 */
module.exports = {
  version: 54,
  description: 'Subcontracting columns on work_orders (baseline marker)',
  up(db) {
    // Already applied by database.js V54
  },
  down(db) {
    // SQLite doesn't support DROP COLUMN before 3.35
  }
};
