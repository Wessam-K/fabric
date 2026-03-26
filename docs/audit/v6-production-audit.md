# Audit v6 — Full Line-by-Line Production Audit

> Date: 2026-03-27
> Scope: Entire application — all backend + frontend files, line by line
> Method: Two parallel deep audits (backend 34 routes + core, frontend 90+ files)

---

## Audit Process

### Backend Audit (28 findings examined)
Audited: server.js, database.js, electron.js, preload.js, backup.js, middleware/auth.js, all utils, all 34 route files.

| Finding | Verdict |
|---------|---------|
| #1 MAX() invalid in SQLite | **FALSE POSITIVE** — MAX() is valid SQLite |
| #2 SQL injection in numberGenerator | **FALSE POSITIVE** — regex validation present |
| #3 Returns permissions missing | **FALSE POSITIVE** — defined in V26 migration |
| #4 Hardcoded JWT secret | **FALSE POSITIVE** — auto-generates and saves `.jwt_secret` |
| #5 NULL available_meters | **ACCEPTABLE** — COALESCE already used in cancel/delete |
| #6 Invoice tax order of operations | **CORRECT** — tax after discount is standard |
| #7 WO cancel no material return | **FALSE POSITIVE** — already fixed in Phase G |
| #8 Waste for lining | **BY DESIGN** — lining has no waste per business rules |
| #9 VAT inclusive/exclusive | **ACCEPTABLE** — matches business requirements |
| #10 V14 roles table reference | **ALREADY FIXED** — Phase G wrapped in try/catch |
| **#11 Missing tax/discount validation** | DEFERRED — low risk on desktop app |
| **#13 Negative return quantities** | **FIXED** — added validation |
| #14 WAL checkpoint failure | **ACCEPTABLE** — silent fail is correct |
| **#17 Invoice tax not rounded** | **FIXED** — Math.round to 2 decimals |
| **CSV injection in 7 export functions** | **FIXED** — all 7 `esc()` functions updated |

### Frontend Audit (60 findings examined)
Audited: all pages, components, utils, context.

| Finding | Verdict |
|---------|---------|
| #1-4 Error handling on API calls | **ACCEPTABLE** — generic catch exists on all |
| #5 Invoice delete permission | **ALREADY FIXED** — Phase G added `can()` |
| #6 InvoiceView dark mode | **ALREADY FIXED** — global `.dark .bg-white` override |
| #7 ThemeToggle hover state | **ACCEPTABLE** — inherits from global text override |
| #8 StageChecklist permissions | **ACCEPTABLE** — parent page has route guard |
| #9 WorkOrderForm fabric validation | **ACCEPTABLE** — backend validates |
| #10 Invoice edit permission | **ALREADY FIXED** — Phase G |
| #11 ConfirmModal dark mode | **ALREADY FIXED** — global `.dark .bg-white` override |
| **#41 Customers edit no guard** | **FIXED** — added `can('customers','edit')` |
| **#42 Accessories delete no guard** | **FIXED** — added `can('accessories','edit/delete')` |
| **#43 Machines edit/status no guard** | **FIXED** — added `can('machines','edit')` |
| **Fabrics edit/delete no guard** | **FIXED** — added `can('fabrics','edit/delete')` |
| **Suppliers edit no guard** | **FIXED** — added `can('suppliers','edit')` |

---

## Fixes Applied

| # | Severity | File(s) | Fix |
|---|----------|---------|-----|
| 1 | HIGH | 7 backend route files | CSV injection: `esc()` now prefixes `=+\-@\t\r` values with `'` |
| 2 | HIGH | invoices.js (POST + PUT) | Tax/total rounded to 2 decimals with `Math.round` |
| 3 | MEDIUM | returns.js (sales + purchase POST) | Reject quantity ≤ 0 and price < 0 |
| 4 | HIGH | Accessories.jsx | Edit/delete/stock-adjust guarded by `can()` |
| 5 | HIGH | Customers.jsx | Edit button guarded by `can('customers','edit')` |
| 6 | HIGH | Machines.jsx | Edit/toggle-status guarded by `can('machines','edit')` |
| 7 | HIGH | Fabrics.jsx | Edit/delete guarded by `can('fabrics','edit/delete')` |
| 8 | HIGH | Suppliers.jsx | Edit guarded by `can('suppliers','edit')` |

**Total: 8 real fixes across 15 files**

---

## Build Artifacts

- Frontend: Vite build — 2553 modules, 105 KB CSS, 1.7 MB JS
- Electron: `WK-Hub Setup 2.0.0.exe` (103.6 MB NSIS installer)
- Electron: `WK-Hub 2.0.0.exe` (103.4 MB portable)
- Tests: 58/58 pass

## DB-Safe Update Verification

| Check | Status |
|-------|--------|
| DB in `%APPDATA%/wk-hub/` not install dir | ✅ |
| Uploads in `%APPDATA%/wk-hub/uploads/` | ✅ |
| *.db excluded from build | ✅ |
| Pre-migration backup on startup | ✅ |
| All ALTER TABLE idempotent (try/catch) | ✅ |
| NSIS non-destructive update | ✅ |
| Fresh install creates DB + runs migrations | ✅ |
| Update over existing preserves all data | ✅ |
