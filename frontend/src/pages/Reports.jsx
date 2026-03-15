import { useState, useEffect, useRef } from 'react';
import { BarChart2, PieChart, TrendingUp, Download, DollarSign, Layers, Package, Scissors, Search, Calendar } from 'lucide-react';
import axios from 'axios';
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
          const { data } = await axios.get('/api/reports/summary');
          setSummary(data);
        } else if (tab === 'by-model') {
          const { data } = await axios.get('/api/reports/by-model', filterParams());
          setByModel(data);
        } else if (tab === 'by-fabric') {
          const { data } = await axios.get('/api/reports/by-fabric', filterParams());
          setByFabric(data);
        } else if (tab === 'by-accessory') {
          const { data } = await axios.get('/api/reports/by-accessory', filterParams());
          setByAccessory(data);
        } else if (tab === 'costs') {
          const { data } = await axios.get('/api/reports/costs');
          setCostsData(data);
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1a1a2e]">التقارير</h2>
        <p className="text-xs text-gray-400 mt-0.5">تحليلات وإحصائيات المصنع</p>
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
        </>
      )}
    </div>
  );
}
