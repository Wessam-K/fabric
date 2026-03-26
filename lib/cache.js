const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

let memoryCache = null;
let diskCacheDir = null;

/**
 * Initialize caching with memory tier + optional disk persistence.
 * @param {Object} opts
 * @param {string} opts.diskDir - Directory for disk cache files
 * @param {number} opts.stdTTL - Default TTL in seconds (default 300 = 5min)
 * @param {number} opts.checkperiod - Cleanup interval in seconds (default 60)
 * @param {number} opts.maxKeys - Max keys in memory (default 500)
 */
function initCache(opts = {}) {
  const { diskDir, stdTTL = 300, checkperiod = 60, maxKeys = 500 } = opts;

  memoryCache = new NodeCache({ stdTTL, checkperiod, maxKeys, useClones: true });

  if (diskDir) {
    diskCacheDir = diskDir;
    if (!fs.existsSync(diskCacheDir)) {
      fs.mkdirSync(diskCacheDir, { recursive: true });
    }
  }

  return memoryCache;
}

// Disk cache helpers
function diskKey(key) {
  // Safe filename from key
  return path.join(diskCacheDir, Buffer.from(key).toString('base64url') + '.json');
}

function readDisk(key) {
  if (!diskCacheDir) return undefined;
  const fp = diskKey(key);
  try {
    if (!fs.existsSync(fp)) return undefined;
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (raw.expiry && Date.now() > raw.expiry) {
      fs.unlinkSync(fp);
      return undefined;
    }
    return raw.value;
  } catch {
    return undefined;
  }
}

function writeDisk(key, value, ttl) {
  if (!diskCacheDir) return;
  const fp = diskKey(key);
  try {
    const data = { value, expiry: ttl > 0 ? Date.now() + ttl * 1000 : 0 };
    fs.writeFileSync(fp, JSON.stringify(data), 'utf8');
  } catch { /* ignore disk write errors */ }
}

function deleteDisk(key) {
  if (!diskCacheDir) return;
  const fp = diskKey(key);
  try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch { /* ignore */ }
}

/**
 * Get a value. Checks memory first, then disk.
 */
function get(key) {
  if (!memoryCache) return undefined;
  let val = memoryCache.get(key);
  if (val !== undefined) return val;

  // Check disk tier
  val = readDisk(key);
  if (val !== undefined) {
    // Promote back to memory
    memoryCache.set(key, val);
    return val;
  }
  return undefined;
}

/**
 * Set a value in both memory and disk.
 * @param {string} key
 * @param {*} value
 * @param {number} [ttl] - TTL in seconds (0 = use default)
 */
function set(key, value, ttl = 0) {
  if (!memoryCache) return false;
  const ok = ttl > 0 ? memoryCache.set(key, value, ttl) : memoryCache.set(key, value);
  writeDisk(key, value, ttl || memoryCache.options.stdTTL);
  return ok;
}

/**
 * Delete a key from both tiers.
 */
function del(key) {
  if (!memoryCache) return;
  memoryCache.del(key);
  deleteDisk(key);
}

/**
 * Clear all caches.
 */
function clear() {
  if (memoryCache) memoryCache.flushAll();
  if (diskCacheDir) {
    try {
      const files = fs.readdirSync(diskCacheDir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          fs.unlinkSync(path.join(diskCacheDir, f));
        }
      }
    } catch { /* ignore */ }
  }
}

/**
 * Get cache stats.
 */
function stats() {
  if (!memoryCache) return { keys: 0, hits: 0, misses: 0 };
  const s = memoryCache.getStats();
  return { keys: memoryCache.keys().length, hits: s.hits, misses: s.misses };
}

/**
 * Pattern-based cache invalidation.
 * Deletes all keys matching the given prefix.
 */
function invalidateByPrefix(prefix) {
  if (!memoryCache) return 0;
  const keys = memoryCache.keys().filter(k => k.startsWith(prefix));
  for (const k of keys) del(k);
  return keys.length;
}

module.exports = {
  initCache,
  get,
  set,
  del,
  clear,
  stats,
  invalidateByPrefix,
};
