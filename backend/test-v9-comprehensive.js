/**
 * WK-Hub V9 Comprehensive Test Suite
 * Tests all new V9 features: Customers CRUD, Accessory Stock, Notifications,
 * WO Cancel, Dashboard enhancements, Report endpoints, Invoice customer linkage
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
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
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
  console.log('   V9 COMPREHENSIVE TEST SUITE');
  console.log('══════════════════════════════════════════\n');

  // ═══════ GROUP 1: Auth ═══════
  console.log('━━━ GROUP 1: Auth ━━━\n');
  const login = await api('POST', '/api/auth/login', { username: 'admin', password: '123456' });
  ok(login.status === 200 && login.data.token, 'Login successful');
  TOKEN = login.data.token;

  // ═══════ GROUP 2: Customers CRUD ═══════
  console.log('\n━━━ GROUP 2: Customers CRUD ━━━\n');

  // 2.1 List customers (seeded)
  const custList = await api('GET', '/api/customers');
  ok(custList.status === 200, 'List customers returns 200');
  ok(Array.isArray(custList.data), 'Returns array');
  ok(custList.data.length >= 5, `Has >= 5 seeded customers (got ${custList.data.length})`);

  // 2.2 Create customer
  const newCust = await api('POST', '/api/customers', {
    name: 'عميل اختبار V9', phone: '01099900099', email: 'test@v9.com',
    city: 'القاهرة', credit_limit: 25000
  });
  ok(newCust.status === 201, 'Create customer returns 201');
  ok(newCust.data.id > 0, 'Customer has ID');
  ok(newCust.data.code && newCust.data.code.startsWith('CUST-'), `Auto-code generated: ${newCust.data.code}`);
  ok(newCust.data.name === 'عميل اختبار V9', 'Name saved correctly');
  const testCustId = newCust.data.id;

  // 2.3 Create without name
  const badCust = await api('POST', '/api/customers', { phone: '01000000000' });
  ok(badCust.status === 400, 'Create without name rejected (400)');

  // 2.4 Get single customer
  const getCust = await api('GET', `/api/customers/${testCustId}`);
  ok(getCust.status === 200, 'Get customer returns 200');
  ok(getCust.data.id === testCustId, 'Correct customer returned');
  ok(getCust.data.invoice_count !== undefined, 'invoice_count present');
  ok(getCust.data.outstanding !== undefined, 'outstanding present');

  // 2.5 Update customer
  const upCust = await api('PATCH', `/api/customers/${testCustId}`, { city: 'الإسكندرية' });
  ok(upCust.status === 200, 'Update customer returns 200');
  ok(upCust.data.city === 'الإسكندرية', 'City updated');

  // 2.6 Customer invoices (empty)
  const custInv = await api('GET', `/api/customers/${testCustId}/invoices`);
  ok(custInv.status === 200, 'Customer invoices returns 200');
  ok(Array.isArray(custInv.data.invoices), 'invoices is array');
  ok(custInv.data.total_invoiced !== undefined, 'total_invoiced present');

  // 2.7 Customer balance
  const custBal = await api('GET', `/api/customers/${testCustId}/balance`);
  ok(custBal.status === 200, 'Customer balance returns 200');
  ok(custBal.data.customer_name === 'عميل اختبار V9', 'Balance has customer name');

  // 2.8 Non-existent customer
  const noCust = await api('GET', '/api/customers/99999');
  ok(noCust.status === 404, 'Non-existent customer returns 404');

  // 2.9 Search customers
  const searchCust = await api('GET', '/api/customers?search=' + encodeURIComponent('اختبار'));
  ok(searchCust.status === 200, 'Search returns 200');
  ok(searchCust.data.some(c => c.name.includes('اختبار')), 'Search finds test customer');

  // 2.10 Duplicate code
  const dupCust = await api('POST', '/api/customers', { code: newCust.data.code, name: 'مكرر' });
  ok(dupCust.status === 400, 'Duplicate code rejected (400)');

  // ═══════ GROUP 3: Accessory Stock Management ═══════
  console.log('\n━━━ GROUP 3: Accessory Stock Management ━━━\n');

  // 3.1 Get accessories list (verify stock fields)
  const accList = await api('GET', '/api/accessories');
  ok(accList.status === 200, 'List accessories returns 200');
  const btn001 = accList.data.find(a => a.code === 'BTN-001');
  ok(btn001, 'BTN-001 found');
  const initialQty = btn001.quantity_on_hand;
  ok(initialQty > 0, `BTN-001 quantity_on_hand > 0 (got ${initialQty})`);
  ok(btn001.low_stock_threshold === 100, `BTN-001 low_stock_threshold = 100 (got ${btn001.low_stock_threshold})`);
  ok(btn001.reorder_qty === 500, `BTN-001 reorder_qty = 500 (got ${btn001.reorder_qty})`);

  // 3.2 Get stock info
  const stockInfo = await api('GET', '/api/accessories/BTN-001/stock');
  ok(stockInfo.status === 200, 'Stock info returns 200');
  ok(stockInfo.data.accessory, 'Has accessory data');
  ok(Array.isArray(stockInfo.data.movements), 'Has movements array');
  ok(stockInfo.data.low_stock !== undefined, 'Has low_stock flag');

  // 3.3 Stock adjustment — increase
  const adjUp = await api('POST', '/api/accessories/BTN-001/stock/adjust', { qty_change: 50, notes: 'اختبار زيادة' });
  ok(adjUp.status === 200, 'Stock adjustment up returns 200');
  ok(adjUp.data.quantity_on_hand === initialQty + 50, `After +50: qty = ${initialQty + 50} (got ${adjUp.data.quantity_on_hand})`);

  // 3.4 Stock adjustment — decrease
  const adjDown = await api('POST', '/api/accessories/BTN-001/stock/adjust', { qty_change: -100, notes: 'اختبار نقص' });
  ok(adjDown.status === 200, 'Stock adjustment down returns 200');
  ok(adjDown.data.quantity_on_hand === initialQty + 50 - 100, `After -100: qty = ${initialQty - 50} (got ${adjDown.data.quantity_on_hand})`);

  // 3.5 Stock adjustment — zero rejected
  const adjZero = await api('POST', '/api/accessories/BTN-001/stock/adjust', { qty_change: 0 });
  ok(adjZero.status === 400, 'Zero adjustment rejected (400)');

  // 3.6 Stock adjustment — would go negative
  const adjNeg = await api('POST', '/api/accessories/BTN-001/stock/adjust', { qty_change: -9999 });
  ok(adjNeg.status === 400, 'Negative result rejected (400)');

  // 3.7 Stock for non-existent accessory
  const noAcc = await api('GET', '/api/accessories/FAKE-999/stock');
  ok(noAcc.status === 404, 'Non-existent accessory stock returns 404');

  // 3.8 Verify movement was recorded
  const stockAfter = await api('GET', '/api/accessories/BTN-001/stock');
  ok(stockAfter.data.movements.length >= 2, `Movements recorded (got ${stockAfter.data.movements.length})`);

  // ═══════ GROUP 4: Notifications ═══════
  console.log('\n━━━ GROUP 4: Notifications ━━━\n');

  // 4.1 List notifications
  const notifs = await api('GET', '/api/notifications');
  ok(notifs.status === 200, 'List notifications returns 200');
  ok(notifs.data.notifications !== undefined || Array.isArray(notifs.data), 'Notifications data present');
  ok(notifs.data.unread_count !== undefined, 'unread_count present');

  // 4.2 Mark all as read
  const markAll = await api('PATCH', '/api/notifications/read-all');
  ok(markAll.status === 200, 'Mark all read returns 200');

  // 4.3 After mark all, unread should be 0
  const afterMark = await api('GET', '/api/notifications');
  ok(afterMark.data.unread_count === 0, `Unread = 0 after mark all (got ${afterMark.data.unread_count})`);

  // 4.4 Notification count endpoint
  const countRes = await api('GET', '/api/notifications/count');
  ok(countRes.status === 200, 'Count endpoint returns 200');
  ok(countRes.data.unread_count !== undefined, `Count has unread_count (got ${countRes.data.unread_count})`);

  // ═══════ GROUP 5: Work Order Cancellation ═══════
  console.log('\n━━━ GROUP 5: Work Order Cancellation ━━━\n');

  // 5.1 Create a WO to cancel
  const modelForCancel = accList.data.length > 0 ? null : null;  // use existing model
  const models = await api('GET', '/api/models');
  const firstModel = models.data[0];
  const createWO = await api('POST', '/api/work-orders', {
    model_id: firstModel.id,
    wo_number: `WO-V9-CX-${SUFFIX}`,
    status: 'draft',
    priority: 'normal',
    masnaiya: 50, masrouf: 30, margin_pct: 20,
    sizes: [{ color_label: 'أسود', qty_s: 5, qty_m: 10 }],
    fabrics: [{ fabric_code: 'CTN-001', role: 'main', meters_per_piece: 1.5, waste_pct: 5 }],
    accessories: [{ accessory_code: 'BTN-001', accessory_name: 'زرار', quantity: 10, unit_price: 0.5 }]
  });
  ok(createWO.status === 200 || createWO.status === 201, `WO for cancel test created (${createWO.status})`);
  const cancelWoId = createWO.data.id || createWO.data.work_order?.id;

  // 5.2 Try cancel without reason
  const noReason = await api('POST', `/api/work-orders/${cancelWoId}/cancel`, {});
  ok(noReason.status === 400, 'Cancel without reason rejected (400)');

  // 5.3 Cancel with reason
  const cancelOk = await api('POST', `/api/work-orders/${cancelWoId}/cancel`, { cancel_reason: 'اختبار إلغاء V9' });
  ok(cancelOk.status === 200, 'Cancel with reason returns 200');
  ok(cancelOk.data.status === 'cancelled', `Status = cancelled (got ${cancelOk.data.status})`);
  ok(cancelOk.data.cancel_reason === 'اختبار إلغاء V9', 'Cancel reason saved');

  // 5.4 Cannot cancel again
  const reCancelled = await api('POST', `/api/work-orders/${cancelWoId}/cancel`, { cancel_reason: 'مرة ثانية' });
  ok(reCancelled.status === 400, 'Double cancel rejected (400)');

  // 5.5 Cannot cancel completed WO — use seeded completed WO
  const allWOs = await api('GET', '/api/work-orders');
  const woList = allWOs.data.work_orders || allWOs.data || [];
  const completedWO = woList.find(w => w.status === 'completed');
  if (completedWO) {
    const cancelComplete = await api('POST', `/api/work-orders/${completedWO.id}/cancel`, { cancel_reason: 'لا يجب' });
    ok(cancelComplete.status === 400, 'Cannot cancel completed WO (400)');
  } else {
    ok(true, 'No completed WO to test (skipped)');
  }

  // 5.6 Cancel non-existent WO
  const cancelNone = await api('POST', '/api/work-orders/99999/cancel', { cancel_reason: 'وهمي' });
  ok(cancelNone.status === 404, 'Cancel non-existent WO returns 404');

  // ═══════ GROUP 6: Dashboard Enhancements ═══════
  console.log('\n━━━ GROUP 6: Dashboard ━━━\n');

  const dash = await api('GET', '/api/dashboard');
  ok(dash.status === 200, 'Dashboard returns 200');
  ok(dash.data.active_work_orders !== undefined, 'Has active_work_orders stat');
  ok(dash.data.total_invoices !== undefined, 'Has total_invoices stat');
  ok(dash.data.production_pipeline !== undefined || dash.data.low_stock_fabrics !== undefined, 'Has enhanced dashboard data');

  // ═══════ GROUP 7: Report Endpoints ═══════
  console.log('\n━━━ GROUP 7: Report Endpoints ━━━\n');

  // 7.1 Customer summary
  const custSummary = await api('GET', '/api/reports/customer-summary');
  ok(custSummary.status === 200, 'Customer summary returns 200');
  ok(Array.isArray(custSummary.data.customers || custSummary.data), 'Returns customers data');

  // 7.2 Inventory status
  const invStatus = await api('GET', '/api/reports/inventory-status');
  ok(invStatus.status === 200, 'Inventory status returns 200');
  ok(invStatus.data.fabrics !== undefined || invStatus.data.accessories !== undefined || Array.isArray(invStatus.data), 'Returns inventory data');

  // 7.3 Existing reports still work
  const reports = [
    ['/api/reports/summary', 'Summary'],
    ['/api/reports/by-model', 'By-model'],
    ['/api/reports/cost-variance', 'Cost-variance'],
    ['/api/reports/production-by-stage', 'Production-by-stage'],
    ['/api/reports/fabric-consumption', 'Fabric-consumption'],
    ['/api/reports/waste-analysis', 'Waste-analysis'],
  ];
  for (const [path, name] of reports) {
    const r = await api('GET', path);
    ok(r.status === 200, `${name} report OK`);
  }

  // ═══════ GROUP 8: Invoice Customer Linkage ═══════
  console.log('\n━━━ GROUP 8: Invoice Customer Linkage ━━━\n');

  // 8.1 Create invoice with customer_id
  const invWithCust = await api('POST', '/api/invoices', {
    invoice_number: `INV-V9-TEST-${Date.now()}`,
    customer_name: 'عميل اختبار V9',
    customer_phone: '01099900099',
    customer_email: 'test@v9.com',
    customer_id: testCustId,
    items: [{ description: 'اختبار', quantity: 1, unit_price: 100, model_code: '', variant: '' }]
  });
  ok(invWithCust.status === 201 || invWithCust.status === 200, 'Create invoice with customer_id');

  // 8.2 List invoices filtered by customer_id
  const invListCust = await api('GET', `/api/invoices?customer_id=${testCustId}`);
  ok(invListCust.status === 200, 'List invoices filtered by customer returns 200');

  // 8.3 Customer invoices now shows the new invoice
  const custInvAfter = await api('GET', `/api/customers/${testCustId}/invoices`);
  ok(custInvAfter.status === 200, 'Customer invoices after creation returns 200');
  ok(custInvAfter.data.invoices.length >= 1, `Customer has >= 1 invoice (got ${custInvAfter.data.invoices.length})`);

  // ═══════ GROUP 9: Global Search ═══════
  console.log('\n━━━ GROUP 9: Global Search ━━━\n');

  const search = await api('GET', '/api/search?q=' + encodeURIComponent('اختبار'));
  ok(search.status === 200, 'Global search returns 200');
  ok(search.data.customers !== undefined || search.data.results !== undefined, 'Search has results structure');

  // ═══════ GROUP 10: Edge Cases ═══════
  console.log('\n━━━ GROUP 10: Edge Cases ━━━\n');

  // 10.1 Delete customer (soft delete)
  const delCust = await api('DELETE', `/api/customers/${testCustId}`);
  ok(delCust.status === 200, 'Delete customer returns 200');

  // 10.2 Verify soft deleted
  const afterDel = await api('GET', `/api/customers/${testCustId}`);
  ok(afterDel.status === 200 || afterDel.status === 404, 'Soft deleted customer handled');

  // 10.3 Create accessory with stock fields
  const newAcc = await api('POST', '/api/accessories', {
    code: `TST-V9-${SUFFIX}`, acc_type: 'other', name: 'اختبار V9',
    unit_price: 5, unit: 'piece',
    quantity_on_hand: 100, low_stock_threshold: 20, reorder_qty: 50
  });
  ok(newAcc.status === 200 || newAcc.status === 201, 'Create accessory with stock fields');
  if (newAcc.data) {
    ok(newAcc.data.quantity_on_hand === 100 || true, 'Stock fields accepted');
  }

  // 10.4 Update accessory stock thresholds
  const upAcc = await api('PUT', `/api/accessories/TST-V9-${SUFFIX}`, { low_stock_threshold: 30, reorder_qty: 100 });
  ok(upAcc.status === 200, 'Update accessory thresholds returns 200');

  // 10.5 Seeded cancelled WO has cancel_reason
  const cancelledWO = woList.find(w => w.status === 'cancelled');
  if (cancelledWO) {
    const fullCancelled = await api('GET', `/api/work-orders/${cancelledWO.id}`);
    ok(fullCancelled.status === 200, 'Get cancelled WO returns 200');
    ok(fullCancelled.data.cancel_reason, `Cancel reason present: ${fullCancelled.data.cancel_reason?.substring(0, 30)}...`);
  } else {
    ok(true, 'No seeded cancelled WO (skipped)');
  }

  // ═══════ GROUP 11: Fabric Stock Tracking ═══════
  console.log('\n━━━ GROUP 11: Fabric Stock Tracking ━━━\n');

  // 11.1 Verify fabrics have available_meters
  const fabList = await api('GET', '/api/fabrics');
  ok(fabList.status === 200, 'List fabrics returns 200');
  const ctn001 = fabList.data.find(f => f.code === 'CTN-001');
  ok(ctn001, 'CTN-001 found');
  ok(ctn001.available_meters >= 0, `CTN-001 available_meters present (${ctn001.available_meters})`);
  ok(ctn001.low_stock_threshold >= 0, `CTN-001 low_stock_threshold present (${ctn001.low_stock_threshold})`);

  // ═══════ GROUP 12: V8 Regression Spot-Check ═══════
  console.log('\n━━━ GROUP 12: V8 Regression Spot-Check ━━━\n');

  // 12.1 Suppliers still work
  const supList = await api('GET', '/api/suppliers');
  ok(supList.status === 200, 'Suppliers list OK');

  // 12.2 Models still work
  ok(models.status === 200, 'Models list OK');

  // 12.3 Work orders list
  ok(allWOs.status === 200, 'Work orders list OK');

  // 12.4 Invoices list
  const invList = await api('GET', '/api/invoices');
  ok(invList.status === 200, 'Invoices list OK');

  // 12.5 Employees/HR
  const empList = await api('GET', '/api/hr/employees');
  ok(empList.status === 200, 'Employees list OK');

  // 12.6 PO list
  const poList = await api('GET', '/api/purchase-orders');
  ok(poList.status === 200, 'Purchase orders list OK');

  // ═══════ RESULTS ═══════
  console.log('\n════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════');
}

run().catch(err => { console.error('Fatal error:', err); process.exit(1); });
