const db = require('better-sqlite3')('wk-hub.db');
const target = process.argv[2];
if (target) {
  const cols = db.prepare("pragma table_info(" + target + ")").all();
  cols.forEach(c => console.log(`${c.name} (${c.type}, ${c.notnull ? 'NOT NULL' : 'NULL'}, default: ${c.dflt_value})`));
} else {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  tables.forEach(t => console.log(t.name));
  console.log(`\nTotal: ${tables.length} tables`);
}
db.close();
