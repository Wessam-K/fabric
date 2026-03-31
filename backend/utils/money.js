// Phase 2.2: Safe monetary arithmetic — avoid floating-point errors
// All monetary calculations should go through these functions.
// SQLite stores REAL for money columns — these helpers ensure consistent rounding.

/**
 * Round a monetary value to 2 decimal places (banker's rounding avoidance).
 * @param {number} amount
 * @returns {number}
 */
function round2(amount) {
  return Math.round((amount || 0) * 100) / 100;
}

/**
 * Convert amount to piasters (smallest unit) for integer arithmetic.
 * @param {number} amount — e.g. 125.50
 * @returns {number} — e.g. 12550
 */
function toPiasters(amount) {
  return Math.round((amount || 0) * 100);
}

/**
 * Convert piasters back to amount.
 * @param {number} piasters — e.g. 12550
 * @returns {number} — e.g. 125.50
 */
function fromPiasters(piasters) {
  return (piasters || 0) / 100;
}

/**
 * Safely add multiple monetary amounts, avoiding floating-point drift.
 * @param {...number} amounts
 * @returns {number}
 */
function safeAdd(...amounts) {
  const total = amounts.reduce((a, b) => a + toPiasters(b), 0);
  return fromPiasters(total);
}

/**
 * Safely multiply two values (e.g. quantity × unit_price).
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function safeMultiply(a, b) {
  return Math.round((a || 0) * (b || 0) * 100) / 100;
}

/**
 * Safely subtract b from a.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function safeSubtract(a, b) {
  return fromPiasters(toPiasters(a) - toPiasters(b));
}

module.exports = { round2, toPiasters, fromPiasters, safeAdd, safeMultiply, safeSubtract };
