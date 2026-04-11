# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Added — Session 5 Overhaul (2026-04-12)
- **Returns Page**: Search input, status filter dropdown, CSV export button for both sales and purchase returns tabs
- **Shipping Page**: CSV export button with shipment details (number, type, customer, carrier, tracking, status)
- **Samples Page**: CSV export button with sample details (number, customer, product, quantity, status, deadline)
- **SalesOrders Page**: Search by order number/customer (added in previous session, continued here)
- **WorkOrders Filters**: Priority, date range (from/to), and customer dropdown filters on list page
- **SupplierDetail Enhancement**: Major expansion from 2 to 5 tabs (overview, orders, payments, ledger, notes)
- **ChartOfAccounts**: Search bar, tree view with parent-child indentation, collapse/expand on parent nodes
- **JournalEntries**: Date range filter (from/to), CSV export button
- **Settings**: Security tab (JWT expiry, login attempts, lockout, password min length, complexity) and Notifications tab (stock alerts, overdue reminders, WO/maintenance/leave/payroll notifications)

### Fixed — Money.js Centralization (2026-04-12)
- **Centralized money rounding**: Replaced ~65 raw `Math.round(…*100)/100` patterns across 6 backend route files with `round2()` from `utils/money.js`
- **Safe arithmetic**: Replaced raw `+`/`-` on money values with `safeAdd()`/`safeSubtract()` in accounting.js, customers.js, reports.js, inventory.js
- **Files migrated**: accounting.js (19→0), reports.js (21→0), customers.js (10→0), hr.js (11→0), inventory.js (3→0), documents.js (1→0)

### Added — Comprehensive ERP Overhaul (2026-04-11)
- **Financial Statements**: Income Statement, Balance Sheet, Cash Flow Statement — full frontend pages with KPI cards, date filtering, and Excel export
- **Cash Flow Backend**: `GET /api/accounting/cash-flow` endpoint — indirect method with operating, investing, and financing activity sections
- **Work Orders Pagination**: Full server-side pagination with numbered page controls (50 per page)
- **Work Order QC Tab**: New quality control tab with acceptance rate cards, per-stage QC table, and rejection log
- **Purchase Order Payments**: Inline payment column, payment modal with amount/method/reference/notes, calls `POST /:id/payments`
- **Export Buttons**: Added to SalesOrders and Quotations pages (using enterprise exportExcel utility)
- **Chart of Accounts Expansion**: Seed CoA expanded from 8 to 21 accounts (cash, bank, prepaid, equipment, vehicles, deferred revenue, VAT payable, equity, retained earnings, service revenue, salary/rent/maintenance expenses)
- **Operating Expense JEs**: 10 monthly expense journal entries (rent ×3, salaries ×3, maintenance ×1, admin ×3) plus capital injection JE (500,000 EGP)
- **Enterprise Excel Export**: Rewritten `exportExcel.js` — dark blue headers, gold font, auto-width columns, alternating row colors, freeze panes, auto-filter
- **Export Translations**: New `exportTranslations.js` — 150+ Arabic column translations, status/priority mappings
- **Sidebar Links**: Added Income Statement (قائمة الدخل), Balance Sheet (الميزانية العمومية), Cash Flow (التدفقات النقدية) under accounting section

### Fixed — Comprehensive ERP Overhaul (2026-04-11)
- **Auth logging**: `console.log` → `console.warn` for JWT secret generation (auth.js line 16)
- **Seed JE references**: Fixed journal entry account codes to use correct CoA codes (inventory accounts for POs, AR+Revenue for invoices, Cash+AR for payments)

### Added — V59 Security & Production Hardening (2026-04-10)
- **Export RBAC**: 13 export permission definitions with granular per-module control (10 sub-modules), row bounding (EXPORT_MAX_ROWS), date filter defaults
- **Delete RBAC**: 16 delete permission definitions with role-based assignments
- **SSRF Protection**: `validateWebhookUrl()` with DNS resolution and private IP blocking (9 pattern categories)
- **Data Integrity**: `PRAGMA quick_check` at startup; backup integrity verification after copy
- **Server Timeouts**: Express 30s socket timeout, keepAlive 65s; Nginx proxy timeouts on API (30s) and WebSocket (300s)
- **Structured Logging**: `console.error/warn` routed through Winston in production
- **Observability**: Webhook log cleanup (30-day retention), WebSocket per-client message rate limiting (30/min), Docker resource limits
- **V59 Security Tests**: 31 new tests for SSRF, bcrypt 2FA, export/delete permissions, backup integrity, cleanup

### Fixed
- **2FA Backup Codes**: Now hashed with bcrypt (was stored plaintext)
- **WebSocket Auth**: Removed dev/test plaintext userId fallback — all connections require JWT
- **Silent Catch Blocks**: Fixed 25+ `.catch(() => {})` across frontend pages with error logging
- **ErrorBoundary**: Stack traces no longer leaked in production console
- **PO Totals**: Replaced JS `.reduce()` with SQL `GROUP BY` aggregation
- **getFullWO**: Cached prepared statements, consolidated 3 SUM queries → 1
- **API Error Logging**: Centralized error logging in axios response interceptor

### Added
- **Dependency-aware deactivation**: DELETE endpoints for fabrics, accessories, customers, suppliers, models, HR, and stage templates now check for active work orders, open POs, and pending invoices before deactivating; return 409 with `blocking_count` on conflict
- **Frontend deactivation UX**: Fabrics, Accessories, and Models pages updated to use "تعطيل" (deactivate) wording and handle 409 dependency errors with user-friendly messages
- **Comprehensive seed data**: New `seed.js` with 4 users, 8 suppliers, 12 fabrics, 15 accessories, 6 customers, 6 models with BOM, 12 POs, 18 WOs, 10 invoices, 26 journal entries, 22 QC checks, 384 attendance records, 36 expenses, and audit log
- **E2E test rewrite**: 16 test phases (A–P) covering auth, dashboard, all entity pages, API smoke tests, and unauthenticated request rejection
- **CSV formula injection protection**: `escCSV` in exports.js now prefixes values starting with `=`, `+`, `-`, `@`, or tab with `'` to prevent formula injection in Excel

### Fixed
- PO-2026-012 seed failure: `status: 'ordered'` changed to `status: 'sent'` to match `purchase_orders` CHECK constraint
- HR delete handler referenced `work_order_stages` instead of `wo_stages` table
- `journal_entry_lines` seed used wrong column names (`journal_entry_id`/`account_code` → `entry_id`/`account_id`)

### Security
- Avatar upload route now has explicit `requireRole` middleware for defense-in-depth (was already protected by global `requireAuth`)
- Gitignore hardened: added `playwright-report/`, `e2e-screenshots/`, `*.mp4`
- Playwright viewport reduced from 1440 to 1280px

## [3.4.0] — 2026-03-31

### Added
- **CSRF protection**: Double-submit cookie pattern (`wk_csrf`) for all state-changing requests
- **Content-Type enforcement**: Returns 415 on non-JSON POST/PUT/PATCH (exempts uploads)
- **Two-Factor Authentication**: TOTP-based 2FA with QR codes and backup codes (`/api/auth/2fa/setup`, `/verify`, `/disable`)
- **Password reset flow**: `POST /forgot-password` + `POST /reset-password` with token-based reset
- **WebSocket security**: 5-second auth timeout, IP-based connection rate limiting (10/min)
- **Per-key API rate limiting**: Sliding window rate limiter per API key with configurable limits
- **Soft delete columns**: `is_deleted`/`deleted_at`/`deleted_by` on 10 core tables (migration v39)
- **User invitations**: Token-based invitation system (`POST /invite`, `GET /invitations`, `DELETE /invitations/:id`)
- **Session management**: List and revoke active sessions (`GET /api/sessions`, `DELETE /api/sessions/:id`)
- **Audit log CSV export**: `GET /api/audit-log/export` with UTF-8 BOM support
- **Data retention policies**: Configurable retention for audit logs, notifications, expired tokens
- **Data retention cleanup**: Automatic daily cleanup scheduler for old records
- **License tier enforcement**: `licenseGuard.js` middleware — `requireFeature()`, `requireTier()`, `requireUserLimit()`
- **License banner**: Frontend trial/expiry warning component (`LicenseBanner.jsx`)
- **Webhook exponential backoff**: 3 retries with delays 1s/2s/4s via `deliverWithRetry()`
- **Docker support**: Multi-stage Dockerfile (node:22-alpine) + docker-compose.yml
- **Monetary safety**: Fixed `safeAdd()` double-piasters bug; wired `money.js` into invoices, quotations, purchase orders, exports
- 13 new test cases — financial lifecycle, WO lifecycle, rounding, license guard, quotations, PO validation, cleanup

### Fixed
- `safeAdd()` bug causing double-conversion of accumulated piasters in reduce callbacks
- Password reset returning 500 (SQLite `datetime("now")` quoting error)
- Local `round2()` redefinitions replaced with centralized `money.js` import
- User invitation routes placed before `/:id` to prevent Express route conflict
- Session SQL updated to use `revoked` column (not `revoked_at`)
- Frontend `LicenseBanner.jsx` import path corrected

### Security
- All new endpoints require authentication and permission checks
- CSRF tokens cleared on logout
- Password reset tokens are single-use with 1-hour expiry
- WebSocket connections closed with 1008 on auth timeout

## [3.3.0] — 2026-03-30

### Added
- Webhook integration: create, list, delete, and deliver webhooks with event filtering
- Webhook event logging with delivery status tracking
- `fireWebhook()` calls on invoice, work order, purchase order lifecycle events

## [3.2.0] — 2026-03-30

### Added
- 6 enterprise hardening phases: structured logging, rate limiting, API keys, Swagger docs, Sentry integration, monitoring endpoint
- API versioning (`/api/v1` mirror)
- Request ID tracing and input sanitization middleware
- Graceful shutdown handler
- Auto-backup scheduler (configurable interval)

## [3.1.0] — 2026-03-29

### Added
- RBAC system with 6 roles and granular permissions
- Account lockout after 5 failed login attempts
- Strong password policy enforcement
- Input validation hardening across all financial endpoints
- Test suite: 93 API tests

## [3.0.0] — 2026-03-28

### Added
- Real-time SSE/WebSocket notifications
- Production Gantt chart
- Financial statements (income statement, balance sheet, cash flow, AR/AP aging)
- Multi-location inventory with stock transfers
- MRP (Material Requirements Planning)
- Quality control module
- Machine maintenance tracking
- HR & payroll system
- Barcode generation
- Document management
- Bulk import/export center
