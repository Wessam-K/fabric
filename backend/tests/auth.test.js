/**
 * T3: Unit tests for auth middleware (token, revocation, roles)
 * Run: node --test tests/auth.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Import auth exports
const { generateToken, revokeToken, requireRole, JWT_SECRET } = require('../middleware/auth');
const { validatePassword } = require('../utils/validators');

describe('Auth Middleware', () => {
  describe('generateToken', () => {
    it('generates a valid JWT', () => {
      const token = generateToken({ id: 1, username: 'admin', role: 'superadmin', full_name: 'Admin' });
      assert.ok(token);
      const decoded = jwt.verify(token, JWT_SECRET);
      assert.equal(decoded.id, 1);
      assert.equal(decoded.username, 'admin');
      assert.equal(decoded.role, 'superadmin');
    });

    it('token expires in 24h', () => {
      const token = generateToken({ id: 1, username: 'test', role: 'admin', full_name: 'Test' });
      const decoded = jwt.verify(token, JWT_SECRET);
      const diff = decoded.exp - decoded.iat;
      assert.equal(diff, 86400); // 24h in seconds
    });
  });

  describe('revokeToken', () => {
    it('does not throw on valid token', () => {
      const token = generateToken({ id: 99, username: 'revoke_test', role: 'admin', full_name: 'Revoke' });
      assert.doesNotThrow(() => revokeToken(token));
    });

    it('does not throw on malformed token', () => {
      assert.doesNotThrow(() => revokeToken('not-a-real-token'));
    });
  });

  describe('requireRole', () => {
    it('returns a middleware function', () => {
      const mw = requireRole('admin', 'superadmin');
      assert.equal(typeof mw, 'function');
      assert.equal(mw.length, 3); // (req, res, next)
    });

    it('returns 401 when no user', (_, done) => {
      const mw = requireRole('admin');
      const res = {
        status(code) { assert.equal(code, 401); return { json() { done(); } }; },
      };
      mw({}, res, () => { assert.fail('should not call next'); });
    });

    it('returns 403 when role not matched', (_, done) => {
      const mw = requireRole('admin');
      const req = { user: { role: 'viewer' } };
      const res = {
        status(code) { assert.equal(code, 403); return { json() { done(); } }; },
      };
      mw(req, res, () => { assert.fail('should not call next'); });
    });

    it('calls next for superadmin regardless of required role', (_, done) => {
      const mw = requireRole('admin');
      const req = { user: { role: 'superadmin' } };
      mw(req, {}, () => { done(); });
    });

    it('calls next for matching role', (_, done) => {
      const mw = requireRole('admin', 'manager');
      const req = { user: { role: 'manager' } };
      mw(req, {}, () => { done(); });
    });
  });

  describe('validatePassword', () => {
    it('rejects passwords shorter than 10 chars', () => {
      assert.ok(validatePassword('Ab1!xyz'));
    });

    it('rejects passwords without uppercase', () => {
      assert.ok(validatePassword('alllowercase1!'));
    });

    it('rejects passwords without lowercase', () => {
      assert.ok(validatePassword('ALLUPPERCASE1!'));
    });

    it('rejects passwords without digit', () => {
      assert.ok(validatePassword('NoDigitHere!!'));
    });

    it('rejects passwords without special char', () => {
      assert.ok(validatePassword('NoSpecial123'));
    });

    it('accepts strong passwords', () => {
      assert.equal(validatePassword('Str0ng!Pass'), null);
      assert.equal(validatePassword('MyP@$$w0rd1'), null);
      assert.equal(validatePassword('C0mplex!ty_'), null);
    });
  });
});
