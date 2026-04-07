# UI/UX Navigation Audit

## Route Map

**56 routes** defined in App.jsx (41 sidebar-linked + 12 deep links + 3 legacy redirects).
`NotFound` page exists and works correctly.

---

## Bugs Found

### UI-1: `/sales-orders` route missing — HIGH
`SalesOrders.jsx` exists as a page. `NotificationBell.jsx` links `sales_order` notifications to `/sales-orders`. `Breadcrumbs.jsx` has a label for it. `helpContentFull.js` references it. But **no route is defined in App.jsx** — clicking a sales order notification hits the 404 page.

### UI-2: Quotations permission mismatch — MEDIUM
Sidebar shows `/quotations` link when user has `invoices:view`. But the `ProtectedRoute` requires `quotations:view`. User sees link → clicks → gets "permission denied."

### UI-3: Samples permission mismatch — MEDIUM
Sidebar shows `/samples` link when user has `quality:view`. Route requires `samples:view`. Same broken experience.

### UI-4: Invoice view has no permission check — LOW
`/invoices/:id/view` in AuthRouter `ProtectedRoute` has no `perm` prop. Any authenticated user can view any invoice.

### UI-5: Customers route uses wrong permission — LOW
`/customers` route checks `invoices:view` instead of `customers:view`. Semantically confusing.

---

## Sidebar Structure (7 groups + ungrouped)

| Group | Items |
|---|---|
| *(ungrouped)* | Dashboard |
| الإنتاج (Production) | Work Orders, New WO, Models, Machines, Maintenance, Scheduling, Stage Templates |
| المخزون (Inventory) | Fabrics, Accessories, Fabric Stock, Accessory Stock, MRP |
| الشحن (Shipping) | Shipments, Returns |
| المالية (Finance) | Customers, Invoices, POs, Suppliers, COA, Journal, Trial Balance, Expenses, Quotations |
| الجودة (Quality) | QC, Samples |
| الموارد البشرية (HR) | Employees, Attendance, Payroll, Leaves |
| التقارير (Reports) | Reports, Exports, Import |
| الإدارة (Admin) | Users, Permissions, Audit Log, Notifications, Documents, Backups, Webhooks, Report Schedules, Settings, Knowledge Base |

---

## RTL/Arabic Support

- Global `<html lang="ar" dir="rtl">` ✅
- i18next configured with `ar` default ✅
- Sidebar, modals, charts, toasts all RTL ✅
- Print views use `dir="rtl"` ✅
- Cairo + JetBrains Mono fonts ✅
- Some pages redundantly add `dir="rtl"` (harmless)
