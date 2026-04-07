# API Endpoint Audit

## Summary

- **409 total endpoints** across 36 route files
- **GET: 210 | POST: 107 | PUT: 35 | PATCH: 27 | DELETE: 30**
- Every endpoint wrapped in try/catch — **zero unprotected handlers**
- Error responses 100% use `{ error: 'message' }` format
- 99%+ of endpoints behind requireAuth + requirePermission

---

## Response Format — INCONSISTENT (4 patterns)

| Pattern | Used By |
|---|---|
| Named collection key: `{ customers: [...], total }` | customers, invoices, workorders |
| `{ data, total, page, totalPages }` | fabrics, accessories, models, suppliers |
| `{ data, total, page, pages }` | documents, expenses, quotations, accounting |
| Raw array: `res.json(rows)` | fabrics (unpaged), quality, misc |

**Issues:**
- `totalPages` vs `pages` — two different key names for same concept
- Customers returns `{ customers, total }` with no page info
- POs return `{ orders, totals }` with no pagination
- No standard envelope across the API

---

## Pagination Coverage

### ✅ Always Paginated
customers, invoices, workorders, accounting/journal, expenses, documents, quotations, auditlog

### ⚠️ Conditional (only if page/limit params passed)
fabrics, accessories, suppliers, models — returns ALL rows as raw array when no page params

### ❌ No Pagination (returns all rows)
purchaseorders, quality, hr/employees, machines, maintenance, shipping, samples, scheduling, returns

> **Risk:** As data grows, unpaginated endpoints will return increasingly large payloads.

---

## Input Validation — GOOD

All POST/PUT routes validate required fields. Includes:
- Required field checks
- Enum validation (status, type, category)
- Numeric range checks (price ≥ 0, qty > 0, tax 0-100)
- Unique constraint pre-checks (before INSERT)
- Business rule validation (can't edit paid invoice, can't delete in-use item)
- File MIME validation on uploads

---

## Error Handling — CONSISTENT

| Status | Format | Count |
|---|---|---|
| 400 | `{ error: 'Arabic message' }` | 200+ |
| 401 | `{ error: 'Arabic message' }` | 5 |
| 404 | `{ error: 'Arabic message' }` | 159 |
| 409 | `{ error: 'Arabic message' }` | 20 |
| 500 | `{ error: 'حدث خطأ داخلي' }` | 370+ |

- `error` key is 100% consistent across all responses
- No stack traces leaked in 500 responses ✅
- No request context in error logs (debugging difficulty)

---

## Issues

| # | Severity | Issue |
|---|---|---|
| API-1 | HIGH | 9 list endpoints have no pagination (POs, machines, maintenance, etc.) |
| API-2 | MEDIUM | 4 different response envelope patterns |
| API-3 | MEDIUM | Conditional pagination falls back to unbounded array when no params |
| API-4 | LOW | `totalPages` vs `pages` naming inconsistency |
| API-5 | LOW | 409 responses inconsistent (some include `blocking_count`) |
| API-6 | LOW | No request context in 500 error logs |
