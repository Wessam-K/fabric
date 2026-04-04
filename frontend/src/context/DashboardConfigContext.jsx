import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const DashboardConfigContext = createContext(null);

const DEFAULT_WIDGETS = {
  kpis: true,
  todaySummary: true,
  alerts: true,
  productionPipeline: true,
  financials: true,
  machineStatus: true,
  charts: true,
  recentOrders: true,
  lowStock: true,
  hrSummary: true,
  bottlenecks: true,
  maintenance: true,
};

const DEFAULT_ORDER = [
  'kpis', 'todaySummary', 'alerts', 'charts',
  'productionPipeline', 'financials', 'machineStatus', 'maintenance',
  'lowStock', 'recentOrders', 'bottlenecks', 'hrSummary',
];

export function DashboardConfigProvider({ children }) {
  const { user } = useAuth();
  const storageKey = `wk_dash_config_${user?.id || 'anon'}`;
  const [widgets, setWidgets] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? { ...DEFAULT_WIDGETS, ...JSON.parse(stored) } : { ...DEFAULT_WIDGETS };
    } catch { return { ...DEFAULT_WIDGETS }; }
  });
  const [widgetOrder, setWidgetOrder] = useState(() => {
    try {
      const stored = localStorage.getItem(`${storageKey}_order`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all keys present (merge new ones at end)
        const missing = DEFAULT_ORDER.filter(k => !parsed.includes(k));
        return [...parsed, ...missing];
      }
      return [...DEFAULT_ORDER];
    } catch { return [...DEFAULT_ORDER]; }
  });
  const [refreshInterval, setRefreshInterval] = useState(() => {
    try { return parseInt(localStorage.getItem(`${storageKey}_interval`)) || 60; }
    catch { return 60; }
  });

  // Re-initialize config when user switches (storageKey changes)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setWidgets(stored ? { ...DEFAULT_WIDGETS, ...JSON.parse(stored) } : { ...DEFAULT_WIDGETS });
    } catch { setWidgets({ ...DEFAULT_WIDGETS }); }
    try {
      const stored = localStorage.getItem(`${storageKey}_order`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const missing = DEFAULT_ORDER.filter(k => !parsed.includes(k));
        setWidgetOrder([...parsed, ...missing]);
      } else { setWidgetOrder([...DEFAULT_ORDER]); }
    } catch { setWidgetOrder([...DEFAULT_ORDER]); }
    try { setRefreshInterval(parseInt(localStorage.getItem(`${storageKey}_interval`)) || 60); }
    catch { setRefreshInterval(60); }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(widgets));
  }, [widgets, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}_order`, JSON.stringify(widgetOrder));
  }, [widgetOrder, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}_interval`, String(refreshInterval));
  }, [refreshInterval, storageKey]);

  function toggleWidget(key) {
    setWidgets(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const moveWidget = useCallback((fromIndex, toIndex) => {
    setWidgetOrder(prev => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }, []);

  function resetToDefault() {
    setWidgets({ ...DEFAULT_WIDGETS });
    setWidgetOrder([...DEFAULT_ORDER]);
    setRefreshInterval(60);
  }

  return (
    <DashboardConfigContext.Provider value={{
      widgets, toggleWidget, resetToDefault, refreshInterval, setRefreshInterval,
      widgetOrder, setWidgetOrder, moveWidget,
    }}>
      {children}
    </DashboardConfigContext.Provider>
  );
}

export function useDashboardConfig() {
  const ctx = useContext(DashboardConfigContext);
  if (!ctx) throw new Error('useDashboardConfig must be used within DashboardConfigProvider');
  return ctx;
}

export const WIDGET_META = {
  kpis:               { label: 'مؤشرات الأداء الرئيسية', icon: 'BarChart2' },
  todaySummary:       { label: 'ملخص اليوم', icon: 'CalendarDays' },
  alerts:             { label: 'التنبيهات العاجلة', icon: 'AlertTriangle' },
  productionPipeline: { label: 'خط الإنتاج', icon: 'Factory' },
  financials:         { label: 'المالية', icon: 'DollarSign' },
  machineStatus:      { label: 'حالة الماكينات', icon: 'Cog' },
  charts:             { label: 'الرسوم البيانية', icon: 'BarChart2' },
  recentOrders:       { label: 'الأوامر الأخيرة', icon: 'Clock' },
  lowStock:           { label: 'تنبيهات المخزون', icon: 'Package' },
  hrSummary:          { label: 'الموارد البشرية', icon: 'Users' },
  bottlenecks:        { label: 'اختناقات الإنتاج', icon: 'AlertTriangle' },
  maintenance:        { label: 'الصيانة', icon: 'Wrench' },
};
