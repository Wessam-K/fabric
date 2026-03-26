import { useNavigate } from 'react-router-dom';
import { MoneyDisplay } from './ui';

const COLOR_MAP = {
  gold:    'text-[#c9a84c]   bg-[#c9a84c]/10',
  success: 'text-green-600   bg-green-50   dark:text-green-400 dark:bg-green-500/10',
  danger:  'text-red-600     bg-red-50     dark:text-red-400   dark:bg-red-500/10',
  warning: 'text-amber-600   bg-amber-50   dark:text-amber-400 dark:bg-amber-500/10',
  info:    'text-blue-600    bg-blue-50    dark:text-blue-400  dark:bg-blue-500/10',
  neutral: 'text-gray-500    bg-gray-100   dark:text-gray-400  dark:bg-gray-700',
};

/* ── KPI Card ───────────────────────────────────────────── */
export function KPICard({ icon: Icon, label, value, trend, trendLabel, color = 'neutral', to, onClick }) {
  const navigate = useNavigate();
  const cls = COLOR_MAP[color] || COLOR_MAP.neutral;
  const isClickable = to || onClick;

  function handleClick() {
    if (to) navigate(to);
    else if (onClick) onClick();
  }

  return (
    <button
      onClick={isClickable ? handleClick : undefined}
      className={`group relative text-right w-full rounded-xl p-4 transition-all
        bg-white dark:bg-white/5 border border-gray-100 dark:border-white/8
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'}
        focus-visible:ring-2 focus-visible:ring-[#c9a84c] outline-none`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">{label}</p>
          <p className="text-xl font-bold font-mono text-gray-900 dark:text-white leading-tight truncate">{value}</p>
          {trend !== undefined && (
            <p className={`text-[10px] font-semibold mt-1 ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%{trendLabel ? ` ${trendLabel}` : ''}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
            <Icon size={18} strokeWidth={1.8} />
          </div>
        )}
      </div>
    </button>
  );
}

/* ── Section Wrapper ────────────────────────────────────── */
export function Section({ title, icon: Icon, action, children, className = '' }) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {Icon && <Icon size={15} className="text-gray-400 dark:text-gray-500" />}
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ── Chart Container ────────────────────────────────────── */
export function ChartContainer({ title, subtitle, children, className = '' }) {
  return (
    <div className={`rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/8 p-5 ${className}`}>
      {title && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">{title}</h4>
          {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Alert Item ─────────────────────────────────────────── */
export function AlertItem({ type = 'warning', title, subtitle, value, to, onClick }) {
  const navigate = useNavigate();
  const colors = {
    danger:  'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/15',
    warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/15',
    info:    'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/15',
  };
  const textColors = {
    danger: 'text-red-700 dark:text-red-400',
    warning: 'text-amber-700 dark:text-amber-400',
    info: 'text-blue-700 dark:text-blue-400',
  };

  return (
    <button
      onClick={() => to ? navigate(to) : onClick?.()}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-colors text-right
        ${colors[type] || colors.warning}`}
    >
      <div className="min-w-0">
        <p className={`text-xs font-bold font-mono ${textColors[type]}`}>{title}</p>
        {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>}
      </div>
      {value && <span className={`text-[11px] font-mono shrink-0 ${textColors[type]}`}>{value}</span>}
    </button>
  );
}

/* ── Machine Status Dot ───────────────────────────────────  */
export function MachineStatusDot({ machine, onClick }) {
  const statusStyles = {
    active:      'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
    maintenance: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    idle:        'bg-red-50   dark:bg-red-500/10   border-red-200   dark:border-red-500/30',
    inactive:    'bg-gray-100 dark:bg-gray-700      border-gray-200  dark:border-gray-600',
  };
  const dotColors = {
    active: 'bg-green-500', maintenance: 'bg-amber-500', idle: 'bg-red-500', inactive: 'bg-gray-400',
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-lg p-2 text-center border transition-transform hover:scale-105 cursor-pointer
        ${statusStyles[machine.status] || statusStyles.inactive}`}
    >
      <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-1 ${dotColors[machine.status] || dotColors.inactive}`} />
      <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate">{machine.code || machine.name}</p>
      <p className="text-[9px] text-gray-400 truncate">{machine.location || machine.machine_type || ''}</p>
    </button>
  );
}

/* ── Pipeline Bar ─────────────────────────────────────────  */
export function PipelineBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-500 dark:text-gray-400 w-12 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300 w-6 text-left">{count}</span>
    </div>
  );
}

/* ── Finance Row ──────────────────────────────────────────  */
export function FinanceRow({ label, amount, color = 'text-gray-700 dark:text-gray-300', bold = false }) {
  return (
    <div className={`flex justify-between items-center ${bold ? 'pt-3 border-t border-gray-100 dark:border-white/10' : ''}`}>
      <span className={`text-xs ${bold ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{label}</span>
      <span className={`font-mono ${bold ? 'text-lg font-bold' : 'font-semibold'} ${color}`}>
        <MoneyDisplay amount={amount} />
      </span>
    </div>
  );
}

/* ── Summary Tile (Today's summary) ───────────────────────  */
export function SummaryTile({ value, label, colorClass }) {
  return (
    <div className={`p-2.5 rounded-lg text-center ${colorClass}`}>
      <p className="text-lg font-bold font-mono leading-tight">{value}</p>
      <p className="text-[10px] mt-0.5 opacity-70">{label}</p>
    </div>
  );
}
