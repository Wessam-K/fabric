# Phase 0 — System Inventory

## Application Overview

| Attribute | Value |
|---|---|
| Name | WK-Hub v2.0 (Factory ERP) |
| Language | JavaScript (Node.js 22 + React 19) |
| Backend | Express 4.21, better-sqlite3 11.7, port 9002 |
| Frontend | Vite 6.4, Tailwind CSS 4, port 9173 |
| Database | SQLite (WAL mode), 87 tables, schema v26 |
| Desktop | Electron 41 (Windows portable) |
| Auth | JWT 24h, bcryptjs, 7 roles, 240+ permissions |
| Tests | Node.js built-in test runner, 58 tests |

## Repository Structure

```
factory-system/
├── backend/
│   ├── server.js              # Express entry, middleware, route mounting
│   ├── database.js            # SQLite init, 26 migration versions
│   ├── middleware/auth.js      # JWT auth, RBAC, audit logging
│   ├── routes/ (33 files)     # ~13,500 LOC, 230+ endpoints
│   ├── tests/ (6 files)       # API tests
│   ├── utils/                 # CSV, error, validation utilities
│   └── uploads/               # File storage (by type)
├── frontend/
│   ├── src/pages/ (48 pages)
│   ├── src/components/ (27)
│   ├── src/hooks/ (3)         # useCostCalc, usePermissions, useWorkOrder
│   └── src/utils/ (5)        # api, formatters, exports
├── docs/ (9 files)
├── e2e/ (Playwright tests)
└── electron.js
```

## Route Modules (33 files, ~13,500 LOC)

| Module | Lines | Endpoints | Domain |
|---|---|---|---|
| workorders.js | 1454 | 30+ | Production management |
| reports.js | 1184 | 40+ | Analytics / BI |
| hr.js | 869 | 14+ | HR, attendance, payroll |
| machines.js | 337 | 10+ | Assets, maintenance |
| customers.js | 333 | 8+ | Customer CRM, AR |
| suppliers.js | 320 | 10+ | Vendor master |
| purchaseorders.js | 320 | 10+ | Procurement |
| notifications.js | 259 | 6+ | Alerts, overdue checks |
| quality.js | 257 | 16 | QC, inspections, NCR |
| quotations.js | 248 | 8+ | Sales pipeline |
| mrp.js | 228 | 5 | Material planning |
| expenses.js | 228 | 8+ | Operating expenses |
| accounting.js | 222 | 10+ | GL, journals |
| invoices.js | 220 | 6+ | Billing |
| autojournal.js | 218 | 5 | Automated accounting |
| maintenance.js | 213 | 8+ | Work requests |
| shipping.js | 196 | 6+ | Logistics |
| fabrics.js | 176 | 6+ | Fabric inventory |
| accessories.js | 165 | 6+ | Accessory inventory |
| auth.js | 152 | 6 | Authentication |
| returns.js | 151 | 6+ | Returns management |
| permissions.js | 147 | 6+ | RBAC admin |
| samples.js | 129 | 5 | Sample management |
| barcode.js | 127 | 2 | Barcode lookup |
| documents.js | 110 | 4 | File management |
| users.js | 107 | 5 | User admin |
| settings.js | ~80 | 3 | Config |
| backups.js | 81 | 4 | DB backup/restore |
| inventory.js | 73 | 3 | Stock views |
| scheduling.js | 156 | 9 | Production scheduling |
| stagetemplates.js | 56 | 4 | Stage config |
| auditlog.js | 32 | 1 | Audit trail |
| models.js | 317 | 8+ | Product models, BOM |

## Runtime Architecture

```
Request → Express → Helmet → CORS → JSON parser → sanitizeBody → Rate limiter (auth only)
  → requireAuth (JWT verify) → requirePermission (DB lookup) → Route handler
  → better-sqlite3 (synchronous) → Response
```

## Database Schema: 87 Tables in 13 Domains

- Master Data: models, fabrics, accessories (3)
- BOM Templates: bom_templates + items (4)
- Work Orders: work_orders, stages, consumption, sizes (5)
- Inventory: fabric_inventory_batches, stock_movements (6)
- Production Execution: stage_movement_log, waste, QC (10)
- Purchasing: suppliers, purchase_orders, payments (6)
- Sales: customers, invoices, payments, quotations, sales_orders (8)
- Returns & Logistics: sales_returns, purchase_returns, shipments (7)
- Accounting: chart_of_accounts, journal_entries (6)
- HR: employees, attendance, payroll, leaves (10)
- Machines: machines, maintenance_orders, parts (4)
- Quality: qc_templates, inspections, NCR (6)
- System: users, permissions, audit_log, notifications (7)
