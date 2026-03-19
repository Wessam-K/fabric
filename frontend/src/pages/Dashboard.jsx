import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Gem, List, TrendingUp, Factory, Truck, ShoppingCart, DollarSign, Users, Clock, AlertTriangle, Shield, Settings, UserCheck, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" />
      </div>
    );
  }

  const cards = [
    { label: 'الموديلات', value: data?.total_models ?? 0, icon: List, color: 'bg-blue-50 text-blue-600', path: '/models' },
    { label: 'الأقمشة', value: data?.total_fabrics ?? 0, icon: Scissors, color: 'bg-green-50 text-green-600', path: '/fabrics' },
    { label: 'الاكسسوارات', value: data?.total_accessories ?? 0, icon: Gem, color: 'bg-purple-50 text-purple-600', path: '/accessories' },
    { label: 'الفواتير', value: data?.total_invoices ?? 0, icon: TrendingUp, color: 'bg-amber-50 text-amber-600', path: '/invoices' },
    { label: 'أوامر إنتاج نشطة', value: data?.active_work_orders ?? 0, icon: Factory, color: 'bg-orange-50 text-orange-600', path: '/work-orders' },
    { label: 'مكتمل هذا الشهر', value: data?.completed_this_month ?? 0, icon: ShoppingCart, color: 'bg-teal-50 text-teal-600', path: '/work-orders' },
    { label: 'الموردين', value: data?.total_suppliers ?? 0, icon: Truck, color: 'bg-indigo-50 text-indigo-600', path: '/suppliers' },
    { label: 'مستحقات الموردين', value: `${(data?.outstanding_payables || 0).toLocaleString('ar-EG')} ج`, icon: DollarSign, color: 'bg-red-50 text-red-600' },
    { label: 'العملاء', value: data?.total_customers ?? 0, icon: UserCheck, color: 'bg-cyan-50 text-cyan-600', path: '/customers' },
    { label: 'الماكينات', value: `${data?.machines_in_use ?? 0}/${data?.total_machines ?? 0}`, icon: Settings, color: 'bg-slate-50 text-slate-600', path: '/machines' },
    { label: 'مستحقات العملاء', value: `${(data?.customer_outstanding || 0).toLocaleString('ar-EG')} ج`, icon: DollarSign, color: 'bg-pink-50 text-pink-600' },
    { label: 'جودة الإنتاج', value: `${data?.quality_rate ?? 100}%`, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">لوحة التحكم</h2>
          <p className="text-xs text-gray-400 mt-0.5">مرحباً {user?.full_name} — نظرة عامة على المصنع</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div key={i} onClick={() => c.path && navigate(c.path)}
            className={`bg-white rounded-2xl shadow-sm p-5 ${c.path ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color} mb-3`}>
              <c.icon size={20} />
            </div>
            <p className="text-2xl font-bold font-mono text-[#1a1a2e]">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Production Pipeline + Financial + Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Production Pipeline */}
        {data?.production_pipeline && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-3">خط الإنتاج</h3>
            <div className="space-y-2">
              {[
                { key: 'pending', label: 'معلق', color: 'bg-gray-200' },
                { key: 'in_progress', label: 'جاري', color: 'bg-blue-500' },
                { key: 'completed', label: 'مكتمل', color: 'bg-green-500' },
                { key: 'delivered', label: 'مُسلّم', color: 'bg-emerald-500' },
                { key: 'cancelled', label: 'ملغي', color: 'bg-red-400' },
              ].map(s => {
                const count = data.production_pipeline[s.key] || 0;
                const total = Object.values(data.production_pipeline).reduce((a, b) => a + b, 0) || 1;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-14">{s.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono font-bold w-6 text-left">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Monthly Revenue/Cost */}
        {(data?.monthly_revenue != null || data?.monthly_cost != null) && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-3">مالية الشهر</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400">إيرادات الشهر</p>
                <p className="text-xl font-bold font-mono text-green-600">{(data.monthly_revenue || 0).toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">تكاليف الشهر</p>
                <p className="text-xl font-bold font-mono text-red-500">{(data.monthly_cost || 0).toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div className="border-t pt-2">
                <p className="text-xs text-gray-400">صافي الربح</p>
                <p className={`text-xl font-bold font-mono ${(data.monthly_revenue || 0) - (data.monthly_cost || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {((data.monthly_revenue || 0) - (data.monthly_cost || 0)).toLocaleString('ar-EG')} ج.م
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Low Stock Alerts */}
        {((data?.low_stock_fabrics?.length || 0) + (data?.low_stock_accessories?.length || 0)) > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> تنبيهات المخزون</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
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
          </div>
        )}
      </div>

      {/* Overdue Work Orders */}
      {data?.overdue_work_orders?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2"><Clock size={14} className="text-red-500" /> أوامر إنتاج متأخرة</h3>
          <div className="space-y-2">
            {data.overdue_work_orders.map(wo => (
              <div key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)}
                className="flex items-center justify-between p-3 bg-red-50 rounded-xl cursor-pointer hover:bg-red-100 transition-colors">
                <div>
                  <span className="font-mono text-xs font-bold">{wo.wo_number}</span>
                  <span className="text-xs text-gray-500 mr-2">{wo.model_name || wo.model_code}</span>
                </div>
                <span className="text-xs text-red-600">مطلوب: {wo.deadline ? new Date(wo.deadline).toLocaleDateString('ar-EG') : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HR Quick Stats (for HR/Admin roles) */}
      {hrData && hasRole('superadmin', 'hr', 'manager') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div onClick={() => navigate('/hr/employees')} className="bg-white rounded-2xl shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-50 text-cyan-600 mb-3"><Users size={20} /></div>
            <p className="text-2xl font-bold font-mono text-[#1a1a2e]">{hrData.total_employees}</p>
            <p className="text-xs text-gray-400 mt-0.5">الموظفين</p>
          </div>
          <div onClick={() => navigate('/hr/payroll')} className="bg-white rounded-2xl shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 mb-3"><DollarSign size={20} /></div>
            <p className="text-2xl font-bold font-mono text-[#1a1a2e]">{(hrData.total_payroll || 0).toLocaleString('ar-EG')}</p>
            <p className="text-xs text-gray-400 mt-0.5">رواتب الشهر</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-pink-50 text-pink-600 mb-3"><TrendingUp size={20} /></div>
            <p className="text-2xl font-bold font-mono text-[#1a1a2e]">{(hrData.avg_salary || 0).toLocaleString('ar-EG')}</p>
            <p className="text-xs text-gray-400 mt-0.5">متوسط الراتب</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600 mb-3"><Shield size={20} /></div>
            <p className="text-2xl font-bold font-mono text-[#1a1a2e]">{hrData.dept_breakdown?.length || 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">الأقسام</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Models */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">آخر الموديلات</h3>
          {(!data?.recent_models || data.recent_models.length === 0) ? (
            <p className="text-sm text-gray-400 text-center py-8">لا توجد موديلات بعد</p>
          ) : (
            <div className="space-y-3">
              {data.recent_models.map(m => (
                <div key={m.model_code}
                  onClick={() => navigate(`/models/${m.model_code}/edit`)}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {m.model_image ? <img src={m.model_image} alt="" className="w-full h-full object-cover" /> : <span className="text-lg text-gray-300">📷</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{m.serial_number}</span>
                      <span className="text-sm font-bold text-[#1a1a2e]">{m.model_code}</span>
                    </div>
                    {m.model_name && <p className="text-xs text-gray-500 truncate">{m.model_name}</p>}
                  </div>
                  <span className="text-[10px] text-gray-400">{new Date(m.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Work Orders */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">آخر أوامر الإنتاج</h3>
          {(!data?.recent_work_orders || data.recent_work_orders.length === 0) ? (
            <p className="text-sm text-gray-400 text-center py-8">لا توجد أوامر إنتاج بعد</p>
          ) : (
            <div className="space-y-3">
              {data.recent_work_orders.map(wo => (
                <div key={wo.id}
                  onClick={() => navigate(`/work-orders/${wo.id}`)}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    wo.status === 'completed' ? 'bg-green-50 text-green-600' :
                    wo.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Factory size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{wo.wo_number}</span>
                      <span className="text-sm font-bold text-[#1a1a2e]">{wo.model_code}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {wo.model_name || ''}
                      {wo.stages_total > 0 && ` • ${wo.stages_done || 0}/${wo.stages_total} مراحل`}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    wo.status === 'completed' ? 'bg-green-100 text-green-700' :
                    wo.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>{wo.status === 'completed' ? 'مكتمل' : wo.status === 'in_progress' ? 'جاري' : 'مسودة'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
