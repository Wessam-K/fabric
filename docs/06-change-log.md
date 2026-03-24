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
