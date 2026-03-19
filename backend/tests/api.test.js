const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const BASE = 'http://localhost:9002';
const UID = Date.now().toString(36).slice(-4);
let authToken = '';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============ Auth Setup (runs before all tests) ============
before(async () => {
  // Try login first (account may already exist from a previous run)
  const loginRes = await request('POST', '/api/auth/login', {
    username: 'test_admin_ci',
    password: 'TestAdmin123!',
  });
  if (loginRes.status === 200) {
    authToken = loginRes.body.token;
    return;
  }

  // Fresh DB: create the CI admin account
  const setupRes = await request('POST', '/api/setup/create-admin', {
    username: 'test_admin_ci',
    full_name: 'CI Test Admin',
    password: 'TestAdmin123!',
  });
  if (setupRes.status !== 200) {
    throw new Error(`Auth setup failed: setup=${setupRes.status} ${JSON.stringify(setupRes.body)}`);
  }

  const res = await request('POST', '/api/auth/login', {
    username: 'test_admin_ci',
    password: 'TestAdmin123!',
  });
  if (res.status !== 200) {
    throw new Error(`Auth login failed after setup: ${res.status} ${JSON.stringify(res.body)}`);
  }
  authToken = res.body.token;
});

// ============ Settings API ============
describe('Settings API', () => {
  it('GET /api/settings returns object with default keys', async () => {
    const res = await request('GET', '/api/settings');
    assert.equal(res.status, 200);
    assert.ok(res.body.masnaiya_default !== undefined, 'should have masnaiya_default');
    assert.ok(res.body.masrouf_default !== undefined, 'should have masrouf_default');
    assert.ok(res.body.waste_pct_default !== undefined, 'should have waste_pct_default');
    assert.ok(res.body.margin_default !== undefined, 'should have margin_default');
  });

  it('PUT /api/settings updates values', async () => {
    const res = await request('PUT', '/api/settings', { masnaiya_default: '100', masrouf_default: '60' });
    assert.equal(res.status, 200);
    assert.equal(res.body.masnaiya_default, '100');
    assert.equal(res.body.masrouf_default, '60');
  });

  it('PUT /api/settings restores original values', async () => {
    const res = await request('PUT', '/api/settings', { masnaiya_default: '90', masrouf_default: '50' });
    assert.equal(res.status, 200);
    assert.equal(res.body.masnaiya_default, '90');
  });
});

// ============ Fabrics API ============
describe('Fabrics API', () => {
  it('GET /api/fabrics returns array', async () => {
    const res = await request('GET', '/api/fabrics');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/fabrics?type=main filters main fabrics', async () => {
    const res = await request('GET', '/api/fabrics?type=main');
    assert.equal(res.status, 200);
    assert.ok(res.body.every(f => f.fabric_type === 'main' || f.fabric_type === 'both'));
  });

  it('POST /api/fabrics creates new fabric', async () => {
    const res = await request('POST', '/api/fabrics', {
      code: `TST-F${UID}`, name: 'قماش اختبار', fabric_type: 'main', price_per_m: 100,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.code, `TST-F${UID}`);
  });

  it('POST /api/fabrics duplicate returns 409', async () => {
    const res = await request('POST', '/api/fabrics', {
      code: `TST-F${UID}`, name: 'قماش مكرر', fabric_type: 'main', price_per_m: 50,
    });
    assert.equal(res.status, 409);
  });

  it('PUT /api/fabrics/:code updates fabric', async () => {
    const res = await request('PUT', `/api/fabrics/TST-F${UID}`, { name: 'قماش معدل', price_per_m: 120 });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'قماش معدل');
  });

  it('DELETE /api/fabrics/:code deactivates', async () => {
    const res = await request('DELETE', `/api/fabrics/TST-F${UID}`);
    assert.equal(res.status, 200);
  });
});

// ============ Accessories API ============
describe('Accessories API', () => {
  it('GET /api/accessories returns array', async () => {
    const res = await request('GET', '/api/accessories');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('POST /api/accessories creates new accessory', async () => {
    const res = await request('POST', '/api/accessories', {
      code: `TST-A${UID}`, acc_type: 'button', name: 'زرار اختبار', unit_price: 1.0,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.code, `TST-A${UID}`);
  });

  it('POST /api/accessories duplicate returns 409', async () => {
    const res = await request('POST', '/api/accessories', {
      code: `TST-A${UID}`, acc_type: 'button', name: 'مكرر', unit_price: 2.0,
    });
    assert.equal(res.status, 409);
  });

  it('PUT /api/accessories/:code updates', async () => {
    const res = await request('PUT', `/api/accessories/TST-A${UID}`, { name: 'زرار معدل' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'زرار معدل');
  });

  it('DELETE /api/accessories/:code deactivates', async () => {
    const res = await request('DELETE', `/api/accessories/TST-A${UID}`);
    assert.equal(res.status, 200);
  });
});

// ============ Models API ============
describe('Models API', () => {
  const fabricCode = `CTN-T${UID}`;
  const accCode = `BTN-T${UID}`;

  before(async () => {
    const fRes = await request('POST', '/api/fabrics', {
      code: fabricCode, name: 'قماش نموذج اختبار', fabric_type: 'main', price_per_m: 50,
    });
    if (![201, 409].includes(fRes.status)) {
      throw new Error(`Failed to create test fabric: ${fRes.status} ${JSON.stringify(fRes.body)}`);
    }
    const aRes = await request('POST', '/api/accessories', {
      code: accCode, acc_type: 'button', name: 'زرار نموذج اختبار', unit_price: 0.5,
    });
    if (![201, 409].includes(aRes.status)) {
      throw new Error(`Failed to create test accessory: ${aRes.status} ${JSON.stringify(aRes.body)}`);
    }
  });

  after(async () => {
    await request('DELETE', `/api/fabrics/${fabricCode}`);
    await request('DELETE', `/api/accessories/${accCode}`);
  });

  it('GET /api/models returns array', async () => {
    const res = await request('GET', '/api/models');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/models/next-serial returns suggestion', async () => {
    const res = await request('GET', '/api/models/next-serial');
    assert.equal(res.status, 200);
    assert.ok(res.body.next_serial, 'should have next_serial');
  });

  it('POST /api/models creates model with nested data', async () => {
    const code = `TST-M${UID}`;
    const res = await request('POST', '/api/models', {
      serial_number: `99-${UID}`,
      model_code: code,
      model_name: 'موديل اختبار',
      masnaiya: 80,
      masrouf: 40,
      fabrics: [
        { fabric_code: fabricCode, role: 'main', meters_per_piece: 1.5, waste_pct: 5, color_note: 'أبيض' },
      ],
      accessories: [
        { accessory_code: accCode, accessory_name: 'زرار', quantity: 4, unit_price: 0.5 },
      ],
      sizes: [
        { color_label: 'أبيض', qty_s: 2, qty_m: 3, qty_l: 5, qty_xl: 3, qty_2xl: 1, qty_3xl: 0 },
      ],
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.model_code, code);
    assert.ok(res.body.fabrics.length >= 1);
    assert.ok(res.body.accessories.length >= 1);
    assert.ok(res.body.sizes.length >= 1);
  });

  it('GET /api/models/:code returns full model', async () => {
    const code = `TST-M${UID}`;
    const res = await request('GET', `/api/models/${code}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.model_code, code);
    assert.ok(res.body.cost_summary);
    assert.ok(res.body.cost_summary.cost_per_piece > 0);
  });

  it('PUT /api/models/:code updates model', async () => {
    const code = `TST-M${UID}`;
    const res = await request('PUT', `/api/models/${code}`, {
      model_name: 'موديل معدل',
      masnaiya: 100,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.model_name, 'موديل معدل');
  });

  it('GET /api/models/:code/cost returns cost calculation', async () => {
    const code = `TST-M${UID}`;
    const res = await request('GET', `/api/models/${code}/cost`);
    assert.equal(res.status, 200);
    assert.ok(res.body.total_cost >= 0);
    assert.ok(res.body.cost_per_piece >= 0);
  });

  it('DELETE /api/models/:code deactivates', async () => {
    const code = `TST-M${UID}`;
    const res = await request('DELETE', `/api/models/${code}`);
    assert.equal(res.status, 200);
  });
});

// ============ Reports API ============
describe('Reports API', () => {
  it('GET /api/reports/summary returns KPIs', async () => {
    const res = await request('GET', '/api/reports/summary');
    assert.equal(res.status, 200);
    assert.ok(res.body.total_models !== undefined);
    assert.ok(res.body.total_fabrics !== undefined);
    assert.ok(res.body.avg_cost_per_piece !== undefined);
  });

  it('GET /api/reports/by-fabric returns array', async () => {
    const res = await request('GET', '/api/reports/by-fabric');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/reports/by-accessory returns array', async () => {
    const res = await request('GET', '/api/reports/by-accessory');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/reports/by-model returns array', async () => {
    const res = await request('GET', '/api/reports/by-model');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/reports/costs returns snapshots and totals', async () => {
    const res = await request('GET', '/api/reports/costs');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.snapshots));
    assert.ok(res.body.totals !== undefined);
  });
});

// ============ Dashboard API ============
describe('Dashboard API', () => {
  it('GET /api/dashboard returns v10 fields', async () => {
    const res = await request('GET', '/api/dashboard');
    assert.equal(res.status, 200);
    assert.ok(res.body.total_models !== undefined, 'should have total_models');
    assert.ok(res.body.total_fabrics !== undefined, 'should have total_fabrics');
    assert.ok(res.body.active_work_orders !== undefined, 'should have active_work_orders');
    assert.ok(res.body.total_machines !== undefined, 'should have total_machines');
    assert.ok(res.body.total_customers !== undefined, 'should have total_customers');
    assert.ok(res.body.quality_rate !== undefined, 'should have quality_rate');
    assert.ok(Array.isArray(res.body.recent_work_orders), 'should have recent_work_orders array');
    assert.ok(Array.isArray(res.body.production_pipeline), 'should have production_pipeline array');
  });
});

// ============ Search API ============
describe('Search API', () => {
  it('GET /api/search?q= returns empty results for short query', async () => {
    const res = await request('GET', '/api/search?q=a');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.models));
    assert.ok(Array.isArray(res.body.fabrics));
  });

  it('GET /api/search?q=test returns results across entities', async () => {
    const res = await request('GET', '/api/search?q=test');
    assert.equal(res.status, 200);
    assert.ok(res.body.models !== undefined);
    assert.ok(res.body.fabrics !== undefined);
    assert.ok(res.body.accessories !== undefined);
    assert.ok(res.body.suppliers !== undefined);
    assert.ok(res.body.customers !== undefined);
  });
});

// ============ Suppliers API ============
describe('Suppliers API', () => {
  it('GET /api/suppliers returns array', async () => {
    const res = await request('GET', '/api/suppliers');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('POST /api/suppliers creates supplier', async () => {
    const res = await request('POST', '/api/suppliers', {
      code: `SUP-T${UID}`, name: 'مورد اختبار', supplier_type: 'fabric',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.code, `SUP-T${UID}`);
  });

  it('DELETE /api/suppliers/:id deactivates', async () => {
    const listRes = await request('GET', `/api/suppliers?code=SUP-T${UID}`);
    const supplier = Array.isArray(listRes.body)
      ? listRes.body.find(s => s.code === `SUP-T${UID}`)
      : null;
    if (supplier) {
      const res = await request('DELETE', `/api/suppliers/${supplier.id}`);
      assert.ok([200, 204].includes(res.status));
    }
  });
});

// ============ Customers API ============
describe('Customers API', () => {
  it('GET /api/customers returns array', async () => {
    const res = await request('GET', '/api/customers');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('POST /api/customers creates customer', async () => {
    const res = await request('POST', '/api/customers', {
      code: `CUS-T${UID}`, name: 'عميل اختبار',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.code, `CUS-T${UID}`);
  });

  it('DELETE /api/customers/:id deactivates', async () => {
    const listRes = await request('GET', '/api/customers');
    const customer = Array.isArray(listRes.body)
      ? listRes.body.find(c => c.code === `CUS-T${UID}`)
      : null;
    if (customer) {
      const res = await request('DELETE', `/api/customers/${customer.id}`);
      assert.ok([200, 204].includes(res.status));
    }
  });
});

// ============ Machines API ============
describe('Machines API', () => {
  it('GET /api/machines returns array', async () => {
    const res = await request('GET', '/api/machines');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('POST /api/machines creates machine', async () => {
    const res = await request('POST', '/api/machines', {
      code: `MCH-T${UID}`, name: 'ماكينة اختبار', machine_type: 'sewing',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.code, `MCH-T${UID}`);
  });

  it('DELETE /api/machines/:id deactivates', async () => {
    const listRes = await request('GET', '/api/machines');
    const machine = Array.isArray(listRes.body)
      ? listRes.body.find(m => m.code === `MCH-T${UID}`)
      : null;
    if (machine) {
      const res = await request('DELETE', `/api/machines/${machine.id}`);
      assert.ok([200, 204].includes(res.status));
    }
  });
});

// ============ Work Orders API ============
describe('Work Orders API', () => {
  it('GET /api/work-orders returns array', async () => {
    const res = await request('GET', '/api/work-orders');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});

// ============ Notifications API ============
describe('Notifications API', () => {
  it('GET /api/notifications returns array', async () => {
    const res = await request('GET', '/api/notifications');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/notifications/count returns unread count', async () => {
    const res = await request('GET', '/api/notifications/count');
    assert.equal(res.status, 200);
    assert.ok(res.body.count !== undefined, 'should have count field');
  });
});
