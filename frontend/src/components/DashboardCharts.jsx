import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';

const COLORS = ['#c9a84c', '#3b82f6', '#22c55e', '#ef4444', '#94a3b8', '#8b5cf6'];

export default function DashboardCharts({ data }) {
  // Production Pipeline chart data
  const pipelineData = data?.production_pipeline ? [
    { name: 'معلق', value: data.production_pipeline.pending || 0, fill: '#94a3b8' },
    { name: 'جاري', value: data.production_pipeline.in_progress || 0, fill: '#3b82f6' },
    { name: 'مكتمل', value: data.production_pipeline.completed || 0, fill: '#22c55e' },
    { name: 'مُسلّم', value: data.production_pipeline.delivered || 0, fill: '#10b981' },
    { name: 'ملغي', value: data.production_pipeline.cancelled || 0, fill: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  // Quality rate for radial chart
  const qualityRate = data?.quality_rate ?? 100;
  const qualityData = [{ name: 'جودة', value: qualityRate, fill: qualityRate >= 90 ? '#22c55e' : qualityRate >= 70 ? '#f59e0b' : '#ef4444' }];

  // Top models chart
  const topModelsData = (data?.top_models || []).slice(0, 5).map(m => ({
    name: m.model_code,
    orders: m.total_wo || 0,
    pieces: m.total_pieces_completed || 0,
  }));

  const hasData = pipelineData.length > 0 || topModelsData.length > 0;
  if (!hasData) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-[var(--color-navy)]">تحليلات الإنتاج</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Production Pipeline Pie */}
        {pipelineData.length > 0 && (
          <div className="card">
            <div className="card-header"><h4 className="text-xs font-semibold text-gray-500">خط الإنتاج</h4></div>
            <div className="card-body flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pipelineData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pipelineData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} أمر`} contentStyle={{ direction: 'rtl', fontSize: '12px', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mr-2">
                {pipelineData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                    <span className="text-[10px] text-gray-500">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quality Rate Radial */}
        <div className="card">
          <div className="card-header"><h4 className="text-xs font-semibold text-gray-500">معدل الجودة</h4></div>
          <div className="card-body flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} data={qualityData}>
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#f0f0f0' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <p className="text-3xl font-bold font-mono -mt-8" style={{ color: qualityData[0].fill }}>{qualityRate}%</p>
            <p className="text-[10px] text-gray-400 mt-1">نسبة الجودة</p>
          </div>
        </div>

        {/* Top Models Bar */}
        {topModelsData.length > 0 && (
          <div className="card">
            <div className="card-header"><h4 className="text-xs font-semibold text-gray-500">أكثر الموديلات إنتاجاً</h4></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topModelsData} layout="vertical" margin={{ right: 5, left: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ direction: 'rtl', fontSize: '11px', borderRadius: '8px' }} />
                  <Bar dataKey="orders" name="أوامر" fill="#c9a84c" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
