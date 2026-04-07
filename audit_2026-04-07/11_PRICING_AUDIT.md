# Pricing & Costing Audit

## Cost Formula

$$\text{total\_cost} = \text{main\_fabric} + \text{lining} + \text{accessories} + (\text{masnaiya} \times \text{qty}) + (\text{masrouf} \times \text{qty}) + \text{waste} + \text{extra\_expenses} + \text{subcontract\_cost}$$

$$\text{cost\_per\_piece} = \frac{\text{total\_cost}}{\text{total\_pieces}}$$

$$\text{consumer\_price} = \text{cost\_per\_piece} \times (1 + \frac{\text{margin\_pct}}{100})$$

$$\text{wholesale\_price} = \text{consumer\_price} \times (1 - \frac{\text{wholesale\_discount\_pct}}{100})$$

---

## Key Terms

| Term | Arabic | Meaning | Default |
|---|---|---|---|
| **Masnaiya** | مصنعية | Labor cost per piece | 90 |
| **Masrouf** | مصروف | Overhead cost per piece | 50 |
| **Margin** | هامش الربح | Markup on cost for pricing | 25% |
| **Wholesale Discount** | خصم الجملة | Discount off consumer price | 22% |

---

## Cascade: Settings → BOM Template → Work Order

Each WO inherits defaults from its BOM template, which inherits from settings. Users can override at each level.

---

## Money.js Safe Arithmetic

| Function | Purpose |
|---|---|
| `round2(amount)` | Round to 2 decimal places |
| `toPiasters(amount)` | Convert to integer cents (×100) |
| `safeAdd(...amounts)` | Float-safe addition via piasters |
| `safeMultiply(a, b)` | Float-safe multiplication |
| `safeSubtract(a, b)` | Float-safe subtraction |

---

## Bugs Found

### PRICE-1: calculateWOCost uses plain arithmetic — HIGH
Core cost function uses `+` operators, not `safeAdd`. Invoices use safe arithmetic but WO costing doesn't. Floating-point drift accumulates with many fabric batches.

### PRICE-2: Finalize omits subcontract_cost — HIGH
The finalize endpoint computes total cost without `subcontract_cost`. Completed WOs with subcontracting will show understated final costs.

### PRICE-3: Lining waste dropped in legacy path — MEDIUM
BOM matrix applies waste % to both main and lining fabrics. `calculateWOCost` legacy path only applies waste to main fabrics. Lining waste cost silently lost.

### PRICE-4: BOM vs WO waste presentation — MEDIUM
BOM matrix folds waste into fabric cost. WO calculation shows waste as separate line item. Same total, but side-by-side comparison confusing.

### PRICE-5: Partial invoices disconnected from invoices — MEDIUM
`partial_invoices.invoice_id` FK column is never populated. Partial deliveries can't be reconciled with customer invoices.

### PRICE-6: cost_snapshot masnaiya/masrouf store totals — LOW
Columns store totals (qty × rate) but namesake fields on WO/BOM store per-piece rates. Naming inconsistency.

### PRICE-7: Finalize shadows round2 locally — LOW
Local `round2` definition shadows imported money.js version. Fragile if utility changes.

### PRICE-8: No intermediate rounding — LOW
Cost accumulations use bare `+=` on floats, only rounded at end. Many batches → drift.
