# Bugs and Issues — All Findings

## CRITICAL (3)

### C-1: DELETE Blocking Middleware Bypass — Webhooks
- **File:** `backend/server.js:523`
- **Status:** ✅ FIXED
- **Details:** `app.delete('/api/webhooks/:id')` was registered directly on `app` before the DELETE-blocking middleware at line 571. This allowed superadmin to hard-delete webhooks, bypassing the production safety rule.
- **Fix:** Removed the direct `app.delete` route. Webhook deactivation should use a PATCH/PUT instead.

### C-2: 544 Code Smells (TODO/FIXME/HACK/TEMP)
- **Status:** ⚠️ REQUIRES REVIEW
- **Details:** 544 occurrences of TODO, FIXME, HACK, XXX, TEMP, or HARDCODED found across the codebase.
- **Risk:** Unknown number of incomplete features or known bugs hidden in these markers.
- **Recommendation:** Triage all 544 items. Convert to GitHub issues. Remove resolved ones.

### C-3: 607 Console Statements in Backend
- **Status:** ⚠️ REQUIRES CLEANUP
- **Details:** 607 `console.log/error/warn` statements in backend route files (excluding tests).
- **Risk:** Potential information leakage in production. console.error in Express routes can expose stack traces.
- **Recommendation:** Replace with structured logger (`logger.info/error/warn`).

---

## HIGH (8)

### H-1: User Enumeration via 2FA Response
- **File:** `backend/routes/auth.js:48-51`
- **Status:** ✅ FIXED
- **Details:** Login response for 2FA-enabled users exposed `user_id`. Attacker could enumerate valid usernames.
- **Fix:** Replaced `user_id` with short-lived `tfa_token` (JWT, 5min expiry).

### H-2: JWT Algorithm Confusion Risk
- **File:** `backend/middleware/auth.js:94`
- **Status:** ✅ FIXED
- **Details:** `jwt.verify()` did not specify allowed algorithms. Risk of "none" algorithm attack.
- **Fix:** Added `{ algorithms: ['HS256'] }` to verify and `{ algorithm: 'HS256' }` to sign.

### H-3: No Rate Limiting on Password Reset
- **File:** `backend/routes/auth.js:127-172`
- **Status:** ⚠️ OPEN
- **Details:** `/api/auth/forgot-password` endpoint has no rate limiting. Attacker can spam reset requests.
- **Recommendation:** Add rate limit: 3 requests per email per 24h, 5 per IP per hour.

### H-4: Webhook Encryption Key Derived from JWT_SECRET
- **File:** `backend/utils/webhooks.js:7`
- **Status:** ⚠️ OPEN
- **Details:** Webhook secret encryption uses `sha256(JWT_SECRET)`. If JWT_SECRET is compromised, all webhook secrets are exposed.
- **Recommendation:** Use independent `WEBHOOK_ENCRYPTION_KEY` env variable.

### H-5: 34 Test Failures
- **Status:** ⚠️ PARTIALLY PRE-EXISTING
- **Details:** 1,430/1,464 tests pass. 34 failures. 27 were pre-existing (import jobs, 2FA, user CRUD, invitations, webhooks). 7 new failures likely from DELETE middleware blocking.
- **Recommendation:** Update tests that expect DELETE to succeed — they should now expect 403.

### H-6: Soft-Delete Columns Missing from Most Tables
- **Status:** ⚠️ DESIGN DECISION NEEDED
- **Details:** Of 115 tables, only 7 have `deleted_at` or `is_active`/`is_deleted` columns. Backend DELETE middleware blocks all deletes at HTTP level, but most delete route handlers do their own soft-delete internally (setting `status='cancelled'` or `is_deleted=1`).
- **Impact:** Low risk — HTTP DELETE middleware prevents any deletion. But tables should ideally have consistent `deleted_at` columns.
- **Tables with soft-delete columns:** chart_of_accounts (is_active), documents (deleted_at), qc_defect_codes (is_active), qc_templates (is_active), samples (deleted_at), warehouses (is_active)

### H-7: REAL Columns Used for Monetary Values
- **Status:** ⚠️ PRE-EXISTING (from prior audit)
- **Details:** ~60+ columns use SQLite REAL type for monetary values. Risk of floating-point precision errors.
- **Mitigation:** Backend uses piasters-safe arithmetic (money.js) for calculations. Display formatting handles rounding.

### H-8: Dashboard.jsx JSX Warning
- **Status:** ⚠️ LOW PRIORITY
- **Details:** Line 658 has `}}` (double closing brace) inside JSX. Vite warns but still builds successfully.
- **Impact:** No runtime effect, but should be cleaned up.

---

## MEDIUM (15)

### M-1: Password Minimum Length Only 10 Characters
- **File:** `backend/utils/validators.js:89`
- **Recommendation:** Increase to 12+ per OWASP standards.

### M-2: CSRF Skipped in Test Mode
- **File:** `backend/middleware/csrf.js:48`
- **Impact:** Test env must never be exposed to network.

### M-3: In-Memory Rate Limit State Lost on Restart
- **Files:** `backend/middleware/apiKey.js:17`, server.js rate limiter
- **Impact:** Brief window after restart with no rate limiting.

### M-4: Webhook Backward Compatibility Leaks Plaintext Secrets
- **File:** `backend/utils/webhooks.js:22-27`
- **Impact:** Old webhook secrets stored in plaintext. Force re-encryption on next webhook update.

### M-5: File Size Limit Not Enforced Globally
- **File:** `backend/utils/fileValidation.js`
- **Impact:** Only enforced per-upload config (Multer). Missing global safety net.

### M-6: Magic Byte Check Incomplete for ZIP Bombs
- **File:** `backend/routes/documents.js:60-70`
- **Impact:** DOCX/XLSX share ZIP magic bytes. ZIP bomb could pass validation.

### M-7: Password History Timing Side-Channel
- **File:** `backend/routes/auth.js:186-191`
- **Impact:** Number of password history entries could be inferred from response time.

### M-8: Reset Token Exposed in Test Response
- **File:** `backend/routes/auth.js:170-172`
- **Impact:** Test mode returns reset token in response body.

### M-9: SameSite=lax on Auth Cookie
- **File:** `backend/middleware/auth.js:62`
- **Recommendation:** Consider `strict` for added protection.

### M-10: deleteWebhook Doesn't Clear webhook_logs
- **File:** `backend/utils/webhooks.js:142`
- **Impact:** Orphaned webhook_logs accumulate. DB bloat over time.

### M-11: Original Filename Stored Unvalidated
- **File:** `backend/routes/documents.js:93`
- **Impact:** User-controlled filename stored in DB. Sanitize for XSS.

### M-12: 15 Duplicate Indexes Across Migrations
- **Status:** PRE-EXISTING
- **Impact:** Minor DB overhead, no functional impact.

### M-13: numberGenerator.js Race Condition
- **Status:** PRE-EXISTING
- **Impact:** Callers must wrap in transactions. Documented.

### M-14: License Validation Bypassable
- **Status:** PRE-EXISTING
- **Impact:** Without HMAC secret, license checks can be bypassed.

### M-15: Missing updated_at on Many Tables
- **Details:** Only ~20 of 115 tables have `updated_at`. Makes change tracking difficult.
- **Impact:** Audit log compensates, but direct DB queries lack timestamp info.

---

## LOW (12)

### L-1 through L-12
- No token rotation after use
- API key prefix exposes identifier (`wk_`)
- Log file location potentially in webroot
- Sensitive keys redaction list incomplete
- No webhook signature rotation
- File extension visible in upload URL
- Content-type path matching could be tighter
- Static DUMMY_HASH for timing protection
- Some special characters missing from password regex
- `console.log` left in migration files
- No pagination on some list endpoints
- Dashboard `}}` warning
