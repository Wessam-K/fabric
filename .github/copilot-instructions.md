# Fabric ERP — Copilot Instructions

## Project Overview
WK-Factory is a full-stack garment/textile factory ERP: Electron 41 + React 19 + Vite 6 + Express 4 + SQLite (better-sqlite3, WAL mode).

## Node.js Environment
- **Required**: Node 22 (v22.16.0). Bundled at `node22/node-v22.16.0-win-x64/`.
- System Node may be v24 which causes `NODE_MODULE_VERSION` mismatch with better-sqlite3.
- Always set PATH: `$env:PATH = "C:\msn3\node22\node-v22.16.0-win-x64;$env:PATH"` before running backend commands.

## Key Paths
- Backend: `fabric/backend/` — Express server, routes, middleware, database
- Frontend: `fabric/frontend/` — React SPA (Vite)
- E2E tests: `fabric/e2e/screenshots.spec.js` — Playwright tests
- Database: `fabric/backend/wk-hub.db` — SQLite
- Schema: `fabric/backend/database.js` (~3000 lines, `initializeDatabase()` auto-called on require)

## Database Conventions
- Table names: `wo_stages` (not work_order_stages), `purchase_order_items`, `wo_accessories_detail`, `fabric_inventory_batches`, `wo_stage_qc`, `journal_entry_lines`
- `journal_entry_lines` columns: `entry_id` (not journal_entry_id), `account_id` (not account_code)
- Work order statuses: `draft|pending|in_progress|completed|cancelled` — no `paused`
- PO statuses: `draft|sent|partial|received|cancelled` — no `ordered`
- Chart of accounts codes: 1000=cash, 1100=bank, 1200=AR, 1300=inventory-fabric, 2000/2100=AP, 4000=revenue
- All DELETE routes use soft-deactivate (`status='inactive'`) with dependency checks, returning 409 + `blocking_count` on conflict

## Coding Standards
- SQL: Always use parameterized `db.prepare(...)` with `?` placeholders. Never concatenate user input into SQL strings.
- Money: Use `round2()` and `safeSubtract()` from `utils/money.js` for all financial calculations.
- CSV exports: Use `escCSV()` with formula injection protection (prefix `=+\-@\t` with `'`). Always include UTF-8 BOM.
- Auth: All API routes are behind `requireAuth` via `app.use('/api', requireAuth, apiRouter)`. Individual routes add `requireRole()` or `requirePermission()` for fine-grained access.
- Error responses: Return Arabic error messages. Never leak stack traces. Use `{ error: 'حدث خطأ داخلي' }` for 500s.

## Seed Data
- Login: `admin/123456` (superadmin), `wessam/123456`, `manager/123456`, `viewer/123456`
- Run seed: `cd fabric/backend && node seed.js`
- 12 fabrics (FAB-001–012), 15 accessories (ACC-001–015), 8 suppliers (SUP-001–008), 6 customers (CUS-001–006), 6 models (MOD-001–006), 18 WOs, 12 POs, 10 invoices

## Testing
- Backend tests: `cd fabric/backend && npx playwright test` (uses `fabric/playwright.config.js`)
- E2E: Start server on port 9173, then run `npx playwright test` from `fabric/`
- Viewport: 1280×900 (stay under 2000px)

## Security Checklist
- Helmet.js with CSP, HSTS, frame-ancestors:none
- CORS whitelist, CSRF double-submit cookies
- Rate limiting: 200 req/min global, 10/15min on auth endpoints
- File uploads: Extension whitelist + magic byte validation + 10MB limit
- JWT: Auto-generated 64-byte secret saved to `.jwt_secret` with mode 0o600

## Further Reference
- `AGENT_PROMPT.md` — Comprehensive AI agent prompt with full database conventions, gotchas, and modification guides
- `ARCHITECTURE.md` (v8) — System architecture with 94-table schema map, 250+ endpoints, dependency audit
- `CHANGELOG.md` — Release changelog with [Unreleased] section
- `docs/` — Audit reports, improvement roadmap, issue triage, developer guide
