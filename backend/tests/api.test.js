const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const BASE = 'http://localhost:9002';
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
  // Login with known admin credentials
  const loginRes = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: '123456',
  });
  if (loginRes.status === 200 && loginRes.body.token) {
    TOKEN = loginRes.body.token;
  } else {
    throw new Error(`Cannot get auth token. Login response: ${JSON.stringify(loginRes.body)}`);
  }
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
  it('GET /api/customers returns array', async () => {
    const res = await req('GET', '/api/customers');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
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

// ============ Machines API ============
describe('Machines API', () => {
  it('GET /api/machines returns array', async () => {
    const res = await req('GET', '/api/machines');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});
