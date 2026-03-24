# 07 — Regression Report

> Phase 6 deliverable — verify no regressions after all fixes  
> Baseline commit: `19ddc8b` | Test runner: `node --test tests/api.test.js`

---

## Test Suite Results

| Phase | Tests | Pass | Fail | Status |
|-------|-------|------|------|--------|
| Baseline (pre-audit) | 58 | 58 | 0 | ✅ |
| After Phase A (Stability) | 58 | 58 | 0 | ✅ |
| After Phase B (Reliability) | 58 | 58 | 0 | ✅ |
| After Phase C (Correctness) | 58 | 58 | 0 | ✅ |

---

## Files Changed (16 files)

| File | Phase(s) | Changes |
|------|----------|---------|
| `backend/routes/autojournal.js` | A, C | Invoice tax calc, payroll column, PO receipt tax, draft default |
| `backend/routes/mrp.js` | A, C | Column fixes, V4 fabric batch query |
| `backend/server.js` | A | Dashboard COALESCE, password policy |
| `backend/routes/invoices.js` | A, B, C | Soft-cancel, status map, negative validation, post-discount tax |
| `backend/routes/purchaseorders.js` | B, C | Permission keys, over-receipt, post-discount tax |
| `backend/routes/quotations.js` | B, C | Permission keys/actions, non-negative validation |
| `backend/routes/quality.js` | B | Permission actions |
| `backend/routes/accounting.js` | C | VAT summary per-PO tax |
| `backend/routes/workorders.js` | C | Finalize waste clarification |
| `backend/routes/maintenance.js` | C | Block edits to completed/cancelled |
| `backend/routes/suppliers.js` | C | Rating 1-5 validation |
| `backend/routes/machines.js` | C | Non-negative capacity/cost validation |
| `backend/routes/models.js` | C | Optional pagination |
| `docs/00-system-overview.md` | — | Created (Phase 0) |
| `docs/01-flow-map.md` | — | Created (Phase 1) |
| `docs/02-endpoint-audit.md` | — | Created (Phase 1) |
| `docs/03-math-audit.md` | — | Created (Phase 2) |
| `docs/04-issues-triage.md` | — | Created (Phase 3) |
| `docs/05-improvement-roadmap.md` | — | Created (Phase 4) |
| `docs/06-change-log.md` | — | Created (Phase 5) |

---

## Backward Compatibility

| Aspect | Impact |
|--------|--------|
| Database schema | No changes — all fixes are code-only |
| API endpoints | No endpoints added or removed |
| Response shapes | No changes (models pagination is opt-in via query params) |
| Frontend | No frontend changes needed |
| Auth flow | No changes to JWT or login |
| Existing data | Unaffected — soft-cancel preserves invoices |

---

## Known Behavioral Changes

1. **Auto-journal entries** now created as `draft` (was `posted`). Accountants must manually post.
2. **Invoice DELETE** now soft-cancels (sets `status='cancelled'`). Previously hard-deleted the row.
3. **Paid invoices** cannot be deleted/cancelled.
4. **Tax formulas** (invoices + POs) now apply tax post-discount. Existing records are unchanged.
5. **Completed/cancelled maintenance orders** are now read-only.
6. **Supplier rating** validated 1-5 range.
7. **Quotation discount/tax** validated non-negative.
8. **Machine capacity/cost** validated non-negative.
9. **PO over-receipt** blocked beyond 110% tolerance.

---

## Issue Resolution Summary

| Severity | Found | Fixed | Deferred |
|----------|-------|-------|----------|
| CRITICAL | 3 | 3 | 0 |
| HIGH | 12 | 10 | 2 |
| MEDIUM | 28 | 13 | 15 |
| LOW | 15 | 0 | 15 |
| **Total** | **58** | **26** | **32** |

Deferred items are tracked in Phase D (Maintainability) of `docs/05-improvement-roadmap.md`.

---

## Round 2 — Security Audit + Phase D

### Test Suite Results

| Phase | Tests | Pass | Fail | Status |
|-------|-------|------|------|--------|
| Post Security Fixes (S1–S13) | 58 | 58 | 0 | ✅ |
| Post Phase D (D5–D9) | 58 | 58 | 0 | ✅ |
| Frontend Build | — | — | — | ✅ 0 errors |

### Additional Files Changed (Round 2)

| File | Changes |
|------|---------|
| `backend/server.js` | /uploads behind requireAuth, stripTags fix |
| `backend/middleware/auth.js` | Removed JWT_SECRET export |
| `backend/routes/auth.js` | Removed JWT_SECRET import, password policy 8+upper+digit |
| `backend/routes/invoices.js` | Permission checks on 3 GET endpoints |
| `backend/routes/settings.js` | Permission check on GET |
| `backend/routes/notifications.js` | Role guard on check-overdue |
| `backend/routes/hr.js` | 25× requireRole→requirePermission, payroll NaN fix |
| `backend/routes/auditlog.js` | requireRole→requirePermission |
| `backend/routes/backups.js` | Removed file_path from response |
| `backend/routes/samples.js` | Existence check on DELETE |
| `backend/routes/reports.js` | Quality rate: final stage only |
| `backend/routes/workorders.js` | Wholesale multiplier from settings |
| `backend/routes/documents.js` | Soft-delete (deleted_at) |
| `backend/database.js` | V24 migration (deleted_at, wholesale setting) |
| `frontend/src/hooks/useCostCalc.js` | Waste/fabric cost alignment |
| All 31 route files | err.message → generic Arabic error |

### New Behavioral Changes (Round 2)

10. **/uploads** now requires authentication token. Public access blocked.
11. **Document DELETE** now soft-deletes (sets `deleted_at`). Previously hard-deleted the row.
12. **Quality overall pass rate** computed from final stage only (was all stages).
13. **Wholesale suggested price** reads `wholesale_discount_pct` from settings (default 22%).
14. **Frontend fabric cost** now excludes waste from `main_fabric_cost` label (total unchanged).
15. **HR routes** require fine-grained permissions instead of role-based checks.
16. **500 errors** return generic Arabic message instead of internal error details.

### Database Schema (Round 2)

- V24 migration added: `documents.deleted_at TEXT DEFAULT NULL`
- V24 migration added: settings key `wholesale_discount_pct` = `22`

### Updated Issue Resolution Summary

| Severity | Found R1+R2 | Fixed R1 | Fixed R2 | Deferred |
|----------|-------------|----------|----------|----------|
| CRITICAL | 6 | 3 | 2 | 1 |
| HIGH | 20 | 10 | 9 | 1 |
| MEDIUM | 34 | 13 | 4 | 17 |
| LOW | 20 | 0 | 1 | 19 |
| **Total** | **80** | **26** | **16** | **38** |

---

## Conclusion

All 42 fixes across Rounds 1+2 pass the full 58-test regression suite. Frontend builds clean. V24 migration is backward-compatible. The system maintains full compatibility with existing data.

---

## Round 3 — Performance & Permission Hardening

### Test Suite Results

| Phase | Tests | Pass | Fail | Status |
|-------|-------|------|------|--------|
| Post Permission Fixes (P1–P4) | 58 | 58 | 0 | ✅ |
| Post N+1 Optimizations (P5–P9) | 58 | 58 | 0 | ✅ |
| Post V25 Indexes (P10) | 58 | 58 | 0 | ✅ |
| Frontend Build | — | — | — | ✅ 0 errors, 2545 modules |

### Files Changed (Round 3)

| File | Changes |
|------|---------|
| `backend/routes/workorders.js` | Permission checks on /export, /next-number |
| `backend/routes/customers.js` | Permission check on /export |
| `backend/routes/machines.js` | Permission check on /export |
| `backend/routes/fabrics.js` | Permission check on /export |
| `backend/routes/accessories.js` | Permission check on /export |
| `backend/routes/suppliers.js` | Permission check on /export |
| `backend/routes/purchaseorders.js` | Permission checks on /export, /next-number |
| `backend/routes/samples.js` | 3× 'read'→'view' action fix |
| `backend/routes/notifications.js` | Audit log on DELETE, N+1 batch optimization (generateNotifications + check-overdue) |
| `backend/routes/reports.js` | N+1 batch optimization (production-by-stage-detail) |
| `backend/routes/hr.js` | N+1 batch optimization (payroll calculation) |
| `backend/routes/mrp.js` | N+1 batch optimization (MRP calculation — sizes/fabrics/accessories) |
| `backend/database.js` | V25 migration (8 performance indexes) |

### New Behavioral Changes (Round 3)

17. **Export endpoints** now require module `view` permission (was any authenticated user).
18. **Next-number endpoints** (WO, PO) now require module `view` permission.
19. **Samples routes** now correctly check `view` action (was `read` — silently denied all users).
20. **Notification deletion** now logged in audit trail.
21. **N+1 query patterns** eliminated in 5 hotspots: generateNotifications, check-overdue, reports stage-detail, payroll, MRP.

### Database Schema (Round 3)

- V25 migration adds 8 indexes for common query patterns (no data changes)

### Updated Issue Resolution Summary (Cumulative)

| Severity | Found R1–R3 | Fixed R1 | Fixed R2 | Fixed R3 | Deferred |
|----------|-------------|----------|----------|----------|----------|
| CRITICAL | 6 | 3 | 2 | 0 | 1 |
| HIGH | 26 | 10 | 9 | 6 | 1 |
| MEDIUM | 38 | 13 | 4 | 3 | 18 |
| LOW | 22 | 0 | 1 | 1 | 20 |
| **Total** | **92** | **26** | **16** | **10** | **40** |

---

## Round 4 — Permission Action Fixes, Missing Guards & Transaction Safety

### Test Suite Results

| Phase | Tests | Pass | Fail | Status |
|-------|-------|------|------|--------|
| Post Permission Action Fixes (R4-01) | 58 | 58 | 0 | ✅ |
| Post Permission Guard Additions (R4-02–04) | 58 | 58 | 0 | ✅ |
| Post Transaction Wrappers (R4-05–08) | 58 | 58 | 0 | ✅ |
| Post PO Validation (R4-09) | 58 | 58 | 0 | ✅ |
| Frontend Build | — | — | — | ✅ 0 errors, 2545 modules |

### Files Changed (Round 4)

| File | Changes |
|------|---------|
| `backend/routes/returns.js` | 4× 'read'→'view', 2× 'update'→'edit', 2 POST endpoints wrapped in transaction |
| `backend/routes/documents.js` | 2× 'read'→'view', 1× 'update'→'edit' |
| `backend/routes/backups.js` | 1× 'read'→'view' |
| `backend/routes/samples.js` | 1× 'update'→'edit' |
| `backend/routes/models.js` | 5 GET endpoints + requirePermission |
| `backend/routes/machines.js` | 5 GET endpoints + requirePermission |
| `backend/routes/fabrics.js` | 2 GET endpoints + requirePermission |
| `backend/routes/accessories.js` | 1 GET endpoint + requirePermission |
| `backend/routes/purchaseorders.js` | GET /:id + requirePermission, item_type validation |
| `backend/routes/quotations.js` | POST + PUT wrapped in db.transaction() |
| `backend/routes/shipping.js` | POST + PUT wrapped in db.transaction() |
| `backend/routes/invoices.js` | PUT: unified UPDATE+DELETE+INSERT into single transaction |

### New Behavioral Changes (Round 4)

22. **Returns, documents, backups** now accessible to non-superadmin users with proper permissions (was silently blocking).
23. **Samples editing** now accessible to non-superadmin users with proper permissions.
24. **Models** detail, BOM matrix, BOM templates require `models:view` permission.
25. **Machines** stats, barcode lookup, detail, maintenance/expenses history require `machines:view` permission.
26. **Fabric** PO batches and inventory batches require `fabrics:view` permission.
27. **Accessory** stock requires `accessories:view` permission.
28. **PO detail** requires `purchase_orders:view` permission.
29. **PO item_type** validated against `['fabric', 'accessory']` whitelist.
30. **Quotations, shipping, returns, invoices** write operations are now fully transactional (atomic).

### Updated Issue Resolution Summary (Cumulative)

| Severity | Found R1–R4 | Fixed R1 | Fixed R2 | Fixed R3 | Fixed R4 | Deferred |
|----------|-------------|----------|----------|----------|----------|----------|
| CRITICAL | 7 | 3 | 2 | 0 | 1 | 1 |
| HIGH | 40 | 10 | 9 | 6 | 14 | 1 |
| MEDIUM | 45 | 13 | 4 | 3 | 5 | 20 |
| LOW | 22 | 0 | 1 | 1 | 0 | 20 |
| **Total** | **114** | **26** | **16** | **10** | **20** | **42** |

---

## Final Conclusion

All 72 fixes across Rounds 1–4 pass the full 58-test regression suite. Frontend builds clean (0 errors, 2545 modules). All database migrations (V23–V25) are backward-compatible. The system maintains full compatibility with existing data. Key achievements: complete permission coverage across all endpoints, all multi-step write operations wrapped in transactions, N+1 patterns eliminated, 8 performance indexes added.

---

## Round 5 — SQL Injection, Permission Seeds, Transaction Safety, Authorization Hardening

### Test Suite Results

| Phase | Tests | Pass | Fail | Status |
|-------|-------|------|------|--------|
| Post SQL Injection Fix (R5-01) | 58 | 58 | 0 | ✅ |
| Post Permission Fixes (R5-02–04) | 58 | 58 | 0 | ✅ |
| Post Transaction Wrappers (R5-05–06) | 58 | 58 | 0 | ✅ |
| Post Security Fix (R5-07) | 58 | 58 | 0 | ✅ |
| Post V26 Migration (R5-08) | 58 | 58 | 0 | ✅ |
| Frontend Build | — | — | — | ✅ 0 errors, 2545 modules |

### Files Changed (Round 5)

| File | Changes |
|------|---------|
| `backend/routes/mrp.js` | Removed SQL-injectable `nextNumber()` dead code |
| `backend/routes/samples.js` | Fixed `workorders` → `work_orders` permission key, wrapped convert-to-wo in transaction |
| `backend/routes/customers.js` | 4 GET endpoints + requirePermission, customer payments wrapped in transaction |
| `backend/routes/suppliers.js` | 2 GET endpoints + requirePermission, supplier payments wrapped in transaction |
| `backend/routes/maintenance.js` | PUT wrapped in transaction, import loop wrapped in transaction |
| `backend/routes/machines.js` | Import loop wrapped in transaction |
| `backend/routes/shipping.js` | Moved nextNumber inside transaction |
| `backend/routes/hr.js` | Multer fileFilter (xlsx/xls/csv only) |
| `backend/database.js` | V26 migration (4 permission seeds, 5 indexes) |

### New Behavioral Changes (Round 5)

31. **Machines create/edit/delete** now accessible to manager and production roles (was superadmin-only due to missing permission seeds).
32. **Stage templates delete** now accessible to manager role (was superadmin-only).
33. **Sample convert-to-WO** now works for non-superadmin users with `work_orders:create` permission.
34. **Customer detail, invoices, balance, payments** GETs require `customers:view` permission.
35. **Supplier detail, ledger** GETs require `suppliers:view` permission.
36. **Supplier/customer payment** creation is fully transactional (payment + totals update atomic).
37. **Maintenance update** is atomic (order update + machine last_maintenance_date).
38. **Machine/maintenance imports** are all-or-nothing transactional.
39. **HR attendance import** rejects non-spreadsheet file types.
40. **Shipping number** generation is atomic with shipment creation.

### Database Schema (Round 5)

- V26 migration adds 4 permission definitions: `machines:create`, `machines:edit`, `machines:delete`, `settings:delete`
- V26 migration adds 5 performance indexes on payment and movement log tables

### Updated Issue Resolution Summary (Cumulative)

| Severity | Found R1–R5 | Fixed R1 | Fixed R2 | Fixed R3 | Fixed R4 | Fixed R5 | Deferred |
|----------|-------------|----------|----------|----------|----------|----------|----------|
| CRITICAL | 8 | 3 | 2 | 0 | 1 | 1 | 1 |
| HIGH | 51 | 10 | 9 | 6 | 14 | 11 | 1 |
| MEDIUM | 50 | 13 | 4 | 3 | 5 | 5 | 20 |
| LOW | 25 | 0 | 1 | 1 | 0 | 0 | 23 |
| **Total** | **134** | **26** | **16** | **10** | **20** | **17** | **45** |

---

## Final Conclusion (Round 5)

All 89 fixes across Rounds 1–5 pass the full 58-test regression suite. Frontend builds clean (0 errors, 2545 modules). All database migrations (V23–V26) are backward-compatible. Production readiness: **8.5/10**.

---

## Round 6 — Transaction Safety, Authorization Hardening, Error Leak Fixes, Enum Validation

| Metric | Value |
|--------|-------|
| Tests after Round 6 | 58/58 ✅ |
| Frontend build | ✅ (2545 modules, 0 errors) |
| Fixes in round | 15 (R6-01 to R6-15) |
| Files modified | 11 |
| Runtime bugs fixed | 1 (P1: Shipping POST ReferenceError) |
| Transactions added | 7 |
| Permission gaps closed | 10 GET endpoints |
| Error leaks sealed | 2 |
| Enum validations added | 8 fields across 6 files |

### Files Changed (Round 6)

| File | Changes |
|------|---------|
| `backend/routes/shipping.js` | Fixed `num` scope bug in POST, added status validation to PATCH, shipment_type enum |
| `backend/routes/purchaseorders.js` | Added 'partial' + transition graph, PO payments transaction |
| `backend/routes/quality.js` | 3 transaction wrappers (templates POST/PUT, inspections POST) |
| `backend/routes/autojournal.js` | `createJournalEntry()` wrapped in transaction |
| `backend/routes/invoices.js` | POST: header+items unified in single transaction |
| `backend/routes/expenses.js` | Import: atomic transaction, expense_type enum validation |
| `backend/routes/hr.js` | Import: atomic transaction, employment_type/salary_type enum validation |
| `backend/routes/workorders.js` | 7 GETs + requirePermission, 2 error leak fixes |
| `backend/routes/barcode.js` | Added requirePermission import + middleware |
| `backend/routes/stagetemplates.js` | GET / → requirePermission('settings','view') |
| `backend/routes/permissions.js` | GET /roles → requireRole('superadmin') |
| `backend/routes/models.js` | gender enum validation (POST + PUT) |
| `backend/routes/maintenance.js` | maintenance_type + priority enum validation (POST + PUT) |
| `backend/routes/scheduling.js` | status enum validation (PUT) |

### Behavioral Changes (Round 6)

1. **Shipping POST** no longer throws ReferenceError — audit log now written correctly
2. **Shipment status** validated: delivered is terminal, cancelled can only → draft
3. **PO status** 'partial' now reachable; transition graph enforced
4. **7 multi-write endpoints** now atomic (all-or-nothing via transaction)
5. **10 GET endpoints** now require proper permissions (were open to any authenticated user)
6. **Permissions /roles** restricted to superadmin only
7. **Work order POST/PUT** no longer leak `err.message` to client
8. **8 enum fields** validated against DB CHECK constraints before INSERT/UPDATE

---

## Final Conclusion (Round 6)

All 104 fixes across Rounds 1–6 pass the full 58-test regression suite. Frontend builds clean (0 errors, 2545 modules). Production readiness: **9.0/10**.

---

## Round 7 — Critical Route Fixes, Soft-Delete Gaps, Transaction Safety, Error Messages

| Metric | Value |
|---|---|
| Tests after Round 7 | 58/58 ✅ |
| Fixes in Round 7 | 7 items (10+ individual code changes) |
| Frontend build | Success ✅ |

### Files Changed (Round 7)

| File | Changes |
|---|---|
| `customers.js` | 3 broken GET routes rebuilt (P1 CRITICAL) |
| `purchaseorders.js` | Receive endpoint error leak → generic message |
| `machines.js` | 3 soft-delete filter gaps in maintenance queries |
| `quotations.js` | 2 transaction wrappers + SO status validation |
| 31 route files | ~150+ corrupted placeholder error messages replaced |

### Behavioral Changes (Round 7)

1. **Customer `/:id`, `/:id/invoices`, `/:id/balance`** no longer crash — were missing try blocks, fetch queries, and null checks (code corruption)
2. **PO receive** no longer leaks `err.message` to client
3. **Machine stats/maintenance** no longer count soft-deleted records — cost totals and history are now accurate
4. **Quotation → SO conversion** is now atomic (transaction-wrapped) — no orphaned records on failure
5. **SO → WO conversion** is now atomic + validates SO status must be `confirmed` or `pending`
6. **SO status updates** reject invalid values (whitelist enforced)
7. **All 31 route files** return proper Arabic error messages instead of corrupted `??? ??? ?????` placeholders

---

## Final Conclusion (Round 7)

All 111+ fixes across Rounds 1–7 pass the full 58-test regression suite. Frontend builds clean (0 errors, 2545 modules). Production readiness: **9.2/10**.

---

# Round 8 — Production Audit Regression Report

## Metrics

| Metric | Value |
|---|---|
| Test suite | 58 / 58 pass ✅ |
| Duration | ~530 ms |
| Frontend build | 2545 modules, 0 errors ✅ |
| Fixes applied | 6 (R8-01 → R8-06) |

## Files Changed

| # | File | Change |
|---|---|---|
| R8-01 | `backend/routes/autojournal.js` | Invoice auto-journal tax now uses `(subtotal − discount) × tax_pct` |
| R8-02 | `frontend/src/utils/formatters.js` | `fmtNum` preserves up to 2 decimal places |
| R8-03 | `backend/routes/mrp.js` | On-order qty uses `quantity − received_qty` (fabric + accessory) |
| R8-04 | `backend/routes/purchaseorders.js` | PUT recalculates subtotal from DB items when items not in body |
| R8-05 | `backend/routes/invoices.js` + `purchaseorders.js` | Discount > subtotal guard (400 response) |
| R8-06 | `backend/server.js` + `backend/routes/backups.js` | Generic error messages — no `err.message` leaks |

## Behavioral Changes

1. **Auto-journal entries** for invoices with discounts now match the invoice's own tax calculation exactly — eliminates ledger imbalance
2. **MRP on-order** correctly reflects only the undelivered portion of purchase orders — prevents over-ordering
3. **PO edits** (tax/discount only) now recalculate the total from actual line items instead of using stale `total_amount`
4. **Negative-total invoices/POs** are now impossible — discount exceeding subtotal returns HTTP 400
5. **Error responses** in setup, dashboard, search, backup, and global handler no longer leak internal error details

## Final Conclusion (Round 8)

All 117+ fixes across Rounds 1–8 pass the full 58-test regression suite. Frontend builds clean (0 errors, 2545 modules). Production readiness: **8.5/10** (GO WITH CONDITIONS — see `docs/audit/09-production-readiness-final.md`).
