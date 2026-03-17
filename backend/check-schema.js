const db = require('./database');
const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
t.forEach(x => console.log(x.name));
const cols = db.prepare("PRAGMA table_info(work_orders)").all();
console.log('\n--- work_orders columns ---');
cols.forEach(c => console.log(c.name));
const cols2 = db.prepare("PRAGMA table_info(fabric_inventory_batches)").all();
console.log('\n--- fabric_inventory_batches columns ---');
cols2.forEach(c => console.log(c.name));
