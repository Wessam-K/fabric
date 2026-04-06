# Fabric ERP — Comprehensive AI Agent Prompt

> Reference prompt for any AI agent tasked with modifying or extending the WK-Factory ERP system.

---

## System Identity

| Field | Value |
|---|---|
| Product | WK-Factory — Garment/Textile Factory ERP |
| Stack | Electron 41 + React 19 + Vite 6 + Express 4.21 + SQLite (better-sqlite3, WAL) |
| Language | JavaScript (no TypeScript) |
| Node.js | v22.16.0 (bundled at `node22/node-v22.16.0-win-x64/`) |
| UI Language | Arabic RTL — all user-facing strings in Arabic |
| DB File | `backend/wk-hub.db` |
| Schema Version | 35+ (auto-init on `require('./database')`) |
| Architecture Doc | `ARCHITECTURE.md` (v8, ~430 lines) |

### Environment Setup (Windows)

```powershell
$env:PATH = "C:\msn3\node22\node-v22.16.0-win-x64;$env:PATH"
cd C:\msn3\fabric\backend
node -v  # Must show v22.x.x
```

> System Node may be v24 — incompatible with native `better-sqlite3` binding.

---

## Directory Layout

```
fabric/
├── backend/
│   ├── server.js          # Express app, port 9173
│   ├── database.js         # ~3000 lines, full schema + initializeDatabase()
│   ├── seed.js             # Comprehensive seed (~970 lines)
│   ├── routes/             # 20+ route files
│   ├── middleware/          # auth.js, rateLimiter.js, csrf.js
│   ├── utils/              # money.js, backup.js
│   ├── lib/                # helpers
│   ├── migrations/         # numbered migration files
│   ├── uploads/            # user-uploaded files (avatars, attachments)
│   └── tests/              # backend unit/integration tests
├── frontend/               # React SPA (Vite)
├── e2e/
│   └── screenshots.spec.js # Playwright E2E (521 lines, 16 phases A-P)
├── electron.js             # Main process
├── preload.js              # Context bridge
├── playwright.config.js    # Viewport 1280×900
├── package.json            # Root package (Electron + scripts)
├── ARCHITECTURE.md         # System architecture reference
├── CHANGELOG.md            # Release changelog
└── .github/
    └── copilot-instructions.md  # AI agent quick reference
```

---

## Database Conventions

### Critical table names (NOT what you might guess)

| Correct Name | Wrong Guess |
|---|---|
| `wo_stages` | ~~work_order_stages~~ |
| `journal_entry_lines` | ~~journal_entries_lines~~ |
| `wo_stage_qc` | ~~qc_inspections~~ |
| `wo_accessories_detail` | ~~wo_accessories~~ (this is the summary table) |
| `fabric_inventory_batches` | ~~fabric_batches~~ |
| `purchase_order_items` | ~~po_items~~ |

### Critical column names

| Table | Correct Column | Wrong Guess |
|---|---|---|
| `journal_entry_lines` | `entry_id` | ~~journal_entry_id~~ |
| `journal_entry_lines` | `account_id` | ~~account_code~~ |
| `wo_stage_qc` | `stage_id` | ~~wo_stage_id~~ |

### Status constraints

| Entity | Valid Statuses |
|---|---|
| Work Orders | `draft`, `pending`, `in_progress`, `completed`, `cancelled` |
| Purchase Orders | `draft`, `sent`, `partial`, `received`, `cancelled` |
| Invoices | `draft`, `sent`, `paid`, `partially_paid`, `cancelled` |
| WO Stages | `pending`, `in_progress`, `completed` |
| Machines | `active`, `maintenance`, `inactive` |

> **No** `paused` for WOs, **no** `ordered` for POs.

### Chart of Accounts (first-level codes)

| Code | Name |
|---|---|
| 1000 | Cash |
| 1100 | Bank |
| 1200 | Accounts Receivable |
| 1300 | Inventory — Fabric |
| 1310 | Inventory — Accessories |
| 2000 | Accounts Payable |
| 2100 | Accrued Expenses |
| 4000 | Sales Revenue |
| 5000 | COGS |
| 6000-6999 | Operating Expenses |

---

## API Conventions

### Authentication

All API routes sit behind `requireAuth`: `app.use('/api', requireAuth, apiRouter)`.
Individual endpoints add `requireRole('admin')` or `requirePermission('manage_users')`.

### Soft-Delete Policy (Enterprise Rule)

**No business record may ever be hard-deleted.** All DELETE endpoints:

1. Check for active dependencies (open POs, active WOs, unpaid invoices, etc.)
2. If dependencies exist → return `409 { error: '...', blocking_count: N }`
3. If clean → `UPDATE ... SET status = 'inactive'`

Protected resources: fabrics, accessories, customers, suppliers, models, employees (HR), stage templates.

### SQL Safety

- 100% parameterized queries: `db.prepare('SELECT * FROM t WHERE id = ?').get(id)`
- **Never** concatenate user input into SQL strings
- Money: use `round2()` and `safeSubtract()` from `utils/money.js`
- CSV: use `escCSV()` with formula injection protection

### Error Responses

- Arabic error messages for user-facing errors
- Never leak stack traces in production
- 500 fallback: `{ error: 'حدث خطأ داخلي' }`

---

## Frontend Standards

- All UI text in Arabic
- RTL layout throughout
- Delete buttons show "تعطيل" (Deactivate), not "حذف" (Delete)
- 409 dependency errors show: "لا يمكن تعطيل — مرتبط بـ {count} سجل نشط"
- Deactivated records hidden by default, shown via "Show Inactive" toggle
- Viewport: stay under 2000px width (Playwright @ 1280×900)

---

## Seed Data

Run: `cd backend && node seed.js`

### Credentials

| Username | Password | Role |
|---|---|---|
| admin | 123456 | superadmin |
| wessam | 123456 | superadmin |
| manager | 123456 | manager |
| viewer | 123456 | viewer |

### Entity Counts

| Entity | Count | Code Range |
|---|---|---|
| Users | 4 | — |
| Suppliers | 8 | SUP-001–008 |
| Fabrics | 12 | FAB-001–012 |
| Accessories | 15 | ACC-001–015 |
| Customers | 6 | CUS-001–006 |
| Models | 6 | MOD-001–006 |
| Purchase Orders | 12 | PO-2026-001–012 |
| Work Orders | 18 | WO-2026-001–018 |
| Invoices | 10 | INV-2026-001–010 |
| Journal Entries | 26 | — |
| Employees | 6 | EMP-001–006 |
| Machines | 4 | MACH-001–004 |
| QC Checks | 22 | in `wo_stage_qc` |
| Expenses | 36 | 3 months × 12 categories |

**Date range**: 2026-01-05 → 2026-04-05 (Egypt Fri+Sat weekend).

---

## Export System

### Main exports (`/api/exports/*`) — 19 endpoints
All support CSV and XLSX via `?format=csv|xlsx`. Date filtering: `?from=&to=`.

Endpoints: suppliers, fabric-usage, accessory-usage, wo-cost-breakdown, model-profitability, po-by-supplier, inventory-valuation (3-sheet XLSX), waste-analysis, financial-summary, customers, quality-report, payroll, employees, machines, stage-progress, production-timeline, purchase-summary, full-export (7-sheet XLSX), catalog.

### Inline entity exports (`/api/{entity}/export`) — 11 endpoints
CSV only with UTF-8 BOM and formula injection protection.

---

## Security Posture

| Layer | Implementation |
|---|---|
| Auth | JWT 24h expiry, bcrypt 12 rounds, lockout (5/15min) |
| 2FA | TOTP with backup codes |
| CSRF | Double-submit cookie (`wk_csrf`), timing-safe compare |
| Rate Limiting | 200 req/min global, 10/15min auth |
| Headers | Helmet (CSP, HSTS 1yr, X-Frame: DENY, noSniff) |
| CORS | Whitelist origins, credentials enabled |
| Uploads | Extension whitelist + magic bytes + 10MB limit |
| SQL | 100% parameterized, no string concatenation |
| Secrets | JWT secret auto-gen (64-byte hex), file mode 0o600 |
| CSV | Formula injection protection (prefix `=+\-@\t` with `'`) |
| API Keys | SHA256 hashed, per-key rate limits, expiry support |

---

## Testing

### Backend Tests
```powershell
cd fabric/backend
npx jest  # or: node --experimental-vm-modules node_modules/.bin/jest
```

### E2E Tests (Playwright)
```powershell
# Terminal 1: Start server
cd fabric/backend && node server.js  # Port 9173

# Terminal 2: Run tests
cd fabric && npx playwright test
```

The E2E suite (`e2e/screenshots.spec.js`) has 16 phases (A–P):
- **A**: Login → **B**: Suppliers CRUD → **C**: Fabrics → **D**: Accessories
- **E**: Customers → **F**: Models with BOM → **G**: Purchase Orders
- **H**: Work Orders → **I**: WO Stage workflow → **J**: QC inspection
- **K**: Invoices → **L**: Accounting/Journal → **M**: HR/Payroll
- **N**: Machines → **O**: Dashboard & Exports → **P**: Settings & Logout

---

## Common Gotchas

1. **Node version**: Must use v22. The bundled `better-sqlite3` native binding expects `NODE_MODULE_VERSION=127`. Node 24 has `NODE_MODULE_VERSION=137`.
2. **QC table**: QC data lives in `wo_stage_qc`, **not** `qc_inspections` (which exists but is empty/unused).
3. **HR table name**: The route is `hr.js` but the table is `employees`. The DELETE endpoint checks `wo_stages` for active assignments.
4. **Journal entries**: `journal_entry_lines.entry_id` references `journal_entries.id`. There is no `journal_entry_id` column.
5. **PO status flow**: `draft → sent → partial → received`. Never `ordered`.
6. **xlsx package**: Backend uses `exceljs` (migrated from xlsx). Frontend still uses `xlsx` (client-side).
7. **Port**: Server runs on `9173`, not 3000 or 8080.
8. **Database auto-init**: `const db = require('./database')` triggers all CREATE TABLE/migrations immediately.
9. **Backup before seed**: `seed.js` creates `.backup` files of the database before wiping.

---

## When Modifying This Codebase

### Adding a new entity
1. Add table in `database.js` `initializeDatabase()`
2. Create route file in `routes/`
3. Register in `server.js` router
4. Add seed data in `seed.js`
5. Add E2E phase in `screenshots.spec.js`
6. Add export endpoint in `routes/exports.js` if needed
7. Update `ARCHITECTURE.md` (table map, endpoint registry)

### Adding a DELETE endpoint
1. Query for active dependencies first (open POs, active WOs, etc.)
2. If deps found → `res.status(409).json({ error: 'لا يمكن تعطيل...', blocking_count })`
3. If clean → `UPDATE ... SET status = 'inactive' WHERE id = ?`
4. Frontend: label button "تعطيل", handle 409 with Arabic message

### Modifying the schema
1. Add migration in `migrations/` with next number
2. Update `database.js` if it's a new table
3. Run `node seed.js` to verify
4. Update E2E if the change affects UI flow
