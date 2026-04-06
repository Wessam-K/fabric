/**
 * Migration 010: Scheduled reports table
 * Already applied by database.js V45 inline migration
 */
module.exports = {
  version: 45,
  description: 'Scheduled reports table (baseline marker)',
  up(db) {
    // Already applied by database.js V45
  },
  down(db) {
    try { db.exec('DROP TABLE IF EXISTS report_schedules'); } catch {}
  }
};
