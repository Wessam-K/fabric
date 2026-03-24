# 06 — Change Log

> Phase 5 deliverable — all code changes documented  
> Baseline commit: `19ddc8b`

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
