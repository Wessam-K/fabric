# Database Deep Audit

## Summary

| Metric | Count |
|---|---|
| Total tables | 101 |
| Explicit indexes | 66 (4 duplicates) |
| Foreign key relationships | ~100 |
| ON DELETE CASCADE | 36 |
| REAL monetary columns | 90+ |
| SQL injection vulnerabilities | **0** |
| Schema version | V54 (V55 added by this audit) |

---

## Critical Findings

### DB-1: Work Order Cascade — CRITICAL
Deleting a work order cascades to **15 child tables**: wo_fabrics, wo_accessories, wo_sizes, wo_stages, wo_stage_qc, wo_fabric_batches, wo_accessories_detail, wo_extra_expenses, partial_invoices, stage_movement_log, wo_fabric_consumption, wo_accessory_consumption, wo_waste, wo_invoices, production_schedule.

**Impact:** Complete destruction of production history, QC records, material tracking, and audit trails.
**Mitigation:** Global DELETE-blocking middleware prevents this via HTTP, but a direct DB connection (admin tool, migration bug) could trigger cascades.

### DB-2: Floating-Point Money — HIGH
90+ columns use SQLite `REAL` for monetary values (prices, costs, payments, salaries). IEEE 754 float64 causes precision errors: `0.1 + 0.2 ≠ 0.3`.

**Affected tables:** invoices, purchase_orders, cost_snapshots, payroll_records, journal_entry_lines, supplier_payments, customer_payments, expenses, and more.
**Mitigation:** Application-layer money.js library handles safe arithmetic. But direct DB calculations (UNION, AVG, SUM in SQL) still use floats.

### DB-3: Missing Indexes on Accounting Tables — MEDIUM
| Column | Impact |
|---|---|
| `journal_entry_lines.account_id` | Slow trial balance, GL reports |
| `journal_entries.status` | Slow posted/draft filtering |
| `journal_entries.entry_date` | Slow date range reports |
| `payroll_records.employee_id` | Slow payroll history |
| `payroll_records.period_id` | Slow period reports |

### DB-4: 4 Duplicate Indexes — LOW
| Duplicate | Original |
|---|---|
| `idx_work_orders_status` | `idx_wo_status` |
| `idx_notifications_user_read` | `idx_notifications_read` |
| `idx_po_items_po` | `idx_po_items_po_id` |
| `idx_wo_stages_wo` | `idx_wo_stages_wo_id` |

---

## Foreign Key ON DELETE Behavior

### CASCADE (data loss risk if parent deleted)
- **work_orders → 15 child tables** (CRITICAL)
- invoices → invoice_items
- purchase_orders → purchase_order_items
- shipments → shipment_items, packing_lists
- users → user_permissions, password_history, sessions
- maintenance_orders → maintenance_parts
- mrp_runs → mrp_suggestions
- All template → template_items relationships

### NO ACTION/RESTRICT (blocks parent delete)
- suppliers: blocked by fabrics, accessories, purchase_orders, supplier_payments
- employees: blocked by attendance, payroll_records
- customers: blocked by invoices, customer_payments
- models: blocked by work_orders

---

## SQL Security

All 409 API endpoints use parameterized queries via `better-sqlite3`. Zero SQL injection risk. Foreign keys enabled via `PRAGMA foreign_keys = ON`.

---

## Migration Architecture

Schema is managed inline in `initializeDatabase()` (V1-V54 with version checks), not traditional migration files. The 11 files in `/migrations/` are mostly baseline markers. This makes rollback impossible but simplifies fresh database creation.
