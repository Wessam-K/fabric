const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const BASE = 'http://localhost:9002';
const UID = Date.now().toString(36).slice(-4);

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
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
    assert.ok(res.body.length >= 1, 'should have at least 1 fabric');
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
    assert.ok(res.body.length >= 1);
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
  let createdCode;

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
        { fabric_code: 'CTN-001', role: 'main', meters_per_piece: 1.5, waste_pct: 5, color_note: 'أبيض' },
      ],
      accessories: [
        { accessory_code: 'BTN-001', accessory_name: 'زرار', quantity: 4, unit_price: 0.5 },
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
    createdCode = res.body.model_code;
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
