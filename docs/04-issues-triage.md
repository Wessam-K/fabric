# 04 — Issues Triage

> Phase 3 deliverable — all findings consolidated, prioritized by severity × impact × risk  
> Baseline commit: `19ddc8b`

---

## Scoring Matrix

| Factor | 1 (Low) | 2 (Medium) | 3 (High) |
|--------|---------|-----------|----------|
| **Severity** | Cosmetic / code quality | Data integrity / business logic | Security / data loss |
| **Impact** | Affects rare edge case | Affects common workflow | Affects every transaction |
| **Risk of Fix** | Complex / cross-cutting | Moderate / needs testing | Isolated / safe |

**Priority = Severity + Impact − Risk** (higher = fix first)

---

## TIER 1 — Fix Immediately (Score 5+)

| ID | Source | Title | Sev | Imp | Risk | Score |
|----|--------|-------|-----|-----|------|-------|
| T1-01 | C-1 | Missing auth on notification endpoints | 3 | 3 | 1 | **5** |
| T1-02 | C-2 | Missing auth on barcode lookup | 3 | 2 | 1 | **4** |
| T1-03 | C-3 | Missing auth on machine stats | 3 | 2 | 1 | **4** |
| T1-04 | MATH-1 | Auto-journal `invoice.tax_amount` doesn't exist | 3 | 3 | 1 | **5** |
| T1-05 | MATH-2 | MRP `consumption_per_piece` wrong column | 3 | 3 | 1 | **5** |
| T1-06 | MATH-3 | MRP `purchase_order_id`/`item_code` wrong columns | 3 | 3 | 1 | **5** |
| T1-07 | MATH-4 | Auto-journal payroll `net_salary` wrong column | 3 | 2 | 1 | **4** |
| T1-08 | MATH-9 | Dashboard payables NULL bug | 2 | 3 | 1 | **4** |
| T1-09 | H-1 | Invoice hard delete | 3 | 2 | 1 | **4** |
| T1-10 | C-4 | Duplicate create-admin with weak validation | 3 | 1 | 1 | **3** |

---

## TIER 2 — Fix This Week (Score 3–4)

| ID | Source | Title | Sev | Imp | Risk | Score |
|----|--------|-------|-----|-----|------|-------|
| T2-01 | H-2 | Invoice status downgrade allowed (paid→draft) | 2 | 3 | 1 | **4** |
| T2-02 | H-3 | Negative invoice line items accepted | 2 | 2 | 1 | **3** |
| T2-03 | H-4 | Incomplete PO receive transaction | 3 | 2 | 2 | **3** |
| T2-04 | H-5 | No over-receipt prevention on PO | 2 | 2 | 1 | **3** |
| T2-05 | MATH-5 | WO finalize double-counts waste | 2 | 2 | 2 | **2** |
| T2-06 | MATH-6 | Invoice tax on pre-discount subtotal | 2 | 3 | 2 | **3** |
| T2-07 | MATH-7 | VAT summary uses global rate | 2 | 2 | 2 | **2** |
| T2-08 | MATH-8 | Quotation vs Invoice tax formula mismatch | 2 | 2 | 2 | **2** |
| T2-09 | H-8 | Permission key mismatches (purchaseorders vs purchase_orders) | 2 | 3 | 1 | **4** |
| T2-10 | H-9 | Missing FK validation on WO create | 2 | 2 | 1 | **3** |
| T2-11 | H-10 | Auto-journal entries auto-posted (no review) | 2 | 2 | 2 | **2** |
| T2-12 | MATH-11 | Bonuses excluded from stored gross_pay | 2 | 2 | 1 | **3** |
| T2-13 | MATH-14 | PO journal uses global tax rate | 2 | 2 | 2 | **2** |
| T2-14 | MATH-15 | MRP ignores V4 batch fabrics | 2 | 2 | 2 | **2** |
| T2-15 | H-11 | MRP column names in auto-PO | 3 | 2 | 1 | **4** |

---

## TIER 3 — Fix This Month (Score 1–2)

| ID | Source | Title | Sev | Imp | Risk | Score |
|----|--------|-------|-----|-----|------|-------|
| T3-01 | H-6 | Completed maintenance orders editable | 2 | 1 | 1 | **2** |
| T3-02 | H-7 | Stock adjustment race condition | 2 | 1 | 1 | **2** |
| T3-03 | M-1–5 | Input validation gaps (rating, phone, negative %) | 1 | 2 | 1 | **2** |
| T3-04 | M-6–10 | Missing pagination on large GET endpoints | 1 | 2 | 1 | **2** |
| T3-05 | M-11–13 | Missing `requirePermission` on GET endpoints | 2 | 2 | 1 | **3** |
| T3-06 | M-14 | Shipping before payment | 1 | 1 | 1 | **1** |
| T3-07 | M-18 | Can edit accepted quotations | 1 | 1 | 1 | **1** |
| T3-08 | M-19 | ZIP upload allowed (zip bomb) | 1 | 1 | 1 | **1** |
| T3-09 | M-20–24 | Inconsistent error/response format | 1 | 2 | 3 | **0** |
| T3-10 | M-22 | HR uses `requireRole` not `requirePermission` | 1 | 1 | 2 | **0** |
| T3-11 | M-28 | Documents hard delete | 1 | 1 | 1 | **1** |
| T3-12 | MATH-10 | Scheduling capacity prorating | 1 | 1 | 2 | **0** |
| T3-13 | MATH-12 | Quality rate multi-stage inflation | 1 | 2 | 2 | **1** |
| T3-14 | MATH-13 | Frontend/backend fabric cost breakdown mismatch | 1 | 1 | 2 | **0** |

---

## TIER 4 — Backlog (Low Priority)

| ID | Source | Title |
|----|--------|-------|
| T4-01 | MATH-16 | Legacy accessories ambiguous quantity |
| T4-02 | MATH-17 | `totalPieces \|\| 1` phantom cost |
| T4-03 | MATH-18 | Hard-coded wholesale multiplier |
| T4-04 | MATH-19 | Fixed deductions not prorated |
| T4-05 | MATH-20 | No negative total guard |
| T4-06 | MATH-21 | No inspection qty validation |
| T4-07 | L-1–L-15 | All LOW severity items from endpoint audit |
| T4-08 | — | Duplicate root validators.js |
| T4-09 | — | `pending` WO status dead code |
| T4-10 | — | Standardize response envelope |

---

## Issue Count by Category

| Category | CRITICAL | HIGH | MEDIUM | LOW | Total |
|----------|----------|------|--------|-----|-------|
| Security / Auth | 4 | 1 | 3 | — | 8 |
| Math / Calculation | 3 | 6 | 5 | 7 | 21 |
| Data Integrity | — | 5 | 2 | — | 7 |
| Business Logic | — | 2 | 5 | 3 | 10 |
| Consistency | — | 1 | 5 | 5 | 11 |
| **Total** | **7** | **15** | **20** | **15** | **57** |

---

*End of Phase 3 — Bug & Issue Triage*
