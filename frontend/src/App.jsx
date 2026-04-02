import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useParams } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';
import { LayoutDashboard, Scissors, Gem, PlusCircle, List, Settings, BarChart2, FileText, Factory, Truck, ShoppingCart, ClipboardList, Warehouse, Users, Shield, Clock, Banknote, LogOut, UserCheck, Cog, ChevronDown, PanelLeftClose, PanelLeft, Package, Key, BookOpen, Scale, Bell, Menu, X, Layers, Calendar, DollarSign, Wrench, Calculator, Send, CalendarClock, CheckSquare, FileSpreadsheet, ShoppingBag, Beaker, RotateCcw, FolderOpen, Database, Download, Sun, Moon } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import './i18n'; // Phase 4.2: i18n initialization
// Phase 4.1: Code splitting — lazy load all page components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Fabrics = lazy(() => import('./pages/Fabrics'));
const Accessories = lazy(() => import('./pages/Accessories'));
const ModelForm = lazy(() => import('./pages/ModelForm'));
const ModelsList = lazy(() => import('./pages/ModelsList'));
const BomTemplates = lazy(() => import('./pages/BomTemplates'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const PrintView = lazy(() => import('./pages/PrintView'));
const InvoicePrint = lazy(() => import('./pages/InvoicePrint'));
const Reports = lazy(() => import('./pages/Reports'));
const ExportsCenter = lazy(() => import('./pages/ExportsCenter'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceView = lazy(() => import('./pages/InvoiceView'));
const ChartOfAccounts = lazy(() => import('./pages/ChartOfAccounts'));
const JournalEntries = lazy(() => import('./pages/JournalEntries'));
const TrialBalance = lazy(() => import('./pages/TrialBalance'));
const WorkOrdersList = lazy(() => import('./pages/WorkOrdersList'));
const WorkOrderForm = lazy(() => import('./pages/WorkOrderForm'));
const WorkOrderDetail = lazy(() => import('./pages/WorkOrderDetail'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Customers = lazy(() => import('./pages/Customers'));
const Machines = lazy(() => import('./pages/Machines'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const FabricInventory = lazy(() => import('./pages/FabricInventory'));
const AccessoryInventory = lazy(() => import('./pages/AccessoryInventory'));
const Login = lazy(() => import('./pages/Login'));
const Setup = lazy(() => import('./pages/Setup'));
const UsersPage = lazy(() => import('./pages/Users'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Employees = lazy(() => import('./pages/HR/Employees'));
const Attendance = lazy(() => import('./pages/HR/Attendance'));
const Payroll = lazy(() => import('./pages/HR/Payroll'));
const PaySlip = lazy(() => import('./pages/HR/PaySlip'));
const Leaves = lazy(() => import('./pages/HR/Leaves'));
const Profile = lazy(() => import('./pages/Profile'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const StageTemplates = lazy(() => import('./pages/StageTemplates'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'));
const MachineDetail = lazy(() => import('./pages/MachineDetail'));
const Expenses = lazy(() => import('./pages/Expenses'));
const MaintenancePage = lazy(() => import('./pages/Maintenance'));
const NotFound = lazy(() => import('./pages/NotFound'));
import GlobalSearch from './components/GlobalSearch';
import Breadcrumbs from './components/Breadcrumbs';
import NotificationBell from './components/NotificationBell';
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const Permissions = lazy(() => import('./pages/Permissions'));
const MRP = lazy(() => import('./pages/MRP'));
const Shipping = lazy(() => import('./pages/Shipping'));
const Scheduling = lazy(() => import('./pages/Scheduling'));
const Quality = lazy(() => import('./pages/Quality'));
const Quotations = lazy(() => import('./pages/Quotations'));
const SalesOrders = lazy(() => import('./pages/SalesOrders'));
const Samples = lazy(() => import('./pages/Samples'));
const Returns = lazy(() => import('./pages/Returns'));
const Documents = lazy(() => import('./pages/Documents'));
const Backups = lazy(() => import('./pages/Backups'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const ReportSchedules = lazy(() => import('./pages/ReportSchedules'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
import QuickActions from './components/QuickActions';
import HelpButton from './components/HelpButton';
import OnboardingTour from './components/OnboardingTour'; // Phase 4.8
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import LicenseBanner from './components/LicenseBanner'; // Phase 6.3

// Phase 4.4: Page loading fallback with skeleton
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse space-y-4 w-full max-w-2xl px-8">
        <div className="h-8 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
        <div className="h-64 bg-gray-200 dark:bg-white/10 rounded" />
      </div>
    </div>
  );
}

function ProtectedRoute({ children, perm }) {
  const { user, loading, can } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">جاري التحميل...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (perm && !can(perm[0], perm[1])) {
    return <div className="flex items-center justify-center min-h-screen text-red-400 text-lg">ليس لديك صلاحية للوصول لهذه الصفحة</div>;
  }
  return children;
}

// Maps current route to help content page key
function RouteAwareHelpButton() {
  const location = useLocation();
  const path = location.pathname;
  const PAGE_KEY_MAP = {
    '/dashboard': 'dashboard',
    '/models': 'models',
    '/models/new': 'modelform',
    '/fabrics': 'fabrics',
    '/accessories': 'accessories',
    '/work-orders': 'workorders',
    '/work-orders/new': 'workorderform',
    '/invoices': 'invoices',
    '/customers': 'customers',
    '/suppliers': 'suppliers',
    '/purchase-orders': 'purchaseorders',
    '/machines': 'machines',
    '/maintenance': 'maintenance',
    '/expenses': 'expenses',
    '/reports': 'reports',
    '/settings': 'settings',
    '/users': 'users',
    '/permissions': 'permissions',
    '/audit-log': 'auditlog',
    '/notifications': 'notifications',
    '/inventory/fabrics': 'inventory',
    '/inventory/accessories': 'inventory',
    '/mrp': 'mrp',
    '/shipping': 'shipping',
    '/returns': 'returns',
    '/scheduling': 'scheduling',
    '/quality': 'quality',
    '/quotations': 'quotations',
    '/sales-orders': 'salesorders',
    '/samples': 'samples',
    '/stage-templates': 'stagetemplates',
    '/hr/employees': 'employees',
    '/hr/attendance': 'attendance',
    '/hr/payroll': 'payroll',
    '/hr/leaves': 'leaves',
    '/accounting/coa': 'chartofaccounts',
    '/accounting/journal': 'journalentries',
    '/accounting/trial-balance': 'trialbalance',
    '/documents': 'documents',
    '/backups': 'backups',
    '/profile': 'profile',
  };

  let pageKey = PAGE_KEY_MAP[path];
  if (!pageKey) {
    if (path.match(/^\/models\/.+\/edit$/)) pageKey = 'modelform';
    else if (path.match(/^\/models\/.+\/bom$/)) pageKey = 'bomtemplates';
    else if (path.match(/^\/work-orders\/\d+$/)) pageKey = 'workorderdetail';
    else if (path.match(/^\/work-orders\/\d+\/edit$/)) pageKey = 'workorderform';
    else if (path.match(/^\/invoices\/\d+\/view$/)) pageKey = 'invoiceview';
    else if (path.match(/^\/customers\/\d+$/)) pageKey = 'customers';
    else if (path.match(/^\/suppliers\/\d+$/)) pageKey = 'suppliers';
    else if (path.match(/^\/machines\/\d+$/)) pageKey = 'machines';
  }

  return <HelpButton pageKey={pageKey || 'dashboard'} />;
}

function AppLayout() {
  const { user, logout, can, ROLE_LABELS, ROLE_COLORS } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const location = useLocation();

  const navGroups = [
    {
      items: [
        { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, tour: 'dashboard' },
      ],
    },
    {
      id: 'production',
      label: 'الإنتاج',
      icon: Factory,
      show: () => can('work_orders', 'view') || can('models', 'view'),
      items: [
        { path: '/work-orders', label: 'أوامر الإنتاج', icon: Factory, hide: () => !can('work_orders', 'view'), tour: 'workorders' },
        { path: '/work-orders/new', label: 'أمر جديد', icon: PlusCircle, hide: () => !can('work_orders', 'create') },
        { path: '/models', label: 'الموديلات', icon: List, hide: () => !can('models', 'view') },
        { path: '/machines', label: 'الماكينات', icon: Cog, hide: () => !can('machines', 'view') },
        { path: '/maintenance', label: 'الصيانة', icon: Wrench, hide: () => !can('maintenance', 'view') },
        { path: '/scheduling', label: 'الجدولة', icon: CalendarClock, hide: () => !can('scheduling', 'view') },
        { path: '/stage-templates', label: 'قوالب المراحل', icon: Layers, hide: () => !can('settings', 'view') },
      ],
    },
    {
      id: 'sales',
      label: 'المبيعات',
      icon: ShoppingBag,
      show: () => can('quotations', 'view') || can('sales_orders', 'view') || can('samples', 'view'),
      items: [
        { path: '/quotations', label: 'عروض الأسعار', icon: FileSpreadsheet, hide: () => !can('quotations', 'view') },
        { path: '/sales-orders', label: 'أوامر البيع', icon: ShoppingBag, hide: () => !can('sales_orders', 'view') },
        { path: '/samples', label: 'العينات', icon: Beaker, hide: () => !can('samples', 'view') },
      ],
    },
    {
      id: 'inventory',
      label: 'المخزون',
      icon: Package,
      show: () => can('fabrics', 'view') || can('inventory', 'view'),
      items: [
        { path: '/fabrics', label: 'الأقمشة', icon: Scissors, hide: () => !can('fabrics', 'view') },
        { path: '/accessories', label: 'الاكسسوارات', icon: Gem, hide: () => !can('accessories', 'view') },
        { path: '/inventory/fabrics', label: 'مخزون الأقمشة', icon: Warehouse, hide: () => !can('inventory', 'view') },
        { path: '/inventory/accessories', label: 'مخزون الاكسسوارات', icon: Package, hide: () => !can('inventory', 'view') },
        { path: '/mrp', label: 'تخطيط الاحتياجات', icon: Calculator, hide: () => !can('mrp', 'view') },
      ],
    },
    {
      id: 'shipping',
      label: 'الشحن',
      icon: Send,
      show: () => can('shipping', 'view'),
      items: [
        { path: '/shipping', label: 'الشحنات', icon: Send, hide: () => !can('shipping', 'view') },
        { path: '/returns', label: 'المرتجعات', icon: RotateCcw, hide: () => !can('returns', 'view') },
      ],
    },
    {
      id: 'finance',
      label: 'المالية',
      icon: FileText,
      show: () => can('invoices', 'view') || can('suppliers', 'view') || can('accounting', 'view'),
      items: [
        { path: '/customers', label: 'العملاء', icon: UserCheck, hide: () => !can('invoices', 'view') },
        { path: '/invoices', label: 'الفواتير', icon: FileText, hide: () => !can('invoices', 'view') },
        { path: '/purchase-orders', label: 'أوامر الشراء', icon: ShoppingCart, hide: () => !can('purchase_orders', 'view') },
        { path: '/suppliers', label: 'الموردين', icon: Truck, hide: () => !can('suppliers', 'view') },
        { path: '/accounting/coa', label: 'دليل الحسابات', icon: BookOpen, hide: () => !can('accounting', 'view') },
        { path: '/accounting/journal', label: 'القيود اليومية', icon: Scale, hide: () => !can('accounting', 'view') },
        { path: '/accounting/trial-balance', label: 'ميزان المراجعة', icon: BarChart2, hide: () => !can('accounting', 'view') },
        { path: '/expenses', label: 'المصروفات', icon: DollarSign, hide: () => !can('expenses', 'view') },
      ],
    },
    {
      id: 'quality',
      label: 'الجودة',
      icon: CheckSquare,
      show: () => can('quality', 'view'),
      items: [
        { path: '/quality', label: 'إدارة الجودة', icon: CheckSquare, hide: () => !can('quality', 'view') },
      ],
    },
    {
      id: 'hr',
      label: 'الموارد البشرية',
      icon: Users,
      show: () => can('hr', 'view'),
      items: [
        { path: '/hr/employees', label: 'الموظفون', icon: Users, hide: () => !can('hr', 'view') },
        { path: '/hr/attendance', label: 'الحضور', icon: Clock, hide: () => !can('hr', 'view') },
        { path: '/hr/payroll', label: 'الرواتب', icon: Banknote, hide: () => !can('payroll', 'view') },
        { path: '/hr/leaves', label: 'الإجازات', icon: Calendar, hide: () => !can('hr', 'view') },
      ],
    },
    {
      items: [
        { path: '/reports', label: 'التقارير', icon: BarChart2, hide: () => !can('reports', 'view') },
        { path: '/exports', label: 'مركز التصدير', icon: Download, hide: () => !can('reports', 'view') },
      ],
    },
    {
      id: 'admin',
      label: 'الإدارة',
      icon: Shield,
      show: () => can('users', 'view') || can('audit', 'view') || can('settings', 'view'),
      items: [
        { path: '/users', label: 'المستخدمين', icon: Shield, hide: () => !can('users', 'manage') },
        { path: '/permissions', label: 'الصلاحيات', icon: Key, hide: () => !can('users', 'manage') },
        { path: '/audit-log', label: 'سجل المراجعة', icon: ClipboardList, hide: () => !can('audit', 'view') },
        { path: '/notifications', label: 'الإشعارات', icon: Bell, hide: () => false },
        { path: '/documents', label: 'المستندات', icon: FolderOpen, hide: () => !can('documents', 'view') },
        { path: '/backups', label: 'النسخ الاحتياطية', icon: Database, hide: () => !can('backups', 'view') },
        { path: '/webhooks', label: 'الويب هوكس', icon: Send, hide: () => user?.role !== 'superadmin' },
        { path: '/report-schedules', label: 'التقارير المجدولة', icon: CalendarClock, hide: () => !can('reports', 'view') },
        { path: '/settings', label: 'الإعدادات', icon: Settings, hide: () => !can('settings', 'view') },
      ],
    },
  ];

  // Auto-open group based on current path
  const getActiveGroup = () => {
    for (const g of navGroups) {
      if (g.id && g.items.some(i => location.pathname.startsWith(i.path.split('/').slice(0, 2).join('/')))) return g.id;
    }
    return null;
  };

  const activeGroup = openGroup ?? getActiveGroup();

  return (
    <div className="flex min-h-screen bg-[#f8f9fb] dark:bg-[#0f0f1a]">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside data-tour="sidebar" aria-label="القائمة الرئيسية" role="navigation" className={`${collapsed ? 'w-16' : 'w-56'} bg-[#1a1a2e] flex flex-col shrink-0 no-print transition-all duration-200 fixed lg:sticky lg:top-0 lg:self-start lg:h-screen inset-y-0 right-0 z-50 ${mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        {/* Header */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} h-14 border-b border-white/8`}>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <span className="text-[15px] font-bold text-[#c9a84c] font-[JetBrains_Mono] tracking-tight">WK-Hub</span>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'} className="text-gray-500 hover:text-gray-300 p-1 rounded transition-colors">
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="التنقل الرئيسي" className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {navGroups.map((group, gi) => {
            if (group.show && !group.show()) return null;
            const visibleItems = group.items.filter(item => !item.hide || !item.hide());
            if (visibleItems.length === 0) return null;

            // Single items (no group)
            if (!group.id) {
              return visibleItems.map(item => (
                <NavLink key={item.path} to={item.path} end={item.path === '/dashboard'}
                  onClick={() => setMobileOpen(false)}
                  data-tour={item.tour || undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg text-[13px] transition-colors ${
                      isActive ? 'bg-[#c9a84c]/15 text-[#c9a84c]' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`}>
                  <item.icon size={16} strokeWidth={1.8} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ));
            }

            // Collapsible group
            const isOpen = activeGroup === group.id;
            const GroupIcon = group.icon;
            const hasActive = visibleItems.some(i => location.pathname.startsWith(i.path.split('/').slice(0, 2).join('/')));

            return (
              <div key={gi}>
                <button onClick={() => setOpenGroup(isOpen ? null : group.id)}
                  className={`w-full flex items-center gap-2.5 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg text-[13px] transition-colors
                    ${hasActive ? 'text-[#c9a84c]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                  <GroupIcon size={16} strokeWidth={1.8} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-right">{group.label}</span>
                      <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>
                {isOpen && !collapsed && (
                  <div className="mr-4 mt-0.5 space-y-0.5 border-r border-white/8 pr-0">
                    {visibleItems.map(item => (
                      <NavLink key={item.path} to={item.path} end={item.path === '/models' || item.path === '/work-orders'}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                            isActive ? 'text-[#c9a84c] bg-[#c9a84c]/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                          }`}>
                        <item.icon size={14} strokeWidth={1.5} />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        {user && !collapsed && (
          <div className="px-3 py-3 border-t border-white/8">
            <div className="flex items-center gap-2.5">
              <NavLink to="/profile" className="w-8 h-8 rounded-lg bg-[#c9a84c]/15 flex items-center justify-center text-[#c9a84c] font-bold text-xs hover:bg-[#c9a84c]/25 transition-colors">
                {user.full_name?.charAt(0) || 'U'}
              </NavLink>
              <div className="flex-1 min-w-0">
                <NavLink to="/profile" className="text-[12px] text-gray-200 truncate block hover:text-[#c9a84c] transition-colors">{user.full_name}</NavLink>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${ROLE_COLORS[user.role] || 'bg-gray-500 text-white'}`}>
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </div>
              </div>
              <NavLink to="/change-password" title="تغيير كلمة المرور" className="text-gray-500 hover:text-[#c9a84c] p-1.5 rounded transition-colors">
                <Key size={14} />
              </NavLink>
              <button onClick={logout} title="تسجيل الخروج"
                className="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div className="px-2 py-3 border-t border-white/8 flex flex-col items-center gap-2">
            <NavLink to="/profile" className="w-8 h-8 rounded-lg bg-[#c9a84c]/15 flex items-center justify-center text-[#c9a84c] font-bold text-xs hover:bg-[#c9a84c]/25 transition-colors">
              {user.full_name?.charAt(0) || 'U'}
            </NavLink>
            <button onClick={logout} title="تسجيل الخروج"
              className="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0" role="main" aria-label="المحتوى الرئيسي">
        <LicenseBanner />
        {/* Top header bar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-[#1a1a2e] border-b border-gray-200 dark:border-white/8 flex items-center gap-3 px-4 h-14">
          <button onClick={() => setMobileOpen(true)} aria-label="فتح القائمة" className="lg:hidden text-[#1a1a2e] dark:text-gray-300 p-1">
            <Menu size={20} />
          </button>
          <span className="lg:hidden text-sm font-bold text-[#c9a84c] font-[JetBrains_Mono]">WK-Hub</span>
          <div className="flex-1" data-tour="search"><GlobalSearch /></div>
          <ThemeToggle />
          <span data-tour="help"><RouteAwareHelpButton /></span>
          <span data-tour="notifications"><NotificationBell /></span>
        </header>
        <div className="p-4 lg:p-0">
          <Breadcrumbs />
        </div>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/models" element={<ProtectedRoute perm={['models','view']}><ModelsList /></ProtectedRoute>} />
          <Route path="/models/new" element={<ProtectedRoute perm={['models','create']}><ModelForm /></ProtectedRoute>} />
          <Route path="/models/:code/edit" element={<ProtectedRoute perm={['models','edit']}><ModelForm /></ProtectedRoute>} />
          <Route path="/models/:code/bom" element={<ProtectedRoute perm={['models','edit']}><BomTemplates /></ProtectedRoute>} />
          <Route path="/fabrics" element={<ProtectedRoute perm={['fabrics','view']}><Fabrics /></ProtectedRoute>} />
          <Route path="/accessories" element={<ProtectedRoute perm={['accessories','view']}><Accessories /></ProtectedRoute>} />
          <Route path="/inventory/fabrics" element={<ProtectedRoute perm={['inventory','view']}><FabricInventory /></ProtectedRoute>} />
          <Route path="/inventory/accessories" element={<ProtectedRoute perm={['inventory','view']}><AccessoryInventory /></ProtectedRoute>} />
          <Route path="/work-orders" element={<ProtectedRoute perm={['work_orders','view']}><WorkOrdersList /></ProtectedRoute>} />
          <Route path="/work-orders/new" element={<ProtectedRoute perm={['work_orders','create']}><WorkOrderForm /></ProtectedRoute>} />
          <Route path="/work-orders/:id/edit" element={<ProtectedRoute perm={['work_orders','edit']}><WorkOrderForm /></ProtectedRoute>} />
          <Route path="/work-orders/:id" element={<ProtectedRoute perm={['work_orders','view']}><WorkOrderDetail /></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute perm={['suppliers','view']}><Suppliers /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute perm={['invoices','view']}><Customers /></ProtectedRoute>} />
          <Route path="/machines" element={<ProtectedRoute perm={['machines','view']}><Machines /></ProtectedRoute>} />
          <Route path="/maintenance" element={<ProtectedRoute perm={['maintenance','view']}><MaintenancePage /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute perm={['expenses','view']}><Expenses /></ProtectedRoute>} />
          <Route path="/purchase-orders" element={<ProtectedRoute perm={['purchase_orders','view']}><PurchaseOrders /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute perm={['reports','view']}><Reports /></ProtectedRoute>} />
          <Route path="/exports" element={<ProtectedRoute perm={['reports','view']}><ExportsCenter /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute perm={['invoices','view']}><Invoices /></ProtectedRoute>} />
          <Route path="/accounting/coa" element={<ProtectedRoute perm={['accounting','view']}><ChartOfAccounts /></ProtectedRoute>} />
          <Route path="/accounting/journal" element={<ProtectedRoute perm={['accounting','view']}><JournalEntries /></ProtectedRoute>} />
          <Route path="/accounting/trial-balance" element={<ProtectedRoute perm={['accounting','view']}><TrialBalance /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute perm={['settings','view']}><SettingsPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute perm={['users','manage']}><UsersPage /></ProtectedRoute>} />
          <Route path="/permissions" element={<ProtectedRoute perm={['users','manage']}><Permissions /></ProtectedRoute>} />
          <Route path="/audit-log" element={<ProtectedRoute perm={['audit','view']}><AuditLog /></ProtectedRoute>} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/hr/employees" element={<ProtectedRoute perm={['hr','view']}><Employees /></ProtectedRoute>} />
          <Route path="/hr/attendance" element={<ProtectedRoute perm={['hr','view']}><Attendance /></ProtectedRoute>} />
          <Route path="/hr/payroll" element={<ProtectedRoute perm={['payroll','view']}><Payroll /></ProtectedRoute>} />
          <Route path="/hr/payroll/:periodId/slip/:employeeId" element={<ProtectedRoute perm={['payroll','view']}><PaySlip /></ProtectedRoute>} />
          <Route path="/hr/leaves" element={<ProtectedRoute perm={['hr','view']}><Leaves /></ProtectedRoute>} />
          <Route path="/stage-templates" element={<ProtectedRoute perm={['settings','view']}><StageTemplates /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute perm={['invoices','view']}><CustomerDetail /></ProtectedRoute>} />
          <Route path="/suppliers/:id" element={<ProtectedRoute perm={['suppliers','view']}><SupplierDetail /></ProtectedRoute>} />
          <Route path="/machines/:id" element={<ProtectedRoute perm={['machines','view']}><MachineDetail /></ProtectedRoute>} />
          <Route path="/mrp" element={<ProtectedRoute perm={['mrp','view']}><MRP /></ProtectedRoute>} />
          <Route path="/shipping" element={<ProtectedRoute perm={['shipping','view']}><Shipping /></ProtectedRoute>} />
          <Route path="/scheduling" element={<ProtectedRoute perm={['scheduling','view']}><Scheduling /></ProtectedRoute>} />
          <Route path="/quality" element={<ProtectedRoute perm={['quality','view']}><Quality /></ProtectedRoute>} />
          <Route path="/quotations" element={<ProtectedRoute perm={['quotations','view']}><Quotations /></ProtectedRoute>} />
          <Route path="/sales-orders" element={<ProtectedRoute perm={['sales_orders','view']}><SalesOrders /></ProtectedRoute>} />
          <Route path="/samples" element={<ProtectedRoute perm={['samples','view']}><Samples /></ProtectedRoute>} />
          <Route path="/returns" element={<ProtectedRoute perm={['returns','view']}><Returns /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute perm={['documents','view']}><Documents /></ProtectedRoute>} />
          <Route path="/backups" element={<ProtectedRoute perm={['backups','view']}><Backups /></ProtectedRoute>} />
          <Route path="/webhooks" element={<ProtectedRoute perm={['settings','view']}><Webhooks /></ProtectedRoute>} />
          <Route path="/report-schedules" element={<ProtectedRoute perm={['reports','view']}><ReportSchedules /></ProtectedRoute>} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/change-password" element={<ChangePassword />} />
          {/* Legacy redirects */}
          <Route path="/workorders" element={<Navigate to="/work-orders" replace />} />
          <Route path="/workorders/:id" element={<LegacyWORedirect />} />
          <Route path="/purchaseorders" element={<Navigate to="/purchase-orders" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      <QuickActions />
    </div>
  );
}

function LegacyWORedirect() {
  const { id } = useParams();
  return <Navigate to={`/work-orders/${id}`} replace />;
}

function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button onClick={toggle} title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function AuthRouter() {
  const { user, loading, needsSetup } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#1a1a2e] text-[#c9a84c]">جاري التحميل...</div>;

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#1a1a2e] text-[#c9a84c]">جاري التحميل...</div>}>
    <Routes>
      {needsSetup && <Route path="*" element={<Setup />} />}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/setup" element={needsSetup ? <Setup /> : <Navigate to="/login" replace />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/models/:code/print" element={user ? <PrintView /> : <Navigate to="/login" replace />} />
      <Route path="/models/:code/invoice" element={user ? <InvoicePrint /> : <Navigate to="/login" replace />} />
      <Route path="/invoices/:id/view" element={user ? <InvoiceView /> : <Navigate to="/login" replace />} />
      <Route path="/*" element={user ? <AppLayout /> : <Navigate to="/login" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <OnboardingTour />
              <AuthRouter />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
