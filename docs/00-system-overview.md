# 00 — System Overview

> Generated as Phase 0 of the Full Audit & Improvement Plan  
> Commit baseline: `19ddc8b` on `origin/main`

---

## 1. Product Identity

| Field | Value |
|-------|-------|
| Name | **WK-Hub** (نظام إدارة المصنع) |
| Version | 2.0.0 (`package.json`) — schema V35+ |
| App ID | `com.wkhub.factory` |
| Description | Factory ERP for garment/textile manufacturing |
| Repository | `https://github.com/Wessam-K/fabric.git` |
| License | Private |

---

## 2. Technology Stack

### Backend
| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 22.16.0 |
| Framework | Express | 4.21.1 |
| Database | SQLite via better-sqlite3 | 11.10.0 |
| Auth | JWT (jsonwebtoken 9.0.3) + bcryptjs 3.0.3 |
| Security | Helmet 8.1.0, CORS 2.8.5 |
| Logging | Morgan 1.10.1 + Winston 3.19.0 (Electron) |
| File Upload | Multer 1.4.5-lts.1 |
| Excel | exceljs 4.x (backend), xlsx 0.18.5 (frontend) |
| Config | dotenv 16.4.7 |

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| UI Library | React | 19 |
| Build Tool | Vite | 6.4.1 |
| CSS | Tailwind CSS | 4 |
| HTTP Client | axios via `utils/api.js` |

### Desktop
| Component | Technology |
|-----------|-----------|
| Shell | Electron 41.0.2 (via `electron.js`) |
| Builder | electron-builder (win x64: dir + portable) |
| E2E Tests | Playwright 1.58.2 |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Electron Shell                      │
│  ┌─────────────────┐    ┌────────────────────────┐  │
│  │  Backend :9002   │    │  Frontend :9173 (dev)  │  │
│  │  Express + SQLite│◄──►│  React 19 + Vite       │  │
│  │  33 route files  │    │  50 pages, 28 comps    │  │
│  └────────┬─────────┘    └────────────────────────┘  │
│           │                                          │
│  ┌────────▼─────────┐                                │
│  │    wk-hub.db      │                               │
│  │  94 tables + 1 view│                              │
│  │  Schema V35+      │                               │
│  └──────────────────┘                                │
└─────────────────────────────────────────────────────┘
```

### Request Flow
1. Client → CORS → Helmet → Morgan → JSON parser → HTML sanitizer
2. → Rate limiter (login only) → Route middleware (`requireAuth` / `requirePermission`)
3. → Route handler → SQLite (synchronous, better-sqlite3)
4. → JSON response → Global error handler (catches uncaught)

---

## 4. Database Schema Summary (V35+, 94 tables + 1 view)

### Table Groups

| Group | Tables | Key Tables |
|-------|--------|------------|
| **Core Production** | 15 | work_orders, work_order_stages, models, model_sizes, model_accessories, bom_templates, bom_variants, bom_variant_items, stage_templates, stage_template_items, model_cost_snapshots, work_order_materials, cutting_orders, production_lines, model_images |
| **Inventory / Batching** | 10 | fabrics, fabric_batches, accessories, accessory_batches, fabric_batch_events, accessory_batch_events, accessory_inventory, fabric_returns, accessory_returns, inventory_adjustments |
| **Purchasing** | 3 | purchase_orders, purchase_order_items, supplier_ratings |
| **Sales / Invoicing** | 10 | invoices, invoice_items, sales_orders, sales_order_items, quotations, quotation_items, partial_invoices, partial_invoice_items, sales_returns, sales_return_items |
| **Quality Control** | 7 | qc_inspections, qc_inspection_items, defect_codes, ncr_reports, ncr_actions, qc_standards, qc_hold_releases |
| **Cost Tracking** | 2 | cost_tracking, cost_breakdown |
| **User Management** | 3 | users, user_preferences, user_sessions |
| **Authorization** | 3 | roles, role_permissions, permissions |
| **HR** | 6 | employees, attendance, payroll, deductions, bonuses, leave_requests |
| **Accounting** | 3 | chart_of_accounts, journal_entries, journal_entry_lines |
| **Machines / Maintenance** | 4 | machines, machine_downtime, maintenance_orders, maintenance_parts |
| **Expenses** | 1 | expenses |
| **Notifications / Audit** | 2 | notifications, audit_log |
| **Shipping** | 3 | shipments, shipment_items, shipping_addresses |
| **Scheduling** | 2 | production_schedule, schedule_dependencies |
| **Samples / Returns** | 5 | samples, purchase_returns, purchase_return_items, customer_complaints, complaint_items |
| **Documents / Backup** | 2 | documents, backup_log |
| **Configuration** | 3 | settings, password_history, schema_version |

### View
- `model_production_summary` — Aggregates work order statistics per model.

### Migrations
23 schema versions (V1–V23), applied sequentially. Each migration is idempotent (uses `CREATE TABLE IF NOT EXISTS`).

---

## 5. Authentication & Authorization

| Feature | Implementation |
|---------|---------------|
| Login | `POST /api/auth/login` — bcrypt verify, JWT 24h token |
| Token | HS256 JWT, secret from `.jwt_secret` file (auto-generated 64 bytes) |
| Roles | 6 named roles: `superadmin`, `manager`, `accountant`, `production`, `hr`, `viewer` |
| Permissions | 55+ entries in `permissions` table, checked via `requirePermission(resource, action)` |
| Middleware | `requireAuth` (JWT verify), `requireRole(...)`, `requirePermission(resource, action)` |
| Audit | `logAudit(userId, action, details)` — writes to `audit_log` table |
| Sessions | `user_sessions` table exists but **not enforced** in `requireAuth()` |
| Password History | `password_history` table exists but **not enforced** on change |

---

## 6. Backend Route Inventory (33 files)

| File | Prefix | Key Endpoints | Auth |
|------|--------|--------------|------|
| auth.js | /api/auth | login, register, me, change-password | Public (login) |
| users.js | /api/users | CRUD, activate/deactivate, role assign | Protected |
| hr.js | /api/hr | employees, attendance, payroll, leave | Protected |
| auditlog.js | /api/auditlog | list, filter | Protected |
| reports.js | /api/reports | production, inventory, financial, quality | Protected |
| fabrics.js | /api/fabrics | CRUD, batches, stock adjust | Protected |
| accessories.js | /api/accessories | CRUD, batches, stock adjust | Protected |
| models.js | /api/models | CRUD, sizes, accessories, BOM, cost snap | Protected |
| invoices.js | /api/invoices | CRUD, items, status, print | Protected |
| workorders.js | /api/workorders | CRUD, stages, materials, costing | Protected |
| suppliers.js | /api/suppliers | CRUD, ratings | Protected |
| purchaseorders.js | /api/purchaseorders | CRUD, items, receive, import | Protected |
| settings.js | /api/settings | get/set by key | Protected |
| stagetemplates.js | /api/stage-templates | CRUD, items | Protected |
| inventory.js | /api/inventory | overview, adjustments | Protected |
| permissions.js | /api/permissions | list, assign, role perms | Protected |
| customers.js | /api/customers | CRUD, search | Protected |
| notifications.js | /api/notifications | count, read-all, check-overdue | **⚠ NO AUTH** |
| machines.js | /api/machines | CRUD, stats, downtime | **⚠ stats: NO AUTH** |
| accounting.js | /api/accounting | chart, journals, trial balance | Protected |
| expenses.js | /api/expenses | CRUD, approve | Protected |
| maintenance.js | /api/maintenance | orders, parts, schedule | Protected |
| barcode.js | /api/barcode | lookup by code | **⚠ NO AUTH** |
| mrp.js | /api/mrp | runs, items, auto-po | Protected |
| shipping.js | /api/shipping | shipments, items, track | Protected |
| scheduling.js | /api/scheduling | schedule, dependencies, capacity | Protected |
| quality.js | /api/quality | inspections, defects, NCR, standards | Protected |
| quotations.js | /api/quotations | CRUD, items, convert to SO | Protected |
| samples.js | /api/samples | CRUD | Protected |
| returns.js | /api/returns | purchase returns, sales returns | Protected |
| documents.js | /api/documents | upload, download, delete | Protected |
| backups.js | /api/backups | create, list, restore | Protected |
| autojournal.js | /api/auto-journal | post invoice/payroll/expense | Protected |

---

## 7. Frontend Page Inventory (50 pages)

| Page | Component | Route (estimated) |
|------|-----------|-------------------|
| Dashboard.jsx | Main dashboard with KPIs, charts | / |
| Login.jsx | Auth login form | /login |
| Setup.jsx | First-run admin creation | /setup |
| WorkOrdersList.jsx | WO listing | /work-orders |
| WorkOrderForm.jsx | WO create/edit | /work-orders/new, /work-orders/:id/edit |
| WorkOrderDetail.jsx | WO detail view | /work-orders/:id |
| ModelsList.jsx | Model listing | /models |
| ModelForm.jsx | Model create/edit | /models/new, /models/:id/edit |
| Fabrics.jsx | Fabric management | /fabrics |
| FabricInventory.jsx | Fabric stock view | /fabric-inventory |
| Accessories.jsx | Accessory management | /accessories |
| AccessoryInventory.jsx | Accessory stock view | /accessory-inventory |
| Invoices.jsx | Invoice listing | /invoices |
| InvoiceView.jsx | Invoice detail | /invoices/:id |
| InvoicePrint.jsx | Print layout | /invoices/:id/print |
| PurchaseOrders.jsx | PO listing/management | /purchase-orders |
| Suppliers.jsx | Supplier listing | /suppliers |
| SupplierDetail.jsx | Supplier detail | /suppliers/:id |
| Customers.jsx | Customer listing | /customers |
| CustomerDetail.jsx | Customer detail | /customers/:id |
| Quotations.jsx | Quotation management | /quotations |
| SalesOrders.jsx | Sales order management | /sales-orders |
| Quality.jsx | QC inspections | /quality |
| Machines.jsx | Machine listing | /machines |
| MachineDetail.jsx | Machine detail | /machines/:id |
| Maintenance.jsx | Maintenance orders | /maintenance |
| Scheduling.jsx | Production scheduling | /scheduling |
| MRP.jsx | Material Requirement Planning | /mrp |
| Shipping.jsx | Shipment management | /shipping |
| Samples.jsx | Sample management | /samples |
| Returns.jsx | Returns (purchase + sales) | /returns |
| Expenses.jsx | Expense management | /expenses |
| ChartOfAccounts.jsx | Account tree | /chart-of-accounts |
| JournalEntries.jsx | Journal entry listing | /journal-entries |
| TrialBalance.jsx | Trial balance report | /trial-balance |
| Reports.jsx | Report center | /reports |
| Documents.jsx | Document management | /documents |
| Notifications.jsx | Notification center | /notifications |
| Permissions.jsx | Permission management | /permissions |
| Users.jsx | User management | /users |
| Profile.jsx | Current user profile | /profile |
| ChangePassword.jsx | Password change | /change-password |
| Settings.jsx | System settings | /settings |
| Backups.jsx | Backup management | /backups |
| AuditLog.jsx | Audit trail viewer | /audit-log |
| BomTemplates.jsx | BOM template management | /bom-templates |
| StageTemplates.jsx | Stage template management | /stage-templates |
| PrintView.jsx | Generic print layout | /print |
| NotFound.jsx | 404 page | * |
| HR/ (4 pages) | Employees, Attendance, Payroll, PaySlip | /hr/* |

---

## 8. Frontend Components (28 components)

| Component | Purpose |
|-----------|---------|
| BarcodePrint.jsx | Print barcode labels |
| BarcodeScanner.jsx | Camera barcode scanning |
| BomTemplateLoader.jsx | Load BOM templates |
| BomVariantTabs.jsx | BOM variant tab navigation |
| Breadcrumbs.jsx | Navigation breadcrumbs |
| ConfirmDialog.jsx | Confirm/cancel dialog |
| CostPanel.jsx | Cost breakdown display |
| DashboardCharts.jsx | Chart widgets for dashboard |
| ErrorBoundary.jsx | React error boundary |
| ExportButton.jsx | Export data button |
| FabricBlock.jsx | Fabric card/block display |
| FabricSearchDropdown.jsx | Fabric search autocomplete |
| GlobalSearch.jsx | Global search bar |
| HelpButton.jsx | Help/tooltip button |
| ImageUpload.jsx | Image upload widget |
| ImportCSV.jsx | CSV import dialog |
| NotificationBell.jsx | Notification icon + badge |
| Pagination.jsx | Table pagination controls |
| PermissionGuard.jsx | Conditional render by permission |
| PriorityBadge.jsx | Priority level badge |
| QuickActions.jsx | Quick action buttons |
| SizeGrid.jsx | Size/quantity grid |
| StageChecklist.jsx | WO stage checklist |
| StatusBadge.jsx | Status indicator badge |
| SupplierSelect.jsx | Supplier dropdown |
| Toast.jsx | Toast notification |
| AccessoryTable.jsx | Accessory data table |
| ui/ | Shared UI primitives |

---

## 9. Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/api.test.js` | 58 | ✅ All passing |
| `tests/test-v10-comprehensive.js` | — | Legacy/reference |
| `tests/test-v7-api.js` | — | Legacy/reference |
| `tests/test-v7.js` | — | Legacy/reference |
| `tests/test-v8-comprehensive.js` | — | Legacy/reference |
| `tests/test-v9-comprehensive.js` | — | Legacy/reference |

Test runner: `node --test tests/api.test.js`  
Environment: Uses `TEST_BASE` env var for base URL.

---

## 10. Build & Deployment

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | concurrently backend + frontend | Development |
| `npm run build` | vite build + electron-builder --win | Production build |
| `npm run test` | node --test tests/api.test.js | Run backend tests |
| `npm run seed` | node seed.js | Seed database |
| `seed.bat` | Batch wrapper for seed | Windows convenience |
| `run.bat` | Start dev servers | Windows convenience |
| `healthcheck.bat` | Health check | Windows convenience |
| `backup.bat` | Database backup | Windows convenience |
| `build.bat` | Build wrapper | Windows convenience |
| `reset.bat` | Reset database | Windows convenience |

---

## 11. Key Configuration

| Setting | Value | Source |
|---------|-------|--------|
| Backend Port | 9005 | `.env` → `PORT` |
| Frontend Port | 9173 | Vite config |
| JWT Secret | Auto-generated 64 bytes | `.jwt_secret` file |
| JWT Expiry | 24 hours | Hardcoded in auth.js |
| CORS | Configurable via `CORS_ORIGIN` env | `.env` |
| Rate Limit | 20 requests / 15 min (login only) | server.js |
| JSON Body Limit | 10 MB | server.js |
| Upload Dir | `backend/uploads/` | Multer config |
| DB File | `backend/wk-hub.db` | database.js |

---

## 12. File Counts

| Area | Count |
|------|-------|
| Backend route files | 33 |
| Frontend pages | 50 |
| Frontend components | 28 |
| Database tables | 87 + 1 view |
| Schema migrations | 23 (V1–V23) |
| API test cases | 58 |
| Backend utility files | 4 (errors.js, validators.js ×2, csv.js) |
| Middleware files | 1 (auth.js) |
| Tool files | 1 (check-schema.js) |

---

## 13. Known Issues Summary (from Route Audit)

| Severity | Count | Examples |
|----------|-------|---------|
| **CRITICAL** | 4 | Missing auth on notifications/barcode/machine-stats; potential SQL injection in WO cost calc |
| **HIGH** | 12 | No over-receipt prevention; invoice status downgrade; incomplete PO transaction; race conditions |
| **MEDIUM** | 28 | Missing pagination; input validation gaps; inconsistent error formats; missing business logic |
| **LOW** | 15 | Incomplete stage endpoints; predictable filenames; untranslated messages |

> Detailed findings documented in `docs/02-endpoint-audit.md` and `docs/04-issues-triage.md`.

---

*End of Phase 0 — Repository Discovery*
