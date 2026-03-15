# WK-Hub — نظام إدارة المصنع 🏭

نظام ERP متكامل لإدارة مصانع الملابس. يشمل إدارة الموديلات، الأقمشة، الاكسسوارات، حساب التكاليف، الفواتير، والتقارير.

## المتطلبات

- Node.js v18+
- npm

## التثبيت والتشغيل

```bash
# تثبيت جميع المكتبات
npm run install:all

# تعبئة بيانات تجريبية
npm run seed

# تشغيل النظام (الخلفية على 3001 والواجهة على 5173)
npm run dev
```

أو يدوياً:

```bash
# الخلفية
cd backend && npm install && node seed.js && node server.js

# الواجهة (في terminal ثاني)
cd frontend && npm install && npm run dev
```

## هيكل المشروع

```
factory-system/
├── backend/
│   ├── server.js          # Express server + API endpoints
│   ├── database.js        # SQLite schema (better-sqlite3)
│   ├── seed.js            # بيانات تجريبية
│   ├── routes/
│   │   ├── fabrics.js     # CRUD الأقمشة
│   │   ├── accessories.js # CRUD الاكسسوارات
│   │   ├── models.js      # CRUD الموديلات + BOM
│   │   ├── costs.js       # تقارير التكاليف
│   │   ├── invoices.js    # نظام الفواتير
│   │   └── settings.js    # إعدادات النظام
│   └── tests/
│       └── api.test.js    # 26 اختبار API
├── frontend/
│   └── src/
│       ├── App.jsx                    # التوجيه والتخطيط الرئيسي
│       ├── pages/
│       │   ├── Dashboard.jsx          # لوحة التحكم + KPIs
│       │   ├── ModelsList.jsx         # قائمة الموديلات
│       │   ├── ModelForm.jsx          # نموذج الموديل + BOM كامل
│       │   ├── Fabrics.jsx            # إدارة الأقمشة
│       │   ├── Accessories.jsx        # إدارة الاكسسوارات
│       │   ├── Invoices.jsx           # إدارة الفواتير
│       │   ├── InvoiceView.jsx        # عرض وطباعة الفاتورة (A4)
│       │   ├── InvoicePrint.jsx       # طباعة فاتورة الموديل
│       │   ├── Reports.jsx            # التقارير والتحليلات
│       │   ├── PrintView.jsx          # طباعة الموديل
│       │   └── Settings.jsx           # الإعدادات
│       └── components/
│           ├── GlobalSearch.jsx       # بحث شامل (Ctrl+K)
│           ├── FabricSearchDropdown.jsx # اختيار الأقمشة
│           ├── FabricBlock.jsx        # كتلة القماش في BOM
│           ├── SizeGrid.jsx           # مصفوفة المقاسات/الألوان
│           ├── AccessoryTable.jsx     # جدول الاكسسوارات
│           ├── CostPanel.jsx          # لوحة التكاليف
│           ├── ImageUpload.jsx        # رفع الصور
│           └── Toast.jsx              # الإشعارات
└── package.json
```

## الصفحات والمسارات

| الصفحة | المسار | الوصف |
|--------|--------|-------|
| لوحة التحكم | `/dashboard` | إحصائيات عامة ومؤشرات الأداء |
| الموديلات | `/models` | قائمة جميع الموديلات |
| موديل جديد | `/models/new` | إنشاء موديل مع BOM كامل |
| تعديل موديل | `/models/:code/edit` | تعديل موديل وتكاليفه |
| الأقمشة | `/fabrics` | إضافة وإدارة الأقمشة |
| الاكسسوارات | `/accessories` | إضافة وإدارة الاكسسوارات |
| التقارير | `/reports` | تقارير حسب الموديل/القماش/الاكسسوار + تحليل التكاليف |
| الفواتير | `/invoices` | إنشاء وإدارة الفواتير |
| عرض فاتورة | `/invoices/:id/view` | عرض وطباعة فاتورة A4 + تصدير CSV |
| الإعدادات | `/settings` | المصنعية، المصروف، نسبة الهدر، هامش الربح |

## API Endpoints

### الأقمشة `/api/fabrics`
- `GET /` — قائمة الأقمشة (يدعم `?type=main|lining`)
- `POST /` — إضافة قماش
- `PUT /:code` — تعديل
- `DELETE /:code` — حذف (soft delete)

### الاكسسوارات `/api/accessories`
- `GET /` — قائمة الاكسسوارات
- `POST /` — إضافة
- `PUT /:code` — تعديل
- `DELETE /:code` — حذف (soft delete)

### الموديلات `/api/models`
- `GET /` — قائمة الموديلات (يدعم `?search=`)
- `GET /next-serial` — اقتراح الكود التالي
- `GET /:code` — تفاصيل الموديل مع BOM كامل
- `GET /:code/cost` — حساب التكلفة
- `POST /` — إنشاء موديل مع الأقمشة والاكسسوارات
- `PUT /:code` — تعديل
- `DELETE /:code` — حذف (soft delete)

### الفواتير `/api/invoices`
- `GET /` — قائمة (يدعم `?search=&status=&date_from=&date_to=`)
- `GET /next-number` — رقم الفاتورة التالي
- `GET /:id` — فاتورة مع البنود
- `POST /` — إنشاء فاتورة
- `PUT /:id` — تعديل
- `PATCH /:id/status` — تحديث الحالة
- `DELETE /:id` — حذف

### التقارير `/api/reports`
- `GET /summary` — ملخص عام (KPIs)
- `GET /by-model` — تقرير حسب الموديل (يدعم `?search=&date_from=&date_to=`)
- `GET /by-fabric` — تقرير حسب القماش
- `GET /by-accessory` — تقرير حسب الاكسسوار
- `GET /costs` — تحليل تكاليف مفصل

### بحث شامل `/api/search`
- `GET /?q=` — بحث عبر الموديلات والأقمشة والاكسسوارات والفواتير

### الإعدادات `/api/settings`
- `GET /` — قراءة الإعدادات
- `PUT /` — تحديث الإعدادات

### لوحة التحكم `/api/dashboard`
- `GET /` — إحصائيات + آخر الموديلات

## معادلة حساب التكلفة

```
تكلفة القماش الأساسي = أمتار × سعر المتر × (1 + نسبة الهدر%)
تكلفة البطانة       = أمتار × سعر المتر
تكلفة الاكسسوارات   = مجموع (الكمية × سعر الوحدة)
تكلفة القطعة        = (أقمشة + بطانة + اكسسوارات + مصنعية + مصروف) / عدد القطع
سعر البيع           = تكلفة القطعة × (1 + هامش الربح%)
```

## المميزات

- **BOM كامل**: قماش أساسي + بطانة + اكسسوارات لكل موديل
- **مصفوفة المقاسات**: ألوان × مقاسات مع حساب تلقائي للقطع
- **نظام الفواتير**: إنشاء، إرسال، تتبع (مسودة/مُرسلة/مدفوعة/متأخرة/ملغاة)
- **طباعة A4**: فواتير وموديلات جاهزة للطباعة
- **تصدير CSV**: جميع التقارير والفواتير
- **بحث شامل**: Ctrl+K للبحث عبر كل الكيانات
- **تقارير متقدمة**: رسوم بيانية + فلاتر بحث + نطاق تاريخي
- **تصميم RTL**: واجهة عربية كاملة بخط Cairo

## التقنيات

| الطبقة | التقنية |
|--------|---------|
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Frontend | React 19 + Vite 6 |
| Styling | TailwindCSS v4 |
| Charts | Chart.js + react-chartjs-2 |
| Icons | Lucide React |
| Testing | Node.js built-in test runner |

## الاختبارات

```bash
cd backend && node --test tests/api.test.js
```

26 اختبار يغطي جميع API endpoints.

## اختصارات لوحة المفاتيح

| الاختصار | الوظيفة |
|----------|---------|
| `Ctrl+K` | البحث الشامل |
| `ESC` | إغلاق النوافذ المنبثقة |

---

**WK-Hub** v2.0 — نظام إدارة المصنع
