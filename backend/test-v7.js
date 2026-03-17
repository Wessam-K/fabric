const db = require('./database');

console.log('DB loaded OK');

const v = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get();
console.log('Schema version:', v.v);

const cols = db.prepare('PRAGMA table_info(wo_stages)').all().map(c => c.name);
console.log('wo_stages columns:', cols.join(', '));

const logT = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stage_movement_log'").get();
console.log('stage_movement_log exists:', !!logT);

if (logT) {
  const logCols = db.prepare('PRAGMA table_info(stage_movement_log)').all().map(c => c.name);
  console.log('stage_movement_log columns:', logCols.join(', '));
}

// Check if first-stage fix worked
const wos = db.prepare("SELECT wo.id, wo.wo_number, wo.quantity FROM work_orders wo WHERE wo.status IN ('draft','in_progress') AND wo.quantity > 0 LIMIT 5").all();
for (const w of wos) {
  const first = db.prepare('SELECT id, stage_name, quantity_in_stage FROM wo_stages WHERE wo_id=? ORDER BY sort_order LIMIT 1').get(w.id);
  console.log(`WO ${w.wo_number} (qty=${w.quantity}): first stage "${first?.stage_name}" has quantity_in_stage=${first?.quantity_in_stage}`);
}

console.log('\nAll V7 checks passed!');
