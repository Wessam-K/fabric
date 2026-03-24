# 03 — Math & Process Correctness Audit

> Phase 2 deliverable — every calculation checked for correctness  
> Baseline commit: `19ddc8b`

---

## Bug Summary

| # | Severity | Module | Description |
|---|----------|--------|-------------|
| MATH-1 | **CRITICAL** | autojournal | `invoice.tax_amount` column doesn't exist — tax never separated from revenue |
| MATH-2 | **CRITICAL** | mrp | Wrong column `consumption_per_piece` — fabric shortages never detected |
| MATH-3 | **CRITICAL** | mrp | Wrong join columns `purchase_order_id`/`item_code` — on-order always 0 |
| MATH-4 | **HIGH** | autojournal | `net_salary` column doesn't exist — payroll journal always 0 |
| MATH-5 | **HIGH** | workorders | Finalize may double-count waste cost |
| MATH-6 | **HIGH** | invoices | Tax calculated on pre-discount subtotal (overcharges) |
| MATH-7 | **HIGH** | accounting | VAT summary uses global rate, ignores per-PO `tax_pct` |
| MATH-8 | **HIGH** | quotations/invoices | Tax formula inconsistency between modules |
| MATH-9 | **HIGH** | dashboard | `NULL paid_amount` underreports outstanding payables |
| MATH-10 | **MEDIUM** | scheduling | Capacity uses full WO qty, not daily rate |
| MATH-11 | **MEDIUM** | hr | Bonuses excluded from stored `gross_pay` |
| MATH-12 | **MEDIUM** | dashboard | Quality rate inflated by multi-stage counting |
| MATH-13 | **MEDIUM** | frontend | `main_fabric_cost` breakdown differs from backend |
| MATH-14 | **MEDIUM** | autojournal | PO receipt journal uses global tax rate |
| MATH-15 | **MEDIUM** | mrp | V4 batch fabrics ignored — only queries `wo_fabrics` |
| MATH-16 | **LOW** | workorders | Legacy accessories ambiguous `quantity` semantics |
| MATH-17 | **LOW** | workorders | `totalPieces \|\| 1` masks zero-quantity WOs |
| MATH-18 | **LOW** | workorders | Hard-coded `× 0.78` wholesale multiplier |
| MATH-19 | **LOW** | hr | Fixed deductions not pro-rated for partial-month workers |
| MATH-20 | **LOW** | invoices | No guard against negative totals |
| MATH-21 | **LOW** | quality | No `passed + failed == sample_size` validation |
| MATH-22 | **LOW** | hr | Late deduction uses hourly rate (business logic concern) |

---

## Detailed Findings

### 1. Work Orders — `calculateWOCost()`

**Correct formulas:**
```
total_pieces = wo.quantity (or SUM of size breakdown if size-based)
fabric_cost = meters_per_piece × totalPieces × price_per_meter
waste_cost = fabric_cost × (waste_pct / 100)     [legacy path]
waste_cost = waste_meters × price_per_meter       [V4 batch path]
total_cost = fabric + lining + accessories + masnaiya + masrouf + waste + extras
cost_per_piece = total_cost / total_pieces
suggested_consumer = cost_per_piece × (1 + margin / 100)
suggested_wholesale = suggested_consumer × 0.78   [HARD-CODED]
```

**MATH-5 — Finalize double-counts waste:**
```js
// finalize sums waste from wo_waste AND wo_fabric_batches
const totalCost = useFabricCost + useAccessoryCost + wasteCost + ...
```
Problem: `useFabricCost` from V8 consumption tables may already include waste in the meter cost. Adding `wasteCost` separately double-counts it.

**MATH-17 — Zero-quantity fallback:**
```js
const meters = (f.meters_per_piece || 0) * (totalPieces || 1);
```
When `totalPieces=0`, this uses 1, creating phantom fabric cost.

### 2. Invoices

**MATH-6 — Tax on pre-discount subtotal:**
```js
const taxAmt = subtotal * (tax_pct / 100);       // tax on FULL subtotal
const total = subtotal + taxAmt - discount;        // discount applied AFTER
```
Correct formula: `taxAmt = (subtotal - discount) * (tax_pct / 100)`

Example: Subtotal=$1000, Discount=10%, Tax=14%
- Current: `$1000 × 0.14 = $140 tax → total = $1000 + $140 - $100 = $1,040`
- Correct: `($1000 - $100) × 0.14 = $126 tax → total = $900 + $126 = $1,026`
- Overcharge: **$14**

### 3. Invoice vs Quotation Tax Inconsistency (MATH-8)

| Module | Formula | Result ($1000, 10% disc, 14% tax) |
|--------|---------|----------------------------------|
| Quotations | Tax on (subtotal − discount) | **$1,026** ✓ correct |
| Invoices | Tax on subtotal, then − discount | **$1,040** ✗ overcharges |
| PO | Same as invoices | **$1,040** ✗ |

Converting quotation → SO → invoice produces mismatched totals.

### 4. Auto-Journal — Critical Bugs

**MATH-1 — `invoice.tax_amount` doesn't exist:**
```js
const taxAmount = invoice.tax_amount || 0;  // ALWAYS 0 — column is undefined
```
Table stores `tax_pct` (percentage), not `tax_amount` (computed). Tax payable line is never recorded.

Fix: `const taxAmount = (invoice.subtotal || 0) * ((invoice.tax_pct || 0) / 100);`

**MATH-4 — `net_salary` column doesn't exist:**
```js
SELECT COALESCE(SUM(net_salary),0) ... FROM payroll_records
```
Actual column is `net_pay`. Payroll journal entries always debit $0.

### 5. MRP — Critical Column Mismatches

**MATH-2 — Wrong fabric column:**
```js
fabricNeeds[key].required += (wf.consumption_per_piece || 0) * totalPieces;
// Actual column: meters_per_piece → result: always 0
```

**MATH-3 — Wrong join/filter columns:**
```js
JOIN purchase_orders po ON po.id=poi.purchase_order_id  // actual: poi.po_id
WHERE poi.item_code=?  // actual: poi.fabric_code or poi.accessory_code
```

Result: MRP never detects fabric shortages and never counts on-order quantities.

### 6. Dashboard

**MATH-9 — NULL payables:**
```sql
SUM(total_amount - paid_amount)  -- NULL when paid_amount is NULL
```
Fix: `SUM(total_amount - COALESCE(paid_amount, 0))`

**MATH-12 — Quality rate:**
```sql
SUM(quantity_completed) FROM wo_stages  -- counts per-stage, not per-piece
```
A piece through 5 stages = 5 "completions". Inflates quality rate.

### 7. HR Payroll

**MATH-11 — Bonuses excluded from `gross_pay`:**
```js
const gross_pay = base_pay + overtime_pay + allowances;  // bonuses NOT included
const net_pay = Math.max(0, (gross_pay + bonuses) - total_deductions);
```
`gross_pay` stored in DB is lower than actual earnings. Period summary `total_gross` will be wrong.

### 8. Scheduling

**MATH-10 — Capacity uses full WO qty:**
```sql
SUM(wo.quantity) ... WHERE ps.planned_start <= date AND ps.planned_end >= date
```
WO with 1000 pieces over 10 days shows as 1000/day capacity usage. Should prorate: `wo.quantity / days_in_schedule`.

### 9. Accounting VAT

**MATH-7 — Global rate for purchase VAT:**
```js
const vatRate = (parseFloat(vatSetting?.value) || 14) / 100;
const purchaseVat = purchases.total * vatRate / (1 + vatRate);
```
Each PO has its own `tax_pct`. This applies 14% universally. POs with 0% tax produce phantom VAT.

---

## Verified Correct Calculations

| Module | Calculation | Status |
|--------|-------------|--------|
| Accounting | Journal debit/credit balance validation | ✓ |
| Accounting | Trial balance (SUM debits − SUM credits, posted only) | ✓ |
| PO | Payment recalculation from source records | ✓ |
| MRP | Shortage formula `MAX(0, required − onHand − onOrder)` | ✓ (correct formula, wrong inputs) |
| Expenses | Amount summation with proper filters | ✓ |
| Shipping | No arithmetic — stores user input | ✓ |
| Quality | Dashboard % formula itself | ✓ (wrong input data) |
| HR | Net pay formula `MAX(0, gross + bonuses − deductions)` | ✓ (correct formula, wrong gross) |

---

*End of Phase 2 — Math & Process Correctness Audit*
