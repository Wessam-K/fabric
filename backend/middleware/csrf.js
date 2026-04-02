/**
 * Phase 1.1: CSRF protection using double-submit cookie pattern.
 * On login, a wk_csrf cookie is set (readable by JS, SameSite=strict).
 * All state-changing requests must include X-CSRF-Token header matching the cookie.
 */
const crypto = require('crypto');

const CSRF_COOKIE = 'wk_csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generate a CSRF token and set it as a cookie.
 * Call this on login success.
 */
function setCSRFCookie(res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // JS must read this to include in headers
    secure: process.env.NODE_ENV === 'production' && process.env.ELECTRON_APP !== '1',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  return token;
}

function clearCSRFCookie(res) {
  res.clearCookie(CSRF_COOKIE, { sameSite: 'strict', path: '/' });
}

/**
 * Middleware: validates CSRF token on state-changing requests.
 * Skips GET/HEAD/OPTIONS, API-key authenticated requests, and test mode.
 */
function csrfProtection(req, res, next) {
  // Safe methods don't need CSRF
  if (SAFE_METHODS.has(req.method)) return next();

  // API key requests are exempt (machine-to-machine)
  if (req.isApiKey) return next();

  // Skip in test mode to allow automated testing
  if (process.env.NODE_ENV === 'test') return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token missing or invalid' });
  }

  next();
}

module.exports = { csrfProtection, setCSRFCookie, clearCSRFCookie, CSRF_COOKIE };
