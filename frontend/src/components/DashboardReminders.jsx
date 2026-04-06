import { useNavigate } from 'react-router-dom';
import {
  Factory, AlertTriangle, FileText, Package, Wrench, ShoppingCart, CheckCircle
} from 'lucide-react';

const REMINDER_ITEMS = (data) => [
  {
    icon: Factory,
    label: 'أوامر نشطة',
    value: data?.active_work_orders ?? 0,
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',
    to: '/work-orders',
    show: true,
  },
  {
    icon: AlertTriangle,
    label: 'أوامر متأخرة',
    value: data?.overdue_work_orders?.length ?? 0,
    color: 'text-red-500 bg-red-50 dark:bg-red-900/30',
    to: '/work-orders',
    show: (data?.overdue_work_orders?.length ?? 0) > 0,
  },
  {
    icon: FileText,
    label: 'فواتير معلقة',
    value: data?.pending_invoices ?? 0,
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30',
    to: '/invoices',
    show: (data?.pending_invoices ?? 0) > 0,
  },
  {
    icon: Package,
    label: 'تنبيهات مخزون',
    value: (data?.low_stock_fabrics?.length ?? 0) + (data?.low_stock_accessories?.length ?? 0),
    color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/30',
    to: '/inventory/fabrics',
    show: ((data?.low_stock_fabrics?.length ?? 0) + (data?.low_stock_accessories?.length ?? 0)) > 0,
  },
  {
    icon: Wrench,
    label: 'صيانة معلقة',
    value: data?.pending_maintenance_count ?? 0,
    color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
    to: '/maintenance',
    show: (data?.pending_maintenance_count ?? 0) > 0,
  },
  {
    icon: ShoppingCart,
    label: 'أوامر شراء مفتوحة',
    value: data?.open_purchase_orders ?? 0,
    color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30',
    to: '/purchase-orders',
    show: (data?.open_purchase_orders ?? 0) > 0,
  },
  {
    icon: CheckCircle,
    label: 'مكتمل هذا الشهر',
    value: data?.completed_this_month ?? 0,
    color: 'text-green-500 bg-green-50 dark:bg-green-900/30',
    to: '/work-orders',
    show: true,
  },
];

export default function DashboardReminders({ data }) {
  const navigate = useNavigate();
  const items = REMINDER_ITEMS(data).filter(r => r.show);

  if (items.length === 0) return null;

  return (
    <div className="hidden xl:block w-64 shrink-0">
      <div className="sticky top-4 space-y-2">
        <h3 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mb-3">
          تنبيهات سريعة
        </h3>
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={() => navigate(item.to)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-all hover:scale-[1.02] hover:shadow-sm ${item.color}`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1 text-[12px] font-medium text-gray-700 dark:text-gray-200 truncate">
                {item.label}
              </span>
              <span className="text-[14px] font-bold font-mono min-w-[24px] text-center">
                {item.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
