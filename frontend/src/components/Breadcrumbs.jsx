import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';

const PATH_LABELS = {
  dashboard: 'لوحة التحكم',
  fabrics: 'الأقمشة',
  accessories: 'الاكسسوارات',
  inventory: 'المخزون',
  models: 'الموديلات',
  'work-orders': 'أوامر الإنتاج',
  invoices: 'الفواتير',
  customers: 'العملاء',
  suppliers: 'الموردين',
  'purchase-orders': 'أوامر الشراء',
  reports: 'التقارير',
  hr: 'الموارد البشرية',
  employees: 'الموظفين',
  attendance: 'الحضور والانصراف',
  payroll: 'الرواتب',
  leaves: 'الإجازات',
  users: 'المستخدمين',
  settings: 'الإعدادات',
  permissions: 'الصلاحيات',
  'audit-log': 'سجل المراجعة',
  notifications: 'الإشعارات',
  machines: 'الماكينات',
  maintenance: 'الصيانة',
  accounting: 'المحاسبة',
  coa: 'دليل الحسابات',
  journal: 'القيود اليومية',
  'trial-balance': 'ميزان المراجعة',
  profile: 'الملف الشخصي',
  'change-password': 'تغيير كلمة المرور',
  expenses: 'المصروفات',
  samples: 'العينات',
  returns: 'المرتجعات',
  shipping: 'الشحن',
  quality: 'الجودة',
  quotations: 'عروض الأسعار',
  'sales-orders': 'أوامر البيع',
  mrp: 'تخطيط الموارد',
  exports: 'التصدير',
  documents: 'المستندات',
  backups: 'النسخ الاحتياطي',
  'knowledge-base': 'قاعدة المعرفة',
  'stage-templates': 'قوالب المراحل',
  scheduling: 'الجدولة',
  new: 'جديد',
  edit: 'تعديل',
  bom: 'قائمة المواد',
  view: 'عرض',
  print: 'طباعة',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length <= 1) return null;

  const crumbs = parts.map((part, i) => ({
    label: PATH_LABELS[part] || (part.match(/^\d+$/) ? `#${part}` : part),
    path: '/' + parts.slice(0, i + 1).join('/'),
    isLast: i === parts.length - 1,
  }));

  return (
    <nav className="flex items-center gap-1 text-xs text-gray-400 mb-3 px-1">
      <Link to="/dashboard" className="hover:text-[#c9a84c] transition-colors"><Home size={12} /></Link>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronLeft size={10} />
          {c.isLast ? (
            <span className="text-[#1a1a2e] dark:text-white font-bold">{c.label}</span>
          ) : (
            <Link to={c.path} className="hover:text-[#c9a84c] transition-colors">{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
