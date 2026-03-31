/**
 * Migration 001: Initial schema baseline
 * This captures the existing schema as migration v1 so future changes
 * are tracked incrementally.
 */
module.exports = {
  version: 1,
  description: 'Initial schema baseline — models, fabrics, accessories, BOM templates, work orders, suppliers, invoices, settings',
  up(db) {
    // This migration is a baseline marker. All tables already exist
    // via initializeDatabase(). Future migrations add incremental changes.
    // Mark as applied to establish the migration chain.
  },
  down(db) {
    // Cannot reverse the initial schema
    throw new Error('Cannot rollback initial schema baseline');
  }
};
