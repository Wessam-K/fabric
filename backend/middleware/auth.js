const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const pathModule = require('path');
const db = require('../database');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'wk-hub-secret-2026-change-in-prod') {
  const secretFile = pathModule.join(__dirname, '..', '.jwt_secret');
  if (fs.existsSync(secretFile)) {
    JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
  } else {
    JWT_SECRET = crypto.randomBytes(64).toString('hex');
    try { fs.writeFileSync(secretFile, JWT_SECRET, { mode: 0o600 }); } catch {}
    console.warn('Generated new JWT_SECRET and saved to .jwt_secret');
  }
}
// Read JWT expiry from settings table, fallback to 24h
function getJwtExpiry() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'jwt_expiry_hours'").get();
    const hours = row ? parseInt(row.value, 10) : 24;
    return (hours > 0 && hours <= 720) ? `${hours}h` : '24h';
  } catch { return '24h'; }
}

// ── Phase 1.3: Persistent token blacklist (SQLite table) ──
// Create revoked_tokens table if not exists
try {
  db.exec(`CREATE TABLE IF NOT EXISTS revoked_tokens (
    token_hash TEXT PRIMARY KEY,
    revoked_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  )`);
} catch {}

// Periodic cleanup of expired revoked tokens (every hour)
setInterval(() => {
  try { db.prepare("DELETE FROM revoked_tokens WHERE expires_at < datetime('now')").run(); } catch {}
}, 60 * 60 * 1000);

function revokeToken(token) {
  try {
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('INSERT OR IGNORE INTO revoked_tokens (token_hash, expires_at) VALUES (?, ?)').run(tokenHash, expiresAt);
  } catch {}
}

function isTokenRevoked(token) {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return !!db.prepare('SELECT 1 FROM revoked_tokens WHERE token_hash = ?').get(tokenHash);
  } catch { return false; }
}

function generateToken(user) {
  const JWT_EXPIRES = getJwtExpiry();
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES, algorithm: 'HS256' }
  );
}

// ── Phase 1.2: httpOnly cookie helpers ──
const COOKIE_NAME = 'wk_token';
// Cookie max-age reads from settings too
function getCookieMaxAge() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'jwt_expiry_hours'").get();
    const hours = row ? parseInt(row.value, 10) : 24;
    return (hours > 0 && hours <= 720) ? hours * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  } catch { return 24 * 60 * 60 * 1000; }
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.ELECTRON_APP !== '1',
    sameSite: 'lax',
    maxAge: getCookieMaxAge(),
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', path: '/' });
}

function requireAuth(req, res, next) {
  // Phase 3.5: Skip JWT check if API key already authenticated
  if (req.isApiKey && req.user) return next();

  // Phase 1.2: Read JWT from httpOnly cookie first, fall back to Authorization header
  let token = req.cookies?.[COOKIE_NAME] || null;
  if (!token) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) token = header.slice(7);
  }
  if (!token) {
    return res.status(401).json({ error: 'غير مصرح — يجب تسجيل الدخول' });
  }
  try {
    if (isTokenRevoked(token)) {
      return res.status(401).json({ error: 'تم إبطال الجلسة — يرجى تسجيل الدخول مجدداً' });
    }
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    req.token = token;

    // Auto-refresh: if token expires within 2 hours, issue a fresh cookie
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && (decoded.exp - now) < 7200) {
      const freshToken = generateToken({ id: decoded.id, username: decoded.username, role: decoded.role, full_name: decoded.full_name });
      setAuthCookie(res, freshToken);
    }
    next();
  } catch {
    return res.status(401).json({ error: 'انتهت الجلسة — يرجى تسجيل الدخول مجدداً' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
    if (!roles.includes(req.user.role) && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'ليس لديك صلاحية للقيام بهذا الإجراء' });
    }
    next();
  };
}

// Phase 2.3: Permission cache — avoids 2 DB queries per permission check
const _permCache = new Map();
const PERM_CACHE_TTL = 60000; // 60 seconds

function _getPermCacheKey(userId) { return `perm:${userId}`; }

function invalidatePermCache(userId) {
  if (userId) _permCache.delete(_getPermCacheKey(userId));
  else _permCache.clear(); // Clear all if no userId specified
}

function canUser(user, mod, action) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  try {
    // Check cache first
    const cacheKey = _getPermCacheKey(user.id);
    let cached = _permCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts < PERM_CACHE_TTL)) {
      const permKey = `${mod}:${action}`;
      return cached.perms[permKey] !== undefined ? cached.perms[permKey] : false;
    }
    // Build full permission map from DB
    const userPerms = db.prepare('SELECT module, action, allowed FROM user_permissions WHERE user_id=?').all(user.id);
    const rolePerms = db.prepare('SELECT module, action, allowed FROM role_permissions WHERE role=?').all(user.role);
    const perms = {};
    for (const rp of rolePerms) { perms[`${rp.module}:${rp.action}`] = !!rp.allowed; }
    for (const up of userPerms) { perms[`${up.module}:${up.action}`] = !!up.allowed; } // user overrides role
    _permCache.set(cacheKey, { ts: Date.now(), perms });
    return perms[`${mod}:${action}`] || false;
  } catch { return false; }
}

function requirePermission(module, action) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
    if (canUser(req.user, module, action)) return next();
    return res.status(403).json({ error: 'ليس لديك صلاحية للقيام بهذا الإجراء' });
  };
}

function logAudit(req, action, entityType, entityId, entityLabel, oldValues = null, newValues = null) {
  try {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const ua = req.get?.('user-agent') || '';
    db.prepare(`INSERT INTO audit_log 
      (user_id, username, action, entity_type, entity_id, entity_label, old_values, new_values, ip_address, user_agent)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(
      req.user?.id || null,
      req.user?.username || 'system',
      action, entityType,
      String(entityId || ''),
      entityLabel || '',
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ip, ua
    );
  } catch(e) { console.error('Audit log error:', e.message); }
}

module.exports = { generateToken, requireAuth, requireRole, requirePermission, canUser, logAudit, revokeToken, setAuthCookie, clearAuthCookie, invalidatePermCache, JWT_SECRET };
