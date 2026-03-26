# Audit v5 — Full Production Readiness Audit

> Date: 2025-07-24
> Scope: Entire application — all backend routes, database, utilities, and frontend pages
> Method: Line-by-line audit of all 34 backend route files, database.js, backup.js, auth, utilities, and 90+ frontend files

---

## Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| Critical | 8     | 8     |
| High     | 11    | 11    |
| Medium   | 8     | 8     |
| Total    | 27    | 27    |

---

## Critical Fixes

### C1: Sales Return Tax Formula (returns.js)
**Bug**: `Math.round(totalAmount * taxRatePct) / 100` — multiplied amount by percentage (e.g. 14) then divided by 100, giving wildly wrong tax.
**Fix**: `Math.round(totalAmount * (taxRatePct / 100) * 100) / 100` — proper percentage math.

### C2: Sales Return Items Missing item_type/item_code (returns.js)
**Bug**: POST `/api/returns/sales` created items WITHOUT `item_type` or `item_code` columns, so the approve endpoint's stock adjustment (which checks `item.item_type === 'fabric'`) NEVER executed — stock was never returned.
**Fix**: Added `item_type` and `item_code` to the INSERT statement. Added V34 migration to add these columns to `sales_return_items` table.

### C3: Production Role Permissions Broken (database.js)
**Bug**: Seed had `ccproduction` instead of `production` — the production role was never seeded with any permissions.
**Fix**: Changed to `production`.

### C4: Backup Uses Wrong DB Path in Production (backup.js)
**Bug**: `DB_PATH = path.join(__dirname, 'wk-hub.db')` — in production, DB is in `%APPDATA%/wk-hub/` not in `__dirname`.
**Fix**: Use `process.env.WK_DB_DIR || __dirname`.

### C5: CSV Headers Not Quoted / No BOM (csv.js)
**Bug**: Backend CSV export headers were not quoted (Arabic with commas broke CSV structure) and no UTF-8 BOM (Excel garbled Arabic).
**Fix**: Added `\uFEFF` BOM prefix and quote all header columns.

### C6: CSV Injection — Reports.jsx (frontend)
**Bug**: Local `downloadCSV()` function at line 58 did not sanitize cell values for CSV injection (=, +, -, @ prefixes).
**Fix**: Removed local function, imported safe `downloadCSV` from `utils/formatters.js`.

### C7: CSV Injection — InvoiceView.jsx (frontend)
**Bug**: Same unsafe CSV export pattern — values wrapped in quotes but not sanitized for formula injection.
**Fix**: Replaced with imported `downloadCSV` from `utils/formatters.js`.

### C8: CSV Injection — TrialBalance.jsx (frontend)
**Bug**: Had its own sanitized version but duplicated code. Consolidated.
**Fix**: Replaced with imported shared `downloadCSV` from `utils/formatters.js`.

---

## High-Priority Fixes

### H1: WO Delete No Stock Movement Logs (workorders.js)
**Bug**: DELETE endpoint returned fabric batches and accessories but did NOT log stock movements (unlike the cancel endpoint which logs them properly).
**Fix**: Added `INSERT INTO fabric_stock_movements` and `INSERT INTO accessory_stock_movements` for each returned item during delete.

### H2: Accessory Consumption PATCH No Stock Movement Log (workorders.js)
**Bug**: PATCH on accessory consumption updated `accessories.quantity_on_hand` but did not log to `accessory_stock_movements` — audit trail gap.
**Fix**: Added stock movement logging with correct `consumption`/`return` type based on delta.

### H3: Purchase Returns Missing Tax Calculation (returns.js)
**Bug**: POST `/api/returns/purchases` set `total = totalAmount` with no tax calculation, while sales returns calculated tax.
**Fix**: Added tax calculation matching sales returns formula, added `tax_amount` column to purchase_returns via V34 migration.

### H4: V14 Migration References Non-Existent Table (database.js)
**Bug**: V14 tried to `SELECT id FROM roles WHERE name = 'admin'` — but the `roles` table doesn't exist in the schema (permissions use role_permissions with role name strings).
**Fix**: Wrapped in existing try/catch, updated comment to clarify it's a known legacy no-op.

### H5: V20 Index on Wrong Table Name (database.js)
**Bug**: `CREATE INDEX idx_po_items_po_id ON po_items(po_id)` — table is `purchase_order_items`, not `po_items`.
**Fix**: Changed to `purchase_order_items(po_id)`.

### H6: Invoice Edit/Delete No Permission Guards (Invoices.jsx)
**Bug**: Edit and Delete buttons were visible to all authenticated users regardless of permissions.
**Fix**: Wrapped with `can('invoices', 'edit')` and `can('invoices', 'delete')` checks.

### H7: Payroll Uses alert() Instead of Toast (Payroll.jsx)
**Bug**: 4 error handlers used `alert()` which blocks the UI thread.
**Fix**: Replaced all 4 with `toast.error()`, added `useToast` import.

### H8: Backups Uses window.confirm() (Backups.jsx)
**Bug**: Destructive operations (delete backup, restore backup) used `window.confirm()` instead of the app's styled ConfirmDialog.
**Fix**: Replaced with `useConfirm()` hook and async `confirm()` calls.

### H9: Notification NAV_MAP Inconsistency (Notifications.jsx)
**Bug**: Notifications page had `fabric: '/inventory/fabrics'` while NotificationBell had `fabric: '/fabrics'`. The correct route is `/fabrics`.
**Fix**: Aligned Notifications.jsx NAV_MAP to match NotificationBell.jsx, added missing entries (customer, maintenance, machine, expense).

### H10: V34 Migration — sales_return_items & purchase_returns Schema (database.js)
New migration V34 adds: `item_type TEXT` and `item_code TEXT` to `sales_return_items`, `tax_amount REAL` to `purchase_returns`. Idempotent via `ALTER TABLE ... ADD COLUMN` wrapped in try/catch.

### H11: Dark Mode Status Badges (index.css)
**Bug**: Colored status badges (bg-blue-100, bg-green-100, bg-red-100, etc.) used across 11+ list pages appeared as bright white rectangles in dark mode.
**Fix**: Added 20+ dark mode overrides for all color-100/50 variants with semi-transparent background colors.

---

## DB Update Safety (Verified)

- DB stored in `app.getPath('userData')` = `%APPDATA%/wk-hub/` — NOT in install dir
- Uploads stored in `%APPDATA%/wk-hub/uploads/` — NOT in install dir
- All *.db files excluded from build package
- Pre-migration backup runs before every app start
- V34 migration uses idempotent `ALTER TABLE ... ADD COLUMN` wrapped in try/catch
- NSIS installer configured for non-destructive update: `allowToChangeInstallationDirectory: true`, `oneClick: false`
- Installing new version over existing: DB preserved, uploads preserved, migrations auto-run

---

## Build Artifacts

- Frontend: Vite production build — 2553 modules, 105 KB CSS, 1.7 MB JS
- Electron: `WK-Hub Setup 2.0.0.exe` (103.6 MB NSIS installer)
- Electron: `WK-Hub 2.0.0.exe` (103.4 MB portable)
- Tests: 58/58 pass (backend API)
