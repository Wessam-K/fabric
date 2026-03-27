/**
 * Ensure better-sqlite3 native addon is compiled for Node 22 (ABI 127).
 *
 * Runs `prebuild-install` in the better-sqlite3 directory to download
 * the correct prebuilt binary for Node 22, overwriting any Electron-rebuilt version.
 */
const { execSync } = require('child_process');
const path = require('path');

const betterSqliteDir = path.join(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3');

try {
  console.log('[prebuild-native] Installing Node 22 prebuild for better-sqlite3...');
  execSync('npx prebuild-install --runtime node --target 22.16.0', {
    cwd: betterSqliteDir,
    stdio: 'inherit',
  });
  console.log('[prebuild-native] Done — better_sqlite3.node is now ABI 127 (Node 22)');
} catch (err) {
  console.error('[prebuild-native] Failed:', err.message);
  process.exit(1);
}
