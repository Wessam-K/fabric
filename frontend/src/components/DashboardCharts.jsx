import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar, AreaChart, Area, CartesianGrid } from 'recharts';
import { useTheme } from '../context/ThemeContext';

const COLORS = ['#c9a84c', '#3b82f6', '#22c55e', '#ef4444', '#94a3b8', '#8b5cf6'];

export default function DashboardCharts({ data }) {
  const { isDark } = useTheme();
  const tooltipStyle = {
    direction: 'rtl',
    fontSize: '11px',
    borderRadius: '8px',
    background: isDark ? '#1e1e32' : '#fff',
    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
    color: isDark ? '#e5e7eb' : '#374151',
  };

  // Pipeline Pie data
  const pipelineData = data?.production_pipeline ? [
    { name: 'مسودة', value: data.production_pipeline.draft || 0, fill: '#cbd5e1' },
    { name: 'معلق', value: data.production_pipeline.pending || 0, fill: '#94a3b8' },
    { name: 'جاري', value: data.production_pipeline.in_progress || 0, fill: '#3b82f6' },
    { name: 'مكتمل', value: data.production_pipeline.completed || 0, fill: '#22c55e' },
    { name: 'ملغي', value: data.production_pipeline.cancelled || 0, fill: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  // Quality radial
  const qualityRate = data?.quality_rate ?? 100;
  const qualityData = [{ name: 'جودة', value: qualityRate, fill: qualityRate >= 90 ? '#22c55e' : qualityRate >= 70 ? '#f59e0b' : '#ef4444' }];

  // Top models bar
  const topModelsData = (data?.top_models || []).slice(0, 5).map(m => ({
    name: m.model_code,
    orders: m.total_wo || 0,
    pieces: m.total_pieces_completed || 0,
  }));

  const hasData = pipelineData.length > 0 || topModelsData.length > 0;
  if (!hasData) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">تحليلات الإنتاج</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pipeline Pie */}
        {pipelineData.length > 0 && (
          <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/8 p-5">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">خط الإنتاج</h4>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="65%" height={200}>
                <PieChart>
                  <Pie data={pipelineData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pipelineData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} أمر`} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mr-2">
                {pipelineData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quality Radial */}
        <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/8 p-5">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">معدل الجودة</h4>
          <div className="flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%"
                startAngle={180} endAngle={0} data={qualityData}>
                <RadialBar dataKey="value" cornerRadius={10}
                  background={{ fill: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <p className="text-3xl font-bold font-mono -mt-8" style={{ color: qualityData[0].fill }}>
              {qualityRate}%
            </p>
            <p className="text-[10px] text-gray-400 mt-1">نسبة الجودة</p>
          </div>
        </div>

        {/* Top Models Bar */}
        {topModelsData.length > 0 && (
          <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/8 p-5">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">أكثر الموديلات إنتاجاً</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topModelsData} layout="vertical" margin={{ right: 5, left: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={60}
                  tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="orders" name="أوامر" fill="#c9a84c" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
