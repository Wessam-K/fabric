# 02 — Endpoint Audit

> Phase 1 deliverable — severity-ranked findings across all 33 route files  
> Baseline commit: `19ddc8b`

---

## Severity Scale

| Level | Criteria |
|-------|----------|
| **CRITICAL** | Security vulnerability, data exposure, or auth bypass. Fix immediately. |
| **HIGH** | Data integrity risk, business logic error, or transaction safety gap. Fix this week. |
| **MEDIUM** | Validation gap, inconsistency, or missing guard. Fix this month. |
| **LOW** | Code quality, minor inconsistency, or nice-to-have. Fix when convenient. |

---

## CRITICAL (4 issues)

### C-1: Missing Auth on Notification Endpoints
- **File**: `backend/routes/notifications.js`
- **Endpoints**: `GET /count`, `PATCH /read-all`, `POST /check-overdue`
- **Risk**: Any unauthenticated user can read/modify/trigger all notifications
- **Fix**: Add `requireAuth` + `requirePermission` to all routes

### C-2: No Auth on Barcode Lookup
- **File**: `backend/routes/barcode.js`
- **Endpoint**: `GET /api/barcode/:code`
- **Risk**: Public access to WO numbers, machine locations, inventory levels, supplier data
- **Fix**: Add `requireAuth` middleware

### C-3: No Auth on Machine Stats
- **File**: `backend/routes/machines.js`
- **Endpoint**: `GET /api/machines/stats`
- **Risk**: Unauthorized users can view machine utilization, availability, cost data
- **Fix**: Add `requirePermission('machines', 'view')`

### C-4: Duplicate `/api/setup/create-admin` with Weaker Validation
- **File**: `backend/server.js` (line ~L84) vs `backend/routes/auth.js`
- **Issue**: `server.js` version requires 6-char password; `auth.js` version requires 8-char + uppercase + digit
- **Risk**: Weak admin password creation via server.js endpoint
- **Fix**: Remove from server.js, keep only auth.js version with strong validation

---

## HIGH (12 issues)

### H-1: Invoice Hard Delete
- **File**: `backend/routes/invoices.js` — `DELETE /:id`
- **Issue**: Permanently removes invoice + items from DB
- **Fix**: Soft-cancel (set `status='cancelled'`)

### H-2: Invoice Status Downgrade Allowed
- **File**: `backend/routes/invoices.js` — `PATCH /:id/status`
- **Issue**: Can change `paid → draft`, breaking accounting
- **Fix**: Add status transition validation map (like work orders)

### H-3: Negative Invoice Line Items
- **File**: `backend/routes/invoices.js`
- **Issue**: `quantity` and `unit_price` accept negative values
- **Fix**: Validate `>= 0` before insert

### H-4: Incomplete Transaction in PO Receive
- **File**: `backend/routes/purchaseorders.js` — `PATCH /:id/receive`
- **Issue**: Fabric batch creation and stock updates span transaction partially
- **Risk**: Orphaned inventory on mid-transaction failure
- **Fix**: Wrap entire receive workflow in single `db.transaction()`

### H-5: No Over-Receipt Prevention
- **File**: `backend/routes/purchaseorders.js`
- **Issue**: `totalReceived` not validated against ordered quantity
- **Fix**: Check `totalReceived <= quantity * (1 + tolerance)`

### H-6: Completed Maintenance Orders Editable
- **File**: `backend/routes/maintenance.js` — `PUT /:id`
- **Issue**: No status check before allowing edits
- **Fix**: Block edits to `completed` or `cancelled` orders

### H-7: Stock Adjustment Race Condition
- **File**: `backend/routes/accessories.js`
- **Issue**: Read-then-update pattern on `quantity_on_hand`
- **Fix**: Use atomic `UPDATE SET qty = qty + ?` instead

### H-8: Permission Key Mismatches
- **Backend**: `purchaseorders` (no underscore) vs **Frontend**: `purchase_orders` (with underscore)
- **Backend**: Quality uses `read/update` vs **Others**: `view/edit`
- **Impact**: Permission checks may silently pass/fail incorrectly

### H-9: Missing FK Validation on WO Create
- **File**: `backend/routes/workorders.js` — `POST /`
- **Issue**: `model_id`, `template_id` not verified before insert
- **Fix**: Check FK existence before INSERT

### H-10: Auto-Journal Entries Auto-Posted
- **File**: `backend/routes/autojournal.js`
- **Issue**: All entries created with `status='posted'` — no review step
- **Fix**: Default to `status='draft'`, require explicit posting

### H-11: MRP Column Name Mismatches
- **File**: `backend/routes/mrp.js`
- **Issue**: References `consumption_per_piece` (should be `meters_per_piece`), `purchase_order_id` (should be `po_id`)
- **Impact**: MRP calculations return 0 for fabric requirements and on-order quantities
- **Fix**: Correct column names to match schema

### H-12: Payroll Auto-Journal Wrong Column
- **File**: `backend/routes/autojournal.js`
- **Issue**: Queries `net_salary` but payroll table uses `net_pay`
- **Impact**: Payroll journal entries always have 0 amounts
- **Fix**: Change to `net_pay`

---

## MEDIUM (28 issues)

### Input Validation

| # | File | Issue |
|---|------|-------|
| M-1 | suppliers.js | Rating accepts any integer; no 1–5 range check |
| M-2 | customers.js | Phone validation only in POST, missing in PATCH |
| M-3 | quotations.js | `discount_percent`/`tax_percent` accept negative values |
| M-4 | machines.js | `capacity_per_hour`/`cost_per_hour` accept negative in PATCH |
| M-5 | purchaseorders.js | `item_type` not whitelisted in import endpoint |

### Missing Pagination

| # | File | Endpoint |
|---|------|----------|
| M-6 | models.js | `GET /` returns all models without limit |
| M-7 | fabrics.js | `GET /` no default limit |
| M-8 | accessories.js | `GET /` no default limit |
| M-9 | accounting.js | Trial balance returns ALL accounts |
| M-10 | suppliers.js | `GET /` no pagination |

### Missing Permission Guards

| # | File | Endpoint |
|---|------|----------|
| M-11 | workorders.js | `GET /:id`, `/next-number`, `/by-stage`, `/export`, `/:id/cost-summary`, `/:id/movement-log`, `/:id/fabric-consumption`, `/:id/accessory-consumption` |
| M-12 | invoices.js | `GET /:id`, `/next-number`, `/export` |
| M-13 | purchaseorders.js | `GET /:id` |

### Missing Business Logic

| # | File | Issue |
|---|------|-------|
| M-14 | shipping.js | Can ship before invoice is paid |
| M-15 | customers.js | No duplicate customer code check on edit |
| M-16 | quality.js | QC inspections don't validate WO exists |
| M-17 | invoices.js | DELETE doesn't check for related payments/receipts |
| M-18 | quotations.js | Can edit accepted quotations (only conversion blocked) |
| M-19 | documents.js | ZIP files allowed (zip bomb risk) |

### Inconsistent Patterns

| # | Scope | Issue |
|---|-------|-------|
| M-20 | All routes | Raw `err.message` exposed to clients in development |
| M-21 | All routes | Response format mismatch: `{message}`, `{success, message}`, `{id, message}` |
| M-22 | hr.js | Uses `requireRole` instead of `requirePermission` |
| M-23 | auth.js | British English mixed with Arabic error messages |
| M-24 | All routes | No standard response envelope `{success, data, message}` |

### Missing Functionality

| # | File | Issue |
|---|------|-------|
| M-25 | autojournal.js | No COGS journal entry when WO finalized |
| M-26 | maintenance.js | No cost accumulation for monthly/yearly totals |
| M-27 | quotations.js | SO → WO conversion doesn't copy model/BOM references |
| M-28 | documents.js | Hard delete instead of soft delete |

---

## LOW (15 issues)

| # | File | Issue |
|---|------|-------|
| L-1 | workorders.js | WO `pending` status in transition map but never set by UI |
| L-2 | All routes | File upload uses `Date.now() + random` — predictable names |
| L-3 | customers.js | Multiple validation messages not translated to Arabic |
| L-4 | notifications.js | Duplicate notification check logic |
| L-5 | quality.js | `defect_code` stored as string, not FK to `defect_codes` |
| L-6 | accounting.js | Trial balance slow on large ledger (no index hints) |
| L-7 | scheduling.js | Capacity calculation ignores completed orders |
| L-8 | samples.js | No FK check on `customer_id` before insert |
| L-9 | returns.js | No validation that invoice exists before linking |
| L-10 | maintenance.js | `next_maintenance_date` not auto-computed on completion |
| L-11 | mrp.js | Auto-PO doesn't validate supplier exists |
| L-12 | permissions.js | Doesn't validate permission key format |
| L-13 | barcode.js | Sequential search across 10 tables (slow) |
| L-14 | root validators.js | Duplicate file — nearly identical to `utils/validators.js` |
| L-15 | expenses.js | Receipts deleted with document, not soft-deleted |

---

## Soft vs Hard Delete Consistency

| Entity | Type | Notes |
|--------|------|-------|
| Work Orders | Soft (`cancelled`) | ✓ Correct |
| Purchase Orders | Soft (`cancelled`) | ✓ Correct |
| Invoices | **Hard delete** | ✗ Should be soft |
| Employees | Soft (`terminated`) | ✓ Correct |
| Shipments | Soft (`cancelled`) | ✓ Correct |
| Quotations | Soft (`cancelled`) | ✓ Correct |
| MRP Runs | Soft (`cancelled`) | ✓ Correct |
| QC Templates | Soft (`is_active=0`) | ✓ Correct |
| Documents | **Hard delete** | ✗ Should be soft |
| Expenses | Soft (`is_deleted`) | ✓ Correct |

---

## Permission Key Inventory (Mismatches Highlighted)

| Backend Key | Frontend Key | Match? |
|-------------|-------------|--------|
| `work_orders` | `work_orders` | ✓ |
| `purchaseorders` | `purchase_orders` | **✗ MISMATCH** |
| `workorders` (in quotations) | `work_orders` | **✗ MISMATCH** |
| Quality: `read`, `update` | Other: `view`, `edit` | **✗ INCONSISTENT** |
| All other modules | — | ✓ |

---

*End of Phase 1 — Endpoint Audit*
