/**
 * WK-Hub Input Validators
 * Common validation functions for backend routes
 */

function required(value, fieldName) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} مطلوب`;
  }
  return null;
}

function isPositiveNumber(value, fieldName) {
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    return `${fieldName} يجب أن يكون رقم موجب`;
  }
  return null;
}

function isNonNegativeNumber(value, fieldName) {
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return `${fieldName} يجب أن يكون رقم صفر أو أكثر`;
  }
  return null;
}

function isValidDate(value, fieldName) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return `${fieldName} تاريخ غير صالح`;
  }
  return null;
}

function isValidEmail(value, fieldName) {
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return `${fieldName} بريد إلكتروني غير صالح`;
  }
  return null;
}

function maxLength(value, max, fieldName) {
  if (value && String(value).length > max) {
    return `${fieldName} يجب ألا يتجاوز ${max} حرف`;
  }
  return null;
}

function validate(rules) {
  const errors = [];
  for (const rule of rules) {
    const err = rule();
    if (err) errors.push(err);
  }
  return errors.length > 0 ? errors : null;
}

module.exports = { required, isPositiveNumber, isNonNegativeNumber, isValidDate, isValidEmail, maxLength, validate };
