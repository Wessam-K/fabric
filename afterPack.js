/**
 * afterPack hook for electron-builder.
 * 
 * Ensures the packaged better_sqlite3.node is the Node 22 version (ABI 127).
 * Always copies fresh from source to guarantee correctness.
 */
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const resourcesDir = path.join(appOutDir, 'resources');
  
  const src = path.join(__dirname, 'backend', 'node_modules',
    'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  const target = path.join(resourcesDir, 'backend', 'node_modules',
    'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');

  if (!fs.existsSync(src)) {
    console.warn('[afterPack] WARNING: source better_sqlite3.node not found!');
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
  const size = fs.statSync(target).size;
  console.log(`[afterPack] Copied Node 22 better_sqlite3.node (${(size/1024).toFixed(0)} KB)`);
};
