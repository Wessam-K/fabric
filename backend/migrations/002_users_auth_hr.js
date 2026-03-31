/**
 * Migration 002: Users, Auth, HR, Payroll tables (V5)
 * Baseline marker — these tables already exist via initializeDatabase().
 */
module.exports = {
  version: 2,
  description: 'Users, audit_log, employees, attendance, payroll baseline',
  up(db) {
    // Already created by initializeDatabase() V5 block
  },
  down(db) {
    throw new Error('Cannot rollback user/auth tables');
  }
};
