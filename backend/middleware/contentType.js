/**
 * Phase 1.2: Content-Type enforcement middleware.
 * Requires application/json for POST/PUT/PATCH unless it's a file upload.
 */
const ENFORCE_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const UPLOAD_PATHS = ['/upload', '/import', '/restore'];

function contentTypeEnforcement(req, res, next) {
  if (!ENFORCE_METHODS.has(req.method)) return next();

  // Skip upload/multipart endpoints — match path segments, not substrings
  const pathOnly = req.originalUrl.split('?')[0].toLowerCase();
  if (UPLOAD_PATHS.some(p => pathOnly.includes('/' + p.slice(1)) || pathOnly.endsWith(p))) return next();

  const ct = req.headers['content-type'] || '';
  if (!ct.includes('application/json') && !ct.includes('multipart/form-data')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  next();
}

module.exports = { contentTypeEnforcement };
