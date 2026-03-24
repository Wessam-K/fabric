# Phase 3 — Math/Calculation Process Audit

## Critical Formulas Audited

### 1. Work Order Cost Calculation [workorders.js:10-99]

**Formula (backend `calculateWOCost`):**
```
totalPieces = wo.quantity OR SUM(wo_sizes: qty_s + qty_m + ... + qty_3xl)
main_fabric_cost = SUM(batch_fabrics: meters × price_per_meter)  [role != 'lining']
lining_cost = SUM(batch_fabrics: meters × price_per_meter)  [role == 'lining']
waste_cost = SUM(batch_fabrics: waste_meters × price_per_meter)
accessories_cost = SUM(accessories: qty × unit_price)
extra_expenses = SUM(wo_extra_expenses: amount)
masnaiya_total = masnaiya_per_piece × totalPieces
masrouf_total = masrouf_per_piece × totalPieces
total_cost = fabric + lining + accessories + masnaiya + masrouf + waste + extra
cost_per_piece = total_cost / totalPieces  (if > 0)
suggested_consumer = cost_per_piece × (1 + margin_pct / 100)
suggested_wholesale = suggested_consumer × (1 - wholesale_discount_pct / 100)
```

**Status**: ✅ PASS — Logic correct, rounding via `Math.round(v * 100) / 100`, divide-by-zero checked.

**Note**: `wholesale_discount_pct` defaults to string "22" from settings table → `parseFloat` handles it correctly.

---

### 2. Invoice Total Calculation [invoices.js:100-103]

**Formula:**
```
subtotal = SUM(items: quantity × unit_price)
discountAmt = parseFloat(discount) || 0
taxAmt = (subtotal - discountAmt) × (tax_pct / 100)
total = subtotal - discountAmt + taxAmt
```

**Status**: ✅ PASS (after R8 fix)
- R8 added: `if (discountAmt > subtotal) return 400` — prevents negative totals
- Same formula in PO POST and PUT

---

### 3. Auto-Journal Invoice Tax [autojournal.js:76]

**Before R8 (BUG):**
```
taxAmount = subtotal × (tax_pct / 100)     ← WRONG: ignores discount
```

**After R8 FIX:**
```
taxAmount = (subtotal - discount) × (tax_pct / 100)     ← matches invoice formula
```

**Status**: ✅ FIXED — Now consistent with invoice calculation

---

### 4. Auto-Journal PO Receipt Tax [autojournal.js:110]

**Formula (tax-inclusive back-calculation):**
```
totalAmount = po.total_amount   (includes tax)
taxAmount = totalAmount × (taxPct / 100) / (1 + taxPct / 100)
netAmount = totalAmount - taxAmount
```

**Status**: ✅ PASS — Correct tax extraction from inclusive total. The PO `total_amount` is stored as `(subtotal - disc) + (subtotal - disc) × (taxPct / 100)`, which is tax-inclusive.

---

### 5. MRP On-Order Calculation [mrp.js:101]

**Before R8 (BUG):**
```
onOrder = SUM(poi.quantity)   ← counts full PO qty, not remaining
```

**After R8 FIX:**
```
onOrder = SUM(poi.quantity - poi.received_qty)   ← only pending delivery
shortage = MAX(0, required - onHand - onOrder)
```

**Status**: ✅ FIXED

---

### 6. PO PUT Total Recalculation [purchaseorders.js:150-155]

**Before R8 (BUG):**
```
subtotal = items ? calc_from_items : null
totalAmount = subtotal !== null ? recalc : existing.total_amount  ← stale if only tax changed
```

**After R8 FIX:**
```
subtotal = items ? calc_from_items : calc_from_existing_items    ← always recalculated
totalAmount = (subtotal - disc) + (subtotal - disc) × (taxPct / 100)
```

**Status**: ✅ FIXED

---

### 7. Trial Balance [accounting.js:73]

**Formula:**
```sql
SUM(jl.debit) - SUM(jl.credit) AS balance  -- per account
```

**Assessment**: Technically correct for SQLite (exact integer arithmetic for reasonable values). Floating-point risk is theoretical for normal accounting data where amounts are typically 2-decimal currency values. `SUM(debit) - SUM(credit)` ≡ `SUM(debit - credit)` mathematically.

**Status**: ⚠️ LOW RISK — acceptable for current scale

---

### 8. Payroll Calculation [hr.js]

**Overtime hours**: `SUM(overtime_hours)` — counted but **no multiplier applied** (1.5x or 2x).
**Hours worked**: `(checkOut - checkIn) / 3600000` — rounds to 0.1h, **no maximum validation**.

**Status**: ⚠️ NEEDS PRODUCT CONFIRMATION — Is overtime multiplier intentionally excluded? Is there a max shift duration?

---

### 9. Reports Average Cost [reports.js:23]

**Formula**: `AVG(cost_per_piece)` — arithmetic mean, not weighted average.

**Correct formula**: `SUM(total_cost) / SUM(total_pieces)` for weighted average.

**Status**: ⚠️ NEEDS PRODUCT CONFIRMATION — Arithmetic mean may be intentional for "typical cost per WO" vs "weighted cost per piece across all production"

---

### 10. Waste Percentage [reports.js:220-223]

**Formula:**
```sql
CASE WHEN SUM(actual_total_meters) > 0
  THEN ROUND(SUM(waste_meters) * 100.0 / SUM(actual_total_meters), 2)
  ELSE 0 END
```

**Status**: ✅ PASS — Division-by-zero protected, proper rounding.

---

### 11. Frontend Cost Calculation [hooks/useCostCalc.js]

**Formula**: Mirrors backend `calculateWOCost` — same component sum structure.
**safeParse**: `parseFloat(v) || 0` — masks null/undefined as 0 (acceptable for UI preview).

**Status**: ✅ PASS — Consistent with backend, used for real-time preview only.

---

### 12. Number Formatting [formatters.js:3]

**Before R8**: `Math.round(n || 0).toLocaleString('ar-EG')` — loses all decimals
**After R8**: `Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })` — preserves up to 2 decimal places

**Status**: ✅ FIXED (low impact — function was unused but now correct for future use)

## Summary

| # | Formula | File | Status |
|---|---|---|---|
| 1 | WO cost calculation | workorders.js | ✅ PASS |
| 2 | Invoice total | invoices.js | ✅ PASS (R8 guard added) |
| 3 | Auto-journal invoice tax | autojournal.js | ✅ FIXED (R8) |
| 4 | Auto-journal PO tax | autojournal.js | ✅ PASS |
| 5 | MRP on-order | mrp.js | ✅ FIXED (R8) |
| 6 | PO PUT recalc | purchaseorders.js | ✅ FIXED (R8) |
| 7 | Trial balance | accounting.js | ⚠️ Low risk |
| 8 | Payroll overtime | hr.js | ⚠️ Needs confirmation |
| 9 | Reports avg cost | reports.js | ⚠️ Needs confirmation |
| 10 | Waste percentage | reports.js | ✅ PASS |
| 11 | Frontend cost calc | useCostCalc.js | ✅ PASS |
| 12 | Number formatting | formatters.js | ✅ FIXED (R8) |
