/**
 * T1: Unit tests for monetary arithmetic utilities
 * Run: node --test tests/money.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { round2, toPiasters, fromPiasters, safeAdd, safeMultiply, safeSubtract } = require('../utils/money');

describe('Money Utilities', () => {
  describe('round2', () => {
    it('rounds to two decimal places', () => {
      assert.equal(round2(1.006), 1.01);
      assert.equal(round2(1.004), 1);
      assert.equal(round2(99.999), 100);
    });
    it('handles zero and null', () => {
      assert.equal(round2(0), 0);
      assert.equal(round2(null), 0);
      assert.equal(round2(undefined), 0);
    });
    it('handles negative values', () => {
      assert.equal(round2(-1.005), -1);
      assert.equal(round2(-99.999), -100);
    });
    it('handles large values', () => {
      assert.equal(round2(1000000.126), 1000000.13);
    });
  });

  describe('toPiasters / fromPiasters', () => {
    it('converts to piasters correctly', () => {
      assert.equal(toPiasters(125.50), 12550);
      assert.equal(toPiasters(0.01), 1);
      assert.equal(toPiasters(0), 0);
    });
    it('converts from piasters correctly', () => {
      assert.equal(fromPiasters(12550), 125.50);
      assert.equal(fromPiasters(1), 0.01);
      assert.equal(fromPiasters(0), 0);
    });
    it('handles null/undefined', () => {
      assert.equal(toPiasters(null), 0);
      assert.equal(fromPiasters(undefined), 0);
    });
    it('round-trip preserves value', () => {
      assert.equal(fromPiasters(toPiasters(99.99)), 99.99);
      assert.equal(fromPiasters(toPiasters(0.01)), 0.01);
    });
  });

  describe('safeAdd', () => {
    it('adds amounts without floating-point errors', () => {
      // 0.1 + 0.2 should be 0.3, not 0.30000000000000004
      assert.equal(safeAdd(0.1, 0.2), 0.3);
    });
    it('adds multiple amounts', () => {
      assert.equal(safeAdd(10.10, 20.20, 30.30), 60.6);
    });
    it('handles single amount', () => {
      assert.equal(safeAdd(99.99), 99.99);
    });
    it('handles no arguments', () => {
      assert.equal(safeAdd(), 0);
    });
  });

  describe('safeMultiply', () => {
    it('multiplies quantity × price precisely', () => {
      assert.equal(safeMultiply(3, 19.99), 59.97);
      assert.equal(safeMultiply(100, 0.01), 1);
    });
    it('handles zero', () => {
      assert.equal(safeMultiply(0, 100), 0);
      assert.equal(safeMultiply(100, 0), 0);
    });
    it('handles null', () => {
      assert.equal(safeMultiply(null, 100), 0);
    });
  });

  describe('safeSubtract', () => {
    it('subtracts without floating-point errors', () => {
      assert.equal(safeSubtract(0.3, 0.1), 0.2);
    });
    it('handles negative results', () => {
      assert.equal(safeSubtract(10, 20), -10);
    });
    it('handles zero', () => {
      assert.equal(safeSubtract(5, 5), 0);
    });
  });
});
