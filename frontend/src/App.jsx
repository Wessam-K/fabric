import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useParams } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
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
const Returns = lazy(() => import('./pages/Returns'));
const Samples = lazy(() => import('./pages/Samples'));
const Quotations = lazy(() => import('./pages/Quotations'));
const SalesOrders = lazy(() => import('./pages/SalesOrders'));
const Documents = lazy(() => import('./pages/Documents'));
const Backups = lazy(() => import('./pages/Backups'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const ReportSchedules = lazy(() => import('./pages/ReportSchedules'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const ImportWizard = lazy(() => import('./pages/ImportWizard'));
import QuickActions from './components/QuickActions';
import HelpButton from './components/HelpButton';
import Sidebar from './components/Sidebar';
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
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f8f9fb] dark:bg-[#0f0f1a]">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

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
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
          <Route path="/import" element={<ProtectedRoute perm={['settings','view']}><ImportWizard /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute perm={['invoices','view']}><Invoices /></ProtectedRoute>} />
          <Route path="/accounting/coa" element={<ProtectedRoute perm={['accounting','view']}><ChartOfAccounts /></ProtectedRoute>} />
          <Route path="/accounting/journal" element={<ProtectedRoute perm={['accounting','view']}><JournalEntries /></ProtectedRoute>} />
          <Route path="/accounting/trial-balance" element={<ProtectedRoute perm={['accounting','view']}><TrialBalance /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute perm={['settings','view']}><SettingsPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute perm={['users','manage']}><UsersPage /></ProtectedRoute>} />
          <Route path="/permissions" element={<ProtectedRoute perm={['users','manage']}><Permissions /></ProtectedRoute>} />
          <Route path="/audit-log" element={<ProtectedRoute perm={['audit','view']}><AuditLog /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
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
          <Route path="/returns" element={<ProtectedRoute perm={['returns','view']}><Returns /></ProtectedRoute>} />
          <Route path="/samples" element={<ProtectedRoute perm={['samples','view']}><Samples /></ProtectedRoute>} />
          <Route path="/quotations" element={<ProtectedRoute perm={['quotations','view']}><Quotations /></ProtectedRoute>} />
          <Route path="/sales-orders" element={<ProtectedRoute perm={['sales_orders','view']}><SalesOrders /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute perm={['documents','view']}><Documents /></ProtectedRoute>} />
          <Route path="/backups" element={<ProtectedRoute perm={['backups','view']}><Backups /></ProtectedRoute>} />
          <Route path="/webhooks" element={<ProtectedRoute perm={['settings','view']}><Webhooks /></ProtectedRoute>} />
          <Route path="/report-schedules" element={<ProtectedRoute perm={['reports','view']}><ReportSchedules /></ProtectedRoute>} />
          <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
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
      <Route path="/models/:code/print" element={user ? <ProtectedRoute perm={['models','view']}><PrintView /></ProtectedRoute> : <Navigate to="/login" replace />} />
      <Route path="/models/:code/invoice" element={user ? <ProtectedRoute perm={['models','view']}><InvoicePrint /></ProtectedRoute> : <Navigate to="/login" replace />} />
      <Route path="/invoices/:id/view" element={<ProtectedRoute perm={['invoices','view']}><InvoiceView /></ProtectedRoute>} />
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
