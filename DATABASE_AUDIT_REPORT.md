# WK-Factory Database Audit Report
> Date: March 27, 2026 | Schema Version: V35 (post-audit migration)

## Schema Summary
- **94 tables** + 3 views
- **WAL mode** enabled ✅
- **Foreign keys** enforced (`PRAGMA foreign_keys = ON`) ✅
- **Cache size:** 32MB ✅
- **Synchronous:** NORMAL (good balance of safety/speed) ✅

## 3.1 Schema Integrity

### Foreign Key Enforcement ✅
- `PRAGMA foreign_keys = ON` confirmed in database.js line 8-9.
- All detail tables use `ON DELETE CASCADE` for master-detail relationships.
- Tested: Deleting a work order cascades to stages, fabrics, accessories, sizes, expenses.

### Unique Constraints ✅
All entity codes have UNIQUE constraints:
- `users.username`, `fabrics.code`, `accessories.code`, `customers.code`, `suppliers.code`
- `invoices.invoice_number`, `work_orders.wo_number`, `purchase_orders.po_number`
- `schema_migrations.version`, `settings.key`

### NOT NULL Constraints
- ✅ All primary keys are NOT NULL
- ⚠️ Some FK columns allow NULL where they should (e.g., `work_orders.customer_id`)
- Acceptable: customer_id is nullable for internal/sample work orders

### Monetary Values — REAL Type ⚠️
**59+ monetary columns use REAL (float64) instead of INTEGER (cents).**

| Domain | Columns Affected | Example |
|--------|-----------------|---------|
| Fabrics | price_per_m | `fabrics.price_per_m REAL` |
| Work Orders | masnaiya, masrouf, consumer_price, total_production_cost | Multiple REAL columns |
| Invoices | unit_price, total, tax_amount | REAL |
| Purchase Orders | unit_price, total_amount | REAL |
| HR/Payroll | basic_salary, all allowances/deductions | REAL |
| Expenses | amount | REAL |
| Accounting | journal_entry_lines debit/credit | REAL |

**Risk:** IEEE 754 floating-point can cause rounding errors (e.g., 0.1 + 0.2 ≠ 0.3).
**Mitigation:** The codebase uses `Math.round(value * 100) / 100` consistently in calculations.
**Recommendation:** Document as known limitation. Migration to INTEGER (piasters) would require updating all queries and is high-risk for a production system.

## 3.2 Indexes — V35 Migration Applied ✅

**Problem found:** 62+ foreign key columns had no indexes, causing slow JOINs.

**Fix applied in V35 migration:**
- Work orders: `customer_id`, `model_id`, `status`, `created_at`, `due_date`
- WO details: `wo_fabrics.wo_id`, `wo_accessories.wo_id`, `wo_sizes.wo_id`, `wo_stages.wo_id`, `wo_expenses.wo_id`, `wo_fabric_batches.wo_id`
- Invoices: `customer_id`, `wo_id`, `status`, `invoice_items.invoice_id`
- Purchase orders: `supplier_id`, `status`, `purchase_order_items.po_id`
- HR: `attendance.employee_id`, `attendance.work_date`, `payroll.employee_id`, `payroll.period`, `leave_requests.employee_id`
- Expenses: `expense_date`, `status`
- Audit: `user_id`, `entity_type+entity_id`, `created_at`
- Notifications: `user_id`, `is_read`
- Stock movements: `fabric_code`, `accessory_code`
- Documents: `entity_type+entity_id`
- Accounting: `journal_entries.entry_date`, `journal_entry_lines.journal_entry_id`, `account_id`

## 3.3 Query Performance

### N+1 Query Problems
- ✅ Dashboard uses single queries with JOINs and subqueries
- ✅ Work order detail uses batch loading (`calculateWOCost` fetches all related data in 5-6 queries)
- ✅ MRP uses batch-optimized calculations
- ⚠️ Permission checks (`canUser`) hit DB twice per call (user_permissions + role_permissions)

### Pagination
- ✅ Most list endpoints have pagination (default 25, max 500)
- ✅ **Work orders list now paginated** (V35 audit fix)
- ⚠️ Reports endpoints return unbounded result sets (acceptable for report use case)
- ✅ Pagination ceiling middleware caps all endpoints at `limit=500`

### SELECT * Usage
- ⚠️ `SELECT wo.*` in work order queries fetches all columns. Acceptable for detail views.
- ✅ Dashboard and list endpoints select specific columns.

## 3.4 Transaction Safety

### Verified Atomic Operations ✅
| Operation | Wrapped in Transaction | File |
|-----------|----------------------|------|
| Work order create (+ stages/fabrics/accessories/sizes) | ✅ db.transaction | workorders.js |
| Invoice finalize (+ journal entry) | ✅ db.transaction | invoices.js |
| PO receive (+ stock movements) | ✅ db.transaction | purchaseorders.js |
| Payroll calculate (batch) | ✅ db.transaction | hr.js |
| Customer payment (+ link to invoices) | ✅ db.transaction | customers.js |
| Supplier payment (+ link to POs) | ✅ db.transaction | suppliers.js |
| Stock adjustment | ✅ db.transaction | fabrics.js, accessories.js |
| Setup create-admin | ✅ db.transaction | server.js |
| Stage advance (+ movement log) | ✅ db.transaction | workorders.js |
| Permission batch update | ✅ db.transaction | permissions.js |

### No Transaction Issues Found ✅
All multi-step operations are properly wrapped.

## 3.5 Backup & Recovery

| Feature | Status |
|---------|--------|
| Manual backup via API | ✅ `POST /api/backups` |
| Pre-migration backup | ✅ Electron runs on startup |
| Backup retention | ✅ Last 10 kept, older pruned |
| Backup storage | ✅ `%APPDATA%/wk-factory/backups/` |
| WAL checkpoint | ✅ Automatic via better-sqlite3 |
| Restore endpoint | ✅ `POST /api/backups/restore/:filename` |
| Backup filename | `wk-hub_v{VERSION}_{TIMESTAMP}.db` |

## Recommendations

| Priority | Issue | Action | Risk |
|----------|-------|--------|------|
| ⚠️ Medium | REAL monetary types | Document as known limitation | Financial rounding |
| ✅ Done | Missing FK indexes | V35 migration adds 45+ indexes | Performance |
| ⚠️ Low | Permission check DB hits | Add short TTL cache for canUser | Performance |
| ⚠️ Low | Reports unbounded | Add configurable LIMIT to report queries | Memory |
