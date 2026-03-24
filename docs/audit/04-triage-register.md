# Phase 4 — Triage Register

## Critical (P0) — Must fix before release

| ID | Title | Severity | Confidence | Files | Status |
|---|---|---|---|---|---|
| T-001 | Auto-journal invoice tax ignores discount | Critical | High | autojournal.js:76 | ✅ FIXED (R8) |
| T-002 | MRP double-counts already-received PO items | Critical | High | mrp.js:101 | ✅ FIXED (R8) |
| T-003 | PO total not recalculated on tax/discount-only change | Critical | High | purchaseorders.js:152 | ✅ FIXED (R8) |
| T-004 | Discount > subtotal creates negative invoices/POs | Critical | High | invoices.js, purchaseorders.js | ✅ FIXED (R8) |
| T-005 | `xlsx` library has 2 HIGH CVEs (Prototype Pollution + ReDoS) | Critical | High | package.json | ⚠️ DEFERRED — no drop-in fix, needs exceljs migration |

## High (P1) — Fix before release or immediately after

| ID | Title | Severity | Confidence | Files | Status |
|---|---|---|---|---|---|
| T-006 | Setup endpoint leaks err.message | High | High | server.js:155 | ✅ FIXED (R8) |
| T-007 | Dashboard/search endpoints leak err.message | High | High | server.js:331,358 | ✅ FIXED (R8) |
| T-008 | Global error handler leaks err.message in non-prod | High | High | server.js:377 | ✅ FIXED (R8) |
| T-009 | Backup error leaks err.message | High | High | backups.js:42 | ✅ FIXED (R8) |
| T-010 | JWT embeds role — stale after role change (24h) | High | High | middleware/auth.js | DEFERRED — needs token refresh or DB check |
| T-011 | Multer: no file size limit on upload routes | High | Medium | server.js, routes with multer | DEFERRED |
| T-012 | Payroll overtime hours not multiplied by rate | High | Medium | hr.js | NEEDS PRODUCT CONFIRMATION |
| T-013 | No attendance max hours validation | High | Medium | hr.js:316 | DEFERRED |

## Medium (P2)

| ID | Title | Severity | Confidence | Files | Status |
|---|---|---|---|---|---|
| T-014 | `fmtNum` loses decimal precision | Medium | High | formatters.js:3 | ✅ FIXED (R8) — was unused |
| T-015 | Reports AVG(cost_per_piece) is arithmetic not weighted | Medium | Medium | reports.js:23 | NEEDS PRODUCT CONFIRMATION |
| T-016 | Dead code: validators.js (2 files) | Medium | High | backend/validators.js, utils/validators.js | DEFERRED |
| T-017 | Duplicate charting libraries (chart.js + recharts) | Medium | High | frontend/package.json | DEFERRED |
| T-018 | Frontend 33+ empty catch blocks | Medium | High | frontend/src/ | DEFERRED |
| T-019 | notifications.js notification endpoints have no permission check | Medium | Low | notifications.js | OK — user-scoped (own data only) |
| T-020 | CORS allows wildcard origin (*) if configured | Medium | Medium | server.js | OK — only if explicit config |

## Low (P3)

| ID | Title | Severity | Confidence | Files | Status |
|---|---|---|---|---|---|
| T-021 | No request timeout configuration | Low | Medium | server.js | DEFERRED |
| T-022 | No graceful shutdown handler | Low | Medium | server.js | DEFERRED |
| T-023 | Settings wholesale_discount_pct stored as string | Low | Low | workorders.js | OK — parseFloat handles it |
| T-024 | PO over-receipt threshold (110%) is hard-coded | Low | Low | purchaseorders.js | DEFERRED |
| T-025 | Auto-journal debit-credit tolerance (0.01) is hard-coded | Low | Low | autojournal.js:40 | OK — appropriate for currency |
