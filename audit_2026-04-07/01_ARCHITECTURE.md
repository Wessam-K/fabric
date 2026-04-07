# Architecture Documentation

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 19 |
| **Build Tool** | Vite | 6.4 |
| **Styling** | TailwindCSS | v4 |
| **Desktop** | Electron | 41 |
| **Backend** | Node.js + Express | 22 LTS + 4.x |
| **Database** | SQLite | better-sqlite3 (WAL mode) |
| **Auth** | JWT (jsonwebtoken) + bcryptjs (12 rounds) |
| **Charts** | Chart.js + react-chartjs-2 |
| **Icons** | Lucide React |
| **HTTP** | Axios (httpOnly cookie auth) |
| **Excel** | ExcelJS (server) + XLSX (client) |
| **File Upload** | Multer |
| **Logging** | Custom structured logger |
| **Error Tracking** | Sentry (optional) |
| **WebSocket** | ws |
| **Rate Limiting** | express-rate-limit |
| **Security Headers** | Helmet.js |

## Architecture Pattern

**Modular Monolith** — Single Express server with modular route files, single SQLite database, React SPA frontend.

```
┌─────────────────────────────────────────────────────┐
│                   Electron Shell                     │
│  ┌───────────────────────────────────────────────┐  │
│  │           React 19 SPA (Vite + Tailwind)       │  │
│  │  48 pages · 41 components · Arabic RTL         │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │ Axios (httpOnly cookie)        │
│  ┌──────────────────▼────────────────────────────┐  │
│  │           Express.js API Server                │  │
│  │  34 route files · 310+ endpoints               │  │
│  │  JWT Auth · RBAC · CSRF · Rate Limiting        │  │
│  │  Helmet · Morgan · Compression                 │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │ better-sqlite3 (WAL)           │
│  ┌──────────────────▼────────────────────────────┐  │
│  │           SQLite Database                      │  │
│  │  115 tables · Schema V54 · 11 migrations       │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Module Map

### Core Business Modules
- **Manufacturing** — Work orders, BOM templates, stage tracking, WIP board, fabric/accessory consumption, waste tracking
- **Inventory** — Multi-warehouse, fabric batches, accessory stock, transfers, FIFO valuation, reorder alerts
- **Finance** — Chart of accounts, journal entries, trial balance, income statement, balance sheet, aged AR/AP, VAT
- **Sales** — Customers, quotations, sales orders, invoices, shipping, returns
- **Purchasing** — Suppliers, purchase orders, receiving, purchase returns
- **HR** — Employees, attendance, payroll (4 types), leaves, org chart
- **Quality** — QC templates, inspections, NCR reports, defect codes
- **MRP** — Material requirements planning, auto-PO generation

### System Modules
- **Auth** — JWT + httpOnly cookies, 2FA (TOTP), password reset, session management
- **RBAC** — 7 roles, 240+ permissions, per-user overrides
- **Audit Log** — Full change tracking with old/new values
- **Reports** — 38+ report endpoints, pivot table, export center
- **Scheduling** — Gantt chart, production lines, conflict detection
- **Documents** — File management with magic byte validation
- **Backups** — Database backup/restore
- **Notifications** — SSE real-time + in-app notifications
- **Webhooks** — External integrations with HMAC signatures

## Data Flow

### Sales Flow
```
Quotation → Sales Order → Work Order → Production (WIP stages) → Invoice → Payment
```

### Purchase Flow
```
Reorder Alert/MRP → Purchase Order → Goods Receipt → Inventory Update → Supplier Payment
```

### Production Flow
```
Work Order → Stage Assignment → Cut → Sew → QC → Finish → Pack → Ship
                                ↓         ↓
                          Fabric Consumption  Accessory Consumption
                                ↓         ↓
                          Waste Tracking    Cost Snapshots
```

## Deployment Topology

### Development
- Backend: `node server.js` on port 9002
- Frontend: `vite dev` on port 9173 (proxy → 9002)
- Node.js 22 LTS required

### Production (Docker)
- nginx reverse proxy (TLS termination, gzip, static files)
- Node.js backend container
- SQLite volume mount
- Health checks: `/api/health`, `/api/readiness`

### Desktop (Electron)
- electron-builder → Windows installer (NSIS)
- Auto-updater with `latest.yml`
- Preload script with contextBridge
