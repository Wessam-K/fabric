const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireRole, logAudit } = require('../middleware/auth');

// GET /api/permissions/definitions — all permission definitions grouped by module
router.get('/definitions', (req, res) => {
  try {
    const defs = db.prepare('SELECT * FROM permission_definitions ORDER BY sort_order').all();
    // Group by module
    const grouped = {};
    for (const d of defs) {
      if (!grouped[d.module]) grouped[d.module] = [];
      grouped[d.module].push(d);
    }
    res.json({ definitions: defs, grouped });
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// GET /api/permissions/roles — all role permissions
router.get('/roles', requireRole('superadmin'), (req, res) => {
  try {
    const perms = db.prepare('SELECT * FROM role_permissions ORDER BY role, module, action').all();
    // Group by role
    const byRole = {};
    for (const p of perms) {
      if (!byRole[p.role]) byRole[p.role] = {};
      const key = `${p.module}:${p.action}`;
      byRole[p.role][key] = p.allowed;
    }
    res.json(byRole);
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// PUT /api/permissions/roles/:role — update role permissions (superadmin only)
router.put('/roles/:role', requireRole('superadmin'), (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body; // { "module:action": 1/0, ... }
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'بيانات الصلاحيات غير صالحة' });
    }
    if (role === 'superadmin') {
      return res.status(400).json({ error: 'لا يمكن تعديل صلاحيات مدير النظام الأعلى' });
    }

    const validRoles = ['manager', 'accountant', 'production', 'hr', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'دور غير صالح' });
    }

    const update = db.prepare('UPDATE role_permissions SET allowed=? WHERE role=? AND module=? AND action=?');
    const insert = db.prepare('INSERT OR REPLACE INTO role_permissions (role, module, action, allowed) VALUES (?,?,?,?)');

    const trx = db.transaction(() => {
      for (const [key, allowed] of Object.entries(permissions)) {
        const [module, action] = key.split(':');
        if (!module || !action) continue;
        const existing = db.prepare('SELECT id FROM role_permissions WHERE role=? AND module=? AND action=?').get(role, module, action);
        if (existing) {
          update.run(allowed ? 1 : 0, role, module, action);
        } else {
          insert.run(role, module, action, allowed ? 1 : 0);
        }
      }
    });
    trx();

    logAudit(req, 'UPDATE', 'role_permissions', role, `تعديل صلاحيات دور: ${role}`, null, permissions);
    res.json({ message: 'تم تحديث صلاحيات الدور بنجاح' });
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// GET /api/permissions/user/:userId — get user-specific permission overrides
router.get('/user/:userId', requireRole('superadmin'), (req, res) => {
  try {
    const perms = db.prepare('SELECT * FROM user_permissions WHERE user_id=?').all(req.params.userId);
    const result = {};
    for (const p of perms) {
      result[`${p.module}:${p.action}`] = p.allowed;
    }
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// PUT /api/permissions/user/:userId — set user-specific permission overrides
router.put('/user/:userId', requireRole('superadmin'), (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { permissions } = req.body; // { "module:action": 1/0, ... } or null to remove override

    const user = db.prepare('SELECT id, full_name FROM users WHERE id=?').get(userId);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const trx = db.transaction(() => {
      // Clear existing overrides
      db.prepare('DELETE FROM user_permissions WHERE user_id=?').run(userId);
      // Insert new overrides
      if (permissions && typeof permissions === 'object') {
        const ins = db.prepare('INSERT INTO user_permissions (user_id, module, action, allowed) VALUES (?,?,?,?)');
        for (const [key, allowed] of Object.entries(permissions)) {
          if (allowed === null || allowed === undefined) continue;
          const [module, action] = key.split(':');
          if (!module || !action) continue;
          ins.run(userId, module, action, allowed ? 1 : 0);
        }
      }
    });
    trx();

    logAudit(req, 'UPDATE', 'user_permissions', userId, `تعديل صلاحيات: ${user.full_name}`, null, permissions);
    res.json({ message: 'تم تحديث صلاحيات المستخدم بنجاح' });
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

// GET /api/permissions/my — get current user's effective permissions
router.get('/my', (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    // Get role defaults
    const rolePerms = db.prepare('SELECT module, action, allowed FROM role_permissions WHERE role=?').all(role);
    const effective = {};
    for (const p of rolePerms) {
      effective[`${p.module}:${p.action}`] = p.allowed;
    }

    // superadmin always has everything
    if (role === 'superadmin') {
      const allDefs = db.prepare('SELECT module, action FROM permission_definitions').all();
      for (const d of allDefs) {
        effective[`${d.module}:${d.action}`] = 1;
      }
    } else {
      // Apply user overrides
      const userPerms = db.prepare('SELECT module, action, allowed FROM user_permissions WHERE user_id=?').all(userId);
      for (const p of userPerms) {
        effective[`${p.module}:${p.action}`] = p.allowed;
      }
    }

    res.json(effective);
  } catch (err) { console.error(err); res.status(500).json({ error: '??? ??? ?????' }); }
});

module.exports = router;
