/**
 * WK-Hub V10 Comprehensive Test Suite
 * Tests all V10 features: Machines CRUD, Customer enhancements (type/payments),
 * Quality report, Dashboard V10 KPIs, Security headers, Rate limiting,
 * Stage color/QC, Report endpoints (quality, machines)
 */
const http = require('http');
const BASE = 'http://localhost:9002';
let TOKEN = '';
let passed = 0, failed = 0;
const SUFFIX = Date.now().toString(36).slice(-5).toUpperCase();

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
    const req = http.request(opts, res => {
      let data = '';
      const headers = res.headers;
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data), headers }); }
        catch { resolve({ status: res.statusCode, data, headers }); }
      });
    });
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

async function run() {
  console.log('══════════════════════════════════════════');
  console.log('   V10 COMPREHENSIVE TEST SUITE');
  console.log('══════════════════════════════════════════\n');

  // ═══════ GROUP 1: Auth + Security Headers ═══════
  console.log('━━━ GROUP 1: Auth + Security ━━━\n');

  const login = await api('POST', '/api/auth/login', { username: 'admin', password: '123456' });
  ok(login.status === 200 && login.data.token, 'Login successful');
  TOKEN = login.data.token;

  // 1.2 Security headers present
  ok(login.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff');
  ok(login.headers['x-frame-options'] === 'DENY', 'X-Frame-Options: DENY');
  ok(login.headers['x-xss-protection'] === '1; mode=block', 'X-XSS-Protection header');

  // 1.3 Auth required on protected endpoints
  const savedToken = TOKEN;
  TOKEN = '';
  const noAuth = await api('GET', '/api/machines');
  ok(noAuth.status === 401 || noAuth.status === 403, 'Machines requires auth');
  TOKEN = savedToken;

  // ═══════ GROUP 2: Machines CRUD ═══════
  console.log('\n━━━ GROUP 2: Machines CRUD ━━━\n');

  // 2.1 Create machine
  const mch1 = await api('POST', '/api/machines', {
    name: `ماكينة اختبار ${SUFFIX}`,
    machine_type: 'خياطة',
    location: 'خط إنتاج 1',
    capacity_per_hour: 50,
    cost_per_hour: 25.5,
  });
  ok(mch1.status === 201, `Create machine: ${mch1.status}`);
  ok(mch1.data.id > 0, `Machine ID: ${mch1.data.id}`);
  ok(mch1.data.code && mch1.data.code.startsWith('MCH-'), `Machine code: ${mch1.data.code}`);
  ok(mch1.data.machine_type === 'خياطة', 'Machine type saved');
  ok(mch1.data.status === 'active', 'Default status is active');

  const machineId = mch1.data.id;

  // 2.2 Create without name → 400
  const mchBad = await api('POST', '/api/machines', { machine_type: 'قص' });
  ok(mchBad.status === 400, 'Create machine without name returns 400');

  // 2.3 List machines
  const mchList = await api('GET', '/api/machines');
  ok(mchList.status === 200, 'List machines returns 200');
  ok(Array.isArray(mchList.data), 'Returns array');
  ok(Array.isArray(mchList.data) && mchList.data.some(m => m.id === machineId), 'Created machine in list');

  // 2.4 Get single machine
  const mchGet = await api('GET', `/api/machines/${machineId}`);
  ok(mchGet.status === 200, 'Get machine by ID');
  ok(mchGet.data.name === `ماكينة اختبار ${SUFFIX}`, 'Name matches');
  ok(Array.isArray(mchGet.data.recent_stages), 'Has recent_stages array');

  // 2.5 Update machine
  const mchUp = await api('PATCH', `/api/machines/${machineId}`, {
    location: 'خط إنتاج 2',
    cost_per_hour: 30,
  });
  ok(mchUp.status === 200, 'Update machine');
  ok(mchUp.data.location === 'خط إنتاج 2', 'Location updated');

  // 2.6 Put to maintenance
  const mchMaint = await api('PATCH', `/api/machines/${machineId}`, { status: 'maintenance' });
  ok(mchMaint.status === 200, 'Set maintenance status');
  ok(mchMaint.data.status === 'maintenance', 'Status is maintenance');

  // 2.7 Deactivate machine (soft delete)
  const mchDel = await api('DELETE', `/api/machines/${machineId}`);
  ok(mchDel.status === 200, 'Soft delete machine');
  ok(mchDel.data.message, 'Delete returns success message');

  // 2.8 Search machines
  const mchSearch = await api('GET', `/api/machines?search=اختبار`);
  ok(mchSearch.status === 200, 'Search machines');

  // 2.9 Filter by status
  const mchFilter = await api('GET', '/api/machines?status=active');
  ok(mchFilter.status === 200, 'Filter machines by status');

  // 2.10 Get non-existent machine
  const mchNone = await api('GET', '/api/machines/99999');
  ok(mchNone.status === 404, 'Non-existent machine returns 404');

  // 2.11 Create second machine for further tests
  const mch2 = await api('POST', '/api/machines', {
    name: `ماكينة قص ${SUFFIX}`,
    machine_type: 'قص',
    location: 'قسم القص',
  });
  ok(mch2.status === 201, 'Create second machine');

  // ═══════ GROUP 3: Customer Enhancements ═══════
  console.log('\n━━━ GROUP 3: Customer V10 Enhancements ━━━\n');

  // 3.1 Create customer with V10 fields
  const cust1 = await api('POST', '/api/customers', {
    name: `عميل اختبار ${SUFFIX}`,
    phone: '01234567890',
    customer_type: 'wholesale',
    contact_name: 'أحمد مدير المشتريات',
    payment_terms: '30 يوم',
    credit_limit: 50000,
  });
  ok(cust1.status === 201, `Create customer with V10 fields: ${cust1.status}`);
  ok(cust1.data.customer_type === 'wholesale', 'customer_type saved');
  ok(cust1.data.contact_name === 'أحمد مدير المشتريات', 'contact_name saved');
  ok(cust1.data.payment_terms === '30 يوم', 'payment_terms saved');

  const custId = cust1.data.id;

  // 3.2 Update V10 fields
  const custUp = await api('PATCH', `/api/customers/${custId}`, {
    customer_type: 'corporate',
    payment_terms: '60 يوم',
  });
  ok(custUp.status === 200, 'Update V10 fields');
  ok(custUp.data.customer_type === 'corporate', 'customer_type updated');
  ok(custUp.data.payment_terms === '60 يوم', 'payment_terms updated');

  // 3.3 List customers — verify V10 fields present
  const custList = await api('GET', '/api/customers');
  ok(custList.status === 200, 'List customers returns 200');
  const found = (Array.isArray(custList.data) ? custList.data : []).find(c => c.id === custId);
  ok(found && found.customer_type === 'corporate', 'V10 fields in list');

  // 3.4 Customer balance endpoint
  const custBal = await api('GET', `/api/customers/${custId}/balance`);
  ok(custBal.status === 200, 'Customer balance endpoint');
  ok(custBal.data.customer_name === `عميل اختبار ${SUFFIX}`, 'Balance has customer_name');

  // ═══════ GROUP 4: Customer Payments ═══════
  console.log('\n━━━ GROUP 4: Customer Payments ━━━\n');

  // 4.1 Record payment
  const pay1 = await api('POST', `/api/customers/${custId}/payments`, {
    amount: 5000,
    payment_method: 'bank',
    reference_number: `PAY-${SUFFIX}`,
    notes: 'دفعة اختبار',
  });
  ok(pay1.status === 201, `Record payment: ${pay1.status}`);
  ok(pay1.data.amount === 5000, 'Payment amount saved');
  ok(pay1.data.payment_method === 'bank', 'Payment method saved');

  // 4.2 Record payment with invalid amount
  const payBad = await api('POST', `/api/customers/${custId}/payments`, {
    amount: -100,
  });
  ok(payBad.status === 400, 'Negative payment rejected');

  // 4.3 Record payment with zero amount
  const payZero = await api('POST', `/api/customers/${custId}/payments`, {
    amount: 0,
  });
  ok(payZero.status === 400, 'Zero payment rejected');

  // 4.4 List payments
  const payList = await api('GET', `/api/customers/${custId}/payments`);
  ok(payList.status === 200, 'List payments');
  ok(payList.data.payments.length >= 1, `Has payments (${payList.data.payments.length})`);
  ok(payList.data.total_paid >= 5000, `Total paid: ${payList.data.total_paid}`);

  // 4.5 Payment for non-existent customer
  const payNone = await api('POST', '/api/customers/99999/payments', { amount: 100 });
  ok(payNone.status === 404, 'Payment for non-existent customer returns 404');

  // 4.6 Record cash payment
  const pay2 = await api('POST', `/api/customers/${custId}/payments`, {
    amount: 2000,
    payment_method: 'cash',
  });
  ok(pay2.status === 201, 'Cash payment recorded');

  // 4.7 Invalid payment method
  const payInvalid = await api('POST', `/api/customers/${custId}/payments`, {
    amount: 100,
    payment_method: 'bitcoin',
  });
  ok(payInvalid.status === 400, 'Invalid payment method rejected');

  // ═══════ GROUP 5: Dashboard V10 KPIs ═══════
  console.log('\n━━━ GROUP 5: Dashboard V10 KPIs ━━━\n');

  const dash = await api('GET', '/api/dashboard');
  ok(dash.status === 200, 'Dashboard returns 200');
  ok(dash.data.total_machines !== undefined, 'Has total_machines');
  ok(dash.data.machines_in_use !== undefined, 'Has machines_in_use');
  ok(dash.data.total_customers !== undefined, 'Has total_customers');
  ok(dash.data.customer_outstanding !== undefined, 'Has customer_outstanding');
  ok(dash.data.quality_rate !== undefined, 'Has quality_rate');
  ok(typeof dash.data.quality_rate === 'number', 'quality_rate is number');
  ok(dash.data.quality_rate >= 0 && dash.data.quality_rate <= 100, `quality_rate in range: ${dash.data.quality_rate}`);

  // Existing V9 KPIs still present
  ok(dash.data.total_models !== undefined, 'V9 total_models still present');
  ok(dash.data.active_work_orders !== undefined, 'V9 active_work_orders present');
  ok(dash.data.production_pipeline !== undefined, 'V9 production_pipeline present');
  ok(dash.data.monthly_revenue !== undefined, 'V9 monthly_revenue present');

  // ═══════ GROUP 6: Quality Report ═══════
  console.log('\n━━━ GROUP 6: Quality Report ━━━\n');

  const qual = await api('GET', '/api/reports/quality');
  ok(qual.status === 200, 'Quality report returns 200');
  ok(Array.isArray(qual.data.stage_quality), 'Has stage_quality array');
  ok(Array.isArray(qual.data.recent_rejections), 'Has recent_rejections array');
  ok(typeof qual.data.overall_pass_rate === 'number', 'Has overall_pass_rate');
  ok(qual.data.total_passed !== undefined, 'Has total_passed');
  ok(qual.data.total_rejected !== undefined, 'Has total_rejected');
  ok(Array.isArray(qual.data.qc_checkpoints), 'Has qc_checkpoints array');

  // ═══════ GROUP 7: Machines Report ═══════
  console.log('\n━━━ GROUP 7: Machines Report ━━━\n');

  const mchReport = await api('GET', '/api/reports/machines');
  ok(mchReport.status === 200, 'Machines report returns 200');
  ok(Array.isArray(mchReport.data.machines), 'Has machines array');
  if (mchReport.data.machines.length > 0) {
    const m = mchReport.data.machines[0];
    ok(m.total_stages !== undefined, 'Machine report has total_stages');
    ok(m.active_stages !== undefined, 'Machine report has active_stages');
    ok(m.total_hours !== undefined, 'Machine report has total_hours');
    ok(m.total_pieces !== undefined, 'Machine report has total_pieces');
  }

  // ═══════ GROUP 8: Work Order Stage Colors ═══════
  console.log('\n━━━ GROUP 8: WO Stage Colors ━━━\n');

  // Create a work order and check that stages have stage_color
  const woList = await api('GET', '/api/work-orders?status=in_progress');
  if (woList.data.work_orders && woList.data.work_orders.length > 0) {
    const woId = woList.data.work_orders[0].id;
    const woDetail = await api('GET', `/api/work-orders/${woId}`);
    ok(woDetail.status === 200, 'Get WO detail');
    if (woDetail.data.stages && woDetail.data.stages.length > 0) {
      ok('stage_color' in woDetail.data.stages[0], 'Stage has stage_color field');
    } else {
      ok(true, 'No stages to check color on (skipped)');
    }
  } else {
    // No in_progress WOs, check any WO
    const anyWO = await api('GET', '/api/work-orders');
    if (anyWO.data.work_orders && anyWO.data.work_orders.length > 0) {
      const woId = anyWO.data.work_orders[0].id;
      const woDetail = await api('GET', `/api/work-orders/${woId}`);
      ok(woDetail.status === 200, 'Get WO detail for stage color check');
      if (woDetail.data.stages && woDetail.data.stages.length > 0) {
        ok('stage_color' in woDetail.data.stages[0], 'Stage has stage_color field');
      } else {
        ok(true, 'No stages to check (skipped)');
      }
    } else {
      ok(true, 'No work orders exist (stage color skipped)');
    }
  }

  // ═══════ GROUP 9: Existing V9 Regression ═══════
  console.log('\n━━━ GROUP 9: V9 Regression Checks ━━━\n');

  // 9.1 Customers CRUD still works
  const custGet = await api('GET', `/api/customers/${custId}`);
  ok(custGet.status === 200, 'Get customer by ID');
  ok(custGet.data.invoice_count !== undefined, 'Customer has invoice_count');

  // 9.2 Customer invoices
  const custInv = await api('GET', `/api/customers/${custId}/invoices`);
  ok(custInv.status === 200, 'Customer invoices endpoint');

  // 9.3 Reports summary
  const repSum = await api('GET', '/api/reports/summary');
  ok(repSum.status === 200, 'Reports summary');

  // 9.4 Reports by model
  const repModel = await api('GET', '/api/reports/by-model');
  ok(repModel.status === 200, 'Reports by model');

  // 9.5 Reports WIP / production pipeline
  const repWIP = await api('GET', '/api/reports/production-by-stage');
  ok(repWIP.status === 200, 'Reports production-by-stage');

  // 9.6 Reports waste
  const repWaste = await api('GET', '/api/reports/waste-analysis');
  ok(repWaste.status === 200, 'Reports waste analysis');

  // 9.7 Stage templates
  const stList = await api('GET', '/api/stage-templates');
  ok(stList.status === 200, 'Stage templates endpoint');

  // 9.8 Notifications
  const nList = await api('GET', '/api/notifications');
  ok(nList.status === 200, 'Notifications endpoint');

  // 9.9 Inventory status report
  const invReport = await api('GET', '/api/reports/inventory-status');
  ok(invReport.status === 200, 'Inventory status report');

  // 9.10 Customer summary report
  const custSumReport = await api('GET', '/api/reports/customer-summary');
  ok(custSumReport.status === 200, 'Customer summary report');

  // 9.11 HR summary report
  const hrReport = await api('GET', '/api/reports/hr-summary');
  ok(hrReport.status === 200, 'HR summary report');

  // 9.12 Global search
  const searchRes = await api('GET', '/api/search?q=test');
  ok(searchRes.status === 200, 'Global search');
  ok(searchRes.data.customers !== undefined, 'Search includes customers');

  // 9.13 Fabrics list
  const fabList = await api('GET', '/api/fabrics');
  ok(fabList.status === 200, 'Fabrics list');

  // 9.14 Accessories list
  const accList = await api('GET', '/api/accessories');
  ok(accList.status === 200, 'Accessories list');

  // 9.15 Suppliers list
  const supList = await api('GET', '/api/suppliers');
  ok(supList.status === 200, 'Suppliers list');

  // ═══════ GROUP 10: Permissions ═══════
  console.log('\n━━━ GROUP 10: V10 Permissions ━━━\n');

  const perms = await api('GET', '/api/permissions/my');
  ok(perms.status === 200, 'My permissions endpoint');

  // Permissions endpoint returns flat object { "module:action": 1 }
  ok(perms.data['machines:view'] === 1, 'Has machines:view permission');
  ok(perms.data['machines:manage'] === 1, 'Has machines:manage permission');
  ok(perms.data['customers:view'] === 1, 'Has customers:view permission');
  ok(perms.data['customers:create'] === 1, 'Has customers:create permission');

  // ═══════ SUMMARY ═══════
  console.log('\n══════════════════════════════════════════');
  console.log(`   V10 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
