# Phase 6 — Performance & Reliability

## Architecture Analysis

### Strengths
- **SQLite (synchronous, WAL mode)**: Zero network latency, single-process access, excellent read performance
- **Prepared statements**: better-sqlite3 caches SQL plans, near-zero parsing overhead
- **No external dependencies**: No Redis, no PostgreSQL, no message queues — minimal failure modes
- **In-process everything**: No IPC overhead, no serialization between services

### Database Indexes (20+)
```
idx_wo_status, idx_wo_model_id, idx_wo_priority, idx_wo_created
idx_fabrics_code, idx_accessories_status
idx_invoices_status, idx_invoices_customer_id
idx_po_supplier_id, idx_po_status
idx_audit_log_created, idx_notifications_read
idx_employees_status, idx_attendance_employee
idx_journal_entries_status, idx_journal_entries_date
idx_machines_status, idx_maintenance_orders_status
idx_customer_payments_*, idx_supplier_payments_*
```

## Potential Slow Paths

### 1. Reports Module (~40 endpoints, complex aggregates)
- `reports.js` runs complex `GROUP BY`, `SUM`, `JOIN` queries across large tables
- Each report endpoint executes 1-5 SQL queries
- **Mitigation**: SQLite indexes cover main query patterns; `cost_snapshots` table pre-computes per-WO costs
- **Risk**: LOW — acceptable for ERP workload (dozens of concurrent users, not thousands)

### 2. MRP Calculation (mrp.js)
- Loads all active work orders + sizes + fabrics + accessories
- Iterates all fabric/accessory needs → queries stock + on-order per item
- **Mitigation**: Batch loads with `IN()` placeholders, single transaction
- **Risk**: MEDIUM at scale (>1000 active WOs + >500 materials)

### 3. Notification Generation (5-minute interval)
- Queries 6+ tables for overdue items
- Creates notifications for each admin user × each overdue item
- **Mitigation**: Deduplication via `existsSet` / `unreadSet` prevents re-creation
- **Risk**: LOW

### 4. Dashboard Endpoint (server.js)
- Executes 15+ separate SQL queries for KPI data
- **Mitigation**: Each query is indexed; per-query time < 5ms on indexed SQLite
- **Risk**: LOW

## N+1 Query Patterns

### ✅ Fixed/Avoided
- MRP: Batch loads `wo_sizes`, `wo_fabrics`, `wo_fabric_batches`, `wo_accessories_detail` with `IN()` clauses
- Notifications: Batch loads existing notifications into `Set` before checking

### ⚠️ Present but Acceptable
- `calculateWOCost()`: 5 queries per WO (sizes, batch fabrics, legacy fabrics, accessories, expenses) — called per-WO view, not in bulk
- Work order list: Fetches WOs then fetches cost for each on detail view only

## Memory & Concurrency

### Memory Profile
- SQLite mmap: WAL mode, shared memory
- Multer: File uploads to disk (not memory), no buffer accumulation
- No unbounded caches (rate limiter map cleaned every 60s)
- **Risk**: LOW

### Concurrency
- SQLite WAL mode allows concurrent readers + single writer
- `db.transaction()` used for atomic multi-write operations
- **Risk**: LOW for single-process Electron app; MEDIUM if deployed as multi-process web server

## Graceful Shutdown

### Current State: ⚠️ MISSING
- No `SIGTERM`/`SIGINT` handlers
- No `server.close()` before exit
- No database connection cleanup
- **Impact**: LOW for desktop/Electron (users manually close app)
- **Recommendation P3**: Add graceful shutdown for future server deployment

## Summary

| Area | Assessment | Risk |
|---|---|---|
| Query Performance | Good — indexed, prepared, cached | LOW |
| N+1 Patterns | Mostly avoided via batch loading | LOW |
| Memory | No leaks, bounded caches | LOW |
| Concurrency | WAL mode adequate | LOW for desktop |
| Graceful Shutdown | Missing | LOW (desktop) / MEDIUM (server) |
| Scale Ceiling | ~100 concurrent users, ~100K records | MEDIUM |
| **Overall** | Suitable for target deployment (desktop ERP) | LOW |
