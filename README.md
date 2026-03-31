# WK-Factory v3.0 — نظام إدارة المصنع الشامل 🏭

نظام ERP متكامل لإدارة مصانع الملابس — مبني بـ Node.js + Express + SQLite (backend) و React 19 + Vite + Tailwind CSS 4 (frontend) + Electron 41 (desktop).

## v3.2 — Enterprise Edition

| المرحلة | المحتوى |
|---------|---------|
| Core | المصادقة + الإنتاج + المحاسبة + التقارير + الإشعارات + الأمان |
| Schema V38 | 96+ جدول، 240+ إذن، 15 إعداد نظام |
| Backend | 34 ملف راوتر — MRP, Scheduling, Quality, Quotations, Samples, Shipping, Returns, Documents, Backups, Exports |
| Frontend | 56+ صفحة + 31 مكون — واجهات كاملة مع Dark Mode ولوحة تحكم قابلة للتخصيص |
| Electron | Electron 41 — تطبيق سطح مكتب مستقل مع أمان مشدد + Auto-updater |
| Security | Token blacklist, MIME validation, Request ID tracing, Input limits, RBAC, Rate limiting |
| v3.0 Enterprise | SSE notifications, Gantt, Financial stmts, Multi-warehouse, HR Leave, CRM, BI, PWA, Bulk import |
| v3.1 Hardening | Security hardening, DB migrations, API versioning, Swagger docs, CI/CD |
| v3.2 Hardening | WebSocket, i18n, a11y, Licensing, Sentry, Auto-updater, Structured logging, Type safety |

## إحصائيات المشروع

| البند | العدد |
|-------|-------|
| جداول قاعدة البيانات | **96+ جدول** (Schema V38) |
| صفحات الواجهة | **56+ صفحة** |
| مكونات مشتركة | **31+ مكون** |
| نقاط API | **290+ نقطة** |
| ملفات الراوتر | **34 ملف** |
| أدوار المستخدمين | **7 أدوار** مع 240+ إذن |
| اختبارات API | **89 اختبار** (100% pass) |
| اختبارات E2E | **27 اختبار** (100% pass) |
| إجمالي الكود | **~45,000 سطر** عبر 170+ ملف |

## ميزات v3.0 الجديدة

- **إشعارات فورية (SSE)**: Push notifications في الوقت الحقيقي لتغييرات أوامر العمل والفواتير والمخزون
- **رسم بياني جانت**: جدولة إنتاج تفاعلية مع كشف التعارضات
- **محاسبة مزدوجة كاملة**: قائمة الدخل، الميزانية العمومية، التدفق النقدي، تقادم المدينين والدائنين
- **مخزون متعدد المواقع**: مستودعات متعددة مع تقييم FIFO وتحويلات المخزون
- **إدارة الإجازات**: طلبات إجازة كاملة مع سير عمل الموافقة والهيكل التنظيمي
- **CRM متكامل**: تفاصيل العملاء مع الجدول الزمني وملاحظات وتحليل الربحية
- **تقارير ذكاء الأعمال**: لوحة تحكم تنفيذية مع 30+ تقرير وجدول محوري
- **استيراد مجمع**: معالج استيراد بيانات للموردين والعملاء والأقمشة والاكسسوارات
- **PWA**: دعم التطبيق التقدمي للوصول من الهاتف والتابلت
- **إدارة الجلسات**: مراقبة الجلسات النشطة مع إمكانية الإنهاء عن بعد
- **أمان محسن**: Token blacklist، MIME validation، Request ID tracing، Input limits

## المتطلبات

- Node.js v22+ (LTS)
- npm

## التثبيت والتشغيل

```bash
# تثبيت جميع المكتبات
npm run install:all

# تعبئة بيانات تجريبية
npm run seed

# تشغيل النظام (الخلفية على 9002 والواجهة على 9173)
npm run dev
```

أو يدوياً:

```bash
# الخلفية
cd backend && npm install && node seed.js && node server.js

# الواجهة (في terminal ثاني)
cd frontend && npm install && npm run dev
```

> **أول تشغيل**: ستظهر صفحة إعداد لإنشاء حساب المسؤول الأعلى (superadmin).

## هيكل المشروع

```
factory-system/
├── backend/                              # 22 ملف — 4,683 سطر
│   ├── server.js             (142 سطر)  # Express server + JWT auth + routes
│   ├── database.js           (797 سطر)  # SQLite schema v5 — 35 جدول
│   ├── seed.js               (1258 سطر) # بيانات تجريبية شاملة — 10 أوامر عمل، 10 أوامر شراء
│   ├── middleware/
│   │   └── auth.js           (58 سطر)   # JWT + requireAuth + requireRole + logAudit
│   ├── routes/
│   │   ├── auth.js           (93 سطر)   # تسجيل الدخول/الخروج + تغيير كلمة المرور
│   │   ├── users.js          (108 سطر)  # إدارة المستخدمين (superadmin فقط)
│   │   ├── hr.js             (662 سطر)  # الموظفين + الحضور + الرواتب + التعديلات
│   │   ├── auditlog.js       (33 سطر)   # سجل المراجعة
│   │   ├── reports.js        (420 سطر)  # مركز التقارير + Pivot + HR Summary
│   │   ├── fabrics.js        (101 سطر)  # CRUD الأقمشة + audit log
│   │   ├── accessories.js    (59 سطر)   # CRUD الاكسسوارات + audit log
│   │   ├── models.js         (248 سطر)  # CRUD الموديلات + BOM + audit log
│   │   ├── invoices.js       (165 سطر)  # نظام الفواتير + audit log
│   │   ├── workorders.js     (646 سطر)  # أوامر العمل + المراحل + audit log
│   │   ├── suppliers.js      (110 سطر)  # الموردين + المدفوعات + audit log
│   │   ├── purchaseorders.js (219 سطر)  # أوامر الشراء + audit log
│   │   ├── settings.js       (89 سطر)   # إعدادات النظام + audit log
│   │   ├── stagetemplates.js (56 سطر)   # قوالب المراحل
│   │   └── inventory.js      (55 سطر)   # استعلامات المخزون
│   └── tests/
│       └── api.test.js       (246 سطر)  # اختبارات API
│
├── frontend/                             # 51 ملف — 9,000 سطر
│   └── src/
│       ├── App.jsx                (225 سطر)  # التوجيه + الصلاحيات + التخطيط
│       ├── main.jsx               (9 سطر)
│       ├── index.css              (21 سطر)
│       │
│       ├── context/
│       │   └── AuthContext.jsx    (94 سطر)   # JWT auth + roles + login/logout
│       │
│       ├── utils/
│       │   ├── api.js             (24 سطر)   # Axios instance + interceptors
│       │   └── exportExcel.js     (56 سطر)   # تصدير Excel عام + رواتب
│       │
│       ├── hooks/
│       │   ├── useWorkOrder.js    (75 سطر)   # hook أوامر العمل
│       │   └── useCostCalc.js     (60 سطر)   # hook حساب التكاليف
│       │
│       ├── pages/
│       │   ├── Login.jsx          (76 سطر)   # تسجيل الدخول
│       │   ├── Setup.jsx          (92 سطر)   # إعداد أول مسؤول
│       │   ├── Dashboard.jsx      (166 سطر)  # لوحة التحكم + HR KPIs
│       │   ├── Users.jsx          (235 سطر)  # إدارة المستخدمين
│       │   ├── AuditLog.jsx       (157 سطر)  # سجل المراجعة
│       │   ├── ModelsList.jsx     (126 سطر)  # قائمة الموديلات
│       │   ├── ModelForm.jsx      (225 سطر)  # نموذج الموديل + BOM
│       │   ├── Fabrics.jsx        (277 سطر)  # إدارة الأقمشة
│       │   ├── FabricInventory.jsx(150 سطر)  # مخزون الأقمشة
│       │   ├── Accessories.jsx    (251 سطر)  # إدارة الاكسسوارات
│       │   ├── BomTemplates.jsx   (379 سطر)  # قوالب BOM
│       │   ├── Invoices.jsx       (434 سطر)  # إدارة الفواتير
│       │   ├── InvoiceView.jsx    (173 سطر)  # عرض الفاتورة
│       │   ├── InvoicePrint.jsx   (259 سطر)  # طباعة فاتورة A4
│       │   ├── WorkOrdersList.jsx (198 سطر)  # قائمة أوامر العمل
│       │   ├── WorkOrderForm.jsx  (595 سطر)  # نموذج أمر العمل
│       │   ├── WorkOrderDetail.jsx(436 سطر)  # تفاصيل أمر العمل
│       │   ├── Suppliers.jsx      (283 سطر)  # إدارة الموردين
│       │   ├── PurchaseOrders.jsx (350 سطر)  # أوامر الشراء
│       │   ├── Reports.jsx        (935 سطر)  # مركز التقارير + PivotTable
│       │   ├── PrintView.jsx      (218 سطر)  # طباعة الموديل
│       │   ├── Settings.jsx       (163 سطر)  # الإعدادات
│       │   └── HR/
│       │       ├── Employees.jsx  (322 سطر)  # إدارة الموظفين
│       │       ├── Attendance.jsx (195 سطر)  # الحضور والانصراف
│       │       ├── Payroll.jsx    (271 سطر)  # مسيرات الرواتب
│       │       └── PaySlip.jsx    (141 سطر)  # كشف راتب قابل للطباعة
│       │
│       └── components/
│           ├── GlobalSearch.jsx       (124 سطر)  # بحث شامل (Ctrl+K)
│           ├── BomVariantTabs.jsx     (284 سطر)  # تبويبات المتغيرات
│           ├── BomTemplateLoader.jsx  (66 سطر)   # تحميل قوالب BOM
│           ├── FabricSearchDropdown.jsx(159 سطر) # اختيار الأقمشة
│           ├── FabricBlock.jsx        (117 سطر)  # كتلة القماش في BOM
│           ├── SizeGrid.jsx           (96 سطر)   # مصفوفة المقاسات/الألوان
│           ├── AccessoryTable.jsx     (98 سطر)   # جدول الاكسسوارات
│           ├── CostPanel.jsx          (93 سطر)   # لوحة التكاليف
│           ├── SupplierSelect.jsx     (65 سطر)   # اختيار المورد
│           ├── StageChecklist.jsx     (44 سطر)   # قائمة مراحل الإنتاج
│           ├── StatusBadge.jsx        (34 سطر)   # شارات الحالة
│           ├── PriorityBadge.jsx      (12 سطر)   # شارات الأولوية
│           ├── ImageUpload.jsx        (36 سطر)   # رفع الصور
│           └── Toast.jsx              (41 سطر)   # الإشعارات
│
├── electron.js                (111 سطر)  # غلاف Electron Desktop
├── package.json                           # تبعيات الجذر + scripts
└── README.md                              # هذا الملف
```

## نظام المصادقة والصلاحيات (v5 جديد)

### أنواع المستخدمين (6 أدوار)

| الدور | الصلاحيات |
|-------|-----------|
| `superadmin` | كل شيء — إدارة المستخدمين، سجل المراجعة، جميع الأقسام |
| `manager` | كل شيء ما عدا إدارة المستخدمين |
| `accountant` | المالية: الفواتير، الموردين، أوامر الشراء، التقارير المالية |
| `production` | الإنتاج: أوامر العمل، الموديلات، الأقمشة، الاكسسوارات |
| `hr` | الموارد البشرية: الموظفين، الحضور، الرواتب |
| `viewer` | عرض فقط — جميع الصفحات بدون تعديل |

### آلية المصادقة

- **JWT Token** — صلاحية 24 ساعة
- **bcrypt** — تشفير كلمات المرور (12 rounds)
- **Bearer Header** — إرسال التوكن مع كل طلب
- **Auto-redirect** — إعادة توجيه تلقائية عند انتهاء الجلسة (401)
- **إعداد أولي** — صفحة إنشاء أول مسؤول عند أول تشغيل

## الصفحات والمسارات

### صفحات عامة (بدون تسجيل)

| الصفحة | المسار | الوصف |
|--------|--------|-------|
| تسجيل الدخول | `/login` | تسجيل الدخول بالبريد وكلمة المرور |
| إعداد النظام | `/setup` | إنشاء أول حساب مسؤول (أول تشغيل فقط) |

### صفحات محمية (تتطلب تسجيل الدخول)

| الصفحة | المسار | الأدوار المسموحة |
|--------|--------|-----------------|
| لوحة التحكم | `/dashboard` | الكل |
| الموديلات | `/models` | superadmin, manager, production, viewer |
| موديل جديد | `/models/new` | superadmin, manager, production |
| تعديل موديل | `/models/:code/edit` | superadmin, manager, production |
| الأقمشة | `/fabrics` | superadmin, manager, production, viewer |
| مخزون الأقمشة | `/fabric-inventory` | superadmin, manager, production, viewer |
| الاكسسوارات | `/accessories` | superadmin, manager, production, viewer |
| قوالب BOM | `/bom-templates` | superadmin, manager, production |
| أوامر العمل | `/work-orders` | superadmin, manager, production, viewer |
| أمر عمل جديد | `/work-orders/new` | superadmin, manager, production |
| تفاصيل أمر العمل | `/work-orders/:id` | superadmin, manager, production, viewer |
| الفواتير | `/invoices` | superadmin, manager, accountant, viewer |
| عرض فاتورة | `/invoices/:id/view` | superadmin, manager, accountant, viewer |
| الموردين | `/suppliers` | superadmin, manager, accountant, viewer |
| أوامر الشراء | `/purchase-orders` | superadmin, manager, accountant, viewer |
| مركز التقارير | `/reports` | superadmin, manager, accountant, viewer |
| الموظفين | `/hr/employees` | superadmin, manager, hr |
| الحضور | `/hr/attendance` | superadmin, manager, hr |
| الرواتب | `/hr/payroll` | superadmin, manager, hr |
| كشف الراتب | `/hr/payslip/:periodId/:employeeId` | superadmin, manager, hr |
| المستخدمين | `/users` | superadmin |
| سجل المراجعة | `/audit-log` | superadmin, manager |
| الإعدادات | `/settings` | superadmin, manager |

## قاعدة البيانات — 87 جدول (Schema V23)

### جداول أساسية (v1-v14)
`settings`, `fabrics`, `accessories`, `models`, `model_fabrics`, `model_fabric_consumption`, `model_accessories`, `model_sizes`, `model_size_quantities`, `model_images`, `bom_templates`, `bom_template_fabrics`, `bom_template_accessories`, `invoices`, `invoice_items`, `work_orders`, `work_order_models`, `wo_model_sizes`, `wo_model_fabrics`, `wo_model_accessories`, `wo_stages`, `wo_cost_snapshots`, `stage_templates`, `suppliers`, `supplier_payments`, `purchase_orders`, `purchase_order_items`, `users`, `audit_log`, `employees`, `attendance`, `attendance_imports`, `payroll_periods`, `payroll_records`, `hr_adjustments`, `customers`, `customer_payments`, `fabric_batches`, `machines`, `maintenance_records`, `leave_requests`, `notifications`

### جداول V23 الجديدة (20+ جدول)

| الجدول | الوصف |
|--------|-------|
| `quotations` + `quotation_items` | عروض الأسعار |
| `sales_orders` + `sales_order_items` | أوامر البيع |
| `samples` | إدارة العينات |
| `shipments` + `packing_lists` | الشحن والتغليف |
| `sales_returns` + `sales_return_items` | مرتجعات المبيعات |
| `purchase_returns` + `purchase_return_items` | مرتجعات المشتريات |
| `qc_templates` + `qc_template_items` | قوالب فحص الجودة |
| `qc_inspections` + `qc_inspection_items` | فحوصات الجودة |
| `qc_ncr` | تقارير عدم المطابقة |
| `qc_defect_codes` | أكواد العيوب |
| `mrp_runs` + `mrp_suggestions` | تخطيط الموارد |
| `production_lines` + `production_schedule` | خطوط وجدولة الإنتاج |
| `expenses` | المصروفات |
| `documents` | إدارة المستندات |
| `backups` | النسخ الاحتياطي |
| `permissions` | نظام الأذونات (240 إذن) |

## API Endpoints

### المصادقة `/api/auth` (عام)
- `POST /login` — تسجيل الدخول → JWT token
- `POST /logout` — تسجيل الخروج
- `GET /me` — بيانات المستخدم الحالي
- `PUT /change-password` — تغيير كلمة المرور

### الإعداد `/api/setup` (عام)
- `GET /status` — هل يوجد مسؤول؟
- `POST /create-admin` — إنشاء أول مسؤول (مرة واحدة فقط)

### المستخدمين `/api/users` (superadmin فقط)
- `GET /` — قائمة المستخدمين
- `POST /` — إنشاء مستخدم جديد
- `GET /:id` — تفاصيل مستخدم
- `PUT /:id` — تحديث مستخدم
- `PATCH /:id/reset-password` — إعادة تعيين كلمة المرور
- `DELETE /:id` — تعطيل مستخدم (soft delete)

### الموارد البشرية `/api/hr`

#### الموظفين
- `GET /employees` — القائمة مع KPIs (إجمالي، شهري، يومي، بالقطعة)
- `GET /employees/next-code` — الكود التالي
- `POST /employees` — إنشاء موظف
- `GET /employees/:id` — تفاصيل + حضور + رواتب + تعديلات
- `PUT /employees/:id` — تحديث
- `DELETE /employees/:id` — تعطيل (soft delete)

#### الحضور
- `POST /attendance/import` — استيراد من Excel (يدعم شكلين A و B)
- `GET /attendance` — بيانات الحضور (فلتر بالشهر والموظف)
- `GET /attendance/summary/:month` — ملخص شهري
- `PUT /attendance/:id` — تعديل سجل حضور
- `POST /attendance/bulk` — إدخال جماعي

#### الرواتب
- `GET /payroll/periods` — فترات الرواتب
- `POST /payroll/periods` — إنشاء فترة
- `POST /payroll/calculate/:periodId` — حساب الرواتب (يدعم: شهري، يومي، بالساعة، بالقطعة)
- `GET /payroll/:periodId` — تفاصيل الفترة مع السجلات
- `PATCH /payroll/:periodId/approve` — اعتماد
- `PATCH /payroll/:periodId/pay` — صرف
- `GET /payroll/payslip/:periodId/:employeeId` — كشف الراتب

#### التعديلات
- `POST /adjustments` — إضافة تعديل (مكافأة/خصم/سلفة)
- `GET /adjustments/:employeeId` — تعديلات موظف

### سجل المراجعة `/api/audit-log` (superadmin + manager)
- `GET /` — السجل مع فلاتر (user_id, action, entity_type, dates, search) + pagination

### التقارير `/api/reports`
- `GET /summary` — ملخص عام (KPIs)
- `GET /by-model` — تقرير حسب الموديل
- `GET /by-fabric` — تقرير حسب القماش
- `GET /by-accessory` — تقرير حسب الاكسسوار
- `GET /costs` — تحليل تكاليف مفصل
- `GET /pivot` — جدول محوري ديناميكي (4 مصادر: إنتاج، مالي، موارد بشرية، مخزون)
- `GET /hr-summary` — ملخص الموارد البشرية (KPIs + أقسام + أنواع الرواتب)

### الأقمشة `/api/fabrics`
- `GET /` — قائمة الأقمشة (يدعم `?type=main|lining`)
- `POST /` — إضافة قماش + audit log
- `PUT /:code` — تعديل + audit log
- `DELETE /:code` — حذف (soft delete) + audit log

### الاكسسوارات `/api/accessories`
- `GET /` — قائمة الاكسسوارات
- `POST /` — إضافة + audit log
- `PUT /:code` — تعديل + audit log
- `DELETE /:code` — حذف (soft delete) + audit log

### الموديلات `/api/models`
- `GET /` — قائمة الموديلات (يدعم `?search=`)
- `GET /next-serial` — اقتراح الكود التالي
- `GET /:code` — تفاصيل الموديل مع BOM كامل
- `GET /:code/cost` — حساب التكلفة
- `POST /` — إنشاء موديل + audit log
- `PUT /:code` — تعديل + audit log
- `DELETE /:code` — حذف (soft delete) + audit log

### الفواتير `/api/invoices`
- `GET /` — قائمة (يدعم `?search=&status=&date_from=&date_to=`)
- `GET /next-number` — رقم الفاتورة التالي
- `GET /:id` — فاتورة مع البنود
- `POST /` — إنشاء فاتورة + audit log
- `PUT /:id` — تعديل + audit log
- `DELETE /:id` — حذف + audit log

### أوامر العمل `/api/workorders`
- `GET /` — القائمة
- `GET /next-number` — الرقم التالي
- `GET /:id` — التفاصيل
- `POST /` — إنشاء + audit log
- `PUT /:id/stage` — تحديث مرحلة
- `DELETE /:id` — إلغاء + audit log

### الموردين `/api/suppliers`
- `GET /` — القائمة
- `POST /` — إنشاء + audit log
- `PUT /:id` — تعديل + audit log
- `POST /:id/payments` — إضافة دفعة + audit log
- `DELETE /:id` — تعطيل + audit log

### أوامر الشراء `/api/purchaseorders`
- `GET /` — القائمة
- `POST /` — إنشاء + audit log
- `PUT /:id` — تعديل + audit log

### بحث شامل `/api/search`
- `GET /?q=` — بحث عبر الموديلات والأقمشة والاكسسوارات والفواتير

### الإعدادات `/api/settings`
- `GET /` — قراءة الإعدادات
- `PUT /` — تحديث الإعدادات + audit log

### لوحة التحكم `/api/dashboard`
- `GET /` — إحصائيات + آخر الموديلات

### عروض الأسعار `/api/quotations` (V23 جديد)
- `GET /` — قائمة عروض الأسعار مع فلاتر وصفحات
- `GET /:id` — تفاصيل عرض سعر مع البنود
- `POST /` — إنشاء عرض سعر + بنود
- `PUT /:id` — تعديل عرض سعر
- `DELETE /:id` — إلغاء عرض سعر
- `POST /:id/convert-to-so` — تحويل لأمر بيع

### أوامر البيع `/api/quotations/sales-orders` (V23 جديد)
- `GET /list` — قائمة أوامر البيع
- `GET /:id` — تفاصيل أمر بيع مع البنود
- `PUT /:id` — تعديل أمر بيع
- `POST /:id/convert-to-wo` — تحويل لأمر عمل
- `PATCH /:id/status` — تحديث حالة أمر البيع

### العينات `/api/samples` (V23 جديد)
- `GET /` — قائمة العينات
- `GET /next-number` — رقم العينة التالي
- `GET /:id` — تفاصيل عينة
- `POST /` — إنشاء عينة
- `PUT /:id` — تعديل عينة
- `POST /:id/convert-to-wo` — تحويل لأمر عمل
- `DELETE /:id` — إلغاء عينة

### الشحن `/api/shipping` (V23 جديد)
- `GET /` — قائمة الشحنات
- `GET /next-number` — رقم الشحنة التالي
- `GET /:id` — تفاصيل شحنة مع قوائم التعبئة
- `POST /` — إنشاء شحنة
- `PUT /:id` — تعديل شحنة
- `PATCH /:id/status` — تحديث حالة الشحنة

### المرتجعات `/api/returns` (V23 جديد)
- `GET /sales` — مرتجعات المبيعات
- `POST /sales` — إنشاء مرتجع مبيعات
- `GET /sales/:id` — تفاصيل مرتجع مبيعات
- `PATCH /sales/:id/approve` — اعتماد مرتجع مبيعات
- `GET /purchases` — مرتجعات المشتريات
- `POST /purchases` — إنشاء مرتجع مشتريات
- `GET /purchases/:id` — تفاصيل مرتجع مشتريات
- `PATCH /purchases/:id/approve` — اعتماد مرتجع مشتريات

### ضمان الجودة `/api/quality` (V23 جديد)
- `GET /templates` — قوالب الفحص
- `POST /templates` — إنشاء قالب فحص
- `GET /templates/:id` — تفاصيل قالب مع البنود
- `PUT /templates/:id` — تعديل قالب
- `DELETE /templates/:id` — حذف قالب
- `GET /defect-codes` — أكواد العيوب
- `POST /defect-codes` — إنشاء كود عيب
- `GET /inspections` — قائمة الفحوصات
- `POST /inspections` — إنشاء فحص جديد
- `GET /inspections/:id` — تفاصيل فحص
- `PATCH /inspections/:id/complete` — إكمال فحص
- `GET /ncr` — تقارير عدم المطابقة
- `POST /ncr` — إنشاء تقرير NCR
- `PATCH /ncr/:id` — تحديث تقرير NCR

### تخطيط الموارد `/api/mrp` (V23 جديد)
- `GET /` — قائمة تشغيلات MRP
- `GET /:id` — تفاصيل تشغيل مع الاقتراحات
- `POST /calculate` — تشغيل حساب MRP
- `POST /:id/auto-po` — إنشاء أوامر شراء تلقائية

### جدولة الإنتاج `/api/scheduling` (V23 جديد)
- `GET /` — جدول الإنتاج (Gantt)
- `GET /lines` — خطوط الإنتاج
- `POST /lines` — إنشاء خط إنتاج
- `PUT /lines/:id` — تعديل خط إنتاج
- `GET /capacity` — سعة الخطوط
- `POST /` — إنشاء جدولة
- `PUT /:id` — تعديل جدولة

### المصروفات `/api/expenses` (V23 جديد)
- `GET /` — قائمة المصروفات
- `POST /` — إنشاء مصروف
- `GET /:id` — تفاصيل مصروف
- `PUT /:id` — تعديل مصروف
- `PATCH /:id/approve` — اعتماد مصروف

### المستندات `/api/documents` (V23 جديد)
- `GET /` — قائمة المستندات
- `POST /upload` — رفع مستند
- `GET /:id` — تفاصيل مستند
- `PUT /:id` — تعديل عنوان/تصنيف
- `DELETE /:id` — حذف مستند

### النسخ الاحتياطي `/api/backups` (V23 جديد)
- `GET /` — قائمة النسخ الاحتياطية
- `POST /` — إنشاء نسخة احتياطية
- `POST /:id/restore` — طلب استعادة
- `DELETE /:id` — حذف نسخة احتياطية

## مركز التقارير المتقدم (v5)

### 12 تبويب تقارير

| التبويب | الوصف |
|---------|-------|
| الملخص | KPIs عامة للمصنع |
| حسب الموديل | تقرير تفصيلي بالموديلات |
| حسب القماش | تقرير استهلاك الأقمشة |
| حسب الاكسسوار | تقرير استهلاك الاكسسوارات |
| التكاليف | تحليل التكاليف مع رسوم بيانية |
| أوامر العمل | تقرير أوامر العمل |
| المبيعات | تقرير المبيعات والفواتير |
| الموردين | تقرير الموردين والمشتريات |
| المشتريات | تقرير أوامر الشراء |
| المخزون | تقرير مخزون الأقمشة والاكسسوارات |
| الموارد البشرية | KPIs الموظفين + توزيع الأقسام + أنواع الرواتب |
| جدول محوري | PivotTable ديناميكي |

### الجدول المحوري (PivotTable)

- **4 مصادر بيانات**: إنتاج، مالي، موارد بشرية، مخزون
- **5 دوال تجميع**: مجموع، متوسط، عدد، أقل، أكبر
- **حقول الصفوف والأعمدة**: ديناميكية حسب المصدر
- **خريطة حرارية**: ألوان تلقائية حسب القيم
- **صف/عمود الإجماليات**: حسابات تلقائية
- **تصدير Excel**: تصدير الجدول المحوري بالكامل

## نظام الموارد البشرية (v5 جديد)

### إدارة الموظفين
- بيانات كاملة: الكود، الاسم، القسم، المسمى الوظيفي، تاريخ التعيين
- 4 أنواع رواتب: شهري (`monthly`)، يومي (`daily`)، بالساعة (`hourly`)، بالقطعة (`piece_work`)
- بدلات: سكن، مواصلات، طعام، أخرى
- خصومات: تأمينات، ضرائب، أخرى
- بيانات بنكية: اسم البنك، رقم الحساب (IBAN)
- بطاقات KPI: إجمالي، شهري، يومي، بالقطعة

### نظام الحضور
- شبكة شهرية: الموظفين × الأيام (1-31)
- ألوان حسب الحالة: حاضر (أخضر)، غائب (أحمر)، متأخر (أصفر)، نصف يوم (أزرق)، إجازة (بنفسجي)، عطلة (رمادي)
- استيراد من Excel (يدعم شكلين مختلفين للملف)
- ساعات العمل الإضافية: حساب تلقائي (GENERATED column)

### نظام الرواتب
- فترات الرواتب: إنشاء، حساب، اعتماد، صرف
- حساب تلقائي حسب نوع الراتب:
  - **شهري**: الراتب الأساسي × (أيام العمل / أيام الشهر)
  - **يومي**: أجر اليوم × أيام العمل
  - **بالساعة**: أجر الساعة × ساعات العمل
  - **بالقطعة**: أجر القطعة × الكمية
- البدلات والخصومات والتعديلات تُحسب تلقائياً
- كشف راتب قابل للطباعة (عربي) مع الأرباح والخصومات جنباً إلى جنب
- تصدير Excel بـ 17 عمود + صف الإجماليات

### التعديلات
- 3 أنواع: مكافأة (`bonus`)، خصم (`deduction`)، سلفة (`advance`)
- تُضاف تلقائياً عند حساب الرواتب

## سجل المراجعة (Audit Log — v5 جديد)

- تسجيل تلقائي لكل عملية: إنشاء، تعديل، حذف
- تتبع القيم القديمة والجديدة (diff view)
- فلاتر: المستخدم، نوع العملية، نوع الكيان، نطاق التاريخ، بحث نصي
- شارات ملونة حسب نوع العملية
- عرض موسع للتغييرات (expandable diff)
- ترقيم الصفحات (50 سجل/صفحة)
- تصدير Excel

## معادلة حساب التكلفة

```
تكلفة القماش الأساسي = أمتار × سعر المتر × (1 + نسبة الهدر%)
تكلفة البطانة       = أمتار × سعر المتر
تكلفة الاكسسوارات   = مجموع (الكمية × سعر الوحدة)
تكلفة القطعة        = (أقمشة + بطانة + اكسسوارات + مصنعية + مصروف) / عدد القطع
سعر البيع           = تكلفة القطعة × (1 + هامش الربح%)
```

## المميزات

### Core (v1-v4)
- **BOM كامل**: قماش أساسي + بطانة + اكسسوارات لكل موديل
- **مصفوفة المقاسات**: ألوان × مقاسات مع حساب تلقائي للقطع
- **نظام الفواتير**: إنشاء، إرسال، تتبع (مسودة/مُرسلة/مدفوعة/متأخرة/ملغاة)
- **أوامر العمل**: مراحل إنتاج + متابعة + لقطات تكاليف
- **الموردين**: إدارة + مدفوعات + أرصدة
- **أوامر الشراء**: إنشاء + متابعة + ربط بالموردين
- **طباعة A4**: فواتير وموديلات جاهزة للطباعة
- **بحث شامل**: Ctrl+K للبحث عبر كل الكيانات
- **تقارير متقدمة**: 10 تبويبات + رسوم بيانية + فلاتر
- **تصميم RTL**: واجهة عربية كاملة بخط Cairo

### Enterprise (v5 جديد)
- **نظام المصادقة**: JWT + bcrypt + 6 أدوار + صلاحيات دقيقة
- **إدارة المستخدمين**: إنشاء، تعديل، تعطيل، إعادة كلمة المرور
- **الموارد البشرية**: موظفين + حضور + رواتب + تعديلات
- **كشوف الرواتب**: حساب تلقائي + 4 أنواع رواتب + طباعة
- **الحضور**: شبكة شهرية + استيراد Excel + ألوان
- **سجل المراجعة**: تتبع كل تغيير مع القيم القديمة/الجديدة
- **جدول محوري**: PivotTable ديناميكي + 4 مصادر + 5 دوال + خريطة حرارية
- **تصدير Excel**: كل الصفحات تدعم التصدير (xlsx/SheetJS)
- **لوحة تحكم ذكية**: KPIs حسب الدور + ترحيب + بطاقات HR

### Production Flow (v7 جديد)
- **لوحة WIP موحدة**: مراحل + كميات + تمرير في مكان واحد
- **تمرير القطع**: نقل القطع بين المراحل مع تتبع الكميات الناجحة والمرفوضة
- **سجل التحركات**: تاريخ كامل لكل حركة مع اسم المستخدم والوقت
- **حماية التجاوز**: لا يمكن تمرير أكثر من المتاح في المرحلة
- **تهيئة تلقائية**: المرحلة الأولى تأخذ كمية أمر الشغل تلقائياً
- **إكمال تلقائي**: المرحلة تكتمل عند تمرير كل القطع
- **فحص سلامة الكميات**: تحقق من توازن الكميات (إجمالي = في المراحل + مكتمل + مرفوض)
- **شريط تقدم بالقطع**: التقدم محسوب بالقطع المنتهية وليس بعدد المراحل

## التقنيات

| الطبقة | التقنية |
|--------|---------|
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) — WAL mode |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Frontend | React 19 + Vite |
| Styling | TailwindCSS v4 |
| Charts | Chart.js + react-chartjs-2 |
| Icons | Lucide React |
| HTTP Client | Axios (with interceptors) |
| Excel | xlsx (SheetJS) — backend + frontend |
| File Upload | Multer |
| Desktop | Electron 41 |
| Testing | Node.js built-in test runner |

## الاختبارات

```bash
cd backend && node --test tests/api.test.js
```

## اختصارات لوحة المفاتيح

| الاختصار | الوظيفة |
|----------|---------|
| `Ctrl+K` | البحث الشامل |
| `ESC` | إغلاق النوافذ المنبثقة |

## سجل الإصدارات

| الإصدار | الوصف |
|---------|-------|
| v1.0 | الأساسيات: موديلات + أقمشة + اكسسوارات + BOM + تكاليف |
| v2.0 | الفواتير + التقارير + البحث الشامل + الإعدادات |
| v3.0 (old) | أوامر العمل + المراحل + الموردين + أوامر الشراء + المخزون |
| v4.0 | قوالب BOM + تحسينات التقارير + Electron Desktop |
| v5.0 | المصادقة + المستخدمين + الموارد البشرية + الرواتب + الحضور + سجل المراجعة + الجدول المحوري + تصدير Excel |
| v6.0 | نظام الصلاحيات الدقيقة — 3 جداول + 6 endpoints + واجهة مصفوفة الصلاحيات + بيانات تجريبية شاملة |
| v7.0 | لوحة WIP موحدة — تمرير القطع بين المراحل + سجل التحركات + حماية التجاوز + فحص سلامة الكميات |
| v12.0 | Enterprise Enhancement — 8 مراحل: أمان، محاسبة، إشعارات، تقارير متقدمة، UX، DevOps |
| v2.1 | Production audit — 11 تقارير تدقيق + 5 إصلاحات + Electron packaging |
| **v3.0** | **Enterprise Edition — SSE notifications, Gantt, Financial stmts, Multi-warehouse, HR Leave, CRM, BI, PWA, Bulk import, Token blacklist, 80 tests** |

---

**WK-Factory** v3.0.0 — نظام إدارة المصنع المتكامل | 96 جدول | 290+ API | 56 صفحة | 80 اختبار
