# WK-Factory v3.0 — Feature Changelog
> Release Date: March 2026

## New Features

### 🔔 Real-Time Notifications (B1)
- SSE (Server-Sent Events) push notifications
- Instant alerts for: work order status changes, invoice overdue, low stock, maintenance due
- Polling fallback for older browsers
- Notification bell with unread count badge

### 📊 Production Gantt Chart (B3)
- Visual weekly timeline of all work orders
- Production line assignment and capacity tracking
- Conflict detection (machine double-booking, line overload)
- Drag-and-drop rescheduling endpoint

### 💰 Financial Statements (B4)
- Income Statement (Profit & Loss) — monthly and detailed
- Balance Sheet with retained earnings calculation
- Cash Flow Statement
- Aged Receivables (AR aging: current, 0-30, 31-60, 61-90, 90+ days per customer)
- Aged Payables (AP aging per supplier)
- Period close with lock enforcement
- Trial Balance with date range filter

### 🏭 Multi-Location Inventory (B5 — Schema V36)
- Warehouse CRUD with zones
- Location-based stock tracking (fabric_location_stock, accessory_location_stock)
- Stock transfers between warehouses with approval flow
- FIFO stock valuation (cost_per_unit tracking)
- Reorder point alerts with configurable thresholds
- Batch management with depletion tracking

### 👥 HR Leave Management (B6 — Schema V37)
- Leave types (annual, sick, emergency, etc.)
- Leave balance tracking per employee per year
- Leave request submission with approval workflow
- Org chart with hierarchical reporting structure (reports_to)
- Monthly attendance calendar

### 🤝 CRM Enhancement (B7 — Schema V38)
- Customer detail page with KPI cards
- Invoice and payment history per customer
- AR aging analysis per customer
- Customer notes and contact management
- CSV export/import for customer data

### 📈 Dashboard KPIs (B2)
- 12+ customizable KPI widgets
- Role-based dashboard layouts
- Draggable widget arrangement
- Production pipeline, financial summary, HR stats, stock alerts
- Real-time machine status indicators

### 🔍 Enhanced Search (B8)
- Ctrl+K global search across 11 categories
- Models, fabrics, accessories, invoices, suppliers, work orders, purchase orders
- Debounced real-time results with category icons

### 📱 PWA Support (B9)
- Progressive Web App manifest with RTL support
- Service worker with cache-first strategy for assets
- Network-first for navigation with offline fallback
- App installable on mobile/tablet

### 📄 Document Templates (B10)
- Invoice, quotation, and payslip HTML print templates
- File upload with category and entity linking
- MIME magic byte validation for upload security

### 📊 BI Reports (B11)
- 30+ report tabs including pivot table
- Cost analysis, waste analysis, machine utilization
- Supplier consumption, fabric consumption
- Excel/CSV export for all reports

### 📥 Bulk Import (B12)
- POST /api/import/bulk for fabrics, accessories, suppliers, customers
- Template download for each entity type
- Validation with row-level error reporting
- Transaction-wrapped imports (all-or-nothing per entity)

## Improvements

### ⌨️ Keyboard Shortcuts (C1)
- Global keyboard shortcut hook
- Customizable key combinations

### 📋 Activity Feed (C5)
- System-wide activity log from audit trail
- Recent actions with user attribution

### 🔐 Session Management (C8)
- Current session info endpoint
- Active session monitoring

## Security Updates

### 🛡️ Category D Security
- **D1: Token Blacklist** — JWT revocation on logout (in-memory with TTL cleanup)
- **D2: MIME Validation** — Magic byte verification on file uploads
- **D3: Request ID Tracing** — X-Request-ID header on all requests
- **D4: Input Limits** — Field length limits (10K chars max)

## Bug Fixes

### Category A Fixes
- **A1:** Fixed path-to-regexp ReDoS vulnerability (npm audit fix)
- **A2:** All POST create endpoints now return HTTP 201 (was 200)
- **A3:** Removed 7 empty placeholder test files
- **A4:** Added compression middleware (60-80% response size reduction)
- **A5:** Added 22 RBAC security tests (role isolation, auth bypass, lockout)

### v3.0 Audit Fixes
- Fixed SQL injection in work order stage skip (parameterized query)
- Added negative value validation to invoice PUT endpoint
- Fixed aged receivables/payables to separate current vs overdue buckets
- Added period close enforcement (locks journal entries in closed periods)
- Added parseFloat to journal entry line totals for numeric accuracy
- Added partially_paid status transitions for invoices

## Database Changes

| Version | Tables Added |
|---------|-------------|
| V36 | warehouses, warehouse_zones, fabric_location_stock, accessory_location_stock, inventory_transfers, inventory_transfer_lines |
| V37 | leave_balances, leave_requests + employees.reports_to column |
| V38 | customer_contacts, customer_notes |

**Total: 96 tables (Schema V38)**

---

## Enterprise Hardening (v3.1)

### Phase 1: Security Hardening
- **1.1:** Replaced `xlsx` with `exceljs` — eliminated RCE/prototype-pollution vulnerability across 4 export files
- **1.2:** JWT httpOnly cookies — tokens stored in secure httpOnly cookies, frontend uses `withCredentials`
- **1.3:** Persistent token blacklist — `revoked_tokens` SQLite table with SHA-256 hashes, hourly cleanup
- **1.4:** Upload MIME validation — magic byte verification using `file-type` library (fileValidation.js)
- **1.5:** Strengthened password policy — min 10 chars, upper+lower+digit+special (validators.js)
- **1.6:** Global rate limiting — `express-rate-limit` (200 req/min global, 10/15min auth)
- **1.7:** Timing attack mitigation — dummy bcrypt comparison when user not found
- **1.8:** Hardened debug detection — blocks debugPort, ELECTRON_RUN_AS_NODE, --inspect flags
- **1.9:** Code signing configuration — electron-builder CSC placeholder

### Phase 2: Database & Performance
- **2.2:** Safe monetary arithmetic — `money.js` utility (round2, toPiasters, fromPiasters, safeAdd/Subtract/Multiply)
- **2.3:** Permission caching — in-memory Map cache with 60s TTL, auto-invalidation on permission changes
- **2.4:** Report query limits — configurable `MAX_REPORT_ROWS` (default 5000) on all unbounded report queries
- **2.5:** Auto-scheduled backups — every 6 hours (configurable via `AUTO_BACKUP_HOURS` env var)

### Phase 3: API Hardening
- **3.1:** API versioning — all routes available under both `/api` and `/api/v1` prefixes
- **3.2:** Response compression — already in place (gzip via `compression` middleware)
- **3.3:** Standardized API responses — `apiResponse.js` utility (success/error/notFound/badRequest helpers)
- **3.5:** API key authentication — `X-API-Key` header support for external integrations, keys hashed in `api_keys` table
- **3.6:** Webhook event system — subscribe to events with HMAC-signed payloads, auto-disable after 10 failures

### Phase 4: Frontend Improvements
- **4.1:** Code splitting — all 50+ page components lazy-loaded via `React.lazy()`, reduced initial bundle from 2340KB to 406KB
- **4.4:** Skeleton loading — `PageLoader` component shown during lazy load, existing `Skeleton`/`TableSkeleton` components

### Phase 5: DevOps & Quality
- **5.2:** CI/CD pipeline — GitHub Actions workflow (`.github/workflows/ci.yml`) for test + Electron build
- **5.6:** Monitoring endpoint — `/api/monitoring` with uptime, memory, DB size, backup status, node version

### New Database Tables (v3.1)
| Table | Purpose |
|-------|---------|
| revoked_tokens | Persistent JWT blacklist (Phase 1.3) |
| api_keys | API key authentication (Phase 3.5) |
| webhooks | Webhook subscriptions (Phase 3.6) |
| webhook_logs | Webhook delivery logs (Phase 3.6) |
