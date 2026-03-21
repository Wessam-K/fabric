// Reusable validation helpers — all messages in Arabic
// Usage: const v = require('../utils/validators');

/** Check required fields exist and are non-empty. Returns first error or null. */
function required(obj, fields) {
  for (const { key, label } of fields) {
    const val = obj[key];
    if (val === undefined || val === null || String(val).trim() === '') {
      return `${label} مطلوب`;
    }
  }
  return null;
}

/** Validate value is a finite number. Returns error string or null. */
function isNumber(val, label) {
  if (val === undefined || val === null || val === '') return null; // optional
  const n = Number(val);
  if (isNaN(n) || !isFinite(n)) return `${label} يجب أن يكون رقماً`;
  return null;
}

/** Validate value is a positive number (>= 0). Returns error string or null. */
function isPositive(val, label) {
  const err = isNumber(val, label);
  if (err) return err;
  if (val !== undefined && val !== null && val !== '' && Number(val) < 0) {
    return `${label} يجب أن يكون رقماً موجباً`;
  }
  return null;
}

/** Validate value is a valid date string (YYYY-MM-DD). Returns error string or null. */
function isDate(val, label) {
  if (val === undefined || val === null || val === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(val)) || isNaN(new Date(val).getTime())) {
    return `${label} يجب أن يكون تاريخاً صحيحاً`;
  }
  return null;
}

/** Validate value is one of allowed values. Returns error string or null. */
function isEnum(val, allowed, label) {
  if (val === undefined || val === null || val === '') return null;
  if (!allowed.includes(val)) {
    return `${label} يجب أن يكون أحد: ${allowed.join(', ')}`;
  }
  return null;
}

/** Validate string length. Returns error string or null. */
function maxLength(val, max, label) {
  if (val && String(val).length > max) {
    return `${label} يجب ألا يتجاوز ${max} حرف`;
  }
  return null;
}

/** Run multiple validators. Returns first error or null.
 *  Usage: const err = validators.check(
 *    () => validators.required(body, [{ key: 'name', label: 'الاسم' }]),
 *    () => validators.isPositive(body.amount, 'المبلغ'),
 *  );
 */
function check(...fns) {
  for (const fn of fns) {
    const err = fn();
    if (err) return err;
  }
  return null;
}

module.exports = { required, isNumber, isPositive, isDate, isEnum, maxLength, check };
