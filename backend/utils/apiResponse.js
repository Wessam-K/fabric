/**
 * Phase 3.3: Standardized API response helpers
 * Ensures consistent response format across all endpoints
 */

function success(res, data, statusCode = 200) {
  return res.status(statusCode).json(data);
}

function created(res, data) {
  return res.status(201).json(data);
}

function error(res, message, statusCode = 500, details = null) {
  const body = { error: message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}

function notFound(res, message = 'المورد غير موجود') {
  return error(res, message, 404);
}

function badRequest(res, message = 'بيانات غير صالحة', details = null) {
  return error(res, message, 400, details);
}

function unauthorized(res, message = 'غير مصرح') {
  return error(res, message, 401);
}

function forbidden(res, message = 'ممنوع الوصول') {
  return error(res, message, 403);
}

module.exports = { success, created, error, notFound, badRequest, unauthorized, forbidden };
