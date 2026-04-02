#!/usr/bin/env node
/**
 * License Key Generator for WK-Factory
 * Usage: node tools/generate-license.js <tier> <hardwareId> <secret>
 *   tier: standard | professional | enterprise
 *   hardwareId: the 32-char hex from GET /api/admin/license (hardware_id field)
 *   secret: the LICENSE_HMAC_SECRET value
 *
 * Example:
 *   node tools/generate-license.js professional abc123def456 my-secret-key
 */
const crypto = require('crypto');

function generateLicenseKey(tier, hardwareId, secret) {
  const prefixMap = { standard: 'ST', professional: 'PR', enterprise: 'EN' };
  const prefix = prefixMap[tier];
  if (!prefix) throw new Error(`Invalid tier: ${tier}. Must be standard, professional, or enterprise.`);

  const randomPart = crypto.randomBytes(8).toString('hex').toUpperCase().substring(0, 16);
  const hmac = crypto.createHmac('sha256', secret)
    .update(`${tier}:${randomPart}:${hardwareId}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();

  return `${prefix}${randomPart}-${hmac}`;
}

if (require.main === module) {
  const [,, tier, hardwareId, secret] = process.argv;
  if (!tier || !hardwareId || !secret) {
    console.error('Usage: node generate-license.js <tier> <hardwareId> <secret>');
    console.error('  tier: standard | professional | enterprise');
    process.exit(1);
  }
  const key = generateLicenseKey(tier, hardwareId, secret);
  console.log(`License Key: ${key}`);
  console.log(`Tier: ${tier}`);
  console.log(`Hardware ID: ${hardwareId}`);
}

module.exports = { generateLicenseKey };
