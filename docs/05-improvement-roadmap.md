# 05 — Improvement Roadmap

> Phase 4 deliverable — phased plan: A (Stability) → B (Reliability) → C (Performance) → D (Maintainability)  
> Baseline commit: `19ddc8b`
>
> **Update (Phase R, 2026-04-06)**: Items A9 (invoice hard delete → soft-delete) resolved for all 7 entity types. CSV formula injection fixed. Avatar upload auth fixed. Comprehensive E2E test suite rewritten (16 phases). Full seed data rewrite covering all entities.

---

## Phase A — Stability (Immediate: fix broken behavior)

**Goal**: Every endpoint is secure, every calculation produces correct results.

| # | Issue ID | Fix | Files Changed | Tests Needed |
|---|----------|-----|---------------|-------------|
| A1 | T1-01 | Add `requireAuth` to notification routes | notifications.js | Auth rejection test |
| A2 | T1-02 | Add `requireAuth` to barcode route | barcode.js | Auth rejection test |
| A3 | T1-03 | Add `requirePermission('machines','view')` to stats | machines.js | Auth rejection test |
| A4 | T1-04 | Fix auto-journal invoice tax: use `subtotal × tax_pct / 100` | autojournal.js | Journal amounts test |
| A5 | T1-05 | Fix MRP column: `consumption_per_piece` → `meters_per_piece` | mrp.js | MRP calc test |
| A6 | T1-06 | Fix MRP joins: `po_id`, `fabric_code`/`accessory_code` | mrp.js | MRP on-order test |
| A7 | T1-07 | Fix payroll journal: `net_salary` → `net_pay` | autojournal.js | Payroll journal test |
| A8 | T1-08 | Fix dashboard payables: `COALESCE(paid_amount, 0)` | server.js | Dashboard totals test |
| A9 | T1-09 | Convert invoice DELETE to soft-cancel | invoices.js | Soft-delete test |
| A10 | T1-10 | Remove duplicate `/api/setup/create-admin` from server.js | server.js | Setup flow test |

**Estimated scope**: 7 files, ~50 lines changed. All fixes are isolated, low risk.

---

## Phase B — Reliability (This Week: prevent data corruption)

**Goal**: Status transitions enforced, negative values blocked, transactions complete.

| # | Issue ID | Fix | Files Changed |
|---|----------|-----|---------------|
| B1 | T2-01 | Add invoice status transition map (block paid→draft) | invoices.js |
| B2 | T2-02 | Validate qty≥0, unit_price≥0 on invoice items | invoices.js |
| B3 | T2-03 | Wrap full PO receive in `db.transaction()` | purchaseorders.js |
| B4 | T2-04 | Validate `totalReceived ≤ orderedQty` in receive | purchaseorders.js |
| B5 | T2-06 | Fix invoice tax to post-discount: `(subtotal-discount)×tax_pct/100` | invoices.js |
| B6 | T2-09 | Fix permission key: `purchaseorders` → `purchase_orders` | purchaseorders.js |
| B7 | T2-10 | Validate model_id/template_id FK before WO insert | workorders.js |
| B8 | T2-12 | Include bonuses in stored `gross_pay` | hr.js |
| B9 | T2-15 | Fix MRP auto-PO column names | mrp.js |
| B10 | T3-05 | Add `requirePermission` to unguarded GET endpoints | workorders.js, invoices.js, purchaseorders.js |

**Estimated scope**: 6 files, ~100 lines changed. Needs careful testing of existing workflows.

---

## Phase C — Correctness (This Month: math & business logic alignment)

**Goal**: Financial calculations consistent, VAT correct, MRP accurate.

| # | Issue ID | Fix | Files Changed |
|---|----------|-----|---------------|
| C1 | T2-05 | Fix WO finalize waste double-count | workorders.js |
| C2 | T2-07 | VAT summary: use per-PO `tax_pct` instead of global rate | accounting.js |
| C3 | T2-08 | Align PO tax formula with quotation (post-discount) | purchaseorders.js |
| C4 | T2-11 | Auto-journal: create as `draft` by default | autojournal.js |
| C5 | T2-13 | PO journal: use `po.tax_pct` instead of global | autojournal.js |
| C6 | T2-14 | MRP: also query `wo_fabric_batches` for V4 WOs | mrp.js |
| C7 | T3-01 | Block edits to completed/cancelled maintenance orders | maintenance.js |
| C8 | T3-02 | Use atomic stock update for accessories | accessories.js |
| C9 | T3-03 | Add input validation (rating 1-5, phone, positive %) | suppliers.js, customers.js, quotations.js, machines.js |
| C10 | T3-04 | Add default pagination to large GET endpoints | models.js, fabrics.js, accessories.js, suppliers.js |

**Estimated scope**: 10 files, ~200 lines changed.

---

## Phase D — Maintainability (Backlog: code quality & consistency)

**Goal**: Consistent patterns, dead code removed, documentation added.

| # | Issue ID | Fix |
|---|----------|-----|
| D1 | T3-09 | Standardize response envelope `{success, data, message}` |
| D2 | T3-10 | Convert HR routes from `requireRole` to `requirePermission` |
| D3 | T4-08 | Remove duplicate root validators.js |
| D4 | T4-10 | Standardize API response format |
| D5 | T3-11 | Convert document DELETE to soft-delete |
| D6 | T3-13 | Fix quality rate to use final stage only |
| D7 | T3-14 | Align frontend/backend fabric cost breakdown |
| D8 | T3-12 | Prorate scheduling capacity |
| D9 | T4-03 | Make wholesale multiplier configurable via settings |
| D10 | T4-09 | Remove `pending` from WO transitions or add to UI |

**Estimated scope**: Large refactor, cross-cutting. Defer to separate sprint.

---

## Implementation Order for Phase 5

```
Phase A (10 fixes) → Run tests → Commit
Phase B (10 fixes) → Run tests → Commit
Phase C (10 fixes) → Run tests → Commit
Phase D → Separate PR / sprint
```

Each fix should:
1. Read the affected code to understand current behavior
2. Make the minimal change required
3. Verify with existing tests (58/58 must still pass)
4. Add targeted test if the fix introduces new behavior

---

*End of Phase 4 — Improvement Roadmap*
