/**
 * Phase 3.5: API key authentication middleware
 * Allows external systems to authenticate via X-API-Key header
 * API keys are stored hashed in the api_keys table
 * Phase 1.5: Per-key rate limiting via in-memory sliding window
 */
const crypto = require('crypto');
const db = require('../database');

// Per-key rate limit tracking: keyId -> [timestamps]
const keyRateMap = new Map();

function checkKeyRateLimit(keyId, limit, windowMs) {
  const now = Date.now();
  let timestamps = keyRateMap.get(keyId) || [];
  timestamps = timestamps.filter(t => now - t < windowMs);
  if (timestamps.length >= limit) {
    keyRateMap.set(keyId, timestamps);
    return false;
  }
  timestamps.push(now);
  keyRateMap.set(keyId, timestamps);
  return true;
}

// Ensure api_keys table exists
db.exec(`CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  permissions TEXT DEFAULT '{}',
  rate_limit INTEGER DEFAULT 100,
  rate_window_seconds INTEGER DEFAULT 60,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  last_used_at TEXT,
  expires_at TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','revoked')),
  FOREIGN KEY (created_by) REFERENCES users(id)
)`);

// Ensure rate_limit columns exist for existing databases
try { db.exec(`ALTER TABLE api_keys ADD COLUMN rate_limit INTEGER DEFAULT 100`); } catch {}
try { db.exec(`ALTER TABLE api_keys ADD COLUMN rate_window_seconds INTEGER DEFAULT 60`); } catch {}

/**
 * Generate a new API key. Returns the raw key (only shown once) and stores the hash.
 */
function generateApiKey(name, permissions, createdBy, expiresAt = null) {
  const raw = 'wk_' + crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 10);

  const result = db.prepare(`INSERT INTO api_keys (name, key_hash, key_prefix, permissions, created_by, expires_at)
    VALUES (?,?,?,?,?,?)`).run(name, hash, prefix, JSON.stringify(permissions || {}), createdBy, expiresAt);

  return { id: result.lastInsertRowid, key: raw, prefix };
}

/**
 * Middleware: authenticate via X-API-Key header as alternative to JWT
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return next(); // Fall through to JWT auth

  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const row = db.prepare("SELECT * FROM api_keys WHERE key_hash=? AND status='active'").get(hash);

  if (!row) return res.status(401).json({ error: 'مفتاح API غير صالح' });
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return res.status(401).json({ error: 'مفتاح API منتهي الصلاحية' });
  }

  // Phase 1.5: Per-key rate limit
  const rateLimit = row.rate_limit || 100;
  const rateWindow = (row.rate_window_seconds || 60) * 1000;
  if (!checkKeyRateLimit(row.id, rateLimit, rateWindow)) {
    return res.status(429).json({ error: 'تجاوز الحد الأقصى للطلبات لمفتاح API' });
  }

  // Update last_used_at
  db.prepare('UPDATE api_keys SET last_used_at=datetime("now","localtime") WHERE id=?').run(row.id);

  // Set req.user for downstream middleware
  const creator = db.prepare('SELECT id, username, full_name, role FROM users WHERE id=?').get(row.created_by);
  req.user = creator || { id: row.created_by, username: 'api-key', role: 'viewer', full_name: row.name };
  req.apiKey = { id: row.id, name: row.name, permissions: JSON.parse(row.permissions || '{}') };
  req.isApiKey = true;
  next();
}

/**
 * Revoke an API key
 */
function revokeApiKey(id) {
  return db.prepare("UPDATE api_keys SET status='revoked' WHERE id=?").run(id);
}

/**
 * List API keys (without showing hashes)
 */
function listApiKeys() {
  return db.prepare("SELECT id, name, key_prefix, permissions, created_by, created_at, last_used_at, expires_at, status FROM api_keys ORDER BY created_at DESC").all();
}

module.exports = { generateApiKey, apiKeyAuth, revokeApiKey, listApiKeys };
