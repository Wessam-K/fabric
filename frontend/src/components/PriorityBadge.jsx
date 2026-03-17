const PRIORITY_MAP = {
  low: { label: 'منخفض', color: 'text-gray-400' },
  normal: { label: 'عادي', color: 'text-blue-500' },
  high: { label: 'عالي', color: 'text-orange-500' },
  urgent: { label: 'عاجل', color: 'text-red-600 font-bold' },
};

export default function PriorityBadge({ priority, className = '' }) {
  const info = PRIORITY_MAP[priority] || { label: priority, color: 'text-gray-400' };
  return <span className={`text-xs ${info.color} ${className}`}>{info.label}</span>;
}
