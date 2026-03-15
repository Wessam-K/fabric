const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

const isDev = !app.isPackaged;
const BACKEND_PORT = 3001;

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
    mainWindow.loadURL('http://localhost:5173');
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
  try {
    await startBackend();
  } catch (err) {
    console.error('Failed to start backend:', err);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
