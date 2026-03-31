/**
 * English Help Content for WK-Factory
 * Mirrors helpContentFull.js structure with English translations
 */

const helpContentEn = {
  dashboard: {
    pageId: 'dashboard',
    pageTitle: 'Dashboard',
    overview: 'The Dashboard is the main page of the system. It shows a comprehensive summary of factory status including production, finance, inventory, and HR. Use it to quickly monitor factory performance and make decisions.',
    features: [
      { id: 'kpi-cards', title: 'KPI Cards', description: 'Key figures showing: active work orders, monthly revenue, total inventory, and pending invoices', action: 'Click any card to navigate to the related page' },
      { id: 'charts', title: 'Charts', description: 'Interactive charts showing production performance and revenue over months', action: 'Hover over charts to see details for each month' },
      { id: 'recent-orders', title: 'Recent Orders', description: 'List of the latest work orders and their current status', action: 'Click an order to view its details' },
      { id: 'alerts', title: 'Alerts', description: 'Low stock alerts, due maintenance, and overdue invoices', action: 'Click an alert to navigate to the issue' },
    ],
    commonTasks: [
      { title: 'Review factory status', steps: ['Open the Dashboard', 'Review the KPI cards at the top', 'Check alerts and resolve urgent issues'] },
      { title: 'Track daily production', steps: ['Check the Active Work Orders card', 'Click it to view details', 'Follow up on delayed stages'] },
    ],
    tips: [
      'The Dashboard updates automatically — no manual refresh needed',
      'Red cards indicate issues that need immediate attention',
      'Use charts to compare performance across different months',
    ],
    troubleshooting: [
      { issue: 'Numbers not updating', solution: 'Reload the page (F5). If the issue persists, check your network connection' },
      { issue: 'Charts not displaying', solution: 'Ensure there is data in the system (work orders and invoices)' },
    ],
    relatedPages: [
      { title: 'Work Orders', url: '/work-orders', description: 'Manage and track work orders' },
      { title: 'Reports', url: '/reports', description: 'Detailed performance reports' },
      { title: 'Notifications', url: '/notifications', description: 'View all alerts' },
    ],
    shortcuts: [{ key: 'Ctrl+K', description: 'Global search' }],
  },

  fabrics: {
    pageId: 'fabrics',
    pageTitle: 'Fabrics',
    overview: 'The Fabrics page allows you to add, edit, and delete fabric types used in the factory. You can specify fabric type (main/lining), price per meter, supplier, and color.',
    features: [
      { id: 'add-fabric', title: 'Add Fabric', description: 'Create a new fabric type with a unique code', action: 'Click "New Fabric" and enter the required details' },
      { id: 'edit-fabric', title: 'Edit Fabric', description: 'Modify an existing fabric\'s details', action: 'Click the edit icon next to the fabric' },
      { id: 'export-csv', title: 'Export CSV', description: 'Download all fabric data as a CSV file', action: 'Click the export button in the toolbar' },
      { id: 'import-csv', title: 'Import CSV', description: 'Add multiple fabrics from a CSV file', action: 'Click the import button and select the file' },
      { id: 'search-filter', title: 'Search & Filter', description: 'Search by code or name with type filtering', action: 'Use the search field or filter buttons' },
    ],
    commonTasks: [
      { title: 'Add a new fabric', steps: ['Click "New Fabric"', 'Enter code, name, type, price, and supplier', 'Click Save'] },
      { title: 'Import fabrics in bulk', steps: ['Download the CSV template', 'Fill in fabric data', 'Click Import and select the file'] },
    ],
    tips: [
      'Use unique codes for each fabric to avoid confusion',
      'Update prices regularly to ensure accurate costing',
      'The search works on both code and name fields',
    ],
    troubleshooting: [
      { issue: 'Cannot delete a fabric', solution: 'Fabrics used in models or work orders cannot be deleted. Archive them instead.' },
      { issue: 'Import fails', solution: 'Ensure the CSV file follows the template format. Check for duplicate codes.' },
    ],
    relatedPages: [
      { title: 'Fabric Inventory', url: '/inventory/fabrics', description: 'View fabric stock levels' },
      { title: 'Suppliers', url: '/suppliers', description: 'Manage fabric suppliers' },
    ],
    shortcuts: [{ key: 'Ctrl+K', description: 'Global search' }],
  },

  accessories: {
    pageId: 'accessories',
    pageTitle: 'Accessories',
    overview: 'Manage all accessories (buttons, zippers, threads, labels, etc.) used in garment production. Track prices, suppliers, and stock levels.',
    features: [
      { id: 'add-accessory', title: 'Add Accessory', description: 'Create a new accessory with code, name, and pricing', action: 'Click "New Accessory" button' },
      { id: 'categories', title: 'Categories', description: 'Filter accessories by category (buttons, zippers, etc.)', action: 'Use the category filter buttons' },
      { id: 'bulk-import', title: 'Bulk Import', description: 'Import multiple accessories from CSV', action: 'Click Import and upload your CSV file' },
    ],
    commonTasks: [
      { title: 'Add a new accessory', steps: ['Click "New Accessory"', 'Enter code, name, unit, price, and supplier', 'Click Save'] },
    ],
    tips: ['Keep accessory codes consistent for easy lookup', 'Link accessories to suppliers for procurement tracking'],
    troubleshooting: [
      { issue: 'Accessory not showing in BOM', solution: 'Ensure the accessory is active and has a valid code' },
    ],
    relatedPages: [
      { title: 'Accessory Inventory', url: '/inventory/accessories', description: 'View stock levels' },
      { title: 'BOM Templates', url: '/bom-templates', description: 'Bill of Materials templates' },
    ],
    shortcuts: [],
  },

  models: {
    pageId: 'models',
    pageTitle: 'Models',
    overview: 'Models (garment designs) are the core of production. Each model has a unique code, fabric and accessory requirements (BOM), stage templates, and cost calculations.',
    features: [
      { id: 'model-list', title: 'Model List', description: 'View all models with search and filtering', action: 'Use search or filter by status' },
      { id: 'create-model', title: 'Create Model', description: 'Design a new garment model with BOM', action: 'Click "New Model"' },
      { id: 'duplicate', title: 'Duplicate Model', description: 'Clone an existing model as a starting point', action: 'Click the duplicate icon on any model' },
    ],
    commonTasks: [
      { title: 'Create a new model', steps: ['Click "New Model"', 'Enter model code and details', 'Add fabric and accessory requirements in BOM', 'Define production stages', 'Save'] },
    ],
    tips: ['Use descriptive model codes that include season/year', 'Always define BOM before creating work orders'],
    troubleshooting: [
      { issue: 'Cannot create work order from model', solution: 'Ensure the model has at least one fabric and one production stage defined' },
    ],
    relatedPages: [
      { title: 'Work Orders', url: '/work-orders', description: 'Create production orders from models' },
      { title: 'BOM Templates', url: '/bom-templates', description: 'Manage Bill of Materials' },
    ],
    shortcuts: [],
  },

  workorders: {
    pageId: 'workorders',
    pageTitle: 'Work Orders',
    overview: 'Work orders are production orders created from models. Track quantities, stages, costs, and progress. Each work order goes through defined production stages.',
    features: [
      { id: 'create-wo', title: 'Create Work Order', description: 'Start a new production run from a model', action: 'Click "New Work Order"' },
      { id: 'stage-tracking', title: 'Stage Tracking', description: 'Monitor progress through each production stage', action: 'Click a work order to see stage details' },
      { id: 'status-flow', title: 'Status Flow', description: 'Track: draft → cutting → in_progress → completed → delivered', action: 'Update status from the detail page' },
    ],
    commonTasks: [
      { title: 'Create a work order', steps: ['Click "New Work Order"', 'Select a model', 'Enter quantity and due date', 'Assign production line', 'Save'] },
      { title: 'Advance a stage', steps: ['Open the work order', 'Go to Stages tab', 'Enter completed quantity', 'Click "Advance Stage"'] },
    ],
    tips: ['Set realistic due dates to avoid schedule conflicts', 'Track stage completion daily for accurate progress'],
    troubleshooting: [
      { issue: 'Cannot advance stage', solution: 'Ensure the previous stage is completed and quantities are entered correctly' },
      { issue: 'Work order stuck in draft', solution: 'Verify that the model has valid BOM and stage templates' },
    ],
    relatedPages: [
      { title: 'Models', url: '/models', description: 'View and create models' },
      { title: 'Scheduling', url: '/scheduling', description: 'Production scheduling' },
      { title: 'Quality', url: '/quality', description: 'Quality control inspections' },
    ],
    shortcuts: [],
  },

  workorderdetail: {
    pageId: 'workorderdetail',
    pageTitle: 'Work Order Detail',
    overview: 'Detailed view of a single work order showing all stages, costs, materials consumed, quality checks, and shipping status.',
    features: [
      { id: 'stages', title: 'Production Stages', description: 'View and manage each production stage', action: 'Click on a stage to update progress' },
      { id: 'costs', title: 'Cost Breakdown', description: 'See material, labor, and overhead costs', action: 'Click the Costs tab' },
      { id: 'quality', title: 'Quality Checks', description: 'View inspection results and defect rates', action: 'Click the Quality tab' },
    ],
    commonTasks: [
      { title: 'Record stage completion', steps: ['Open the Stages tab', 'Enter quantities completed/rejected', 'Click Update'] },
    ],
    tips: ['Check quality results before advancing to the next stage', 'Review cost breakdown regularly to stay within budget'],
    troubleshooting: [
      { issue: 'Costs seem incorrect', solution: 'Verify material prices and quantities consumed are accurate' },
    ],
    relatedPages: [
      { title: 'Work Orders', url: '/work-orders', description: 'Work orders list' },
    ],
    shortcuts: [],
  },

  workorderform: {
    pageId: 'workorderform',
    pageTitle: 'Work Order Form',
    overview: 'Create or edit a work order. Select a model, define quantities, set due dates, and assign to production lines.',
    features: [
      { id: 'model-select', title: 'Model Selection', description: 'Choose from available models with BOM', action: 'Search or select from the dropdown' },
      { id: 'sizes', title: 'Size Breakdown', description: 'Enter quantities per size', action: 'Fill in the size grid' },
    ],
    commonTasks: [
      { title: 'Create a work order', steps: ['Select a model', 'Enter total quantity and size breakdown', 'Set due date', 'Choose production line', 'Save'] },
    ],
    tips: ['Double-check size quantities before saving', 'The system auto-calculates material requirements from BOM'],
    troubleshooting: [
      { issue: 'Model not appearing in dropdown', solution: 'Ensure the model is active and has a valid BOM' },
    ],
    relatedPages: [
      { title: 'Models', url: '/models', description: 'Model definitions' },
    ],
    shortcuts: [],
  },

  invoices: {
    pageId: 'invoices',
    pageTitle: 'Invoices',
    overview: 'Manage sales invoices. Create invoices from work orders or manually, track payments, and monitor accounts receivable.',
    features: [
      { id: 'create-invoice', title: 'Create Invoice', description: 'Create a new sales invoice', action: 'Click "New Invoice"' },
      { id: 'payments', title: 'Payment Tracking', description: 'Record partial or full payments', action: 'Open invoice and click "Record Payment"' },
      { id: 'status-flow', title: 'Status Flow', description: 'draft → sent → partially_paid → paid', action: 'Update status as payments come in' },
    ],
    commonTasks: [
      { title: 'Create an invoice', steps: ['Click "New Invoice"', 'Select customer', 'Add line items with quantities and prices', 'Set payment terms', 'Save'] },
      { title: 'Record a payment', steps: ['Open the invoice', 'Click "Record Payment"', 'Enter amount and payment method', 'Save'] },
    ],
    tips: ['Review invoices before changing status to "sent"', 'Use the aging report to track overdue payments'],
    troubleshooting: [
      { issue: 'Cannot delete invoice', solution: 'Only draft invoices can be deleted. Paid invoices must be voided.' },
    ],
    relatedPages: [
      { title: 'Customers', url: '/customers', description: 'Customer management' },
      { title: 'Reports', url: '/reports', description: 'Financial reports' },
    ],
    shortcuts: [],
  },

  invoiceview: {
    pageId: 'invoiceview',
    pageTitle: 'Invoice Detail',
    overview: 'View and manage a single invoice. See line items, payment history, and print/export options.',
    features: [
      { id: 'line-items', title: 'Line Items', description: 'View and edit invoice line items', action: 'Click Edit to modify items' },
      { id: 'print', title: 'Print Invoice', description: 'Generate a printable invoice', action: 'Click the Print button' },
    ],
    commonTasks: [
      { title: 'Print an invoice', steps: ['Open the invoice', 'Click Print', 'Select printer or save as PDF'] },
    ],
    tips: ['Double-check totals before sending to customer'],
    troubleshooting: [
      { issue: 'Print layout broken', solution: 'Use Chrome or Edge for best print results' },
    ],
    relatedPages: [
      { title: 'Invoices', url: '/invoices', description: 'Invoice list' },
    ],
    shortcuts: [],
  },

  customers: {
    pageId: 'customers',
    pageTitle: 'Customers',
    overview: 'Manage customer records including contact information, addresses, and transaction history.',
    features: [
      { id: 'add-customer', title: 'Add Customer', description: 'Create a new customer record', action: 'Click "New Customer"' },
      { id: 'customer-detail', title: 'Customer Detail', description: 'View full customer profile with orders and invoices', action: 'Click on a customer name' },
    ],
    commonTasks: [
      { title: 'Add a customer', steps: ['Click "New Customer"', 'Enter name, contact, and address', 'Save'] },
    ],
    tips: ['Keep customer contact info up to date', 'Check customer balance before creating new orders'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Invoices', url: '/invoices', description: 'Sales invoices' },
      { title: 'Work Orders', url: '/work-orders', description: 'Production orders' },
    ],
    shortcuts: [],
  },

  suppliers: {
    pageId: 'suppliers',
    pageTitle: 'Suppliers',
    overview: 'Manage supplier records for fabric, accessories, and other materials. Track purchase history and outstanding balances.',
    features: [
      { id: 'add-supplier', title: 'Add Supplier', description: 'Create a new supplier record', action: 'Click "New Supplier"' },
      { id: 'supplier-detail', title: 'Supplier Detail', description: 'View supplier profile with purchase history', action: 'Click on a supplier name' },
    ],
    commonTasks: [
      { title: 'Add a supplier', steps: ['Click "New Supplier"', 'Enter company name, contact, and address', 'Save'] },
    ],
    tips: ['Link suppliers to fabrics and accessories for easy procurement', 'Review supplier performance regularly'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Purchase Orders', url: '/purchase-orders', description: 'Procurement orders' },
      { title: 'Fabrics', url: '/fabrics', description: 'Fabric management' },
    ],
    shortcuts: [],
  },

  purchaseorders: {
    pageId: 'purchaseorders',
    pageTitle: 'Purchase Orders',
    overview: 'Create and manage purchase orders for materials. Track order status, deliveries, and supplier invoices.',
    features: [
      { id: 'create-po', title: 'Create PO', description: 'Create a new purchase order', action: 'Click "New Purchase Order"' },
      { id: 'receive', title: 'Receive Goods', description: 'Record delivery of ordered materials', action: 'Open PO and click "Receive"' },
    ],
    commonTasks: [
      { title: 'Create a purchase order', steps: ['Click "New Purchase Order"', 'Select supplier', 'Add items with quantities and prices', 'Save and send to supplier'] },
    ],
    tips: ['Always verify received quantities against PO', 'Use PO references when recording supplier invoices'],
    troubleshooting: [
      { issue: 'Cannot close PO', solution: 'Ensure all items are fully received or mark remaining as cancelled' },
    ],
    relatedPages: [
      { title: 'Suppliers', url: '/suppliers', description: 'Supplier management' },
      { title: 'Fabric Inventory', url: '/inventory/fabrics', description: 'Stock levels' },
    ],
    shortcuts: [],
  },

  machines: {
    pageId: 'machines',
    pageTitle: 'Machines',
    overview: 'Manage factory machines and equipment. Track maintenance schedules, downtime, and assignments to production lines.',
    features: [
      { id: 'add-machine', title: 'Add Machine', description: 'Register a new machine', action: 'Click "New Machine"' },
      { id: 'maintenance', title: 'Maintenance Schedule', description: 'Set and track maintenance intervals', action: 'Click on a machine to see schedule' },
    ],
    commonTasks: [
      { title: 'Add a machine', steps: ['Click "New Machine"', 'Enter name, type, location, and serial number', 'Set maintenance schedule', 'Save'] },
    ],
    tips: ['Keep maintenance schedules up to date to prevent downtime', 'Track machine assignments for production planning'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Maintenance', url: '/maintenance', description: 'Maintenance tasks' },
      { title: 'Scheduling', url: '/scheduling', description: 'Production scheduling' },
    ],
    shortcuts: [],
  },

  maintenance: {
    pageId: 'maintenance',
    pageTitle: 'Maintenance',
    overview: 'Track and manage machine maintenance tasks. Schedule preventive maintenance and record corrective actions.',
    features: [
      { id: 'schedule', title: 'Schedule Maintenance', description: 'Plan preventive maintenance tasks', action: 'Click "New Task"' },
      { id: 'history', title: 'Maintenance History', description: 'View past maintenance records', action: 'Click on a machine to see history' },
    ],
    commonTasks: [
      { title: 'Schedule maintenance', steps: ['Click "New Task"', 'Select machine', 'Set date and type', 'Assign technician', 'Save'] },
    ],
    tips: ['Regular preventive maintenance reduces unexpected downtime', 'Record all maintenance actions for audit trail'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Machines', url: '/machines', description: 'Machine registry' },
    ],
    shortcuts: [],
  },

  expenses: {
    pageId: 'expenses',
    pageTitle: 'Expenses',
    overview: 'Record and track factory expenses. Categorize by type, assign to departments, and generate expense reports.',
    features: [
      { id: 'add-expense', title: 'Add Expense', description: 'Record a new expense', action: 'Click "New Expense"' },
      { id: 'categories', title: 'Categories', description: 'Filter by expense category', action: 'Use the category filter' },
    ],
    commonTasks: [
      { title: 'Record an expense', steps: ['Click "New Expense"', 'Enter amount, category, and description', 'Attach receipt if available', 'Save'] },
    ],
    tips: ['Always categorize expenses for accurate reporting', 'Attach receipts for audit compliance'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Reports', url: '/reports', description: 'Financial reports' },
      { title: 'Journal Entries', url: '/journal-entries', description: 'Manual journal entries' },
    ],
    shortcuts: [],
  },

  reports: {
    pageId: 'reports',
    pageTitle: 'Reports',
    overview: 'Generate comprehensive reports on production, finance, inventory, and HR. Export to Excel for further analysis.',
    features: [
      { id: 'production-report', title: 'Production Reports', description: 'Work order progress, stage analysis, fabric consumption', action: 'Select report type and date range' },
      { id: 'financial-report', title: 'Financial Reports', description: 'Income statement, balance sheet, cash flow', action: 'Select financial report type' },
      { id: 'export', title: 'Export to Excel', description: 'Download any report as an Excel file', action: 'Click the Export button' },
    ],
    commonTasks: [
      { title: 'Generate a monthly report', steps: ['Select report type', 'Set date range', 'Click Generate', 'Export to Excel if needed'] },
    ],
    tips: ['Compare reports across periods to identify trends', 'Use filters to drill down into specific areas'],
    troubleshooting: [
      { issue: 'Report showing no data', solution: 'Check the date range and ensure there is data for the selected period' },
    ],
    relatedPages: [
      { title: 'Dashboard', url: '/dashboard', description: 'Quick overview' },
      { title: 'Exports Center', url: '/exports', description: 'Bulk data exports' },
    ],
    shortcuts: [],
  },

  settings: {
    pageId: 'settings',
    pageTitle: 'Settings',
    overview: 'Configure factory settings including company info, system preferences, backup schedules, and license management.',
    features: [
      { id: 'company-info', title: 'Company Information', description: 'Set company name, address, and logo', action: 'Edit fields in the Company tab' },
      { id: 'backup', title: 'Backup Settings', description: 'Configure automatic backup schedule', action: 'Go to Backup tab' },
      { id: 'license', title: 'License Management', description: 'View and activate license', action: 'Go to License tab' },
    ],
    commonTasks: [
      { title: 'Change company info', steps: ['Go to Settings', 'Edit company name, address, or logo', 'Save'] },
    ],
    tips: ['Set up regular automatic backups', 'Keep your license key in a safe place'],
    troubleshooting: [
      { issue: 'Settings not saving', solution: 'Ensure you have superadmin permissions' },
    ],
    relatedPages: [
      { title: 'Users', url: '/users', description: 'User management' },
      { title: 'Backups', url: '/backups', description: 'Database backups' },
    ],
    shortcuts: [],
  },

  users: {
    pageId: 'users',
    pageTitle: 'Users',
    overview: 'Manage system users. Create accounts, assign roles, manage permissions, and monitor active sessions.',
    features: [
      { id: 'create-user', title: 'Create User', description: 'Add a new user with role assignment', action: 'Click "New User"' },
      { id: 'invite', title: 'Invite User', description: 'Send an invitation link for self-registration', action: 'Click "Invite" and share the link' },
      { id: 'roles', title: 'Role Management', description: 'Assign roles: superadmin, manager, accountant, production, hr, viewer', action: 'Edit user and change role' },
    ],
    commonTasks: [
      { title: 'Create a user', steps: ['Click "New User"', 'Enter username, name, role', 'Set initial password', 'Save'] },
      { title: 'Reset a password', steps: ['Find the user in the list', 'Click "Reset Password"', 'Copy the reset link and share with the user'] },
    ],
    tips: ['Use the invitation system for self-registration', 'Assign minimum required permissions'],
    troubleshooting: [
      { issue: 'User cannot log in', solution: 'Check if the account is locked or password needs reset' },
    ],
    relatedPages: [
      { title: 'Permissions', url: '/permissions', description: 'Role permissions matrix' },
      { title: 'Audit Log', url: '/audit-log', description: 'User activity log' },
    ],
    shortcuts: [],
  },

  permissions: {
    pageId: 'permissions',
    pageTitle: 'Permissions',
    overview: 'Configure role-based access control (RBAC). Define what each role can view, create, edit, and delete across all modules.',
    features: [
      { id: 'permission-matrix', title: 'Permission Matrix', description: 'Visual grid of all permissions per role', action: 'Toggle checkboxes to grant/revoke' },
    ],
    commonTasks: [
      { title: 'Grant a permission', steps: ['Find the module row', 'Find the role column', 'Check the permission checkbox', 'Save'] },
    ],
    tips: ['Follow the principle of least privilege', 'Test permission changes with a test account'],
    troubleshooting: [
      { issue: 'User says button is missing', solution: 'Check if their role has the required permission for that action' },
    ],
    relatedPages: [
      { title: 'Users', url: '/users', description: 'User management' },
    ],
    shortcuts: [],
  },

  auditlog: {
    pageId: 'auditlog',
    pageTitle: 'Audit Log',
    overview: 'View all system activities. Track who did what, when, and from which IP address. Export for compliance reporting.',
    features: [
      { id: 'filter', title: 'Filters', description: 'Filter by user, action type, entity, and date range', action: 'Use the filter controls at the top' },
      { id: 'export', title: 'Export', description: 'Export audit log to CSV/Excel', action: 'Click the Export button' },
    ],
    commonTasks: [
      { title: 'Find a specific action', steps: ['Set the date range', 'Select the user or action type', 'Click Search'] },
    ],
    tips: ['Review the audit log regularly for suspicious activity', 'Export logs monthly for compliance records'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Users', url: '/users', description: 'User management' },
      { title: 'Settings', url: '/settings', description: 'Retention settings' },
    ],
    shortcuts: [],
  },

  inventory: {
    pageId: 'inventory',
    pageTitle: 'Inventory',
    overview: 'View and manage fabric and accessory stock levels across all locations. Track stock movements and set reorder points.',
    features: [
      { id: 'stock-levels', title: 'Stock Levels', description: 'Current stock for all items', action: 'View the inventory grid' },
      { id: 'transfers', title: 'Stock Transfers', description: 'Move stock between locations', action: 'Click "Transfer" button' },
    ],
    commonTasks: [
      { title: 'Check low stock items', steps: ['Open Inventory page', 'Sort by quantity ascending', 'Review items below reorder point'] },
    ],
    tips: ['Set reorder points for critical materials', 'Reconcile stock counts monthly'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Fabrics', url: '/fabrics', description: 'Fabric management' },
      { title: 'Purchase Orders', url: '/purchase-orders', description: 'Procurement' },
    ],
    shortcuts: [],
  },

  hr: {
    pageId: 'hr',
    pageTitle: 'HR',
    overview: 'Human Resources module covering employees, attendance, payroll, and leave management.',
    features: [],
    commonTasks: [],
    tips: ['Keep employee records up to date', 'Process payroll on time'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Employees', url: '/hr/employees', description: 'Employee records' },
      { title: 'Attendance', url: '/hr/attendance', description: 'Attendance tracking' },
      { title: 'Payroll', url: '/hr/payroll', description: 'Payroll processing' },
    ],
    shortcuts: [],
  },

  employees: {
    pageId: 'employees',
    pageTitle: 'Employees',
    overview: 'Manage employee records including personal info, department, position, salary, and employment history.',
    features: [
      { id: 'add-employee', title: 'Add Employee', description: 'Create a new employee record', action: 'Click "New Employee"' },
      { id: 'import', title: 'Bulk Import', description: 'Import employees from CSV', action: 'Click Import button' },
    ],
    commonTasks: [
      { title: 'Hire a new employee', steps: ['Click "New Employee"', 'Enter personal info and position', 'Set salary and start date', 'Save'] },
    ],
    tips: ['Keep emergency contact info updated', 'Link employees to user accounts for system access'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Attendance', url: '/hr/attendance', description: 'Track attendance' },
      { title: 'Payroll', url: '/hr/payroll', description: 'Process payroll' },
    ],
    shortcuts: [],
  },

  attendance: {
    pageId: 'attendance',
    pageTitle: 'Attendance',
    overview: 'Track daily employee attendance. Record check-in/check-out times, absences, and overtime.',
    features: [
      { id: 'daily-record', title: 'Daily Record', description: 'Mark attendance for all employees', action: 'Select date and mark present/absent' },
      { id: 'summary', title: 'Monthly Summary', description: 'View attendance summary by month', action: 'Select month to see summary' },
    ],
    commonTasks: [
      { title: 'Record daily attendance', steps: ['Select today\'s date', 'Mark each employee as present/absent/late', 'Save'] },
    ],
    tips: ['Record attendance daily for accurate payroll', 'Flag irregular patterns early'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Employees', url: '/hr/employees', description: 'Employee records' },
      { title: 'Payroll', url: '/hr/payroll', description: 'Payroll processing' },
    ],
    shortcuts: [],
  },

  payroll: {
    pageId: 'payroll',
    pageTitle: 'Payroll',
    overview: 'Process monthly payroll. Calculate salaries based on attendance, deductions, and allowances. Generate pay slips.',
    features: [
      { id: 'process', title: 'Process Payroll', description: 'Calculate and finalize monthly payroll', action: 'Select month and click "Process"' },
      { id: 'payslips', title: 'Pay Slips', description: 'Generate individual pay slips', action: 'Click "Pay Slips" after processing' },
    ],
    commonTasks: [
      { title: 'Process monthly payroll', steps: ['Select the month', 'Verify attendance data', 'Click "Process Payroll"', 'Review calculations', 'Finalize'] },
    ],
    tips: ['Verify attendance data before processing payroll', 'Keep payroll records for tax compliance'],
    troubleshooting: [
      { issue: 'Payroll showing wrong amounts', solution: 'Check attendance records and salary settings for affected employees' },
    ],
    relatedPages: [
      { title: 'Attendance', url: '/hr/attendance', description: 'Attendance records' },
      { title: 'Employees', url: '/hr/employees', description: 'Salary settings' },
    ],
    shortcuts: [],
  },

  leaves: {
    pageId: 'leaves',
    pageTitle: 'Leave Management',
    overview: 'Manage employee leave requests. Track annual, sick, and other leave types with approval workflow.',
    features: [
      { id: 'request', title: 'Leave Request', description: 'Submit or approve leave requests', action: 'Click "New Request" or approve pending ones' },
      { id: 'balance', title: 'Leave Balance', description: 'View remaining leave days per employee', action: 'Check the balance column' },
    ],
    commonTasks: [
      { title: 'Approve a leave request', steps: ['View pending requests', 'Review dates and type', 'Click Approve or Reject'] },
    ],
    tips: ['Plan leave during low-production periods', 'Track leave balances to avoid year-end rush'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Employees', url: '/hr/employees', description: 'Employee records' },
      { title: 'Attendance', url: '/hr/attendance', description: 'Attendance tracking' },
    ],
    shortcuts: [],
  },

  accounting: {
    pageId: 'accounting',
    pageTitle: 'Accounting',
    overview: 'Financial accounting module with chart of accounts, journal entries, trial balance, and financial statements.',
    features: [],
    commonTasks: [],
    tips: ['Follow standard accounting practices', 'Reconcile accounts monthly'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Chart of Accounts', url: '/accounting/chart-of-accounts', description: 'Account structure' },
      { title: 'Journal Entries', url: '/accounting/journal-entries', description: 'Manual entries' },
      { title: 'Trial Balance', url: '/accounting/trial-balance', description: 'Trial balance report' },
    ],
    shortcuts: [],
  },

  chartofaccounts: {
    pageId: 'chartofaccounts',
    pageTitle: 'Chart of Accounts',
    overview: 'Define and manage the chart of accounts. Organize accounts by type: assets, liabilities, equity, revenue, and expenses.',
    features: [
      { id: 'add-account', title: 'Add Account', description: 'Create a new account in the chart', action: 'Click "New Account"' },
    ],
    commonTasks: [
      { title: 'Add a new account', steps: ['Click "New Account"', 'Enter account number, name, and type', 'Set parent account if applicable', 'Save'] },
    ],
    tips: ['Follow standard account numbering conventions', 'Do not delete accounts with transactions'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Journal Entries', url: '/accounting/journal-entries', description: 'Manual entries' },
    ],
    shortcuts: [],
  },

  journalentries: {
    pageId: 'journalentries',
    pageTitle: 'Journal Entries',
    overview: 'Create manual journal entries for adjustments, corrections, and non-standard transactions.',
    features: [
      { id: 'create-entry', title: 'Create Entry', description: 'Create a new journal entry', action: 'Click "New Entry"' },
    ],
    commonTasks: [
      { title: 'Create a journal entry', steps: ['Click "New Entry"', 'Add debit and credit lines', 'Ensure totals balance', 'Save'] },
    ],
    tips: ['Always include a clear description', 'Verify debit equals credit before saving'],
    troubleshooting: [
      { issue: 'Entry not saving', solution: 'Ensure debit and credit totals are equal' },
    ],
    relatedPages: [
      { title: 'Chart of Accounts', url: '/accounting/chart-of-accounts', description: 'Account list' },
      { title: 'Trial Balance', url: '/accounting/trial-balance', description: 'Balance verification' },
    ],
    shortcuts: [],
  },

  trialbalance: {
    pageId: 'trialbalance',
    pageTitle: 'Trial Balance',
    overview: 'View the trial balance report showing all account balances. Verify that debits equal credits.',
    features: [
      { id: 'date-filter', title: 'Date Filter', description: 'View balances as of a specific date', action: 'Select the date' },
    ],
    commonTasks: [
      { title: 'Check trial balance', steps: ['Select the reporting date', 'Review the balance totals', 'Investigate any discrepancies'] },
    ],
    tips: ['Run trial balance before generating financial statements', 'Investigate any imbalances immediately'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Journal Entries', url: '/accounting/journal-entries', description: 'Manual entries' },
      { title: 'Reports', url: '/reports', description: 'Financial reports' },
    ],
    shortcuts: [],
  },

  notifications: {
    pageId: 'notifications',
    pageTitle: 'Notifications',
    overview: 'View all system notifications including alerts, reminders, and status updates. Mark as read or dismiss.',
    features: [
      { id: 'filter', title: 'Filter', description: 'Filter by type or read status', action: 'Use the filter tabs' },
      { id: 'mark-read', title: 'Mark as Read', description: 'Mark individual or all notifications as read', action: 'Click the checkbox or "Mark All Read"' },
    ],
    commonTasks: [
      { title: 'View unread notifications', steps: ['Open Notifications page', 'Unread items are highlighted', 'Click to view details'] },
    ],
    tips: ['Check notifications regularly', 'Configure notification preferences in Settings'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Dashboard', url: '/dashboard', description: 'Quick overview' },
    ],
    shortcuts: [],
  },

  bomtemplates: {
    pageId: 'bomtemplates',
    pageTitle: 'BOM Templates',
    overview: 'Bill of Materials templates define the fabric and accessory requirements for each model. Reuse templates across similar models.',
    features: [
      { id: 'create', title: 'Create Template', description: 'Define a new BOM template', action: 'Click "New Template"' },
      { id: 'items', title: 'BOM Items', description: 'Add fabric and accessory requirements', action: 'Add items to the template' },
    ],
    commonTasks: [
      { title: 'Create a BOM template', steps: ['Click "New Template"', 'Name the template', 'Add required fabrics with quantities per piece', 'Add required accessories', 'Save'] },
    ],
    tips: ['Create templates for standard models to save time', 'Include waste allowance in fabric quantities'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Models', url: '/models', description: 'Model definitions' },
      { title: 'Fabrics', url: '/fabrics', description: 'Fabric list' },
    ],
    shortcuts: [],
  },

  stagetemplates: {
    pageId: 'stagetemplates',
    pageTitle: 'Stage Templates',
    overview: 'Define production stage templates (cutting, sewing, finishing, etc.) that are applied to work orders.',
    features: [
      { id: 'create', title: 'Create Template', description: 'Define a new production stage', action: 'Click "New Template"' },
      { id: 'order', title: 'Stage Order', description: 'Arrange stages in production sequence', action: 'Drag to reorder' },
    ],
    commonTasks: [
      { title: 'Create a stage template', steps: ['Click "New Template"', 'Enter stage name and description', 'Set estimated duration', 'Save'] },
    ],
    tips: ['Keep stage names consistent', 'Include quality check stages between major production stages'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Work Orders', url: '/work-orders', description: 'Production orders' },
      { title: 'Models', url: '/models', description: 'Model definitions' },
    ],
    shortcuts: [],
  },

  scheduling: {
    pageId: 'scheduling',
    pageTitle: 'Scheduling',
    overview: 'Production scheduling with Gantt chart view. Plan and track work order timelines, machine assignments, and resource allocation.',
    features: [
      { id: 'gantt', title: 'Gantt Chart', description: 'Visual timeline of production orders', action: 'View and drag to reschedule' },
      { id: 'conflicts', title: 'Conflict Detection', description: 'Identify scheduling conflicts and overloads', action: 'Watch for red highlights' },
    ],
    commonTasks: [
      { title: 'Schedule a work order', steps: ['Open Scheduling page', 'Drag the work order to the desired date/line', 'Check for conflicts', 'Confirm'] },
    ],
    tips: ['Keep buffer time between orders', 'Check machine availability before scheduling'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Work Orders', url: '/work-orders', description: 'Production orders' },
      { title: 'Machines', url: '/machines', description: 'Machine assignments' },
    ],
    shortcuts: [],
  },

  quality: {
    pageId: 'quality',
    pageTitle: 'Quality Control',
    overview: 'Quality control inspections for production stages. Record defects, pass/fail rates, and corrective actions.',
    features: [
      { id: 'inspect', title: 'Inspection', description: 'Record quality inspection results', action: 'Click "New Inspection"' },
      { id: 'defects', title: 'Defect Tracking', description: 'Track and categorize defects', action: 'Log defects during inspection' },
    ],
    commonTasks: [
      { title: 'Perform quality inspection', steps: ['Select work order and stage', 'Record sample size and defects found', 'Mark pass/fail', 'Save'] },
    ],
    tips: ['Inspect at every major stage transition', 'Track defect patterns to identify root causes'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Work Orders', url: '/work-orders', description: 'Production orders' },
    ],
    shortcuts: [],
  },

  quotations: {
    pageId: 'quotations',
    pageTitle: 'Quotations',
    overview: 'Create and manage price quotations for customers. Convert accepted quotations to work orders or invoices.',
    features: [
      { id: 'create', title: 'Create Quotation', description: 'Create a new price quotation', action: 'Click "New Quotation"' },
      { id: 'convert', title: 'Convert to Order', description: 'Convert accepted quotation to work order', action: 'Click "Convert" on an accepted quotation' },
    ],
    commonTasks: [
      { title: 'Create a quotation', steps: ['Click "New Quotation"', 'Select customer', 'Add items with prices', 'Set validity period', 'Save and send'] },
    ],
    tips: ['Set clear validity periods', 'Follow up on pending quotations'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Customers', url: '/customers', description: 'Customer list' },
      { title: 'Invoices', url: '/invoices', description: 'Sales invoices' },
    ],
    shortcuts: [],
  },

  salesorders: {
    pageId: 'salesorders',
    pageTitle: 'Sales Orders',
    overview: 'Manage sales orders from customers. Track order fulfillment, shipping, and invoicing.',
    features: [
      { id: 'create', title: 'Create Order', description: 'Create a new sales order', action: 'Click "New Order"' },
    ],
    commonTasks: [
      { title: 'Process a sales order', steps: ['Create order from quotation or manually', 'Track production progress', 'Ship and invoice'] },
    ],
    tips: ['Link sales orders to work orders for tracking', 'Update order status as production progresses'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Quotations', url: '/quotations', description: 'Price quotations' },
      { title: 'Work Orders', url: '/work-orders', description: 'Production orders' },
      { title: 'Shipping', url: '/shipping', description: 'Shipment tracking' },
    ],
    shortcuts: [],
  },

  samples: {
    pageId: 'samples',
    pageTitle: 'Samples',
    overview: 'Manage sample production. Track sample requests, costs, approvals, and customer feedback.',
    features: [
      { id: 'create', title: 'Create Sample', description: 'Record a new sample request', action: 'Click "New Sample"' },
    ],
    commonTasks: [
      { title: 'Create a sample request', steps: ['Click "New Sample"', 'Enter model and customer details', 'Set deadline', 'Save'] },
    ],
    tips: ['Track sample costs separately from production', 'Get customer approval before starting production'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Models', url: '/models', description: 'Model definitions' },
      { title: 'Customers', url: '/customers', description: 'Customer list' },
    ],
    shortcuts: [],
  },

  shipping: {
    pageId: 'shipping',
    pageTitle: 'Shipping',
    overview: 'Manage shipments and deliveries. Track packages, shipping methods, tracking numbers, and delivery status.',
    features: [
      { id: 'create', title: 'Create Shipment', description: 'Record a new shipment', action: 'Click "New Shipment"' },
      { id: 'tracking', title: 'Tracking', description: 'Update and track shipment status', action: 'Enter tracking number' },
    ],
    commonTasks: [
      { title: 'Ship an order', steps: ['Create shipment from work order', 'Enter carrier and tracking info', 'Update status on delivery'] },
    ],
    tips: ['Always record tracking numbers', 'Confirm delivery with customer'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Work Orders', url: '/work-orders', description: 'Production orders' },
      { title: 'Customers', url: '/customers', description: 'Delivery addresses' },
    ],
    shortcuts: [],
  },

  returns: {
    pageId: 'returns',
    pageTitle: 'Returns',
    overview: 'Process customer returns and exchanges. Track return reasons, quality inspection results, and refund/replacement actions.',
    features: [
      { id: 'create', title: 'Create Return', description: 'Record a new return request', action: 'Click "New Return"' },
    ],
    commonTasks: [
      { title: 'Process a return', steps: ['Create return request', 'Inspect returned items', 'Process refund or replacement', 'Update inventory'] },
    ],
    tips: ['Document return reasons for quality improvement', 'Process returns promptly'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Invoices', url: '/invoices', description: 'Original invoices' },
      { title: 'Quality', url: '/quality', description: 'Quality inspection' },
    ],
    shortcuts: [],
  },

  mrp: {
    pageId: 'mrp',
    pageTitle: 'MRP (Material Requirements Planning)',
    overview: 'Plan material requirements based on work orders and BOM. Calculate what materials are needed, when, and from which suppliers.',
    features: [
      { id: 'calculate', title: 'Calculate Requirements', description: 'Run MRP calculation', action: 'Click "Calculate MRP"' },
      { id: 'suggestions', title: 'Purchase Suggestions', description: 'Auto-generated purchase order suggestions', action: 'Review and approve suggestions' },
    ],
    commonTasks: [
      { title: 'Run MRP', steps: ['Click "Calculate MRP"', 'Review material requirements', 'Approve purchase suggestions', 'Generate purchase orders'] },
    ],
    tips: ['Run MRP before creating purchase orders', 'Keep BOM data accurate for reliable results'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Purchase Orders', url: '/purchase-orders', description: 'Procurement' },
      { title: 'BOM Templates', url: '/bom-templates', description: 'Material specifications' },
    ],
    shortcuts: [],
  },

  documents: {
    pageId: 'documents',
    pageTitle: 'Documents',
    overview: 'Document management system. Upload, organize, and share files related to production, quality, and administration.',
    features: [
      { id: 'upload', title: 'Upload', description: 'Upload new documents', action: 'Click "Upload" or drag & drop' },
      { id: 'categories', title: 'Categories', description: 'Organize by category', action: 'Use folder structure' },
    ],
    commonTasks: [
      { title: 'Upload a document', steps: ['Click "Upload"', 'Select file', 'Choose category', 'Add description', 'Save'] },
    ],
    tips: ['Use descriptive file names', 'Keep documents organized by category'],
    troubleshooting: [],
    relatedPages: [],
    shortcuts: [],
  },

  backups: {
    pageId: 'backups',
    pageTitle: 'Backups',
    overview: 'Database backup and restore. Create manual backups, schedule automatic backups, and restore from previous backups.',
    features: [
      { id: 'create', title: 'Create Backup', description: 'Create a manual backup now', action: 'Click "Backup Now"' },
      { id: 'restore', title: 'Restore', description: 'Restore from a previous backup', action: 'Select backup and click "Restore"' },
      { id: 'schedule', title: 'Schedule', description: 'Configure automatic backup schedule', action: 'Set interval in Settings' },
    ],
    commonTasks: [
      { title: 'Create a backup', steps: ['Click "Backup Now"', 'Wait for confirmation', 'Download the backup file'] },
      { title: 'Restore from backup', steps: ['Select the backup file', 'Confirm restoration', 'Wait for process to complete', 'Verify data'] },
    ],
    tips: ['Take backups before major operations', 'Store backups in a separate location', 'Test restore process periodically'],
    troubleshooting: [
      { issue: 'Restore failed', solution: 'Ensure the backup file is not corrupted and matches the current database version' },
    ],
    relatedPages: [
      { title: 'Settings', url: '/settings', description: 'Backup schedule settings' },
    ],
    shortcuts: [],
  },

  profile: {
    pageId: 'profile',
    pageTitle: 'Profile',
    overview: 'View and edit your user profile. Change password, manage 2FA, and view active sessions.',
    features: [
      { id: 'edit-profile', title: 'Edit Profile', description: 'Update your name and email', action: 'Edit fields and click Save' },
      { id: '2fa', title: 'Two-Factor Auth', description: 'Enable or disable 2FA for your account', action: 'Click "Enable 2FA"' },
      { id: 'sessions', title: 'Active Sessions', description: 'View and terminate active login sessions', action: 'Click "Terminate" on unwanted sessions' },
    ],
    commonTasks: [
      { title: 'Enable 2FA', steps: ['Go to Profile', 'Click "Enable 2FA"', 'Scan QR code with authenticator app', 'Enter verification code', 'Save backup codes'] },
      { title: 'Change password', steps: ['Go to Profile', 'Click "Change Password"', 'Enter current and new password', 'Save'] },
    ],
    tips: ['Enable 2FA for better security', 'Review active sessions regularly'],
    troubleshooting: [
      { issue: 'Cannot enable 2FA', solution: 'Install an authenticator app (Google Authenticator, Authy) on your phone first' },
    ],
    relatedPages: [
      { title: 'Change Password', url: '/change-password', description: 'Password change page' },
    ],
    shortcuts: [],
  },

  knowledgebase: {
    pageId: 'knowledgebase',
    pageTitle: 'Knowledge Base',
    overview: 'Internal knowledge base for factory processes, procedures, and best practices. Search and browse articles.',
    features: [
      { id: 'search', title: 'Search', description: 'Search articles by keyword', action: 'Type in the search box' },
      { id: 'create', title: 'Create Article', description: 'Write a new knowledge base article', action: 'Click "New Article"' },
    ],
    commonTasks: [
      { title: 'Find an article', steps: ['Open Knowledge Base', 'Type keywords in search', 'Click on matching article'] },
    ],
    tips: ['Document processes as you go', 'Keep articles up to date'],
    troubleshooting: [],
    relatedPages: [],
    shortcuts: [],
  },

  exportscenter: {
    pageId: 'exportscenter',
    pageTitle: 'Exports Center',
    overview: 'Central hub for exporting data from any module. Export to Excel, CSV, or PDF formats.',
    features: [
      { id: 'export', title: 'Export Data', description: 'Select module and format to export', action: 'Choose module, set filters, click Export' },
    ],
    commonTasks: [
      { title: 'Export data', steps: ['Select the data module', 'Set date range and filters', 'Choose format (Excel/CSV)', 'Click Export'] },
    ],
    tips: ['Use filters to limit export size', 'Export regularly for backup purposes'],
    troubleshooting: [],
    relatedPages: [
      { title: 'Reports', url: '/reports', description: 'Report generation' },
    ],
    shortcuts: [],
  },
};

export default helpContentEn;
