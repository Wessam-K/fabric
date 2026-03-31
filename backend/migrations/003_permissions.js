/**
 * Migration 003: Granular permission system (V6)
 * Baseline marker — tables already exist via initializeDatabase().
 */
module.exports = {
  version: 3,
  description: 'Permission definitions, role_permissions, user_permissions baseline',
  up(db) {
    // Already created by initializeDatabase() V6 block
  },
  down(db) {
    throw new Error('Cannot rollback permission tables');
  }
};
