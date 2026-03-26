/**
 * Comprehensive Help Content for WK-Hub
 * Structured data for each page: overview, features, tasks, tips, troubleshooting, shortcuts, related pages
 */

const helpContentFull = {
  dashboard: {
    pageId: 'dashboard',
    pageTitle: 'لوحة التحكم',
    overview: 'لوحة التحكم هي الصفحة الرئيسية للنظام. تعرض ملخصاً شاملاً عن حالة المصنع من حيث الإنتاج والمالية والمخزون والموارد البشرية. استخدمها للاطلاع السريع على أداء المصنع واتخاذ القرارات.',
    features: [
      { id: 'kpi-cards', title: 'بطاقات المؤشرات', description: 'أرقام رئيسية تعرض: عدد أوامر الإنتاج النشطة، الإيرادات الشهرية، إجمالي المخزون، وعدد الفواتير المعلقة', action: 'اضغط على أي بطاقة للانتقال إلى الصفحة المتعلقة' },
      { id: 'charts', title: 'الرسوم البيانية', description: 'رسوم بيانية تفاعلية تعرض أداء الإنتاج والإيرادات عبر الأشهر', action: 'حرّك المؤشر فوق الرسم لعرض تفاصيل كل شهر' },
      { id: 'recent-orders', title: 'آخر الأوامر', description: 'قائمة بأحدث أوامر الإنتاج وحالتها الحالية', action: 'اضغط على أمر للانتقال إلى تفاصيله' },
      { id: 'alerts', title: 'التنبيهات', description: 'تنبيهات المخزون المنخفض والصيانة المستحقة والفواتير المتأخرة', action: 'اضغط على التنبيه للانتقال إلى المشكلة' },
    ],
    commonTasks: [
      { title: 'مراجعة حالة المصنع', steps: ['افتح لوحة التحكم', 'راجع المؤشرات الرئيسية في الأعلى', 'تفقد التنبيهات وحل المشاكل العاجلة'] },
      { title: 'تتبع الإنتاج اليومي', steps: ['تفقد بطاقة أوامر الإنتاج النشطة', 'اضغط عليها لعرض التفاصيل', 'تابع المراحل المتأخرة'] },
    ],
    tips: [
      'لوحة التحكم تتحدث تلقائياً — لا تحتاج إلى تحديث يدوي',
      'البطاقات الحمراء تعني مشاكل تحتاج انتباهك فوراً',
      'استخدم الرسوم البيانية لمقارنة أداء الأشهر المختلفة',
    ],
    troubleshooting: [
      { issue: 'الأرقام لا تتحدث', solution: 'أعد تحميل الصفحة (F5). إذا استمرت المشكلة، تحقق من اتصال الشبكة' },
      { issue: 'الرسوم البيانية لا تظهر', solution: 'تأكد من وجود بيانات في النظام (أوامر إنتاج وفواتير)' },
    ],
    relatedPages: [
      { title: 'أوامر الإنتاج', url: '/work-orders', description: 'إدارة ومتابعة أوامر الإنتاج' },
      { title: 'التقارير', url: '/reports', description: 'تقارير تفصيلية عن الأداء' },
      { title: 'الإشعارات', url: '/notifications', description: 'عرض جميع التنبيهات' },
    ],
    shortcuts: [
      { key: 'Ctrl+K', description: 'البحث الشامل في النظام' },
    ],
  },

  fabrics: {
    pageId: 'fabrics',
    pageTitle: 'الأقمشة',
    overview: 'صفحة إدارة الأقمشة تتيح لك إضافة وتعديل وحذف أنواع الأقمشة المستخدمة في المصنع. يمكنك تحديد نوع القماش (أساسي/بطانة)، السعر لكل متر، المورد، واللون.',
    features: [
      { id: 'add-fabric', title: 'إضافة قماش', description: 'إنشاء نوع قماش جديد بكود فريد', action: 'اضغط زر "قماش جديد" وأدخل البيانات المطلوبة' },
      { id: 'edit-fabric', title: 'تعديل قماش', description: 'تعديل بيانات قماش موجود', action: 'اضغط على أيقونة التعديل بجانب القماش' },
      { id: 'export-csv', title: 'تصدير CSV', description: 'تحميل جميع بيانات الأقمشة كملف CSV', action: 'اضغط زر التصدير في شريط الأدوات' },
      { id: 'import-csv', title: 'استيراد CSV', description: 'إضافة أقمشة متعددة من ملف CSV', action: 'اضغط زر الاستيراد واختر الملف' },
      { id: 'search-filter', title: 'البحث والتصفية', description: 'بحث بالكود أو الاسم مع تصفية حسب النوع', action: 'استخدم حقل البحث أو أزرار التصفية' },
    ],
    commonTasks: [
      { title: 'إضافة قماش جديد', steps: ['اضغط "قماش جديد"', 'أدخل الكود (مثل FAB-001)', 'أدخل اسم القماش', 'اختر النوع (أساسي/بطانة/كلاهما)', 'أدخل السعر لكل متر', 'اضغط حفظ'], prerequisites: ['لا يوجد قماش بنفس الكود'] },
      { title: 'استيراد أقمشة من ملف', steps: ['جهّز ملف CSV بالأعمدة: code, name, fabric_type, price_per_m', 'اضغط زر الاستيراد', 'اختر الملف', 'راجع البيانات واضغط تأكيد'] },
      { title: 'تصدير قائمة الأقمشة', steps: ['اضغط زر التصدير في أعلى الصفحة', 'سيتم تحميل ملف CSV تلقائياً'] },
    ],
    tips: [
      'استخدم كود موحد للأقمشة مثل FAB-001, FAB-002 لسهولة البحث',
      'حدد نوع القماش بدقة (أساسي/بطانة) لحساب التكلفة بشكل صحيح',
      'يمكنك إضافة صور للأقمشة لتسهيل التعرف عليها',
    ],
    troubleshooting: [
      { issue: 'خطأ: الكود موجود بالفعل', solution: 'اختر كوداً مختلفاً — كل قماش يجب أن يكون له كود فريد' },
      { issue: 'فشل الاستيراد', solution: 'تأكد من أن ملف CSV يحتوي على الأعمدة المطلوبة: code, name, fabric_type, price_per_m' },
      { issue: 'لا يمكن حذف القماش', solution: 'القماش المستخدم في موديلات لا يمكن حذفه — يتم إلغاء تفعيله فقط' },
    ],
    relatedPages: [
      { title: 'مخزون الأقمشة', url: '/inventory/fabrics', description: 'تتبع كميات الأقمشة المتاحة' },
      { title: 'الموديلات', url: '/models', description: 'ربط الأقمشة بالموديلات' },
      { title: 'أوامر الشراء', url: '/purchase-orders', description: 'طلب أقمشة من الموردين' },
    ],
    shortcuts: [
      { key: 'Ctrl+K', description: 'البحث السريع عن قماش' },
    ],
  },

  accessories: {
    pageId: 'accessories',
    pageTitle: 'الاكسسوارات',
    overview: 'إدارة الاكسسوارات المستخدمة في الإنتاج مثل الأزرار والسحّابات والخيوط والليبلات. تتبع الأسعار والمخزون وحدود إعادة الطلب.',
    features: [
      { id: 'add-accessory', title: 'إضافة اكسسوار', description: 'إنشاء صنف اكسسوار جديد', action: 'اضغط "اكسسوار جديد" وأدخل البيانات' },
      { id: 'stock-adjust', title: 'تعديل المخزون', description: 'تعديل الكمية المتاحة', action: 'اضغط على أيقونة تعديل المخزون' },
      { id: 'low-stock-alert', title: 'تنبيه المخزون', description: 'تنبيه عند انخفاض المخزون عن الحد الأدنى', action: 'عيّن حد إعادة الطلب لكل صنف' },
    ],
    commonTasks: [
      { title: 'إضافة اكسسوار جديد', steps: ['اضغط "اكسسوار جديد"', 'أدخل الكود والاسم', 'اختر النوع (زر/سحّاب/خيط/ليبل/...)', 'أدخل السعر والوحدة', 'اضغط حفظ'] },
      { title: 'تعديل مخزون اكسسوار', steps: ['ابحث عن الاكسسوار', 'اضغط أيقونة تعديل المخزون', 'أدخل الكمية الجديدة', 'اضغط حفظ'] },
    ],
    tips: [
      'عيّن حد إعادة الطلب لتلقي تنبيهات قبل نفاد المخزون',
      'استخدم أنواع الاكسسوارات المحددة لتسهيل التقارير والتحليل',
    ],
    troubleshooting: [
      { issue: 'لا يمكن تعديل السعر', solution: 'تأكد من أن الاكسسوار لم يتم حذفه (غير نشط)' },
    ],
    relatedPages: [
      { title: 'مخزون الاكسسوارات', url: '/inventory/accessories', description: 'تتبع الكميات التفصيلية' },
      { title: 'الموديلات', url: '/models', description: 'ربط الاكسسوارات بالموديلات' },
    ],
    shortcuts: [],
  },

  models: {
    pageId: 'models',
    pageTitle: 'الموديلات',
    overview: 'صفحة الموديلات تعرض جميع تصاميم المنتجات المسجلة في النظام. يمكنك إنشاء موديلات جديدة، تعديل الموجودة، وعرض تفاصيل التكلفة والمواد.',
    features: [
      { id: 'model-list', title: 'قائمة الموديلات', description: 'عرض جميع الموديلات مع التكلفة والحالة', action: 'تصفح القائمة واستخدم البحث للوصول السريع' },
      { id: 'create-model', title: 'إنشاء موديل', description: 'إنشاء موديل جديد مع قائمة المواد الكاملة', action: 'اضغط "موديل جديد"' },
      { id: 'bom', title: 'قوائم المواد (BOM)', description: 'إدارة قوائم مواد كل موديل', action: 'اضغط على أيقونة BOM بجانب الموديل' },
    ],
    commonTasks: [
      { title: 'إنشاء موديل جديد', steps: ['اضغط "موديل جديد"', 'أدخل الكود التسلسلي والاسم', 'أضف الأقمشة الأساسية والبطانة', 'أضف المقاسات والألوان', 'أضف الاكسسوارات', 'حدد المصنعية والمصروف', 'اضغط حفظ'] },
    ],
    tips: [
      'يمكنك نسخ موديل قائم وتعديله بدلاً من إنشاء من الصفر',
      'راجع التكلفة المحسوبة قبل الحفظ للتأكد من دقة الأسعار',
    ],
    troubleshooting: [
      { issue: 'التكلفة تظهر صفر', solution: 'تأكد من إضافة أقمشة ومقاسات (كمية القطع) للموديل' },
    ],
    relatedPages: [
      { title: 'إنشاء موديل', url: '/models/new', description: 'نموذج إنشاء موديل كامل' },
      { title: 'أوامر الإنتاج', url: '/work-orders', description: 'إنتاج موديل معين' },
      { title: 'الأقمشة', url: '/fabrics', description: 'إدارة الأقمشة المستخدمة' },
    ],
    shortcuts: [{ key: 'Ctrl+K', description: 'بحث سريع عن موديل' }],
  },

  modelform: {
    pageId: 'modelform',
    pageTitle: 'نموذج الموديل',
    overview: 'صفحة إنشاء أو تعديل الموديل. تتيح لك تحديد البيانات الأساسية، قائمة المواد (أقمشة + اكسسوارات)، جدول المقاسات والألوان، وحساب التكلفة التلقائي.',
    features: [
      { id: 'basic-info', title: 'البيانات الأساسية', description: 'الكود التسلسلي، كود الموديل، الاسم، التاريخ، الملاحظات', action: 'أدخل البيانات في القسم العلوي' },
      { id: 'image-upload', title: 'صورة الموديل', description: 'رفع صورة للموديل للتعرف السريع', action: 'اضغط على مربع الصورة واختر ملفاً' },
      { id: 'main-fabrics', title: 'الأقمشة الأساسية', description: 'أضف قماشاً أو أكثر مع تحديد الأمتار ونسبة الهدر', action: 'اختر القماش من القائمة وأدخل الأمتار' },
      { id: 'linings', title: 'البطانة', description: 'أضف أقمشة البطانة مع الأمتار المطلوبة', action: 'اضغط "إضافة بطانة" واختر القماش' },
      { id: 'size-grid', title: 'جدول المقاسات', description: 'مصفوفة المقاسات × الألوان مع حساب تلقائي لعدد القطع', action: 'أضف ألواناً وأدخل الكميات لكل مقاس' },
      { id: 'accessories-table', title: 'الاكسسوارات', description: 'أضف الاكسسوارات المطلوبة مع الكميات والأسعار', action: 'اضغط "إضافة" واختر الاكسسوار' },
      { id: 'cost-panel', title: 'لوحة التكلفة', description: 'حساب تلقائي للتكلفة مع تسعير البيع', action: 'اللوحة اليمنى تتحدث تلقائياً مع كل تغيير' },
    ],
    commonTasks: [
      { title: 'إنشاء موديل كامل', steps: ['أدخل الكود التسلسلي (مثل 1-001)', 'أدخل كود الموديل (مثل MDL-001)', 'أدخل اسم الموديل', 'ارفع صورة (اختياري)', 'أضف الأقمشة الأساسية مع الأمتار لكل قطعة', 'أضف البطانة إن وجدت', 'أضف ألوان ومقاسات في الجدول', 'أضف الاكسسوارات (أزرار, سحابات, إلخ)', 'راجع التكلفة في اللوحة اليمنى', 'حدد سعر المستهلك وسعر الجملة', 'اضغط حفظ'] },
      { title: 'تعديل أسعار موديل', steps: ['افتح الموديل من قائمة الموديلات', 'عدّل المصنعية أو المصروف في لوحة التكلفة', 'عدّل سعر المستهلك أو الجملة', 'اضغط حفظ'] },
    ],
    tips: [
      'لوحة التكلفة على اليسار تبقى مرئية أثناء التمرير — استخدمها لمراجعة التكلفة أثناء التعديل',
      'السعر المقترح يُحسب تلقائياً من التكلفة + هامش الربح',
      'نسبة الهدر تُضاف فقط على القماش الأساسي وليس البطانة',
      'إجمالي القطع يُحسب تلقائياً من جدول المقاسات',
      'يمكنك إضافة أكثر من قماش أساسي (مثل قماشين مختلفين في نفس الموديل)',
    ],
    troubleshooting: [
      { issue: 'تكلفة القطعة = 0', solution: 'تأكد من إضافة ألوان ومقاسات في الجدول (إجمالي القطع يجب أن يكون > 0)' },
      { issue: 'القماش لا يظهر في القائمة', solution: 'تأكد من إضافة القماش في صفحة الأقمشة أولاً وأنه نشط' },
      { issue: 'خطأ: الكود موجود', solution: 'كل موديل يحتاج كود فريد — استخدم كوداً مختلفاً' },
      { issue: 'الصورة لا ترفع', solution: 'تأكد من أن حجم الصورة أقل من 5 ميجابايت والنوع JPG أو PNG' },
    ],
    relatedPages: [
      { title: 'الموديلات', url: '/models', description: 'عرض قائمة جميع الموديلات' },
      { title: 'الأقمشة', url: '/fabrics', description: 'إدارة الأقمشة قبل إضافتها للموديل' },
      { title: 'الاكسسوارات', url: '/accessories', description: 'إدارة الاكسسوارات المتاحة' },
    ],
    shortcuts: [{ key: 'Ctrl+S', description: 'حفظ الموديل (من شريط الحفظ السفلي)' }],
  },

  workorders: {
    pageId: 'workorders',
    pageTitle: 'أوامر الإنتاج',
    overview: 'إدارة أوامر الإنتاج من الإنشاء حتى الاكتمال. تتبع المراحل والتكاليف والاستهلاك الفعلي مقابل المخطط.',
    features: [
      { id: 'wo-list', title: 'قائمة الأوامر', description: 'عرض جميع الأوامر مع الحالة والأولوية', action: 'تصفح القائمة وصفّ حسب الحالة أو الأولوية' },
      { id: 'create-wo', title: 'إنشاء أمر', description: 'إنشاء أمر إنتاج جديد من موديل محدد', action: 'اضغط "أمر جديد"' },
      { id: 'status-track', title: 'تتبع الحالة', description: 'متابعة حالة كل أمر ومراحل الإنتاج', action: 'اضغط على الأمر لعرض التفاصيل' },
    ],
    commonTasks: [
      { title: 'إنشاء أمر إنتاج', steps: ['اضغط "أمر جديد"', 'اختر الموديل من القائمة', 'حدد الكميات المطلوبة لكل مقاس', 'حدد التاريخ المطلوب', 'عيّن الأولوية', 'اضغط حفظ'] },
      { title: 'تحديث مرحلة إنتاج', steps: ['افتح أمر الإنتاج', 'انتقل إلى قسم المراحل', 'سجّل الكمية المنجزة', 'سجّل الاستهلاك الفعلي إن وجد'] },
    ],
    tips: [
      'استخدم الألوان لتمييز الأولويات: أحمر = عاجل، أصفر = عالي، أخضر = عادي',
      'راجع تكلفة القطعة الفعلية مقابل التقديرية لمراقبة الأداء المالي',
    ],
    troubleshooting: [
      { issue: 'لا يمكن إنشاء أمر إنتاج', solution: 'تأكد من وجود موديل واحد على الأقل في النظام' },
      { issue: 'المراحل لا تظهر', solution: 'تأكد من إعداد قوالب المراحل في صفحة قوالب المراحل' },
    ],
    relatedPages: [
      { title: 'الموديلات', url: '/models', description: 'اختيار الموديل المطلوب' },
      { title: 'الجدولة', url: '/scheduling', description: 'جدولة أوامر الإنتاج' },
      { title: 'الماكينات', url: '/machines', description: 'تخصيص الماكينات لأوامر الإنتاج' },
    ],
    shortcuts: [],
  },

  workorderdetail: {
    pageId: 'workorderdetail',
    pageTitle: 'تفاصيل أمر الإنتاج',
    overview: 'صفحة تفاصيل أمر الإنتاج تعرض معلومات شاملة عن الأمر: المراحل، الاستهلاك، الهدر، والتكاليف الفعلية مقارنة بالمخططة.',
    features: [
      { id: 'stages', title: 'المراحل', description: 'تتبع تقدم كل مرحلة من القص حتى التغليف', action: 'سجّل الكميات المنجزة في كل مرحلة' },
      { id: 'consumption', title: 'الاستهلاك', description: 'تسجيل استهلاك المواد الفعلي', action: 'أدخل كميات الأقمشة والاكسسوارات المستخدمة' },
      { id: 'waste', title: 'الهدر', description: 'تسجيل ومقارنة الهدر الفعلي مع المخطط', action: 'سجّل كميات الهدر لكل مادة' },
      { id: 'actual-cost', title: 'التكلفة الفعلية', description: 'مقارنة التكلفة الفعلية بالتقديرية', action: 'راجع قسم التكاليف في أسفل الصفحة' },
    ],
    commonTasks: [
      { title: 'تسجيل تقدم مرحلة', steps: ['افتح أمر الإنتاج', 'اختر المرحلة المطلوبة', 'أدخل عدد القطع المنجزة', 'اضغط حفظ'] },
    ],
    tips: [
      'سجّل التقدم يومياً لمتابعة دقيقة',
      'قارن الهدر الفعلي بالمخطط لتحسين الكفاءة',
    ],
    troubleshooting: [],
    relatedPages: [
      { title: 'أوامر الإنتاج', url: '/work-orders', description: 'العودة لقائمة الأوامر' },
    ],
    shortcuts: [],
  },

  workorderform: {
    pageId: 'workorderform',
    pageTitle: 'إنشاء أمر إنتاج',
    overview: 'نموذج إنشاء أو تعديل أمر إنتاج. اختر الموديل وحدد الكميات والمراحل والأولوية وتاريخ التسليم.',
    features: [
      { id: 'model-select', title: 'اختيار الموديل', description: 'اختر من الموديلات المسجلة ليتم تحميل المواد تلقائياً', action: 'ابحث أو تصفّح قائمة الموديلات' },
      { id: 'qty-sizes', title: 'الكميات والمقاسات', description: 'تحديد الكميات المطلوبة لكل مقاس', action: 'أدخل الكميات في الجدول' },
      { id: 'stages', title: 'مراحل الإنتاج', description: 'تعيين المراحل وتاريخ كل مرحلة', action: 'المراحل تُحمّل تلقائياً من القوالب' },
      { id: 'priority', title: 'الأولوية', description: 'تحديد أولوية تنفيذ الأمر', action: 'اختر من القائمة: عاجل/عالي/عادي/منخفض' },
    ],
    commonTasks: [
      { title: 'إنشاء أمر إنتاج جديد', steps: ['اضغط "أمر جديد" من صفحة الأوامر', 'ابحث واختر الموديل', 'أدخل الكميات المطلوبة', 'حدد تاريخ التسليم', 'اختر الأولوية', 'عيّن المسؤول عن كل مرحلة', 'اضغط حفظ'] },
    ],
    tips: [
      'بإمكانك تعديل المراحل بعد الإنشاء من قوالب المراحل',
      'الأولوية تؤثر على الترتيب في صفحة الجدولة',
    ],
    troubleshooting: [
      { issue: 'الموديل لا يظهر في القائمة', solution: 'تأكد من أن الموديل نشط ولم يتم حذفه' },
    ],
    relatedPages: [
      { title: 'الموديلات', url: '/models', description: 'إنشاء موديل جديد أولاً' },
      { title: 'قوالب المراحل', url: '/stage-templates', description: 'إعداد مراحل الإنتاج' },
    ],
    shortcuts: [],
  },

  invoices: {
    pageId: 'invoices',
    pageTitle: 'الفواتير',
    overview: 'إدارة فواتير المبيعات من الإنشاء حتى التحصيل. تتبع الحالة (مسودة/مُرسلة/مدفوعة/متأخرة) وسجّل المدفوعات.',
    features: [
      { id: 'create-invoice', title: 'إنشاء فاتورة', description: 'إنشاء فاتورة جديدة لعميل', action: 'اضغط "فاتورة جديدة"' },
      { id: 'status-filter', title: 'التصفية بالحالة', description: 'عرض الفواتير حسب الحالة', action: 'استخدم أزرار التصفية في الأعلى' },
      { id: 'export', title: 'التصدير', description: 'تصدير الفواتير لملف CSV', action: 'اضغط زر التصدير' },
      { id: 'print', title: 'الطباعة', description: 'طباعة فاتورة بتنسيق A4', action: 'اضغط أيقونة الطباعة بجانب الفاتورة' },
    ],
    commonTasks: [
      { title: 'إنشاء فاتورة', steps: ['اضغط "فاتورة جديدة"', 'اختر العميل', 'أضف بنود الفاتورة', 'حدد الخصم إن وجد', 'اضغط حفظ'] },
      { title: 'تسجيل دفعة', steps: ['افتح الفاتورة', 'اضغط "إضافة دفعة"', 'أدخل المبلغ وتاريخ الدفع', 'اضغط حفظ'] },
    ],
    tips: [
      'الفواتير المتأخرة تظهر بلون أحمر في لوحة التحكم',
      'يمكنك تغيير حالة الفاتورة من مسودة إلى مُرسلة ثم مدفوعة',
    ],
    troubleshooting: [
      { issue: 'لا يمكن حذف فاتورة مُرسلة', solution: 'غيّر الحالة إلى ملغاة بدلاً من الحذف' },
    ],
    relatedPages: [
      { title: 'العملاء', url: '/customers', description: 'إدارة بيانات العملاء' },
      { title: 'التقارير', url: '/reports', description: 'تقارير المبيعات والتحصيل' },
    ],
    shortcuts: [],
  },

  invoiceview: {
    pageId: 'invoiceview',
    pageTitle: 'عرض الفاتورة',
    overview: 'عرض تفاصيل الفاتورة الكاملة مع البنود والمدفوعات. طباعة أو تصدير الفاتورة.',
    features: [
      { id: 'details', title: 'البنود', description: 'عرض بنود الفاتورة مع الأسعار والإجمالي', action: 'تصفّح جدول البنود' },
      { id: 'payments', title: 'المدفوعات', description: 'سجّل دفعات جديدة وتابع المبلغ المتبقي', action: 'اضغط "إضافة دفعة"' },
      { id: 'print', title: 'الطباعة', description: 'طباعة الفاتورة بتنسيق A4', action: 'اضغط زر الطباعة' },
    ],
    commonTasks: [],
    tips: ['يمكنك تصدير الفاتورة كملف CSV من زر التصدير'],
    troubleshooting: [],
    relatedPages: [
      { title: 'الفواتير', url: '/invoices', description: 'العودة لقائمة الفواتير' },
    ],
    shortcuts: [],
  },

  customers: {
    pageId: 'customers',
    pageTitle: 'العملاء',
    overview: 'إدارة بيانات العملاء وتتبع الفواتير والمدفوعات وحدود الائتمان.',
    features: [
      { id: 'add-customer', title: 'إضافة عميل', description: 'إنشاء عميل جديد', action: 'اضغط "عميل جديد"' },
      { id: 'credit-limit', title: 'حد الائتمان', description: 'تحديد حد الائتمان لكل عميل', action: 'عدّل حد الائتمان في بيانات العميل' },
      { id: 'customer-detail', title: 'التفاصيل', description: 'عرض تاريخ الفواتير والمدفوعات', action: 'اضغط على اسم العميل' },
    ],
    commonTasks: [
      { title: 'إضافة عميل جديد', steps: ['اضغط "عميل جديد"', 'أدخل الاسم والهاتف والعنوان', 'حدد حد الائتمان (اختياري)', 'اضغط حفظ'] },
    ],
    tips: ['تابع رصيد كل عميل لتجنب تجاوز حد الائتمان'],
    troubleshooting: [],
    relatedPages: [
      { title: 'الفواتير', url: '/invoices', description: 'إنشاء فاتورة لعميل' },
    ],
    shortcuts: [],
  },

  suppliers: {
    pageId: 'suppliers',
    pageTitle: 'الموردين',
    overview: 'إدارة بيانات الموردين وأوامر الشراء والمدفوعات. تتبع تاريخ التوريد والأرصدة.',
    features: [
      { id: 'add-supplier', title: 'إضافة مورد', description: 'تسجيل مورد جديد في النظام', action: 'اضغط "مورد جديد"' },
      { id: 'payments', title: 'المدفوعات', description: 'تسجيل دفعات للموردين', action: 'افتح تفاصيل المورد واضغط "إضافة دفعة"' },
    ],
    commonTasks: [
      { title: 'إضافة مورد', steps: ['اضغط "مورد جديد"', 'أدخل الكود والاسم ومعلومات التواصل', 'اضغط حفظ'] },
    ],
    tips: ['صدّر قائمة الموردين لملف CSV للمراجعة الخارجية'],
    troubleshooting: [],
    relatedPages: [
      { title: 'أوامر الشراء', url: '/purchase-orders', description: 'إنشاء أمر شراء لمورد' },
    ],
    shortcuts: [],
  },

  purchaseorders: {
    pageId: 'purchaseorders',
    pageTitle: 'أوامر الشراء',
    overview: 'إدارة أوامر الشراء من الموردين. إنشاء أوامر جديدة، تتبع الاستلام، وتسجيل المدفوعات.',
    features: [
      { id: 'create-po', title: 'إنشاء أمر', description: 'إنشاء أمر شراء جديد', action: 'اضغط "أمر شراء جديد"' },
      { id: 'receive', title: 'الاستلام', description: 'تسجيل استلام البضاعة وتحديث المخزون', action: 'اضغط "استلام" بجانب أمر الشراء' },
    ],
    commonTasks: [
      { title: 'إنشاء أمر شراء', steps: ['اضغط "أمر شراء جديد"', 'اختر المورد', 'أضف الأصناف والكميات والأسعار', 'اضغط حفظ'] },
    ],
    tips: ['سجّل الاستلام فور وصول البضاعة لتحديث المخزون تلقائياً'],
    troubleshooting: [],
    relatedPages: [
      { title: 'الموردين', url: '/suppliers', description: 'إدارة بيانات الموردين' },
      { title: 'مخزون الأقمشة', url: '/inventory/fabrics', description: 'تتبع المخزون بعد الاستلام' },
    ],
    shortcuts: [],
  },

  machines: {
    pageId: 'machines',
    pageTitle: 'الماكينات',
    overview: 'إدارة ماكينات المصنع. تتبع الحالة والصيانة والتكاليف لكل ماكينة.',
    features: [
      { id: 'add-machine', title: 'إضافة ماكينة', description: 'تسجيل ماكينة جديدة مع باركود', action: 'اضغط "ماكينة جديدة"' },
      { id: 'barcode', title: 'الباركود', description: 'باركود فريد لكل ماكينة', action: 'امسح الباركود للوصول السريع' },
      { id: 'maintenance', title: 'الصيانة', description: 'تتبع جدول الصيانة', action: 'اضغط على أيقونة الصيانة' },
    ],
    commonTasks: [],
    tips: ['استخدم الباركود لتسجيل الصيانة السريعة من الموبايل'],
    troubleshooting: [],
    relatedPages: [
      { title: 'الصيانة', url: '/maintenance', description: 'إدارة أوامر الصيانة' },
    ],
    shortcuts: [],
  },

  maintenance: {
    pageId: 'maintenance',
    pageTitle: 'الصيانة',
    overview: 'إدارة أوامر صيانة الماكينات. إنشاء أوامر جديدة، تتبع الحالة، وتسجيل التكاليف.',
    features: [
      { id: 'create-mo', title: 'إنشاء أمر صيانة', description: 'فتح أمر صيانة لماكينة', action: 'اضغط "أمر صيانة جديد"' },
      { id: 'status', title: 'تتبع الحالة', description: 'متابعة حالة الأمر من مفتوح حتى اكتمال', action: 'تحديث الحالة من تفاصيل الأمر' },
    ],
    commonTasks: [
      { title: 'إنشاء أمر صيانة', steps: ['اضغط "أمر صيانة جديد"', 'اختر الماكينة', 'حدد نوع الصيانة (وقائية/إصلاحية)', 'حدد الأولوية', 'اضغط حفظ'] },
    ],
    tips: ['الصيانة الوقائية تقلل من الأعطال المفاجئة — جدولها بانتظام'],
    troubleshooting: [],
    relatedPages: [
      { title: 'الماكينات', url: '/machines', description: 'عرض بيانات الماكينات' },
    ],
    shortcuts: [],
  },

  expenses: {
    pageId: 'expenses',
    pageTitle: 'المصروفات',
    overview: 'تسجيل وتتبع مصروفات المصنع. تصنيف المصروفات وتتبع الاعتماد والتقارير.',
    features: [
      { id: 'add-expense', title: 'إضافة مصروف', description: 'تسجيل مصروف جديد', action: 'اضغط "مصروف جديد"' },
      { id: 'approval', title: 'الاعتماد', description: 'اعتماد أو رفض المصروفات', action: 'من تفاصيل المصروف اضغط اعتماد أو رفض' },
      { id: 'reports', title: 'التقارير', description: 'تحليل المصروفات حسب النوع والشهر', action: 'استخدم الفلاتر في أعلى الصفحة' },
    ],
    commonTasks: [
      { title: 'تسجيل مصروف', steps: ['اضغط "مصروف جديد"', 'حدد النوع والمبلغ والتاريخ', 'أضف وصفاً وأرفق مستنداً (اختياري)', 'اضغط حفظ'] },
    ],
    tips: ['المصروفات فوق حد معين تحتاج اعتماد مدير — راجع الإعدادات'],
    troubleshooting: [],
    relatedPages: [
      { title: 'التقارير', url: '/reports', description: 'تقارير المصاريف الشاملة' },
    ],
    shortcuts: [],
  },

  reports: {
    pageId: 'reports',
    pageTitle: 'التقارير',
    overview: 'تقارير شاملة عن أداء المصنع: الإنتاج، المالية، المخزون، الصيانة. رسوم بيانية وفلاتر متقدمة.',
    features: [
      { id: 'production', title: 'تقارير الإنتاج', description: 'أداء أوامر الإنتاج والمراحل', action: 'اختر قسم الإنتاج' },
      { id: 'finance', title: 'التقارير المالية', description: 'الإيرادات والمصروفات وهوامش الربح', action: 'اختر القسم المالي' },
      { id: 'charts', title: 'الرسوم البيانية', description: 'رسوم بيانية تفاعلية', action: 'حرّك المؤشر فوق الرسم للتفاصيل' },
    ],
    commonTasks: [
      { title: 'إنشاء تقرير مخصص', steps: ['اختر نوع التقرير', 'حدد الفترة الزمنية', 'اختر الفلاتر المطلوبة', 'اضغط عرض'] },
    ],
    tips: ['استخدم فلاتر التاريخ لمقارنة فترات مختلفة'],
    troubleshooting: [
      { issue: 'التقرير فارغ', solution: 'تأكد من وجود بيانات في الفترة المحددة' },
    ],
    relatedPages: [
      { title: 'لوحة التحكم', url: '/dashboard', description: 'نظرة سريعة على الأداء' },
    ],
    shortcuts: [],
  },

  settings: {
    pageId: 'settings',
    pageTitle: 'الإعدادات',
    overview: 'إعدادات النظام الشاملة: بيانات المصنع، إعدادات الإنتاج والمالية والتكلفة، خيارات العرض والنظام.',
    features: [
      { id: 'factory-info', title: 'بيانات المصنع', description: 'اسم المصنع والعنوان والهاتف — تظهر في الفواتير', action: 'عدّل البيانات في قسم المصنع' },
      { id: 'production', title: 'إعدادات الإنتاج', description: 'القيم الافتراضية للمصنعية والهدر والمراحل', action: 'عدّل القيم في قسم الإنتاج' },
      { id: 'finance', title: 'الإعدادات المالية', description: 'بادئات الأرقام وإعدادات الضريبة', action: 'عدّل القيم في القسم المالي' },
      { id: 'system', title: 'إعدادات النظام', description: 'مدة الجلسة والنسخ الاحتياطي', action: 'عدّل في قسم النظام' },
    ],
    commonTasks: [
      { title: 'تحديث بيانات المصنع', steps: ['افتح الإعدادات', 'عدّل اسم المصنع والعنوان والهاتف', 'اضغط حفظ'] },
      { title: 'تغيير القيم الافتراضية للتكلفة', steps: ['افتح الإعدادات', 'انتقل لقسم الإنتاج', 'عدّل المصنعية والمصروف ونسبة الهدر الافتراضية', 'اضغط حفظ'] },
    ],
    tips: [
      'الإعدادات تؤثر على كل الموديلات والفواتير الجديدة',
      'القيم الافتراضية يمكن تعديلها لكل موديل على حدة',
    ],
    troubleshooting: [
      { issue: 'الإعدادات لا تُحفظ', solution: 'تأكد من أن لديك صلاحية تعديل الإعدادات' },
    ],
    relatedPages: [],
    shortcuts: [],
  },

  users: {
    pageId: 'users',
    pageTitle: 'إدارة المستخدمين',
    overview: 'إنشاء وإدارة حسابات المستخدمين وتعيين الأدوار والصلاحيات. متاحة فقط لمدير النظام.',
    features: [
      { id: 'add-user', title: 'إضافة مستخدم', description: 'إنشاء حساب مستخدم جديد', action: 'اضغط "مستخدم جديد"' },
      { id: 'roles', title: 'الأدوار', description: 'تعيين أدوار بصلاحيات محددة', action: 'اختر الدور عند إنشاء أو تعديل المستخدم' },
    ],
    commonTasks: [
      { title: 'إضافة مستخدم جديد', steps: ['اضغط "مستخدم جديد"', 'أدخل الاسم واسم المستخدم وكلمة المرور', 'اختر الدور المناسب', 'اضغط حفظ'] },
    ],
    tips: ['كل دور له صلاحيات محددة — مدير النظام لديه كل الصلاحيات'],
    troubleshooting: [],
    relatedPages: [
      { title: 'الصلاحيات', url: '/permissions', description: 'تخصيص صلاحيات كل مستخدم' },
    ],
    shortcuts: [],
  },

  permissions: {
    pageId: 'permissions',
    pageTitle: 'الصلاحيات',
    overview: 'مصفوفة صلاحيات تفصيلية لكل مستخدم. تحكم في الوصول لكل قسم من أقسام النظام.',
    features: [
      { id: 'matrix', title: 'مصفوفة الصلاحيات', description: 'جدول يعرض الصلاحيات لكل مستخدم', action: 'فعّل أو ألغِ الصلاحيات من الجدول' },
    ],
    commonTasks: [],
    tips: ['تأكد من منح الحد الأدنى من الصلاحيات اللازمة لكل مستخدم'],
    troubleshooting: [],
    relatedPages: [
      { title: 'المستخدمين', url: '/users', description: 'إدارة حسابات المستخدمين' },
    ],
    shortcuts: [],
  },

  auditlog: {
    pageId: 'auditlog',
    pageTitle: 'سجل المراجعة',
    overview: 'سجل تفصيلي لجميع العمليات في النظام. يسجل من فعل ماذا ومتى ومن أي جهاز.',
    features: [
      { id: 'filter', title: 'التصفية', description: 'تصفية السجل حسب النوع والمستخدم والتاريخ', action: 'استخدم الفلاتر في أعلى الصفحة' },
      { id: 'export', title: 'التصدير', description: 'تصدير السجل لملف Excel', action: 'اضغط زر التصدير' },
      { id: 'details', title: 'التفاصيل', description: 'عرض القيمة القديمة والجديدة لكل تغيير', action: 'اضغط على أي صف لعرض التفاصيل' },
    ],
    commonTasks: [],
    tips: ['استخدم سجل المراجعة لتتبع التغييرات المشبوهة أو الأخطاء'],
    troubleshooting: [],
    relatedPages: [],
    shortcuts: [],
  },

  inventory: {
    pageId: 'inventory',
    pageTitle: 'المخزون',
    overview: 'صفحة تتبع مخزون الأقمشة والاكسسوارات. تعرض الكميات المتاحة والمحجوزة وتنبيهات إعادة الطلب.',
    features: [
      { id: 'stock-levels', title: 'مستويات المخزون', description: 'عرض الكميات لكل صنف', action: 'تصفّح الجدول واستخدم البحث' },
      { id: 'low-stock', title: 'تنبيهات المخزون', description: 'أصناف أقل من حد إعادة الطلب', action: 'راجع الأصناف المميزة بالأحمر' },
    ],
    commonTasks: [],
    tips: ['عيّن حد إعادة الطلب لكل صنف لتلقي تنبيهات تلقائية'],
    troubleshooting: [],
    relatedPages: [
      { title: 'الأقمشة', url: '/fabrics', description: 'إدارة أنواع الأقمشة' },
      { title: 'الاكسسوارات', url: '/accessories', description: 'إدارة أنواع الاكسسوارات' },
    ],
    shortcuts: [],
  },

  hr: {
    pageId: 'hr',
    pageTitle: 'الموارد البشرية',
    overview: 'إدارة شاملة للموارد البشرية: الموظفين، الحضور، الرواتب، والإجازات.',
    features: [],
    commonTasks: [],
    tips: [],
    troubleshooting: [],
    relatedPages: [
      { title: 'الموظفون', url: '/hr/employees', description: 'إدارة بيانات الموظفين' },
      { title: 'الحضور', url: '/hr/attendance', description: 'تسجيل الحضور والانصراف' },
      { title: 'الرواتب', url: '/hr/payroll', description: 'حساب الرواتب الشهرية' },
      { title: 'الإجازات', url: '/hr/leaves', description: 'إدارة طلبات الإجازة' },
    ],
    shortcuts: [],
  },

  employees: {
    pageId: 'employees',
    pageTitle: 'الموظفون',
    overview: 'إدارة بيانات الموظفين الأساسية: الاسم، القسم، الراتب، تاريخ التعيين.',
    features: [
      { id: 'add-employee', title: 'إضافة موظف', description: 'تسجيل موظف جديد', action: 'اضغط "موظف جديد"' },
    ],
    commonTasks: [
      { title: 'إضافة موظف', steps: ['اضغط "موظف جديد"', 'أدخل البيانات الأساسية', 'حدد القسم والراتب', 'اضغط حفظ'] },
    ],
    tips: ['أكمل جميع بيانات الموظف لحساب الراتب بشكل صحيح'],
    troubleshooting: [],
    relatedPages: [
      { title: 'الحضور', url: '/hr/attendance', description: 'تسجيل حضور الموظف' },
      { title: 'الرواتب', url: '/hr/payroll', description: 'كشف راتب الموظف' },
    ],
    shortcuts: [],
  },

  attendance: {
    pageId: 'attendance',
    pageTitle: 'الحضور',
    overview: 'تسجيل حضور وانصراف الموظفين. يدوياً أو عبر الباركود أو استيراد من ملف.',
    features: [],
    commonTasks: [
      { title: 'تسجيل حضور', steps: ['اختر التاريخ', 'اختر الموظف', 'سجّل وقت الحضور والانصراف', 'اضغط حفظ'] },
    ],
    tips: ['استخدم الباركود لتسجيل الحضور السريع'],
    troubleshooting: [],
    relatedPages: [{ title: 'الموظفون', url: '/hr/employees', description: 'بيانات الموظفين' }],
    shortcuts: [],
  },

  payroll: {
    pageId: 'payroll',
    pageTitle: 'الرواتب',
    overview: 'حساب الرواتب الشهرية مع الخصومات والإضافات. اعتماد وتصدير كشوف الرواتب.',
    features: [],
    commonTasks: [
      { title: 'حساب رواتب الشهر', steps: ['اختر الشهر', 'اضغط "حساب الرواتب"', 'راجع الحسابات وعدّل إن لزم', 'اضغط اعتماد', 'صدّر الكشف إن أردت'] },
    ],
    tips: ['راجع الحضور والإجازات قبل حساب الرواتب'],
    troubleshooting: [],
    relatedPages: [
      { title: 'الحضور', url: '/hr/attendance', description: 'بيانات الحضور للخصومات' },
      { title: 'الإجازات', url: '/hr/leaves', description: 'الإجازات المعتمدة' },
    ],
    shortcuts: [],
  },

  leaves: {
    pageId: 'leaves',
    pageTitle: 'الإجازات',
    overview: 'إدارة طلبات الإجازة. تقديم ومراجعة واعتماد الطلبات وتتبع الأرصدة.',
    features: [],
    commonTasks: [],
    tips: ['تابع أرصدة الإجازات بانتظام لتجنب المفاجآت'],
    troubleshooting: [],
    relatedPages: [{ title: 'الموظفون', url: '/hr/employees', description: 'بيانات الموظفين' }],
    shortcuts: [],
  },

  accounting: {
    pageId: 'accounting',
    pageTitle: 'المحاسبة',
    overview: 'نظام محاسبي متكامل: شجرة حسابات، قيود يومية، وميزان مراجعة.',
    features: [],
    commonTasks: [],
    tips: [],
    troubleshooting: [],
    relatedPages: [
      { title: 'شجرة الحسابات', url: '/accounting/coa', description: 'إعداد الحسابات' },
      { title: 'القيود اليومية', url: '/accounting/journal', description: 'تسجيل القيود' },
      { title: 'ميزان المراجعة', url: '/accounting/trial-balance', description: 'التحقق من التوازن' },
    ],
    shortcuts: [],
  },

  chartofaccounts: {
    pageId: 'chartofaccounts',
    pageTitle: 'شجرة الحسابات',
    overview: 'إعداد شجرة الحسابات المحاسبية: أصول، خصوم، إيرادات، مصروفات.',
    features: [],
    commonTasks: [
      { title: 'إضافة حساب', steps: ['اضغط "حساب جديد"', 'أدخل الرقم والاسم والنوع', 'اختر الحساب الأب (إن وجد)', 'اضغط حفظ'] },
    ],
    tips: ['رتّب الحسابات بأرقام منطقية (1xxx للأصول, 2xxx للخصوم, 3xxx لحقوق الملكية, 4xxx للإيرادات, 5xxx للمصروفات)'],
    troubleshooting: [],
    relatedPages: [{ title: 'القيود اليومية', url: '/accounting/journal', description: 'تسجيل القيود' }],
    shortcuts: [],
  },

  journalentries: {
    pageId: 'journalentries',
    pageTitle: 'القيود اليومية',
    overview: 'تسجيل القيود المحاسبية. كل قيد يتكون من طرف مدين وطرف دائن متساويين.',
    features: [],
    commonTasks: [
      { title: 'إنشاء قيد', steps: ['اضغط "قيد جديد"', 'أدخل التاريخ والوصف', 'أضف أطراف القيد (مدين/دائن)', 'تأكد من تساوي المدين والدائن', 'اضغط حفظ'] },
    ],
    tips: ['القيد لا يُحفظ إلا إذا كان متوازناً (مدين = دائن)'],
    troubleshooting: [
      { issue: 'خطأ: القيد غير متوازن', solution: 'تأكد من أن مجموع المدين يساوي مجموع الدائن بالضبط' },
    ],
    relatedPages: [{ title: 'ميزان المراجعة', url: '/accounting/trial-balance', description: 'التحقق من التوازن' }],
    shortcuts: [],
  },

  trialbalance: {
    pageId: 'trialbalance',
    pageTitle: 'ميزان المراجعة',
    overview: 'عرض أرصدة جميع الحسابات المحاسبية والتحقق من توازن المدين والدائن.',
    features: [],
    commonTasks: [],
    tips: ['إذا كان الميزان غير متوازن، راجع آخر القيود المسجلة'],
    troubleshooting: [],
    relatedPages: [{ title: 'القيود اليومية', url: '/accounting/journal', description: 'مراجعة القيود' }],
    shortcuts: [],
  },

  notifications: {
    pageId: 'notifications',
    pageTitle: 'الإشعارات',
    overview: 'مركز الإشعارات يعرض جميع التنبيهات: مخزون منخفض، صيانة مستحقة، فواتير متأخرة، مصاريف معلقة.',
    features: [
      { id: 'types', title: 'أنواع الإشعارات', description: 'تنبيهات المخزون والصيانة والمالية', action: 'اضغط على الإشعار للانتقال إلى المشكلة' },
      { id: 'mark-read', title: 'تحديد كمقروء', description: 'تحديد الإشعارات كمقروءة', action: 'اضغط على الإشعار أو زر "تحديد الكل"' },
    ],
    commonTasks: [],
    tips: ['راجع الإشعارات يومياً لمعالجة المشاكل العاجلة', 'الإشعارات الحمراء تعني مشاكل تحتاج إجراء فوري'],
    troubleshooting: [],
    relatedPages: [],
    shortcuts: [],
  },

  bomtemplates: {
    pageId: 'bomtemplates',
    pageTitle: 'قوائم المواد (BOM)',
    overview: 'إدارة قوائم المواد للموديلات. كل قائمة تحتوي على الأقمشة والاكسسوارات المطلوبة مع التكاليف.',
    features: [],
    commonTasks: [],
    tips: ['يمكنك إنشاء أكثر من قائمة مواد لنفس الموديل (مثل نسخة صيفية وشتوية)'],
    troubleshooting: [],
    relatedPages: [{ title: 'الموديلات', url: '/models', description: 'قائمة الموديلات' }],
    shortcuts: [],
  },

  stagetemplates: {
    pageId: 'stagetemplates',
    pageTitle: 'قوالب المراحل',
    overview: 'تعريف مراحل الإنتاج الافتراضية. المراحل المحددة هنا تُستخدم تلقائياً في أوامر الإنتاج الجديدة.',
    features: [],
    commonTasks: [
      { title: 'إضافة مرحلة', steps: ['اضغط "إضافة مرحلة"', 'أدخل الاسم واللون', 'حدد الترتيب', 'اضغط حفظ'] },
    ],
    tips: ['اسحب وأفلت المراحل لإعادة ترتيبها'],
    troubleshooting: [],
    relatedPages: [{ title: 'أوامر الإنتاج', url: '/work-orders', description: 'الأوامر التي تستخدم هذه المراحل' }],
    shortcuts: [],
  },

  scheduling: {
    pageId: 'scheduling',
    pageTitle: 'الجدولة',
    overview: 'جدولة أوامر الإنتاج على الماكينات والعمال. عرض خط زمني للإنتاج.',
    features: [],
    commonTasks: [],
    tips: ['استخدم الأولويات لترتيب الأوامر في الجدول'],
    troubleshooting: [],
    relatedPages: [{ title: 'أوامر الإنتاج', url: '/work-orders', description: 'إدارة الأوامر' }],
    shortcuts: [],
  },

  quality: {
    pageId: 'quality',
    pageTitle: 'إدارة الجودة',
    overview: 'فحص جودة المنتجات. تسجيل نتائج الفحص والعيوب والإجراءات التصحيحية.',
    features: [],
    commonTasks: [],
    tips: ['سجّل العيوب بدقة لتحسين الإنتاج مستقبلاً'],
    troubleshooting: [],
    relatedPages: [{ title: 'أوامر الإنتاج', url: '/work-orders', description: 'الأوامر المطلوب فحصها' }],
    shortcuts: [],
  },

  quotations: {
    pageId: 'quotations',
    pageTitle: 'عروض الأسعار',
    overview: 'إنشاء وإدارة عروض أسعار للعملاء. تحويل العروض المقبولة إلى أوامر بيع.',
    features: [],
    commonTasks: [],
    tips: ['حوّل العروض المقبولة إلى فواتير تلقائياً'],
    troubleshooting: [],
    relatedPages: [
      { title: 'أوامر البيع', url: '/sales-orders', description: 'تحويل العرض إلى أمر بيع' },
      { title: 'العملاء', url: '/customers', description: 'بيانات العملاء' },
    ],
    shortcuts: [],
  },

  salesorders: {
    pageId: 'salesorders',
    pageTitle: 'أوامر البيع',
    overview: 'إدارة أوامر البيع من الاستلام حتى التسليم والفوترة.',
    features: [],
    commonTasks: [],
    tips: [],
    troubleshooting: [],
    relatedPages: [
      { title: 'الفواتير', url: '/invoices', description: 'إنشاء فاتورة من أمر البيع' },
    ],
    shortcuts: [],
  },

  samples: {
    pageId: 'samples',
    pageTitle: 'العينات',
    overview: 'إدارة عينات المنتجات. تتبع حالة العينة من الطلب حتى الموافقة.',
    features: [],
    commonTasks: [],
    tips: [],
    troubleshooting: [],
    relatedPages: [{ title: 'الموديلات', url: '/models', description: 'الموديلات المتاحة' }],
    shortcuts: [],
  },

  shipping: {
    pageId: 'shipping',
    pageTitle: 'الشحن',
    overview: 'تتبع شحنات المنتجات من المصنع إلى العملاء.',
    features: [],
    commonTasks: [],
    tips: [],
    troubleshooting: [],
    relatedPages: [{ title: 'الفواتير', url: '/invoices', description: 'فواتير الشحنات' }],
    shortcuts: [],
  },

  returns: {
    pageId: 'returns',
    pageTitle: 'المرتجعات',
    overview: 'إدارة مرتجعات العملاء. تسجيل الأسباب وتحديث المخزون.',
    features: [],
    commonTasks: [],
    tips: [],
    troubleshooting: [],
    relatedPages: [{ title: 'الشحن', url: '/shipping', description: 'الشحنات المرتجعة' }],
    shortcuts: [],
  },

  mrp: {
    pageId: 'mrp',
    pageTitle: 'تخطيط الاحتياجات (MRP)',
    overview: 'تخطيط احتياجات المواد بناءً على أوامر الإنتاج. يحسب الكميات المطلوبة ويقترح أوامر شراء.',
    features: [],
    commonTasks: [],
    tips: ['شغّل MRP بعد إنشاء أوامر إنتاج جديدة لتحديث الاحتياجات'],
    troubleshooting: [],
    relatedPages: [
      { title: 'أوامر الشراء', url: '/purchase-orders', description: 'أوامر الشراء المقترحة' },
      { title: 'المخزون', url: '/inventory/fabrics', description: 'فحص المخزون الحالي' },
    ],
    shortcuts: [],
  },

  documents: {
    pageId: 'documents',
    pageTitle: 'المستندات',
    overview: 'إدارة المستندات والملفات المرتبطة بالعمليات.',
    features: [],
    commonTasks: [],
    tips: [],
    troubleshooting: [],
    relatedPages: [],
    shortcuts: [],
  },

  backups: {
    pageId: 'backups',
    pageTitle: 'النسخ الاحتياطية',
    overview: 'إدارة النسخ الاحتياطية لقاعدة البيانات. إنشاء واستعادة النسخ.',
    features: [],
    commonTasks: [
      { title: 'إنشاء نسخة احتياطية', steps: ['اضغط "نسخة جديدة"', 'انتظر حتى الاكتمال', 'تحقق من نجاح العملية'] },
    ],
    tips: ['أنشئ نسخة احتياطية يومياً على الأقل', 'احتفظ بنسخة خارجية في مكان آمن'],
    troubleshooting: [],
    relatedPages: [],
    shortcuts: [],
  },

  profile: {
    pageId: 'profile',
    pageTitle: 'الملف الشخصي',
    overview: 'عرض وتعديل بيانات حسابك الشخصي.',
    features: [],
    commonTasks: [],
    tips: [],
    troubleshooting: [],
    relatedPages: [{ title: 'تغيير كلمة المرور', url: '/change-password', description: 'تغيير كلمة المرور' }],
    shortcuts: [],
  },
};

export default helpContentFull;
