import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Gem, List, TrendingUp, Factory, Truck, ShoppingCart, DollarSign } from 'lucide-react';
import axios from 'axios';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/dashboard')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
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
    { label: 'متوسط تكلفة القطعة', value: `${(data?.avg_cost_per_piece || 0).toLocaleString('ar-EG')} ج`, icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
    { label: 'أوامر إنتاج نشطة', value: data?.active_work_orders ?? 0, icon: Factory, color: 'bg-orange-50 text-orange-600', path: '/workorders' },
    { label: 'أوامر شراء معلقة', value: data?.pending_pos ?? 0, icon: ShoppingCart, color: 'bg-teal-50 text-teal-600', path: '/purchaseorders' },
    { label: 'الموردين', value: data?.total_suppliers ?? 0, icon: Truck, color: 'bg-indigo-50 text-indigo-600', path: '/suppliers' },
    { label: 'مستحقات الموردين', value: `${(data?.outstanding_payables || 0).toLocaleString('ar-EG')} ج`, icon: DollarSign, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1a1a2e]">لوحة التحكم</h2>
        <p className="text-xs text-gray-400 mt-0.5">نظرة عامة على المصنع</p>
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
                  onClick={() => navigate(`/workorders/${wo.id}`)}
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
                    <p className="text-xs text-gray-500 truncate">{wo.model_name || ''} • {wo.quantity || 0} قطعة</p>
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
