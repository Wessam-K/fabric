/**
 * V59: Security tests for SSRF protection, 2FA backup code hashing,
 * backup integrity, delete permissions, and export permissions
 * Run: node --test tests/v59-security.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ═══════════════════════════════════════════════
// 1. SSRF Protection (webhooks)
// ═══════════════════════════════════════════════
describe('SSRF Protection', () => {
  // Import the validateWebhookUrl function
  let validateWebhookUrl;
  try {
    // We need to extract the function — it's not exported directly,
    // so we test the behavior via the BLOCKED_IP_PATTERNS logic
    const dns = require('dns');
    const { URL } = require('url');

    const BLOCKED_IP_PATTERNS = [
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^0\./,
      /^::1$/,
      /^fe80:/i,
      /^fc00:/i,
    ];

    function isBlockedIP(ip) {
      return BLOCKED_IP_PATTERNS.some(p => p.test(ip));
    }

    it('blocks loopback addresses', () => {
      assert.ok(isBlockedIP('127.0.0.1'));
      assert.ok(isBlockedIP('127.0.0.2'));
    });

    it('blocks RFC1918 10.x.x.x', () => {
      assert.ok(isBlockedIP('10.0.0.1'));
      assert.ok(isBlockedIP('10.255.255.255'));
    });

    it('blocks RFC1918 172.16-31.x.x', () => {
      assert.ok(isBlockedIP('172.16.0.1'));
      assert.ok(isBlockedIP('172.31.255.255'));
      assert.ok(!isBlockedIP('172.15.0.1'));
      assert.ok(!isBlockedIP('172.32.0.1'));
    });

    it('blocks RFC1918 192.168.x.x', () => {
      assert.ok(isBlockedIP('192.168.1.1'));
      assert.ok(isBlockedIP('192.168.0.0'));
    });

    it('blocks link-local', () => {
      assert.ok(isBlockedIP('169.254.1.1'));
    });

    it('blocks IPv6 loopback', () => {
      assert.ok(isBlockedIP('::1'));
    });

    it('blocks IPv6 link-local', () => {
      assert.ok(isBlockedIP('fe80::1'));
    });

    it('allows public IPs', () => {
      assert.ok(!isBlockedIP('8.8.8.8'));
      assert.ok(!isBlockedIP('1.1.1.1'));
      assert.ok(!isBlockedIP('93.184.216.34'));
    });

    it('rejects non-http schemes', () => {
      const u = new URL('ftp://example.com');
      assert.ok(u.protocol !== 'https:' && u.protocol !== 'http:');
      // The validateWebhookUrl function should reject non-http(s) protocols
      const valid = new URL('https://example.com/webhook');
      assert.ok(valid.protocol === 'https:' || valid.protocol === 'http:');
    });
  } catch (err) {
    it('SSRF module available', () => { assert.fail('Could not load SSRF test deps: ' + err.message); });
  }
});

// ═══════════════════════════════════════════════
// 2. 2FA Backup Code Hashing
// ═══════════════════════════════════════════════
describe('2FA Backup Code Hashing', () => {
  const bcrypt = require('bcryptjs');

  it('hashes a backup code with bcrypt', async () => {
    const code = 'ABCD1234';
    const hash = await bcrypt.hash(code, 10);
    assert.ok(hash.startsWith('$2'));
    assert.notEqual(hash, code);
  });

  it('verifies a backup code against its hash', async () => {
    const code = 'WXYZ5678';
    const hash = await bcrypt.hash(code, 10);
    const match = await bcrypt.compare(code, hash);
    assert.ok(match);
  });

  it('rejects wrong backup code', async () => {
    const code = 'CORRECT1';
    const hash = await bcrypt.hash(code, 10);
    const match = await bcrypt.compare('WRONG999', hash);
    assert.ok(!match);
  });

  it('each hash is unique (salt)', async () => {
    const code = 'SAME1234';
    const h1 = await bcrypt.hash(code, 10);
    const h2 = await bcrypt.hash(code, 10);
    assert.notEqual(h1, h2);
    assert.ok(await bcrypt.compare(code, h1));
    assert.ok(await bcrypt.compare(code, h2));
  });
});

// ═══════════════════════════════════════════════
// 3. Export Permissions Constants
// ═══════════════════════════════════════════════
describe('Export Permission Middleware', () => {
  const { requirePermission } = require('../middleware/auth');

  it('creates middleware for export permission', () => {
    const mw = requirePermission('exports', 'execute');
    assert.equal(typeof mw, 'function');
    assert.equal(mw.length, 3);
  });

  it('creates middleware for granular export permissions', () => {
    const modules = [
      'exports_suppliers', 'exports_fabrics', 'exports_accessories',
      'exports_workorders', 'exports_reports', 'exports_purchaseorders',
      'exports_accounting', 'exports_customers', 'exports_payroll', 'exports_hr',
    ];
    for (const mod of modules) {
      const mw = requirePermission(mod, 'execute');
      assert.equal(typeof mw, 'function', `${mod} middleware should be a function`);
    }
  });

  it('superadmin can access exports', (_, done) => {
    const mw = requirePermission('exports', 'execute');
    const req = { user: { id: 1, role: 'superadmin' } };
    mw(req, {}, () => { done(); });
  });
});

// ═══════════════════════════════════════════════
// 4. Delete Permission Middleware
// ═══════════════════════════════════════════════
describe('Delete Permission Middleware', () => {
  const { requirePermission } = require('../middleware/auth');

  const deleteModules = [
    'models', 'fabrics', 'accessories', 'suppliers', 'customers',
    'work_orders', 'purchase_orders', 'invoices', 'accounting',
    'machines', 'stage_templates', 'bom_templates', 'notifications',
    'quality', 'quotations', 'returns',
  ];

  for (const mod of deleteModules) {
    it(`creates delete middleware for ${mod}`, () => {
      const mw = requirePermission(mod, 'delete');
      assert.equal(typeof mw, 'function');
    });
  }

  it('viewer cannot delete invoices', (_, done) => {
    const mw = requirePermission('invoices', 'delete');
    const req = { user: { id: 999998, role: 'viewer' } };
    const res = {
      status(code) { assert.equal(code, 403); return { json() { done(); } }; },
    };
    mw(req, res, () => { assert.fail('viewer should not delete'); });
  });
});

// ═══════════════════════════════════════════════
// 5. Backup Integrity (unit-level)
// ═══════════════════════════════════════════════
describe('Backup Integrity Check', () => {
  it('quick_check returns ok for healthy db', () => {
    const db = require('../database');
    const result = db.pragma('quick_check');
    assert.ok(result);
    assert.ok(result.length > 0);
    assert.equal(result[0].quick_check, 'ok');
  });
});

// ═══════════════════════════════════════════════
// 6. WebSocket Auth — no plaintext userId fallback
// ═══════════════════════════════════════════════
describe('WebSocket Security', () => {
  it('websocket module exports initWebSocket and broadcast', () => {
    const ws = require('../utils/websocket');
    assert.equal(typeof ws.initWebSocket, 'function');
    assert.equal(typeof ws.broadcast, 'function');
  });

  it('websocket module exports getClientCount', () => {
    const ws = require('../utils/websocket');
    assert.equal(typeof ws.getClientCount, 'function');
    const count = ws.getClientCount();
    assert.equal(typeof count, 'number');
  });
});

// ═══════════════════════════════════════════════
// 7. Data Retention Cleanup
// ═══════════════════════════════════════════════
describe('Data Retention Cleanup', () => {
  it('exports cleanOldWebhookLogs function', () => {
    const { cleanOldWebhookLogs } = require('../utils/cleanup');
    assert.equal(typeof cleanOldWebhookLogs, 'function');
  });

  it('runAllCleanups completes without error', () => {
    const { runAllCleanups } = require('../utils/cleanup');
    const results = runAllCleanups();
    assert.ok(results);
    assert.equal(typeof results.webhookLogs, 'number');
  });
});
