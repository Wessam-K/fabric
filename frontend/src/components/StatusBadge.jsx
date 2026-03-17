const MAPS = {
  work_order: {
    draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600' },
    pending: { label: 'معلق', color: 'bg-yellow-100 text-yellow-700' },
    in_progress: { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
  },
  purchase_order: {
    draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600' },
    sent: { label: 'مُرسل', color: 'bg-blue-100 text-blue-700' },
    partial: { label: 'استلام جزئي', color: 'bg-amber-100 text-amber-700' },
    received: { label: 'مُستلم', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
  },
  invoice: {
    draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600' },
    sent: { label: 'مُرسلة', color: 'bg-blue-100 text-blue-700' },
    paid: { label: 'مدفوعة', color: 'bg-green-100 text-green-700' },
    overdue: { label: 'متأخرة', color: 'bg-red-100 text-red-700' },
    cancelled: { label: 'ملغاة', color: 'bg-gray-100 text-gray-400' },
  },
};

export default function StatusBadge({ status, type = 'work_order', className = '' }) {
  const map = MAPS[type] || MAPS.work_order;
  const info = map[status] || { label: status, color: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${info.color} ${className}`}>
      {info.label}
    </span>
  );
}
