# Modules Inventory

## Backend Route Files (34 files, 10,189 lines)

| File | Lines | Endpoints | Module |
|------|-------|-----------|--------|
| accessories.js | 186 | 9 | Inventory |
| accounting.js | 406 | 17 | Finance |
| auditlog.js | 49 | 2 | System |
| auth.js | 227 | 8 | Auth |
| autojournal.js | 181 | 5 | Finance |
| backups.js | 80 | 4 | System |
| barcode.js | 115 | 1 | Manufacturing |
| customers.js | 415 | 18 | Sales/CRM |
| documents.js | 226 | 10 | System |
| expenses.js | 256 | 13 | Finance |
| exports.js | 705 | 19 | Reports |
| fabrics.js | 194 | 9 | Inventory |
| hr.js | 923 | 30 | HR |
| inventory.js | 311 | 14 | Inventory |
| invoices.js | 214 | 8 | Finance |
| machines.js | 301 | 14 | Manufacturing |
| maintenance.js | 214 | 12 | Manufacturing |
| models.js | 326 | 14 | Manufacturing |
| mrp.js | 191 | 5 | Manufacturing |
| notifications.js | 279 | 6 | System |
| permissions.js | 134 | 6 | Auth |
| purchaseorders.js | 298 | 11 | Purchasing |
| quality.js | 237 | 14 | Quality |
| quotations.js | 211 | 11 | Sales |
| report-schedules.js | 91 | 5 | Reports |
| reports.js | 1115 | 38 | Reports |
| returns.js | 174 | 8 | Sales/Purchasing |
| samples.js | 126 | 9 | Sales |
| scheduling.js | 220 | 11 | Manufacturing |
| settings.js | 51 | 2 | System |
| shipping.js | 173 | 8 | Sales |
| stagetemplates.js | 61 | 5 | System |
| suppliers.js | 202 | 9 | Purchasing |
| twofa.js | 89 | 3 | Auth |
| users.js | 335 | 17 | Auth |
| workorders.js | 1432 | 34 | Manufacturing |

## Frontend Pages (48 pages, ~17,000 lines)

| Page | Lines | Module |
|------|-------|--------|
| Dashboard.jsx | 647 | Core |
| Reports.jsx | 1765 | Reports |
| WorkOrderDetail.jsx | 768 | Manufacturing |
| Permissions.jsx | 719 | Auth |
| Users.jsx | 562 | Auth |
| WorkOrderForm.jsx | 507 | Manufacturing |
| Quality.jsx | 507 | Quality |
| BomTemplates.jsx | 432 | Manufacturing |
| Invoices.jsx | 459 | Finance |
| PurchaseOrders.jsx | 388 | Purchasing |
| Maintenance.jsx | 341 | Manufacturing |
| KnowledgeBase.jsx | 339 | System |
| ModelForm.jsx | 334 | Manufacturing |
| HR/Employees.jsx | 328 | HR |
| Customers.jsx | 326 | Sales |
| CustomerDetail.jsx | 323 | Sales |
| Accessories.jsx | 320 | Inventory |
| Suppliers.jsx | 313 | Purchasing |
| Expenses.jsx | 310 | Finance |
| Shipping.jsx | 298 | Sales |
| Scheduling.jsx | 285 | Manufacturing |
| HR/Attendance.jsx | 288 | HR |
| Returns.jsx | 275 | Sales |
| HR/Payroll.jsx | 274 | HR |
| Fabrics.jsx | 273 | Inventory |
| JournalEntries.jsx | 258 | Finance |
| Quotations.jsx | 249 | Sales |
| InvoicePrint.jsx | 245 | Finance |
| Settings.jsx | 230 | System |
| Webhooks.jsx | 229 | System |
| Machines.jsx | 225 | Manufacturing |
| OnboardingTour.jsx | 225 | System |
| Profile.jsx | 224 | Auth |
| Samples.jsx | 206 | Sales |
| PrintView.jsx | 204 | Manufacturing |
| reports/PivotTable.jsx | 201 | Reports |
| ReportSchedules.jsx | 196 | Reports |
| HR/Leaves.jsx | 189 | HR |
| Documents.jsx | 181 | System |
| WorkOrdersList.jsx | 181 | Manufacturing |
| ExportsCenter.jsx | 176 | Reports |
| AccessoryInventory.jsx | 158 | Inventory |
| ImportWizard.jsx | 159 | System |
| AuditLog.jsx | 152 | System |
| InvoiceView.jsx | 152 | Finance |
| SalesOrders.jsx | 151 | Sales |
| FabricInventory.jsx | 140 | Inventory |
| TrialBalance.jsx | 149 | Finance |
| ChangePassword.jsx | 131 | Auth |
| ChartOfAccounts.jsx | 129 | Finance |
| MachineDetail.jsx | 127 | Manufacturing |
| Login.jsx | 130 | Auth |
| Setup.jsx | 122 | Auth |
| Notifications.jsx | 116 | System |
| Backups.jsx | 109 | System |
| StageTemplates.jsx | 112 | System |
| AcceptInvite.jsx | 148 | Auth |
| ModelsList.jsx | 74 | Manufacturing |
| NotFound.jsx | 16 | System |
| HR/PaySlip.jsx | 131 | HR |

## Frontend Components (41 components, ~3,800 lines)

| Component | Lines | Purpose |
|-----------|-------|---------|
| Sidebar.jsx | 455 | Main navigation |
| ImportCSV.jsx | 297 | CSV/Excel import wizard |
| BomVariantTabs.jsx | 272 | BOM variant management |
| HelpButton.jsx | 263 | Contextual help system |
| OnboardingTour.jsx | 225 | First-time user tour |
| FabricBlock.jsx | 203 | BOM fabric display |
| StageChecklist.jsx | 190 | Production stage progress |
| SizeGrid.jsx | 189 | Size/color matrix |
| NotificationBell.jsx | 188 | Real-time notifications |
| BarcodeScanner.jsx | 168 | Barcode scanning |
| DashboardWidgets.jsx | 160 | Dashboard widget system |
| FabricSearchDropdown.jsx | 146 | Fabric search autocomplete |
| DataTable.jsx | 126 | Reusable data table |
| GlobalSearch.jsx | 115 | Ctrl+K global search |
| UpgradePrompt.jsx | 110 | License upgrade prompt |
| DashboardConfigPanel.jsx | 108 | Dashboard customization |
| CostPanel.jsx | 107 | Cost calculation display |
| DashboardCharts.jsx | 106 | Dashboard charts |
| DashboardReminders.jsx | 94 | Dashboard reminders |
| AccessoryTable.jsx | 92 | BOM accessory table |
| TableFilters.jsx | 88 | Reusable table filter UI |
| Shared.jsx | 83 | Shared utility components |
| Breadcrumbs.jsx | 77 | Navigation breadcrumbs |
| ConfirmDialog.jsx | 66 | Confirmation modal |
| BomTemplateLoader.jsx | 60 | BOM template selector |
| ExportButton.jsx | 59 | Export dropdown button |
| SupplierSelect.jsx | 57 | Supplier search select |
| BarcodePrint.jsx | 56 | Barcode label printing |
| StatusBadge.jsx | 55 | Status badges |
| ErrorBoundary.jsx | 46 | React error boundary |
| Pagination.jsx | 40 | Pagination component |
| Toast.jsx | 37 | Toast notifications |
| LicenseBanner.jsx | 37 | License status banner |
| Tooltip.jsx | 36 | Tooltip wrapper |
| ImageUpload.jsx | 36 | Image upload component |
| QuickActions.jsx | 32 | Dashboard quick actions |
| StatCard.jsx | 28 | Dashboard stat cards |
| FormSection.jsx | 26 | Form section wrapper |
| PageHeader.jsx | 12 | Page header component |
| PriorityBadge.jsx | 10 | Priority indicator |
| PermissionGuard.jsx | 6 | Permission gate component |

## Backend Middleware (5 files, ~387 lines)

| File | Lines | Purpose |
|------|-------|---------|
| auth.js | 161 | JWT auth, RBAC, audit logging |
| apiKey.js | 92 | API key authentication |
| csrf.js | 59 | CSRF double-submit pattern |
| licenseGuard.js | 57 | License enforcement |
| contentType.js | 18 | Content-type validation |

## Backend Utilities (12 files, ~895 lines)

| File | Lines | Purpose |
|------|-------|---------|
| webhooks.js | 167 | Webhook delivery + HMAC |
| websocket.js | 129 | WebSocket broadcast |
| mailer.js | 119 | SMTP email sending |
| validators.js | 93 | Input validation |
| logger.js | 77 | Structured logging |
| numberGenerator.js | 71 | Sequential number generation |
| money.js | 56 | Money arithmetic (piasters) |
| cleanup.js | 54 | DB cleanup tasks |
| errors.js | 42 | Error class hierarchy |
| fileValidation.js | 39 | File magic byte validation |
| apiResponse.js | 28 | Standard API response format |
| csv.js | 20 | CSV utilities |
