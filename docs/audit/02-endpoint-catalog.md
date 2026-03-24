# Phase 2 — Endpoint Catalog

## Summary

| Metric | Count |
|---|---|
| Total route files | 33 |
| Total endpoints (approx) | 230+ |
| Auth-protected (requireAuth) | 100% (via server.js `app.use`) |
| Permission-gated | ~95% (requirePermission/requireRole) |
| Public endpoints | 4 (health, setup/status, setup/create-admin, auth/login) |

## Endpoint Listing by Module

### auth.js (6 endpoints)
| Method | Path | Auth | Permission | Validation |
|---|---|---|---|---|
| POST | /api/auth/login | No | N/A | Rate limited (20/15min), lockout (5 fails) |
| POST | /api/auth/refresh | Auth | N/A | ✅ |
| POST | /api/auth/logout | Auth | N/A | ✅ |
| PATCH | /api/auth/password | Auth | N/A | Min 8 chars, uppercase, digit |
| GET | /api/auth/profile | Auth | N/A | ✅ |
| PATCH | /api/auth/profile | Auth | N/A | ✅ |

### workorders.js (30+ endpoints)
| Method | Path | Auth | Permission | Notes |
|---|---|---|---|---|
| GET | /api/work-orders | Auth | work_orders.view | Filtered, paginated |
| POST | /api/work-orders | Auth | work_orders.create | Full validation |
| GET | /api/work-orders/:id | Auth | work_orders.view | Includes cost breakdown |
| PUT | /api/work-orders/:id | Auth | work_orders.edit | ✅ |
| PATCH | /api/work-orders/:id/status | Auth | work_orders.edit | Status validation |
| DELETE | /api/work-orders/:id | Auth | work_orders.delete | Soft cancel |
| ... | (25+ more) | Auth | work_orders.* | Stages, fabrics, accessories, QC |

### invoices.js (6 endpoints)
| Method | Path | Auth | Permission | Issues |
|---|---|---|---|---|
| GET | /api/invoices | Auth | invoices.view | ✅ |
| POST | /api/invoices | Auth | invoices.create | ✅ Discount guard added (R8) |
| GET | /api/invoices/:id | Auth | invoices.view | ✅ |
| PUT | /api/invoices/:id | Auth | invoices.edit | ✅ Discount guard added (R8) |
| PATCH | /api/invoices/:id/status | Auth | invoices.edit | ✅ |
| DELETE | /api/invoices/:id | Auth | invoices.delete | ✅ |

### purchaseorders.js (10+ endpoints)
| Method | Path | Auth | Permission | Issues |
|---|---|---|---|---|
| POST | /api/purchase-orders | Auth | purchase_orders.create | ✅ Discount guard (R8), recalc fix (R8) |
| PUT | /api/purchase-orders/:id | Auth | purchase_orders.edit | ✅ Tax-only recalc fixed (R8) |
| PATCH | /api/purchase-orders/:id/receive | Auth | purchase_orders.edit | Validated |
| PATCH | /api/purchase-orders/:id/status | Auth | purchase_orders.edit | Transition graph (R6) |

### accounting.js (10+ endpoints)
| Method | Path | Auth | Permission | Notes |
|---|---|---|---|---|
| GET | /api/accounting/accounts | Auth | accounting.view | COA tree |
| POST | /api/accounting/accounts | Auth | accounting.create | UNIQUE check |
| POST | /api/accounting/journal | Auth | accounting.create | Debit=Credit check (0.01 tolerance) |
| PATCH | /api/accounting/journal/:id/post | Auth | accounting.post | Status validation |
| GET | /api/accounting/trial-balance | Auth | accounting.view | Trial balance |

### autojournal.js (5 endpoints)
| Method | Path | Auth | Permission | Issues |
|---|---|---|---|---|
| POST | /api/auto-journal/invoice/:id | Auth | accounting.create | ✅ Tax calc FIXED (R8) |
| POST | /api/auto-journal/po-receipt/:id | Auth | accounting.create | ✅ |
| POST | /api/auto-journal/expense/:id | Auth | accounting.create | ✅ |

### mrp.js (5 endpoints)
| Method | Path | Auth | Permission | Issues |
|---|---|---|---|---|
| POST | /api/mrp/calculate | Auth | mrp.create | ✅ On-order double-count FIXED (R8) |
| POST | /api/mrp/auto-po | Auth | mrp.create | ✅ |

## Security Findings

### Endpoints with no Fine-Grained Permission (rely on requireAuth only)
- `GET /api/notifications/count` — OK (user's own data)
- `GET /api/notifications` — OK (user's own data)
- `PATCH /api/notifications/:id/read` — OK (user's own data)
- `DELETE /api/notifications/:id` — OK (user's own data)

### All other endpoints use `requirePermission()` or `requireRole()` ✅
