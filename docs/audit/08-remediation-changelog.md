# Phase 8 — Remediation Changelog (Audit Round 8)

## Fixes Implemented

### R8-01: Auto-Journal Invoice Tax Calculation (CRITICAL)
- **File**: `backend/routes/autojournal.js:76`
- **Before**: `taxAmount = subtotal × (tax_pct / 100)` — ignores discount
- **After**: `taxAmount = (subtotal - discount) × (tax_pct / 100)` — matches invoice formula
- **Impact**: Journal entries were unbalanced when invoices had discounts. Example: Invoice with subtotal=100, discount=10, tax=10% → invoice tax=9, journal tax=10 → 1 unit imbalance per entry.
- **Regression Risk**: LOW — formula now matches invoice calculation exactly
- **Test**: Existing 58 tests pass; manual verification needed for auto-journal with discounted invoice

### R8-02: Frontend Number Formatter (MEDIUM)
- **File**: `frontend/src/utils/formatters.js:3`
- **Before**: `Math.round(n).toLocaleString('ar-EG')` — rounds to nearest integer, loses all decimals
- **After**: `Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })` — preserves up to 2 decimal places
- **Impact**: LOW — function currently unused by any page components
- **Regression Risk**: NONE — no consumers

### R8-03: MRP On-Order Double-Count (CRITICAL)
- **File**: `backend/routes/mrp.js:101, :115`
- **Before**: `SUM(poi.quantity)` — counts full PO quantity including already-received
- **After**: `SUM(poi.quantity - poi.received_qty)` — counts only pending delivery
- **Impact**: MRP suggested 0 shortages when POs existed (even partially received), leading to missed reorders
- **Regression Risk**: LOW — strictly more accurate; cannot over-reduce

### R8-04: PO PUT Tax-Only Recalculation (CRITICAL)
- **File**: `backend/routes/purchaseorders.js:150-155`
- **Before**: Skipped total recalculation when `items` not provided; total stayed stale if only `tax_pct` or `discount` changed
- **After**: Always recalculates from existing items if items not provided in request body
- **Regression Risk**: LOW — total is always recalculated, not cached from stale value

### R8-05: Discount > Subtotal Guard (CRITICAL)
- **Files**: `invoices.js` (POST + PUT), `purchaseorders.js` (POST)
- **Before**: No validation — discount=150 on subtotal=100 → negative total (-55)
- **After**: Returns 400 with "الخصم لا يمكن أن يتجاوز المجموع الفرعي" if discount > subtotal
- **Regression Risk**: LOW — only blocks invalid data; existing valid data unaffected

### R8-06: Error Message Leaks (HIGH)
- **Files**: `server.js` (3 endpoints + global handler), `backups.js`
- **Before**: `err.message` exposed to client in dashboard, search, setup, backup, and global error handler
- **After**: Generic Arabic error messages in all cases
- **Regression Risk**: NONE — only changes error response text

## Files Modified

| File | Changes |
|---|---|
| `backend/routes/autojournal.js` | Tax calculation includes discount |
| `backend/routes/mrp.js` | On-order uses `quantity - received_qty` (2 queries) |
| `backend/routes/purchaseorders.js` | Total recalc from existing items + discount guard |
| `backend/routes/invoices.js` | Discount > subtotal guard (POST + PUT) |
| `backend/server.js` | 4 error leaks fixed (setup, dashboard, search, global handler) |
| `backend/routes/backups.js` | Backup error leak fixed |
| `frontend/src/utils/formatters.js` | fmtNum preserves decimals |

## Verification

- **Tests**: 58/58 passing ✅
- **Frontend Build**: 2545 modules, 0 errors ✅
- **Duration**: 530ms test, 9.3s build
