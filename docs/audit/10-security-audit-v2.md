# WK-Hub Security & Production-Readiness Audit v2

> **Date**: 2026-03-26  
> **Scope**: Full codebase (backend, frontend, Electron, database, build, tests)  
> **Schema Version**: V33 | **App Version**: 2.0.0 | **Electron**: 41.0.2  

---

## Executive Summary

Comprehensive line-by-line audit of 34 backend routes, 57 frontend pages, 31 components, Electron main process, preload, security lib, database schema (V1–V33), and build configuration.

### Test Results
| Suite | Result |
|-------|--------|
| Frontend Build | ✅ 2552 modules, 0 errors |
| API Tests | ✅ 58/58 pass |
| E2E Tests (Playwright) | ✅ 27/27 pass |
| Electron Build | ✅ WK-Hub 2.0.0.exe (92MB) |

---

## Issues Found & Fixed

### Critical Issues — FIXED

| # | Issue | File | Fix |
|---|-------|------|-----|
| C1 | `.auth-state.json` (live JWT) not in `.gitignore` | `.gitignore` | Added to gitignore |
| C2 | Health endpoint leaked node version, schema, user count, memory | `server.js` | Reduced to `{ status, app, database }` |
| C3 | `create-admin` TOCTOU race (no transaction) | `server.js` | Wrapped in `db.transaction()` |
| C4 | Password policy inconsistency: users.js allowed 6-char passwords | `routes/users.js` | Enforced 8 chars + uppercase + digit everywhere |
| C5 | Seed bcrypt cost=10 vs production cost=12 | `seed.js` | Changed to cost=12, added `must_change_password=1` |
| C6 | `run.bat` displayed default password `admin/123456` | `run.bat` | Removed credential display |
| C7 | API 401 interceptor caused infinite redirect loop on `/login` | `api.js` | Added `/login` path guard |
| C8 | `ImageUpload` memory leak: `URL.createObjectURL` never revoked | `ImageUpload.jsx` | Used `useMemo` + `useEffect` cleanup |
| C9 | `export:save-to-disk` IPC accepted arbitrary buffer without validation | `electron.js` | Added 50MB limit + extension whitelist |
| C10 | `cache:set` IPC accepted arbitrary keys from renderer | `electron.js` | Restricted to `wk_` prefix + 1MB value limit |
| C11 | `log:write` IPC accepted arbitrary severity levels | `electron.js` | Restricted to `['info', 'warn']` + message truncation |
| C12 | Backup file path used from DB without traversal guard | `routes/backups.js` | Reconstruct path via `path.basename()` |
| C13 | Fabrics upload directory not auto-created | `routes/fabrics.js` | Added `mkdirSync` with `recursive: true` |
| C14 | `Dashboard.old.jsx` stale file shipped in bundle | `pages/` | Deleted |
| C15 | `e2e/capture-missing.js` empty file | `e2e/` | Deleted |
| C16 | JWT `atob()` didn't handle URL-safe Base64 | `api.js` | Added `-`→`+` and `_`→`/` replacement |
| C17 | `ErrorBoundary` invisible text in dark mode | `ErrorBoundary.jsx` | Added `dark:` class variants |
| C18 | `SECRETS.md` with credential docs not gitignored | `.gitignore` | Added to gitignore |

### High Issues — Documented (Accepted Risk for v2.0)

| # | Issue | Risk Level | Mitigation |
|---|-------|-----------|------------|
| H1 | JWT tokens not revocable (no blacklist) | Medium | 24h TTL + proactive refresh. Full invalidation deferred to v2.1 |
| H2 | No rate limiting beyond login endpoint | Medium | Electron single-user context. Global rate-limiter planned for v2.1 |
| H3 | `contentSecurityPolicy: false` in Express Helmet | Low | Electron has its own CSP via `lib/security.js`. Express CSP disabled to avoid conflicts |
| H4 | localStorage JWT in renderer | Low | Acceptable for Electron with `contextIsolation: true`. Not a web-deployed app |
| H5 | No ASAR packing / code signing | Low | Portable deployment target. Code signing requires certificate purchase |
| H6 | Dev CSP allows `unsafe-inline` + `unsafe-eval` | None in prod | Only applies when `!app.isPackaged`. Production CSP is strict |
| H7 | Duplicate charting libraries (chart.js + recharts) | Bundle size only | Both used in different modules. Consolidation deferred |
| H8 | No lazy loading for 57 pages | Performance only | Bundle is 1.6MB gzipped. Acceptable for Electron |

### Medium Issues — Noted for v2.1

| # | Issue | Notes |
|---|-------|-------|
| M1 | Empty `.catch()` blocks in 17+ files | Silent error swallowing. Should add toast feedback |
| M2 | `parseInt()` without NaN guards on pagination | Could produce unexpected offsets |
| M3 | Regex-based XSS stripping (`stripTags`) | Consider `sanitize-html` library |
| M4 | Export endpoints allow unlimited data extraction | Add row limits + audit logging |
| M5 | DB `synchronous = NORMAL` trades durability | Consider `FULL` for production deployments |
| M6 | `employees` table stores `national_id` in plaintext | Encrypt sensitive PII |
| M7 | Migration empty `catch` blocks suppress errors | Add logging to migration failures |
| M8 | No password history enforcement | `password_history` table exists but not checked |
| M9 | Multiple CORS origins including dev ports | Strip dev origins in production |
| M10 | Accessibility: minimal ARIA coverage | Add `aria-label` to icon-only buttons |

---

## What's Done Well

### Security Strengths
- ✅ **Electron hardening**: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- ✅ **Preload channel whitelisting**: explicit `VALID_SEND/RECEIVE/INVOKE_CHANNELS`
- ✅ **Production CSP**: `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`
- ✅ **Remote module blocked**: all `remote-*` events preventDefault'd
- ✅ **Navigation restriction**: `will-navigate` + `setWindowOpenHandler` locked to localhost
- ✅ **DevTools blocked in prod**: F12/Ctrl+Shift+I intercepted + devtools auto-close
- ✅ **JWT auto-generation**: 64-byte random secret with `chmod 0o600`
- ✅ **Sensitive field redaction**: Logger strips password/token/jwt/secret from logs
- ✅ **Input sanitization**: Global middleware strips HTML tags from all body strings
- ✅ **Permission system**: Granular module+action with role defaults + user overrides
- ✅ **FK constraints**: `PRAGMA foreign_keys = ON` + consistent CASCADE
- ✅ **No XSS vectors**: Zero `dangerouslySetInnerHTML`, `eval()`, `innerHTML` in frontend
- ✅ **Proper auth guards**: All routes use `ProtectedRoute` with permission checks
- ✅ **Token refresh**: Proactive refresh before expiry with deduplication
- ✅ **Audit logging**: Structured audit logger with 90-day rotation

### Architecture Strengths
- ✅ 34 route modules with consistent error handling pattern
- ✅ 33-version migration chain with `schema_migrations` tracking
- ✅ Performance indexes on all FK and query-hot columns (V18/20/25/26)
- ✅ Pre-migration automatic DB backups in Electron
- ✅ Backend crash recovery with auto-restart (up to 3 times)
- ✅ Comprehensive test coverage: 58 API + 27 E2E tests

---

## File Inventory

| Area | Files | Lines (approx) |
|------|-------|-----------------|
| Backend routes | 34 | ~8,500 |
| Backend core (server, db, middleware) | 6 | ~3,200 |
| Frontend pages | 57 | ~12,000 |
| Frontend components | 31 | ~4,500 |
| Frontend utils/context/hooks | 11 | ~1,200 |
| Electron + lib | 6 | ~900 |
| Tests | 8 | ~1,800 |
| **Total** | **153** | **~32,100** |

---

## Recommendations for v2.1

1. **Add global Express rate limiter** — `express-rate-limit` with tiered limits
2. **JWT invalidation** — Add token version counter that increments on logout/password change
3. **Lazy loading** — Use `React.lazy()` for route-level code splitting (especially Reports.jsx at 122KB)
4. **Consolidate charting** — Pick one (recharts recommended) and remove the other
5. **Database encryption** — SQLCipher for PII protection
6. **Password history check** — Query `password_history` table during password change
7. **Code signing** — Acquire certificate for production distribution
8. **Auto-updater** — Integrate `electron-updater` for seamless updates
