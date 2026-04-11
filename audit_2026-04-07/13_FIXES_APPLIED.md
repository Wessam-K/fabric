# Fixes Applied During This Audit

## Code Fixes

| # | File | Change | Severity | Status |
|---|---|---|---|---|
| 1 | `backend/server.js:523` | Removed `app.delete('/api/webhooks/:id')` — bypassed DELETE-blocking middleware | CRITICAL | ✅ Applied |
| 2 | `backend/routes/auth.js:48-51` | Replaced `{ requires_2fa: true, user_id }` with `{ requires_2fa: true, tfa_token }` using short-lived JWT | HIGH | ✅ Applied |
| 3 | `backend/middleware/auth.js:94` | Added `{ algorithms: ['HS256'] }` to `jwt.verify()` | HIGH | ✅ Applied |
| 4 | `backend/middleware/auth.js:55` | Added `{ algorithm: 'HS256' }` to `jwt.sign()` in generateToken | HIGH | ✅ Applied |
| 5 | `backend/routes/auth.js:3` | Added `JWT_SECRET` import from middleware/auth | HIGH | ✅ Applied |

## Database Migration — V55

| # | Change | Tables Affected |
|---|---|---|
| 6 | Seeded `inventory:edit` permission definition | permission_definitions |
| 7 | Added `inventory:edit` role_permissions for superadmin, manager | role_permissions |
| 8 | Seeded `reports:create/edit/delete` permission definitions | permission_definitions |
| 9 | Added `reports:create/edit/delete` role_permissions for superadmin, manager | role_permissions |
| 10 | Seeded `accounting` role_permissions (V14 silently failed) | role_permissions |
| 11 | Added `accounting:view` for viewer role | role_permissions |

## Frontend Fixes (from prior session, completed this audit)

| # | File | Change |
|---|---|---|
| 12 | `Scheduling.jsx` | Removed Trash2, deleteEntry, delete button |
| 13 | `Settings.jsx` | Removed Trash2, deleteStage, delete button |
| 14 | `StageTemplates.jsx` | Removed Trash2, deleteId, handleDelete, delete button, ConfirmDialog |
| 15 | `MRP.jsx` | Removed Trash2, cancelRun, cancel button |
| 16 | `Backups.jsx` | Removed Trash2, remove function, delete button |
| 17 | `Quotations.jsx` | Removed unused Trash2 import |
| 18 | `BomTemplates.jsx` | Fixed orphaned confirm delete modal, missing `</div>` |

---

## V59 Security & Performance Fixes (2026-04-10)

See [16_FIXES_APPLIED_2026-04-10.md](16_FIXES_APPLIED_2026-04-10.md) for full details.

### Security (CRITICAL/HIGH)

| # | File | Change | Severity | Status |
|---|---|---|---|---|
| 19 | `routes/twofa.js`, `routes/auth.js` | 2FA backup codes: plaintext → bcrypt(10) hashing | CRITICAL | ✅ Applied |
| 20 | `utils/webhooks.js`, `server.js` | SSRF protection: validateWebhookUrl() + DNS + IP blocklist (9 patterns) | CRITICAL | ✅ Applied |
| 21 | `utils/websocket.js` | Dev auth bypass removed — all connections require JWT | HIGH | ✅ Applied |
| 22 | `routes/exports.js` | 19 export endpoints gated with granular requirePermission | HIGH | ✅ Applied |
| 23 | `server.js`, `database.js` | DELETE blocking replaced with 16 delete permission definitions | HIGH | ✅ Applied |

### Performance

| # | File | Change | Severity | Status |
|---|---|---|---|---|
| 24 | `routes/workorders.js` | Cached prepared statements via woStmt() helper | MEDIUM | ✅ Applied |
| 25 | `routes/workorders.js` | 3 SUM queries consolidated to 1 | MEDIUM | ✅ Applied |
| 26 | `routes/workorders.js` | N+1 fabric batch fix — batch-load via WHERE id IN (...) | HIGH | ✅ Applied |
| 27 | `routes/purchaseorders.js` | PO totals: JS .reduce() → SQL GROUP BY + COALESCE(SUM(CASE...)) | MEDIUM | ✅ Applied |
| 28 | `routes/suppliers.js` | Supplier ledger paginated (page/limit, default 200, max 1000) | MEDIUM | ✅ Applied |
| 29 | `routes/inventory.js` | Stock valuation: LIMIT 500 on fabric + accessory queries | MEDIUM | ✅ Applied |

### Infrastructure & Observability

| # | File | Change | Severity | Status |
|---|---|---|---|---|
| 30 | `server.js` | Express timeouts: setTimeout(30s), keepAlive(65s), headers(66s) | MEDIUM | ✅ Applied |
| 31 | `nginx.conf` | Proxy timeouts: 10s connect, 30s send/read; WS 300s | MEDIUM | ✅ Applied |
| 32 | `server.js` | console.error/warn → Winston override | MEDIUM | ✅ Applied |
| 33 | `utils/cleanup.js` | Webhook log cleanup (30-day retention) | MEDIUM | ✅ Applied |
| 34 | `utils/reportScheduler.js` | Report file cleanup (configurable retention, default 30 days) | MEDIUM | ✅ Applied |
| 35 | `utils/websocket.js` | Message rate limiting (30 msgs/min) | MEDIUM | ✅ Applied |
| 36 | `docker-compose.yml` | Resource limits: wk-factory 1GB/2CPU, nginx 256MB/0.5CPU | MEDIUM | ✅ Applied |
| 37 | `database.js` | PRAGMA quick_check at startup | MEDIUM | ✅ Applied |
| 38 | `backup.js` | Backup integrity verification (PRAGMA quick_check readonly) | MEDIUM | ✅ Applied |

### Frontend

| # | File | Change | Severity | Status |
|---|---|---|---|---|
| 39 | `ErrorBoundary.jsx` | componentDidCatch DEV-only stack logging | MEDIUM | ✅ Applied |
| 40 | `api.js` | Centralized error logging in response interceptor | MEDIUM | ✅ Applied |
| 41 | 25+ pages | Silent .catch(() => {}) → .catch(e => console.error(...)) | MEDIUM | ✅ Applied |
| 42 | `ExportsCenter.jsx` | Permission filtering with lock icons | MEDIUM | ✅ Applied |
| 43 | `Permissions.jsx` | 14 new MODULE_LABELS, MODULE_ICONS, ACTION_LABELS | LOW | ✅ Applied |

### Database Migration — V59

| # | Change | Tables Affected |
|---|---|---|
| 44 | 13 export permission definitions | permission_definitions |
| 45 | 16 delete permission definitions | permission_definitions |
| 46 | Export role_permissions (5 roles) | role_permissions |
| 47 | Delete role_permissions (per-module) | role_permissions |
| 48 | sales_orders permission defs + role assignments | permission_definitions, role_permissions |

### Tests — v59-security.test.js (31 tests)

| Category | Count |
|---|---|
| SSRF IP pattern blocking | 9 |
| 2FA backup code bcrypt hashing | 4 |
| Export permission middleware | 3 |
| Delete permission middleware | 17 |
| Backup integrity PRAGMA check | 1 |
| WebSocket module exports | 2 |
| Data retention cleanup | 2 |
