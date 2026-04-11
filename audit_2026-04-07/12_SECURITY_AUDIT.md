# Security Audit — Detailed Findings

## Authentication & Session Security

| Control | Status | Details |
|---|---|---|
| Password hashing | ✅ bcrypt 12 rounds | Timing-safe comparison |
| JWT storage | ✅ httpOnly cookie | `Secure` in production, `SameSite=lax` |
| JWT algorithm | ✅ FIXED | Was unspecified, now `HS256` explicit |
| Token blacklist | ✅ | `revoked_tokens` table checked on every request |
| Session management | ✅ | `user_sessions` table with device tracking |
| Account lockout | ✅ | 5 failed attempts → 15 min lockout |
| 2FA support | ✅ | TOTP (Google Authenticator compatible) |
| 2FA user enum | ✅ FIXED | Was exposing `user_id`, now returns opaque `tfa_token` |
| Password complexity | ⚠️ | Min 10 chars (should be 12+ per OWASP) |
| Password history | ✅ | Last 5 passwords checked |
| Password reset | ⚠️ | No rate limiting on forgot-password endpoint |
| Password reset token | ✅ | 20-byte crypto.randomBytes, 1h expiry, single-use |

## CSRF Protection

| Control | Status | Details |
|---|---|---|
| Double-submit pattern | ✅ | Cookie + header comparison |
| Timing-safe compare | ✅ | `crypto.timingSafeEqual` |
| Test mode bypass | ⚠️ | CSRF skipped when `NODE_ENV=test` |

## API Security

| Control | Status | Details |
|---|---|---|
| SQL injection | ✅ SAFE | 100% parameterized queries |
| XSS | ✅ | Helmet CSP, React auto-escaping |
| Rate limiting | ✅ | 200 req/min global, 10/15min on auth |
| API key auth | ✅ | SHA-256 hashed, per-key rate limiting |
| CORS | ✅ | Configurable origin, credentials mode |
| Content-Type enforcement | ✅ | Rejects non-JSON POST/PUT/PATCH |
| Body size limit | ✅ | 10MB JSON, 50MB file uploads |
| Helmet headers | ✅ | Full suite including CSP, HSTS, X-Frame |

## File Upload Security

| Control | Status | Details |
|---|---|---|
| Magic byte validation | ✅ | Checks first bytes against expected MIME |
| File extension check | ✅ | Whitelist of allowed extensions |
| File size limit | ✅ | Per-route Multer limits |
| Filename sanitization | ⚠️ | Original filename stored unvalidated |

## Webhook Security

| Control | Status | Details |
|---|---|---|
| Secret encryption | ✅ | AES-256-GCM |
| Request signing | ✅ | HMAC-SHA256 |
| Encryption key | ⚠️ | Derived from JWT_SECRET (should be independent) |
| Backward compat | ⚠️ | Old plaintext secrets still readable |

## DELETE Blocking

| Control | Status | Details |
|---|---|---|
| Global middleware | ✅ | Blocks all DELETE on /api except /sessions |
| Webhook bypass | ✅ FIXED | `app.delete('/api/webhooks/:id')` removed |
| Frontend delete UI | ✅ REMOVED | All delete buttons/functions removed from 21+ pages |

---

## Fixes Applied This Audit

| # | Fix | File | Severity |
|---|---|---|---|
| 1 | Removed webhook DELETE bypass | `server.js:523` | CRITICAL |
| 2 | Fixed 2FA user enumeration (tfa_token) | `routes/auth.js:48-51` | HIGH |
| 3 | Added explicit HS256 to jwt.verify | `middleware/auth.js:94` | HIGH |
| 4 | Added HS256 to jwt.sign | `middleware/auth.js:55` | HIGH |
| 5 | Added JWT_SECRET import to auth routes | `routes/auth.js:3` | HIGH |
| 6 | V55: Seeded inventory:edit permission | `database.js` | MEDIUM |
| 7 | V55: Seeded reports:create/edit/delete permissions | `database.js` | MEDIUM |
| 8 | V55: Seeded accounting role_permissions | `database.js` | MEDIUM |

## V59 Security Fixes (2026-04-10)

| # | Fix | File | Severity |
|---|---|---|---|
| 9 | 2FA backup codes: plaintext → bcrypt(10) hashing | `routes/twofa.js`, `routes/auth.js` | CRITICAL |
| 10 | Webhook SSRF protection: validateWebhookUrl() with DNS + IP blocklist | `utils/webhooks.js`, `server.js` | CRITICAL |
| 11 | WebSocket dev auth bypass removed (always requires JWT) | `utils/websocket.js` | HIGH |
| 12 | Export endpoints gated with granular requirePermission | `routes/exports.js` | HIGH |
| 13 | DELETE blocking replaced with 16 delete permission defs | `server.js`, `database.js` | HIGH |
| 14 | EXPORT_MAX_ROWS limit (default 10,000) + X-Export-Truncated header | `routes/exports.js` | MEDIUM |
| 15 | WebSocket message rate limiting (30 msgs/min) | `utils/websocket.js` | MEDIUM |
| 16 | Database PRAGMA quick_check at startup | `database.js` | MEDIUM |
| 17 | Backup integrity verification (PRAGMA quick_check in readonly) | `backup.js` | MEDIUM |
