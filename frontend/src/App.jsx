import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Scissors, Gem, PlusCircle, List, Settings, Printer, BarChart2, FileText, Factory, Truck, ShoppingCart, ClipboardList, Warehouse, Users, Shield, Clock, Banknote, LogOut, Bell, UserCheck } from 'lucide-react';
import Toast from './components/Toast';
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
import WorkOrdersList from './pages/WorkOrdersList';
import WorkOrderForm from './pages/WorkOrderForm';
import WorkOrderDetail from './pages/WorkOrderDetail';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import PurchaseOrders from './pages/PurchaseOrders';
import FabricInventory from './pages/FabricInventory';
import Login from './pages/Login';
import Setup from './pages/Setup';
import UsersPage from './pages/Users';
import AuditLog from './pages/AuditLog';
import Employees from './pages/HR/Employees';
import Attendance from './pages/HR/Attendance';
import Payroll from './pages/HR/Payroll';
import PaySlip from './pages/HR/PaySlip';
import GlobalSearch from './components/GlobalSearch';
import NotificationBell from './components/NotificationBell';
import { ToastProvider } from './components/Toast';

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
  const { user, logout, hasRole, can, ROLE_LABELS, ROLE_COLORS } = useAuth();

  const navGroups = [
    {
      items: [
        { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
      ],
    },
    {
      label: 'الإنتاج',
      show: () => can('work_orders', 'view') || can('models', 'view'),
      items: [
        { path: '/work-orders', label: 'أوامر الإنتاج', icon: Factory, hide: () => !can('work_orders', 'view') },
        { path: '/work-orders/new', label: '+ أمر إنتاج جديد', icon: PlusCircle, hide: () => !can('work_orders', 'create') },
        { path: '/models', label: 'الموديلات', icon: List, hide: () => !can('models', 'view') },
      ],
    },
    {
      label: 'المخزون',
      show: () => can('fabrics', 'view') || can('inventory', 'view'),
      items: [
        { path: '/fabrics', label: 'الأقمشة', icon: Scissors, hide: () => !can('fabrics', 'view') },
        { path: '/accessories', label: 'الاكسسوارات', icon: Gem, hide: () => !can('accessories', 'view') },
        { path: '/inventory/fabrics', label: 'مخزون الأقمشة', icon: Warehouse, hide: () => !can('inventory', 'view') },
      ],
    },
    {
      label: 'المالية والموردين',
      show: () => can('invoices', 'view') || can('suppliers', 'view'),
      items: [
        { path: '/customers', label: 'العملاء', icon: UserCheck, hide: () => !can('invoices', 'view') },
        { path: '/invoices', label: 'الفواتير', icon: FileText, hide: () => !can('invoices', 'view') },
        { path: '/purchase-orders', label: 'أوامر الشراء', icon: ShoppingCart, hide: () => !can('purchase_orders', 'view') },
        { path: '/suppliers', label: 'الموردين', icon: Truck, hide: () => !can('suppliers', 'view') },
      ],
    },
    {
      label: 'الموارد البشرية',
      show: () => can('hr', 'view'),
      items: [
        { path: '/hr/employees', label: 'الموظفون', icon: Users, hide: () => !can('hr', 'view') },
        { path: '/hr/attendance', label: 'الحضور والانصراف', icon: Clock, hide: () => !can('hr', 'view') },
        { path: '/hr/payroll', label: 'الرواتب', icon: Banknote, hide: () => !can('payroll', 'view') },
      ],
    },
    {
      items: [
        { path: '/reports', label: 'التقارير', icon: BarChart2, hide: () => !can('reports', 'view') },
      ],
    },
    {
      label: 'الإدارة',
      show: () => can('users', 'view') || can('audit', 'view') || can('settings', 'view'),
      items: [
        { path: '/users', label: 'إدارة المستخدمين', icon: Shield, hide: () => !can('users', 'manage') },
        { path: '/audit-log', label: 'سجل المراجعة', icon: ClipboardList, hide: () => !can('audit', 'view') },
        { path: '/settings', label: 'الإعدادات', icon: Settings, hide: () => !can('settings', 'view') },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 bg-[#1a1a2e] flex flex-col shrink-0 no-print">
        <div className="p-5 border-b border-white/10">
          <h1 className="text-xl font-bold text-[#c9a84c] font-[JetBrains_Mono]">WK-Hub</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">نظام إدارة المصنع — v6</p>
        </div>
        <div className="px-3 pt-2 flex items-center gap-2">
          <div className="flex-1"><GlobalSearch /></div>
          <NotificationBell />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navGroups.map((group, gi) => {
            if (group.show && !group.show()) return null;
            const visibleItems = group.items.filter(item => !item.hide || !item.hide());
            if (visibleItems.length === 0) return null;
            return (
              <div key={gi}>
                {group.label && (
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider px-4 pt-3 pb-1">{group.label}</p>
                )}
                {visibleItems.map(item => (
                  <NavLink key={item.path} to={item.path} end={item.path === '/models' || item.path === '/work-orders'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive ? 'bg-[#c9a84c]/20 text-[#c9a84c]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}>
                    <item.icon size={17} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        {/* User info at bottom */}
        {user && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#c9a84c]/20 flex items-center justify-center text-[#c9a84c] font-bold text-sm">
                {user.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{user.full_name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role] || 'bg-gray-500 text-white'}`}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
            </div>
            <button onClick={logout}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors">
              <LogOut size={14} /> تسجيل الخروج
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto">
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
          <Route path="/work-orders" element={<ProtectedRoute perm={['work_orders','view']}><WorkOrdersList /></ProtectedRoute>} />
          <Route path="/work-orders/new" element={<ProtectedRoute perm={['work_orders','create']}><WorkOrderForm /></ProtectedRoute>} />
          <Route path="/work-orders/:id/edit" element={<ProtectedRoute perm={['work_orders','edit']}><WorkOrderForm /></ProtectedRoute>} />
          <Route path="/work-orders/:id" element={<ProtectedRoute perm={['work_orders','view']}><WorkOrderDetail /></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute perm={['suppliers','view']}><Suppliers /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute perm={['invoices','view']}><Customers /></ProtectedRoute>} />
          <Route path="/purchase-orders" element={<ProtectedRoute perm={['purchase_orders','view']}><PurchaseOrders /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute perm={['reports','view']}><Reports /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute perm={['invoices','view']}><Invoices /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute perm={['settings','view']}><SettingsPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute perm={['users','manage']}><UsersPage /></ProtectedRoute>} />
          <Route path="/audit-log" element={<ProtectedRoute perm={['audit','view']}><AuditLog /></ProtectedRoute>} />
          <Route path="/hr/employees" element={<ProtectedRoute perm={['hr','view']}><Employees /></ProtectedRoute>} />
          <Route path="/hr/attendance" element={<ProtectedRoute perm={['hr','view']}><Attendance /></ProtectedRoute>} />
          <Route path="/hr/payroll" element={<ProtectedRoute perm={['payroll','view']}><Payroll /></ProtectedRoute>} />
          <Route path="/hr/payroll/:periodId/slip/:employeeId" element={<ProtectedRoute perm={['payroll','view']}><PaySlip /></ProtectedRoute>} />
          {/* Legacy redirects */}
          <Route path="/workorders" element={<Navigate to="/work-orders" replace />} />
          <Route path="/workorders/:id" element={<Navigate to="/work-orders/:id" replace />} />
          <Route path="/purchaseorders" element={<Navigate to="/purchase-orders" replace />} />
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
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <AuthRouter />
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}
