# Production Audit v4 — Full System Review

> Date: 2026-03-26  
> Scope: All backend routes, all frontend pages/components, Electron build, DB safety  
> Test results: 58/58 API tests passing  
> Build output: `WK-Hub Setup 2.0.0.exe` (103.6 MB) + `WK-Hub 2.0.0.exe` (103.4 MB)

---

## Issues Found & Fixed (Phase F)

### CRITICAL — Fixed
| # | Issue | File | Fix |
|---|-------|------|-----|
| C1 | Auto-journal `journal_entry_id` column mismatch | autojournal.js | Changed to `entry_id` |
| C2 | Leave approval used `hr:view` permission | hr.js | Changed to `hr:edit` |
| C3 | Invoice view navigated to wrong route | Invoices.jsx | `/invoices/${id}` → `/invoices/${id}/view` |
| C4 | Tax calculated before discount (frontend) | Invoices.jsx, PurchaseOrders.jsx | Tax on `(subtotal-discount)` |
| C5 | `btn-secondary` CSS class missing | index.css | Added definition |
| C6 | Permission module name `workorders` mismatch | WorkOrdersList.jsx | Changed to `work_orders` |
| C7 | Permission module name `purchaseorders` mismatch | PurchaseOrders.jsx | Changed to `purchase_orders` |
| C8 | Returns approve didn't adjust stock | returns.js | Added inventory adjustment |
| C9 | Tailwind v4 `dark:` variant not working | index.css | Added `@custom-variant dark` |
| C10 | Uploads in install dir (lost on update) | server.js, models.js, documents.js, expenses.js | Redirect to `WK_DB_DIR` |

### HIGH — Fixed
| # | Issue | File | Fix |
|---|-------|------|-----|
| H1 | Leave date range no maximum (DoS) | hr.js | Max 90 days |
| H2 | 400+ dark mode gaps across 46 files | index.css | Global CSS overrides |
| H3 | Missing keyframe animations | index.css | Added slideIn, fadeIn, etc. |
| H4 | Missing breadcrumb Arabic labels | Breadcrumbs.jsx | Added 15+ labels |
| H5 | Breadcrumb active item invisible in dark | Breadcrumbs.jsx | Added dark:text-white |
| H6 | No NSIS installer built | package.json | Added nsis target |
| H7 | NotificationBell Arabic typo | NotificationBell.jsx | كمقروع → كمقروء |

### Known Issues — Deferred (non-blocking)
| # | Issue | Severity | Reason |
|---|-------|----------|--------|
| D1 | JWT 24h expiry, no revocation | Medium | Requires token blacklist infrastructure |
| D2 | No rate limiting beyond login | Medium | Acceptable for desktop app |
| D3 | Dashboard exposes financial data to all users | Low | Desktop app, trusted users |
| D4 | Global search bypasses module permissions | Low | Desktop app, same-network |
| D5 | No code signing | Low | Requires certificate purchase |
| D6 | Reports.jsx downloadCSV no formula escaping | Low | Local use only |
| D7 | Number inputs accept negative via typing | Low | Backend validates |
| D8 | Silent .catch(() => {}) in 20+ API calls | Low | Non-critical UX issue |

---

## DB Update Safety Verification

| Check | Status |
|-------|--------|
| DB stored in `%APPDATA%/wk-hub/` | ✅ |
| DB files excluded from build | ✅ |
| Uploads stored in `%APPDATA%/wk-hub/uploads/` | ✅ (fixed in F4) |
| Pre-migration backup on every start | ✅ |
| Schema version tracking (V4-V33) | ✅ |
| `addColumnSafe()` for all ALTER TABLE | ✅ |
| `CREATE TABLE IF NOT EXISTS` for all tables | ✅ |
| Backup rotation (last 10 kept) | ✅ |
| NSIS installer preserves userData | ✅ |

---

## Electron Security Verification

| Check | Status |
|-------|--------|
| `nodeIntegration: false` | ✅ |
| `contextIsolation: true` | ✅ |
| `sandbox: true` | ✅ |
| IPC channel whitelisting | ✅ |
| Production CSP (no unsafe-inline/eval) | ✅ |
| DevTools blocked in production | ✅ |
| Single instance lock | ✅ |
| Remote module blocked | ✅ |
| URL navigation restricted | ✅ |

---

## Build Artifacts

```
dist-electron/
├── WK-Hub Setup 2.0.0.exe    (103.6 MB) — NSIS installer
├── WK-Hub 2.0.0.exe          (103.4 MB) — Portable exe
├── win-unpacked/              — Unpacked directory
└── builder-effective-config.yaml
```
