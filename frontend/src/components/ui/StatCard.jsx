export function StatCard({ icon: Icon, label, value, subtitle, color = 'text-gray-600 bg-gray-50', onClick }) {
  return (
    <div onClick={onClick}
      className={`stat-card ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[22px] font-bold font-mono text-[#1a1a2e] leading-tight">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{label}</p>
          {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

export function KPIStrip({ items }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {items.map((item, i) => (
        <StatCard key={i} {...item} />
      ))}
    </div>
  );
}
