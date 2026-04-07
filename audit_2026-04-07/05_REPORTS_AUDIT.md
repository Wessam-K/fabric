# Dashboard & Reports Audit

## Overview

- **32 report endpoints** (`/api/reports/*`) — all use real SQL queries, no hardcoded/placeholder data
- **8 dashboard endpoints** (1 main + 4 chart + 3 KPI)
- **17 export endpoints** (`/api/exports/*`) — support CSV + XLSX
- **5 report schedule CRUD endpoints** — CRUD only, no execution engine
- **30 frontend report tabs** — matching backend endpoints

---

## Financial Calculations

| Calculation | Method | Status |
|---|---|---|
| Cost per piece | `cost_snapshots.cost_per_piece` (pre-computed) | ✅ |
| Total production cost | fabric + lining + accessories + masnaiya × qty + masrouf × qty | ✅ |
| Profit margin | `(revenue - cost) / revenue × 100` | ✅ |
| VAT | Configurable `tax_rate` from settings (default 14%) | ⚠️ Assumes VAT-inclusive POs |
| Cash flow | Inflows from customer_payments, outflows from supplier_payments + expenses + payroll | ✅ |
| Revenue | Only paid/partially_paid invoices | ✅ |
| Quality rate | Final stage: `passed / (passed + rejected) × 100` | ✅ |
| Waste % | `waste_meters / actual_total_meters × 100` | ✅ |
| Aging buckets | Configurable via settings (default 30/60/90) | ✅ |

---

## Bugs Found

### BUG-R1: N+1 Query in production-by-model (MEDIUM)
- **File:** `backend/routes/reports.js` — GET /reports/production-by-model
- **Issue:** Fetches all models, then runs 2 queries per model for fabric_usage. 100 models = 200+ queries.
- **Fix:** Replace with a JOIN or subquery.

### BUG-R2: Report scheduling has NO execution engine (HIGH)
- **File:** `backend/routes/report-schedules.js`
- **Issue:** Full CRUD exists, `next_run_at` is computed, but no cron/scheduler ever runs reports. Users can create schedules that never execute.
- **Fix:** Either implement a background scheduler or remove/disable the scheduling UI.

### BUG-R3: Dashboard 30+ sequential queries (LOW)
- **File:** `backend/server.js` — GET /api/dashboard
- **Issue:** 30+ separate `db.prepare().get()/all()` calls per request.
- **Impact:** On SQLite this is fast (~5ms total), but could be reduced.

### BUG-R4: Inconsistent P&L cost calculation across 3 endpoints (HIGH)
- `/reports/financial/pl` → COGS = PO `total_amount` (includes unconsumed POs)
- `/reports/pl-monthly` → Omits material cost entirely (expenses + maintenance + payroll only)
- `/reports/cost-analysis` → Uses actual fabric batch costs + payroll + expenses
- **Impact:** Three P&L views show different "cost" numbers. Confusing for accountants.

### BUG-R5: by-model cost snapshot GROUP BY may duplicate (MEDIUM)
- **File:** `backend/routes/reports.js` — GET /reports/by-model
- **Issue:** ROW_NUMBER() for latest snapshot joined to WO, then GROUP BY model — SUM/AVG across multiple WOs can produce wrong aggregates.

### BUG-R6: Date filter double-T on datetime columns (LOW)
- Appending `'T23:59:59'` to date_to fails silently for datetime columns that already include time.

### BUG-R7: VAT assumes POS are VAT-inclusive (MEDIUM)
- Input VAT: `total_amount × rate / (1 + rate)` — no flag distinguishes inclusive vs exclusive.

### BUG-R8: Missing LIMIT on some reports (LOW)
- `GET /by-model` and `GET /quality-by-model` return all rows with no pagination.

---

## Export Security

- ✅ Uses `exceljs` (no eval-based vulnerabilities)
- ✅ CSV formula injection protection: strips `=+\-@\t\r` prefixes
- ✅ All exports behind `requirePermission('reports','view')` or module-specific permissions

---

## Configurable Settings

| Setting | Used In |
|---|---|
| `MAX_REPORT_ROWS` | Limits rows in report queries |
| `dashboard_list_limit` | Recent items in dashboard |
| `dashboard_machine_limit` | Machine board size |
| `tax_rate` | VAT calculations |
| `aging_bucket_1/2/3` | AR/AP aging boundaries |
| `low_stock_threshold` | Stock alerts |
| `quality_history_limit` | QC report depth |
| `cost_history_limit` | Cost history depth |
| `default_page_size` | Pagination default |
| `report_default_limit` | Default report rows |
