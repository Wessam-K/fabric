const STATUS_MAP = {
  // Work Orders
  draft: { label: 'مسودة', cls: 'badge-neutral' },
  pending: { label: 'معلق', cls: 'badge-warning' },
  in_progress: { label: 'جاري', cls: 'badge-info' },
  completed: { label: 'مكتمل', cls: 'badge-success' },
  cancelled: { label: 'ملغي', cls: 'badge-danger' },
  // Invoices
  sent: { label: 'مُرسلة', cls: 'badge-info' },
  paid: { label: 'مدفوعة', cls: 'badge-success' },
  overdue: { label: 'متأخرة', cls: 'badge-danger' },
  // Purchase Orders
  partial: { label: 'جزئي', cls: 'badge-warning' },
  received: { label: 'مُستلم', cls: 'badge-success' },
  // General
  active: { label: 'نشط', cls: 'badge-success' },
  inactive: { label: 'غير نشط', cls: 'badge-neutral' },
  // Payroll
  open: { label: 'مفتوح', cls: 'badge-info' },
  calculated: { label: 'محسوب', cls: 'badge-warning' },
  approved: { label: 'معتمد', cls: 'badge-success' },
  locked: { label: 'مقفل', cls: 'badge-neutral' },
  // Attendance
  present: { label: 'حاضر', cls: 'badge-success' },
  absent: { label: 'غائب', cls: 'badge-danger' },
  late: { label: 'متأخر', cls: 'badge-warning' },
  half_day: { label: 'نصف يوم', cls: 'badge-warning' },
  holiday: { label: 'إجازة', cls: 'badge-neutral' },
  leave: { label: 'إذن', cls: 'badge-info' },
  // Machines
  maintenance: { label: 'صيانة', cls: 'badge-warning' },
  // QC
  passed: { label: 'ناجح', cls: 'badge-success' },
  failed: { label: 'راسب', cls: 'badge-danger' },
  // Payment
  hold: { label: 'معلق', cls: 'badge-warning' },
};

const PRIORITY_MAP = {
  low: { label: 'منخفض', cls: 'badge-neutral' },
  normal: { label: 'عادي', cls: 'badge-info' },
  high: { label: 'مرتفع', cls: 'badge-warning' },
  urgent: { label: 'عاجل', cls: 'badge-danger' },
};

export default function StatusBadge({ status, type }) {
  if (type === 'priority') {
    const p = PRIORITY_MAP[status] || { label: status, cls: 'badge-neutral' };
    return <span className={`badge ${p.cls}`}>{p.label}</span>;
  }
  const s = STATUS_MAP[status] || { label: status, cls: 'badge-neutral' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export function MoneyDisplay({ amount, currency = 'ج.م', className = '' }) {
  const formatted = (amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return <span className={`font-mono ${className}`}>{formatted} {currency}</span>;
}
