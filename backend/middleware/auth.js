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
    console.log('Generated new JWT_SECRET and saved to .jwt_secret');
  }
}
const JWT_EXPIRES = '24h';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح — يجب تسجيل الدخول' });
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
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

function canUser(user, mod, action) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  try {
    const userPerm = db.prepare('SELECT allowed FROM user_permissions WHERE user_id=? AND module=? AND action=?').get(user.id, mod, action);
    if (userPerm) return !!userPerm.allowed;
    const rolePerm = db.prepare('SELECT allowed FROM role_permissions WHERE role=? AND module=? AND action=?').get(user.role, mod, action);
    return !!(rolePerm && rolePerm.allowed);
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

module.exports = { generateToken, requireAuth, requireRole, requirePermission, canUser, logAudit };
