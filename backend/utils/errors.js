// Shared error response helpers — all messages in Arabic
// Usage: const { notFound, forbidden, validationError, dbError, serverError, sanitize, validatePositiveNumber } = require('../utils/errors');

function notFound(res, entity = 'السجل') {
  return res.status(404).json({ error: `${entity} غير موجود`, code: 'NOT_FOUND' });
}

function forbidden(res) {
  return res.status(403).json({ error: 'ليس لديك صلاحية للقيام بهذا الإجراء', code: 'FORBIDDEN' });
}

function validationError(res, message, field) {
  const body = { error: message, code: 'VALIDATION_ERROR' };
  if (field) body.field = field;
  return res.status(400).json(body);
}

function dbError(res, err) {
  const msg = err.message || '';
  if (msg.includes('UNIQUE'))
    return res.status(409).json({ error: 'هذا الكود مستخدم بالفعل', code: 'DUPLICATE' });
  if (msg.includes('FOREIGN KEY'))
    return res.status(400).json({ error: 'المرجع المحدد غير موجود', code: 'FK_VIOLATION' });
  if (msg.includes('NOT NULL'))
    return res.status(400).json({ error: 'هذا الحقل مطلوب', code: 'NULL_VIOLATION' });
  if (msg.includes('CHECK'))
    return res.status(400).json({ error: 'القيمة المدخلة غير صحيحة', code: 'CHECK_VIOLATION' });
  return serverError(res, err);
}

function serverError(res, err) {
  console.error('[SERVER_ERROR]', err);
  return res.status(500).json({ error: 'حدث خطأ داخلي. يرجى المحاولة مرة أخرى.', code: 'SERVER_ERROR' });
}

// Simple XSS sanitizer — strips < and > from user input
function sanitize(s) {
  return String(s || '').trim().replace(/[<>]/g, '');
}

// Validate that a value is a positive finite number
function validatePositiveNumber(val, fieldName) {
  const n = Number(val);
  if (isNaN(n) || !isFinite(n) || n < 0) {
    return `${fieldName} يجب أن يكون رقماً صحيحاً موجباً`;
  }
  return null;
}

module.exports = { notFound, forbidden, validationError, dbError, serverError, sanitize, validatePositiveNumber };
