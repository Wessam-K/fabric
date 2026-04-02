/**
 * T5: Unit tests for permission system
 * Tests canUser, requirePermission, requireRole, invalidatePermCache
 * Run: node --test tests/permission.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { canUser, requirePermission, requireRole, invalidatePermCache } = require('../middleware/auth');

describe('Permission System', () => {
  describe('canUser', () => {
    it('returns false for null user', () => {
      assert.equal(canUser(null, 'invoices', 'view'), false);
    });

    it('returns true for superadmin regardless of module', () => {
      assert.equal(canUser({ id: 1, role: 'superadmin' }, 'invoices', 'view'), true);
      assert.equal(canUser({ id: 1, role: 'superadmin' }, 'nonexistent', 'delete'), true);
    });

    it('returns false for unknown user without permissions', () => {
      assert.equal(canUser({ id: 999999, role: 'viewer' }, 'invoices', 'delete'), false);
    });
  });

  describe('requirePermission', () => {
    it('returns a middleware function', () => {
      const mw = requirePermission('invoices', 'view');
      assert.equal(typeof mw, 'function');
      assert.equal(mw.length, 3); // (req, res, next)
    });

    it('returns 401 when no user', (_, done) => {
      const mw = requirePermission('invoices', 'view');
      const res = {
        status(code) { assert.equal(code, 401); return { json() { done(); } }; },
      };
      mw({}, res, () => { assert.fail('should not call next'); });
    });

    it('lets superadmin through', (_, done) => {
      const mw = requirePermission('invoices', 'delete');
      const req = { user: { id: 1, role: 'superadmin' } };
      mw(req, {}, () => { done(); });
    });

    it('returns 403 for unpermitted user', (_, done) => {
      const mw = requirePermission('invoices', 'delete');
      const req = { user: { id: 999998, role: 'viewer' } };
      const res = {
        status(code) { assert.equal(code, 403); return { json() { done(); } }; },
      };
      mw(req, res, () => { assert.fail('should not call next'); });
    });
  });

  describe('requireRole', () => {
    it('rejects unauthorized users', (_, done) => {
      const mw = requireRole('admin');
      const res = {
        status(code) { assert.equal(code, 401); return { json() { done(); } }; },
      };
      mw({}, res, () => { assert.fail('should not call next'); });
    });

    it('rejects wrong role', (_, done) => {
      const mw = requireRole('admin');
      const req = { user: { role: 'viewer' } };
      const res = {
        status(code) { assert.equal(code, 403); return { json() { done(); } }; },
      };
      mw(req, res, () => { assert.fail('should not call next'); });
    });

    it('accepts matching role', (_, done) => {
      const mw = requireRole('admin', 'manager');
      const req = { user: { role: 'admin' } };
      mw(req, {}, () => { done(); });
    });

    it('accepts superadmin for any role', (_, done) => {
      const mw = requireRole('manager');
      const req = { user: { role: 'superadmin' } };
      mw(req, {}, () => { done(); });
    });
  });

  describe('invalidatePermCache', () => {
    it('does not throw with userId', () => {
      assert.doesNotThrow(() => invalidatePermCache(1));
    });

    it('does not throw without userId (clears all)', () => {
      assert.doesNotThrow(() => invalidatePermCache());
    });
  });
});
