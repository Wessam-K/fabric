import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Scissors, Gem, PlusCircle, List, Settings, BarChart2,
  FileText, Factory, Truck, ShoppingCart, ClipboardList, Warehouse, Users,
  Shield, Clock, Banknote, LogOut, UserCheck, ChevronDown, ChevronLeft,
  Package, Cog, Wrench, CalendarClock, Layers, Send, RotateCcw, BookOpen,
  Scale, DollarSign, CheckSquare, Bell, FolderOpen, Database, Download,
  Upload, Key, Calculator, Star, Eye, EyeOff, ChevronsDown, ChevronsUp,
  PanelLeft, PanelLeftClose, Calendar
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// --- NAV STRUCTURE ---
const NAV_GROUPS = (can, user) => [
  {
    items: [
      { path: '/dashboard', label: '\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645', icon: LayoutDashboard, tour: 'dashboard' },
    ],
  },
  {
    id: 'production',
    label: '\u0627\u0644\u0625\u0646\u062a\u0627\u062c',
    icon: Factory,
    tour: 'group-production',
    show: () => can('work_orders', 'view') || can('models', 'view'),
    items: [
      { path: '/work-orders',       label: '\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0625\u0646\u062a\u0627\u062c',  icon: Factory,        tour: 'workorders',  hide: () => !can('work_orders', 'view') },
      { path: '/work-orders/new',   label: '\u0623\u0645\u0631 \u062c\u062f\u064a\u062f',       icon: PlusCircle,     tour: 'neworder',    hide: () => !can('work_orders', 'create') },
      { path: '/models',            label: '\u0627\u0644\u0645\u0648\u062f\u064a\u0644\u0627\u062a',      icon: List,           tour: 'models',      hide: () => !can('models', 'view') },
      { path: '/machines',          label: '\u0627\u0644\u0645\u0627\u0643\u064a\u0646\u0627\u062a',      icon: Cog,            tour: 'machines',    hide: () => !can('machines', 'view') },
      { path: '/maintenance',       label: '\u0627\u0644\u0635\u064a\u0627\u0646\u0629',        icon: Wrench,                              hide: () => !can('maintenance', 'view') },
      { path: '/scheduling',        label: '\u0627\u0644\u062c\u062f\u0648\u0644\u0629',        icon: CalendarClock,                       hide: () => !can('scheduling', 'view') },
      { path: '/stage-templates',   label: '\u0642\u0648\u0627\u0644\u0628 \u0627\u0644\u0645\u0631\u0627\u062d\u0644', icon: Layers,                              hide: () => !can('settings', 'view') },
    ],
  },
  {
    id: 'inventory',
    label: '\u0627\u0644\u0645\u062e\u0632\u0648\u0646',
    icon: Package,
    tour: 'group-inventory',
    show: () => can('fabrics', 'view') || can('inventory', 'view'),
    items: [
      { path: '/fabrics',                label: '\u0627\u0644\u0623\u0642\u0645\u0634\u0629',              icon: Scissors,  tour: 'fabrics',      hide: () => !can('fabrics', 'view') },
      { path: '/accessories',            label: '\u0627\u0644\u0627\u0643\u0633\u0633\u0648\u0627\u0631\u0627\u062a',          icon: Gem,       tour: 'accessories',  hide: () => !can('accessories', 'view') },
      { path: '/inventory/fabrics',      label: '\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0623\u0642\u0645\u0634\u0629',        icon: Warehouse,                       hide: () => !can('inventory', 'view') },
      { path: '/inventory/accessories',  label: '\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0627\u0643\u0633\u0633\u0648\u0627\u0631\u0627\u062a',    icon: Package,                        hide: () => !can('inventory', 'view') },
      { path: '/mrp',                    label: '\u062a\u062e\u0637\u064a\u0637 \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u062c\u0627\u062a',     icon: Calculator,                      hide: () => !can('mrp', 'view') },
    ],
  },
  {
    id: 'shipping',
    label: '\u0627\u0644\u0634\u062d\u0646',
    icon: Send,
    show: () => can('shipping', 'view'),
    items: [
      { path: '/shipping', label: '\u0627\u0644\u0634\u062d\u0646\u0627\u062a',    icon: Send,       hide: () => !can('shipping', 'view') },
      { path: '/returns',  label: '\u0627\u0644\u0645\u0631\u062a\u062c\u0639\u0627\u062a',  icon: RotateCcw,  hide: () => !can('returns', 'view') },
    ],
  },
  {
    id: 'finance',
    label: '\u0627\u0644\u0645\u0627\u0644\u064a\u0629',
    icon: FileText,
    tour: 'group-finance',
    show: () => can('invoices', 'view') || can('suppliers', 'view') || can('accounting', 'view'),
    items: [
      { path: '/customers',                 label: '\u0627\u0644\u0639\u0645\u0644\u0627\u0621',           icon: UserCheck,    tour: 'customers',        hide: () => !can('invoices', 'view') },
      { path: '/invoices',                  label: '\u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631',          icon: FileText,     tour: 'invoices',         hide: () => !can('invoices', 'view') },
      { path: '/purchase-orders',           label: '\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0634\u0631\u0627\u0621',      icon: ShoppingCart, tour: 'purchaseorders',   hide: () => !can('purchase_orders', 'view') },
      { path: '/suppliers',                 label: '\u0627\u0644\u0645\u0648\u0631\u062f\u064a\u0646',          icon: Truck,        tour: 'suppliers',        hide: () => !can('suppliers', 'view') },
      { path: '/accounting/coa',            label: '\u062f\u0644\u064a\u0644 \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a',     icon: BookOpen,                               hide: () => !can('accounting', 'view') },
      { path: '/accounting/journal',        label: '\u0627\u0644\u0642\u064a\u0648\u062f \u0627\u0644\u064a\u0648\u0645\u064a\u0629',    icon: Scale,                                  hide: () => !can('accounting', 'view') },
      { path: '/accounting/trial-balance',  label: '\u0645\u064a\u0632\u0627\u0646 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629',    icon: BarChart2,                              hide: () => !can('accounting', 'view') },
      { path: '/expenses',                  label: '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a',         icon: DollarSign,                             hide: () => !can('expenses', 'view') },
      { path: '/quotations',               label: '\u0639\u0631\u0648\u0636 \u0627\u0644\u0623\u0633\u0639\u0627\u0631',      icon: FileText,                               hide: () => !can('invoices', 'view') },
    ],
  },
  {
    id: 'quality',
    label: '\u0627\u0644\u062c\u0648\u062f\u0629',
    icon: CheckSquare,
    show: () => can('quality', 'view'),
    items: [
      { path: '/quality',  label: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062c\u0648\u062f\u0629',  icon: CheckSquare,  hide: () => !can('quality', 'view') },
      { path: '/samples',  label: '\u0627\u0644\u0639\u064a\u0646\u0627\u062a',        icon: Gem,          hide: () => !can('quality', 'view') },
    ],
  },
  {
    id: 'hr',
    label: '\u0627\u0644\u0645\u0648\u0627\u0631\u062f \u0627\u0644\u0628\u0634\u0631\u064a\u0629',
    icon: Users,
    tour: 'group-hr',
    show: () => can('hr', 'view'),
    items: [
      { path: '/hr/employees',   label: '\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646',  icon: Users,     tour: 'employees',  hide: () => !can('hr', 'view') },
      { path: '/hr/attendance',  label: '\u0627\u0644\u062d\u0636\u0648\u0631',    icon: Clock,     tour: 'attendance', hide: () => !can('hr', 'view') },
      { path: '/hr/payroll',     label: '\u0627\u0644\u0631\u0648\u0627\u062a\u0628',   icon: Banknote,  tour: 'payroll',    hide: () => !can('payroll', 'view') },
      { path: '/hr/leaves',      label: '\u0627\u0644\u0625\u062c\u0627\u0632\u0627\u062a',  icon: Calendar,                      hide: () => !can('hr', 'view') },
    ],
  },
  {
    id: 'reports',
    label: '\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631 \u0648\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a',
    icon: BarChart2,
    show: () => can('reports', 'view') || can('settings', 'view'),
    items: [
      { path: '/reports',  label: '\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631',          icon: BarChart2,   tour: 'reports',  hide: () => !can('reports', 'view') },
      { path: '/exports',  label: '\u0645\u0631\u0643\u0632 \u0627\u0644\u062a\u0635\u062f\u064a\u0631',      icon: Download,    tour: 'exports',  hide: () => !can('reports', 'view') },
      { path: '/import',   label: '\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a',  icon: Upload,                        hide: () => !can('settings', 'view') },
    ],
  },
  {
    id: 'admin',
    label: '\u0627\u0644\u0625\u062f\u0627\u0631\u0629',
    icon: Shield,
    show: () => can('users', 'view') || can('audit', 'view') || can('settings', 'view'),
    items: [
      { path: '/users',              label: '\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646',        icon: Shield,        hide: () => !can('users', 'manage') },
      { path: '/permissions',        label: '\u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a',          icon: Key,           hide: () => !can('users', 'manage') },
      { path: '/audit-log',          label: '\u0633\u062c\u0644 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629',       icon: ClipboardList, hide: () => !can('audit', 'view') },
      { path: '/notifications',      label: '\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a',          icon: Bell,          hide: () => false },
      { path: '/documents',          label: '\u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a',          icon: FolderOpen,    hide: () => !can('documents', 'view') },
      { path: '/backups',            label: '\u0627\u0644\u0646\u0633\u062e \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637\u064a\u0629',   icon: Database,      hide: () => !can('backups', 'view') },
      { path: '/webhooks',           label: '\u0627\u0644\u0648\u064a\u0628 \u0647\u0648\u0643\u0633',         icon: Send,          hide: () => user?.role !== 'superadmin' },
      { path: '/report-schedules',   label: '\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631 \u0627\u0644\u0645\u062c\u062f\u0648\u0644\u0629',  icon: CalendarClock, hide: () => !can('reports', 'view') },
      { path: '/settings',           label: '\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a',          icon: Settings,      hide: () => !can('settings', 'view') },
      { path: '/knowledge-base',     label: '\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0645\u0639\u0631\u0641\u0629',      icon: BookOpen,      hide: () => false },
    ],
  },
];

// --- STORAGE HELPERS ---

function getStoredGroups(userId) {
  try {
    const raw = localStorage.getItem('wk-sidebar-groups-' + userId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setStoredGroups(userId, groups) {
  try { localStorage.setItem('wk-sidebar-groups-' + userId, JSON.stringify(groups)); } catch {}
}
function getStoredFavourites(userId) {
  try {
    const raw = localStorage.getItem('wk-sidebar-favs-' + userId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function setStoredFavourites(userId, favs) {
  try { localStorage.setItem('wk-sidebar-favs-' + userId, JSON.stringify(favs)); } catch {}
}
function getStoredHidden(userId) {
  try {
    const raw = localStorage.getItem('wk-sidebar-hidden-' + userId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function setStoredHidden(userId, hidden) {
  try { localStorage.setItem('wk-sidebar-hidden-' + userId, JSON.stringify(hidden)); } catch {}
}
function getStoredCollapsed(userId) {
  try {
    const raw = localStorage.getItem('wk-sidebar-collapsed-' + userId);
    return raw === 'true';
  } catch { return false; }
}
function setStoredCollapsed(userId, val) {
  try { localStorage.setItem('wk-sidebar-collapsed-' + userId, String(val)); } catch {}
}

// --- MAIN SIDEBAR COMPONENT ---

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { user, logout, can, ROLE_LABELS, ROLE_COLORS } = useAuth();
  const location = useLocation();
  const userId = user?.id || 'anon';

  const [collapsed, setCollapsed]     = useState(() => getStoredCollapsed(userId));
  const [openGroups, setOpenGroups]   = useState(() => getStoredGroups(userId) || []);
  const [favourites, setFavourites]   = useState(() => getStoredFavourites(userId));
  const [hidden, setHidden]           = useState(() => getStoredHidden(userId));
  const [customizeMode, setCustomizeMode] = useState(false);
  const [showFavSection, setShowFavSection] = useState(true);

  const groups = NAV_GROUPS(can, user);

  // Persist everything
  useEffect(() => { setStoredCollapsed(userId, collapsed); }, [userId, collapsed]);
  useEffect(() => { setStoredGroups(userId, openGroups); }, [userId, openGroups]);
  useEffect(() => { setStoredFavourites(userId, favourites); }, [userId, favourites]);
  useEffect(() => { setStoredHidden(userId, hidden); }, [userId, hidden]);

  // Auto-open the group that contains the current route on first render
  useEffect(() => {
    if (openGroups.length === 0) {
      const active = groups.find(g =>
        g.id && g.items?.some(i => location.pathname.startsWith('/' + i.path.split('/')[1]))
      );
      if (active?.id) setOpenGroups([active.id]);
    }
  }, []); // eslint-disable-line

  const toggleGroup = useCallback((groupId) => {
    setOpenGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  }, []);

  const expandAll = () => {
    const allIds = groups.filter(g => g.id).map(g => g.id);
    setOpenGroups(allIds);
  };
  const collapseAll = () => setOpenGroups([]);

  const toggleFavourite = (path) => {
    setFavourites(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };
  const toggleHidden = (path) => {
    setHidden(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  // Collect all items for favourites section
  const allItems = groups.flatMap(g => g.items || []);
  const favItems = allItems.filter(item => favourites.includes(item.path) && (!item.hide || !item.hide()));

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside
        data-tour="sidebar"
        aria-label="\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629"
        role="navigation"
        className={`
          ${collapsed ? 'w-16' : 'w-60'}
          bg-[#1a1a2e] flex flex-col shrink-0 no-print
          transition-[width] duration-200 ease-in-out
          fixed lg:sticky lg:top-0 lg:self-start lg:h-screen inset-y-0 right-0 z-50
          ${mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-3'} h-14 border-b border-white/8 gap-2`}>
          {!collapsed && (
            <span className="flex-1 text-[15px] font-bold text-[#c9a84c] font-mono tracking-tight truncate">
              WK-Hub
            </span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? '\u062a\u0648\u0633\u064a\u0639 \u0627\u0644\u0642\u0627\u0626\u0645\u0629' : '\u062a\u0635\u063a\u064a\u0631 \u0627\u0644\u0642\u0627\u0626\u0645\u0629'}
            className="text-gray-500 hover:text-gray-300 p-1 rounded transition-colors shrink-0"
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Expand / Collapse All + Customize */}
        {!collapsed && (
          <div className="px-3 py-1.5 flex items-center gap-1 border-b border-white/5">
            <button onClick={expandAll}
              className="flex-1 flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 py-1 px-1.5 rounded hover:bg-white/5 transition-colors"
              title="\u062a\u0648\u0633\u064a\u0639 \u0627\u0644\u0643\u0644">
              <ChevronsDown size={11} /> \u062a\u0648\u0633\u064a\u0639 \u0627\u0644\u0643\u0644
            </button>
            <button onClick={collapseAll}
              className="flex-1 flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 py-1 px-1.5 rounded hover:bg-white/5 transition-colors"
              title="\u0637\u064a \u0627\u0644\u0643\u0644">
              <ChevronsUp size={11} /> \u0637\u064a \u0627\u0644\u0643\u0644
            </button>
            <button onClick={() => setCustomizeMode(c => !c)}
              className={`p-1.5 rounded transition-colors text-[10px] ${customizeMode ? 'bg-[#c9a84c]/20 text-[#c9a84c]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title={customizeMode ? '\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u062a\u062e\u0635\u064a\u0635' : '\u062a\u062e\u0635\u064a\u0635 \u0627\u0644\u0642\u0627\u0626\u0645\u0629'}>
              <Settings size={11} />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav aria-label="\u0627\u0644\u062a\u0646\u0642\u0644 \u0627\u0644\u0631\u0626\u064a\u0633\u064a" className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">

          {/* Favourites Section */}
          {!collapsed && favItems.length > 0 && (
            <div className="mb-2">
              <button onClick={() => setShowFavSection(s => !s)}
                className="w-full flex items-center gap-2 px-2 py-1 text-[10px] font-bold text-[#c9a84c]/70 uppercase tracking-wider hover:text-[#c9a84c] transition-colors">
                <Star size={10} className="fill-current" />
                \u0627\u0644\u0645\u0641\u0636\u0644\u0629
                <ChevronDown size={10} className={`mr-auto transition-transform ${showFavSection ? '' : '-rotate-90'}`} />
              </button>
              {showFavSection && (
                <div className="space-y-0.5">
                  {favItems.map(item => (
                    <NavLink
                      key={`fav-${item.path}`}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-colors
                        ${isActive ? 'text-[#c9a84c] bg-[#c9a84c]/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`
                      }
                    >
                      <item.icon size={13} strokeWidth={1.5} />
                      <span className="flex-1 truncate">{item.label}</span>
                      <Star size={10} className="text-[#c9a84c] fill-current shrink-0" />
                    </NavLink>
                  ))}
                </div>
              )}
              <div className="border-t border-white/8 my-2" />
            </div>
          )}

          {/* All Nav Groups */}
          {groups.map((group, gi) => {
            if (group.show && !group.show()) return null;
            const visibleItems = (group.items || []).filter(item => {
              if (item.hide && item.hide()) return false;
              if (!customizeMode && hidden.includes(item.path)) return false;
              return true;
            });
            if (visibleItems.length === 0) return null;

            // Flat items (no group header)
            if (!group.id) {
              return visibleItems.map(item => (
                <div key={item.path} className="flex items-center gap-1 group/item">
                  <NavLink
                    to={item.path}
                    end={item.path === '/dashboard'}
                    onClick={() => setMobileOpen(false)}
                    data-tour={item.tour || undefined}
                    className={({ isActive }) =>
                      `flex-1 flex items-center gap-2.5 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg text-[13px] transition-colors
                      ${isActive ? 'bg-[#c9a84c]/15 text-[#c9a84c]' : 'text-gray-200 hover:text-white hover:bg-white/5'}`
                    }
                  >
                    <item.icon size={16} strokeWidth={1.8} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  </NavLink>
                  {!collapsed && customizeMode && (
                    <div className="flex gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => toggleFavourite(item.path)} title="\u0645\u0641\u0636\u0644\u0629"
                        className={`p-1 rounded ${favourites.includes(item.path) ? 'text-[#c9a84c]' : 'text-gray-600 hover:text-[#c9a84c]'}`}>
                        <Star size={10} className={favourites.includes(item.path) ? 'fill-current' : ''} />
                      </button>
                    </div>
                  )}
                </div>
              ));
            }

            // Collapsible group
            const isOpen = openGroups.includes(group.id);
            const hasActive = visibleItems.some(i => location.pathname.startsWith('/' + i.path.split('/')[1]));
            const GroupIcon = group.icon;

            return (
              <div key={gi}>
                <button
                  onClick={() => !collapsed && toggleGroup(group.id)}
                  data-tour={group.tour || undefined}
                  title={collapsed ? group.label : undefined}
                  className={`w-full flex items-center gap-2.5 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg text-[13px] transition-colors
                    ${hasActive ? 'text-[#c9a84c]' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                >
                  <GroupIcon size={16} strokeWidth={1.8} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-right">{group.label}</span>
                      <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>

                {/* Sub-items */}
                {isOpen && !collapsed && (
                  <div className="mr-4 mt-0.5 space-y-0.5 border-r border-white/8 pr-0">
                    {visibleItems.map(item => (
                      <div key={item.path} className="flex items-center gap-1 group/subitem">
                        <NavLink
                          to={item.path}
                          end={item.path === '/models' || item.path === '/work-orders'}
                          onClick={() => setMobileOpen(false)}
                          data-tour={item.tour || undefined}
                          className={({ isActive }) =>
                            `flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-colors
                            ${isActive ? 'text-[#c9a84c] bg-[#c9a84c]/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`
                          }
                        >
                          <item.icon size={14} strokeWidth={1.5} />
                          <span className="flex-1 truncate">{item.label}</span>
                        </NavLink>
                        {customizeMode && (
                          <div className="flex gap-0.5 opacity-0 group-hover/subitem:opacity-100 transition-opacity shrink-0 pl-1">
                            <button
                              onClick={() => toggleFavourite(item.path)}
                              title={favourites.includes(item.path) ? '\u0625\u0632\u0627\u0644\u0629 \u0645\u0646 \u0627\u0644\u0645\u0641\u0636\u0644\u0629' : '\u0625\u0636\u0627\u0641\u0629 \u0644\u0644\u0645\u0641\u0636\u0644\u0629'}
                              className={`p-1 rounded ${favourites.includes(item.path) ? 'text-[#c9a84c]' : 'text-gray-600 hover:text-[#c9a84c]'}`}
                            >
                              <Star size={10} className={favourites.includes(item.path) ? 'fill-current' : ''} />
                            </button>
                            <button
                              onClick={() => toggleHidden(item.path)}
                              title={hidden.includes(item.path) ? '\u0625\u0638\u0647\u0627\u0631' : '\u0625\u062e\u0641\u0627\u0621'}
                              className={`p-1 rounded ${hidden.includes(item.path) ? 'text-red-400' : 'text-gray-600 hover:text-red-400'}`}
                            >
                              {hidden.includes(item.path) ? <EyeOff size={10} /> : <Eye size={10} />}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        </nav>

        {/* Customize mode hint */}
        {!collapsed && customizeMode && (
          <div className="px-3 py-2 bg-[#c9a84c]/10 border-t border-[#c9a84c]/20">
            <p className="text-[10px] text-[#c9a84c] text-center leading-relaxed">
              {'\u0648\u0636\u0639 \u0627\u0644\u062a\u062e\u0635\u064a\u0635: \u2B50 \u0644\u0625\u0636\u0627\u0641\u0629 \u0644\u0644\u0645\u0641\u0636\u0644\u0629 | \uD83D\uDC41\uFE0F \u0644\u0625\u062e\u0641\u0627\u0621/\u0625\u0638\u0647\u0627\u0631'}
            </p>
          </div>
        )}

        {/* User Footer */}
        {user && !collapsed && (
          <div className="px-3 py-3 border-t border-white/8">
            <div className="flex items-center gap-2.5">
              <NavLink to="/profile"
                className="w-8 h-8 rounded-lg bg-[#c9a84c]/15 flex items-center justify-center text-[#c9a84c] font-bold text-xs hover:bg-[#c9a84c]/25 transition-colors shrink-0">
                {user.full_name?.charAt(0) || 'U'}
              </NavLink>
              <div className="flex-1 min-w-0">
                <NavLink to="/profile" className="text-[12px] text-gray-200 truncate block hover:text-[#c9a84c] transition-colors">
                  {user.full_name}
                </NavLink>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${ROLE_COLORS?.[user.role] || 'bg-gray-500 text-white'}`}>
                  {ROLE_LABELS?.[user.role] || user.role}
                </span>
              </div>
              <NavLink to="/change-password" title="\u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631"
                className="text-gray-500 hover:text-[#c9a84c] p-1.5 rounded transition-colors">
                <Key size={14} />
              </NavLink>
              <button onClick={logout} title="\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c"
                className="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div className="px-2 py-3 border-t border-white/8 flex flex-col items-center gap-2">
            <NavLink to="/profile"
              className="w-8 h-8 rounded-lg bg-[#c9a84c]/15 flex items-center justify-center text-[#c9a84c] font-bold text-xs hover:bg-[#c9a84c]/25 transition-colors">
              {user.full_name?.charAt(0) || 'U'}
            </NavLink>
            <button onClick={logout} title="\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c"
              className="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}