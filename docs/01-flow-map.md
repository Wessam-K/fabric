# 01 — Flow Map

> Phase 1 deliverable — all business workflows mapped end-to-end  
> Baseline commit: `19ddc8b`

---

## 1. Authentication Flow

```
┌──────────┐     GET /setup/status        ┌───────────┐
│  Browser  │───────────────────────────────│ needs_setup│
│  (cold)   │                               │  = true?  │
└──────────┘                               └─────┬─────┘
      │                                       yes │  no
      │       ┌──────────────┐                    │   │
      │       │ /setup page  │◄───────────────────┘   │
      │       │ create-admin │                        │
      │       └──────────────┘            ┌───────────┘
      │                                   ▼
      │   localStorage.token?  ──no──► /login page
      │        │ yes                       │
      │        ▼                           │ POST /auth/login
      │   GET /auth/me                     │ (rate limited 20/15m)
      │        │                           ▼
      │        ▼                     Store JWT + user
      │   Valid? ──no──► clear ──► /login
      │     │ yes                          │
      │     ▼                              │
      │   GET /permissions/my              │
      │     │                              │
      │     ▼                              ▼
      └──► Dashboard ◄─────────────────────┘
```

### Token Lifecycle
- **Creation**: `POST /auth/login` → JWT with 24h expiry
- **Refresh**: Request interceptor checks exp, if <2h → `POST /auth/refresh` → new token
- **Invalidation**: `POST /auth/logout` logs audit only — **no server-side blocklist**
- **401 handling**: Response interceptor clears localStorage → redirects to `/login`

### Permission Model
- `superadmin` bypasses all checks
- Other roles: `can(module, action)` checks `permissions[module:action]` loaded from `GET /permissions/my`
- Frontend: `<PermissionGuard>` wraps protected components
- Backend: `requirePermission(resource, action)` middleware

---

## 2. Core Production Flow (Model → BOM → WO → Stages → Completion)

```
┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ Product  │───►│    Model     │───►│ BOM Template │───►│ Work Order  │
│ Design   │    │ sizes, costs │    │ fabrics, acc  │    │ auto-filled │
└─────────┘    └─────────────┘    └──────────────┘    └──────┬──────┘
                                                             │
              ┌──────────────────────────────────────────────┘
              ▼
┌──────────────────────────────────────────────────────────┐
│                    WORK ORDER LIFECYCLE                    │
│                                                           │
│  draft ──► in_progress ──► completed ──► delivered        │
│    │            │                                         │
│    └──► cancelled   └──► cancelled                        │
│                                                           │
│  Stages: pending → in_progress → completed/skipped        │
│  Stage Advance: move qty from stage N → stage N+1         │
│  Auto-complete: WO completes when all stages done         │
└──────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────┐
│              MATERIAL CONSUMPTION (V8)                     │
│                                                           │
│  Fabric batches → fabric_consumption records              │
│  Accessory batches → accessory_consumption records        │
│  Batch meters/qty decremented, stock movements logged     │
└──────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────┐
│                COST & FINALIZATION                         │
│                                                           │
│  calculateWOCost():                                       │
│    fabric_cost + lining + accessories + masnaiya           │
│    + masrouf + waste + extra_expenses                     │
│    ÷ total_pieces = cost_per_piece                        │
│    × (1 + margin%) = suggested_consumer_price             │
│                                                           │
│  finalize: locks costs, creates cost_snapshot             │
│  partial-invoice: generate invoice from WO                │
└──────────────────────────────────────────────────────────┘
```

### Cross-Module Interactions
| Source | Target | Interaction |
|--------|--------|------------|
| BOM Template | WO Creation | Copies fabrics, accessories, sizes, stages |
| fabric_inventory_batches | WO fabric consumption | Decrements `remaining_meters` |
| accessories | WO accessory consumption | Decrements `quantity_on_hand` |
| machines | WO stages | Assigns machine to specific stage |
| invoices | WO | Linked via `wo_invoices` bridge table |
| cost_snapshots | WO finalize | Historical cost record |

---

## 3. Procurement Flow (Supplier → PO → Receive → Inventory)

```
┌──────────┐    ┌─────────────────┐    ┌───────────────┐
│ Supplier  │───►│ Purchase Order   │───►│   Receive     │
│ created   │    │ draft → sent    │    │  items        │
└──────────┘    └─────────────────┘    └───────┬───────┘
                                               │
              ┌────────────────────────────────┘
              ▼
┌──────────────────────────────────────────────────────────┐
│              RECEIVE WORKFLOW                              │
│                                                           │
│  For each PO line item with received_qty:                 │
│                                                           │
│  IF fabric:                                               │
│    → Create fabric_inventory_batches (FB-YYYY-NNNN)       │
│    → Update fabrics.available_meters (+=)                  │
│    → Record fabric_stock_movements                        │
│                                                           │
│  IF accessory:                                            │
│    → Update accessories.quantity_on_hand (+=)              │
│    → Record accessory_stock_movements                     │
│                                                           │
│  Update PO status: partial | received                     │
│  Update received_qty_actual, quantity_variance             │
└──────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Supplier Payments (track against PO)    │
│  payment_date, amount, method, reference │
└─────────────────────────────────────────┘
```

### PO Status Transitions
```
draft ──► sent ──► partial ──► received (terminal)
  │           
  └──► cancelled ◄──► draft (can reopen)
```

---

## 4. Sales Flow (Customer → Quotation → SO → Invoice → Shipping)

```
┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌───────────┐
│ Customer  │───►│ Quotation  │───►│ Sales Order   │───►│  Invoice   │
│           │    │ draft→sent │    │ confirmed     │    │ draft→paid │
└──────────┘    │ →accepted  │    └──────┬───────┘    └─────┬─────┘
                └───────────┘           │                   │
                                        ▼                   ▼
                              ┌──────────────┐    ┌───────────────┐
                              │ Work Order    │    │   Shipment    │
                              │ (SO→WO conv)  │    │pending→shipped│
                              └──────────────┘    │ →delivered     │
                                                  └───────────────┘
```

### Quotation → SO Conversion
1. Updates quotation status to `accepted`
2. Creates `sales_orders` record (copies customer, currency, notes)
3. Copies `quotation_items` → `sales_order_items`
4. Sets SO status to `confirmed`

### SO → WO Conversion
1. Creates work order from SO description (in `notes`)
2. **Does NOT set `model_id`** — only uses text description
3. **No product/BOM references copied**

### Invoice Statuses
```
draft ──► sent ──► paid
  │                  │
  └──► cancelled     └──► overdue (manual)
```
**No status transition validation** — any status can be set to any other.

### Shipment Statuses
```
pending ──► shipped ──► in_transit ──► delivered
                    │
                    └──► cancelled
```
**No status transition validation.**

### Missing Links
- No `sales_order_id` on invoices — invoices not tied back to SOs
- No customer payment tracking — invoice `paid` status is set manually
- Shipping doesn't validate invoice payment status before shipping

---

## 5. Quality Flow (Inspection → Defects → NCR → Corrective Action)

```
┌──────────────┐    ┌────────────────┐    ┌───────────┐
│ QC Template   │───►│ QC Inspection   │───►│   NCR     │
│ checkpoints   │    │ linked to WO    │    │ if defects│
└──────────────┘    │ pass/fail items  │    └─────┬─────┘
                    │ → complete       │          │
                    └────────────────┘          ▼
                                        ┌──────────────┐
                                        │ Root cause    │
                                        │ Corrective    │
                                        │ Preventive    │
                                        │ open→in_prog  │
                                        │  →closed      │
                                        └──────────────┘
```

### QC Inspection Workflow
1. Create inspection (link to WO, optional template)
2. Add inspection items with results (pass/fail per checkpoint)
3. Complete inspection → sets `passed_qty`, `failed_qty`, `result`
4. If defects → Create NCR with root cause analysis

### NCR Statuses: `open → in_progress → closed`

### Gaps
- QC results **don't automatically impact** WO stage quantities
- No hold/release mechanism for defective batches in production
- `defect_code` stored as string in inspection items, not as FK to `defect_codes` table

---

## 6. Financial Flow (Accounting + Expenses + Auto-Journal)

```
┌──────────────────────────────────────────────────────────┐
│                 CHART OF ACCOUNTS (COA)                    │
│  Assets (1xxx) │ Liabilities (2xxx) │ Revenue (4xxx)      │
│  Cash: 1000    │ AP: 2000           │ Sales: 4000         │
│  AR: 1200      │ Tax: 2200          │                     │
│  Tax Recv: 1300│ Salary Pay: 2100   │ Expenses (5xxx)     │
│  Inventory:1400│                    │ COGS: 5000          │
│                │                    │ Salary: 5100        │
│                │                    │ General: 5200       │
└──────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────┐
│              JOURNAL ENTRIES                               │
│                                                           │
│  Manual: POST /accounting/journal (validates DR = CR)     │
│  Auto:   POST /auto-journal/{type}/{id}                   │
│                                                           │
│  Statuses: draft → posted → void                          │
│                                                           │
│  Auto-journal types:                                      │
│    invoice → DR AR / CR Revenue + Tax                     │
│    po-receipt → DR Inventory + Tax / CR AP                │
│    expense → DR Expense / CR Cash                         │
│    payroll → DR Salary Expense / CR Salary Payable        │
│    payment → DR Cash / CR AR (or DR AP / CR Cash)         │
└──────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────┐
│  Trial Balance = SUM(debits) - SUM(credits) per account   │
│  VAT Summary = output tax - input tax                     │
└──────────────────────────────────────────────────────────┘
```

### Gaps
- **No COGS auto-journal** when WO is finalized (cost not transferred from WIP to COGS)
- Auto-journal entries are auto-posted (no draft/review step)
- Payroll auto-journal references wrong column name (`net_salary` vs `net_pay`)

---

## 7. HR Flow (Employees → Attendance → Payroll)

```
┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌──────────┐
│ Employee  │───►│ Attendance │───►│ Payroll Calc  │───►│ Pay Slip │
│ onboard   │    │ clock/import│   │ per period    │    │ per emp  │
└──────────┘    └───────────┘    └──────┬───────┘    └──────────┘
                                        │
                     ┌──────────────────┘
                     ▼
              ┌──────────────────┐
              │ Period Statuses:  │
              │ draft → calculated│
              │   → approved      │
              │   → paid/locked   │
              └──────────────────┘
```

### Payroll Calculation
```
For each active employee in period:
  base_pay = f(salary_type, rate, days_worked, hours)
  overtime = overtime_hours × rate × multiplier
  allowances = housing + transport + food + other
  deductions = absence + late + social + tax + loans + other
  net_pay = gross_pay + bonuses - total_deductions
```

### Salary Types: `monthly`, `daily`, `hourly`, `piece_work`

### Leave Approval Flow
```
pending → approved (auto-creates attendance='leave' records for date range)
        → rejected
```

---

## 8. MRP Flow (Run → Shortage Detection → Auto-PO)

```
┌─────────────────┐    ┌────────────────┐    ┌────────────────┐
│ MRP Calculate     │───►│ Suggestions     │───►│  Auto-PO       │
│ (pending+active   │    │ shortage items  │    │ grouped by     │
│  WO requirements) │    │ qty, supplier   │    │ supplier       │
└─────────────────┘    └────────────────┘    └────────────────┘
```

### MRP Calculation
1. Scan all WOs with status `pending` or `in_progress`
2. Aggregate material requirements (fabrics + accessories)
3. Check `on_hand` (available stock) and `on_order` (open POs)
4. Generate suggestions where `shortage = MAX(0, required - on_hand - on_order)`

### Auto-PO Generation
1. Group suggestions by supplier
2. Create PO per supplier with shortage items
3. Mark suggestions as `po_created`
4. Set MRP run status to `confirmed`

---

## 9. Supporting Flows

### Notifications (Auto-Generated)
- Runs on startup + every 5 minutes via `setInterval` in server.js
- Checks: overdue invoices, low stock, upcoming maintenance, pending leave requests
- **No auth required** on notification endpoints (CRITICAL finding)

### Barcode Lookup
- Scans 10 tables sequentially (WO, fabric batch, accessory, machine, model, invoice, PO, SO, shipment, employee)
- Returns first match with entity type and data
- **No auth required** (CRITICAL finding)

### Global Search
- Searches 11 tables concurrently
- Returns aggregated results with entity type
- **Requires auth** ✓

### Documents
- File upload via Multer (10MB limit per file)
- Stored in `backend/uploads/`
- Metadata in `documents` table
- **Hard delete** (no soft delete)

### Backups
- SQLite `.backup()` method
- Stored in `backend/backups/`
- Download/restore endpoints

---

*End of Phase 1 — Flow Map*
