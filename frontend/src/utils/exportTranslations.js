// Centralized Arabic column translation map for all exports
export const COLUMN_TRANSLATIONS = {
  // Work Orders
  wo_number: 'رقم أمر الإنتاج',
  model_name: 'اسم الموديل',
  model_code: 'كود الموديل',
  customer_name: 'العميل',
  status: 'الحالة',
  priority: 'الأولوية',
  start_date: 'تاريخ البدء',
  due_date: 'تاريخ التسليم',
  completed_date: 'تاريخ الاكتمال',
  total_pieces: 'إجمالي القطع',
  total_cost: 'إجمالي التكلفة',
  fabric_cost: 'تكلفة الأقمشة',
  accessory_cost: 'تكلفة الاكسسوارات',
  masnaiya: 'المصنعية',
  masrouf: 'المصروف',
  margin_pct: 'هامش الربح %',
  wholesale_price: 'سعر الجملة',
  consumer_price: 'سعر المستهلك',
  notes: 'ملاحظات',
  assigned_to: 'المكلف به',

  // General
  id: 'المعرف',
  code: 'الكود',
  name: 'الاسم',
  description: 'الوصف',
  created_at: 'تاريخ الإنشاء',
  updated_at: 'تاريخ التعديل',
  created_by: 'أنشأ بواسطة',
  type: 'النوع',
  category: 'الفئة',

  // Customers / Suppliers
  phone: 'رقم الهاتف',
  email: 'البريد الإلكتروني',
  address: 'العنوان',
  balance: 'الرصيد',
  credit_limit: 'حد الائتمان',
  contact_person: 'شخص الاتصال',

  // Fabrics / Accessories
  fabric_name: 'اسم القماش',
  fabric_code: 'كود القماش',
  accessory_name: 'اسم الاكسسوار',
  accessory_code: 'كود الاكسسوار',
  color: 'اللون',
  unit: 'الوحدة',
  unit_price: 'سعر الوحدة',
  quantity: 'الكمية',
  available: 'المتاح',
  min_stock: 'الحد الأدنى',
  supplier_name: 'المورد',
  role: 'الدور',

  // Invoices
  invoice_number: 'رقم الفاتورة',
  subtotal: 'المجموع الفرعي',
  discount: 'الخصم',
  tax: 'الضريبة',
  total: 'الإجمالي',
  paid: 'المدفوع',
  remaining: 'المتبقي',
  issue_date: 'تاريخ الإصدار',
  payment_method: 'طريقة الدفع',
  reference: 'المرجع',

  // Purchase Orders
  po_number: 'رقم أمر الشراء',
  expected_delivery: 'تاريخ التسليم المتوقع',
  item_count: 'عدد الأصناف',
  received_qty: 'الكمية المستلمة',

  // HR
  emp_code: 'كود الموظف',
  full_name: 'الاسم الكامل',
  department: 'القسم',
  position: 'المنصب',
  base_salary: 'الراتب الأساسي',
  hire_date: 'تاريخ التعيين',
  days_worked: 'أيام العمل',
  overtime_hours: 'ساعات إضافية',
  base_pay: 'الراتب الأساسي',
  overtime_pay: 'أجر إضافي',
  housing_allowance: 'بدل سكن',
  transport_allowance: 'بدل مواصلات',
  food_allowance: 'بدل طعام',
  bonuses: 'مكافآت',
  gross_pay: 'إجمالي الاستحقاق',
  absence_deduction: 'خصم غياب',
  social_insurance: 'تأمينات',
  tax_deduction: 'ضريبة',
  total_deductions: 'إجمالي الخصومات',
  net_pay: 'صافي الراتب',

  // Machines / Maintenance
  machine_name: 'اسم الماكينة',
  machine_code: 'كود الماكينة',
  location: 'الموقع',
  maintenance_type: 'نوع الصيانة',
  maintenance_date: 'تاريخ الصيانة',
  maintenance_cost: 'تكلفة الصيانة',

  // Quality
  inspector: 'المفتش',
  result: 'النتيجة',
  defects: 'العيوب',
  pass_rate: 'معدل النجاح',
  stage_name: 'اسم المرحلة',

  // Accounting
  account_code: 'رقم الحساب',
  account_name: 'اسم الحساب',
  account_type: 'نوع الحساب',
  debit: 'مدين',
  credit: 'دائن',
  entry_number: 'رقم القيد',
  entry_date: 'تاريخ القيد',
  posted: 'مرحل',
  journal_description: 'وصف القيد',

  // Reports
  revenue: 'الإيرادات',
  cost: 'التكاليف',
  profit: 'الربح',
  margin: 'الهامش',
  month: 'الشهر',
  year: 'السنة',
  period: 'الفترة',
  count: 'العدد',
  average: 'المتوسط',
};

// Status translation map
export const STATUS_TRANSLATIONS = {
  draft: 'مسودة',
  pending: 'قيد الانتظار',
  in_progress: 'جاري التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  sent: 'مرسلة',
  partial: 'جزئي',
  received: 'مستلم',
  paid: 'مدفوعة',
  partially_paid: 'مدفوعة جزئياً',
  overdue: 'متأخرة',
  active: 'نشط',
  inactive: 'غير نشط',
  approved: 'معتمد',
  rejected: 'مرفوض',
  posted: 'مرحل',
  void: 'ملغي',
  confirmed: 'مؤكد',
  fulfilled: 'مُنفذ',
  expired: 'منتهي',
  accepted: 'مقبول',
  open: 'مفتوح',
  closed: 'مغلق',
};

// Priority translation map
export const PRIORITY_TRANSLATIONS = {
  low: 'منخفض',
  normal: 'عادي',
  high: 'عالي',
  urgent: 'عاجل',
};

// Module name translations
export const MODULE_TRANSLATIONS = {
  work_orders: 'أوامر الإنتاج',
  models: 'الموديلات',
  fabrics: 'الأقمشة',
  accessories: 'الاكسسوارات',
  invoices: 'الفواتير',
  customers: 'العملاء',
  suppliers: 'الموردين',
  purchase_orders: 'أوامر الشراء',
  hr: 'الموارد البشرية',
  payroll: 'الرواتب',
  reports: 'التقارير',
  exports: 'التصدير',
  quality: 'الجودة',
  machines: 'الماكينات',
  maintenance: 'الصيانة',
  scheduling: 'الجدولة',
  mrp: 'تخطيط الاحتياجات',
  quotations: 'عروض الأسعار',
  sales_orders: 'أوامر البيع',
  samples: 'العينات',
  returns: 'المرتجعات',
  shipping: 'الشحن',
  accounting: 'المحاسبة',
  expenses: 'المصروفات',
  documents: 'المستندات',
  backups: 'النسخ الاحتياطية',
  settings: 'الإعدادات',
  users: 'المستخدمون',
  audit: 'سجل المراجعة',
  inventory: 'المخزون',
  notifications: 'الإشعارات',
};

// Translate a column key to Arabic
export function translateColumn(key) {
  return COLUMN_TRANSLATIONS[key] || key;
}

// Translate status value to Arabic
export function translateStatus(status) {
  return STATUS_TRANSLATIONS[status] || status;
}
