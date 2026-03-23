const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;
let backendRestarts = 0;
const MAX_RESTARTS = 3;

const isDev = !app.isPackaged;
const BACKEND_PORT = 9002;

function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, 'backend', 'server.js');
  }
  return path.join(process.resourcesPath, 'backend', 'server.js');
}

function getDbPath() {
  if (isDev) {
    return path.join(__dirname, 'backend');
  }
  // In production, use userData so the DB is writable
  return app.getPath('userData');
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = getBackendPath();
    const env = { ...process.env, PORT: String(BACKEND_PORT), WK_DB_DIR: getDbPath() };

    backendProcess = spawn(process.execPath, [serverPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: isDev ? path.join(__dirname, 'backend') : path.join(process.resourcesPath, 'backend'),
    });

    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[backend]', msg);
      if (msg.includes('running on')) resolve();
    });

    backendProcess.stderr.on('data', (data) => {
      console.error('[backend error]', data.toString());
    });

    backendProcess.on('error', reject);

    backendProcess.on('exit', (code) => {
      if (code !== null && code !== 0 && backendRestarts < MAX_RESTARTS) {
        backendRestarts++;
        console.log(`[backend] crashed (exit ${code}), restarting (${backendRestarts}/${MAX_RESTARTS})...`);
        startBackend().catch(() => {});
      } else if (code !== null && code !== 0) {
        dialog.showErrorBox('خطأ في الخادم', 'تعطل الخادم الخلفي بشكل متكرر. يرجى إعادة تشغيل التطبيق.');
      }
    });

    // Fallback: resolve after 3s even if no message
    setTimeout(resolve, 3000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: 'WK-Hub — نظام إدارة المصنع',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:9173');
  } else {
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  try {
    await startBackend();
  } catch (err) {
    console.error('Failed to start backend:', err);
  }
  createWindow();
});

function stopBackend() {
  if (backendProcess) {
    backendRestarts = MAX_RESTARTS; // prevent restart on intentional shutdown
    try { backendProcess.kill('SIGTERM'); } catch {}
    backendProcess = null;
  }
}

app.on('window-all-closed', () => {
  stopBackend();
  app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
