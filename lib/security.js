/**
 * Anti-reverse-engineering and security hardening for the Electron app.
 * 
 * Layers:
 *  1. DevTools detection & blocking in production
 *  2. Navigation restriction (only allow same-origin + localhost)
 *  3. Content Security Policy
 *  4. ASAR integrity validation
 *  5. Debug port detection
 */
const { app, session } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

/**
 * Content Security Policy for the renderer.
 * Applied via session headers.
 */
function getCSP() {
  const backendOrigin = 'http://localhost:9173';
  // In dev, also allow Vite's HMR WebSocket and dev server
  if (isDev) {
    return [
      "default-src 'self'",
      `connect-src 'self' ${backendOrigin} ws://localhost:9173`,
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src 'self' https://fonts.gstatic.com data:`,
      `img-src 'self' data: blob: ${backendOrigin}`,
    ].join('; ');
  }
  return [
    "default-src 'self'",
    `connect-src 'self' ${backendOrigin}`,
    `script-src 'self'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob: ${backendOrigin}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ].join('; ');
}

/**
 * Apply CSP headers to all responses.
 */
function applyCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [getCSP()],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
        'Referrer-Policy': ['strict-origin-when-cross-origin'],
      },
    });
  });
}

/**
 * Block navigation to external URLs.
 * Only allow localhost (backend) and app:// scheme.
 */
function restrictNavigation(win, logFn) {
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = [
      'http://localhost:9173',
      'http://localhost:9173', // dev only
      'about:blank',
    ];
    const isAllowed = allowed.some(a => url.startsWith(a));
    if (!isAllowed && !url.startsWith('app://')) {
      event.preventDefault();
      if (logFn) logFn('SECURITY_NAVIGATION_BLOCKED', `Blocked navigation to: ${url}`);
    }
  });

  // Block new window creation except for external links handled by shell.openExternal
  win.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require('electron');
    if (url.startsWith('http://localhost:') || url.startsWith('https://localhost:')) {
      return { action: 'deny' };
    }
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

/**
 * Disable DevTools in production builds.
 */
function blockDevTools(win) {
  if (isDev) return; // Allow in development

  // Remove keyboard shortcuts
  win.webContents.on('before-input-event', (event, input) => {
    // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
    if (input.key === 'F12') {
      event.preventDefault();
    }
    if (input.control && input.shift && (input.key === 'I' || input.key === 'J' || input.key === 'C')) {
      event.preventDefault();
    }
    if (input.control && input.key === 'U') {
      event.preventDefault();
    }
  });

  // Close DevTools if somehow opened
  win.webContents.on('devtools-opened', () => {
    win.webContents.closeDevTools();
  });
}

/**
 * Check for common debug indicators.
 * Phase 1.8: Enhanced — also checks process.debugPort and Electron remote debugging.
 * Returns true if debugging is detected.
 */
function detectDebugger() {
  if (isDev) return false;

  // Check active debug port
  if (process.debugPort && process.debugPort > 0) return true;

  // Check for common debug environment variables
  const debugIndicators = [
    'ELECTRON_ENABLE_LOGGING',
    'ELECTRON_DEBUG_PORT',
    'NODE_OPTIONS',
    'ELECTRON_RUN_AS_NODE',
  ];

  for (const envVar of debugIndicators) {
    const val = process.env[envVar];
    if (val && (val.includes('inspect') || val.includes('debug'))) {
      return true;
    }
  }

  // Check command line args for debug flags
  const suspiciousArgs = process.argv.filter(a =>
    a.includes('--inspect') ||
    a.includes('--inspect-brk') ||
    a.includes('--debug') ||
    a.includes('--remote-debugging-port') ||
    a.includes('--js-flags')
  );

  return suspiciousArgs.length > 0;
}

/**
 * Validate ASAR integrity (basic check).
 * Ensures the app.asar file hasn't been tampered with by checking size consistency.
 */
function validateAppIntegrity() {
  if (isDev) return { valid: true, reason: 'development mode' };

  try {
    const asarPath = path.join(path.dirname(app.getAppPath()), 'app.asar');
    // Use original-fs to bypass Electron's asar interception
    const originalFs = require('original-fs');
    if (!originalFs.existsSync(asarPath)) {
      return { valid: true, reason: 'no asar (unpacked)' };
    }

    // Check asar is readable and has reasonable size
    const stat = originalFs.statSync(asarPath);
    if (stat.size < 1000) {
      return { valid: false, reason: 'asar too small — possibly tampered' };
    }

    return { valid: true, size: stat.size };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/**
 * Apply all security hardening in sequence.
 * @param {BrowserWindow} win
 * @param {Function} logFn - function(errorKey, message) for logging
 */
function harden(win, logFn) {
  applyCSP();
  restrictNavigation(win, logFn);
  blockDevTools(win);

  // Disable remote module (already not available in Electron 41, but defensive)
  app.on('remote-require', (event) => { event.preventDefault(); });
  app.on('remote-get-builtin', (event) => { event.preventDefault(); });
  app.on('remote-get-global', (event) => { event.preventDefault(); });
  app.on('remote-get-current-window', (event) => { event.preventDefault(); });
  app.on('remote-get-current-web-contents', (event) => { event.preventDefault(); });

  // Debugger detection — exit in production if debug detected
  if (detectDebugger()) {
    if (logFn) logFn('SECURITY_DEBUG_ATTEMPT', 'Debug mode detected in production — exiting');
    app.quit();
    return;
  }

  // ASAR integrity
  const integrity = validateAppIntegrity();
  if (!integrity.valid) {
    if (logFn) logFn('SECURITY_CSP_VIOLATION', `App integrity check failed: ${integrity.reason}`);
  }
}

module.exports = {
  getCSP,
  applyCSP,
  restrictNavigation,
  blockDevTools,
  detectDebugger,
  validateAppIntegrity,
  harden,
};
