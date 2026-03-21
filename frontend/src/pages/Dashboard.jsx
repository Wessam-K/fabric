import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Gem, List, TrendingUp, Factory, Truck, DollarSign, Users, Clock, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, KPIStrip, StatusBadge, MoneyDisplay, LoadingState, EmptyState, Skeleton } from '../components/ui';
import HelpButton from '../components/HelpButton';

const LazyCharts = lazy(() => import('../components/DashboardCharts'));

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [data, setData] = useState(null);
  const [hrData, setHrData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: d } = await api.get('/dashboard');
        setData(d);
        if (hasRole('superadmin', 'hr', 'manager')) {
          const { data: hr } = await api.get('/reports/hr-summary');
          setHrData(hr);
        }
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <LoadingState message="جاري تحميل البيانات..." />;

  const net = (data?.monthly_revenue || 0) - (data?.monthly_cost || 0);
  const lowStockCount = (data?.low_stock_fabrics?.length || 0) + (data?.low_stock_accessories?.length || 0);
  const pipelineTotal = data?.production_pipeline ? Object.values(data.production_pipeline).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="page">
      <PageHeader title="لوحة التحكم" subtitle={`مرحباً ${user?.full_name} — نظرة عامة على المصنع`} action={<HelpButton pageKey="dashboard" />} />

      {/* Primary KPIs */}
      <KPIStrip items={[
        { icon: Factory, label: 'أوامر نشطة', value: data?.active_work_orders ?? 0, color: 'gold', onClick: () => navigate('/work-orders') },
        { icon: CheckCircle, label: 'مكتمل هذا الشهر', value: data?.completed_this_month ?? 0, color: 'success' },
        { icon: DollarSign, label: 'إيرادات الشهر', value: <MoneyDisplay amount={data?.monthly_revenue || 0} />, color: 'success' },
        { icon: TrendingUp, label: 'صافي الربح', value: <MoneyDisplay amount={net} />, color: net >= 0 ? 'success' : 'danger' },
        { icon: AlertTriangle, label: 'تنبيهات مخزون', value: lowStockCount, color: lowStockCount > 0 ? 'warning' : 'success' },
      ]} />

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'الموديلات', value: data?.total_models ?? 0, icon: List, path: '/models' },
          { label: 'الأقمشة', value: data?.total_fabrics ?? 0, icon: Scissors, path: '/fabrics' },
          { label: 'الاكسسوارات', value: data?.total_accessories ?? 0, icon: Gem, path: '/accessories' },
          { label: 'الموردين', value: data?.total_suppliers ?? 0, icon: Truck, path: '/suppliers' },
          { label: 'العملاء', value: data?.total_customers ?? 0, icon: Users, path: '/customers' },
          { label: 'جودة الإنتاج', value: `${data?.quality_rate ?? 100}%`, icon: Activity },
        ].map((c, i) => (
          <div key={i} onClick={() => c.path && navigate(c.path)}
            className={`card card-body flex items-center gap-3 ${c.path ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow`}>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center shrink-0">
              <c.icon size={16} className="text-[var(--color-navy)]" />
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-[var(--color-navy)]">{c.value}</p>
              <p className="text-[11px] text-[var(--color-muted)]">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Overdue Work Orders Alert */}
      {data?.overdue_work_orders?.length > 0 && (
        <div className="card" style={{ borderRight: '3px solid var(--color-danger)' }}>
          <div className="card-header">
            <h3 className="section-title flex items-center gap-2"><Clock size={14} className="text-[var(--color-danger)]" /> أوامر إنتاج متأخرة ({data.overdue_work_orders.length})</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>رقم الأمر</th><th>الموديل</th><th>الموعد</th><th></th></tr></thead>
              <tbody>
                {data.overdue_work_orders.map(wo => (
                  <tr key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)} className="cursor-pointer">
                    <td><span className="font-mono text-xs">{wo.wo_number}</span></td>
                    <td>{wo.model_name || wo.model_code}</td>
                    <td className="text-[var(--color-danger)]">{wo.deadline ? new Date(wo.deadline).toLocaleDateString('ar-EG') : '—'}</td>
                    <td><StatusBadge status="overdue" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Grid: Pipeline + Finance + Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Production Pipeline */}
        {data?.production_pipeline && (
          <div className="card">
            <div className="card-header"><h3 className="section-title">خط الإنتاج</h3></div>
            <div className="card-body space-y-3">
              {[
                { key: 'pending', label: 'معلق', color: '#94a3b8' },
                { key: 'in_progress', label: 'جاري', color: '#3b82f6' },
                { key: 'completed', label: 'مكتمل', color: '#22c55e' },
                { key: 'delivered', label: 'مُسلّم', color: '#10b981' },
                { key: 'cancelled', label: 'ملغي', color: '#ef4444' },
              ].map(s => {
                const count = data.production_pipeline[s.key] || 0;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-muted)] w-12">{s.label}</span>
                    <div className="flex-1 bg-[var(--color-surface)] rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pipelineTotal ? (count / pipelineTotal) * 100 : 0}%`, background: s.color }} />
                    </div>
                    <span className="text-xs font-mono font-bold w-6 text-left">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Monthly Financials */}
        <div className="card">
          <div className="card-header"><h3 className="section-title">مالية الشهر</h3></div>
          <div className="card-body space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-muted)]">إيرادات</span>
              <span className="font-mono font-bold text-[var(--color-success)]"><MoneyDisplay amount={data?.monthly_revenue || 0} /></span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-muted)]">تكاليف</span>
              <span className="font-mono font-bold text-[var(--color-danger)]"><MoneyDisplay amount={data?.monthly_cost || 0} /></span>
            </div>
            <div className="border-t border-[var(--color-border)] pt-3 flex justify-between items-center">
              <span className="text-xs font-bold">صافي</span>
              <span className={`font-mono text-lg font-bold ${net >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                <MoneyDisplay amount={net} />
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--color-muted)]">مستحقات موردين</span>
              <span className="font-mono text-amber-600"><MoneyDisplay amount={data?.outstanding_payables || 0} /></span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--color-muted)]">مستحقات عملاء</span>
              <span className="font-mono text-blue-600"><MoneyDisplay amount={data?.customer_outstanding || 0} /></span>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="card-header"><h3 className="section-title flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> تنبيهات المخزون</h3></div>
          <div className="card-body">
            {lowStockCount === 0 ? (
              <EmptyState icon={CheckCircle} message="المخزون جيد" />
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {(data.low_stock_fabrics || []).map(f => (
                  <div key={f.code} className="flex items-center justify-between text-xs p-2 bg-amber-50 rounded-lg">
                    <span className="text-gray-700">{f.name}</span>
                    <span className="font-mono text-amber-600">{f.available_meters || 0} متر</span>
                  </div>
                ))}
                {(data.low_stock_accessories || []).map(a => (
                  <div key={a.code} className="flex items-center justify-between text-xs p-2 bg-orange-50 rounded-lg">
                    <span className="text-gray-700">{a.name}</span>
                    <span className="font-mono text-orange-600">{a.quantity_on_hand || 0} {a.unit || 'قطعة'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HR Stats */}
      {hrData && hasRole('superadmin', 'hr', 'manager') && (
        <KPIStrip items={[
          { icon: Users, label: 'الموظفين', value: hrData.total_employees, onClick: () => navigate('/hr/employees') },
          { icon: DollarSign, label: 'رواتب الشهر', value: <MoneyDisplay amount={hrData.total_payroll || 0} />, onClick: () => navigate('/hr/payroll') },
          { icon: TrendingUp, label: 'متوسط الراتب', value: <MoneyDisplay amount={hrData.avg_salary || 0} /> },
          { icon: Factory, label: 'الأقسام', value: hrData.dept_breakdown?.length || 0 },
        ]} />
      )}

      {/* Recent Activity: Models + Work Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header"><h3 className="section-title">آخر الموديلات</h3></div>
          <div className="card-body">
            {(!data?.recent_models || data.recent_models.length === 0) ? (
              <EmptyState icon={List} message="لا توجد موديلات بعد" />
            ) : (
              <div className="space-y-2">
                {data.recent_models.map(m => (
                  <div key={m.model_code} onClick={() => navigate(`/models/${m.model_code}/edit`)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface)] cursor-pointer transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-surface)] overflow-hidden shrink-0 flex items-center justify-center">
                      {m.model_image ? <img src={m.model_image} alt="" className="w-full h-full object-cover" /> : <List size={16} className="text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--color-navy)]">{m.model_code}</p>
                      {m.model_name && <p className="text-[11px] text-[var(--color-muted)] truncate">{m.model_name}</p>}
                    </div>
                    <span className="text-[10px] text-[var(--color-muted)]">{new Date(m.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="section-title">آخر أوامر الإنتاج</h3></div>
          <div className="card-body">
            {(!data?.recent_work_orders || data.recent_work_orders.length === 0) ? (
              <EmptyState icon={Factory} message="لا توجد أوامر إنتاج بعد" />
            ) : (
              <div className="space-y-2">
                {data.recent_work_orders.map(wo => (
                  <div key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface)] cursor-pointer transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                      <Factory size={16} className="text-[var(--color-navy)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{wo.wo_number}</span>
                        <span className="text-sm font-bold text-[var(--color-navy)]">{wo.model_code}</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] truncate">
                        {wo.model_name || ''}
                        {wo.stages_total > 0 && ` • ${wo.stages_done || 0}/${wo.stages_total} مراحل`}
                      </p>
                    </div>
                    <StatusBadge status={wo.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {data && (
        <Suspense fallback={<Skeleton className="h-64 w-full" count={1} />}>
          <LazyCharts data={data} />
        </Suspense>
      )}

      {/* Top Models & Stage Bottlenecks */}
      {(data?.top_models?.length > 0 || data?.stage_bottlenecks?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data?.top_models?.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="section-title">أكثر الموديلات إنتاجاً</h3></div>
              <div className="card-body space-y-3">
                {data.top_models.map((m, i) => (
                  <div key={m.model_code} className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-[var(--color-gold)] w-6">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--color-navy)] truncate">{m.model_code} {m.model_name && `— ${m.model_name}`}</p>
                      <p className="text-[10px] text-[var(--color-muted)]">{m.total_wo} أوامر • {m.completed_wo} مكتمل • {m.total_pieces_completed || 0} قطعة</p>
                    </div>
                    {m.avg_cost_per_piece > 0 && (
                      <span className="text-[10px] font-mono text-[var(--color-muted)]">{Math.round(m.avg_cost_per_piece)} ج.م/قطعة</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data?.stage_bottlenecks?.length > 0 && (
            <div className="card" style={{ borderRight: '3px solid var(--color-warning)' }}>
              <div className="card-header"><h3 className="section-title flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> اختناقات المراحل</h3></div>
              <div className="card-body space-y-3">
                {data.stage_bottlenecks.map(s => (
                  <div key={s.stage_name} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--color-navy)]">{s.stage_name}</p>
                      <p className="text-[10px] text-[var(--color-muted)]">{s.wo_count} أمر عمل</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-mono font-bold text-amber-600">{s.total_wip} قطعة</p>
                      {s.avg_days_in_stage > 0 && <p className="text-[10px] text-[var(--color-muted)]">{Math.round(s.avg_days_in_stage)} يوم</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
