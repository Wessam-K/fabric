# 06 — Change Log

> Phase 5 deliverable — all code changes documented  
> Baseline commit: `19ddc8b`

---

## Phase M — Production Audit v11 — Invoice Pricing, DELETE Reversal & Validation Hardening (2026-03-27)

### M1: Backend CRITICAL — WO DELETE Missing V8 Consumption Reversal
- **workorders.js DELETE**: Now reverses all `wo_fabric_consumption` records (restoring batch used_meters, aggregate available_meters) and all `wo_accessory_consumption` records (returning stock) — previously only reversed batch allocations, leaving V8 consumption orphaned

### M2: Backend CRITICAL — WO Partial Invoice Price Validation
- **workorders.js POST /partial-invoice**: Added validation that `invoice_price_per_piece > 0` — prevents creating invoices with zero/negative pricing

### M3: Backend CRITICAL — WO Create Invoice Price Validation
- **workorders.js POST /create-invoice**: Added `price <= 0` guard on `unit_price` — blocks invoice creation with zero/negative unit price

### M4: Backend HIGH — Customer Payment on Cancelled/Paid Invoice
- **customers.js POST /:id/payments**: Added status check blocking payments on `cancelled` or already-`paid` invoices — prevents corrupting invoice payment state

### M5: Backend MEDIUM — Expenses PUT Missing Type Validation
- **expenses.js PUT**: Added `expense_type` enum validation matching POST endpoint — prevents saving invalid expense types that break filtering/reports. Also added `amount > 0` check.

### M6: Frontend MEDIUM — Quotations Item & Customer Validation
- **Quotations.jsx**: `save()` now requires customer selection and validates all items have description + quantity > 0

### M7: Frontend MEDIUM — Shipping Item Quantity Validation
- **Shipping.jsx**: `save()` now validates all items have quantity > 0 before submitting

### M8: Frontend MEDIUM — Samples Quantity Min Attribute
- **Samples.jsx**: Added `min="1"` to quantity input field

### M9: DB Preservation on Update (Verified)
- DB stored in `%APPDATA%\wk-hub\` — separate from install directory
- NSIS installer excludes `*.db` from package — cannot overwrite user data
- Pre-migration backup runs automatically on app start
- Schema migrations are versioned and additive (safe ALTER TABLE ADD COLUMN)
- Users can safely install new setup.exe over existing installation

### M10: Build
- All 58 API tests pass (0 failures)
- Frontend: Vite production build (2553 modules, 105 KB CSS + 1.7 MB JS)
- Electron: `WK-Hub Setup 2.0.0.exe` + `WK-Hub 2.0.0.exe`

---

## Phase L — Production Audit v10 — Batch Reservation & Stage Flow Hardening (2026-03-27)

### L1: Backend CRITICAL — WO Creation Fabric Batch Reservation
- **workorders.js POST**: After inserting `wo_fabric_batches`, now updates `fabric_inventory_batches.used_meters` and decrements `fabrics.available_meters` — prevents double-allocation where multiple WOs could claim the same batch meters

### L2: Backend HIGH — WO PUT Fabric Batch Reversal + Validation
- **workorders.js PUT**: When `fabric_batches` array is updated, old allocations are now reversed (restoring used_meters and available_meters) before deleting and re-inserting new batches — includes availability validation matching POST logic

### L3: Backend HIGH — WO Quantity Zero Blocked
- **workorders.js POST + PUT**: Changed validation from `quantity < 0` to `quantity <= 0` — prevents creating WOs with 0 pieces which caused divide-by-zero in costing

### L4: Backend HIGH — Stage Status Transition Validation
- **workorders.js PATCH stages/:stageId**: Added `validStageTransitions` map enforcing: pending→in_progress/skipped, in_progress→completed/skipped, completed→none, skipped→none — prevents backward transitions and illogical state changes

### L5: Backend LOW — HR Attendance Clock Permission
- **hr.js**: `POST /api/hr/attendance/clock` changed from `requirePermission('hr', 'view')` to `requirePermission('hr', 'edit')` — POST (create) action shouldn't work with view-only permission

### L6: Frontend HIGH — Quotations Search Broken
- **Quotations.jsx**: Added `search` to `useEffect` dependency array — search was in API params but changes to it didn't trigger data reload

### L7: Frontend MEDIUM — Expenses Amount Validation
- **Expenses.jsx**: `handleSave()` now validates `amount > 0` — prevents saving expenses with zero amount

### L8: Build
- All 58 API tests pass (0 failures)
- Frontend: Vite production build (2553 modules, 105 KB CSS + 1.7 MB JS)
- Electron: `WK-Hub Setup 2.0.0.exe` + `WK-Hub 2.0.0.exe`

---

## Phase K — Production Audit v9 — Inventory Integrity & Validation Hardening (2025-07-24)

### K1: Backend CRITICAL — WO PUT Allows Editing Completed/Cancelled WOs
- **workorders.js**: Added status guard on `PUT /api/work-orders/:id` — now returns 400 if WO status is `completed`, `cancelled`, or `delivered`, preventing accidental edits to finalized work orders

### K2: Backend HIGH — V8 Fabric Consumption Missing Aggregate Update (3 endpoints)
- **workorders.js POST** `/fabric-consumption`: After updating `fabric_inventory_batches.used_meters`, now also decrements `fabrics.available_meters` — keeps real-time inventory display in sync
- **workorders.js PATCH** `/fabric-consumption/:id`: Delta change now also applied to `fabrics.available_meters`
- **workorders.js DELETE** `/fabric-consumption/:id`: Reversal now also increments `fabrics.available_meters`

### K3: Backend HIGH — WO Cancel Doesn't Reverse V8 Consumption
- **workorders.js**: Cancel endpoint now reverses all `wo_fabric_consumption` records — returns used meters to batch and aggregate, creates stock movement audit trail
- **workorders.js**: Cancel endpoint now reverses all `wo_accessory_consumption` records — returns consumed quantities to accessories, creates stock movement audit trail

### K4: Backend MEDIUM — Quotation Convert-to-SO Missing Customer Validation
- **quotations.js**: `POST /api/quotations/:id/convert-to-so` now validates `customer_id` is present before creating sales order — prevents orphaned SOs with null customer

### K5: Frontend HIGH — Expense Amount Validation
- **WorkOrderDetail.jsx**: `handleAddExpense()` now validates amount > 0 before saving — prevents zero/negative expenses

### K6: Frontend HIGH — Invoice Items Quantity/Price Validation
- **Invoices.jsx**: `handleSave()` now validates all items have quantity > 0 and non-negative price before saving

### K7: Frontend MEDIUM — Fabric/Accessory Price Validation
- **Fabrics.jsx**: `handleSave()` now validates `price_per_m > 0` — prevents zero/negative fabric prices
- **Accessories.jsx**: `handleSave()` now validates `unit_price > 0` — prevents zero/negative accessory prices

### K8: Build
- All 58 API tests pass (0 failures)
- Frontend: Vite production build (2553 modules, 105 KB CSS + 1.7 MB JS)
- Electron: `WK-Hub Setup 2.0.0.exe` + `WK-Hub 2.0.0.exe`

---

## Phase J — Production Audit v8 — Deep Line-by-Line Audit (2025-07-24)

### J1: Backend CRITICAL — Quality Defect Codes Insert Crash
- **quality.js**: Removed `name_en` from `INSERT INTO qc_defect_codes` — column does not exist in schema, causing every defect-code creation to throw a SQLite error

### J2: Backend HIGH — Invoice PUT Allows Editing Paid/Cancelled
- **invoices.js**: Added status guard on `PUT /api/invoices/:id` — now returns 400 if invoice status is `paid` or `cancelled`, preventing accidental edits to finalized invoices

### J3: Backend HIGH — PO DELETE Bypasses Status Checks
- **purchaseorders.js**: Added status check on `DELETE /api/purchase-orders/:id` — blocks cancellation of already-received or already-cancelled POs

### J4: Backend HIGH — Shipping PUT Allows Editing Delivered/Cancelled
- **shipping.js**: Added status guard on `PUT /api/shipping/:id` — returns 400 if shipment status is `delivered` or `cancelled`

### J5: Backend HIGH — Returns Approval Missing Stock Movement Records
- **returns.js**: Sales return approval (`POST /api/returns/sales/:id/approve`) now inserts `fabric_stock_movements` and `accessory_stock_movements` records with `movement_type: 'return'` for audit trail
- **returns.js**: Purchase return approval (`POST /api/returns/purchases/:id/approve`) same stock movement records added

### J6: Backend MEDIUM — Payroll Gross Pay Excludes Bonuses
- **hr.js**: `gross_pay` now calculated as `base_pay + overtime + allowances + bonuses` (previously bonuses were excluded from gross and added separately to net). `net_pay = Math.max(0, gross_pay - total_deductions)`

### J7: Frontend HIGH — PurchaseOrders Missing Permission Guards
- **PurchaseOrders.jsx**: Added `useAuth` import and `can()` guards on Send, Receive, and Cancel buttons — previously any logged-in user could trigger these actions

### J8: Frontend HIGH — HR/Payroll Missing Permission Guards
- **HR/Payroll.jsx**: Added `useAuth` import and `can('payroll','edit')` guards on Calculate, Approve, and Pay buttons

### J9: Frontend HIGH — HR/Leaves Missing Permission Guards
- **HR/Leaves.jsx**: Added `useAuth` import and `can('hr','edit')` guard on Approve and Reject buttons

### J10: Frontend MEDIUM — Quotations Send Button Unguarded
- **Quotations.jsx**: Added `can('quotations','edit')` guard on Send button in detail modal

### J11: Frontend MEDIUM — alert() Replaced with Toast (2 pages)
- **HR/Employees.jsx**: Replaced `alert()` with `toast.error()` via `useToast` hook
- **Users.jsx**: Replaced all 4 `alert()` calls with `toast.error()` via `useToast` hook

### J12: Frontend MEDIUM — window.confirm() Replaced with ConfirmDialog
- **Documents.jsx**: Replaced `window.confirm()` with styled `ConfirmDialog` component via `useConfirm` hook

### J13: Frontend MEDIUM — Form Reset After Save (3 pages)
- **Returns.jsx**: Both sales and purchase return forms now reset to initial state after successful save
- **Quality.jsx**: Inspections, Templates, and NCR forms now reset after successful save; DefectsTab `name_en` field removed from form state, save handler, and UI (matches backend fix J1)

### J14: Build
- All 58 API tests pass (0 failures)
- Frontend: Vite production build (2553 modules, 105 KB CSS + 1.7 MB JS)
- Electron: `WK-Hub Setup 2.0.0.exe` + `WK-Hub 2.0.0.exe`

---

## Phase I — Production Audit v7 — Permission & Access Control Hardening (2025-07-24)

### I1: Backend Security — Dashboard Permission Guard
- **server.js**: Dashboard endpoint (`GET /api/dashboard`) upgraded from `requireAuth` to `requirePermission('dashboard', 'view')` — blocks users without dashboard access from seeing financial summaries, revenue, payables, and production metrics

### I2: Backend Security — Global Search Permission Filtering
- **server.js**: Global search (`GET /api/search`) now respects per-module permissions via `canUser()` — each entity type (models, fabrics, accessories, invoices, suppliers, work_orders, purchase_orders, customers, machines, maintenance, expenses) only searched if the user has the corresponding `module:view` permission

### I3: Backend Security — Barcode Cross-Module Access Control
- **barcode.js**: Universal barcode lookup now checks entity-specific permissions before returning results — `machines:view`, `maintenance:view`, `fabrics:view`, `accessories:view`, `models:view`, `work_orders:view`, `suppliers:view`, `customers:view`, `invoices:view`, `purchase_orders:view`

### I4: Backend Logic — Stage Advance Reject-Only Operations
- **workorders.js**: Fixed validation to allow reject-only operations (`qty_to_pass: 0, qty_rejected: N`) — previously `!qty_to_pass` blocked zero-pass, a common need for quality inspectors rejecting entire batches

### I5: Backend Performance — Journal Entries Pagination
- **accounting.js**: `GET /api/accounting/journal` now supports pagination (`page`, `limit` params) returning `{ data, total, page, pages }` — prevents performance issues with large transaction volumes
- **JournalEntries.jsx**: Frontend updated to handle both paginated and legacy response formats

### I6: Backend Security — Export Catalog Permission
- **exports.js**: `GET /api/exports/catalog` now requires `requirePermission('reports', 'view')` — previously any authenticated user could enumerate available export types

### I7: Auth Module — Inline Permission Helper
- **middleware/auth.js**: Added `canUser(user, module, action)` utility for inline permission checking (used by search and barcode endpoints). Refactored `requirePermission` to use this shared logic. Exported as part of auth module.

### I8: Build
- All 58 API tests pass
- Frontend: Vite production build (2553 modules, 105 KB CSS + 1.7 MB JS)
- Electron: `WK-Hub Setup 2.0.0.exe` + `WK-Hub 2.0.0.exe`

---

## Phase H — Production Audit v6 — Full Line-by-Line Audit (2026-03-27)

### H1: Backend Security — CSV Injection Protection (7 files)
- **All backend CSV exports** (`invoices.js`, `accessories.js`, `customers.js`, `fabrics.js`, `purchaseorders.js`, `suppliers.js`, `workorders.js`): Fixed `esc()` function to prefix values starting with `=`, `+`, `-`, `@`, `\t`, `\r` with `'` — prevents formula injection when opened in Excel/Sheets

### H2: Backend Math — Invoice Tax Rounding
- **Invoice POST** (`invoices.js`): Added `Math.round(... * 100) / 100` to both `taxAmt` and `total` — previously floating point could produce values like `115.000000000001`
- **Invoice PUT** (`invoices.js`): Same rounding fix in both recalculation paths (items provided / only tax/discount changed)

### H3: Backend Validation — Returns Negative Quantity
- **Sales returns POST** (`returns.js`): Added validation rejecting `quantity <= 0` and `unit_price < 0` before processing
- **Purchase returns POST** (`returns.js`): Same negative quantity/price validation

### H4: Frontend Permission Guards — Edit/Delete Buttons (5 pages)
- **Accessories.jsx**: Edit, delete, and stock adjust buttons now guarded by `can('accessories', 'edit/delete')`
- **Customers.jsx**: Edit button guarded by `can('customers', 'edit')`
- **Machines.jsx**: Edit and toggle-status buttons guarded by `can('machines', 'edit')`
- **Fabrics.jsx**: Edit and delete buttons guarded by `can('fabrics', 'edit/delete')`
- **Suppliers.jsx**: Edit button guarded by `can('suppliers', 'edit')`

### H5: Build
- Frontend: Vite production build (2553 modules, 105 KB CSS + 1.7 MB JS)
- Electron: `WK-Hub Setup 2.0.0.exe` (103.6 MB), `WK-Hub 2.0.0.exe` (103.4 MB)
- Tests: 58/58 pass

### DB Update Safety (verified)
- DB in `%APPDATA%/wk-hub/` — NOT in install dir
- Uploads in `%APPDATA%/wk-hub/uploads/` — NOT in install dir
- NSIS: `oneClick: false`, `allowToChangeInstallationDirectory: true`
- Installing new version over existing: DB preserved, uploads preserved, all migrations idempotent

---

## Phase G — Production Audit v5 — Full App Audit (2025-07-24)

### G1: Critical Backend Fixes
- **Sales return tax formula** (`returns.js`): Fixed `Math.round(totalAmount * taxRatePct) / 100` → `Math.round(totalAmount * (taxRatePct / 100) * 100) / 100` — was computing entirely wrong tax amounts
- **Sales return items missing columns** (`returns.js`): POST now includes `item_type` and `item_code` in INSERT — approve stock adjustment was NEVER executing because those columns were always NULL
- **Production role seed** (`database.js`): Fixed `ccproduction` → `production` — the production role had zero permissions seeded
- **Backup DB path** (`backup.js`): Changed from `path.join(__dirname, ...)` to `process.env.WK_DB_DIR || __dirname` — was backing up wrong/stale DB in production
- **CSV header quoting + BOM** (`csv.js`): Headers now quoted for Arabic with commas, added UTF-8 BOM for Excel compatibility
- **V20 index table name** (`database.js`): Fixed `po_items` → `purchase_order_items` — index was silently failing

### G2: Critical Frontend Fixes
- **CSV injection — Reports.jsx**: Removed unsafe local `downloadCSV()`, imported safe version from `utils/formatters.js`
- **CSV injection — InvoiceView.jsx**: Same fix — replaced unsafe CSV export with shared safe utility
- **CSV injection — TrialBalance.jsx**: Replaced duplicate sanitizer with shared import
- **Invoice permissions** (`Invoices.jsx`): Edit/Delete buttons now wrapped with `can('invoices','edit/delete')` checks

### G3: High-Priority Backend Fixes
- **WO Delete stock movement logs** (`workorders.js`): DELETE endpoint now logs fabric and accessory stock movements (was silently returning inventory with no audit trail)
- **Accessory consumption PATCH logging** (`workorders.js`): Now logs to `accessory_stock_movements` when adjusting consumption quantities
- **Purchase returns tax** (`returns.js`): Added tax calculation matching sales returns
- **V14 migration cleanup** (`database.js`): Clarified non-existent `roles` table reference is a harmless no-op

### G4: Frontend UX Fixes
- **Payroll.jsx**: Replaced 4 `alert()` calls with `toast.error()` — stops UI blocking
- **Backups.jsx**: Replaced 2 `window.confirm()` with `useConfirm()` ConfirmDialog — consistent destructive action confirmations
- **Notifications.jsx NAV_MAP**: Aligned routes with NotificationBell.jsx, added missing entries (customer, maintenance, machine, expense)
- **Dark mode status badges** (`index.css`): Added 20+ color-100/50 dark overrides for blue, green, red, yellow, purple, orange, amber, indigo, emerald, teal, rose, cyan — fixes bright badges in dark mode across 11+ pages

### G5: Database Migration V34
- Added `item_type TEXT` and `item_code TEXT` columns to `sales_return_items`
- Added `tax_amount REAL` column to `purchase_returns`
- Idempotent — uses `ALTER TABLE ... ADD COLUMN` wrapped in try/catch

### G6: Build
- Frontend: Vite production build (2553 modules, 105 KB CSS + 1.7 MB JS)
- Electron: `WK-Hub Setup 2.0.0.exe` (103.6 MB), `WK-Hub 2.0.0.exe` (103.4 MB)
- Tests: 58/58 pass

---

## Phase F — Production Audit v4 + NSIS Installer (2026-03-26)

### F1: Critical Backend Fixes
- **Auto-Journal column mismatch** (`autojournal.js`): Changed `journal_entry_id` → `entry_id` matching schema — fixed entire auto-journal feature being silently broken
- **Leave approval permission** (`hr.js`): Changed from `hr:view` to `hr:edit` — prevented any viewer from approving/rejecting leaves
- **Leave date range DoS** (`hr.js`): Added 90-day maximum limit on approved leave attendance inserts
- **Returns stock adjustment** (`returns.js`): Both sales returns (add back to stock) and purchase returns (deduct from stock) now actually adjust inventory on approval — previously approve only changed status

### F2: Critical Frontend Fixes
- **Invoice navigation** (`Invoices.jsx`): Fixed route from `/invoices/${id}` → `/invoices/${id}/view` — view button was showing 404
- **Tax calculation** (`Invoices.jsx`, `PurchaseOrders.jsx`): Tax now computed on `(subtotal - discount)` instead of bare `subtotal` — was overcharging clients
- **Permission module names** (`WorkOrdersList.jsx`, `PurchaseOrders.jsx`): Fixed `workorders` → `work_orders` and `purchaseorders` → `purchase_orders` — non-admin users were blocked from legitimate actions
- **Missing `btn-secondary` CSS** (`index.css`): Added class definition — 15+ export/import buttons across the app were unstyled/invisible
- **Missing keyframe animations** (`index.css`): Added `slideIn`, `slideInRight`, `slideInLeft`, `fadeIn` — Toast, HelpButton, Fabrics drawer animations were silently failing

### F3: Dark Mode Completeness
- **Tailwind v4 dark mode** (`index.css`): Added `@custom-variant dark (&:where(.dark, .dark *))` — the `dark:` utility prefix was completely non-functional in Tailwind v4
- **Global dark utility overrides** (`index.css`): Added 50+ CSS overrides for `bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*`, `shadow-*`, hover states, and sticky cells — covers 400+ instances across 46 files
- **Breadcrumbs dark mode** (`Breadcrumbs.jsx`): Added `dark:text-white` to active breadcrumb
- **Missing breadcrumb labels** (`Breadcrumbs.jsx`): Added Arabic labels for 15+ missing routes (samples, returns, shipping, quality, etc.)

### F4: Upload Safety for Production
- **Uploads stored in userData** (`server.js`, `models.js`, `documents.js`, `expenses.js`): Redirected all upload directories to `WK_DB_DIR` (= `%APPDATA%/wk-hub/uploads/`) in production — prevents data loss on app update

### F5: Electron Build + NSIS Installer
- **NSIS installer target** (`package.json`): Added `nsis` to win targets — now builds a proper `WK-Hub Setup 2.0.0.exe` installer
- **NSIS config**: `oneClick: false`, `allowToChangeInstallationDirectory: true`, desktop + start menu shortcuts
- **Icon**: Generated app icon (`assets/icon.png`)

### F6: Typo Fix
- **NotificationBell** (`NotificationBell.jsx`): Fixed Arabic typo "كمقروع" → "كمقروء"

### DB Update Safety (verified)
- DB stored in `app.getPath('userData')` (`%APPDATA%/wk-hub/`) — NOT in install directory
- DB files excluded from build package (*.db, *.db-shm, *.db-wal)
- Pre-migration backup runs before every app start
- `addColumnSafe()` pattern for all ALTER TABLE operations (idempotent)
- New installs over existing ones: DB preserved, uploads preserved (now in userData), migrations auto-run

---

## Phase E — Production Audit v3 (2026-03-26)

### E1: Critical Security Fixes
- Removed duplicate `create-admin` endpoint from `routes/auth.js` (TOCTOU race condition)
- File upload extension now derived from MIME type in `fabrics.js`, `accessories.js`, `models.js` (prevents RCE via `.php` extension)
- Fixed `dialog:message-box` IPC — whitelist allowed properties to prevent social engineering
- CSV injection protection in `formatters.js` and `TrialBalance.jsx` — prefix `=+\-@` values with `'`
- `migrator.js` backup changed from async (race condition) to sync `copyFileSync`

### E2: Memory Leak Fixes
- `Fabrics.jsx` and `Accessories.jsx`: blob URL preview via `useMemo` + `useEffect` cleanup
- `formatters.js` and `TrialBalance.jsx`: `revokeObjectURL` after CSV download
- `ConfirmDialog.jsx`: `useConfirm` Promise now resolves `false` on cancel (was hanging forever)

### E3: Hardening & Defense-in-Depth
- `server.js`: Query parameter sanitization (HTML tag stripping on `req.query`)
- `server.js`: Global pagination ceiling middleware (max 500)
- `server.js`: JSON body limit reduced from 10MB to 2MB
- `electron.js`: Single-instance lock (`requestSingleInstanceLock`) prevents port conflicts
- `electron.js`: `export:save-to-disk` wrapped in try/catch
- `backend/.gitignore`: Re-encoded as UTF-8, added `.jwt_secret`
- `preload.js`: Cleaned stale IPC channel lists

### E4: UI/UX Fixes
- `DashboardCharts.jsx`: Uses `useTheme()` hook instead of DOM read for dark mode reactivity
- `Dashboard.jsx`: `ErrorBoundary` wraps lazy-loaded charts
- `ConfirmDialog.jsx`: Added dark mode classes

---

## Phase D — Dashboard Refactoring, Dark Mode, Drag-and-Drop, Security Audit (2026-03-26)

### D1: App-Wide Dark Mode
- **Files**: `index.css`, `Shared.jsx`, `GlobalSearch.jsx`, `NotificationBell.jsx`, `HelpButton.jsx`, `ErrorBoundary.jsx`
- **Change**: Added CSS-level dark overrides for badges, buttons, form-label, page-subtitle, empty-state, body text. Added `dark:` classes to Modal, ConfirmDialog, Tabs, Skeleton, TableSkeleton, search, notifications, help panel, error boundary
- **Reason**: Dark toggle previously only affected dashboard page

### D2: Widget Drag-and-Drop Reordering
- **Files**: `DashboardConfigContext.jsx`, `Dashboard.jsx`, `DashboardConfigPanel.jsx`
- **Change**: Added `widgetOrder` array (persisted per-user), `moveWidget()`, `DraggableWidget` wrapper component, `WidgetRenderer` ordered rendering, config panel with drag handles + numbered positions
- **Reason**: Users requested reorderable dashboard widgets

### D3: Security Audit Fixes (18 Critical Issues)
- **server.js**: Hardened health endpoint (removed metadata leaks), added transaction to create-admin
- **routes/users.js**: Enforced strong password policy (8+ chars, uppercase, digit)
- **routes/backups.js**: Path traversal fix — reconstruct paths via `path.basename()`
- **routes/fabrics.js**: Auto-create upload directory
- **electron.js**: Validated export buffer (50MB limit, extension whitelist), restricted cache IPC keys, sanitized log levels
- **seed.js**: bcrypt cost 12, `must_change_password=1` for all seed users
- **api.js**: Fixed 401 redirect loop, URL-safe Base64 in JWT parsing
- **ImageUpload.jsx**: Fixed memory leak with `URL.revokeObjectURL()`
- **.gitignore**: Added `.auth-state.json`, `SECRETS.md`, `sweep-*.txt`, `screenshots/`
- **run.bat**: Removed default credentials display

### D4: Hardcoded Data Fix
- **Login.jsx**: Changed hardcoded `v15` → dynamic `__APP_VERSION__` from package.json
- **vite.config.js**: Added `define: { __APP_VERSION__: pkg.version }` from root package.json

### D5: Cleanup
- Deleted `Dashboard.old.jsx` (stale 403-line file)
- Deleted empty `e2e/capture-missing.js`
- API tests updated to handle both seed and fresh-setup scenarios

---

## Phase A — Stability Fixes

### A1: Fix auto-journal invoice tax calculation (MATH-1)
- **File**: `backend/routes/autojournal.js`
- **Change**: Replace `invoice.tax_amount || 0` with computed `(invoice.subtotal || 0) * ((invoice.tax_pct || 0) / 100)`
- **Reason**: `tax_amount` column doesn't exist; was always 0

### A2: Fix MRP fabric column name (MATH-2)
- **File**: `backend/routes/mrp.js`
- **Change**: Replace `wf.consumption_per_piece` with `wf.meters_per_piece`
- **Reason**: Schema uses `meters_per_piece`, not `consumption_per_piece`

### A3: Fix MRP on-order query column names (MATH-3)
- **File**: `backend/routes/mrp.js`
- **Change**: Replace `poi.purchase_order_id` with `poi.po_id`, replace `poi.item_code` with `poi.fabric_code`/`poi.accessory_code`
- **Reason**: Schema uses `po_id`, `fabric_code`, `accessory_code`

### A4: Fix MRP auto-PO insert column name (MATH-3 related)
- **File**: `backend/routes/mrp.js`
- **Change**: Replace `(purchase_order_id, ...)` with `(po_id, ...)` in auto-PO item insert
- **Reason**: Schema `purchase_order_items` uses `po_id`

### A5: Fix payroll auto-journal column name (MATH-4)
- **File**: `backend/routes/autojournal.js`
- **Change**: Replace `SUM(net_salary)` with `SUM(net_pay)`
- **Reason**: Schema `payroll_records` uses `net_pay`

### A6: Fix dashboard outstanding payables NULL (MATH-9)
- **File**: `backend/server.js`
- **Change**: Replace `SUM(total_amount - paid_amount)` with `SUM(total_amount - COALESCE(paid_amount, 0))`
- **Reason**: NULL paid_amount causes row to be excluded from SUM

### A7: Convert invoice DELETE to soft-cancel (H-1)
- **File**: `backend/routes/invoices.js`
- **Change**: Replace hard DELETE with `UPDATE status='cancelled'`
- **Reason**: Preserve audit trail, prevent data loss

### A8: Add invoice status transition validation (H-2)
- **File**: `backend/routes/invoices.js`
- **Change**: Add status transition map, block invalid transitions like paid→draft
- **Reason**: Prevent accounting data corruption

### A9: Fix server.js create-admin password validation (C-4)
- **File**: `backend/server.js`
- **Change**: Increase minimum from 6 chars to 8 chars + uppercase + digit
- **Reason**: Align with auth.js password policy

---

## Phase B — Reliability Fixes

### B1: Fix purchase order permission keys (H-5)
- **File**: `backend/routes/purchaseorders.js`
- **Change**: Replace 7 instances of `'purchaseorders'` with `'purchase_orders'`
- **Reason**: Permission table uses `purchase_orders` module key

### B2: Fix quotations SO→WO permission key (H-5)
- **File**: `backend/routes/quotations.js`
- **Change**: Replace `'workorders'` with `'work_orders'` in SO→WO conversion
- **Reason**: Permission table uses `work_orders` module key

### B3: Fix quotations permission actions (H-5)
- **File**: `backend/routes/quotations.js`
- **Change**: Replace all `'read'` → `'view'`, `'update'` → `'edit'` (7 instances)
- **Reason**: Permission table uses `view`/`edit` action names

### B4: Fix quality permission actions (H-5)
- **File**: `backend/routes/quality.js`
- **Change**: Replace all `'read'` → `'view'`, `'update'` → `'edit'`
- **Reason**: Permission table uses `view`/`edit` action names

### B5: Add negative item validation on invoices (M-17)
- **File**: `backend/routes/invoices.js`
- **Change**: Reject items with negative quantity or unit_price on POST
- **Reason**: Prevent accounting anomalies

### B6: Add over-receipt prevention on POs (M-18)
- **File**: `backend/routes/purchaseorders.js`
- **Change**: Block receipt if total received > 110% of ordered quantity
- **Reason**: Prevent inventory inflation from over-receiving

---

## Phase C — Correctness Fixes

### C1: Fix invoice tax formula (post-discount) (MATH-6)
- **File**: `backend/routes/invoices.js`
- **Change**: Tax formula in POST/PUT: `(subtotal - discount) * (tax_pct / 100)` instead of `subtotal * tax_pct`
- **Reason**: Standard accounting: tax applies after discount

### C2: Fix VAT summary per-PO tax rate (MATH-7)
- **File**: `backend/routes/accounting.js`
- **Change**: Replace global tax_rate setting with per-PO `tax_pct` SQL calculation
- **Reason**: Different POs may have different tax rates

### C3: Fix PO receipt journal per-PO tax (MATH-14)
- **File**: `backend/routes/autojournal.js`
- **Change**: Replace global `getSetting('tax_rate')` with `po.tax_pct` for PO receipt journals
- **Reason**: PO already stores its own tax rate

### C4: Fix PO tax formula (post-discount) (T2-08)
- **File**: `backend/routes/purchaseorders.js`
- **Change**: Tax formula in POST/PUT: `(subtotal - discount) * (tax_pct / 100)` instead of `subtotal * tax_pct - discount`
- **Reason**: Align with invoice formula — tax applies after discount

### C5: Fix WO finalize waste double-count (MATH-5)
- **File**: `backend/routes/workorders.js`
- **Change**: When V8 consumption exists, only count manual waste (wo_waste) not batch waste
- **Reason**: Batch waste may already be reflected in consumption records

### C6: Auto-journal entries default to draft (T2-11)
- **File**: `backend/routes/autojournal.js`
- **Change**: Insert status `'draft'` instead of `'posted'`
- **Reason**: Allow accountant review before posting

### C7: Block edits to completed/cancelled maintenance (T3-01)
- **File**: `backend/routes/maintenance.js`
- **Change**: Return 400 if maintenance order status is completed or cancelled
- **Reason**: Protect finalized data integrity

### C8: MRP queries V4 fabric batches (T2-14)
- **File**: `backend/routes/mrp.js`
- **Change**: When `wo_fabrics` is empty, also query `wo_fabric_batches` for V4 WOs
- **Reason**: V4 WOs track fabric via batches, not legacy wo_fabrics

### C9: Input validations (T3-03)
- **Files**: `suppliers.js`, `quotations.js`, `machines.js`
- **Changes**: Rating 1-5 for suppliers, non-negative discount/tax for quotations, non-negative capacity/cost for machines
- **Reason**: Prevent nonsensical data at system boundaries

### C10: Default pagination for models (T3-04)
- **File**: `backend/routes/models.js`
- **Change**: Add optional `page`/`limit` query params with max 200 limit
- **Reason**: Prevent unbounded result sets in large catalogs

---

## Test Results

- **Post Phase A**: 58/58 passing ✅
- **Post Phase B**: 58/58 passing ✅
- **Post Phase C**: 58/58 passing ✅

---

*All changes are backward-compatible. No DB schema changes required.*

---

## Round 2 — Deep Security Audit

> Baseline commit: `609d2c2`

### S1: Protect /uploads behind authentication (CRITICAL)
- **File**: `backend/server.js`
- **Change**: Move `express.static` for `/uploads` behind `requireAuth` middleware
- **Reason**: Upload files (invoices, documents, images) were publicly accessible without auth

### S2: Remove JWT_SECRET from module exports (CRITICAL)
- **File**: `backend/middleware/auth.js`, `backend/routes/auth.js`
- **Change**: Remove `JWT_SECRET` from auth.js exports; remove unused import in routes/auth.js
- **Reason**: Exporting the JWT secret creates key-leakage risk

### S3: Add permission checks to invoice GET endpoints (HIGH)
- **File**: `backend/routes/invoices.js`
- **Change**: Add `requirePermission('invoices', 'view')` to `/next-number`, `/export`, `/:id`
- **Reason**: These endpoints returned data without permission check

### S4: Add permission check to settings GET (HIGH)
- **File**: `backend/routes/settings.js`
- **Change**: Add `requirePermission('settings', 'view')` to `GET /`
- **Reason**: Settings were readable by any authenticated user

### S5: Add role guard to notifications check-overdue (HIGH)
- **File**: `backend/routes/notifications.js`
- **Change**: Add `requireRole('superadmin', 'manager')` to `POST /check-overdue`
- **Reason**: Overdue checks should only be triggered by managers

### S6: Convert HR routes to fine-grained permissions (HIGH)
- **File**: `backend/routes/hr.js`
- **Change**: Replace all 25 `requireRole()` calls with `requirePermission('hr', 'view/create/edit/delete')`
- **Reason**: HR used coarse role-based auth instead of permission-based model

### S7: Convert auditlog to requirePermission (HIGH)
- **File**: `backend/routes/auditlog.js`
- **Change**: Replace `requireRole('superadmin', 'manager')` with `requirePermission('audit', 'view')`
- **Reason**: Consistent with permission-based model

### S8: Remove file_path from backup restore response (HIGH)
- **File**: `backend/routes/backups.js`
- **Change**: Remove `file_path: backup.file_path` from restore response, keep only `file_name`
- **Reason**: Server filesystem paths should not be exposed to clients

### S9: Upgrade create-admin password policy (MEDIUM)
- **File**: `backend/routes/auth.js`
- **Change**: Require 8+ chars with uppercase and digit for create-admin endpoint
- **Reason**: Align with the stricter register endpoint policy

### S10: Fix HTML sanitization bypass (MEDIUM)
- **File**: `backend/server.js`
- **Change**: Update stripTags regex from `/<[^>]*>/g` to `/<[^>]*>?/g`
- **Reason**: Unclosed tags like `<script` were not stripped

### S11: Add existence check for samples DELETE (MEDIUM)
- **File**: `backend/routes/samples.js`
- **Change**: Check sample exists before soft-cancel; return 404 if missing
- **Reason**: Silent no-op on missing record, audit log recorded phantom deletions

### S12: Fix payroll NaN from null overtime_rate_multiplier (LOW)
- **File**: `backend/routes/hr.js`
- **Change**: Default `overtime_rate_multiplier` to 1.5 when null
- **Reason**: `null * number = NaN` corrupts payroll calculations

### S13: Eliminate error message leakage (HIGH — 31 files)
- **Files**: All 31 route files
- **Change**: Replace `res.status(500).json({ error: err.message })` with `console.error(err); res.status(500).json({ error: 'حدث خطأ داخلي' })`
- **Reason**: Internal error details (SQL, stack traces) were exposed to clients

---

## Phase D — Maintainability Fixes

### D3: Dead code identified (deferred deletion)
- **Files**: `backend/validators.js`, `backend/utils/validators.js`
- **Status**: Both are dead code (never imported). Deletion requires manual confirm.

### D5: Convert document DELETE to soft-delete
- **File**: `backend/routes/documents.js`, `backend/database.js`
- **Change**: Add `deleted_at` column (V24 migration); UPDATE instead of DELETE; filter GET by `deleted_at IS NULL`
- **Reason**: Hard DELETE permanently lost document records

### D6: Fix quality rate to final stage only
- **File**: `backend/routes/reports.js`
- **Change**: Overall pass rate query now filters to highest `sort_order` per WO
- **Reason**: Summing all stages double-counted rejections at intermediate stages

### D7: Align frontend/backend fabric cost breakdown
- **File**: `frontend/src/hooks/useCostCalc.js`
- **Change**: Separate waste from `main_fabric_cost`, add `waste_cost` to `total_cost` explicitly
- **Reason**: Frontend included waste in fabric cost; backend tracked separately. Total was correct but labels inconsistent.

### D9: Make wholesale multiplier configurable
- **File**: `backend/routes/workorders.js`, `backend/database.js`
- **Change**: Read `wholesale_discount_pct` from settings table (default 22%). V24 migration seeds the setting.
- **Reason**: Hardcoded `0.78` (22% discount) couldn't be adjusted

---

## Test Results — Round 2

- **Post security fixes (S1–S13)**: 58/58 passing ✅
- **Post Phase D (D5–D9)**: 58/58 passing ✅
- **Frontend build**: Success (0 errors) ✅

---

## Round 3 — Performance & Permission Hardening

> Baseline commit: `e056738`

### P1: Add missing export endpoint permission checks (HIGH — 7 files)
- **Files**: `workorders.js`, `customers.js`, `machines.js`, `fabrics.js`, `accessories.js`, `suppliers.js`, `purchaseorders.js`
- **Change**: Add `requirePermission('module', 'view')` to `GET /export` endpoints
- **Reason**: Export endpoints bypassed permission checks, allowing any authenticated user to export data

### P2: Add missing next-number permission checks (HIGH — 2 files)
- **Files**: `workorders.js`, `purchaseorders.js`
- **Change**: Add `requirePermission('module', 'view')` to `GET /next-number` endpoints
- **Reason**: Next-number endpoints had no permission check

### P3: Fix samples incorrect permission action (HIGH)
- **File**: `backend/routes/samples.js`
- **Change**: Replace 3 instances of `requirePermission('samples', 'read')` with `requirePermission('samples', 'view')`
- **Reason**: `'read'` action doesn't exist in permission_definitions table; was silently denying all access

### P4: Add audit log to notification DELETE (MEDIUM)
- **File**: `backend/routes/notifications.js`
- **Change**: Add `logAudit(req, 'DELETE', 'notification', id, title)` to DELETE handler
- **Reason**: Notification deletions were not tracked in audit log

### P5: Optimize generateNotifications N+1 (HIGH — perf)
- **File**: `backend/routes/notifications.js`
- **Change**: Batch-load all unread notifications into a Set; replace 8 categories × N items × M users individual `SELECT` queries with single in-memory lookup
- **Reason**: Potentially hundreds of per-item queries reduced to 1 query + in-memory lookups

### P6: Optimize check-overdue N+1 (HIGH — perf)
- **File**: `backend/routes/notifications.js`
- **Change**: Batch-load recent (24h) notifications into a Set; replace per-item duplicate-check queries with in-memory lookup
- **Reason**: Same N+1 pattern as generateNotifications

### P7: Optimize production-by-stage-detail N+1 (MEDIUM — perf)
- **File**: `backend/routes/reports.js`
- **Change**: Replace per-stage query loop with single query fetching all stage work orders, grouped in-memory via `stageMap`
- **Reason**: Per-stage query loop generated O(stages) queries instead of 1

### P8: Optimize payroll calculation N+1 (HIGH — perf)
- **File**: `backend/routes/hr.js`
- **Change**: Batch-fetch all attendance and adjustments before employee loop; map to dictionaries keyed by employee_id
- **Reason**: Per-employee attendance + adjustment queries generated O(employees × 2) queries instead of 2

### P9: Optimize MRP calculation N+1 (HIGH — perf)
- **File**: `backend/routes/mrp.js`
- **Change**: Batch-load all wo_sizes, wo_fabrics, wo_fabric_batches, wo_accessories_detail for active WOs before loop; map to dictionaries keyed by wo_id
- **Reason**: Per-WO queries for sizes/fabrics/accessories generated O(WOs × 3) queries instead of 4

### P10: Add V25 performance indexes (MEDIUM — perf)
- **File**: `backend/database.js`
- **Change**: V25 migration adds 8 indexes: `idx_notifications_user_read`, `idx_work_orders_status`, `idx_attendance_emp_date`, `idx_invoice_items_invoice`, `idx_po_items_po`, `idx_wo_stages_wo`, `idx_wo_stages_name`, `idx_invoices_status_due`
- **Reason**: Common query patterns lacked index coverage

---

## Test Results — Round 3

- **Post all fixes (P1–P10)**: 58/58 passing ✅
- **Frontend build**: Success (0 errors, 2545 modules) ✅

---

## Round 4 — Permission Action Fixes, Missing Permission Guards & Transaction Safety

> Baseline commit: `e34e060`

### R4-01: Fix wrong permission action names across 4 files (CRITICAL — 11 instances)
- **Files**: `returns.js`, `documents.js`, `backups.js`, `samples.js`
- **Change**: Replace `'read'` → `'view'` (7×) and `'update'` → `'edit'` (4×)
- **Reason**: Actions `'read'`/`'update'` don't exist in `permission_definitions` table. All non-superadmin users were silently denied access to returns (6 endpoints), documents (3 endpoints), backups (1 endpoint), and sample editing.

### R4-02: Add requirePermission to models.js GET endpoints (HIGH — 5 endpoints)
- **File**: `backend/routes/models.js`
- **Change**: Add `requirePermission('models', 'view')` to `/next-serial`, `/:code`, `/:code/bom-matrix`, `/:code/bom-templates`, `/:code/bom-templates/:templateId`
- **Reason**: BOM matrix exposes manufacturing costs, profit margins, suggested prices. Any authenticated user could view. Other models GET (list) already had permission check.

### R4-03: Add requirePermission to machines.js GET endpoints (HIGH — 5 endpoints)
- **File**: `backend/routes/machines.js`
- **Change**: Add `requirePermission('machines', 'view')` to `/stats`, `/barcode/:barcode`, `/:id`, `/:id/maintenance`, `/:id/expenses`
- **Reason**: Exposes maintenance costs, production hours, expense details. List endpoint (GET /) already had permission check.

### R4-04: Add requirePermission to fabrics.js, accessories.js, purchaseorders.js (HIGH — 4 endpoints)
- **Files**: `fabrics.js`, `accessories.js`, `purchaseorders.js`
- **Change**: Add `requirePermission('fabrics/accessories/purchase_orders', 'view')` to `/:code/po-batches`, `/:code/batches`, `/:code/stock`, `/:id`
- **Reason**: Exposes supplier pricing history, inventory batch details, stock levels, PO amounts/payment details.

### R4-05: Wrap quotations POST+PUT in db.transaction() (MEDIUM)
- **File**: `backend/routes/quotations.js`
- **Change**: Wrap header INSERT+items INSERT (POST) and UPDATE+DELETE items+INSERT items (PUT) in `db.transaction()`
- **Reason**: PUT: if item re-insertion failed after DELETE, items were lost. POST: if item INSERT failed, orphaned header row.

### R4-06: Wrap shipping POST+PUT in db.transaction() (MEDIUM)
- **File**: `backend/routes/shipping.js`
- **Change**: Wrap shipment INSERT+items INSERT (POST) and UPDATE+DELETE+INSERT (PUT) in `db.transaction()`
- **Reason**: Same orphan/data-loss pattern as quotations.

### R4-07: Wrap returns POST (sales+purchases) in db.transaction() (MEDIUM)
- **File**: `backend/routes/returns.js`
- **Change**: Wrap return INSERT+items INSERT for both sales and purchase returns in `db.transaction()`
- **Reason**: Same orphan pattern.

### R4-08: Wrap invoice PUT in db.transaction() (MEDIUM)
- **File**: `backend/routes/invoices.js`
- **Change**: Unified UPDATE+DELETE items+INSERT items into single transaction. Previously the DELETE was outside the items-only transaction.
- **Reason**: If item insertion failed after DELETE, customer invoice items were permanently lost.

### R4-09: Add PO item_type whitelist validation (MEDIUM)
- **File**: `backend/routes/purchaseorders.js`
- **Change**: Validate `item_type` against `['fabric', 'accessory']` before insert
- **Reason**: Arbitrary values could be inserted into `purchase_order_items.item_type` column, breaking downstream queries that filter by type.

---

## Test Results — Round 4

- **Post all fixes (R4-01 to R4-09)**: 58/58 passing ✅
- **Frontend build**: Success (0 errors, 2545 modules) ✅

---

## Round 5 — SQL Injection Fix, Permission Seed Gaps, Transaction Safety, Authorization Hardening

### R5-01: Remove SQL-injectable nextNumber helper (mrp.js)
- **File**: `backend/routes/mrp.js`
- **Change**: Removed `nextNumber(prefix, table, column)` function that used `${table}` and `${column}` directly in SQL template literals
- **Reason**: Accepted arbitrary table/column names — SQL injection vector if any future caller passes user input. Function was dead code (defined but never called).
- **Severity**: P0 (SQL Injection)

### R5-02: Fix permission key 'workorders' → 'work_orders' + wrap in transaction
- **File**: `backend/routes/samples.js`
- **Change**: `requirePermission('workorders', 'create')` → `requirePermission('work_orders', 'create')`; wrapped SELECT+INSERT+UPDATE in `db.transaction()`
- **Reason**: Seeded module is `work_orders` (with underscore); `workorders` never matched → 403 for all non-superadmin users
- **Severity**: P1 (Broken feature)

### R5-03: Add missing permission seeds (V26 migration)
- **File**: `backend/database.js`
- **Change**: V26 adds `machines:create/edit/delete` + `settings:delete` permission definitions and role_permissions
- **Reason**: V10 only seeded `machines:view/manage` but routes use `create/edit/delete`; `settings:delete` never seeded but used by stagetemplates.js
- **Severity**: P1 (Broken features for non-superadmin)

### R5-04: Add requirePermission to 6 unguarded GET endpoints
- **Files**: `backend/routes/customers.js`, `backend/routes/suppliers.js`
- **Changes**: Added `requirePermission('customers', 'view')` to `/:id`, `/:id/invoices`, `/:id/balance`, `/:id/payments`; added `requirePermission('suppliers', 'view')` to `/:id`, `/:id/ledger`
- **Reason**: List endpoints had permissions but detail/sub-resource GETs were unguarded
- **Severity**: P1 (Authorization gap)

### R5-05: Wrap 5 multi-write operations in transactions
- **Files**: `suppliers.js`, `customers.js`, `maintenance.js`, `machines.js`
- **Changes**: Wrapped supplier payments POST, customer payments POST, maintenance PUT, machines import, maintenance import in `db.transaction()`
- **Reason**: Partial failure left inconsistent data (payment recorded but totals not updated)
- **Severity**: P1 (Data integrity)

### R5-06: Move shipping nextNumber inside transaction
- **File**: `backend/routes/shipping.js`
- **Change**: Moved `nextNumber('SHP')` from outside `db.transaction()` to inside
- **Reason**: Number generation now atomic with INSERT
- **Severity**: P1 (Data integrity)

### R5-07: Add multer file type filter for HR attendance import
- **File**: `backend/routes/hr.js`
- **Change**: Added `fileFilter` restricting uploads to `.xlsx`, `.xls`, `.csv`
- **Reason**: No file type validation — any file type accepted

---

## Phase 6 — Export System & Electron Enhancement (March 2026)

### E1: Enhanced seed script with consumption tracking
- **File**: `backend/seed.js`
- **Changes**:
  - Fabric inventory batches start with `used_meters=0`, populated by WO consumption
  - Added `accessory_inventory_batches` creation from POs
  - Added `wo_fabric_consumption`, `wo_accessory_consumption`, `wo_waste`, `wo_accessories_detail` records
  - Inventory finalization syncs batch `used_meters` and recalculates `fabrics.available_meters`
  - Cost snapshots computed from real consumption data
- **Result**: 4,745 records across 44 entity tables

### E2: Comprehensive export system — 18 endpoints
- **File**: `backend/routes/exports.js`
- **New endpoints**: suppliers, fabric-usage, accessory-usage, wo-cost-breakdown, model-profitability, po-by-supplier, inventory-valuation, waste-analysis, financial-summary, customers, quality-report, payroll, employees, machines, stage-progress, production-timeline, purchase-summary, full-export
- **Features**: CSV + Excel (XLSX) format, Arabic column headers, RTL Excel, date filtering, catalog endpoint
- **Registered**: `app.use('/api/exports', requireAuth, exportsRouter)` in `server.js`

### E3: Frontend Exports Center page
- **File**: `frontend/src/pages/ExportsCenter.jsx` (NEW)
- **Features**: Category-grouped export cards, CSV/XLSX download buttons, date range filter, search, responsive grid
- **Route**: `/exports` with `reports:view` permission
- **Nav**: Added to sidebar under "التقارير" section

### E4: Electron desktop app enhancement
- **Files**: `electron.js` (rewritten), `preload.js` (NEW), `lib/logger.js`, `lib/cache.js`, `lib/migrator.js`, `lib/security.js` (ALL NEW)
- **Logging**: Winston with daily rotation (combined/error/audit logs), 30/60/90 day retention, sensitive field redaction, error code taxonomy
- **Caching**: Memory + disk two-tier cache with TTL, prefix invalidation
- **Security**: CSP headers, navigation restriction, DevTools blocking in production, ASAR integrity check, debugger detection
- **DB Migration**: Pre-launch backup, restore capability, backup pruning (keep 10)
- **IPC**: 12 invoke + 11 send + 11 receive channels, all whitelisted in preload.js
- **Error handling**: Global uncaughtException/unhandledRejection with Arabic error dialogs
- **Build**: preload.js and lib/**/* added to electron-builder files config
- **Severity**: P1 (Security)

### R5-08: Add performance indexes (V26 migration)
- **File**: `backend/database.js`
- **Changes**: 5 new indexes on `customer_payments(customer_id)`, `customer_payments(invoice_id)`, `supplier_payments(po_id)`, `supplier_payments(supplier_id)`, `stage_movement_log(wo_id)`
- **Reason**: Frequently queried columns without indexes
- **Severity**: P2 (Performance)

---

## Test Results — Round 5

- **Post all fixes (R5-01 to R5-08)**: 58/58 passing ✅
- **Frontend build**: Success (0 errors, 2545 modules) ✅

---

## Round 6 — Transaction Safety, Authorization Hardening, Error Leak Fixes, Enum Validation

### R6-01: Shipping POST `num` scope bug (P1 — RUNTIME)
- **File**: `backend/routes/shipping.js`
- **Change**: `logAudit(req, 'create', 'shipment', created.id, num)` → `created.shipment_number`
- **Reason**: `num` was `const`-scoped inside `db.transaction()` callback but referenced outside → ReferenceError on every shipment creation. Shipment saved but client got 500, no audit log written.

### R6-02: Shipping PATCH status validation
- **File**: `backend/routes/shipping.js`
- **Change**: Added `validStatuses` whitelist, blocks changes to delivered shipments, blocks cancelled→anything except draft.

### R6-03: PO status transitions (added 'partial' + transition graph)
- **File**: `backend/routes/purchaseorders.js`
- **Change**: Added `'partial'` to valid statuses. Replaced ad-hoc validation with transition graph: `{draft:['sent','cancelled'], sent:['partial','received','cancelled'], partial:['received','cancelled'], received:[], cancelled:['draft']}`.

### R6-04–R6-06: Quality.js transaction wrappers
- **File**: `backend/routes/quality.js`
- **Change**: Wrapped templates POST (INSERT template + INSERT items), templates PUT (UPDATE + DELETE + INSERT), inspections POST (INSERT inspection + INSERT items) in `db.transaction()`.

### R6-07: autojournal `createJournalEntry()` transaction
- **File**: `backend/routes/autojournal.js`
- **Change**: Wrapped INSERT journal_entries + loop INSERT journal_entry_lines in `db.transaction()`. Affects 5 calling routes.

### R6-08: Invoices POST transaction unification
- **File**: `backend/routes/invoices.js`
- **Change**: Moved header INSERT INTO invoices inside the items transaction. Previously header was outside — if items failed, orphaned invoice header remained.

### R6-09: Expenses import transaction
- **File**: `backend/routes/expenses.js`
- **Change**: Wrapped loop of INSERTs in `db.transaction()` for atomic bulk import.

### R6-10: HR employees import transaction
- **File**: `backend/routes/hr.js`
- **Change**: Wrapped loop of INSERT/UPDATE in `db.transaction()` for atomic bulk import.

### R6-11: PO payments transaction
- **File**: `backend/routes/purchaseorders.js`
- **Change**: Wrapped INSERT supplier_payments + UPDATE purchase_orders paid_amount in `db.transaction()`.

### R6-12: requirePermission on 7 unprotected workorders GET endpoints
- **File**: `backend/routes/workorders.js`
- **Change**: Added `requirePermission('work_orders', 'view')` to `/:id`, `/:id/cost-summary`, `/by-stage`, `/:id/movement-log`, `/:id/fabric-consumption`, `/:id/accessory-consumption`, `/:id/waste`.

### R6-13: requirePermission on barcode, stage-templates, permissions GETs
- **Files**: `backend/routes/barcode.js`, `backend/routes/stagetemplates.js`, `backend/routes/permissions.js`
- **Change**: barcode `/:code` → `requirePermission('work_orders', 'view')`, stage-templates `/` → `requirePermission('settings', 'view')`, permissions `/roles` → `requireRole('superadmin')`.

### R6-14: Error message leak fixes
- **File**: `backend/routes/workorders.js`
- **Change**: POST and PUT catch blocks leaked `err.message` to client. Replaced with generic Arabic error messages + `console.error(err)`.

### R6-15: Enum validation (8 fields across 6 files)
- **Files**: `models.js`, `shipping.js`, `maintenance.js`, `hr.js`, `expenses.js`, `scheduling.js`
- **Change**: Added server-side validation for `gender`, `shipment_type`, `maintenance_type`, `priority`, `employment_type`, `salary_type`, `expense_type`, scheduling `status` — all against DB CHECK constraints.

---

## Test Results — Round 6

- **Post all fixes (R6-01 to R6-15)**: 58/58 passing ✅
- **Frontend build**: Success (0 errors, 2545 modules) ✅

---

## Round 7 — Critical Route Fixes, Soft-Delete Gaps, Transaction Safety, Error Messages

### R7-01 — `customers.js`: 3 Broken GET Routes Rebuilt (P1 CRITICAL)
- **GET `/:id`** — missing `try {`, customer fetch query, and null check → crashes with ReferenceError on every request. Rebuilt with proper structure.
- **GET `/:id/invoices`** — same corruption pattern. Rebuilt.
- **GET `/:id/balance`** — same corruption pattern. Rebuilt.

### R7-02 — `purchaseorders.js`: Receive Endpoint Error Leak
- **PATCH `/:id/receive`** catch block leaked `err.message` to client → replaced with generic Arabic error message, UNIQUE constraint special case preserved.

### R7-03 — `machines.js`: 3 Soft-Delete Filter Gaps
- **`/stats`** — `machine_maintenance` cost SUM query missing `AND is_deleted=0` → deleted records inflated cost totals. Fixed.
- **`/:id/maintenance` GET** — returned soft-deleted maintenance records. Added `AND is_deleted=0`.
- **`/:id/maintenance/:mid` PUT** — allowed updates to soft-deleted records. Added `AND is_deleted=0` to pre-check.

### R7-04 — `quotations.js`: Convert-to-SO Transaction Wrapper
- Wrapped INSERT `sales_orders` + INSERT items loop + UPDATE `quotations` status in `db.transaction()` — prevents orphaned records on partial failure.

### R7-05 — `quotations.js`: Convert-to-WO Transaction + Status Check
- Wrapped INSERT `work_orders` + UPDATE `sales_orders` status in `db.transaction()`.
- Added status validation: only `confirmed` or `pending` sales orders can be converted to work orders.

### R7-06 — `quotations.js`: Sales Order Status Validation
- **PATCH `/sales-orders/:id/status`** — added whitelist validation: `confirmed`, `in_production`, `shipped`, `delivered`, `cancelled`. Returns 400 for invalid values.

### R7-07 — All 31 Route Files: Placeholder Error Messages Fixed
- Replaced ~150+ instances of corrupted `'??? ??? ?????'` with proper Arabic `'حدث خطأ داخلي'` across all route files via UTF-8-safe batch replacement.

## Test Results — Round 7

- **Post all fixes (R7-01 to R7-07)**: 58/58 passing ✅
- **Frontend build**: Success (0 errors, 2545 modules) ✅

---

## Round 8 — Production Audit: Math/Financial Correctness, Security Hardening

### R8-01 — `autojournal.js`: Invoice Tax Ignores Discount (P0 CRITICAL)
- Tax was calculated as `subtotal × tax_pct` ignoring discount → unbalanced journal entries
- Fixed to `(subtotal - discount) × tax_pct` matching invoice formula

### R8-02 — `formatters.js`: fmtNum Loses Decimal Precision
- `Math.round()` dropped all decimals → cost displays showed only integers
- Fixed to `toLocaleString('ar-EG', { maximumFractionDigits: 2 })`

### R8-03 — `mrp.js`: On-Order Double-Counts Received Items (P0 CRITICAL)
- MRP counted full PO `quantity` instead of `quantity - received_qty` → understated shortages
- Fixed both fabric and accessory on-order queries

### R8-04 — `purchaseorders.js`: PO Total Stale on Tax-Only Update (P0 CRITICAL)
- Changing `tax_pct` or `discount` without items kept old `total_amount`
- Fixed: always recalculates from existing items when items not provided

### R8-05 — `invoices.js` + `purchaseorders.js`: Negative Total Prevention
- Discount > subtotal created negative tax and negative totals
- Added guard: returns 400 if discount exceeds subtotal (POST + PUT)

### R8-06 — `server.js` + `backups.js`: Error Message Leaks
- Dashboard, search, setup, backups, and global error handler leaked `err.message`
- All replaced with generic Arabic error messages

## Test Results — Round 8

- **Post all fixes (R8-01 to R8-06)**: 58/58 passing ✅
- **Frontend build**: Success (0 errors, 2545 modules) ✅
