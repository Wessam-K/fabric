# WK-Factory Architecture Document
> Auto-generated: March 27, 2026 — Production Audit v7

## 1. System Overview

```
┌─────────────────────────────────────────────────────┐
│                   Electron Shell                     │
│  ┌────────────────────────┐  ┌───────────────────┐  │
│  │  BrowserWindow (React) │  │  Node.js Backend   │  │
│  │  - contextIsolation ✓  │  │  (child process)   │  │
│  │  - sandbox ✓           │──▶  Port 9002         │  │
│  │  - nodeIntegration ✗   │  │  node-runtime/     │  │
│  └────────┬───────────────┘  │  node.exe (v22)    │  │
│           │ IPC (preload.js) └───────┬───────────┘  │
│           │  13 invoke channels      │              │
│           │  5 send channels         │              │
│           │  4 receive channels      │              │
│  ┌────────┴───────────────┐  ┌───────┴───────────┐  │
│  │  lib/security.js       │  │  SQLite (WAL)      │  │
│  │  CSP, DevTools block   │  │  94 tables, V35    │  │
│  │  Navigation restrict   │  │  better-sqlite3    │  │
│  └────────────────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Electron 41.0.2** → React 19 + Vite 6 → Express 4 → SQLite (WAL mode)

## 2. Database Schema Map (94 Tables, Schema V35)

### Auth & Users (7 tables)
| Table | PK | Key Columns | Notes |
|-------|-----|------------|-------|
| users | id | username (UNIQUE), role, status, password_hash | bcrypt 12 rounds |
| password_history | id | user_id FK→users | Prevents reuse (configurable) |
| sessions | id | user_id, token, expires_at | Currently unused |
| role_permissions | id | role, module, action (UNIQUE triple) | Base RBAC |
| user_permissions | id | user_id, module, action (UNIQUE triple) | Per-user override |
| default_permissions | id | role, module, action | Template for new roles |
| audit_log | id | user_id, action, entity_type, old/new values | Full diff |

### Production (13 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| work_orders | id | wo_number (UNIQUE), model_id, customer_id, status |
| wo_stages | id | wo_id FK→work_orders (CASCADE), stage_name, status |
| wo_fabrics | id | wo_id FK (CASCADE), fabric_code |
| wo_accessories | id | wo_id FK (CASCADE), accessory_code |
| wo_sizes | id | wo_id FK (CASCADE), size columns |
| wo_fabric_batches | id | wo_id FK (CASCADE), batch-level tracking |
| wo_expenses | id | wo_id FK (CASCADE), description, amount |
| wo_cost_snapshots | id | wo_id, snapshot data |
| wo_movement_log | id | wo_id, stage_id, action |
| wo_fabric_consumption | id | wo_id FK, actual fabric consumed |
| wo_accessory_consumption | id | wo_id FK, actual accessories consumed |
| wo_waste | id | wo_id FK, waste tracking |
| stage_templates | id | name (UNIQUE), stage definitions |

### Sales & Invoices (12 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| invoices | id | invoice_number (UNIQUE), customer_id, wo_id, status |
| invoice_items | id | invoice_id FK (CASCADE) |
| customers | id | code (UNIQUE), name, balance |
| customer_payments | id | customer_id FK |
| customer_payment_links | id | payment_id, invoice_id |
| quotations | id | quotation_number (UNIQUE), customer_id |
| quotation_items | id | quotation_id FK (CASCADE) |
| sales_orders | id | order_number (UNIQUE) |
| sales_order_items | id | order_id FK (CASCADE) |
| sales_returns | id | return_number (UNIQUE) |
| sales_return_items | id | return_id FK (CASCADE) |
| samples | id | sample_number (UNIQUE) |

### Purchasing (10 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| purchase_orders | id | po_number (UNIQUE), supplier_id |
| purchase_order_items | id | po_id FK (CASCADE) |
| suppliers | id | code (UNIQUE), name, balance |
| supplier_payments | id | supplier_id FK |
| supplier_payment_links | id | payment_id, po_id |
| purchase_returns | id | return_number |
| purchase_return_items | id | return_id FK (CASCADE) |
| mrp_results | id | MRP calculation output |
| mrp_auto_po_log | id | Auto-PO generation tracking |
| number_sequences | id | entity, prefix, next_number |

### Inventory (7 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| fabrics | code (PK) | name, price_per_m, available_meters (GENERATED) |
| fabric_batches | id | fabric_code FK, batch_number |
| fabric_stock_movements | id | fabric_code, movement_type, meters |
| accessories | code (PK) | name, unit_price, quantity_on_hand |
| accessory_stock_movements | id | accessory_code, movement_type |
| bom_templates | id | template_name |
| bom_template_items | id | template_id FK (CASCADE) |

### HR & Payroll (10 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| employees | id | code (UNIQUE), name, status |
| attendance | id | employee_id FK, work_date |
| payroll | id | employee_id FK, period_month, period_year |
| pay_slips | id | payroll_id FK |
| leave_requests | id | employee_id FK |
| employee_documents | id | employee_id FK |
| employee_notes | id | employee_id FK |
| employee_salary_history | id | employee_id FK |
| departments | id | name (UNIQUE) |
| positions | id | title |

### Machines & Maintenance (5 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| machines | id | code (UNIQUE), name, status |
| maintenance_orders | id | machine_id FK, title, priority |
| maintenance_parts | id | maintenance_id FK |
| machine_documents | id | machine_id FK |
| machine_downtime | id | machine_id FK |

### Quality (7 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| qc_templates | id | name |
| qc_template_items | id | template_id FK |
| qc_inspections | id | wo_id FK, template_id FK |
| qc_inspection_results | id | inspection_id FK |
| defect_codes | id | code (UNIQUE) |
| ncr_reports | id | ncr_number, wo_id |
| ncr_actions | id | ncr_id FK |

### Accounting (5 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| chart_of_accounts | id | account_code (UNIQUE) |
| journal_entries | id | entry_number, entry_date |
| journal_entry_lines | id | journal_entry_id FK (CASCADE) |
| expenses | id | description, amount, status |
| auto_journal_config | id | event_type (UNIQUE) |

### Shipping (3 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| shipments | id | shipment_number (UNIQUE) |
| shipment_items | id | shipment_id FK (CASCADE) |
| packing_lists | id | shipment_id FK |

### System (5 tables)
| Table | PK | Key Columns |
|-------|-----|------------|
| settings | id | key (UNIQUE), value | 40+ seeded settings |
| schema_migrations | version (PK) | applied_at | Currently V35 |
| notifications | id | user_id, type, is_read |
| documents | id | title, file_path, entity_type |
| knowledge_base_articles | id | title, content |

### Views (3)
- `model_production_summary` — WO aggregates per model
- `model_cost_analysis` — Cost aggregates per model
- `customer_ledger_view` — Customer balance view

## 3. API Endpoint Registry (250+ endpoints)

### Public Endpoints (no auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | User login with lockout |
| GET | /api/health | Health check |
| GET | /api/setup/status | Check if system needs initial setup |
| POST | /api/setup/create-admin | Create first superadmin (one-time) |

### Protected Endpoints (requireAuth)
| Router Mount | Endpoints | Permission Module |
|-------------|-----------|-------------------|
| /api/auth | 5 | (self-access) |
| /api/users | 5 | users |
| /api/dashboard | 1 | dashboard |
| /api/search | 1 | (per-entity) |
| /api/work-orders | 33 | work_orders |
| /api/models | 10 | models |
| /api/fabrics | 8 | fabrics |
| /api/accessories | 8 | accessories |
| /api/invoices | 8 | invoices |
| /api/customers | 10 | customers |
| /api/suppliers | 8 | suppliers |
| /api/purchase-orders | 8 | purchase_orders |
| /api/hr | 12 | hr, payroll |
| /api/expenses | 8 | expenses |
| /api/reports | 30+ | reports |
| /api/exports | 19 | exports |
| /api/quality | 15 | quality |
| /api/machines | 12 | machines |
| /api/maintenance | 10 | maintenance |
| /api/scheduling | 7 | scheduling |
| /api/mrp | 6 | mrp |
| /api/quotations | 12 | quotations |
| /api/samples | 7 | samples |
| /api/returns | 8 | returns |
| /api/shipping | 8 | shipping |
| /api/accounting | 8 | accounting |
| /api/auto-journal | 5 | accounting |
| /api/notifications | 6 | (self-access) |
| /api/documents | 5 | documents |
| /api/backups | 3 | backups |
| /api/barcode | 1 | (per-entity) |
| /api/inventory | 3 | inventory |
| /api/audit-log | 1 | audit |
| /api/permissions | 6 | (superadmin) |
| /api/settings | 2 | settings |
| /api/stage-templates | 5 | settings |

## 4. Frontend Route Map (57 pages)

| Route | Component | Auth Guard | Roles |
|-------|-----------|------------|-------|
| /login | Login | Public | All |
| /setup | Setup | Public | All |
| /dashboard | Dashboard | Auth only | All |
| /work-orders | WorkOrdersList | work_orders:view | All |
| /work-orders/new | WorkOrderForm | work_orders:create | Manager+ |
| /work-orders/:id | WorkOrderDetail | work_orders:view | All |
| /work-orders/:id/edit | WorkOrderForm | work_orders:edit | Manager+ |
| /models | ModelsList | models:view | All |
| /models/new | ModelForm | models:create | Manager+ |
| /models/:id/edit | ModelForm | models:edit | Manager+ |
| /fabrics | Fabrics | fabrics:view | All |
| /accessories | Accessories | accessories:view | All |
| /invoices | Invoices | invoices:view | Accountant+ |
| /customers | Customers | customers:view | All |
| /suppliers | Suppliers | suppliers:view | All |
| /purchase-orders | PurchaseOrders | purchase_orders:view | All |
| /hr/employees | Employees | hr:view | HR+ |
| /hr/attendance | Attendance | hr:view | HR+ |
| /hr/payroll | Payroll | payroll:view | HR+ |
| /hr/leaves | Leaves | hr:view | HR+ |
| /reports | Reports | reports:view | Manager+ |
| /users | Users | users:view | Superadmin |
| /permissions | Permissions | users:edit | Superadmin |
| /settings | Settings | settings:view | Superadmin |
| /backups | Backups | backups:view | Superadmin |
| /audit-log | AuditLog | audit:view | Manager+ |
| (+ 31 more pages) | | | |

## 5. Authentication & Authorization Flow

```
1. Login → POST /api/auth/login
   ├─ Check account lockout (5 attempts → 15min lock)
   ├─ bcrypt.compareSync(password, hash) [12 rounds]
   ├─ Generate JWT (24h expiry, HS256)
   └─ Return token + user info

2. Every Request → requireAuth middleware
   ├─ Extract Bearer token from Authorization header
   ├─ jwt.verify(token, JWT_SECRET)
   └─ Attach decoded payload to req.user

3. Permission Check → requirePermission(module, action)
   ├─ Superadmin bypasses all checks
   ├─ Check user_permissions table (per-user override)
   └─ Fall back to role_permissions table (role-based)

4. Token Refresh → POST /api/auth/refresh
   ├─ Frontend checks expiry (< 2hrs remaining)
   └─ Issues new JWT without re-authentication
```

## 6. Electron Security Model

| Layer | Setting | Value |
|-------|---------|-------|
| Window | nodeIntegration | false |
| Window | contextIsolation | true |
| Window | sandbox | true |
| Window | webSecurity | true |
| Window | allowRunningInsecureContent | false |
| CSP | script-src | 'self' |
| CSP | connect-src | 'self' http://localhost:9002 |
| CSP | frame-ancestors | 'none' |
| CSP | object-src | 'none' |
| IPC | Channel validation | Whitelist only |
| Navigation | External links | shell.openExternal |
| DevTools | Production | F12 + Ctrl+Shift+I blocked |
| ASAR | Integrity | Size check via original-fs |
| Remote | All events | preventDefault |

## 7. Key Data Flows

### Work Order Lifecycle
```
Draft → Pending → In Progress → Completed → Invoice Created
  │                    │              │
  ├─ Stages assigned   ├─ WIP Board   ├─ Cost calculated
  ├─ Fabrics allocated  ├─ Stage advance├─ Auto-journal entry
  └─ Sizes defined     └─ Consumption  └─ Stock deducted
```

### Invoice Lifecycle
```
Draft → Sent → Overdue → Paid (partial/full)
  │              │           │
  ├─ Items added  ├─ Due date  ├─ Payment linked
  └─ Tax calc    └─ Notify   └─ Journal entry
```

## 8. External Dependencies

### Backend (production)
| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| express | 4.x | HTTP framework | Low |
| better-sqlite3 | 11.10.0 | SQLite driver | Low |
| bcryptjs | 2.x | Password hashing | Low |
| jsonwebtoken | 9.x | JWT auth | Low |
| cors | 2.x | CORS middleware | Low |
| helmet | 8.x | Security headers | Low |
| multer | 1.x | File upload | Low |
| xlsx | * | Excel export | **HIGH** (2 advisories) |
| morgan | 1.x | HTTP logging | Low |

### Frontend (production)
| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| react | 19.x | UI framework | Low |
| axios | 1.x | HTTP client | Low |
| chart.js | 4.x | Charts | Low |
| xlsx | * | Excel export | **HIGH** (2 advisories) |
| react-router-dom | 7.x | Routing | Low |

### Electron
| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| electron | 41.0.2 | Desktop shell | Low |
| electron-builder | 26.8.1 | Packaging | Low |
| winston | 3.x | Logging | Low |
