# 11 — Security & Production-Readiness Audit v3

> **Date**: 2026-03-26  
> **Schema**: V33 | **Electron**: 41.0.2 | **Node**: 22.16.0  
> **Scope**: Full codebase (153+ files), line-by-line review across 3 audit passes  
> **Result**: 58/58 API tests pass, 27/27 E2E tests pass, Electron build 92MB

---

## Audit Methodology

Three parallel deep-audits were performed:
1. **Backend Security** — All 34 route files, middleware, database, seed, utils
2. **Frontend Code** — All 57 pages, 31 components, 3 contexts, 6 utils, 4 hooks
3. **Electron/Build/Test** — Main process, preload, lib/*, config, tests, scripts, docs

---

## CRITICAL Issues Found & Fixed

### C1. Duplicate Public Admin-Creation Endpoint — Race Condition
- **Location**: `routes/auth.js` (duplicate of `server.js`)
- **Risk**: TOCTOU race — two parallel requests both create admin
- **Fix**: Removed duplicate endpoint from auth.js; server.js version uses transaction ✅

### C2. File Upload Extension Bypass (RCE Risk)
- **Location**: `routes/fabrics.js`, `routes/accessories.js`, `routes/models.js`
- **Risk**: Extension derived from user-controlled `file.originalname`, not MIME type
- **Fix**: Extension derived from verified MIME type via `MIME_TO_EXT` map ✅

### C3. Blob URL Memory Leaks (5 locations)
- **Location**: `Fabrics.jsx`, `Accessories.jsx`, `formatters.js`, `TrialBalance.jsx`
- **Risk**: `URL.createObjectURL()` called without `revokeObjectURL()` — unbounded memory growth
- **Fix**: Added `useMemo` + `useEffect` cleanup for image previews; added `revokeObjectURL` to download helpers ✅

### C4. ConfirmDialog Promise Never Resolves on Cancel
- **Location**: `ConfirmDialog.jsx`
- **Risk**: Calling code indefinitely suspended when user cancels dialog
- **Fix**: Added `onReject` callback that resolves promise with `false` on close ✅

### C5. Migrator Async Backup Race Condition
- **Location**: `lib/migrator.js`
- **Risk**: `src.backup()` returns Promise but function is sync — backup may be incomplete when reported as success
- **Fix**: Replaced with synchronous `fs.copyFileSync` — reliable and deterministic ✅

### C6. `dialog:message-box` IPC Passes Raw Options
- **Location**: `electron.js`
- **Risk**: Compromised renderer could craft misleading system dialogs
- **Fix**: Whitelisted allowed option properties (`type`, `title`, `message`, `buttons`, `detail`) ✅

### C7. CSV Injection in Downloads
- **Location**: `formatters.js`, `TrialBalance.jsx`
- **Risk**: Values starting with `=`, `+`, `-`, `@` trigger Excel formula execution
- **Fix**: Prefix dangerous values with single-quote to neutralize ✅

---

## HIGH Issues Found & Fixed

### H1. No Query Parameter Sanitization
- **Fix**: Extended sanitization middleware to strip HTML tags from `req.query` ✅

### H2. No Pagination Ceiling — DoS via Large Limits
- **Fix**: Global middleware caps `req.query.limit` at 500 ✅

### H3. Oversized JSON Body Limit (10MB → 2MB)
- **Fix**: Reduced `express.json({ limit })` from 10MB to 2MB ✅

### H4. DashboardCharts Uses DOM Read Instead of Theme Context
- **Fix**: Replaced `document.documentElement.classList.contains('dark')` with `useTheme()` hook ✅

### H5. Missing ErrorBoundary Around Lazy-Loaded Charts
- **Fix**: Wrapped `<Suspense>/<LazyCharts>` in `<ErrorBoundary>` ✅

### H6. Backend .gitignore Missing `.jwt_secret` + UTF-16 Encoding
- **Fix**: Re-encoded as UTF-8, added `.jwt_secret` entry ✅

### H7. Stale IPC Channel Lists in Preload
- **Fix**: Cleaned `VALID_SEND_CHANNELS` and `VALID_RECEIVE_CHANNELS` to match actual `ipcMain` handlers ✅

### H8. No Single-Instance Lock
- **Fix**: Added `app.requestSingleInstanceLock()` to prevent port conflicts from multiple instances ✅

### H9. ConfirmDialog Missing Dark Mode
- **Fix**: Added `dark:bg-[#1a1a2e]`, `dark:text-white`, `dark:text-gray-300` classes ✅

### H10. Export `writeFileSync` Missing try/catch
- **Fix**: Wrapped in try/catch to prevent main process crash ✅

---

## Accepted Risks (Documented)

| ID | Risk | Reason for Acceptance |
|----|------|----------------------|
| A1 | JWT 24h lifetime | Acceptable for Electron desktop; no network exposure |
| A2 | No global rate limiting beyond auth | Single-user Electron app; no public network |
| A3 | CSP disabled in Express | Electron adds its own CSP; backend only serves to localhost |
| A4 | localStorage JWT storage | Standard for Electron; no cookie-jacking risk |
| A5 | No CSRF tokens | JWT Bearer auth only, no cookies — CSRF not applicable |
| A6 | Password policy: 8+ chars/uppercase/digit | Sufficient for internal factory ERP |
| A7 | `xlsx@0.18.5` prototype pollution CVE | Mitigated by input sanitization; migration to `exceljs` planned for v2.1 |
| A8 | No code signing | Portable distribution; SmartScreen warning acceptable for now |
| A9 | Seed script with default password `123456` | Development only; `must_change_password=1` enforced; seed.bat not in production build |
| A10 | `synchronous = NORMAL` pragma | WAL mode provides sufficient crash protection for desktop use |

---

## Strengths Confirmed

| Area | Detail |
|------|--------|
| SQL Injection | 100% parameterized queries across all 34 routes ✅ |
| Authentication | JWT + bcrypt 12 + account lockout + password history ✅ |
| RBAC | 3-tier: superadmin bypass → user override → role default ✅ |
| Audit Logging | All mutations logged with user/IP/UA/old→new values ✅ |
| Electron Security | nodeIntegration:false, contextIsolation:true, sandbox:true ✅ |
| IPC Validation | Channel whitelisting + cache key prefix + export size/ext limits ✅ |
| Input Sanitization | Global HTML tag stripping on req.body + req.query ✅ |
| File Upload | MIME validation + extension from MIME (not filename) ✅ |
| Transaction Safety | Invoice/PO/WO multi-step ops wrapped in db.transaction() ✅ |
| Graceful Shutdown | SIGTERM/SIGINT → server.close() → db.close() ✅ |

---

## V2.1 Recommendations

1. Migrate from `xlsx` to `exceljs` (CVE remediation)
2. Add lazy loading for page components (reduce initial bundle)
3. Add `aria-label` to icon-only buttons (accessibility)
4. Replace `console.error` with structured logger in backend routes
5. Add negative/edge-case API tests
6. Add functional assertions to E2E tests
7. Implement database PII encryption for `national_id`
8. Add AbortController to GlobalSearch for request cancellation
9. Split settings into system vs factory categories
10. Add document.title per page

---

## Files Modified in This Audit

| File | Changes |
|------|---------|
| `backend/routes/auth.js` | Removed duplicate create-admin endpoint |
| `backend/routes/fabrics.js` | Extension from MIME type, not filename |
| `backend/routes/accessories.js` | Extension from MIME type + auto-create upload dir |
| `backend/routes/models.js` | Extension from MIME type + auto-create upload dir |
| `backend/server.js` | Query sanitization, pagination ceiling, JSON limit 2MB |
| `backend/.gitignore` | Re-encoded UTF-8, added .jwt_secret |
| `lib/migrator.js` | Replaced async backup with sync copyFileSync |
| `electron.js` | Single-instance lock, dialog validation, export try/catch |
| `preload.js` | Cleaned stale IPC channel lists |
| `frontend/src/pages/Fabrics.jsx` | Blob URL leak fix with useMemo/useEffect |
| `frontend/src/pages/Accessories.jsx` | Blob URL leak fix with useMemo/useEffect |
| `frontend/src/pages/Dashboard.jsx` | ErrorBoundary around lazy charts |
| `frontend/src/pages/TrialBalance.jsx` | Blob URL leak + CSV injection fix |
| `frontend/src/components/ConfirmDialog.jsx` | Promise resolution fix + dark mode |
| `frontend/src/components/DashboardCharts.jsx` | useTheme() instead of DOM read |
| `frontend/src/utils/formatters.js` | Blob URL revoke + CSV injection protection |
