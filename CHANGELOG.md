# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

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
