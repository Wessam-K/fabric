import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Scissors, Gem, PlusCircle, List, Settings, Printer, BarChart2, FileText } from 'lucide-react';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import Fabrics from './pages/Fabrics';
import Accessories from './pages/Accessories';
import ModelForm from './pages/ModelForm';
import ModelsList from './pages/ModelsList';
import SettingsPage from './pages/Settings';
import PrintView from './pages/PrintView';
import InvoicePrint from './pages/InvoicePrint';
import Reports from './pages/Reports';
import Invoices from './pages/Invoices';
import InvoiceView from './pages/InvoiceView';
import GlobalSearch from './components/GlobalSearch';
import { ToastProvider } from './components/Toast';

const navItems = [
  { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { path: '/models', label: 'الموديلات', icon: List },
  { path: '/models/new', label: '+ موديل جديد', icon: PlusCircle },
  { path: '/fabrics', label: 'الأقمشة', icon: Scissors },
  { path: '/accessories', label: 'الاكسسوارات', icon: Gem },
  { path: '/reports', label: 'التقارير', icon: BarChart2 },
  { path: '/invoices', label: 'الفواتير', icon: FileText },
  { path: '/settings', label: 'الإعدادات', icon: Settings },
];

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 bg-[#1a1a2e] flex flex-col shrink-0 no-print">
        <div className="p-5 border-b border-white/10">
          <h1 className="text-xl font-bold text-[#c9a84c] font-[JetBrains_Mono]">WK-Hub</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">نظام إدارة المصنع — v2</p>
        </div>
        <div className="px-3 pt-2">
          <GlobalSearch />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/models'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-[#c9a84c]/20 text-[#c9a84c]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/models" element={<ModelsList />} />
          <Route path="/models/new" element={<ModelForm />} />
          <Route path="/models/:code/edit" element={<ModelForm />} />
          <Route path="/fabrics" element={<Fabrics />} />
          <Route path="/accessories" element={<Accessories />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/models/:code/print" element={<PrintView />} />
          <Route path="/models/:code/invoice" element={<InvoicePrint />} />
          <Route path="/invoices/:id/view" element={<InvoiceView />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
