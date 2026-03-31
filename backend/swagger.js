/**
 * Phase 3.4: Swagger/OpenAPI Documentation
 * Generates API documentation from JSDoc comments and serves via swagger-ui-express.
 */
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WK-Factory API',
      version: '3.0.0',
      description: 'نظام إدارة المصنع — WK-Factory Enterprise API',
      contact: { name: 'WK-Factory Support' },
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
      { url: '/api', description: 'Default API' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'JWT token set as httpOnly cookie after login',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for programmatic access',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message (Arabic)' },
          },
        },
        Model: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            model_code: { type: 'string' },
            model_name: { type: 'string' },
            category: { type: 'string' },
            gender: { type: 'string', enum: ['male', 'female', 'kids', 'unisex'] },
            status: { type: 'string', enum: ['active', 'inactive', 'discontinued'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Fabric: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            code: { type: 'string' },
            name: { type: 'string' },
            fabric_type: { type: 'string', enum: ['main', 'lining', 'both'] },
            price_per_m: { type: 'number' },
            status: { type: 'string', enum: ['active', 'inactive'] },
          },
        },
        Accessory: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            code: { type: 'string' },
            name: { type: 'string' },
            acc_type: { type: 'string' },
            unit_price: { type: 'number' },
            unit: { type: 'string', enum: ['piece', 'meter', 'kg', 'roll'] },
          },
        },
        WorkOrder: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            wo_number: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'pending', 'in_progress', 'completed', 'cancelled'] },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
            masnaiya: { type: 'number' },
            masrouf: { type: 'number' },
            margin_pct: { type: 'number' },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            invoice_number: { type: 'string' },
            customer_name: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] },
            total: { type: 'number' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            full_name: { type: 'string' },
            role: { type: 'string', enum: ['superadmin', 'manager', 'accountant', 'production', 'hr', 'viewer'] },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          },
        },
        LicenseStatus: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            label: { type: 'string' },
            status: { type: 'string' },
            maxUsers: { type: 'integer' },
            daysLeft: { type: 'integer' },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  apis: [], // We define paths inline below
};

// Define API paths manually (more reliable than JSDoc scanning)
options.definition.paths = {
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'تسجيل الدخول',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } }, required: ['username', 'password'] } } },
      },
      responses: { 200: { description: 'Login successful' }, 401: { description: 'Invalid credentials' } },
    },
  },
  '/auth/logout': {
    post: { tags: ['Auth'], summary: 'تسجيل الخروج', responses: { 200: { description: 'Logged out' } } },
  },
  '/models': {
    get: { tags: ['Models'], summary: 'قائمة الموديلات', parameters: [{ in: 'query', name: 'status', schema: { type: 'string' } }], responses: { 200: { description: 'Model list' } } },
    post: { tags: ['Models'], summary: 'إنشاء موديل جديد', responses: { 201: { description: 'Created' } } },
  },
  '/models/{id}': {
    get: { tags: ['Models'], summary: 'تفاصيل موديل', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Model details' } } },
    put: { tags: ['Models'], summary: 'تعديل موديل', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Updated' } } },
  },
  '/fabrics': {
    get: { tags: ['Fabrics'], summary: 'قائمة الأقمشة', responses: { 200: { description: 'Fabric list' } } },
    post: { tags: ['Fabrics'], summary: 'إضافة قماش', responses: { 201: { description: 'Created' } } },
  },
  '/accessories': {
    get: { tags: ['Accessories'], summary: 'قائمة الاكسسوارات', responses: { 200: { description: 'Accessory list' } } },
    post: { tags: ['Accessories'], summary: 'إضافة اكسسوار', responses: { 201: { description: 'Created' } } },
  },
  '/work-orders': {
    get: { tags: ['Work Orders'], summary: 'قائمة أوامر الإنتاج', responses: { 200: { description: 'Work order list' } } },
    post: { tags: ['Work Orders'], summary: 'إنشاء أمر إنتاج', responses: { 201: { description: 'Created' } } },
  },
  '/work-orders/{id}': {
    get: { tags: ['Work Orders'], summary: 'تفاصيل أمر الإنتاج', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Work order details' } } },
  },
  '/invoices': {
    get: { tags: ['Invoices'], summary: 'قائمة الفواتير', responses: { 200: { description: 'Invoice list' } } },
    post: { tags: ['Invoices'], summary: 'إنشاء فاتورة', responses: { 201: { description: 'Created' } } },
  },
  '/suppliers': {
    get: { tags: ['Suppliers'], summary: 'قائمة الموردين', responses: { 200: { description: 'Supplier list' } } },
    post: { tags: ['Suppliers'], summary: 'إضافة مورد', responses: { 201: { description: 'Created' } } },
  },
  '/customers': {
    get: { tags: ['Customers'], summary: 'قائمة العملاء', responses: { 200: { description: 'Customer list' } } },
    post: { tags: ['Customers'], summary: 'إضافة عميل', responses: { 201: { description: 'Created' } } },
  },
  '/purchase-orders': {
    get: { tags: ['Purchase Orders'], summary: 'قائمة أوامر الشراء', responses: { 200: { description: 'PO list' } } },
    post: { tags: ['Purchase Orders'], summary: 'إنشاء أمر شراء', responses: { 201: { description: 'Created' } } },
  },
  '/reports': {
    get: { tags: ['Reports'], summary: 'مركز التقارير', responses: { 200: { description: 'Report data' } } },
  },
  '/inventory/fabrics': {
    get: { tags: ['Inventory'], summary: 'مخزون الأقمشة', responses: { 200: { description: 'Fabric inventory' } } },
  },
  '/users': {
    get: { tags: ['Users'], summary: 'قائمة المستخدمين', responses: { 200: { description: 'User list' } } },
    post: { tags: ['Users'], summary: 'إنشاء مستخدم', responses: { 201: { description: 'Created' } } },
  },
  '/hr/employees': {
    get: { tags: ['HR'], summary: 'قائمة الموظفين', responses: { 200: { description: 'Employee list' } } },
  },
  '/notifications': {
    get: { tags: ['Notifications'], summary: 'قائمة الإشعارات', responses: { 200: { description: 'Notification list' } } },
  },
  '/exports': {
    get: { tags: ['Exports'], summary: 'مركز التصدير', responses: { 200: { description: 'Export endpoints' } } },
  },
  '/backups': {
    get: { tags: ['Backups'], summary: 'قائمة النسخ الاحتياطية', responses: { 200: { description: 'Backup list' } } },
  },
  '/health': {
    get: { tags: ['System'], summary: 'فحص صحة النظام', security: [], responses: { 200: { description: 'Health status' } } },
  },
  '/monitoring': {
    get: { tags: ['System'], summary: 'مراقبة النظام (superadmin)', responses: { 200: { description: 'Monitoring data' } } },
  },
  '/license/status': {
    get: { tags: ['License'], summary: 'حالة الترخيص', responses: { 200: { description: 'License status' } } },
  },
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
