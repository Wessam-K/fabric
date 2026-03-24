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
