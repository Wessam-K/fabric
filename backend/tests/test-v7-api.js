// V7 API Test Suite — Stage Advance + Movement Log
const http = require('http');

const BASE = 'http://localhost:9002/api';
let TOKEN = '';
let testWoId = null;
let testStages = [];
let passed = 0;
let failed = 0;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;

    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
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

async function run() {
  console.log('=== V7 Test Suite ===\n');

  // 1. Login
  console.log('1. Login');
  const login = await req('POST', '/auth/login', { username: 'admin', password: '123456' });
  assert(login.status === 200 && login.data.token, 'Login successful');
  TOKEN = login.data.token;

  // 2. Create test WO
  console.log('\n2. Create Work Order');
  const createRes = await req('POST', '/work-orders', {
    wo_number: `TEST-V7-${Date.now()}`,
    model_code: 'TST',
    quantity: 100,
    priority: 'normal',
    stages: [
      { stage_name: 'قص', sort_order: 0 },
      { stage_name: 'خياطة', sort_order: 1 },
      { stage_name: 'تشطيب', sort_order: 2 },
      { stage_name: 'كي وتغليف', sort_order: 3 },
    ],
  });
  assert(createRes.status === 201, 'WO created (status 201)');
  testWoId = createRes.data.id;
  testStages = createRes.data.stages || [];
  assert(testStages.length === 4, '4 stages created');

  // 3. First stage quantity initialization
  console.log('\n3. First Stage Quantity Initialization');
  const firstStage = testStages[0];
  assert(firstStage.quantity_in_stage === 100, `First stage has quantity_in_stage=100 (got ${firstStage.quantity_in_stage})`);
  assert(testStages[1].quantity_in_stage === 0, 'Second stage has quantity_in_stage=0');

  // 4. Check stage_wip_summary
  console.log('\n4. Stage WIP Summary');
  assert(createRes.data.stage_wip_summary?.length === 4, 'stage_wip_summary has 4 entries');
  const wipFirst = createRes.data.stage_wip_summary?.[0];
  assert(wipFirst?.quantity_in_stage === 100, `WIP summary first stage: 100 (got ${wipFirst?.quantity_in_stage})`);

  // 5. Quantity integrity check
  console.log('\n5. Quantity Integrity');
  const qi = createRes.data.quantity_integrity;
  assert(qi?.total_ordered === 100, `total_ordered=100 (got ${qi?.total_ordered})`);
  assert(qi?.balanced === true, `balanced=true (got ${qi?.balanced})`);

  // 6. Start execution
  console.log('\n6. Start Execution');
  const startExec = await req('PATCH', `/work-orders/${testWoId}/status`, { status: 'in_progress' });
  assert(startExec.status === 200, 'WO set to in_progress');

  // 7. Stage Start
  console.log('\n7. Stage Start');
  const stageStart = await req('PATCH', `/work-orders/${testWoId}/stage-start`, { stage_id: firstStage.id });
  assert(stageStart.status === 200, 'Stage start successful');
  const startedStage = stageStart.data.stages.find(s => s.id === firstStage.id);
  assert(startedStage?.status === 'in_progress', `Stage status = in_progress (got ${startedStage?.status})`);
  assert(!!startedStage?.started_at, 'started_at is set');
  assert(!!startedStage?.started_by_name, `started_by_name is set (got "${startedStage?.started_by_name}")`);

  // 8. Stage Advance — pass 60 pieces from stage 1 to stage 2
  console.log('\n8. Stage Advance (60 pass, 5 reject)');
  const advance1 = await req('PATCH', `/work-orders/${testWoId}/stage-advance`, {
    from_stage_id: firstStage.id,
    qty_to_pass: 60,
    qty_rejected: 5,
    rejection_reason: 'عيب في القماش',
    notes: 'دفعة أولى',
  });
  assert(advance1.status === 200, 'Advance successful');
  const s1After = advance1.data.stages.find(s => s.id === firstStage.id);
  const s2After = advance1.data.stages.find(s => s.id === testStages[1].id);
  assert(s1After?.quantity_in_stage === 35, `Stage 1 quantity_in_stage=35 (got ${s1After?.quantity_in_stage})`);
  assert(s1After?.quantity_completed === 60, `Stage 1 quantity_completed=60 (got ${s1After?.quantity_completed})`);
  assert(s1After?.quantity_rejected === 5, `Stage 1 quantity_rejected=5 (got ${s1After?.quantity_rejected})`);
  assert(s2After?.quantity_in_stage === 60, `Stage 2 quantity_in_stage=60 (got ${s2After?.quantity_in_stage})`);
  assert(s2After?.status === 'in_progress', `Stage 2 auto-started (got ${s2After?.status})`);

  // 9. Movement log
  console.log('\n9. Movement Log');
  assert(advance1.data.movement_log?.length >= 1, `Movement log has entries (got ${advance1.data.movement_log?.length})`);
  const log1 = advance1.data.movement_log[0];
  assert(log1.qty_moved === 60, `Log qty_moved=60 (got ${log1?.qty_moved})`);
  assert(log1.qty_rejected === 5, `Log qty_rejected=5 (got ${log1?.qty_rejected})`);
  assert(log1.from_stage_name === 'قص', `Log from_stage="قص" (got "${log1?.from_stage_name}")`);
  assert(log1.to_stage_name === 'خياطة', `Log to_stage="خياطة" (got "${log1?.to_stage_name}")`);

  // 10. Overflow protection
  console.log('\n10. Overflow Protection');
  const overflow = await req('PATCH', `/work-orders/${testWoId}/stage-advance`, {
    from_stage_id: firstStage.id,
    qty_to_pass: 999,
  });
  assert(overflow.status === 400, `Overflow rejected (status ${overflow.status})`);
  assert(overflow.data.error?.includes('المتاحة') || overflow.data.error?.includes('35'), `Error mentions available qty`);

  // 11. Advance remaining from stage 1, then advance stage 2
  console.log('\n11. Chain Advance');
  const advance2 = await req('PATCH', `/work-orders/${testWoId}/stage-advance`, {
    from_stage_id: firstStage.id,
    qty_to_pass: 35,
  });
  assert(advance2.status === 200, 'Advance remaining 35 from stage 1');
  const s1Final = advance2.data.stages.find(s => s.id === firstStage.id);
  assert(s1Final?.quantity_in_stage === 0, `Stage 1 in_stage=0 (got ${s1Final?.quantity_in_stage})`);
  assert(s1Final?.status === 'completed', `Stage 1 auto-completed (got ${s1Final?.status})`);

  // Advance 90 from stage 2 (60+35=95 but only 95 available, 5 were rejected)
  const s2Check = advance2.data.stages.find(s => s.id === testStages[1].id);
  console.log(`  Stage 2 has ${s2Check?.quantity_in_stage} in stage`);
  
  const advance3 = await req('PATCH', `/work-orders/${testWoId}/stage-advance`, {
    from_stage_id: testStages[1].id,
    qty_to_pass: s2Check.quantity_in_stage,
  });
  assert(advance3.status === 200, `Advance all ${s2Check.quantity_in_stage} from stage 2`);

  // Advance stage 3
  const s3Check = advance3.data.stages.find(s => s.id === testStages[2].id);
  const advance4 = await req('PATCH', `/work-orders/${testWoId}/stage-advance`, {
    from_stage_id: testStages[2].id,
    qty_to_pass: s3Check.quantity_in_stage,
  });
  assert(advance4.status === 200, `Advance all ${s3Check.quantity_in_stage} from stage 3`);

  // Advance stage 4 (last stage)
  const s4Check = advance4.data.stages.find(s => s.id === testStages[3].id);
  const advance5 = await req('PATCH', `/work-orders/${testWoId}/stage-advance`, {
    from_stage_id: testStages[3].id,
    qty_to_pass: s4Check.quantity_in_stage,
  });
  assert(advance5.status === 200, 'Advance from last stage');

  // 12. WO completion check
  console.log('\n12. WO Auto-Completion');
  const finalWo = advance5.data;
  assert(finalWo.pieces_completed === s4Check.quantity_in_stage, `pieces_completed=${s4Check.quantity_in_stage} (got ${finalWo.pieces_completed})`);

  // 13. Movement log endpoint
  console.log('\n13. GET Movement Log Endpoint');
  const logRes = await req('GET', `/work-orders/${testWoId}/movement-log`);
  assert(logRes.status === 200, 'GET movement-log endpoint works');
  assert(Array.isArray(logRes.data) && logRes.data.length >= 4, `Has ${logRes.data.length} log entries`);

  // 14. Validation: stage-start on non-pending stage
  console.log('\n14. Validation Tests');
  const badStart = await req('PATCH', `/work-orders/${testWoId}/stage-start`, { stage_id: firstStage.id });
  assert(badStart.status === 400, `Stage-start on completed stage rejected (${badStart.status})`);

  // 15. Cleanup — cancel test WO
  console.log('\n15. Cleanup');
  await req('DELETE', `/work-orders/${testWoId}`);
  console.log('  Test WO cancelled');

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
