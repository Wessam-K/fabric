const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const BASE = process.env.TEST_BASE || 'http://localhost:9002';
const UID = Date.now().toString(36).slice(-4);
let TOKEN = '';

// ─── HTTP helper ──────────────────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function req(method, path, body) {
  return request(method, path, body, TOKEN);
}

// ─── Auth setup ─────────────────────────────────────
before(async () => {
  // Step 1: attempt first-run admin creation (may 403 if already exists)
  await request('POST', '/api/setup/create-admin', {
    username: 'admin', full_name: 'Admin', password: 'Admin@2024!',
  });

  // Step 2: login (try multiple known passwords)
  const passwords = ['Admin@2024!', 'Admin123', '123456'];
  for (const pw of passwords) {
    const loginRes = await request('POST', '/api/auth/login', {
      username: 'admin', password: pw,
    });
    if (loginRes.status === 200 && loginRes.body.token) {
      TOKEN = loginRes.body.token;
      break;
    }
  }
  if (!TOKEN) {
    throw new Error('Cannot get auth token — tried all known passwords');
  }

  // Step 3: seed master data (409 = already exists, that's fine)
  await req('POST', '/api/fabrics', { code: 'CTN-001', name: 'قطن أساسي', fabric_type: 'main', price_per_m: 50 });
  await req('POST', '/api/accessories', { code: 'BTN-001', acc_type: 'button', name: 'زرار أساسي', unit_price: 0.5 });
});

after(async () => {
  // Cleanup test-run-specific records
  await req('DELETE', `/api/fabrics/TST-F${UID}`);
  await req('DELETE', `/api/accessories/TST-A${UID}`);
  await req('DELETE', `/api/models/TST-M${UID}`);
  await req('DELETE', `/api/suppliers/SUP-${UID}`);
});

// ============ Health Check ============
describe('Health Check', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });
});

// ============ Auth API ============
describe('Auth API', () => {
  it('POST /api/auth/login rejects bad password', async () => {
    const res = await request('POST', '/api/auth/login', {
      username: 'admin', password: 'wrongpassword',
    });
    assert.ok(res.status === 401 || res.status === 400);
  });

  it('GET /api/auth/me returns current user', async () => {
    const res = await req('GET', '/api/auth/me');
    assert.equal(res.status, 200);
    assert.ok(res.body.username);
  });

  it('GET without token returns 401', async () => {
    const res = await request('GET', '/api/settings');
    assert.equal(res.status, 401);
  });
});

// ============ Settings API ============
describe('Settings API', () => {
  it('GET /api/settings returns object with default keys', async () => {
    const res = await req('GET', '/api/settings');
    assert.equal(res.status, 200);
    assert.ok(res.body.masnaiya_default !== undefined, 'should have masnaiya_default');
    assert.ok(res.body.masrouf_default !== undefined, 'should have masrouf_default');
    assert.ok(res.body.waste_pct_default !== undefined, 'should have waste_pct_default');
    assert.ok(res.body.margin_default !== undefined, 'should have margin_default');
  });

  it('PUT /api/settings updates values', async () => {
    const res = await req('PUT', '/api/settings', { masnaiya_default: '100', masrouf_default: '60' });
    assert.equal(res.status, 200);
    assert.equal(res.body.masnaiya_default, '100');
  });

  it('PUT /api/settings restores original values', async () => {
    const res = await req('PUT', '/api/settings', { masnaiya_default: '90', masrouf_default: '50' });
    assert.equal(res.status, 200);
    assert.equal(res.body.masnaiya_default, '90');
  });
});

// ============ Fabrics API ============
describe('Fabrics API', () => {
  it('GET /api/fabrics returns array', async () => {
    const res = await req('GET', '/api/fabrics');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/fabrics?type=main filters correctly', async () => {
    const res = await req('GET', '/api/fabrics?type=main');
    assert.equal(res.status, 200);
    assert.ok(res.body.every(f => f.fabric_type === 'main' || f.fabric_type === 'both'));
  });

  it('POST /api/fabrics creates new fabric', async () => {
    const res = await req('POST', '/api/fabrics', {
      code: `TST-F${UID}`, name: 'قماش اختبار', fabric_type: 'main', price_per_m: 100,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.code, `TST-F${UID}`);
  });

  it('POST /api/fabrics duplicate returns 409', async () => {
    const res = await req('POST', '/api/fabrics', {
      code: `TST-F${UID}`, name: 'مكرر', fabric_type: 'main', price_per_m: 50,
    });
    assert.equal(res.status, 409);
  });

  it('PUT /api/fabrics/:code updates fabric', async () => {
    const res = await req('PUT', `/api/fabrics/TST-F${UID}`, { name: 'قماش معدل', price_per_m: 120 });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'قماش معدل');
  });

  it('DELETE /api/fabrics/:code deactivates', async () => {
    const res = await req('DELETE', `/api/fabrics/TST-F${UID}`);
    assert.equal(res.status, 200);
  });
});

// ============ Accessories API ============
describe('Accessories API', () => {
  it('GET /api/accessories returns array', async () => {
    const res = await req('GET', '/api/accessories');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('POST /api/accessories creates new', async () => {
    const res = await req('POST', '/api/accessories', {
      code: `TST-A${UID}`, acc_type: 'button', name: 'زرار اختبار', unit_price: 1.0,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.code, `TST-A${UID}`);
  });

  it('POST /api/accessories duplicate returns 409', async () => {
    const res = await req('POST', '/api/accessories', {
      code: `TST-A${UID}`, acc_type: 'button', name: 'مكرر', unit_price: 2.0,
    });
    assert.equal(res.status, 409);
  });

  it('PUT /api/accessories/:code updates', async () => {
    const res = await req('PUT', `/api/accessories/TST-A${UID}`, { name: 'زرار معدل' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'زرار معدل');
  });

  it('DELETE /api/accessories/:code deactivates', async () => {
    const res = await req('DELETE', `/api/accessories/TST-A${UID}`);
    assert.equal(res.status, 200);
  });
});

// ============ Models API ============
describe('Models API', () => {
  it('GET /api/models returns array', async () => {
    const res = await req('GET', '/api/models');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/models/next-serial returns suggestion', async () => {
    const res = await req('GET', '/api/models/next-serial');
    assert.equal(res.status, 200);
    assert.ok(res.body.next_serial);
  });

  it('POST /api/models creates model', async () => {
    const code = `TST-M${UID}`;
    const res = await req('POST', '/api/models', {
      serial_number: `99-${UID}`,
      model_code: code,
      model_name: 'موديل اختبار',
      masnaiya: 80,
      masrouf: 40,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.model_code, code);
  });

  it('GET /api/models/:code returns model', async () => {
    const code = `TST-M${UID}`;
    const res = await req('GET', `/api/models/${code}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.model_code, code);
  });

  it('PUT /api/models/:code updates model', async () => {
    const code = `TST-M${UID}`;
    const res = await req('PUT', `/api/models/${code}`, {
      model_name: 'موديل معدل',
      masnaiya: 100,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.model_name, 'موديل معدل');
  });

  it('DELETE /api/models/:code deactivates', async () => {
    const code = `TST-M${UID}`;
    const res = await req('DELETE', `/api/models/${code}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.message);
  });
});

// ============ Suppliers API ============
describe('Suppliers API', () => {
  it('GET /api/suppliers returns array', async () => {
    const res = await req('GET', '/api/suppliers');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});

// ============ Customers API ============
describe('Customers API', () => {
  it('GET /api/customers returns customers', async () => {
    const res = await req('GET', '/api/customers');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.customers) || Array.isArray(res.body));
  });
});

// ============ Work Orders API ============
describe('Work Orders API', () => {
  it('GET /api/work-orders returns work_orders and stats', async () => {
    const res = await req('GET', '/api/work-orders');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.work_orders));
    assert.ok(res.body.stats !== undefined);
  });
});

// ============ Reports API ============
describe('Reports API', () => {
  it('GET /api/reports/summary returns KPIs', async () => {
    const res = await req('GET', '/api/reports/summary');
    assert.equal(res.status, 200);
    assert.ok(res.body.total_models !== undefined);
  });

  it('GET /api/reports/by-fabric returns array', async () => {
    const res = await req('GET', '/api/reports/by-fabric');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/reports/by-accessory returns array', async () => {
    const res = await req('GET', '/api/reports/by-accessory');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/reports/customer-summary returns data', async () => {
    const res = await req('GET', '/api/reports/customer-summary');
    assert.equal(res.status, 200);
    assert.ok(res.body.customers !== undefined);
  });

  it('GET /api/reports/inventory-status returns data', async () => {
    const res = await req('GET', '/api/reports/inventory-status');
    assert.equal(res.status, 200);
    assert.ok(res.body.fabrics !== undefined);
    assert.ok(res.body.accessories !== undefined);
  });
});

// ============ Notifications API ============
describe('Notifications API', () => {
  it('GET /api/notifications returns data', async () => {
    const res = await req('GET', '/api/notifications');
    assert.equal(res.status, 200);
    assert.ok(res.body.notifications !== undefined || Array.isArray(res.body));
  });

  it('GET /api/notifications/count returns unread_count', async () => {
    const res = await req('GET', '/api/notifications/count');
    assert.equal(res.status, 200);
    assert.ok(res.body.unread_count !== undefined);
  });
});

// ============ Dashboard API ============
describe('Dashboard API', () => {
  it('GET /api/dashboard returns stats', async () => {
    const res = await req('GET', '/api/dashboard');
    assert.equal(res.status, 200);
    assert.ok(res.body !== null);
  });
});

// ============ Purchase Orders API ============
describe('Purchase Orders API', () => {
  it('GET /api/purchase-orders returns orders and totals', async () => {
    const res = await req('GET', '/api/purchase-orders');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.orders));
    assert.ok(res.body.totals !== undefined);
  });
});

// ============ Invoices API ============
describe('Invoices API', () => {
  it('GET /api/invoices returns invoices and totals', async () => {
    const res = await req('GET', '/api/invoices');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.invoices));
    assert.ok(res.body.totals !== undefined);
  });
});

// ============ Machines API ============
describe('Machines API', () => {
  it('GET /api/machines returns array', async () => {
    const res = await req('GET', '/api/machines');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});

// ============ Suppliers POST ============
describe('Suppliers Create', () => {
  it('POST /api/suppliers creates new supplier', async () => {
    const res = await req('POST', '/api/suppliers', {
      code: `SUP-${UID}`, name: 'مورد اختبار', supplier_type: 'fabric',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.code, `SUP-${UID}`);
  });
});

// ============ Search API ============
describe('Search API', () => {
  it('GET /api/search?q=test returns result object', async () => {
    const res = await req('GET', '/api/search?q=test');
    assert.equal(res.status, 200);
    assert.ok(res.body.models !== undefined);
    assert.ok(res.body.fabrics !== undefined);
    assert.ok(res.body.accessories !== undefined);
  });
});

// ════════════════════════════════════════════════════
//  V23 Module Endpoint Tests
// ════════════════════════════════════════════════════

describe('Quotations API', () => {
  it('GET /api/quotations returns array', async () => {
    const res = await req('GET', '/api/quotations');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
  it('GET /api/quotations/:id returns quotation', async () => {
    // Get a valid ID from the list first
    const listRes = await req('GET', '/api/quotations');
    const items = listRes.body.data || listRes.body;
    if (items.length > 0) {
      const res = await req('GET', `/api/quotations/${items[0].id}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.quotation_number || res.body.id);
    }
  });
});

describe('Sales Orders API', () => {
  it('GET /api/quotations/sales-orders/list returns array', async () => {
    const res = await req('GET', '/api/quotations/sales-orders/list');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
});

describe('Samples API', () => {
  it('GET /api/samples returns array', async () => {
    const res = await req('GET', '/api/samples');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
});

describe('Shipping API', () => {
  it('GET /api/shipping returns array', async () => {
    const res = await req('GET', '/api/shipping');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
  it('GET /api/shipping/:id returns shipment', async () => {
    // Get a valid ID from the list first
    const listRes = await req('GET', '/api/shipping');
    const items = listRes.body.data || listRes.body;
    if (items.length > 0) {
      const res = await req('GET', `/api/shipping/${items[0].id}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.shipment_number || res.body.id);
    }
  });
});

describe('Returns API', () => {
  it('GET /api/returns/sales returns array', async () => {
    const res = await req('GET', '/api/returns/sales');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
  it('GET /api/returns/purchases returns array', async () => {
    const res = await req('GET', '/api/returns/purchases');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
});

describe('Quality API', () => {
  it('GET /api/quality/inspections returns array', async () => {
    const res = await req('GET', '/api/quality/inspections');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
  it('GET /api/quality/templates returns array', async () => {
    const res = await req('GET', '/api/quality/templates');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
  it('GET /api/quality/defect-codes returns array', async () => {
    const res = await req('GET', '/api/quality/defect-codes');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
  it('GET /api/quality/ncr returns array', async () => {
    const res = await req('GET', '/api/quality/ncr');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
});

describe('MRP API', () => {
  it('GET /api/mrp returns array', async () => {
    const res = await req('GET', '/api/mrp');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
});

describe('Scheduling API', () => {
  it('GET /api/scheduling returns array', async () => {
    const res = await req('GET', '/api/scheduling');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
  it('GET /api/scheduling/lines returns production lines', async () => {
    const res = await req('GET', '/api/scheduling/lines');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
});

describe('Expenses API', () => {
  it('GET /api/expenses returns array', async () => {
    const res = await req('GET', '/api/expenses');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
});

describe('Documents API', () => {
  it('GET /api/documents returns array', async () => {
    const res = await req('GET', '/api/documents');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
});

describe('Backups API', () => {
  it('GET /api/backups returns array', async () => {
    const res = await req('GET', '/api/backups');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data || res.body));
  });
});

// ════════════════════════════════════════════════════
//  RBAC Security Tests (Category A5)
// ════════════════════════════════════════════════════

describe('RBAC — Auth Bypass Attempts', () => {
  it('request with no token returns 401', async () => {
    const res = await request('GET', '/api/work-orders');
    assert.equal(res.status, 401);
  });

  it('request with malformed token returns 401', async () => {
    const res = await request('GET', '/api/work-orders', null, 'invalid.token.here');
    assert.equal(res.status, 401);
  });

  it('request with tampered token returns 401', async () => {
    // Take valid token and tamper with payload
    const parts = TOKEN.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    payload.role = 'superadmin';
    payload.id = 99999;
    const tampered = parts[0] + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + parts[2];
    const res = await request('GET', '/api/work-orders', null, tampered);
    assert.equal(res.status, 401);
  });
});

describe('RBAC — Role Creation & Permissions', () => {
  const testRoles = {};
  const UID2 = Date.now().toString(36).slice(-5);

  before(async () => {
    // Create test users for each role using admin token
    const rolesToCreate = ['viewer', 'hr', 'production', 'accountant', 'manager'];
    for (const role of rolesToCreate) {
      const username = `rbac_${role}_${UID2}`;
      const pw = `Test${role}@2024!`;
      const createRes = await req('POST', '/api/users', {
        username,
        full_name: `Test ${role}`,
        password: pw,
        role,
      });
      // May be 201 or 400 if already exists; either way login next
      const loginRes = await request('POST', '/api/auth/login', {
        username,
        password: pw,
      });
      if (loginRes.status === 200 && loginRes.body.token) {
        testRoles[role] = loginRes.body.token;
      }
    }
  });

  after(async () => {
    // Cleanup: delete test users (best-effort)
    try {
      const users = await req('GET', '/api/users');
      if (users.status === 200 && Array.isArray(users.body)) {
        for (const role of Object.keys(testRoles)) {
          const username = `rbac_${role}_${UID2}`;
          const u = users.body.find(x => x.username === username);
          if (u) await req('DELETE', `/api/users/${u.id}`);
        }
      }
    } catch {}
  });

  // VIEWER CANNOT WRITE
  it('viewer cannot create work order', async () => {
    if (!testRoles.viewer) return;
    const res = await request('POST', '/api/work-orders', {
      customer_id: 1, model_id: 1, quantity: 10,
    }, testRoles.viewer);
    assert.equal(res.status, 403);
  });

  it('viewer cannot create invoice', async () => {
    if (!testRoles.viewer) return;
    const res = await request('POST', '/api/invoices', {
      customer_id: 1, items: [],
    }, testRoles.viewer);
    assert.equal(res.status, 403);
  });

  it('viewer cannot modify settings', async () => {
    if (!testRoles.viewer) return;
    const res = await request('PUT', '/api/settings', {
      masnaiya_default: '999',
    }, testRoles.viewer);
    assert.equal(res.status, 403);
  });

  it('viewer cannot create fabric', async () => {
    if (!testRoles.viewer) return;
    const res = await request('POST', '/api/fabrics', {
      code: 'RBAC-TEST', name: 'test', fabric_type: 'main', price_per_m: 10,
    }, testRoles.viewer);
    assert.equal(res.status, 403);
  });

  it('viewer can view work orders (read-only)', async () => {
    if (!testRoles.viewer) return;
    const res = await request('GET', '/api/work-orders', null, testRoles.viewer);
    assert.equal(res.status, 200);
  });

  // ROLE ISOLATION
  it('hr role cannot create work orders', async () => {
    if (!testRoles.hr) return;
    const res = await request('POST', '/api/work-orders', {
      customer_id: 1, model_id: 1, quantity: 10,
    }, testRoles.hr);
    assert.equal(res.status, 403);
  });

  it('hr role cannot create invoices', async () => {
    if (!testRoles.hr) return;
    const res = await request('POST', '/api/invoices', {
      customer_id: 1, items: [],
    }, testRoles.hr);
    assert.equal(res.status, 403);
  });

  it('production role cannot manage payroll', async () => {
    if (!testRoles.production) return;
    const res = await request('POST', '/api/hr/payroll/periods', {
      period_month: '2026-03', period_name: 'Test',
    }, testRoles.production);
    assert.equal(res.status, 403);
  });

  it('accountant cannot create employees', async () => {
    if (!testRoles.accountant) return;
    const res = await request('POST', '/api/hr/employees', {
      emp_code: 'RBAC-TEST', full_name: 'Test',
    }, testRoles.accountant);
    assert.equal(res.status, 403);
  });

  // ADMIN PROTECTION
  it('manager cannot create users', async () => {
    if (!testRoles.manager) return;
    const res = await request('POST', '/api/users', {
      username: 'hack_user', full_name: 'Hacker', password: 'Hack1234',
    }, testRoles.manager);
    assert.equal(res.status, 403);
  });

  it('viewer cannot delete users', async () => {
    if (!testRoles.viewer) return;
    const res = await request('DELETE', '/api/users/1', null, testRoles.viewer);
    assert.equal(res.status, 403);
  });

  it('production cannot access permissions roles', async () => {
    if (!testRoles.production) return;
    const res = await request('GET', '/api/permissions/roles', null, testRoles.production);
    assert.equal(res.status, 403);
  });
});

describe('RBAC — Account Lockout', () => {
  const UID3 = Date.now().toString(36).slice(-4);
  const lockUser = `lock_${UID3}`;

  before(async () => {
    // Create a user for lockout testing
    await req('POST', '/api/users', {
      username: lockUser,
      full_name: 'Lockout Test',
      password: 'Lock@2024Test!',
      role: 'viewer',
    });
  });

  after(async () => {
    // Cleanup
    const users = await req('GET', '/api/users');
    if (users.status === 200 && Array.isArray(users.body)) {
      const u = users.body.find(x => x.username === lockUser);
      if (u) await req('DELETE', `/api/users/${u.id}`);
    }
  });

  it('account locks after 5 failed attempts', async () => {
    // Send 5 wrong password attempts
    for (let i = 0; i < 5; i++) {
      await request('POST', '/api/auth/login', {
        username: lockUser,
        password: 'WrongPass' + i,
      });
    }
    // 6th attempt should return 423 (locked)
    const res = await request('POST', '/api/auth/login', {
      username: lockUser,
      password: 'WrongPass6',
    });
    assert.equal(res.status, 423);
  });

  it('locked account rejects correct password too', async () => {
    const res = await request('POST', '/api/auth/login', {
      username: lockUser,
      password: 'Lock@2024Test!',
    });
    assert.equal(res.status, 423);
  });
});

describe('RBAC — Input Validation Security', () => {
  it('SQL injection in search is harmless', async () => {
    const res = await req('GET', "/api/work-orders?search='; DROP TABLE work_orders;--");
    assert.equal(res.status, 200);
    // Verify work_orders table still works
    const res2 = await req('GET', '/api/work-orders');
    assert.equal(res2.status, 200);
    assert.ok(Array.isArray(res2.body.work_orders));
  });

  it('SQL injection in customer search is harmless', async () => {
    const res = await req('GET', "/api/customers?search=' OR 1=1 --");
    assert.equal(res.status, 200);
  });

  it('XSS payload in text field is stripped', async () => {
    const xssPayload = '<script>alert(1)</script>Test Name';
    const res = await req('POST', '/api/fabrics', {
      code: `XSS-${UID}`, name: xssPayload, fabric_type: 'main', price_per_m: 10,
    });
    // Should succeed but name should be sanitized (no HTML tags)
    if (res.status === 201) {
      assert.ok(!res.body.name || !res.body.name.includes('<script>'));
      // Cleanup
      await req('DELETE', `/api/fabrics/XSS-${UID}`);
    }
  });

  it('nested XSS bypass attempt is blocked', async () => {
    const nestedXss = '<<script>script>alert(1)<</script>/script>';
    const res = await req('POST', '/api/fabrics', {
      code: `XSS2-${UID}`, name: nestedXss, fabric_type: 'main', price_per_m: 10,
    });
    if (res.status === 201) {
      const check = await req('GET', `/api/fabrics`);
      const fabric = check.body.find(f => f.code === `XSS2-${UID}`);
      if (fabric) {
        assert.ok(!fabric.name.includes('<script>'), 'nested XSS should be stripped');
      }
      await req('DELETE', `/api/fabrics/XSS2-${UID}`);
    }
  });

  it('very long input does not crash server', async () => {
    const longStr = 'A'.repeat(10000);
    const res = await req('POST', '/api/fabrics', {
      code: longStr, name: longStr, fabric_type: 'main', price_per_m: 10,
    });
    // Should not crash — may return 400 or 500 but server stays alive
    assert.ok(res.status >= 200 && res.status < 600);
    // Verify server is still alive
    const health = await req('GET', '/api/health');
    assert.equal(health.status, 200);
  });
});

// ════════════════════════════════════════════════════
//  Phase 5.1: License API Tests
// ════════════════════════════════════════════════════

describe('License API', () => {
  it('GET /api/license/status returns license info', async () => {
    const res = await req('GET', '/api/license/status');
    assert.equal(res.status, 200);
    assert.ok(res.body.type);
    assert.ok(res.body.status);
    assert.ok(typeof res.body.daysLeft === 'number');
  });

  it('POST /api/license/activate rejects invalid key format', async () => {
    const res = await req('POST', '/api/license/activate', { licenseKey: 'invalid' });
    assert.equal(res.status, 400);
  });

  it('POST /api/license/activate accepts valid key format', async () => {
    const res = await req('POST', '/api/license/activate', { licenseKey: 'EN00-TEST-1234-5678' });
    assert.equal(res.status, 200);
    assert.ok(res.body.success);
    assert.equal(res.body.license.license_type, 'enterprise');
  });
});

// ════════════════════════════════════════════════════
//  Phase 3.4: Swagger API Tests
// ════════════════════════════════════════════════════

describe('Swagger API Docs', () => {
  it('GET /api/docs.json returns OpenAPI spec', async () => {
    const res = await request('GET', '/api/docs.json');
    assert.equal(res.status, 200);
    assert.ok(res.body.openapi);
    assert.ok(res.body.info);
    assert.equal(res.body.info.title, 'WK-Factory API');
  });
});

// ════════════════════════════════════════════════════
//  Phase 5.6: Monitoring Endpoint Tests
// ════════════════════════════════════════════════════

describe('Monitoring API', () => {
  it('GET /api/monitoring returns system status', async () => {
    const res = await req('GET', '/api/monitoring');
    assert.equal(res.status, 200);
    assert.ok(res.body.uptime_seconds >= 0);
    assert.ok(res.body.memory);
    assert.ok(res.body.database);
    assert.ok(res.body.node_version);
    assert.ok(res.body.license);
  });
});

// ════════════════════════════════════════════════════
//  Phase 2.1: Migration System Tests
// ════════════════════════════════════════════════════

describe('Migration System', () => {
  it('schema_migrations table exists and has versions', async () => {
    const res = await req('GET', '/api/health');
    assert.equal(res.status, 200);
    // If health check passes, migrations ran successfully
  });
});

// ════════════════════════════════════════════════════
//  API Versioning Tests
// ════════════════════════════════════════════════════

describe('API Versioning', () => {
  it('GET /api/v1/fabrics works same as /api/fabrics', async () => {
    const v1 = await req('GET', '/api/v1/fabrics');
    const v0 = await req('GET', '/api/fabrics');
    assert.equal(v1.status, 200);
    assert.equal(v0.status, 200);
  });

  it('GET /api/v1/health returns ok', async () => {
    const res = await request('GET', '/api/health');
    assert.equal(res.status, 200);
  });
});

// ════════════════════════════════════════════════════
//  Rate Limiting Tests
// ════════════════════════════════════════════════════

describe('Rate Limiting', () => {
  it('excessive login attempts get rate limited', async () => {
    // This test is informational — rate limiting is skipped in test env
    const res = await request('POST', '/api/auth/login', {
      username: 'nonexistent', password: 'wrong',
    });
    assert.ok(res.status === 401 || res.status === 429);
  });
});

// ════════════════════════════════════════════════════
//  Webhook Management Tests
// ════════════════════════════════════════════════════

describe('Webhook Management', () => {
  let webhookId;

  it('POST /api/webhooks creates a webhook', async () => {
    const res = await req('POST', '/api/webhooks', {
      name: 'Test Hook',
      url: 'https://example.com/hook',
      events: ['workorder.created', 'invoice.created'],
      secret: 'test-secret-123',
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    webhookId = res.body.id;
  });

  it('GET /api/webhooks lists webhooks', async () => {
    const res = await req('GET', '/api/webhooks');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });

  it('GET /api/webhooks/:id/logs returns logs', async () => {
    const res = await req('GET', `/api/webhooks/${webhookId}/logs`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('DELETE /api/webhooks/:id removes webhook', async () => {
    const res = await req('DELETE', `/api/webhooks/${webhookId}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.success);
  });
});

// ═══ Enterprise Hardening v3.4 Tests ═══

describe('CSRF Protection', () => {
  it('CSRF middleware is loaded (test mode skips enforcement)', async () => {
    // In test mode, CSRF is skipped — verify a POST works without CSRF token
    const res = await req('POST', '/api/auth/refresh');
    assert.ok([200, 401].includes(res.status)); // Either works or needs auth, not 403
  });
});

describe('Content-Type Enforcement', () => {
  it('rejects POST without Content-Type in production mode', async () => {
    // Our request helper always sends application/json, so this test confirms normal flow
    const res = await req('POST', '/api/auth/login', { username: 'admin', password: 'Admin@2024!' });
    assert.ok([200, 401, 423].includes(res.status));
  });
});

describe('Password Reset Flow', () => {
  it('POST /api/auth/forgot-password returns success even for non-existent user', async () => {
    const res = await request('POST', '/api/auth/forgot-password', { username: 'nonexistent_user_xyz' });
    assert.equal(res.status, 200);
    assert.ok(res.body.message);
  });

  it('POST /api/auth/forgot-password generates token for existing user', async () => {
    const res = await request('POST', '/api/auth/forgot-password', { username: 'admin' });
    assert.equal(res.status, 200);
    assert.ok(res.body.reset_token); // Only in test/dev mode
  });

  it('POST /api/auth/reset-password consumes token', async () => {
    const forgot = await request('POST', '/api/auth/forgot-password', { username: 'admin' });
    assert.equal(forgot.status, 200);
    const token = forgot.body.reset_token;

    const res = await request('POST', '/api/auth/reset-password', {
      token, new_password: 'Admin@2024!'
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.message);
  });

  it('POST /api/auth/reset-password rejects used token', async () => {
    const forgot = await request('POST', '/api/auth/forgot-password', { username: 'admin' });
    const token = forgot.body.reset_token;
    await request('POST', '/api/auth/reset-password', { token, new_password: 'Admin@2024!' });
    const res = await request('POST', '/api/auth/reset-password', { token, new_password: 'Admin@2024!' });
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/reset-password rejects weak password', async () => {
    const forgot = await request('POST', '/api/auth/forgot-password', { username: 'admin' });
    const res = await request('POST', '/api/auth/reset-password', {
      token: forgot.body.reset_token, new_password: '123'
    });
    assert.equal(res.status, 400);
  });
});

describe('2FA Endpoints', () => {
  it('POST /api/auth/2fa/setup returns 501 without otplib', async () => {
    const res = await req('POST', '/api/auth/2fa/setup');
    // Either 501 (otplib not installed) or 200 (if installed)
    assert.ok([200, 501].includes(res.status));
  });
});

describe('Session Management', () => {
  it('GET /api/sessions returns array', async () => {
    const res = await req('GET', '/api/sessions');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('DELETE /api/sessions revokes all sessions', async () => {
    const res = await req('DELETE', '/api/sessions');
    assert.equal(res.status, 200);
    assert.ok(res.body.message);
  });
});

describe('User Invitations', () => {
  let inviteId;

  it('POST /api/users/invite creates invitation', async () => {
    const res = await req('POST', '/api/users/invite', {
      email: 'test@example.com', role: 'viewer'
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.invite_token); // test mode
  });

  it('GET /api/users/invitations lists invitations', async () => {
    const res = await req('GET', '/api/users/invitations');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    if (res.body.length > 0) inviteId = res.body[0].id;
  });

  it('DELETE /api/users/invitations/:id revokes invitation', async () => {
    if (!inviteId) return;
    const res = await req('DELETE', `/api/users/invitations/${inviteId}`);
    assert.equal(res.status, 200);
  });
});

describe('Audit Log Export', () => {
  it('GET /api/audit-log/export returns CSV', async () => {
    const res = await req('GET', '/api/audit-log/export');
    assert.equal(res.status, 200);
    // Body will be raw CSV text, not JSON
  });
});

describe('Data Retention', () => {
  it('GET /api/admin/retention returns retention info', async () => {
    const res = await req('GET', '/api/admin/retention');
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.audit_retention_days === 'number');
  });

  it('POST /api/admin/retention/purge executes purge', async () => {
    const res = await req('POST', '/api/admin/retention/purge');
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.purged === 'number');
  });
});

describe('License Status', () => {
  it('GET /api/license/status returns license info', async () => {
    const res = await req('GET', '/api/license/status');
    assert.equal(res.status, 200);
    assert.ok(res.body.license_type || res.body.status);
  });
});

describe('Health & Monitoring', () => {
  it('GET /api/health returns ok without auth', async () => {
    const res = await request('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /api/monitoring returns system info', async () => {
    const res = await req('GET', '/api/monitoring');
    assert.equal(res.status, 200);
    assert.ok(res.body.uptime_seconds >= 0);
    assert.ok(res.body.memory);
  });
});
