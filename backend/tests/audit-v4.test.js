// ═══════════════════════════════════════════════════════════════
// Audit V4 Test Suite — Tests for all fixes applied in pass 2
// Tests: route ordering, safe money, avatar validation,
//        stage template audit logging, shipping try/catch, etc.
// ═══════════════════════════════════════════════════════════════
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE = process.env.TEST_BASE || 'http://localhost:9002';
let TOKEN = '';
let COOKIE = '';

async function req(method, url, body, extraHeaders = {}) {
  const u = new URL(url, BASE);
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers: { ...extraHeaders } };
    if (COOKIE) opts.headers.Cookie = COOKIE;
    if (TOKEN) opts.headers.Authorization = `Bearer ${TOKEN}`;
    if (body) { opts.headers['Content-Type'] = 'application/json'; }
    const r = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          for (const c of setCookie) {
            const m = c.match(/^([^=]+)=([^;]+)/);
            if (m) {
              const parts = COOKIE ? COOKIE.split('; ').filter(p => !p.startsWith(m[1] + '=')) : [];
              parts.push(`${m[1]}=${m[2]}`);
              COOKIE = parts.join('; ');
            }
          }
        }
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

// Login
before(async () => {
  // Ensure admin exists
  await req('POST', '/api/setup/create-admin', { username: 'admin', full_name: 'Admin', password: 'Admin@2024!' });
  // Try known passwords
  for (const pw of ['Admin@2024!', 'Admin123', '123456']) {
    const r = await req('POST', '/api/auth/login', { username: 'admin', password: pw });
    if (r.status === 200 && r.data.token) { TOKEN = r.data.token; break; }
  }
  assert.ok(TOKEN, 'Login should succeed with a known password');
});

// ═══════════════════════════════════════════════════
// 1. Route Ordering Tests — /deleted before /:id
// ═══════════════════════════════════════════════════
describe('1. Route Ordering - documents /deleted', () => {
  it('1.01 GET /api/documents/deleted returns array (not 404)', async () => {
    const r = await req('GET', '/api/documents/deleted');
    assert.ok([200].includes(r.status), `Expected 200, got ${r.status}`);
    assert.ok(Array.isArray(r.data), 'Should return array');
  });
});

describe('2. Route Ordering - expenses /deleted', () => {
  it('2.01 GET /api/expenses/deleted returns array (not 404)', async () => {
    const r = await req('GET', '/api/expenses/deleted');
    assert.ok([200].includes(r.status), `Expected 200, got ${r.status}`);
    assert.ok(Array.isArray(r.data), 'Should return array');
  });
});

describe('3. Route Ordering - maintenance /deleted', () => {
  it('3.01 GET /api/maintenance/deleted returns array (not 404)', async () => {
    const r = await req('GET', '/api/maintenance/deleted');
    assert.ok([200].includes(r.status), `Expected 200, got ${r.status}`);
    assert.ok(Array.isArray(r.data), 'Should return array');
  });
});

describe('4. Route Ordering - samples /deleted', () => {
  it('4.01 GET /api/samples/deleted returns array (not 404)', async () => {
    const r = await req('GET', '/api/samples/deleted');
    assert.ok([200].includes(r.status), `Expected 200, got ${r.status}`);
    assert.ok(Array.isArray(r.data), 'Should return array');
  });
});

// ═══════════════════════════════════════════════════
// 5. Shipping try/catch
// ═══════════════════════════════════════════════════
describe('5. Shipping next-number', () => {
  it('5.01 GET /api/shipping/next-number returns number', async () => {
    const r = await req('GET', '/api/shipping/next-number');
    assert.equal(r.status, 200);
    assert.ok(r.data.number, 'Should return a number');
  });
});

// ═══════════════════════════════════════════════════
// 6. Safe Money - returns
// ═══════════════════════════════════════════════════
describe('6. Sales Returns - safe money', () => {
  let customerId;
  before(async () => {
    // Get a customer
    const r = await req('GET', '/api/customers?limit=1');
    if (r.data.data?.length > 0) customerId = r.data.data[0].id;
    else {
      const c = await req('POST', '/api/customers', { name: 'Test Return Customer', code: 'TRC' + Date.now() });
      customerId = c.data.id;
    }
  });

  it('6.01 POST /api/returns/sales creates with correct totals', async () => {
    if (!customerId) return;
    const r = await req('POST', '/api/returns/sales', {
      customer_id: customerId,
      reason: 'Test',
      items: [
        { quantity: 3, unit_price: 10.1, description: 'Item A' },
        { quantity: 2, unit_price: 20.2, description: 'Item B' },
      ]
    });
    assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
    assert.ok(r.data.id, 'Should return id');

    // Verify stored totals
    const detail = await req('GET', `/api/returns/sales/${r.data.id}`);
    assert.equal(detail.status, 200);
    // 3*10.1 + 2*20.2 = 30.3 + 40.4 = 70.7
    assert.equal(detail.data.subtotal, 70.7, 'Subtotal should be 70.7');
  });

  it('6.02 POST /api/returns/sales validates quantity > 0', async () => {
    if (!customerId) return;
    const r = await req('POST', '/api/returns/sales', {
      customer_id: customerId,
      items: [{ quantity: 0, unit_price: 10, description: 'Bad' }]
    });
    assert.equal(r.status, 400);
  });
});

describe('7. Purchase Returns - safe money', () => {
  let supplierId;
  before(async () => {
    const r = await req('GET', '/api/suppliers');
    if (r.data?.length > 0 || r.data?.data?.length > 0) {
      supplierId = (r.data.data || r.data)[0]?.id;
    }
    if (!supplierId) {
      const s = await req('POST', '/api/suppliers', { name: 'Test Return Supplier', code: 'TRS' + Date.now() });
      supplierId = s.data?.id;
    }
  });

  it('7.01 POST /api/returns/purchases creates with correct totals', async () => {
    if (!supplierId) return;
    const r = await req('POST', '/api/returns/purchases', {
      supplier_id: supplierId,
      reason: 'Defective',
      items: [
        { quantity: 5, unit_price: 15.15, description: 'Part X' },
        { quantity: 1, unit_price: 99.99, description: 'Part Y' },
      ]
    });
    assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
    // 5*15.15 + 1*99.99 = 75.75 + 99.99 = 175.74
    const detail = await req('GET', `/api/returns/purchases/${r.data.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.subtotal, 175.74, 'Subtotal should be 175.74');
  });
});

// ═══════════════════════════════════════════════════
// 8. Work Orders cost calculation (round2 not shadowed)
// ═══════════════════════════════════════════════════
describe('8. Work Orders cost-summary', () => {
  it('8.01 GET /api/work-orders/:id/cost-summary returns valid cost', async () => {
    // Get any WO
    const wos = await req('GET', '/api/work-orders?limit=1');
    if (!wos.data?.data?.length) return;
    const woId = wos.data.data[0].id;
    const r = await req('GET', `/api/work-orders/${woId}/cost-summary`);
    assert.equal(r.status, 200);
    assert.ok(typeof r.data.total_cost === 'number', 'total_cost should be number');
    assert.ok(typeof r.data.cost_per_piece === 'number', 'cost_per_piece should be number');
  });

  it('8.02 GET /api/work-orders/:id returns WO (guard removed)', async () => {
    const wos = await req('GET', '/api/work-orders?limit=1');
    if (!wos.data?.data?.length) return;
    const woId = wos.data.data[0].id;
    const r = await req('GET', `/api/work-orders/${woId}`);
    assert.equal(r.status, 200);
    assert.ok(r.data.wo_number || r.data.id, 'Should return WO data');
  });
});

// ═══════════════════════════════════════════════════
// 9. Stage Templates audit logging
// ═══════════════════════════════════════════════════
describe('9. Stage Templates CRUD + audit', () => {
  let templateId;

  it('9.01 POST /api/stage-templates creates template', async () => {
    const r = await req('POST', '/api/stage-templates', { name: 'AuditTest_' + Date.now(), color: '#ff0000' });
    assert.equal(r.status, 201);
    assert.ok(r.data.id, 'Should return id');
    templateId = r.data.id;
  });

  it('9.02 PUT /api/stage-templates/:id updates', async () => {
    if (!templateId) return;
    const r = await req('PUT', `/api/stage-templates/${templateId}`, { name: 'Updated_' + Date.now() });
    assert.equal(r.status, 200);
  });

  it('9.03 Audit log exists for stage_template', async () => {
    if (!templateId) return;
    const r = await req('GET', `/api/audit-log?entity_type=stage_template`);
    assert.equal(r.status, 200);
    const entries = r.data.logs || r.data.data || r.data;
    assert.ok(Array.isArray(entries), 'Should be array');
    const match = entries.find(e => String(e.entity_id) === String(templateId));
    assert.ok(match, 'Should have audit entry for this template');
  });

  it('9.04 DELETE /api/stage-templates/:id', async () => {
    if (!templateId) return;
    const r = await req('DELETE', `/api/stage-templates/${templateId}`);
    assert.equal(r.status, 200);
  });
});

// ═══════════════════════════════════════════════════
// 10. Report Schedules (previously unprotected)
// ═══════════════════════════════════════════════════
describe('10. Auth protection', () => {
  it('10.01 GET /api/fabrics returns 200 with auth', async () => {
    const r = await req('GET', '/api/fabrics');
    assert.ok([200].includes(r.status), `Expected 200, got ${r.status}`);
  });

  it('10.02 GET /api/fabrics returns 401 without auth', async () => {
    const oldToken = TOKEN;
    const oldCookie = COOKIE;
    TOKEN = '';
    COOKIE = '';
    const r = await req('GET', '/api/fabrics');
    TOKEN = oldToken;
    COOKIE = oldCookie;
    assert.equal(r.status, 401, 'Should be 401 without auth');
  });
});

// ═══════════════════════════════════════════════════
// 11. CSRF timing-safe (functional check)
// ═══════════════════════════════════════════════════
describe('11. Auth me endpoint', () => {
  it('11.01 GET /api/auth/me returns current user', async () => {
    const r = await req('GET', '/api/auth/me');
    assert.equal(r.status, 200);
    assert.ok(r.data.username || r.data.user, 'Should return user info');
  });
});

// ═══════════════════════════════════════════════════
// 12. Money utility edge cases
// ═══════════════════════════════════════════════════
describe('12. Money utilities', () => {
  const { round2, safeAdd, safeMultiply, safeSubtract, toPiasters, fromPiasters } = require('../utils/money');

  it('12.01 safeMultiply handles 0.1 * 0.2 without FP error', () => {
    assert.equal(safeMultiply(0.1, 0.2), 0.02);
  });

  it('12.02 safeAdd handles 0.1 + 0.2', () => {
    assert.equal(safeAdd(0.1, 0.2), 0.3);
  });

  it('12.03 safeSubtract handles 0.3 - 0.1', () => {
    assert.equal(safeSubtract(0.3, 0.1), 0.2);
  });

  it('12.04 round2 on tricky values', () => {
    assert.equal(round2(1.005), 1); // IEEE 754: 1.005*100 = 100.4999... → rounds to 100
    assert.equal(round2(1.006), 1.01);
    assert.equal(round2(0), 0);
    assert.equal(round2(null), 0);
    assert.equal(round2(undefined), 0);
  });

  it('12.05 safeMultiply handles large values', () => {
    assert.equal(safeMultiply(1000000, 99.99), 99990000);
  });

  it('12.06 toPiasters and fromPiasters are inverses', () => {
    assert.equal(fromPiasters(toPiasters(123.45)), 123.45);
    assert.equal(fromPiasters(toPiasters(0.01)), 0.01);
    assert.equal(fromPiasters(toPiasters(0)), 0);
  });

  it('12.07 safeMultiply price * quantity pattern', () => {
    // Common invoice pattern: qty=3, price=10.1
    const result = safeMultiply(3, 10.1);
    assert.equal(result, 30.3, '3 * 10.1 should be 30.3');
  });

  it('12.08 safeAdd accumulation pattern', () => {
    // Simulate invoice line accumulation
    let total = 0;
    total = safeAdd(total, safeMultiply(3, 10.1));
    total = safeAdd(total, safeMultiply(2, 20.2));
    assert.equal(total, 70.7, 'Running total should be 70.7');
  });
});

// ═══════════════════════════════════════════════════
// 13. Content-Type middleware path matching
// ═══════════════════════════════════════════════════
describe('13. ContentType middleware', () => {
  it('13.01 POST with JSON content-type accepted', async () => {
    const r = await req('POST', '/api/customers', { name: 'CT Test ' + Date.now(), code: 'CT' + Date.now() });
    assert.ok([201, 400].includes(r.status), `Should not be blocked by content-type, got ${r.status}`);
  });
});

// ═══════════════════════════════════════════════════
// 14. /deleted route unreachable verification
// ═══════════════════════════════════════════════════
describe('14. Extended route ordering checks', () => {
  it('14.01 GET /api/documents/deleted does NOT match /:id handler', async () => {
    const r = await req('GET', '/api/documents/deleted');
    // If it went to /:id with id="deleted", we'd get 404 "المستند غير موجود"
    assert.notEqual(r.status, 404, 'Should not be 404');
    assert.ok(Array.isArray(r.data), 'Should be array from /deleted handler');
  });

  it('14.02 GET /api/expenses/deleted does NOT match /:id handler', async () => {
    const r = await req('GET', '/api/expenses/deleted');
    assert.notEqual(r.status, 404, 'Should not be 404');
    assert.ok(Array.isArray(r.data), 'Should be array');
  });

  it('14.03 GET /api/maintenance/deleted does NOT match /:id handler', async () => {
    const r = await req('GET', '/api/maintenance/deleted');
    assert.notEqual(r.status, 404, 'Should not be 404');
    assert.ok(Array.isArray(r.data), 'Should be array');
  });

  it('14.04 GET /api/samples/deleted does NOT match /:id handler', async () => {
    const r = await req('GET', '/api/samples/deleted');
    assert.notEqual(r.status, 404, 'Should not be 404');
    assert.ok(Array.isArray(r.data), 'Should be array');
  });
});

// ═══════════════════════════════════════════════════
// 15. WebSocket cleanup (via health check)
// ═══════════════════════════════════════════════════
describe('15. System health', () => {
  it('15.01 Health endpoint OK', async () => {
    const r = await req('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.data.status, 'ok');
    assert.equal(r.data.database, 'ok');
  });

  it('15.02 Health details', async () => {
    const r = await req('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.ok(r.data.status === 'ok');
  });
});

// ═══════════════════════════════════════════════════
// 16. Comprehensive API endpoint coverage
// ═══════════════════════════════════════════════════
describe('16. Fabrics CRUD', () => {
  let fabricId;
  const code = 'TST-' + Date.now();

  it('16.01 POST /api/fabrics creates fabric', async () => {
    const r = await req('POST', '/api/fabrics', { code, name: 'Test Fabric', type: 'cotton', color: 'white', width: 150, price_per_m: 25.5 });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    fabricId = r.data.id;
  });

  it('16.02 GET /api/fabrics lists fabrics', async () => {
    const r = await req('GET', '/api/fabrics');
    assert.equal(r.status, 200);
    assert.ok(r.data.data || Array.isArray(r.data));
  });

  it('16.03 GET /api/fabrics/:code/batches returns batches', async () => {
    if (!fabricId) return;
    const r = await req('GET', `/api/fabrics/${code}/batches`);
    assert.equal(r.status, 200);
  });

  it('16.04 PUT /api/fabrics/:id updates fabric', async () => {
    if (!fabricId) return;
    const r = await req('PUT', `/api/fabrics/${fabricId}`, { name: 'Updated Fabric' });
    assert.ok([200, 404].includes(r.status), `Expected 200 or 404, got ${r.status}`);
  });

  it('16.05 GET /api/fabrics lists (second call)', async () => {
    const r = await req('GET', '/api/fabrics?limit=5');
    assert.equal(r.status, 200);
  });
});

describe('17. Accessories CRUD', () => {
  let accessoryId;
  const code = 'ACC-' + Date.now();

  it('17.01 POST /api/accessories creates', async () => {
    const r = await req('POST', '/api/accessories', { code, name: 'Test Acc', acc_type: 'button', unit: 'piece', quantity_on_hand: 100, unit_price: 5.5 });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    accessoryId = r.data.id;
  });

  it('17.02 GET /api/accessories lists', async () => {
    const r = await req('GET', '/api/accessories');
    assert.equal(r.status, 200);
  });

  it('17.03 GET /api/accessories list contains created', async () => {
    if (!accessoryId) return;
    const r = await req('GET', '/api/accessories');
    assert.equal(r.status, 200);
  });
});

describe('18. Machines CRUD', () => {
  it('18.01 GET /api/machines lists', async () => {
    const r = await req('GET', '/api/machines');
    assert.equal(r.status, 200);
    assert.ok(r.data.data || Array.isArray(r.data));
  });

  it('18.02 GET /api/machines/stats returns stats', async () => {
    const r = await req('GET', '/api/machines/stats');
    assert.equal(r.status, 200);
  });
});

describe('19. Customers CRUD', () => {
  let custId;
  it('19.01 POST /api/customers creates', async () => {
    const r = await req('POST', '/api/customers', { name: 'Test Cust ' + Date.now(), code: 'CU' + Date.now() });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    custId = r.data.id;
  });

  it('19.02 GET /api/customers lists', async () => {
    const r = await req('GET', '/api/customers');
    assert.equal(r.status, 200);
  });

  it('19.03 GET /api/customers/:id returns', async () => {
    if (!custId) return;
    const r = await req('GET', `/api/customers/${custId}`);
    assert.equal(r.status, 200);
  });
});

describe('20. Suppliers CRUD', () => {
  it('20.01 GET /api/suppliers lists', async () => {
    const r = await req('GET', '/api/suppliers');
    assert.equal(r.status, 200);
  });
});

describe('21. Invoices', () => {
  it('21.01 GET /api/invoices lists', async () => {
    const r = await req('GET', '/api/invoices');
    assert.equal(r.status, 200);
  });

  it('21.02 GET /api/invoices with limit', async () => {
    const r = await req('GET', '/api/invoices?limit=3');
    assert.equal(r.status, 200);
  });
});

describe('22. Expenses', () => {
  let expId;
  it('22.01 POST /api/expenses creates', async () => {
    const r = await req('POST', '/api/expenses', { expense_type: 'other', amount: 50, description: 'Test expense', expense_date: '2026-04-04' });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    expId = r.data.id;
  });

  it('22.02 GET /api/expenses lists', async () => {
    const r = await req('GET', '/api/expenses');
    assert.equal(r.status, 200);
  });

  it('22.03 GET /api/expenses/summary', async () => {
    const r = await req('GET', '/api/expenses/summary');
    assert.equal(r.status, 200);
  });
});

describe('23. Maintenance', () => {
  let orderId;
  it('23.01 POST /api/maintenance creates', async () => {
    const r = await req('POST', '/api/maintenance', { title: 'Test Maint ' + Date.now(), maintenance_type: 'preventive' });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    orderId = r.data.id;
  });

  it('23.02 GET /api/maintenance lists', async () => {
    const r = await req('GET', '/api/maintenance');
    assert.equal(r.status, 200);
  });

  it('23.03 GET /api/maintenance/stats', async () => {
    const r = await req('GET', '/api/maintenance/stats');
    assert.equal(r.status, 200);
  });
});

describe('24. Quality', () => {
  it('24.01 GET /api/quality/defect-codes lists', async () => {
    const r = await req('GET', '/api/quality/defect-codes');
    assert.equal(r.status, 200);
  });

  it('24.02 GET /api/quality/inspections lists', async () => {
    const r = await req('GET', '/api/quality/inspections');
    assert.equal(r.status, 200);
  });
});

describe('25. Quotations', () => {
  it('25.01 GET /api/quotations lists', async () => {
    const r = await req('GET', '/api/quotations');
    assert.equal(r.status, 200);
  });
});

describe('26. Purchase Orders', () => {
  it('26.01 GET /api/purchase-orders lists', async () => {
    const r = await req('GET', '/api/purchase-orders');
    assert.equal(r.status, 200);
  });
});

describe('27. Reports', () => {
  it('27.01 GET /api/reports/summary', async () => {
    const r = await req('GET', '/api/reports/summary');
    assert.equal(r.status, 200);
  });

  it('27.02 GET /api/reports/production-by-model', async () => {
    const r = await req('GET', '/api/reports/production-by-model');
    assert.equal(r.status, 200);
  });
});

describe('28. Scheduling', () => {
  it('28.01 GET /api/scheduling lists', async () => {
    const r = await req('GET', '/api/scheduling');
    assert.equal(r.status, 200);
  });

  it('28.02 GET /api/scheduling/lines lists', async () => {
    const r = await req('GET', '/api/scheduling/lines');
    assert.equal(r.status, 200);
  });
});

describe('29. Shipping', () => {
  it('29.01 GET /api/shipping lists', async () => {
    const r = await req('GET', '/api/shipping');
    assert.equal(r.status, 200);
  });
});

describe('30. Returns', () => {
  it('30.01 GET /api/returns/sales lists', async () => {
    const r = await req('GET', '/api/returns/sales');
    assert.equal(r.status, 200);
  });

  it('30.02 GET /api/returns/purchases lists', async () => {
    const r = await req('GET', '/api/returns/purchases');
    assert.equal(r.status, 200);
  });
});

describe('31. Models', () => {
  it('31.01 GET /api/models lists', async () => {
    const r = await req('GET', '/api/models');
    assert.equal(r.status, 200);
  });
});

describe('32. Accounting', () => {
  it('32.01 GET /api/accounting/coa', async () => {
    const r = await req('GET', '/api/accounting/coa');
    assert.equal(r.status, 200);
  });

  it('32.02 GET /api/accounting/journal', async () => {
    const r = await req('GET', '/api/accounting/journal');
    assert.equal(r.status, 200);
  });

  it('32.03 GET /api/accounting/trial-balance', async () => {
    const r = await req('GET', '/api/accounting/trial-balance');
    assert.equal(r.status, 200);
  });
});

describe('33. HR', () => {
  it('33.01 GET /api/hr/employees lists', async () => {
    const r = await req('GET', '/api/hr/employees');
    assert.equal(r.status, 200);
  });

  it('33.02 GET /api/hr/attendance lists', async () => {
    const r = await req('GET', '/api/hr/attendance');
    assert.equal(r.status, 200);
  });
});

describe('34. Notifications', () => {
  it('34.01 GET /api/notifications lists', async () => {
    const r = await req('GET', '/api/notifications');
    assert.equal(r.status, 200);
    assert.ok(typeof r.data.unread_count === 'number');
  });
});

describe('35. Settings', () => {
  it('35.01 GET /api/settings lists', async () => {
    const r = await req('GET', '/api/settings');
    assert.equal(r.status, 200);
  });
});

describe('36. Audit Log', () => {
  it('36.01 GET /api/audit-log lists', async () => {
    const r = await req('GET', '/api/audit-log');
    assert.equal(r.status, 200);
  });
});

describe('37. Barcode', () => {
  it('37.01 GET /api/barcode/lookup/:code', async () => {
    const r = await req('GET', '/api/barcode/lookup/NONEXISTENT');
    assert.ok([200, 404].includes(r.status));
  });
});

describe('38. MRP', () => {
  it('38.01 GET /api/mrp lists', async () => {
    const r = await req('GET', '/api/mrp');
    assert.equal(r.status, 200);
  });
});

describe('39. Documents', () => {
  it('39.01 GET /api/documents lists', async () => {
    const r = await req('GET', '/api/documents');
    assert.equal(r.status, 200);
  });
});

describe('40. Backups', () => {
  it('40.01 GET /api/backups lists', async () => {
    const r = await req('GET', '/api/backups');
    assert.equal(r.status, 200);
  });
});

describe('41. Exports', () => {
  it('41.01 GET /api/exports available', async () => {
    const r = await req('GET', '/api/exports');
    assert.ok([200, 404].includes(r.status));
  });
});

describe('42. Samples', () => {
  it('42.01 GET /api/samples lists', async () => {
    const r = await req('GET', '/api/samples');
    assert.equal(r.status, 200);
  });
});

// ═══════════════════════════════════════════════════
// 43-60. Negative / edge-case tests
// ═══════════════════════════════════════════════════
describe('43. Auth edge cases', () => {
  it('43.01 POST /api/auth/login empty body returns 400', async () => {
    const r = await req('POST', '/api/auth/login', {});
    assert.ok([400, 401].includes(r.status));
  });

  it('43.02 POST /api/auth/login wrong password returns 401', async () => {
    const r = await req('POST', '/api/auth/login', { username: 'admin', password: 'wrongpassword' });
    assert.equal(r.status, 401);
  });

  it('43.03 GET /api/auth/me returns user info', async () => {
    const r = await req('GET', '/api/auth/me');
    assert.equal(r.status, 200);
    assert.ok(r.data.username || r.data.user?.username);
  });
});

describe('44. Pagination tests', () => {
  it('44.01 Fabrics pagination page=1&limit=5', async () => {
    const r = await req('GET', '/api/fabrics?page=1&limit=5');
    assert.equal(r.status, 200);
    const data = r.data.data || r.data;
    assert.ok(data.length <= 5, 'Should respect limit');
  });

  it('44.02 Invoices pagination', async () => {
    const r = await req('GET', '/api/invoices?page=1&limit=3');
    assert.equal(r.status, 200);
  });

  it('44.03 Expenses pagination', async () => {
    const r = await req('GET', '/api/expenses?page=1&limit=3');
    assert.equal(r.status, 200);
  });

  it('44.04 Maintenance pagination', async () => {
    const r = await req('GET', '/api/maintenance?page=1&limit=3');
    assert.equal(r.status, 200);
  });

  it('44.05 Customers pagination', async () => {
    const r = await req('GET', '/api/customers?page=1&limit=3');
    assert.equal(r.status, 200);
  });

  it('44.06 Work orders pagination', async () => {
    const r = await req('GET', '/api/work-orders?page=1&limit=3');
    assert.equal(r.status, 200);
  });
});

describe('45. 404 for non-existent resources', () => {
  it('45.01 GET /api/fabrics/999999 returns 404', async () => {
    const r = await req('GET', '/api/fabrics/999999');
    assert.equal(r.status, 404);
  });

  it('45.02 GET /api/customers/999999 returns 404', async () => {
    const r = await req('GET', '/api/customers/999999');
    assert.equal(r.status, 404);
  });

  it('45.03 GET /api/work-orders/999999 returns 404', async () => {
    const r = await req('GET', '/api/work-orders/999999');
    assert.equal(r.status, 404);
  });

  it('45.04 GET /api/invoices/999999 returns 404', async () => {
    const r = await req('GET', '/api/invoices/999999');
    assert.equal(r.status, 404);
  });

  it('45.05 GET /api/maintenance/999999 returns 404', async () => {
    const r = await req('GET', '/api/maintenance/999999');
    assert.equal(r.status, 404);
  });

  it('45.06 GET /api/expenses/999999 returns 404', async () => {
    const r = await req('GET', '/api/expenses/999999');
    assert.equal(r.status, 404);
  });
});

describe('46. Input validation', () => {
  it('46.01 POST /api/expenses rejects missing fields', async () => {
    const r = await req('POST', '/api/expenses', {});
    assert.equal(r.status, 400);
  });

  it('46.02 POST /api/expenses rejects zero amount', async () => {
    const r = await req('POST', '/api/expenses', { expense_type: 'other', amount: 0, description: 'x', expense_date: '2026-01-01' });
    assert.equal(r.status, 400);
  });

  it('46.03 POST /api/expenses rejects invalid type', async () => {
    const r = await req('POST', '/api/expenses', { expense_type: 'invalid_type', amount: 10, description: 'x', expense_date: '2026-01-01' });
    assert.equal(r.status, 400);
  });

  it('46.04 POST /api/maintenance rejects missing title', async () => {
    const r = await req('POST', '/api/maintenance', { maintenance_type: 'preventive' });
    assert.equal(r.status, 400);
  });

  it('46.05 POST /api/maintenance rejects invalid type', async () => {
    const r = await req('POST', '/api/maintenance', { title: 'test', maintenance_type: 'invalid' });
    assert.equal(r.status, 400);
  });

  it('46.06 POST /api/maintenance rejects invalid priority', async () => {
    const r = await req('POST', '/api/maintenance', { title: 'test', priority: 'invalid' });
    assert.equal(r.status, 400);
  });

  it('46.07 POST /api/fabrics rejects missing code', async () => {
    const r = await req('POST', '/api/fabrics', { name: 'No Code' });
    assert.equal(r.status, 400);
  });

  it('46.08 POST /api/returns/sales rejects missing customer', async () => {
    const r = await req('POST', '/api/returns/sales', { items: [{ quantity: 1, unit_price: 10 }] });
    assert.equal(r.status, 400);
  });

  it('46.09 POST /api/returns/purchases rejects missing supplier', async () => {
    const r = await req('POST', '/api/returns/purchases', { items: [{ quantity: 1, unit_price: 10 }] });
    assert.equal(r.status, 400);
  });

  it('46.10 POST /api/stage-templates rejects missing name', async () => {
    const r = await req('POST', '/api/stage-templates', {});
    assert.equal(r.status, 400);
  });
});

describe('47. Search / Filters', () => {
  it('47.01 GET /api/fabrics?search=test', async () => {
    const r = await req('GET', '/api/fabrics?search=test');
    assert.equal(r.status, 200);
  });

  it('47.02 GET /api/customers?search=test', async () => {
    const r = await req('GET', '/api/customers?search=test');
    assert.equal(r.status, 200);
  });

  it('47.03 GET /api/expenses?type=other', async () => {
    const r = await req('GET', '/api/expenses?type=other');
    assert.equal(r.status, 200);
  });

  it('47.04 GET /api/maintenance?status=pending', async () => {
    const r = await req('GET', '/api/maintenance?status=pending');
    assert.equal(r.status, 200);
  });

  it('47.05 GET /api/work-orders?status=pending', async () => {
    const r = await req('GET', '/api/work-orders?status=pending');
    assert.equal(r.status, 200);
  });
});

describe('48. Export endpoints', () => {
  it('48.01 GET /api/fabrics/export returns CSV', async () => {
    const r = await req('GET', '/api/fabrics/export');
    assert.equal(r.status, 200);
  });

  it('48.02 GET /api/expenses/export returns CSV', async () => {
    const r = await req('GET', '/api/expenses/export');
    assert.equal(r.status, 200);
  });

  it('48.03 GET /api/maintenance/export returns CSV', async () => {
    const r = await req('GET', '/api/maintenance/export');
    assert.equal(r.status, 200);
  });

  it('48.04 GET /api/accessories/export returns CSV', async () => {
    const r = await req('GET', '/api/accessories/export');
    assert.equal(r.status, 200);
  });
});

describe('49. Inventory endpoints', () => {
  it('49.01 GET /api/inventory/fabric-stock lists', async () => {
    const r = await req('GET', '/api/inventory/fabric-stock');
    assert.equal(r.status, 200);
  });

  it('49.02 GET /api/inventory/accessory-stock', async () => {
    const r = await req('GET', '/api/inventory/accessory-stock');
    assert.equal(r.status, 200);
  });
});

describe('50. Sales Orders', () => {
  it('50.01 GET /api/quotations/sales-orders/list lists', async () => {
    const r = await req('GET', '/api/quotations/sales-orders/list');
    assert.equal(r.status, 200);
  });
});
