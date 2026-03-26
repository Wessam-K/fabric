import { useState, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory, CheckCircle, DollarSign, TrendingUp, AlertTriangle,
  CalendarDays, Clock, Wrench, RefreshCw, Settings, ChevronLeft,
  Package, Users, Activity, Scissors, Gem, List, Truck, UserCheck, GripVertical
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardConfigProvider, useDashboardConfig } from '../context/DashboardConfigContext';
import { useDashboardData, useHRData } from '../hooks/useDashboardData';
import { MoneyDisplay, Skeleton } from '../components/ui';
import {
  KPICard, Section, ChartContainer, AlertItem,
  MachineStatusDot, PipelineBar, FinanceRow, SummaryTile
} from '../components/DashboardWidgets';
import DashboardConfigPanel from '../components/DashboardConfigPanel';
import HelpButton from '../components/HelpButton';

const LazyCharts = lazy(() => import('../components/DashboardCharts'));

/* ── Role-specific KPI sets ────────────────────────────── */
function getKPIsForRole(role, data) {
  const net = (data?.monthly_revenue || 0) - (data?.monthly_cost || 0);
  const lowStock = (data?.low_stock_fabrics?.length || 0) + (data?.low_stock_accessories?.length || 0);

  const common = [
    { icon: Factory, label: 'أوامر نشطة', value: data?.active_work_orders ?? 0, color: 'gold', to: '/work-orders' },
    { icon: CheckCircle, label: 'مكتمل هذا الشهر', value: data?.completed_this_month ?? 0, color: 'success' },
  ];

  switch (role) {
    case 'superadmin':
    case 'manager':
      return [
        ...common,
        { icon: DollarSign, label: 'إيرادات الشهر', value: <MoneyDisplay amount={data?.monthly_revenue || 0} />, color: 'success' },
        { icon: TrendingUp, label: 'صافي الربح', value: <MoneyDisplay amount={net} />, color: net >= 0 ? 'success' : 'danger' },
        { icon: AlertTriangle, label: 'تنبيهات مخزون', value: lowStock, color: lowStock > 0 ? 'warning' : 'success' },
      ];
    case 'accountant':
      return [
        { icon: DollarSign, label: 'إيرادات الشهر', value: <MoneyDisplay amount={data?.monthly_revenue || 0} />, color: 'success' },
        { icon: TrendingUp, label: 'صافي الربح', value: <MoneyDisplay amount={net} />, color: net >= 0 ? 'success' : 'danger' },
        { icon: AlertTriangle, label: 'فواتير معلقة', value: data?.pending_invoices ?? 0, color: 'warning' },
        { icon: Truck, label: 'مستحقات موردين', value: <MoneyDisplay amount={data?.outstanding_payables || 0} />, color: 'danger' },
      ];
    case 'production':
      return [
        ...common,
        { icon: Activity, label: 'جودة الإنتاج', value: `${data?.quality_rate ?? 100}%`, color: 'info' },
        { icon: Wrench, label: 'صيانة معلقة', value: data?.pending_maintenance_count ?? 0, color: data?.critical_maintenance_count > 0 ? 'danger' : 'neutral' },
      ];
    case 'hr':
      return [
        { icon: Users, label: 'الموظفون', value: data?.total_employees ?? '—', color: 'info', to: '/hr/employees' },
        { icon: CalendarDays, label: 'حضور اليوم', value: data?.today_summary?.attendance ?? '—', color: 'gold' },
        ...common.slice(0, 1),
      ];
    default:
      return common;
  }
}

/* ── Status Dot ──────────────────────────────────────────── */
function StatusDot({ status }) {
  const colors = {
    draft: 'bg-gray-300', pending: 'bg-gray-400', in_progress: 'bg-blue-500',
    completed: 'bg-green-500', cancelled: 'bg-red-500', overdue: 'bg-red-500',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || 'bg-gray-300'}`} />;
}

/* ── Collapsible Section ─────────────────────────────────── */
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 group text-right">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {Icon && <Icon size={15} className="text-gray-400 dark:text-gray-500" />}
          {title}
        </h3>
        <ChevronLeft size={14} className={`text-gray-400 transition-transform duration-200 ${open ? '-rotate-90' : ''}`} />
      </button>
      {open && <div className="mt-2 animate-in fade-in duration-200">{children}</div>}
    </section>
  );
}

/* ── Secondary Stats Row ────────────────────────────────── */
function SecondaryStats({ data }) {
  const navigate = useNavigate();
  const items = [
    { label: 'الموديلات', value: data?.total_models ?? 0, icon: List, path: '/models' },
    { label: 'الأقمشة', value: data?.total_fabrics ?? 0, icon: Scissors, path: '/fabrics' },
    { label: 'الاكسسوارات', value: data?.total_accessories ?? 0, icon: Gem, path: '/accessories' },
    { label: 'الموردين', value: data?.total_suppliers ?? 0, icon: Truck, path: '/suppliers' },
    { label: 'العملاء', value: data?.total_customers ?? 0, icon: UserCheck, path: '/customers' },
    { label: 'جودة الإنتاج', value: `${data?.quality_rate ?? 100}%`, icon: Activity },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {items.map((c, i) => (
        <button key={i} onClick={() => c.path && navigate(c.path)}
          className={`rounded-xl p-3 flex items-center gap-2.5 transition-all text-right
            bg-white dark:bg-white/5 border border-gray-100 dark:border-white/8
            ${c.path ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'}`}>
          <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-white/10 flex items-center justify-center shrink-0">
            <c.icon size={15} className="text-gray-500 dark:text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold font-mono text-gray-900 dark:text-white leading-tight">{c.value}</p>
            <p className="text-[10px] text-gray-400 truncate">{c.label}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Draggable Widget Wrapper ────────────────────────────── */
function DraggableWidget({ widgetKey, index, onDragStart, onDragOver, onDrop, dragOverKey, children }) {
  if (!children) return null;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index, widgetKey)}
      onDragOver={(e) => onDragOver(e, index, widgetKey)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
      className={`relative group/drag transition-all duration-150 ${
        dragOverKey === widgetKey ? 'ring-2 ring-[#c9a84c]/40 ring-offset-2 dark:ring-offset-[#0f0f1a] rounded-xl' : ''
      }`}
    >
      <div className="absolute top-2 left-2 z-10 opacity-0 group-hover/drag:opacity-100
        transition-opacity cursor-grab active:cursor-grabbing
        p-1 rounded-md bg-white/80 dark:bg-white/10 shadow-sm backdrop-blur-sm">
        <GripVertical size={14} className="text-gray-400" />
      </div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Widget Renderer — maps widget key → JSX
   ══════════════════════════════════════════════════════════ */
function WidgetRenderer({ widgetKey, dProps, widgets, data, hrData, kpis, net, pipelineTotal, hasAlerts, showFinance, showHR, hasRole, navigate, loading }) {
  if (!widgets[widgetKey]) return null;

  const content = (() => {
    switch (widgetKey) {
      case 'kpis':
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {kpis.map((kpi, i) => <KPICard key={i} {...kpi} />)}
          </div>
        );

      case 'todaySummary':
        if (!data?.today_summary) return null;
        return (
          <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/8 p-4"
            style={{ borderInlineStart: '3px solid #c9a84c' }}>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
              <CalendarDays size={14} className="text-[#c9a84c]" /> ملخص اليوم
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <SummaryTile value={data.today_summary.attendance} label="حضور" colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" />
              <SummaryTile value={data.today_summary.deliveries} label="تسليمات" colorClass="bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400" />
              <SummaryTile value={data.today_summary.due_today} label="مستحقة اليوم" colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" />
              <SummaryTile value={data.today_summary.invoices} label="فواتير اليوم" colorClass="bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400" />
              <SummaryTile
                value={<MoneyDisplay amount={data.today_summary.expenses} />}
                label="مصاريف اليوم"
                colorClass="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" />
            </div>
          </div>
        );

      case 'alerts':
        if (!hasAlerts) return null;
        return (
          <Section title="تنبيهات عاجلة" icon={AlertTriangle}
            action={
              <button onClick={() => navigate('/work-orders')}
                className="text-[11px] text-[#c9a84c] hover:underline flex items-center gap-0.5">
                عرض الكل <ChevronLeft size={12} />
              </button>
            }>
            <div className="space-y-2">
              {(data.overdue_work_orders || []).slice(0, 2).map(wo => (
                <AlertItem key={`wo-${wo.id}`} type="danger"
                  title={wo.wo_number} subtitle={wo.model_code}
                  value={wo.due_date ? new Date(wo.due_date).toLocaleDateString('ar-EG') : '—'}
                  to={`/work-orders/${wo.id}`} />
              ))}
              {(data.overdue_invoices || []).slice(0, 1).map(inv => (
                <AlertItem key={`inv-${inv.id}`} type="warning"
                  title={inv.invoice_number} subtitle={inv.customer_name}
                  value={<MoneyDisplay amount={inv.total} />}
                  to={`/invoices/${inv.id}`} />
              ))}
            </div>
          </Section>
        );

      case 'charts':
        return (
          <Suspense fallback={<Skeleton className="h-64" />}>
            <LazyCharts data={data} />
          </Suspense>
        );

      case 'productionPipeline':
        if (!data?.production_pipeline) return null;
        return (
          <ChartContainer title="خط الإنتاج" subtitle={`${pipelineTotal} أمر إجمالي`}>
            <div className="space-y-3">
              {[
                { key: 'draft', label: 'مسودة', color: '#cbd5e1' },
                { key: 'pending', label: 'معلق', color: '#94a3b8' },
                { key: 'in_progress', label: 'جاري', color: '#3b82f6' },
                { key: 'completed', label: 'مكتمل', color: '#22c55e' },
                { key: 'cancelled', label: 'ملغي', color: '#ef4444' },
              ].map(s => (
                <PipelineBar key={s.key} label={s.label}
                  count={data.production_pipeline[s.key] || 0}
                  total={pipelineTotal} color={s.color} />
              ))}
            </div>
          </ChartContainer>
        );

      case 'financials':
        if (!showFinance) return null;
        return (
          <ChartContainer title="مالية الشهر">
            <div className="space-y-4">
              <FinanceRow label="إيرادات" amount={data?.monthly_revenue || 0} color="text-green-600 dark:text-green-400" />
              <FinanceRow label="تكاليف" amount={data?.monthly_cost || 0} color="text-red-600 dark:text-red-400" />
              <FinanceRow label="صافي" amount={net}
                color={net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} bold />
              <FinanceRow label="مستحقات موردين" amount={data?.outstanding_payables || 0} color="text-amber-600 dark:text-amber-400" />
              <FinanceRow label="مستحقات عملاء" amount={data?.customer_outstanding || 0} color="text-blue-600 dark:text-blue-400" />
              <FinanceRow label="مصروفات الشهر" amount={data?.total_expenses_this_month || 0} color="text-red-500 dark:text-red-400" />
            </div>
          </ChartContainer>
        );

      case 'machineStatus':
        if (!data?.machine_status_board?.length) return null;
        return (
          <ChartContainer title="حالة الماكينات" subtitle={`${data.machine_status_board.length} ماكينة`}>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-3">
              {data.machine_status_board.map(m => (
                <MachineStatusDot key={m.id} machine={m} onClick={() => navigate('/machines')} />
              ))}
            </div>
            <div className="flex gap-4 text-[10px] text-gray-400 dark:text-gray-500 justify-center pt-2 border-t border-gray-100 dark:border-white/8">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> نشط</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> صيانة</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> متوقف</span>
            </div>
          </ChartContainer>
        );

      case 'maintenance':
        if (!((data?.critical_maintenance_count || 0) > 0 || (data?.pending_maintenance_count || 0) > 0)) return null;
        return (
          <ChartContainer title="الصيانة">
            <button onClick={() => navigate('/maintenance')} className="w-full text-right space-y-3 group">
              {data?.critical_maintenance_count > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">{data.critical_maintenance_count} أمر حرج</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">يتطلب اهتمام فوري</p>
                  </div>
                </div>
              )}
              {data?.pending_maintenance_count > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Wrench size={18} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{data.pending_maintenance_count} أمر معلق</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">بحاجة لجدولة</p>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-[#c9a84c] group-hover:underline flex items-center gap-0.5 justify-center">
                عرض الصيانة <ChevronLeft size={12} />
              </p>
            </button>
          </ChartContainer>
        );

      case 'lowStock':
        if (!((data?.low_stock_fabrics?.length || 0) > 0 || (data?.low_stock_accessories?.length || 0) > 0)) return null;
        return (
          <Section title="تنبيهات المخزون" icon={Package}
            action={
              <button onClick={() => navigate('/inventory/fabrics')}
                className="text-[11px] text-[#c9a84c] hover:underline flex items-center gap-0.5">
                عرض المخزون <ChevronLeft size={12} />
              </button>
            }>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.low_stock_fabrics?.length > 0 && (
                <ChartContainer title={`أقمشة منخفضة (${data.low_stock_fabrics.length})`}>
                  <div className="space-y-2">
                    {data.low_stock_fabrics.slice(0, 5).map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 truncate">{f.name || f.code}</span>
                        <span className="font-mono text-red-600 dark:text-red-400 shrink-0 mr-2">
                          {f.available_meters?.toFixed(1) || 0}م
                        </span>
                      </div>
                    ))}
                  </div>
                </ChartContainer>
              )}
              {data.low_stock_accessories?.length > 0 && (
                <ChartContainer title={`اكسسوارات منخفضة (${data.low_stock_accessories.length})`}>
                  <div className="space-y-2">
                    {data.low_stock_accessories.slice(0, 5).map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 truncate">{a.name || a.code}</span>
                        <span className="font-mono text-red-600 dark:text-red-400 shrink-0 mr-2">
                          {a.quantity_on_hand} {a.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </ChartContainer>
              )}
            </div>
          </Section>
        );

      case 'recentOrders':
        return (
          <CollapsibleSection title="الأوامر الأخيرة" icon={Clock}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data?.recent_work_orders?.length > 0 && (
                <ChartContainer title="أوامر الإنتاج">
                  <div className="space-y-1">
                    {data.recent_work_orders.map(wo => (
                      <button key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)}
                        className="w-full flex items-center justify-between gap-2 p-2 rounded-lg
                          hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-right">
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">{wo.wo_number}</p>
                          <p className="text-[10px] text-gray-400 truncate">{wo.model_name || wo.model_code}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {wo.stages_total > 0 && (
                            <div className="w-16 bg-gray-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-[#c9a84c] transition-all"
                                style={{ width: `${(wo.stages_done / wo.stages_total) * 100}%` }} />
                            </div>
                          )}
                          <StatusDot status={wo.status} />
                        </div>
                      </button>
                    ))}
                  </div>
                </ChartContainer>
              )}
              {data?.recent_pos?.length > 0 && (
                <ChartContainer title="أوامر الشراء">
                  <div className="space-y-1">
                    {data.recent_pos.map(po => (
                      <button key={po.id} onClick={() => navigate('/purchase-orders')}
                        className="w-full flex items-center justify-between gap-2 p-2 rounded-lg
                          hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-right">
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">{po.po_number}</p>
                          <p className="text-[10px] text-gray-400 truncate">{po.supplier_name}</p>
                        </div>
                        <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 shrink-0">
                          <MoneyDisplay amount={po.total_amount} />
                        </span>
                      </button>
                    ))}
                  </div>
                </ChartContainer>
              )}
            </div>
          </CollapsibleSection>
        );

      case 'bottlenecks':
        if (!data?.stage_bottlenecks?.length || !hasRole('superadmin', 'manager', 'production')) return null;
        return (
          <CollapsibleSection title="اختناقات الإنتاج" icon={Activity}>
            <ChartContainer>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/10">
                      <th className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 py-2 text-right">المرحلة</th>
                      <th className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 py-2 text-right">قيد التنفيذ</th>
                      <th className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 py-2 text-right">أوامر</th>
                      <th className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 py-2 text-right">متوسط أيام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stage_bottlenecks.map((b, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-white/5 last:border-0">
                        <td className="text-xs text-gray-700 dark:text-gray-300 py-2">{b.stage_name}</td>
                        <td className="text-xs font-mono text-gray-700 dark:text-gray-300 py-2">{b.total_wip}</td>
                        <td className="text-xs font-mono text-gray-700 dark:text-gray-300 py-2">{b.wo_count}</td>
                        <td className={`text-xs font-mono py-2 ${
                          b.avg_days_in_stage > 3 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {b.avg_days_in_stage?.toFixed(1) || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartContainer>
          </CollapsibleSection>
        );

      case 'hrSummary':
        if (!showHR) return null;
        return (
          <CollapsibleSection title="الموارد البشرية" icon={Users}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPICard icon={Users} label="إجمالي الموظفين" value={hrData?.total_employees ?? '—'} color="info" to="/hr/employees" />
              <KPICard icon={CalendarDays} label="حضور اليوم" value={hrData?.today_attendance ?? '—'} color="gold" to="/hr/attendance" />
              <KPICard icon={DollarSign} label="رواتب الشهر" value={<MoneyDisplay amount={hrData?.monthly_payroll || 0} />} color="warning" to="/hr/payroll" />
              <KPICard icon={Clock} label="إجازات معلقة" value={hrData?.pending_leaves ?? 0} color="neutral" to="/hr/leaves" />
            </div>
          </CollapsibleSection>
        );

      default:
        return null;
    }
  })();

  if (!content) return null;

  return (
    <DraggableWidget {...dProps}>
      {content}
    </DraggableWidget>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Dashboard Content
   ══════════════════════════════════════════════════════════ */
function DashboardInner() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { widgets, refreshInterval, widgetOrder, moveWidget } = useDashboardConfig();
  const { data, loading, error, lastUpdated, refresh } = useDashboardData(refreshInterval);
  const { data: hrData } = useHRData(hasRole('superadmin', 'hr', 'manager'));
  const [configOpen, setConfigOpen] = useState(false);
  const role = user?.role || 'viewer';

  /* ── Drag state ─── */
  const dragIndex = useRef(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  const handleDragStart = useCallback((e, index, key) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  }, []);

  const handleDragOver = useCallback((e, index, key) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverKey(key);
  }, []);

  const handleDrop = useCallback((e, toIndex) => {
    e.preventDefault();
    setDragOverKey(null);
    if (dragIndex.current !== null && dragIndex.current !== toIndex) {
      moveWidget(dragIndex.current, toIndex);
    }
    dragIndex.current = null;
  }, [moveWidget]);

  /* Loading skeleton */
  if (loading && !data) {
    return (
      <div className="page space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-40" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      </div>
    );
  }

  /* Error state */
  if (error && !data) {
    return (
      <div className="page">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle size={36} className="text-red-400 mb-3" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{error}</p>
          <button onClick={refresh} className="btn btn-sm btn-primary mt-3">إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  const net = (data?.monthly_revenue || 0) - (data?.monthly_cost || 0);
  const pipelineTotal = data?.production_pipeline
    ? Object.values(data.production_pipeline).reduce((a, b) => a + (b || 0), 0) : 0;
  const kpis = getKPIsForRole(role, data);
  const hasAlerts = (data?.overdue_work_orders?.length || 0) > 0 || (data?.overdue_invoices?.length || 0) > 0;
  const showFinance = hasRole('superadmin', 'manager', 'accountant');
  const showHR = hasRole('superadmin', 'hr', 'manager') && hrData;

  return (
    <div className="page space-y-6">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">لوحة التحكم</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            مرحباً {user?.full_name}
            {lastUpdated && (
              <span className="mr-3 text-gray-300 dark:text-gray-600">
                آخر تحديث: {lastUpdated.toLocaleTimeString('ar-EG')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={refresh} title="تحديث"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setConfigOpen(true)} title="تخصيص"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <Settings size={16} />
          </button>
          <HelpButton pageKey="dashboard" />
        </div>
      </div>

      {/* ═══ Ordered Widget Sections ═══════════════════ */}
      {widgetOrder.map((key, idx) => {
        const dProps = { widgetKey: key, index: idx, onDragStart: handleDragStart, onDragOver: handleDragOver, onDrop: handleDrop, dragOverKey };
        return <WidgetRenderer key={key} widgetKey={key} dProps={dProps}
          widgets={widgets} data={data} hrData={hrData} kpis={kpis} net={net}
          pipelineTotal={pipelineTotal} hasAlerts={hasAlerts} showFinance={showFinance} showHR={showHR}
          hasRole={hasRole} navigate={navigate} loading={loading} />;
      })}

      {/* Secondary Stats (always shown, not draggable) */}
      <SecondaryStats data={data} />

      {/* Config Panel Modal */}
      <DashboardConfigPanel open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
}

/* ── Export with provider wrapper ───────────────────────── */
export default function Dashboard() {
  return (
    <DashboardConfigProvider>
      <DashboardInner />
    </DashboardConfigProvider>
  );
}
