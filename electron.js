const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ── Library modules ──────────────────────────────────────
const { initLogger, getLogger, logError, logAudit } = require('./lib/logger');
const { initCache, get: cacheGet, set: cacheSet, clear: cacheClear, stats: cacheStats } = require('./lib/cache');
const { harden } = require('./lib/security');
const { backupDatabase, listBackups, pruneBackups, getDbInfo, getSchemaVersion } = require('./lib/migrator');

// ── State ────────────────────────────────────────────────
let mainWindow;
let backendProcess;
let backendRestarts = 0;
const MAX_RESTARTS = 3;
const isDev = !app.isPackaged;
const BACKEND_PORT = 9002;
const APP_VERSION = require('./package.json').version;

// ── Paths ────────────────────────────────────────────────
function getUserDataDir() {
  return isDev ? __dirname : app.getPath('userData');
}

function getBackendPath() {
  if (isDev) return path.join(__dirname, 'backend', 'server.js');
  return path.join(process.resourcesPath, 'backend', 'server.js');
}

function getBackendCwd() {
  if (isDev) return path.join(__dirname, 'backend');
  return path.join(process.resourcesPath, 'backend');
}

function getDbDir() {
  if (isDev) return path.join(__dirname, 'backend');
  return app.getPath('userData');
}

function getDbFilePath() {
  return path.join(getDbDir(), 'wk-hub.db');
}

function getLogsDir() {
  return path.join(getUserDataDir(), 'logs');
}

function getBackupsDir() {
  return path.join(getUserDataDir(), 'backups');
}

function getCacheDir() {
  return path.join(getUserDataDir(), 'cache');
}

// ── Initialize subsystems ────────────────────────────────
function initSubsystems() {
  initLogger(getLogsDir());
  initCache({ diskDir: getCacheDir(), stdTTL: 300, maxKeys: 500 });

  getLogger().info('WK-Hub starting', {
    version: APP_VERSION,
    isDev,
    electron: process.versions.electron,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  });
}

// ── Pre-migration backup ─────────────────────────────────
function preMigrationBackup() {
  const dbPath = getDbFilePath();
  if (!fs.existsSync(dbPath)) return;

  const result = backupDatabase(dbPath, getBackupsDir());
  if (result.success) {
    getLogger().info('Pre-migration backup created', { path: result.backupPath });
    logAudit('DB_BACKUP', { trigger: 'pre-migration', path: result.backupPath });
    // Keep only last 10 backups
    pruneBackups(getBackupsDir(), 10);
  } else {
    logError('DB_BACKUP_FAILED', 'Pre-migration backup failed', { error: result.error });
  }
}

// ── Backend process management ───────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = getBackendPath();
    const env = {
      ...process.env,
      PORT: String(BACKEND_PORT),
      WK_DB_DIR: getDbDir(),
      NODE_ENV: isDev ? 'development' : 'production',
    };

    getLogger().info('Starting backend', { serverPath, port: BACKEND_PORT, dbDir: getDbDir() });

    backendProcess = spawn(process.execPath, [serverPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: getBackendCwd(),
    });

    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) getLogger().info(`[backend] ${msg}`);
      if (msg.includes('running on')) resolve();
      // Forward to renderer if window exists
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend:log', msg);
      }
    });

    backendProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) getLogger().error(`[backend:err] ${msg}`);
    });

    backendProcess.on('error', (err) => {
      logError('BACKEND_START_FAILED', 'Backend process failed to start', { error: err.message });
      reject(err);
    });

    backendProcess.on('exit', (code) => {
      if (code !== null && code !== 0 && backendRestarts < MAX_RESTARTS) {
        backendRestarts++;
        logError('BACKEND_CRASH', `Backend crashed (exit ${code}), restarting ${backendRestarts}/${MAX_RESTARTS}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('backend:status', 'restarting');
        }
        startBackend().catch(() => {});
      } else if (code !== null && code !== 0) {
        logError('BACKEND_CRASH', `Backend crashed permanently after ${MAX_RESTARTS} restarts`);
        dialog.showErrorBox(
          'خطأ في الخادم',
          'تعطل الخادم الخلفي بشكل متكرر. يرجى إعادة تشغيل التطبيق.\n\n' +
          `سجل الأخطاء: ${getLogsDir()}`
        );
      }
    });

    // Fallback: resolve after 5s
    setTimeout(resolve, 5000);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendRestarts = MAX_RESTARTS;
    try { backendProcess.kill('SIGTERM'); } catch {}
    backendProcess = null;
    getLogger().info('Backend stopped');
  }
}

// ── Window ───────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: `WK-Hub v${APP_VERSION} — نظام إدارة المصنع`,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    autoHideMenuBar: true,
    show: false, // Show after ready-to-show
  });

  // Show when ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend:status', 'running');
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:9173');
  } else {
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  }

  // Apply security hardening (CSP, navigation restriction, DevTools blocking)
  harden(mainWindow, logError);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC Handlers ─────────────────────────────────────────
function registerIPC() {
  // App controls
  ipcMain.on('app:minimize', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.on('app:maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on('app:close', () => { if (mainWindow) mainWindow.close(); });

  ipcMain.on('app:restart-backend', () => {
    getLogger().info('Manual backend restart requested');
    logAudit('BACKEND_RESTART', { trigger: 'manual' });
    stopBackend();
    backendRestarts = 0;
    startBackend().catch((err) => {
      logError('BACKEND_START_FAILED', 'Manual restart failed', { error: err.message });
    });
  });

  // Invoke handlers (request-response)
  ipcMain.handle('app:get-version', () => APP_VERSION);

  ipcMain.handle('app:get-paths', () => ({
    userData: getUserDataDir(),
    logs: getLogsDir(),
    backups: getBackupsDir(),
    database: getDbFilePath(),
  }));

  ipcMain.handle('app:is-packaged', () => app.isPackaged);

  ipcMain.handle('system:get-info', () => ({
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    appVersion: APP_VERSION,
    memory: process.memoryUsage(),
  }));

  // Dialog handlers
  ipcMain.handle('dialog:open-file', async (_event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
      properties: options?.properties || ['openFile'],
    });
    return result;
  });

  ipcMain.handle('dialog:save-file', async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
      defaultPath: options?.defaultPath,
    });
    return result;
  });

  ipcMain.handle('dialog:message-box', async (_event, options) => {
    return dialog.showMessageBox(mainWindow, options);
  });

  // Export: save buffer to disk
  const ALLOWED_EXPORT_EXTS = ['xlsx', 'csv', 'pdf', 'json', 'txt'];
  const MAX_EXPORT_SIZE = 50 * 1024 * 1024; // 50MB
  ipcMain.handle('export:save-to-disk', async (_event, { buffer, defaultName }) => {
    const ext = path.extname(defaultName).slice(1).toLowerCase();
    if (!ALLOWED_EXPORT_EXTS.includes(ext)) return { success: false, error: 'نوع ملف غير مسموح' };
    const buf = Buffer.from(buffer);
    if (buf.length > MAX_EXPORT_SIZE) return { success: false, error: 'حجم الملف كبير جداً' };
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, buf);
      getLogger().info('Export saved', { path: result.filePath, size: buf.length });
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  // Database handlers
  ipcMain.handle('db:backup-now', () => {
    const result = backupDatabase(getDbFilePath(), getBackupsDir());
    if (result.success) {
      logAudit('DB_BACKUP', { trigger: 'manual', path: result.backupPath });
      pruneBackups(getBackupsDir(), 10);
    }
    return result;
  });

  ipcMain.handle('db:get-path', () => getDbFilePath());

  ipcMain.handle('db:get-size', () => {
    return getDbInfo(getDbFilePath());
  });

  // Cache handlers (restrict keys to wk_ prefix)
  ipcMain.handle('cache:get', (_event, key) => {
    if (typeof key !== 'string' || !key.startsWith('wk_')) return null;
    return cacheGet(key);
  });
  ipcMain.handle('cache:set', (_event, key, value, ttl) => {
    if (typeof key !== 'string' || !key.startsWith('wk_')) return false;
    const serialized = JSON.stringify(value);
    if (serialized && serialized.length > 1024 * 1024) return false; // 1MB max per value
    return cacheSet(key, value, ttl);
  });
  ipcMain.handle('cache:clear', () => { cacheClear(); return true; });

  // Logging from renderer (restrict levels)
  const SAFE_LOG_LEVELS = ['info', 'warn'];
  ipcMain.on('log:write', (_event, { level, message, meta }) => {
    const l = getLogger();
    const safeLevel = SAFE_LOG_LEVELS.includes(level) ? level : 'info';
    l[safeLevel](`[renderer] ${String(message).slice(0, 500)}`, meta || {});
  });
}

// ── App lifecycle ────────────────────────────────────────
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // Init logging & caching
  initSubsystems();

  // Pre-migration backup (before backend starts and runs migrations)
  preMigrationBackup();

  // Register IPC
  registerIPC();

  // Start backend
  try {
    await startBackend();
    getLogger().info('Backend started successfully');
  } catch (err) {
    logError('BACKEND_START_FAILED', 'Failed to start backend', { error: err.message });
    dialog.showErrorBox(
      'خطأ في بدء التشغيل',
      `فشل تشغيل الخادم الخلفي.\n${err.message}\n\nسجل الأخطاء: ${getLogsDir()}`
    );
  }

  createWindow();
});

app.on('window-all-closed', () => {
  getLogger().info('All windows closed, quitting');
  stopBackend();
  app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ── Global error handling ────────────────────────────────
process.on('uncaughtException', (err) => {
  logError('APP_CRASH', `Uncaught exception: ${err.message}`, { stack: err.stack });
  dialog.showErrorBox('خطأ غير متوقع', `${err.message}\n\nسجل الأخطاء: ${getLogsDir()}`);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  logError('APP_CRASH', `Unhandled rejection: ${msg}`);
});
