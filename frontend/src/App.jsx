import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, Scissors, Gem, PlusCircle, List, Settings, BarChart2, FileText, Factory, Truck, ShoppingCart, ClipboardList, Warehouse, Users, Shield, Clock, Banknote, LogOut, UserCheck, Cog, ChevronDown, PanelLeftClose, PanelLeft, Package, User, Key, BookOpen, Scale, Bell, Menu, X, Layers, Calendar, DollarSign, Wrench } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Fabrics from './pages/Fabrics';
import Accessories from './pages/Accessories';
import ModelForm from './pages/ModelForm';
import ModelsList from './pages/ModelsList';
import BomTemplates from './pages/BomTemplates';
import SettingsPage from './pages/Settings';
import PrintView from './pages/PrintView';
import InvoicePrint from './pages/InvoicePrint';
import Reports from './pages/Reports';
import Invoices from './pages/Invoices';
import InvoiceView from './pages/InvoiceView';
import ChartOfAccounts from './pages/ChartOfAccounts';
import JournalEntries from './pages/JournalEntries';
import TrialBalance from './pages/TrialBalance';
import WorkOrdersList from './pages/WorkOrdersList';
import WorkOrderForm from './pages/WorkOrderForm';
import WorkOrderDetail from './pages/WorkOrderDetail';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Machines from './pages/Machines';
import PurchaseOrders from './pages/PurchaseOrders';
import FabricInventory from './pages/FabricInventory';
import AccessoryInventory from './pages/AccessoryInventory';
import Login from './pages/Login';
import Setup from './pages/Setup';
import UsersPage from './pages/Users';
import AuditLog from './pages/AuditLog';
import Employees from './pages/HR/Employees';
import Attendance from './pages/HR/Attendance';
import Payroll from './pages/HR/Payroll';
import PaySlip from './pages/HR/PaySlip';
import Leaves from './pages/HR/Leaves';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';
import StageTemplates from './pages/StageTemplates';
import CustomerDetail from './pages/CustomerDetail';
import SupplierDetail from './pages/SupplierDetail';
import MachineDetail from './pages/MachineDetail';
import Expenses from './pages/Expenses';
import MaintenancePage from './pages/Maintenance';
import NotFound from './pages/NotFound';
import GlobalSearch from './components/GlobalSearch';
import Breadcrumbs from './components/Breadcrumbs';
import NotificationBell from './components/NotificationBell';
import NotificationsPage from './pages/Notifications';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

function ProtectedRoute({ children, roles, perm }) {
  const { user, loading, can } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">جاري التحميل...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (perm && !can(perm[0], perm[1])) {
    return <div className="flex items-center justify-center min-h-screen text-red-400 text-lg">ليس لديك صلاحية للوصول لهذه الصفحة</div>;
  }
  if (roles && !roles.includes(user.role) && user.role !== 'superadmin') {
    return <div className="flex items-center justify-center min-h-screen text-red-400 text-lg">ليس لديك صلاحية للوصول لهذه الصفحة</div>;
  }
  return children;
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
        { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
      ],
    },
    {
      id: 'production',
      label: 'الإنتاج',
      icon: Factory,
      show: () => can('work_orders', 'view') || can('models', 'view'),
      items: [
        { path: '/work-orders', label: 'أوامر الإنتاج', icon: Factory, hide: () => !can('work_orders', 'view') },
        { path: '/work-orders/new', label: 'أمر جديد', icon: PlusCircle, hide: () => !can('work_orders', 'create') },
        { path: '/models', label: 'الموديلات', icon: List, hide: () => !can('models', 'view') },
        { path: '/machines', label: 'الماكينات', icon: Cog, hide: () => !can('machines', 'view') },
        { path: '/maintenance', label: 'الصيانة', icon: Wrench, hide: () => !can('maintenance', 'view') },
        { path: '/stage-templates', label: 'قوالب المراحل', icon: Layers, hide: () => !can('settings', 'view') },
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
      ],
    },
    {
      id: 'admin',
      label: 'الإدارة',
      icon: Shield,
      show: () => can('users', 'view') || can('audit', 'view') || can('settings', 'view'),
      items: [
        { path: '/users', label: 'المستخدمين', icon: Shield, hide: () => !can('users', 'manage') },
        { path: '/audit-log', label: 'سجل المراجعة', icon: ClipboardList, hide: () => !can('audit', 'view') },
        { path: '/notifications', label: 'الإشعارات', icon: Bell, hide: () => false },
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
    <div className="flex min-h-screen bg-[#f8f9fb]">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-[#1a1a2e] flex flex-col shrink-0 no-print transition-all duration-200 fixed lg:static inset-y-0 right-0 z-50 ${mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        {/* Header */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} h-14 border-b border-white/8`}>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <span className="text-[15px] font-bold text-[#c9a84c] font-[JetBrains_Mono] tracking-tight">WK-Hub</span>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-gray-500 hover:text-gray-300 p-1 rounded transition-colors">
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Search + Notifications (only expanded) */}
        {!collapsed && (
          <div className="px-3 pt-2.5 pb-1 flex items-center gap-2">
            <div className="flex-1"><GlobalSearch /></div>
            <NotificationBell />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {navGroups.map((group, gi) => {
            if (group.show && !group.show()) return null;
            const visibleItems = group.items.filter(item => !item.hide || !item.hide());
            if (visibleItems.length === 0) return null;

            // Single items (no group)
            if (!group.id) {
              return visibleItems.map(item => (
                <NavLink key={item.path} to={item.path} end={item.path === '/dashboard'}
                  onClick={() => setMobileOpen(false)}
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
      <main className="flex-1 overflow-auto">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="text-[#1a1a2e]">
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold text-[#c9a84c] font-[JetBrains_Mono]">WK-Hub</span>
        </div>
        <div className="p-4 lg:p-0">
          <Breadcrumbs />
        </div>
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
          <Route path="/invoices" element={<ProtectedRoute perm={['invoices','view']}><Invoices /></ProtectedRoute>} />
          <Route path="/accounting/coa" element={<ProtectedRoute perm={['accounting','view']}><ChartOfAccounts /></ProtectedRoute>} />
          <Route path="/accounting/journal" element={<ProtectedRoute perm={['accounting','view']}><JournalEntries /></ProtectedRoute>} />
          <Route path="/accounting/trial-balance" element={<ProtectedRoute perm={['accounting','view']}><TrialBalance /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute perm={['settings','view']}><SettingsPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute perm={['users','manage']}><UsersPage /></ProtectedRoute>} />
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
          <Route path="/profile" element={<Profile />} />
          <Route path="/change-password" element={<ChangePassword />} />
          {/* Legacy redirects */}
          <Route path="/workorders" element={<Navigate to="/work-orders" replace />} />
          <Route path="/workorders/:id" element={<Navigate to="/work-orders/:id" replace />} />
          <Route path="/purchaseorders" element={<Navigate to="/purchase-orders" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function AuthRouter() {
  const { user, loading, needsSetup } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#1a1a2e] text-[#c9a84c]">جاري التحميل...</div>;

  return (
    <Routes>
      {needsSetup && <Route path="*" element={<Setup />} />}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/models/:code/print" element={<PrintView />} />
      <Route path="/models/:code/invoice" element={<InvoicePrint />} />
      <Route path="/invoices/:id/view" element={<InvoiceView />} />
      <Route path="/*" element={user ? <AppLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AuthRouter />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
