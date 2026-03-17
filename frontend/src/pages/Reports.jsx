import { useState, useEffect, useMemo } from 'react';
import { BarChart2, PieChart, TrendingUp, Download, DollarSign, Layers, Package, Scissors, Search, Calendar, AlertTriangle, Factory, Warehouse, Users, Table2, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../utils/api';
import { exportToExcel } from '../utils/exportExcel';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { useToast } from '../components/Toast';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const TABS = [
  { key: 'summary', label: 'ملخص عام', icon: TrendingUp },
  { key: 'by-model', label: 'حسب الموديل', icon: BarChart2 },
  { key: 'by-fabric', label: 'حسب القماش', icon: Scissors },
  { key: 'by-accessory', label: 'حسب الاكسسوار', icon: Package },
  { key: 'costs', label: 'تحليل التكاليف', icon: PieChart },
  { key: 'workorders', label: 'أوامر الإنتاج', icon: Layers },
  { key: 'suppliers', label: 'الموردين', icon: DollarSign },
  { key: 'production-wip', label: 'خط الإنتاج (WIP)', icon: Factory },
  { key: 'fabric-consumption', label: 'استهلاك الأقمشة', icon: Warehouse },
  { key: 'waste', label: 'تحليل الهدر', icon: AlertTriangle },
  { key: 'hr', label: 'الموارد البشرية', icon: Users },
  { key: 'pivot', label: 'جدول محوري', icon: Table2 },
];

function KPICard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} mb-3`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold font-mono text-[#1a1a2e]">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function downloadCSV(rows, filename) {
  if (!rows || rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG');

export default function Reports() {
  const toast = useToast();
  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [byModel, setByModel] = useState([]);
  const [byFabric, setByFabric] = useState([]);
  const [byAccessory, setByAccessory] = useState([]);
  const [costsData, setCostsData] = useState(null);
  const [workOrdersData, setWorkOrdersData] = useState(null);
  const [suppliersData, setSuppliersData] = useState(null);
  const [productionWIP, setProductionWIP] = useState(null);
  const [fabricConsumption, setFabricConsumption] = useState(null);
  const [wasteData, setWasteData] = useState(null);
  const [hrData, setHrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filterParams = () => {
    const p = {};
    if (search.trim()) p.search = search.trim();
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return { params: p };
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (tab === 'summary') {
          const { data } = await api.get('/reports/summary');
          setSummary(data);
        } else if (tab === 'by-model') {
          const { data } = await api.get('/reports/by-model', filterParams());
          setByModel(data);
        } else if (tab === 'by-fabric') {
          const { data } = await api.get('/reports/by-fabric', filterParams());
          setByFabric(data);
        } else if (tab === 'by-accessory') {
          const { data } = await api.get('/reports/by-accessory', filterParams());
          setByAccessory(data);
        } else if (tab === 'costs') {
          const { data } = await api.get('/reports/costs');
          setCostsData(data);
        } else if (tab === 'workorders') {
          const { data } = await api.get('/work-orders');
          setWorkOrdersData(data);
        } else if (tab === 'suppliers') {
          const { data } = await api.get('/suppliers');
          setSuppliersData(data);
        } else if (tab === 'production-wip') {
          const { data } = await api.get('/reports/production-by-stage');
          setProductionWIP(data);
        } else if (tab === 'fabric-consumption') {
          const { data } = await api.get('/reports/fabric-consumption');
          setFabricConsumption(data);
        } else if (tab === 'waste') {
          const { data } = await api.get('/reports/waste-analysis');
          setWasteData(data);
        } else if (tab === 'hr') {
          const { data } = await api.get('/reports/hr-summary');
          setHrData(data);
        } else if (tab === 'pivot') {
          setLoading(false); return; // PivotTable loads its own data
        }
      } catch { toast.error('فشل تحميل التقرير'); }
      finally { setLoading(false); }
    };
    load();
  }, [tab, search, dateFrom, dateTo]);

  const renderSummary = () => {
    if (!summary) return null;
    const cards = [
      { label: 'الموديلات', value: summary.total_models, icon: Layers, color: 'bg-blue-50 text-blue-600' },
      { label: 'الأقمشة', value: summary.total_fabrics, icon: Scissors, color: 'bg-green-50 text-green-600' },
      { label: 'الاكسسوارات', value: summary.total_accessories, icon: Package, color: 'bg-purple-50 text-purple-600' },
      { label: 'متوسط تكلفة القطعة', value: `${fmt(summary.avg_cost_per_piece)} ج`, icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
      { label: 'إجمالي القطع', value: fmt(summary.total_pieces), icon: BarChart2, color: 'bg-teal-50 text-teal-600' },
      { label: 'إجمالي التكلفة', value: `${fmt(summary.total_cost)} ج`, icon: DollarSign, color: 'bg-red-50 text-red-600' },
    ];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c, i) => <KPICard key={i} {...c} />)}
        </div>
        {summary.min_cost_per_piece > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-3">نطاق تكلفة القطعة</h3>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600 font-mono font-bold">أقل: {fmt(summary.min_cost_per_piece)} ج</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-l from-[#c9a84c] to-green-400 rounded-full" style={{ width: '100%' }} />
              </div>
              <span className="text-red-500 font-mono font-bold">أعلى: {fmt(summary.max_cost_per_piece)} ج</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderByModel = () => {
    if (byModel.length === 0) return <div className="text-center py-16 text-gray-400">لا توجد بيانات</div>;
    const chartData = {
      labels: byModel.slice(0, 10).map(m => m.model_code),
      datasets: [{
        label: 'تكلفة القطعة (ج)',
        data: byModel.slice(0, 10).map(m => m.cost_per_piece || 0),
        backgroundColor: '#c9a84c',
        borderRadius: 6,
      }],
    };
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button onClick={() => downloadCSV(byModel, 'models-report.csv')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
            <Download size={14} /> تصدير CSV
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">تكلفة القطعة حسب الموديل</h3>
          <div className="h-[300px]">
            <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الكود</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الاسم</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">القطع</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">قماش أساسي</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">بطانة</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">اكسسوارات</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">الإجمالي</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">تكلفة القطعة</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map(m => (
                <tr key={m.model_code} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs">{m.model_code}</td>
                  <td className="px-4 py-3 text-sm">{m.model_name || '—'}</td>
                  <td className="px-4 py-3 text-center font-mono">{m.total_pieces || 0}</td>
                  <td className="px-4 py-3 text-center font-mono">{fmt(m.main_fabric_cost)}</td>
                  <td className="px-4 py-3 text-center font-mono">{fmt(m.lining_cost)}</td>
                  <td className="px-4 py-3 text-center font-mono">{fmt(m.accessories_cost)}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold">{fmt(m.total_cost)}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-[#c9a84c]">{fmt(m.cost_per_piece)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderByFabric = () => {
    if (byFabric.length === 0) return <div className="text-center py-16 text-gray-400">لا توجد بيانات</div>;
    const chartData = {
      labels: byFabric.slice(0, 8).map(f => f.name),
      datasets: [{
        label: 'إجمالي الأمتار',
        data: byFabric.slice(0, 8).map(f => Math.round((f.total_meters || 0) * 100) / 100),
        backgroundColor: ['#c9a84c', '#1a1a2e', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'],
        borderRadius: 6,
      }],
    };
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button onClick={() => downloadCSV(byFabric, 'fabrics-report.csv')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
            <Download size={14} /> تصدير CSV
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">استهلاك الأقمشة (أمتار)</h3>
          <div className="h-[300px]">
            <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الكود</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الاسم</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">النوع</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">عدد الموديلات</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">إجمالي الأمتار</th>
              </tr>
            </thead>
            <tbody>
              {byFabric.map(f => (
                <tr key={f.code} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs">{f.code}</td>
                  <td className="px-4 py-3 font-bold">{f.name}</td>
                  <td className="px-4 py-3 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${f.fabric_type === 'main' ? 'bg-blue-100 text-blue-700' : f.fabric_type === 'lining' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{f.fabric_type}</span></td>
                  <td className="px-4 py-3 text-center font-mono">{f.model_count}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold">{fmt(f.total_meters)} م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderByAccessory = () => {
    if (byAccessory.length === 0) return <div className="text-center py-16 text-gray-400">لا توجد بيانات</div>;
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button onClick={() => downloadCSV(byAccessory, 'accessories-report.csv')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
            <Download size={14} /> تصدير CSV
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الكود</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الاسم</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">النوع</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">عدد الموديلات</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">إجمالي الكمية</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">إجمالي التكلفة</th>
              </tr>
            </thead>
            <tbody>
              {byAccessory.map(a => (
                <tr key={a.code} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                  <td className="px-4 py-3 font-bold">{a.name}</td>
                  <td className="px-4 py-3 text-center"><span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded">{a.acc_type}</span></td>
                  <td className="px-4 py-3 text-center font-mono">{a.model_count}</td>
                  <td className="px-4 py-3 text-center font-mono">{fmt(a.total_quantity)}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-[#c9a84c]">{fmt(a.total_cost)} ج</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCosts = () => {
    if (!costsData) return null;
    const { totals } = costsData;
    if (totals.total_cost === 0) return <div className="text-center py-16 text-gray-400">لا توجد بيانات تكلفة</div>;
    const pieData = {
      labels: ['قماش أساسي', 'بطانة', 'اكسسوارات', 'مصنعية', 'مصروف'],
      datasets: [{
        data: [totals.main_fabric_cost, totals.lining_cost, totals.accessories_cost, totals.masnaiya, totals.masrouf],
        backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#c9a84c', '#ef4444'],
      }],
    };
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button onClick={() => downloadCSV(costsData.snapshots, 'costs-report.csv')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
            <Download size={14} /> تصدير CSV
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">توزيع التكاليف</h3>
            <div className="h-[300px] flex items-center justify-center">
              <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">إجمالي التكاليف</h3>
            <div className="space-y-3">
              {[
                { label: 'قماش أساسي', value: totals.main_fabric_cost, color: 'bg-blue-500' },
                { label: 'بطانة', value: totals.lining_cost, color: 'bg-green-500' },
                { label: 'اكسسوارات', value: totals.accessories_cost, color: 'bg-purple-500' },
                { label: 'مصنعية', value: totals.masnaiya, color: 'bg-[#c9a84c]' },
                { label: 'مصروف', value: totals.masrouf, color: 'bg-red-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color} shrink-0`} />
                  <span className="flex-1 text-sm text-gray-600">{item.label}</span>
                  <span className="font-mono text-sm font-bold">{fmt(item.value)} ج</span>
                  <span className="text-[10px] text-gray-400 w-12 text-left">
                    {totals.total_cost > 0 ? ((item.value / totals.total_cost) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 flex items-center gap-3">
                <div className="w-3 h-3 shrink-0" />
                <span className="flex-1 text-sm font-bold text-[#1a1a2e]">الإجمالي</span>
                <span className="font-mono text-sm font-bold text-[#c9a84c]">{fmt(totals.total_cost)} ج</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWorkOrders = () => {
    if (!workOrdersData) return null;
    const orders = workOrdersData.work_orders || [];
    const stats = workOrdersData.stats || {};
    if (orders.length === 0) return <div className="text-center py-16 text-gray-400">لا توجد أوامر إنتاج</div>;
    const pieData = {
      labels: ['مسودة', 'معلق', 'جاري', 'مكتمل', 'ملغي'],
      datasets: [{
        data: [stats.draft || 0, stats.pending || 0, stats.in_progress || 0, stats.completed || 0, stats.cancelled || 0],
        backgroundColor: ['#94a3b8', '#eab308', '#3b82f6', '#10b981', '#ef4444'],
      }],
    };
    const totalOrders = orders.length;
    const activeOrders = orders.filter(o => o.status === 'in_progress' || o.status === 'pending').length;
    const completedOrders = stats.completed || 0;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="إجمالي الأوامر" value={totalOrders} icon={Layers} color="bg-blue-50 text-blue-600" />
          <KPICard label="أوامر نشطة" value={activeOrders} icon={TrendingUp} color="bg-amber-50 text-amber-600" />
          <KPICard label="مكتملة" value={completedOrders} icon={BarChart2} color="bg-green-50 text-green-600" />
          <KPICard label="عاجلة" value={stats.urgent || 0} icon={Package} color="bg-red-50 text-red-600" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">توزيع الحالات</h3>
            <div className="h-[250px] flex items-center justify-center">
              <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">آخر الأوامر</h3>
            <div className="space-y-2">
              {orders.slice(0, 8).map(o => (
                <div key={o.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-50">
                  <span className="font-mono text-xs">{o.wo_number}</span>
                  <span className="flex-1 text-gray-600">{o.model_code}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    o.status === 'completed' ? 'bg-green-100 text-green-700' :
                    o.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>{o.status === 'completed' ? 'مكتمل' : o.status === 'in_progress' ? 'جاري' : 'مسودة'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSuppliers = () => {
    const suppliers = Array.isArray(suppliersData) ? suppliersData : [];
    if (suppliers.length === 0) return <div className="text-center py-16 text-gray-400">لا توجد بيانات موردين</div>;
    const totalOutstanding = suppliers.reduce((s, sup) => s + (sup.balance || 0), 0);
    const byType = {};
    suppliers.forEach(s => { byType[s.supplier_type || 'other'] = (byType[s.supplier_type || 'other'] || 0) + 1; });
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard label="إجمالي الموردين" value={suppliers.length} icon={Package} color="bg-blue-50 text-blue-600" />
          <KPICard label="مستحقات معلقة" value={`${fmt(totalOutstanding)} ج`} icon={DollarSign} color="bg-red-50 text-red-600" />
          <KPICard label="أنواع الموردين" value={Object.keys(byType).length} icon={Layers} color="bg-purple-50 text-purple-600" />
        </div>
        <div className="flex justify-end">
          <button onClick={() => downloadCSV(suppliers.map(s => ({ code: s.code, name: s.name, supplier_type: s.supplier_type, balance: s.balance || 0, rating: s.rating })), 'suppliers-report.csv')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
            <Download size={14} /> تصدير CSV
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الكود</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الاسم</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">النوع</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">التقييم</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">الرصيد المستحق</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-3 font-bold">{s.name}</td>
                  <td className="px-4 py-3 text-center"><span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded">{s.supplier_type || '—'}</span></td>
                  <td className="px-4 py-3 text-center text-amber-500">{'★'.repeat(s.rating || 0)}{'☆'.repeat(5 - (s.rating || 0))}</td>
                  <td className={`px-4 py-3 text-center font-mono font-bold ${(s.balance || 0) > 0 ? 'text-red-500' : 'text-green-600'}`}>{fmt(s.balance || 0)} ج</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderProductionWIP = () => {
    if (!productionWIP || productionWIP.length === 0) return <div className="text-center py-16 text-gray-400">لا توجد بيانات إنتاج</div>;
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button onClick={() => downloadCSV(productionWIP, 'production-wip.csv')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
            <Download size={14} /> تصدير CSV
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">خط الإنتاج - WIP حسب المرحلة</h3>
          <div className="h-[300px]">
            <Bar data={{
              labels: productionWIP.map(s => s.stage_name),
              datasets: [
                { label: 'في المرحلة', data: productionWIP.map(s => s.total_in_stage || 0), backgroundColor: '#3b82f6', borderRadius: 6 },
                { label: 'مكتمل', data: productionWIP.map(s => s.total_completed || 0), backgroundColor: '#10b981', borderRadius: 6 },
              ],
            }} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { stacked: false }, y: { beginAtZero: true } } }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">المرحلة</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">عدد الأوامر</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">في المرحلة</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">مكتمل</th>
              </tr>
            </thead>
            <tbody>
              {productionWIP.map((s, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-bold">{s.stage_name}</td>
                  <td className="px-4 py-3 text-center font-mono">{s.wo_count || 0}</td>
                  <td className="px-4 py-3 text-center font-mono text-blue-600 font-bold">{s.total_in_stage || 0}</td>
                  <td className="px-4 py-3 text-center font-mono text-green-600 font-bold">{s.total_completed || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderFabricConsumption = () => {
    if (!fabricConsumption || fabricConsumption.length === 0) return <div className="text-center py-16 text-gray-400">لا توجد بيانات استهلاك</div>;
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button onClick={() => downloadCSV(fabricConsumption, 'fabric-consumption.csv')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
            <Download size={14} /> تصدير CSV
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">القماش</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الباتش</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">أمر الإنتاج</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">الكمية المستخدمة</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">الهدر</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">التكلفة</th>
              </tr>
            </thead>
            <tbody>
              {fabricConsumption.map((r, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-bold">{r.fabric_name || r.fabric_code}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.batch_code || '—'}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs">{r.wo_number}</td>
                  <td className="px-4 py-3 text-center font-mono">{fmt(r.quantity_used)} م</td>
                  <td className="px-4 py-3 text-center font-mono text-amber-600">{fmt(r.waste_meters)} م</td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-[#c9a84c]">{fmt(r.total_cost)} ج</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderWaste = () => {
    if (!wasteData || wasteData.length === 0) return <div className="text-center py-16 text-gray-400">لا توجد بيانات هدر</div>;
    const totalWaste = wasteData.reduce((s, r) => s + (r.total_waste_cost || 0), 0);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard label="إجمالي تكلفة الهدر" value={`${fmt(totalWaste)} ج`} icon={AlertTriangle} color="bg-amber-50 text-amber-600" />
          <KPICard label="أوامر بها هدر" value={wasteData.length} icon={Layers} color="bg-red-50 text-red-600" />
        </div>
        <div className="flex justify-end">
          <button onClick={() => downloadCSV(wasteData, 'waste-analysis.csv')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
            <Download size={14} /> تصدير CSV
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">أمر الإنتاج</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الموديل</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">إجمالي هدر (م)</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">تكلفة الهدر</th>
              </tr>
            </thead>
            <tbody>
              {wasteData.map((r, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs">{r.wo_number}</td>
                  <td className="px-4 py-3 font-bold">{r.model_code}</td>
                  <td className="px-4 py-3 text-center font-mono text-amber-600">{fmt(r.total_waste_meters)}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-red-500">{fmt(r.total_waste_cost)} ج</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderHR = () => {
    if (!hrData) return null;
    const { total_employees, total_payroll, avg_salary, dept_breakdown, type_breakdown } = hrData;
    const SALARY_LABELS = { monthly: 'شهري', daily: 'يومي', hourly: 'بالساعة', piece_work: 'بالقطعة' };
    const deptChartData = {
      labels: dept_breakdown.map(d => d.department),
      datasets: [{
        label: 'عدد الموظفين',
        data: dept_breakdown.map(d => d.count),
        backgroundColor: ['#c9a84c', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899'],
        borderRadius: 6,
      }],
    };
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard label="إجمالي الموظفين" value={total_employees} icon={Users} color="bg-blue-50 text-blue-600" />
          <KPICard label="إجمالي الرواتب (الشهر الحالي)" value={`${fmt(total_payroll)} ج`} icon={DollarSign} color="bg-green-50 text-green-600" />
          <KPICard label="متوسط الراتب" value={`${fmt(avg_salary)} ج`} icon={TrendingUp} color="bg-amber-50 text-amber-600" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">توزيع الموظفين حسب القسم</h3>
            <div className="h-[300px]">
              <Bar data={deptChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">حسب نوع الراتب</h3>
            <div className="space-y-3 mt-6">
              {type_breakdown.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-600">{SALARY_LABELS[t.salary_type] || t.salary_type}</span>
                  <span className="font-mono text-sm font-bold">{t.count}</span>
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#c9a84c] rounded-full" style={{ width: `${total_employees > 0 ? (t.count / total_employees) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {dept_breakdown.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs text-gray-500">القسم</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">عدد الموظفين</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500">إجمالي الرواتب</th>
                </tr>
              </thead>
              <tbody>
                {dept_breakdown.map((d, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-bold">{d.department}</td>
                    <td className="px-4 py-3 text-center font-mono">{d.count}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-[#c9a84c]">{fmt(d.total_salary)} ج</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1a1a2e]">مركز التقارير</h2>
        <p className="text-xs text-gray-400 mt-0.5">تحليلات وإحصائيات المصنع — جدول محوري وتقارير متقدمة</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${tab === t.key ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Filters (shown for filterable tabs) */}
      {['by-model', 'by-fabric', 'by-accessory'].includes(tab) && (
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الكود..." dir="rtl"
              className="w-full pr-9 pl-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/20 outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2 py-2 text-xs border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] outline-none" />
            <span className="text-xs text-gray-400">إلى</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2 py-2 text-xs border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] outline-none" />
          </div>
          {(search || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-red-500 hover:text-red-700 font-bold">مسح الفلاتر</button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>
      ) : (
        <>
          {tab === 'summary' && renderSummary()}
          {tab === 'by-model' && renderByModel()}
          {tab === 'by-fabric' && renderByFabric()}
          {tab === 'by-accessory' && renderByAccessory()}
          {tab === 'costs' && renderCosts()}
          {tab === 'workorders' && renderWorkOrders()}
          {tab === 'suppliers' && renderSuppliers()}
          {tab === 'production-wip' && renderProductionWIP()}
          {tab === 'fabric-consumption' && renderFabricConsumption()}
          {tab === 'waste' && renderWaste()}
          {tab === 'hr' && renderHR()}
          {tab === 'pivot' && <PivotTable />}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/*           Pivot Table Component             */
/* ═══════════════════════════════════════════ */
const PIVOT_SOURCES = {
  production: { label: 'الإنتاج', fields: ['wo_number', 'model_code', 'model_name', 'category', 'gender', 'status', 'total_pieces', 'total_cost', 'cost_per_piece', 'main_fabric_cost', 'lining_cost', 'accessories_cost', 'masnaiya', 'masrouf'] },
  financial: { label: 'المالية', fields: ['po_number', 'supplier_name', 'supplier_type', 'status', 'total_amount', 'paid_amount', 'balance', 'order_date', 'item_count'] },
  hr: { label: 'الموارد البشرية', fields: ['emp_code', 'full_name', 'department', 'job_title', 'salary_type', 'base_salary', 'employment_type', 'status', 'present_days', 'absent_days', 'total_overtime', 'last_net_salary'] },
  inventory: { label: 'المخزون', fields: ['code', 'name', 'fabric_type', 'color', 'supplier', 'price_per_m', 'available_meters', 'min_stock', 'stock_status', 'stock_value'] },
};
const NUMERIC_FIELDS = ['total_pieces', 'total_cost', 'cost_per_piece', 'main_fabric_cost', 'lining_cost', 'accessories_cost', 'masnaiya', 'masrouf', 'total_amount', 'paid_amount', 'balance', 'item_count', 'base_salary', 'present_days', 'absent_days', 'total_overtime', 'last_net_salary', 'price_per_m', 'available_meters', 'min_stock', 'stock_value'];
const AGG_FNS = { sum: 'مجموع', avg: 'متوسط', count: 'عدد', min: 'أقل', max: 'أعلى' };

function PivotTable() {
  const [source, setSource] = useState('production');
  const [rawData, setRawData] = useState([]);
  const [rowField, setRowField] = useState('');
  const [colField, setColField] = useState('');
  const [valueField, setValueField] = useState('');
  const [aggFn, setAggFn] = useState('sum');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/reports/pivot', { params: { source } })
      .then(r => {
        setRawData(r.data);
        const fields = PIVOT_SOURCES[source]?.fields || [];
        const textFields = fields.filter(f => !NUMERIC_FIELDS.includes(f));
        const numFields = fields.filter(f => NUMERIC_FIELDS.includes(f));
        setRowField(textFields[0] || '');
        setColField(textFields[1] || '');
        setValueField(numFields[0] || '');
      })
      .catch(() => setRawData([]))
      .finally(() => setLoading(false));
  }, [source]);

  const fields = PIVOT_SOURCES[source]?.fields || [];
  const textFields = fields.filter(f => !NUMERIC_FIELDS.includes(f));
  const numFields = fields.filter(f => NUMERIC_FIELDS.includes(f));

  // Compute pivot
  const pivot = useMemo(() => {
    if (!rowField || !valueField || rawData.length === 0) return null;
    const rowVals = [...new Set(rawData.map(r => String(r[rowField] ?? '—')))];
    const colVals = colField ? [...new Set(rawData.map(r => String(r[colField] ?? '—')))] : ['الكل'];
    const grid = {};
    rowVals.forEach(rv => { grid[rv] = {}; colVals.forEach(cv => { grid[rv][cv] = []; }); });

    rawData.forEach(r => {
      const rv = String(r[rowField] ?? '—');
      const cv = colField ? String(r[colField] ?? '—') : 'الكل';
      const val = Number(r[valueField]) || 0;
      grid[rv][cv].push(val);
    });

    const agg = (arr) => {
      if (arr.length === 0) return 0;
      if (aggFn === 'sum') return arr.reduce((a, b) => a + b, 0);
      if (aggFn === 'avg') return arr.reduce((a, b) => a + b, 0) / arr.length;
      if (aggFn === 'count') return arr.length;
      if (aggFn === 'min') return Math.min(...arr);
      if (aggFn === 'max') return Math.max(...arr);
      return 0;
    };

    const result = rowVals.map(rv => {
      const row = { _label: rv };
      let rowTotal = [];
      colVals.forEach(cv => {
        row[cv] = Math.round(agg(grid[rv][cv]) * 100) / 100;
        rowTotal = rowTotal.concat(grid[rv][cv]);
      });
      row._total = Math.round(agg(rowTotal) * 100) / 100;
      return row;
    });

    // Column totals
    const colTotals = { _label: 'الإجمالي' };
    let allVals = [];
    colVals.forEach(cv => {
      const allInCol = rawData.filter(r => !colField || String(r[colField] ?? '—') === cv).map(r => Number(r[valueField]) || 0);
      colTotals[cv] = Math.round(agg(allInCol) * 100) / 100;
      allVals = allVals.concat(allInCol);
    });
    colTotals._total = Math.round(agg(allVals) * 100) / 100;

    // Max value for heatmap
    const maxVal = Math.max(...result.map(r => colVals.map(cv => r[cv])).flat().filter(v => v > 0), 1);

    return { rowVals, colVals, result, colTotals, maxVal };
  }, [rawData, rowField, colField, valueField, aggFn]);

  function handleExport() {
    if (!pivot) return;
    const exportData = pivot.result.map(r => {
      const obj = { [rowField]: r._label };
      pivot.colVals.forEach(cv => { obj[cv] = r[cv]; });
      obj['الإجمالي'] = r._total;
      return obj;
    });
    const columns = [
      { key: rowField, header: rowField, width: 20 },
      ...pivot.colVals.map(cv => ({ key: cv, header: cv, width: 15 })),
      { key: 'الإجمالي', header: 'الإجمالي', width: 15 },
    ];
    exportToExcel(exportData, columns, `pivot-${source}`);
  }

  const heatColor = (val, maxVal) => {
    if (!val || val <= 0) return '';
    const pct = Math.min(val / maxVal, 1);
    const r = Math.round(201 + (249 - 201) * (1 - pct));
    const g = Math.round(168 + (115 - 168) * pct);
    const b = Math.round(76 + (22 - 76) * pct);
    return `rgba(${r},${g},${b},${0.1 + pct * 0.3})`;
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Table2 className="text-[#c9a84c]" size={20} />
          <h3 className="text-sm font-bold text-[#1a1a2e]">جدول محوري ديناميكي</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">مصدر البيانات</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              {Object.entries(PIVOT_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">الصفوف (Group By)</label>
            <select value={rowField} onChange={e => setRowField(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              {textFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">الأعمدة (اختياري)</label>
            <select value={colField} onChange={e => setColField(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              <option value="">— بدون —</option>
              {textFields.filter(f => f !== rowField).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">القيمة</label>
            <select value={valueField} onChange={e => setValueField(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              {numFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">الدالة</label>
            <select value={aggFn} onChange={e => setAggFn(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#c9a84c] outline-none">
              {Object.entries(AGG_FNS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Result */}
      {loading && <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>}
      {!loading && pivot && (
        <>
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">{pivot.result.length} صف × {pivot.colVals.length} عمود | {rawData.length} سجل</p>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
              <Download size={14} /> تصدير Excel
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-right font-medium text-gray-600 sticky right-0 bg-gray-50">{rowField}</th>
                  {pivot.colVals.map(cv => <th key={cv} className="px-3 py-3 text-center font-medium text-gray-600 min-w-[80px]">{cv}</th>)}
                  <th className="px-3 py-3 text-center font-bold text-[#1a1a2e] bg-amber-50 min-w-[80px]">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {pivot.result.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2 font-medium sticky right-0 bg-white border-l whitespace-nowrap">{row._label}</td>
                    {pivot.colVals.map(cv => (
                      <td key={cv} className="px-3 py-2 text-center font-mono"
                        style={{ backgroundColor: heatColor(row[cv], pivot.maxVal) }}>
                        {Number(row[cv]).toLocaleString()}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-mono font-bold bg-amber-50">{Number(row._total).toLocaleString()}</td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                  <td className="px-3 py-2 sticky right-0 bg-gray-50">الإجمالي</td>
                  {pivot.colVals.map(cv => (
                    <td key={cv} className="px-3 py-2 text-center font-mono">{Number(pivot.colTotals[cv]).toLocaleString()}</td>
                  ))}
                  <td className="px-3 py-2 text-center font-mono text-[#c9a84c] bg-amber-50">{Number(pivot.colTotals._total).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      {!loading && !pivot && rawData.length > 0 && (
        <div className="text-center py-8 text-gray-400">اختر الصفوف والقيمة لعرض الجدول المحوري</div>
      )}
      {!loading && rawData.length === 0 && (
        <div className="text-center py-8 text-gray-400">لا توجد بيانات</div>
      )}
    </div>
  );
}
