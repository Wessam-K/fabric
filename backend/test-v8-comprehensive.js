// V8 Comprehensive Test Suite — Fabric Consumption, Waste, Invoicing, Reports, Finalization
const http = require('http');

const BASE = 'http://localhost:9002/api';
let TOKEN = '';
let passed = 0;
let failed = 0;

// Shared IDs
let testWoId = null;
let testWoNumber = '';
let testModelId = null;
let testFabricCode = '';
let testAccessoryCode = '';
let testSupplierId = null;
let testPoId = null;
let batchId = null;
let consumptionId = null;
let wasteId = null;
let invoiceId = null;
let testStages = [];

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function assert(test, msg) {
  if (test) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

function assertClose(actual, expected, msg, tolerance = 0.01) {
  const diff = Math.abs((actual || 0) - (expected || 0));
  if (diff <= tolerance) { passed++; console.log(`  ✓ ${msg} (${actual})`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg} — expected ~${expected}, got ${actual} (diff ${diff})`); }
}

async function run() {
  console.log('══════════════════════════════════════════');
  console.log('   V8 COMPREHENSIVE TEST SUITE');
  console.log('══════════════════════════════════════════\n');

  // ═══════════════════════════════════════
  // GROUP 1: Auth & Permissions
  // ═══════════════════════════════════════
  console.log('━━━ GROUP 1: Auth & Permissions ━━━');

  console.log('\n1.1 Login');
  const login = await req('POST', '/auth/login', { username: 'admin', password: '123456' });
  assert(login.status === 200 && login.data.token, 'Login successful');
  TOKEN = login.data.token;

  console.log('\n1.2 Bad credentials');
  const badLogin = await req('POST', '/auth/login', { username: 'admin', password: 'wrong' });
  assert(badLogin.status === 401 || badLogin.status === 400, `Bad login rejected (${badLogin.status})`);

  console.log('\n1.3 No token');
  const savedToken = TOKEN;
  TOKEN = '';
  const noAuth = await req('GET', '/work-orders');
  assert(noAuth.status === 401 || noAuth.status === 403, `No-token request rejected (${noAuth.status})`);
  TOKEN = savedToken;

  console.log('\n1.4 Invalid token');
  const savedToken2 = TOKEN;
  TOKEN = 'invalid-token-xyz';
  const badAuth = await req('GET', '/work-orders');
  assert(badAuth.status === 401 || badAuth.status === 403, `Invalid token rejected (${badAuth.status})`);
  TOKEN = savedToken2;

  // ═══════════════════════════════════════
  // GROUP 2: Setup — Models, Fabrics, Accessories, Suppliers
  // ═══════════════════════════════════════
  console.log('\n━━━ GROUP 2: Procurement Setup ━━━');

  console.log('\n2.1 Ensure model exists');
  const modelsRes = await req('GET', '/models');
  if (modelsRes.data?.length > 0) {
    testModelId = modelsRes.data[0].id;
    console.log(`  Using existing model id=${testModelId}`);
  } else {
    const newModel = await req('POST', '/models', { model_code: 'TST-V8', model_name: 'Test V8 Model', category: 'Shirts', gender: 'male' });
    assert(newModel.status === 201, 'Model created');
    testModelId = newModel.data.id;
  }

  console.log('\n2.2 Ensure fabric exists');
  const fabricsRes = await req('GET', '/fabrics');
  if (fabricsRes.data?.length > 0) {
    testFabricCode = fabricsRes.data[0].code;
    console.log(`  Using existing fabric code=${testFabricCode}`);
  } else {
    const ts = Date.now().toString(36).slice(-4).toUpperCase();
    testFabricCode = `FB-TST-${ts}`;
    const newFabric = await req('POST', '/fabrics', { code: testFabricCode, name: 'Test Fabric', fabric_type: 'main', color: 'white', price_per_m: 150, available_meters: 500 });
    assert(newFabric.status === 200 || newFabric.status === 201, 'Fabric created');
  }

  console.log('\n2.3 Ensure accessory exists');
  const accRes = await req('GET', '/accessories');
  if (accRes.data?.length > 0) {
    testAccessoryCode = accRes.data[0].code;
    console.log(`  Using existing accessory code=${testAccessoryCode}`);
  } else {
    const ts = Date.now().toString(36).slice(-4).toUpperCase();
    testAccessoryCode = `AC-TST-${ts}`;
    const newAcc = await req('POST', '/accessories', { code: testAccessoryCode, name: 'Test Button', acc_type: 'button', unit: 'piece', price: 2 });
    assert(newAcc.status === 200 || newAcc.status === 201, 'Accessory created');
  }

  console.log('\n2.4 Ensure supplier exists');
  const suppRes = await req('GET', '/suppliers');
  if (suppRes.data?.length > 0) {
    testSupplierId = suppRes.data[0].id;
    console.log(`  Using existing supplier id=${testSupplierId}`);
  } else {
    const newSup = await req('POST', '/suppliers', { name: 'Test Supplier V8', code: 'SUP-V8', supplier_type: 'fabric' });
    assert(newSup.status === 200 || newSup.status === 201, 'Supplier created');
    testSupplierId = newSup.data.id;
  }

  // ═══════════════════════════════════════
  // GROUP 3: PO Receive + Batch + Variance
  // ═══════════════════════════════════════
  console.log('\n━━━ GROUP 3: PO Receive + Batch + Variance ━━━');

  console.log('\n3.1 Create PO');
  const poNum = `PO-V8-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const createPO = await req('POST', '/purchase-orders', {
    po_number: poNum,
    supplier_id: testSupplierId,
    items: [
      { item_type: 'fabric', fabric_code: testFabricCode, description: 'Test Fabric V8', quantity: 100, unit_price: 150 },
    ],
  });
  assert(createPO.status === 200 || createPO.status === 201, `PO created: ${poNum}`);
  testPoId = createPO.data?.id;
  assert(!!testPoId, 'PO has ID');

  console.log('\n3.2 Receive PO with variance');
  const poItems = createPO.data?.items || [];
  const receiveRes = await req('PATCH', `/purchase-orders/${testPoId}/receive`, {
    received_date: new Date().toISOString().split('T')[0],
    items: poItems.map(item => ({
      item_id: item.id,
      received_qty: 95, // ordered 100, received 95 → variance -5
      variance_notes: 'Test variance note — 5m short',
    })),
  });
  assert(receiveRes.status === 200, 'PO received');
  const receivedItem = receiveRes.data?.items?.[0];
  assert(receivedItem?.received_qty_actual === 95, `received_qty_actual=95 (got ${receivedItem?.received_qty_actual})`);
  assert(receivedItem?.quantity_variance === -5, `quantity_variance=-5 (got ${receivedItem?.quantity_variance})`);
  assert(receivedItem?.variance_notes?.includes('5m short'), `variance_notes saved`);

  console.log('\n3.3 Verify batch created');
  const batchRes = await req('GET', `/fabrics`);
  // Check for batch in inventory
  const batchCheck = await req('GET', `/purchase-orders/${testPoId}`);
  // The PO should have batch data, let's check batch via DB indirectly through fabric-consumption endpoint later
  assert(batchCheck.status === 200, 'PO detail retrieved');

  // ═══════════════════════════════════════
  // GROUP 4: Full Production Flow with Consumption
  // ═══════════════════════════════════════
  console.log('\n━━━ GROUP 4: Full Production + Consumption ━━━');

  console.log('\n4.1 Create Work Order');
  testWoNumber = `WO-V8-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const createWO = await req('POST', '/work-orders', {
    wo_number: testWoNumber,
    model_id: testModelId,
    quantity: 50,
    priority: 'normal',
    stages: [
      { stage_name: 'قص', sort_order: 0 },
      { stage_name: 'خياطة', sort_order: 1 },
      { stage_name: 'تشطيب', sort_order: 2 },
    ],
  });
  assert(createWO.status === 201, `WO created: ${testWoNumber}`);
  testWoId = createWO.data?.id;
  testStages = createWO.data?.stages || [];
  assert(testStages.length === 3, '3 stages created');

  console.log('\n4.2 Start execution');
  const startRes = await req('PATCH', `/work-orders/${testWoId}/status`, { status: 'in_progress' });
  assert(startRes.status === 200, 'WO set to in_progress');

  console.log('\n4.3 GET fabric-consumption (empty)');
  const emptyConsumption = await req('GET', `/work-orders/${testWoId}/fabric-consumption`);
  assert(emptyConsumption.status === 200, 'Endpoint returns 200');
  assert(emptyConsumption.data?.consumption?.length === 0, 'No consumption initially');
  assert(typeof emptyConsumption.data?.available_batches === 'object', 'available_batches structure present');

  console.log('\n4.4 POST fabric-consumption (record 20m)');
  // Find a batch from the PO
  const allBatches = emptyConsumption.data?.available_batches || {};
  let testBatchId = null;
  for (const code in allBatches) {
    if (allBatches[code].length > 0) {
      testBatchId = allBatches[code][0].batch_id;
      break;
    }
  }
  
  const addConsumption = await req('POST', `/work-orders/${testWoId}/fabric-consumption`, {
    fabric_code: testFabricCode,
    batch_id: testBatchId,
    planned_meters: 25,
    actual_meters: 20,
    price_per_meter: 150,
    notes: 'First consumption batch',
  });
  assert(addConsumption.status === 201, 'Fabric consumption recorded');
  const updatedWo = addConsumption.data;
  assert(updatedWo?.fabric_consumption?.length === 1, '1 consumption record exists');
  consumptionId = updatedWo?.fabric_consumption?.[0]?.id;
  assertClose(updatedWo?.total_fabric_consumption_cost, 3000, 'total_fabric_consumption_cost = 20×150 = 3000');

  console.log('\n4.5 POST fabric-consumption (record another 10m)');
  const addConsumption2 = await req('POST', `/work-orders/${testWoId}/fabric-consumption`, {
    fabric_code: testFabricCode,
    batch_id: testBatchId,
    planned_meters: 10,
    actual_meters: 10,
    price_per_meter: 150,
    notes: 'Second consumption batch',
  });
  assert(addConsumption2.status === 201, 'Second consumption recorded');
  assertClose(addConsumption2.data?.total_fabric_consumption_cost, 4500, 'total_fabric_consumption_cost = 30×150 = 4500');

  console.log('\n4.6 PATCH fabric-consumption (update to 22m)');
  if (consumptionId) {
    const patchRes = await req('PATCH', `/work-orders/${testWoId}/fabric-consumption/${consumptionId}`, {
      actual_meters: 22,
      notes: 'Updated to 22m',
    });
    assert(patchRes.status === 200, 'Consumption updated');
    assertClose(patchRes.data?.total_fabric_consumption_cost, 4800, 'total = 22×150 + 10×150 = 4800');
  }

  console.log('\n4.7 DELETE fabric-consumption (second record)');
  const secondId = addConsumption2.data?.fabric_consumption?.find(c => c.id !== consumptionId)?.id;
  if (secondId) {
    const delRes = await req('DELETE', `/work-orders/${testWoId}/fabric-consumption/${secondId}`);
    assert(delRes.status === 200, 'Consumption deleted');
    assertClose(delRes.data?.total_fabric_consumption_cost, 3300, 'total = 22×150 = 3300 after delete');
    assert(delRes.data?.fabric_consumption?.length === 1, 'Only 1 record remains');
  }

  // ═══════════════════════════════════════
  // GROUP 5: Waste Tracking
  // ═══════════════════════════════════════
  console.log('\n━━━ GROUP 5: Waste Tracking ━━━');

  console.log('\n5.1 GET waste (empty)');
  const emptyWaste = await req('GET', `/work-orders/${testWoId}/waste`);
  assert(emptyWaste.status === 200, 'Waste endpoint returns 200');
  assert(emptyWaste.data?.length === 0, 'No waste initially');

  console.log('\n5.2 POST waste');
  const addWaste = await req('POST', `/work-orders/${testWoId}/waste`, {
    waste_meters: 2.5,
    price_per_meter: 150,
    notes: 'Cutting waste — fabric defect',
  });
  assert(addWaste.status === 201, 'Waste recorded');
  assertClose(addWaste.data?.total_waste_cost, 375, 'total_waste_cost = 2.5×150 = 375');
  wasteId = addWaste.data?.waste_records?.[0]?.id;

  console.log('\n5.3 POST waste (second record)');
  const addWaste2 = await req('POST', `/work-orders/${testWoId}/waste`, {
    waste_meters: 1,
    price_per_meter: 150,
    notes: 'Stitching waste',
  });
  assert(addWaste2.status === 201, 'Second waste recorded');
  assertClose(addWaste2.data?.total_waste_cost, 525, 'total_waste_cost = 375 + 150 = 525');

  console.log('\n5.4 Validate waste: missing meters');
  const badWaste = await req('POST', `/work-orders/${testWoId}/waste`, { price_per_meter: 10 });
  assert(badWaste.status === 400, `Missing waste_meters rejected (${badWaste.status})`);

  // ═══════════════════════════════════════
  // GROUP 6: Stage Advance & Partial Invoice
  // ═══════════════════════════════════════
  console.log('\n━━━ GROUP 6: Stage Advance + Partial Invoice ━━━');

  console.log('\n6.1 Start stage 1 and advance all');
  const stageStart = await req('PATCH', `/work-orders/${testWoId}/stage-start`, { stage_id: testStages[0].id });
  assert(stageStart.status === 200, 'Stage 1 started');

  const adv1 = await req('PATCH', `/work-orders/${testWoId}/stage-advance`, {
    from_stage_id: testStages[0].id,
    qty_to_pass: 50,
  });
  assert(adv1.status === 200, 'Advanced 50 from stage 1');

  console.log('\n6.2 Advance stage 2');
  const s2 = adv1.data.stages?.find(s => s.id === testStages[1].id);
  const adv2 = await req('PATCH', `/work-orders/${testWoId}/stage-advance`, {
    from_stage_id: testStages[1].id,
    qty_to_pass: s2?.quantity_in_stage || 50,
  });
  assert(adv2.status === 200, 'Advanced from stage 2');

  console.log('\n6.3 Advance stage 3 (last)');
  const s3 = adv2.data.stages?.find(s => s.id === testStages[2].id);
  const adv3 = await req('PATCH', `/work-orders/${testWoId}/stage-advance`, {
    from_stage_id: testStages[2].id,
    qty_to_pass: s3?.quantity_in_stage || 50,
  });
  assert(adv3.status === 200, 'Advanced from last stage');
  assert(adv3.data.pieces_completed >= 50, `pieces_completed >= 50 (got ${adv3.data.pieces_completed})`);

  console.log('\n6.4 Create invoice from WO (20 pcs at 400 EGP)');
  const inv1 = await req('POST', `/work-orders/${testWoId}/create-invoice`, {
    qty_to_invoice: 20,
    unit_price: 400,
    customer_name: 'Test Customer V8',
    notes: 'Partial delivery — first batch',
  });
  assert(inv1.status === 201, 'Invoice created');
  assert(inv1.data?.invoice_number?.startsWith('INV-'), `Invoice number format OK: ${inv1.data?.invoice_number}`);
  assert(inv1.data?.qty_invoiced === 20, `qty_invoiced=20 (got ${inv1.data?.qty_invoiced})`);
  invoiceId = inv1.data?.invoice_id;
  const woAfterInv = inv1.data?.wo;
  assert(woAfterInv?.total_invoiced_qty === 20, `WO total_invoiced_qty=20 (got ${woAfterInv?.total_invoiced_qty})`);
  assert(woAfterInv?.wo_invoices?.length === 1, 'WO has 1 invoice bridge record');

  console.log('\n6.5 Create second invoice (25 pcs at 410 EGP)');
  const inv2 = await req('POST', `/work-orders/${testWoId}/create-invoice`, {
    qty_to_invoice: 25,
    unit_price: 410,
    customer_name: 'Test Customer V8',
  });
  assert(inv2.status === 201, 'Second invoice created');
  const woAfterInv2 = inv2.data?.wo;
  assert(woAfterInv2?.total_invoiced_qty === 45, `total_invoiced_qty=45 (got ${woAfterInv2?.total_invoiced_qty})`);
  assert(woAfterInv2?.wo_invoices?.length === 2, '2 invoice records');

  console.log('\n6.6 Over-invoice blocked');
  const overInv = await req('POST', `/work-orders/${testWoId}/create-invoice`, {
    qty_to_invoice: 100,
    unit_price: 400,
    customer_name: 'X',
  });
  assert(overInv.status === 400, `Over-invoice rejected (${overInv.status})`);

  console.log('\n6.7 Zero qty blocked');
  const zeroInv = await req('POST', `/work-orders/${testWoId}/create-invoice`, {
    qty_to_invoice: 0,
    unit_price: 400,
    customer_name: 'X',
  });
  assert(zeroInv.status === 400, `Zero qty rejected (${zeroInv.status})`);

  // ═══════════════════════════════════════
  // GROUP 7: Finalization + Real Cost
  // ═══════════════════════════════════════
  console.log('\n━━━ GROUP 7: Finalization + Real Cost ━━━');

  console.log('\n7.1 Finalize WO');
  const finalizeRes = await req('POST', `/work-orders/${testWoId}/finalize`, {
    pieces_produced: 50,
    extra_notes: 'V8 test finalization',
  });
  assert(finalizeRes.status === 200, 'Finalize successful');
  const finalWo = finalizeRes.data;
  assert(finalWo.status === 'completed', `Status = completed (got ${finalWo.status})`);
  assert(finalWo.total_production_cost > 0, `total_production_cost > 0 (got ${finalWo.total_production_cost})`);
  assert(finalWo.cost_per_piece > 0, `cost_per_piece > 0 (got ${finalWo.cost_per_piece})`);

  // Verify cost math: fabric 22×150=3300, waste 2.5×150+1×150=525, + masnaiya + masrouf
  // cost_per_piece = totalCost / 50
  console.log(`  Production cost: ${finalWo.total_production_cost}`);
  console.log(`  Cost per piece: ${finalWo.cost_per_piece}`);
  console.log(`  Waste cost per piece: ${finalWo.waste_cost_per_piece}`);

  // The waste cost per piece should be 525/50 = 10.5
  assertClose(finalWo.waste_cost_per_piece, 10.5, 'waste_cost_per_piece ≈ 525/50 = 10.5', 0.1);

  console.log('\n7.2 Verify cost_snapshot created');
  // getFullWO returns cost_summary, check it
  const finalCheck = await req('GET', `/work-orders/${testWoId}`);
  assert(finalCheck.status === 200, 'GET finalized WO works');
  assert(finalCheck.data?.cost_summary, 'cost_summary present');
  assert(finalCheck.data?.completed_date || finalCheck.data?.completed_at, 'completed_date set');

  // ═══════════════════════════════════════
  // GROUP 8: Reports
  // ═══════════════════════════════════════
  console.log('\n━━━ GROUP 8: Report Endpoints ━━━');

  console.log('\n8.1 production-by-stage-detail');
  const stageReport = await req('GET', '/reports/production-by-stage-detail');
  assert(stageReport.status === 200, 'Endpoint returns 200');
  assert(Array.isArray(stageReport.data), 'Returns array');
  if (stageReport.data.length > 0) {
    const firstStage = stageReport.data[0];
    assert(firstStage.stage_name, 'Has stage_name');
    assert('wo_count' in firstStage, 'Has wo_count');
    assert(Array.isArray(firstStage.work_orders), 'Has work_orders array');
  }

  console.log('\n8.2 production-by-model');
  const modelReport = await req('GET', '/reports/production-by-model');
  assert(modelReport.status === 200, 'Endpoint returns 200');
  assert(Array.isArray(modelReport.data), 'Returns array');
  if (modelReport.data.length > 0) {
    const first = modelReport.data[0];
    assert(first.model_code, 'Has model_code');
    assert('wo_count' in first, 'Has wo_count');
    assert('total_pieces' in first, 'Has total_pieces');
    assert(Array.isArray(first.fabric_usage), 'Has fabric_usage array');
  }

  console.log('\n8.3 production-by-model with search');
  const modelSearch = await req('GET', '/reports/production-by-model?search=TST');
  assert(modelSearch.status === 200, 'Search endpoint returns 200');

  console.log('\n8.4 fabric-consumption-by-supplier');
  const supplierReport = await req('GET', '/reports/fabric-consumption-by-supplier');
  assert(supplierReport.status === 200, 'Endpoint returns 200');
  assert(Array.isArray(supplierReport.data), 'Returns array');
  if (supplierReport.data.length > 0) {
    const first = supplierReport.data[0];
    assert(first.supplier_name, 'Has supplier_name');
    assert('item_count' in first, 'Has item_count');
    assert('total_meters' in first, 'Has total_meters');
    assert('total_cost' in first, 'Has total_cost');
  }

  console.log('\n8.5 Existing reports still work');
  const summary = await req('GET', '/reports/summary');
  assert(summary.status === 200, 'Summary report OK');
  const byModel = await req('GET', '/reports/by-model');
  assert(byModel.status === 200, 'By-model report OK');
  const costs = await req('GET', '/reports/cost-variance');
  assert(costs.status === 200, 'Cost-variance report OK');
  const prodStage = await req('GET', '/reports/production-by-stage');
  assert(prodStage.status === 200, 'Production-by-stage OK');
  const fabricCons = await req('GET', '/reports/fabric-consumption');
  assert(fabricCons.status === 200, 'Fabric-consumption OK');
  const wasteAnalysis = await req('GET', '/reports/waste-analysis');
  assert(wasteAnalysis.status === 200, 'Waste-analysis OK');
  const hr = await req('GET', '/reports/hr-summary');
  assert(hr.status === 200, 'HR-summary OK');

  // ═══════════════════════════════════════
  // GROUP 9: Edge Cases & Data Integrity
  // ═══════════════════════════════════════
  console.log('\n━━━ GROUP 9: Edge Cases & Data Integrity ━━━');

  console.log('\n9.1 Consumption on non-existent WO');
  const badWoConsumption = await req('POST', '/work-orders/999999/fabric-consumption', {
    fabric_code: testFabricCode,
    actual_meters: 10,
    price_per_meter: 100,
  });
  assert(badWoConsumption.status === 404, `404 for non-existent WO (${badWoConsumption.status})`);

  console.log('\n9.2 Consumption without fabric');
  const noFabric = await req('POST', `/work-orders/${testWoId}/fabric-consumption`, {
    actual_meters: 10,
    price_per_meter: 100,
  });
  assert(noFabric.status === 400, `Missing fabric rejected (${noFabric.status})`);

  console.log('\n9.3 Consumption with zero meters');
  const zeroMeters = await req('POST', `/work-orders/${testWoId}/fabric-consumption`, {
    fabric_code: testFabricCode,
    actual_meters: 0,
    price_per_meter: 100,
  });
  assert(zeroMeters.status === 400, `Zero meters rejected (${zeroMeters.status})`);

  console.log('\n9.4 Waste on non-existent WO');
  const badWoWaste = await req('POST', '/work-orders/999999/waste', {
    waste_meters: 5,
    price_per_meter: 100,
  });
  assert(badWoWaste.status === 404, `404 for non-existent WO (${badWoWaste.status})`);

  console.log('\n9.5 Delete consumption that does not exist');
  const delBad = await req('DELETE', `/work-orders/${testWoId}/fabric-consumption/999999`);
  assert(delBad.status === 404, `404 for non-existent consumption (${delBad.status})`);

  console.log('\n9.6 Invoice from WO that does not exist');
  const badInv = await req('POST', '/work-orders/999999/create-invoice', {
    qty_to_invoice: 1,
    unit_price: 100,
    customer_name: 'X',
  });
  assert(badInv.status === 404, `404 for non-existent WO invoice (${badInv.status})`);

  console.log('\n9.7 PO receive with empty items');
  if (testPoId) {
    const emptyReceive = await req('PATCH', `/purchase-orders/${testPoId}/receive`, { items: [] });
    assert(emptyReceive.status === 400, `Empty items rejected (${emptyReceive.status})`);
  }

  console.log('\n9.8 Full WO data integrity check');
  const fullWo = await req('GET', `/work-orders/${testWoId}`);
  assert(fullWo.status === 200, 'Full WO retrieved');
  const wo = fullWo.data;
  assert(Array.isArray(wo.fabric_consumption), 'fabric_consumption is array');
  assert(Array.isArray(wo.waste_records), 'waste_records is array');
  assert(Array.isArray(wo.wo_invoices), 'wo_invoices is array');
  assert(typeof wo.total_fabric_consumption_cost === 'number', 'total_fabric_consumption_cost is number');
  assert(typeof wo.total_waste_cost === 'number', 'total_waste_cost is number');
  assert(wo.quantity_integrity, 'quantity_integrity present');
  assert(wo.stage_wip_summary, 'stage_wip_summary present');
  assert(wo.cost_summary, 'cost_summary present');

  // ═══════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════
  console.log('\n━━━ CLEANUP ━━━');
  // Don't delete test data — it's useful for manual inspection

  // ═══════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════
  console.log(`\n${'═'.repeat(48)}`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(48)}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch(err => { console.error('Test error:', err); process.exitCode = 1; });
