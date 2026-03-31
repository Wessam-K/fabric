/**
 * Phase 2.5: Data retention cleanup utilities
 * Runs daily to purge old records based on configurable retention policies.
 */
const db = require('../database');
const logger = require('./logger');

function getRetentionSetting(key, defaultDays) {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return row ? parseInt(row.value) || defaultDays : defaultDays;
  } catch { return defaultDays; }
}

function cleanOldAuditLogs() {
  const days = getRetentionSetting('audit_retention_days', 365);
  try {
    const result = db.prepare("DELETE FROM audit_log WHERE created_at < datetime('now', '-' || ? || ' days')").run(days);
    if (result.changes > 0) logger.info('Cleanup: purged old audit logs', { count: result.changes, retentionDays: days });
    return result.changes;
  } catch (err) { logger.error('Cleanup: audit log purge failed', { error: err.message }); return 0; }
}

function cleanOldNotifications() {
  const days = getRetentionSetting('notification_retention_days', 90);
  try {
    const result = db.prepare("DELETE FROM notifications WHERE created_at < datetime('now', '-' || ? || ' days') AND is_read = 1").run(days);
    if (result.changes > 0) logger.info('Cleanup: purged old notifications', { count: result.changes, retentionDays: days });
    return result.changes;
  } catch (err) { logger.error('Cleanup: notification purge failed', { error: err.message }); return 0; }
}

function cleanOldRevokedTokens() {
  try {
    const result = db.prepare("DELETE FROM user_sessions WHERE revoked = 1 AND created_at < datetime('now', '-7 days')").run();
    if (result.changes > 0) logger.info('Cleanup: purged revoked sessions', { count: result.changes });
    return result.changes;
  } catch { return 0; }
}

function cleanExpiredResetTokens() {
  try {
    const result = db.prepare("DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at < datetime('now')").run();
    if (result.changes > 0) logger.info('Cleanup: purged expired reset tokens', { count: result.changes });
    return result.changes;
  } catch { return 0; }
}

function runAllCleanups() {
  logger.info('Data retention cleanup started');
  const results = {
    auditLogs: cleanOldAuditLogs(),
    notifications: cleanOldNotifications(),
    revokedTokens: cleanOldRevokedTokens(),
    resetTokens: cleanExpiredResetTokens(),
  };
  logger.info('Data retention cleanup completed', results);
  return results;
}

module.exports = { runAllCleanups, cleanOldAuditLogs, cleanOldNotifications, cleanOldRevokedTokens, cleanExpiredResetTokens };
