/**
 * Phase 5.1: License Management Module
 * Handles license validation, activation, and feature gating.
 */
const crypto = require('crypto');
const os = require('os');

// Generate a hardware fingerprint for license binding
function getHardwareId() {
  const interfaces = os.networkInterfaces();
  const macs = [];
  for (const [, entries] of Object.entries(interfaces)) {
    for (const entry of entries) {
      if (entry.mac && entry.mac !== '00:00:00:00:00:00') {
        macs.push(entry.mac);
      }
    }
  }
  const raw = `${os.hostname()}-${os.platform()}-${macs.sort().join(',')}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

// License tiers and their feature sets
const LICENSE_TIERS = {
  trial: {
    label: 'تجريبي',
    maxUsers: 3,
    features: ['basic_production', 'basic_invoices', 'basic_reports'],
    durationDays: 30,
  },
  standard: {
    label: 'قياسي',
    maxUsers: 10,
    features: ['basic_production', 'basic_invoices', 'basic_reports', 'inventory', 'suppliers', 'customers', 'hr'],
    durationDays: 365,
  },
  professional: {
    label: 'احترافي',
    maxUsers: 25,
    features: ['basic_production', 'basic_invoices', 'basic_reports', 'inventory', 'suppliers', 'customers', 'hr', 'payroll', 'accounting', 'mrp', 'quality', 'api_access', 'webhooks'],
    durationDays: 365,
  },
  enterprise: {
    label: 'مؤسسي',
    maxUsers: -1, // unlimited
    features: ['*'], // all features
    durationDays: 365,
  },
};

class LicenseManager {
  constructor(db) {
    this.db = db;
    this._ensureTable();
  }

  _ensureTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS license_info (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        license_key    TEXT,
        license_type   TEXT DEFAULT 'trial' CHECK(license_type IN ('trial','standard','professional','enterprise')),
        activated_at   TEXT,
        expires_at     TEXT,
        max_users      INTEGER DEFAULT 3,
        features       TEXT DEFAULT '{}',
        hardware_id    TEXT,
        status         TEXT DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
        updated_at     TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  getLicense() {
    const row = this.db.prepare('SELECT * FROM license_info ORDER BY id DESC LIMIT 1').get();
    if (!row) {
      // Auto-create trial license
      return this.activateTrial();
    }
    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      this.db.prepare('UPDATE license_info SET status = ? WHERE id = ?').run('expired', row.id);
      row.status = 'expired';
    }
    return row;
  }

  activateTrial() {
    const tier = LICENSE_TIERS.trial;
    const now = new Date();
    const expires = new Date(now.getTime() + tier.durationDays * 86400000);
    const hwId = getHardwareId();

    this.db.prepare(`
      INSERT INTO license_info (license_type, activated_at, expires_at, max_users, features, hardware_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run('trial', now.toISOString(), expires.toISOString(), tier.maxUsers, JSON.stringify(tier.features), hwId);

    return this.db.prepare('SELECT * FROM license_info ORDER BY id DESC LIMIT 1').get();
  }

  activate(licenseKey) {
    // Validate license key format: XXXX-XXXX-XXXX-XXXX or {PREFIX}{16CHARS}-{HMAC8}
    const hmacSecret = process.env.LICENSE_HMAC_SECRET;

    if (hmacSecret) {
      // HMAC-validated key format: {TIER_PREFIX}{16RANDOM}-{8HMAC}
      const hmacMatch = licenseKey.match(/^([A-Z]{2})([A-Z0-9]{16})-([A-Z0-9]{8})$/);
      if (!hmacMatch) {
        return { success: false, error: 'صيغة مفتاح الترخيص غير صحيحة' };
      }
      const [, prefix, randomPart, providedHmac] = hmacMatch;
      let tierKey = 'standard';
      if (prefix === 'PR') tierKey = 'professional';
      else if (prefix === 'EN') tierKey = 'enterprise';

      const hwId = getHardwareId();
      const expectedHmac = crypto.createHmac('sha256', hmacSecret)
        .update(`${tierKey}:${randomPart}:${hwId}`)
        .digest('hex')
        .substring(0, 8)
        .toUpperCase();

      if (!crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) {
        return { success: false, error: 'مفتاح الترخيص غير صالح' };
      }

      const tier = LICENSE_TIERS[tierKey];
      const now = new Date();
      const expires = new Date(now.getTime() + tier.durationDays * 86400000);

      this.db.prepare('UPDATE license_info SET status = ? WHERE status = ?').run('revoked', 'active');
      this.db.prepare(`
        INSERT INTO license_info (license_key, license_type, activated_at, expires_at, max_users, features, hardware_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(licenseKey, tierKey, now.toISOString(), expires.toISOString(), tier.maxUsers, JSON.stringify(tier.features), hwId);

      return { success: true, license: this.getLicense() };
    }

    // Fallback: prefix-only method (backward compatibility when LICENSE_HMAC_SECRET not set)
    const logger = require('../utils/logger');
    logger.warn('LICENSE_HMAC_SECRET not set — using prefix-only license validation (insecure)');

    // Validate license key format: XXXX-XXXX-XXXX-XXXX
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licenseKey)) {
      return { success: false, error: 'صيغة مفتاح الترخيص غير صحيحة' };
    }

    // Determine tier from key prefix
    const prefix = licenseKey.substring(0, 2);
    let tierKey = 'standard';
    if (prefix === 'PR') tierKey = 'professional';
    else if (prefix === 'EN') tierKey = 'enterprise';

    const tier = LICENSE_TIERS[tierKey];
    const now = new Date();
    const expires = new Date(now.getTime() + tier.durationDays * 86400000);
    const hwId = getHardwareId();

    // Deactivate old licenses
    this.db.prepare('UPDATE license_info SET status = ? WHERE status = ?').run('revoked', 'active');

    this.db.prepare(`
      INSERT INTO license_info (license_key, license_type, activated_at, expires_at, max_users, features, hardware_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(licenseKey, tierKey, now.toISOString(), expires.toISOString(), tier.maxUsers, JSON.stringify(tier.features), hwId);

    return { success: true, license: this.getLicense() };
  }

  isFeatureAllowed(featureName) {
    if (process.env.NODE_ENV === 'test') return true;
    const license = this.getLicense();
    if (license.status !== 'active') return false;
    const features = JSON.parse(license.features || '[]');
    return features.includes('*') || features.includes(featureName);
  }

  canAddUser() {
    if (process.env.NODE_ENV === 'test') return true;
    const license = this.getLicense();
    if (license.status !== 'active') return false;
    if (license.max_users === -1) return true;
    const activeUsers = this.db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get().c;
    return activeUsers < license.max_users;
  }

  getStatus() {
    const license = this.getLicense();
    const tier = LICENSE_TIERS[license.license_type] || LICENSE_TIERS.trial;
    const daysLeft = license.expires_at
      ? Math.max(0, Math.ceil((new Date(license.expires_at) - new Date()) / 86400000))
      : 0;

    return {
      type: license.license_type,
      label: tier.label,
      status: license.status,
      maxUsers: license.max_users,
      daysLeft,
      expiresAt: license.expires_at,
      activatedAt: license.activated_at,
      features: JSON.parse(license.features || '[]'),
    };
  }
}

module.exports = { LicenseManager, LICENSE_TIERS, getHardwareId };
