const fs = require('fs');
const path = require('path');
const dirs = ['frontend/src/pages', 'frontend/src/components'];
const results = [];

function checkDir(d) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const fp = path.join(d, e.name);
    if (e.isDirectory()) { checkDir(fp); return; }
    if (!e.name.endsWith('.jsx') && !e.name.endsWith('.js')) return;
    const code = fs.readFileSync(fp, 'utf8');
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Named imports: import { A, B, C } from '...'
      const m1 = line.match(/import\s*\{([^}]+)\}\s*from/);
      if (m1) {
        const syms = m1[1].split(',').map(s => {
          const p = s.trim().split(/\s+as\s+/);
          return p[p.length - 1].trim();
        }).filter(Boolean);
        const afterImports = lines.slice(i + 1).join('\n');
        for (const sym of syms) {
          const re = new RegExp('\\b' + sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
          if (!re.test(afterImports)) {
            results.push(fp + ':' + (i + 1) + ': unused named import "' + sym + '"');
          }
        }
      }
      // Default imports: import X from '...'
      const m2 = line.match(/^import\s+([A-Z]\w+)\s+from\s/);
      if (m2) {
        const sym = m2[1];
        const afterImports = lines.slice(i + 1).join('\n');
        const re = new RegExp('\\b' + sym + '\\b');
        if (!re.test(afterImports)) {
          results.push(fp + ':' + (i + 1) + ': unused default import "' + sym + '"');
        }
      }
    }
  });
}

dirs.forEach(checkDir);
if (results.length === 0) {
  process.stdout.write('No unused imports found.\n');
} else {
  results.forEach(r => process.stdout.write(r + '\n'));
}
