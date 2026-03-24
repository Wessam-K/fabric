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

## Final Conclusion

All 52 fixes across Rounds 1–3 pass the full 58-test regression suite. Frontend builds clean. V25 migration is backward-compatible (indexes only). The system maintains full compatibility with existing data. N+1 query patterns eliminated in 5 critical hotspots for significant performance improvement at scale.
