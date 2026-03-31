/**
 * Phase 6.1: License tier enforcement middleware
 * Gates features based on current license tier.
 */
const { LicenseManager } = require('../lib/license');
const db = require('../database');

const licenseManager = new LicenseManager(db);

const TIER_ORDER = ['trial', 'standard', 'professional', 'enterprise'];

/**
 * Require a specific feature to be enabled in the current license.
 * Returns 403 with upgrade prompt data if feature is not allowed.
 */
function requireFeature(featureName) {
  return (req, res, next) => {
    if (licenseManager.isFeatureAllowed(featureName)) return next();
    const status = licenseManager.getStatus();
    res.status(403).json({
      error: 'هذه الميزة غير متاحة في خطتك الحالية',
      license_error: true,
      current_tier: status.type,
      required_feature: featureName,
    });
  };
}

/**
 * Require a minimum license tier.
 */
function requireTier(minTier) {
  return (req, res, next) => {
    const status = licenseManager.getStatus();
    const current = TIER_ORDER.indexOf(status.type);
    const required = TIER_ORDER.indexOf(minTier);
    if (current >= required && status.status === 'active') return next();
    res.status(403).json({
      error: 'هذه الميزة تتطلب ترقية الخطة',
      license_error: true,
      current_tier: status.type,
      required_tier: minTier,
    });
  };
}

/**
 * Check user limit before creating new users.
 */
function requireUserLimit() {
  return (req, res, next) => {
    if (licenseManager.canAddUser()) return next();
    const status = licenseManager.getStatus();
    res.status(403).json({
      error: `الحد الأقصى لعدد المستخدمين (${status.maxUsers}) تم الوصول إليه`,
      license_error: true,
      current_tier: status.type,
      max_users: status.maxUsers,
    });
  };
}

module.exports = { requireFeature, requireTier, requireUserLimit };
