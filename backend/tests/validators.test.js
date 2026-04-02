/**
 * T2: Unit tests for validation utilities
 * Run: node --test tests/validators.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../utils/validators');

describe('Validators', () => {
  describe('required', () => {
    it('returns null when all required fields present', () => {
      assert.equal(v.required({ name: 'Test', code: 'T1' }, [
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
      ]), null);
    });
    it('returns error when field missing', () => {
      const err = v.required({ name: '' }, [{ key: 'name', label: 'الاسم' }]);
      assert.ok(err);
      assert.ok(err.includes('الاسم'));
    });
    it('returns error when field is null', () => {
      assert.ok(v.required({ x: null }, [{ key: 'x', label: 'X' }]));
    });
    it('returns error when field is undefined', () => {
      assert.ok(v.required({}, [{ key: 'x', label: 'X' }]));
    });
  });

  describe('isNumber', () => {
    it('accepts valid numbers', () => {
      assert.equal(v.isNumber(42, 'val'), null);
      assert.equal(v.isNumber('3.14', 'val'), null);
      assert.equal(v.isNumber(0, 'val'), null);
    });
    it('rejects non-numeric strings', () => {
      assert.ok(v.isNumber('abc', 'val'));
    });
    it('accepts empty/null (optional)', () => {
      assert.equal(v.isNumber(null, 'val'), null);
      assert.equal(v.isNumber('', 'val'), null);
      assert.equal(v.isNumber(undefined, 'val'), null);
    });
    it('rejects NaN and Infinity', () => {
      assert.ok(v.isNumber(NaN, 'val'));
      assert.ok(v.isNumber(Infinity, 'val'));
    });
  });

  describe('isPositive', () => {
    it('accepts positive numbers', () => {
      assert.equal(v.isPositive(5, 'val'), null);
      assert.equal(v.isPositive(0, 'val'), null);
    });
    it('rejects negative numbers', () => {
      assert.ok(v.isPositive(-1, 'val'));
    });
  });

  describe('isDate', () => {
    it('accepts valid dates', () => {
      assert.equal(v.isDate('2024-01-15', 'date'), null);
      assert.equal(v.isDate('2024-12-31', 'date'), null);
    });
    it('accepts empty/null (optional)', () => {
      assert.equal(v.isDate(null, 'date'), null);
      assert.equal(v.isDate('', 'date'), null);
    });
    it('rejects invalid date formats', () => {
      assert.ok(v.isDate('not-a-date', 'date'));
      assert.ok(v.isDate('31-12-2024', 'date'));
    });
  });

  describe('isEnum', () => {
    it('accepts valid enum values', () => {
      assert.equal(v.isEnum('active', ['active', 'inactive'], 'status'), null);
    });
    it('rejects invalid enum values', () => {
      assert.ok(v.isEnum('deleted', ['active', 'inactive'], 'status'));
    });
    it('accepts empty (optional)', () => {
      assert.equal(v.isEnum('', ['active'], 'status'), null);
      assert.equal(v.isEnum(null, ['active'], 'status'), null);
    });
  });

  describe('maxLength', () => {
    it('accepts within limit', () => {
      assert.equal(v.maxLength('abc', 10, 'field'), null);
    });
    it('rejects over limit', () => {
      assert.ok(v.maxLength('a'.repeat(256), 255, 'field'));
    });
  });

  describe('check', () => {
    it('returns null when all pass', () => {
      assert.equal(v.check(
        () => v.required({ a: 'x' }, [{ key: 'a', label: 'A' }]),
        () => v.isNumber(5, 'num'),
      ), null);
    });
    it('returns first error', () => {
      const err = v.check(
        () => v.required({}, [{ key: 'a', label: 'A' }]),
        () => v.isNumber('x', 'num'),
      );
      assert.ok(err.includes('A'));
    });
  });

  describe('validatePassword', () => {
    it('accepts strong passwords', () => {
      assert.equal(v.validatePassword('Str0ng!Pass'), null);
    });
    it('rejects short passwords', () => {
      assert.ok(v.validatePassword('Short1!'));
    });
    it('rejects no uppercase', () => {
      assert.ok(v.validatePassword('alllowercase1!'));
    });
    it('rejects no lowercase', () => {
      assert.ok(v.validatePassword('ALLUPPERCASE1!'));
    });
    it('rejects no digit', () => {
      assert.ok(v.validatePassword('NoDigitHere!!'));
    });
    it('rejects no special char', () => {
      assert.ok(v.validatePassword('NoSpecial123'));
    });
  });
});
