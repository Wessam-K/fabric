const db = require('./database');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Generate simple colored PNG placeholder images ──
function generatePlaceholderPNG(width, height, r, g, b) {
  // Create raw pixel data (RGBA)
  const rawData = Buffer.alloc(height * (1 + width * 4)); // filter byte + pixels per row
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 4;
      // Simple gradient effect
      const shade = 1 - (y / height) * 0.3;
      rawData[px] = Math.round(r * shade);
      rawData[px + 1] = Math.round(g * shade);
      rawData[px + 2] = Math.round(b * shade);
      rawData[px + 3] = 255; // alpha
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // Build PNG file
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function seedImages() {
  const dirs = ['uploads/models', 'uploads/fabrics', 'uploads/accessories'];
  for (const dir of dirs) {
    const fullDir = path.join(__dirname, dir);
    if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
  }

  const colors = {
    models: [
      [180, 60, 60],   [60, 60, 180],  [60, 140, 80],  [160, 120, 40], [120, 60, 160],
      [40, 140, 160],  [180, 100, 40], [100, 40, 100], [60, 120, 60],  [140, 80, 80]
    ],
    fabrics: [
      [245,245,245], [220,210,180], [40,40,40],    [30,30,30],   [25,25,80],
      [25,25,80],    [250,250,240], [250,250,240], [60,80,180],  [80,130,200],
      [150,150,150], [220,210,180], [20,20,20],    [120,20,30],  [200,180,80],
      [255,255,255], [10,10,10],    [220,200,160], [20,20,60],   [240,240,240]
    ],
    accessories: [
      [200,200,200], [180,180,190], [160,130,80],  [180,180,180], [80,80,80],
      [60,60,70],    [100,100,110], [240,240,240],  [220,200,180], [200,30,30],
      [30,30,30],    [180,180,180], [240,220,200],  [200,200,180], [180,40,60]
    ]
  };

  const fabricCodes = ['CTN-001','CTN-002','CTN-003','PLY-001','PLY-002','SLK-001','SLK-002','LNN-001','DNM-001','DNM-002','WOL-001','WOL-002','CRP-001','VLV-001','TFL-001','LNG-001','LNG-002','LNG-003','LNG-004','LNG-005'];
  const modelCodes = ['DRS-001','PNT-001','JKT-001','SHR-001','SKR-001','ABY-001','TSH-001','VES-001','DRS-002','COT-001'];
  const accCodes = ['BTN-001','BTN-002','BTN-003','BTN-004','ZPR-001','ZPR-002','ZPR-003','THR-001','THR-002','LBL-001','LBL-002','PAD-001','PAD-002','ITF-001','OTH-001'];

  const images = { models: {}, fabrics: {}, accessories: {} };

  modelCodes.forEach((code, i) => {
    const [r, g, b] = colors.models[i];
    const filename = `mdl-seed-${code.toLowerCase()}.png`;
    fs.writeFileSync(path.join(__dirname, 'uploads/models', filename), generatePlaceholderPNG(200, 200, r, g, b));
    images.models[code] = `/uploads/models/${filename}`;
  });

  fabricCodes.forEach((code, i) => {
    const [r, g, b] = colors.fabrics[i];
    const filename = `fab-seed-${code.toLowerCase()}.png`;
    fs.writeFileSync(path.join(__dirname, 'uploads/fabrics', filename), generatePlaceholderPNG(200, 200, r, g, b));
    images.fabrics[code] = `/uploads/fabrics/${filename}`;
  });

  accCodes.forEach((code, i) => {
    const [r, g, b] = colors.accessories[i];
    const filename = `acc-seed-${code.toLowerCase()}.png`;
    fs.writeFileSync(path.join(__dirname, 'uploads/accessories', filename), generatePlaceholderPNG(200, 200, r, g, b));
    images.accessories[code] = `/uploads/accessories/${filename}`;
  });

  return images;
}

function seed() {
  console.log('Seeding WK-Hub database (v23 schema with all modules)...');

  // Generate placeholder images
  const images = seedImages();
  console.log('  ✓ Generated placeholder images for models, fabrics, and accessories');

  // Disable FK constraints during seed
  db.pragma('foreign_keys = OFF');

  // ──────────── Clear data (all tables including V15) ────────────
  const tables = [
    // V23 new tables
    'backups', 'documents', 'purchase_return_items', 'purchase_returns',
    'sales_return_items', 'sales_returns', 'samples',
    'sales_order_items', 'sales_orders', 'quotation_items', 'quotations',
    'qc_ncr', 'qc_inspection_items', 'qc_inspections', 'qc_template_items', 'qc_templates', 'qc_defect_codes',
    'production_schedule', 'production_lines',
    'packing_lists', 'shipment_items', 'shipments',
    'mrp_suggestions', 'mrp_runs',
    // Original tables
    'machine_maintenance', 'leave_requests', 'journal_entry_lines', 'journal_entries',
    'fabric_stock_movements', 'accessory_stock_movements', 'notifications',
    'user_permissions', 'hr_adjustments', 'payroll_records', 'payroll_periods',
    'attendance', 'attendance_imports',
    'partial_invoices', 'wo_extra_expenses', 'wo_accessories_detail', 'wo_fabric_batches', 'fabric_inventory_batches',
    'wo_accessory_consumption', 'wo_fabric_consumption', 'wo_waste', 'wo_invoices', 'stage_movement_log',
    'wo_stage_qc', 'customer_payments', 'accessory_inventory_batches',
    'cost_snapshots', 'supplier_payments', 'purchase_order_items', 'purchase_orders',
    'invoice_items', 'invoices',
    'wo_stages', 'wo_sizes', 'wo_accessories', 'wo_fabrics', 'work_orders',
    'bom_template_sizes', 'bom_template_accessories', 'bom_template_fabrics', 'bom_templates',
    'machines', 'accessories', 'fabrics', 'suppliers', 'customers', 'settings', 'stage_templates', 'models',
    'audit_log', 'users', 'employees', 'expenses'
  ];
  for (const t of tables) {
    try { db.exec(`DELETE FROM ${t}`); } catch {}
  }
  for (const t of ['model_accessories', 'model_fabrics', 'model_sizes', 'work_order_stages', 'production_stages', 'role_permissions', 'permission_definitions']) {
    try { db.exec(`DELETE FROM ${t}`); } catch {}
  }

  // Re-enable FK constraints
  db.pragma('foreign_keys = ON');

  // ──────────── Settings ────────────
  const insSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  [['masnaiya_default', '90'], ['masrouf_default', '50'], ['waste_pct_default', '5'], ['margin_default', '25'], ['low_stock_threshold', '10'], ['default_currency', 'EGP']].forEach(s => insSetting.run(...s));

  // ──────────── Customers (5) ────────────
  const insCust = db.prepare('INSERT INTO customers (code, name, phone, email, address, city, tax_number, credit_limit, notes) VALUES (?,?,?,?,?,?,?,?,?)');
  const cust1 = insCust.run('CUST-001', 'شركة الأناقة للملابس', '01012345678', 'elegance@example.com', 'شارع عباس العقاد - مدينة نصر', 'القاهرة', '123-456-789', 50000, 'عميل VIP - توريد شهري');
  const cust2 = insCust.run('CUST-002', 'بوتيك الورد', '01198765432', 'ward@example.com', 'شارع النيل - الدقي', 'الجيزة', '987-654-321', 30000, 'بوتيك نسائي فاخر');
  const cust3 = insCust.run('CUST-003', 'محلات الزيتون', '01055544433', 'zeitoun@example.com', 'شارع الهرم', 'الجيزة', null, 20000, 'سلسلة محلات - فرعين');
  const cust4 = insCust.run('CUST-004', 'مؤسسة النخبة للأزياء', '01077788899', 'elite@fashion.com', 'شارع التحرير - وسط البلد', 'القاهرة', '456-789-123', 100000, 'أكبر عميل - عقد سنوي');
  const cust5 = insCust.run('CUST-005', 'أتيليه سارة', '01033322211', 'sara.atelier@example.com', 'المعادي', 'القاهرة', null, 15000, 'أتيليه عرائس وسهرات');
  const custIds = { c1: cust1.lastInsertRowid, c2: cust2.lastInsertRowid, c3: cust3.lastInsertRowid, c4: cust4.lastInsertRowid, c5: cust5.lastInsertRowid };

  // ──────────── Stage Templates ────────────
  const insStage = db.prepare('INSERT INTO stage_templates (name, color, sort_order, is_default) VALUES (?,?,?,1)');
  [
    ['استلام قماش', '#3b82f6', 1],
    ['قص', '#8b5cf6', 2],
    ['خياطة', '#f59e0b', 3],
    ['تشطيب', '#10b981', 4],
    ['كي', '#06b6d4', 5],
    ['تغليف', '#a855f7', 6],
    ['مراجعة جودة', '#ef4444', 7],
    ['تسليم', '#22c55e', 8],
  ].forEach(s => insStage.run(...s));
  const stageTemplates = db.prepare('SELECT * FROM stage_templates WHERE is_default=1 ORDER BY sort_order').all();

  // ──────────── Suppliers (6) ────────────
  const insSup = db.prepare('INSERT INTO suppliers (code, name, supplier_type, contact_name, phone, email, address, notes) VALUES (?,?,?,?,?,?,?,?)');
  const sup1 = insSup.run('SUP-001', 'مصنع النسيج المصري', 'fabric', 'أحمد حسن', '01012345678', 'ahmed@textile-eg.com', 'المنطقة الصناعية - العاشر من رمضان', 'مورد أقمشة قطنية ممتاز');
  const sup2 = insSup.run('SUP-002', 'شركة الأقمشة الدولية', 'fabric', 'محمد علي', '01198765432', 'info@intl-fabrics.com', 'وسط البلد - القاهرة', 'بوليستر وأقمشة صناعية');
  const sup3 = insSup.run('SUP-003', 'مصنع الأزرار', 'accessory', 'فاطمة سعيد', '01055544433', 'buttons@factory.com', 'شبرا الخيمة', 'أزرار ومستلزمات');
  const sup4 = insSup.run('SUP-004', 'شركة السوست', 'accessory', 'خالد محمود', '01077788899', 'zippers@co.com', 'حلوان', 'سوست وإكسسوارات');
  const sup5 = insSup.run('SUP-005', 'واردات الحرير', 'fabric', 'سارة أحمد', '01033322211', 'silk@imports.com', 'الإسكندرية', 'حرير طبيعي ومستورد');
  const sup6 = insSup.run('SUP-006', 'مصنع البطائن', 'fabric', 'يوسف إبراهيم', '01099988877', 'lining@factory.com', 'المنصورة', 'بطائن بجميع الأنواع');

  // ──────────── Fabrics (20) — with stock tracking + images ────────────
  const insFab = db.prepare('INSERT INTO fabrics (code, name, fabric_type, price_per_m, supplier, supplier_id, color, available_meters, low_stock_threshold, image_path) VALUES (?,?,?,?,?,?,?,?,?,?)');
  [
    ['CTN-001', 'قطن مصري ممتاز',  'main',   120, 'مصنع النسيج المصري',      sup1.lastInsertRowid, 'أبيض',     80,  20],
    ['CTN-002', 'قطن مخلوط',       'main',    95, 'مصنع النسيج المصري',      sup1.lastInsertRowid, 'بيج',      55,  20],
    ['CTN-003', 'قطن لايكرا',       'main',   130, 'مصنع النسيج المصري',      sup1.lastInsertRowid, 'أسود',     45,  20],
    ['PLY-001', 'بوليستر ساتان',    'main',    85, 'شركة الأقمشة الدولية',    sup2.lastInsertRowid, 'أسود',     30,  15],
    ['PLY-002', 'بوليستر كريب',     'main',    90, 'شركة الأقمشة الدولية',    sup2.lastInsertRowid, 'كحلي',     25,  15],
    ['SLK-001', 'حرير شيفون',      'main',   250, 'واردات الحرير',           sup5.lastInsertRowid, 'كحلي',     18,  10],
    ['SLK-002', 'حرير طبيعي',      'main',   320, 'واردات الحرير',           sup5.lastInsertRowid, 'أوف وايت', 12,  10],
    ['LNN-001', 'كتان طبيعي',      'main',   180, 'مصنع الكتان',            null,                 'أوف وايت', 35,  15],
    ['DNM-001', 'جينز ثقيل',       'main',   110, 'مصانع الجينز',           null,                 'أزرق',     60,  20],
    ['DNM-002', 'جينز خفيف',       'main',    90, 'مصانع الجينز',           null,                 'أزرق فاتح', 40,  20],
    ['WOL-001', 'صوف مخلوط',       'main',   200, 'شركة الصوف',             null,                 'رمادي',     22,  10],
    ['WOL-002', 'صوف كشمير',       'main',   350, 'شركة الصوف',             null,                 'بيج',       15,  10],
    ['CRP-001', 'كريب ثقيل',       'main',   150, 'مصنع الأقمشة',           null,                 'أسود',      50,  15],
    ['VLV-001', 'قطيفة',           'both',   170, 'مصنع القطيفة',           null,                 'عنابي',     20,  10],
    ['TFL-001', 'تافتا',           'main',   140, 'مصنع الأقمشة',           null,                 'ذهبي',      28,  10],
    ['LNG-001', 'بطانة قطن',       'lining',  45, 'مصنع البطائن',           sup6.lastInsertRowid, 'أبيض',     70,  30],
    ['LNG-002', 'بطانة بوليستر',    'lining',  35, 'مصنع البطائن',           sup6.lastInsertRowid, 'أسود',     55,  30],
    ['LNG-003', 'بطانة ساتان',     'lining',  55, 'مصنع البطائن',           sup6.lastInsertRowid, 'بيج',      40,  25],
    ['LNG-004', 'بطانة حرير',      'lining',  90, 'مصنع البطائن',           sup6.lastInsertRowid, 'كحلي',     20,  10],
    ['LNG-005', 'بطانة شفافة',     'lining',  25, 'مصنع البطائن',           sup6.lastInsertRowid, 'أبيض',     35,  15],
  ].forEach(f => insFab.run(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], images.fabrics[f[0]] || null));

  // ──────────── Accessories (15) — with stock tracking + images ────────────
  const insAcc = db.prepare('INSERT INTO accessories (code, acc_type, name, unit_price, unit, supplier, supplier_id, quantity_on_hand, low_stock_threshold, reorder_qty, image_path) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  [
    ['BTN-001', 'button',       'زرار بلاستيك صغير',    0.5,  'piece', 'مصنع الأزرار',  sup3.lastInsertRowid, 500, 100, 500],
    ['BTN-002', 'button',       'زرار معدني فضي',       2.0,  'piece', 'مصنع الأزرار',  sup3.lastInsertRowid, 200, 50, 200],
    ['BTN-003', 'button',       'زرار خشب طبيعي',       3.5,  'piece', 'مصنع الأزرار',  sup3.lastInsertRowid, 150, 30, 100],
    ['BTN-004', 'button',       'زرار كبس معدني',       1.0,  'piece', 'مصنع الأزرار',  sup3.lastInsertRowid, 300, 50, 200],
    ['ZPR-001', 'zipper',       'سوستة معدنية 20سم',    8.0,  'piece', 'شركة السوست',   sup4.lastInsertRowid, 80,  20, 100],
    ['ZPR-002', 'zipper',       'سوستة مخفية 50سم',    12.0,  'piece', 'شركة السوست',   sup4.lastInsertRowid, 60,  15, 80],
    ['ZPR-003', 'zipper',       'سوستة بلاستيك 15سم',   5.0,  'piece', 'شركة السوست',   sup4.lastInsertRowid, 120, 25, 100],
    ['THR-001', 'thread',       'خيط بوليستر أبيض',    15.0,  'roll',  'مصنع الخيوط',   null,                  40, 10, 50],
    ['THR-002', 'thread',       'خيط حرير',            25.0,  'roll',  'مصنع الخيوط',   null,                  8,  5,  20],
    ['LBL-001', 'label',        'ليبل ماركة منسوج',     1.5,  'piece', 'مصنع الليبلات',  null,                 400, 100, 500],
    ['LBL-002', 'label',        'ليبل مقاس',            0.3,  'piece', 'مصنع الليبلات',  null,                 600, 100, 500],
    ['PAD-001', 'padding',      'حشو كتف',              3.0,  'piece', 'مصنع الحشو',    null,                  45, 20, 50],
    ['PAD-002', 'padding',      'حشو صدر',              5.0,  'piece', 'مصنع الحشو',    null,                  30, 10, 40],
    ['ITF-001', 'interfacing',  'فازلين لاصق',         20.0,  'meter', 'مصنع الفازلين',  null,                  25, 10, 50],
    ['OTH-001', 'other',        'شريط ساتان',           5.0,  'meter', 'مصنع الشرائط',   null,                  35, 10, 30],
  ].forEach(a => insAcc.run(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], images.accessories[a[0]] || null));

  // ──────────── Models (10 — with images) ────────────
  const insModel = db.prepare('INSERT INTO models (serial_number, model_code, model_name, category, gender, notes, model_image) VALUES (?,?,?,?,?,?,?)');

  const m1  = insModel.run('1-001', 'DRS-001', 'فستان سهرة كلاسيك',   'فساتين',  'female', 'فستان سهرة طويل بأكمام وتطريز يدوي', images.models['DRS-001']);
  const m2  = insModel.run('1-002', 'PNT-001', 'بنطلون جينز كاجوال',  'بناطيل',  'male',   'بنطلون جينز بقصة مستقيمة مع 5 جيوب', images.models['PNT-001']);
  const m3  = insModel.run('1-003', 'JKT-001', 'جاكيت صوف رسمي',     'جاكيتات', 'male',   'جاكيت صوف بليزر بطانة ساتان وحشو كتف', images.models['JKT-001']);
  const m4  = insModel.run('1-004', 'SHR-001', 'قميص رسمي قطن',      'قمصان',   'male',   'قميص رسمي بياقة كلاسيك وأزرار صدف', images.models['SHR-001']);
  const m5  = insModel.run('1-005', 'SKR-001', 'تنورة كريب ميدي',    'أخرى',    'female', 'تنورة ميدي بقصة A-line مع حزام', images.models['SKR-001']);
  const m6  = insModel.run('1-006', 'ABY-001', 'عباية كريب مطرزة',    'أخرى',    'female', 'عباية كريب سوداء بتطريز ذهبي على الأكمام', images.models['ABY-001']);
  const m7  = insModel.run('1-007', 'TSH-001', 'تيشيرت قطن لايكرا',  'قمصان',   'male',   'تيشيرت رجالي بياقة دائرية', images.models['TSH-001']);
  const m8  = insModel.run('1-008', 'VES-001', 'فيست صوف كشمير',     'جاكيتات', 'male',   'فيست رسمي بدون أكمام بطانة ساتان', images.models['VES-001']);
  const m9  = insModel.run('1-009', 'DRS-002', 'فستان كتان صيفي',    'فساتين',  'female', 'فستان صيفي من الكتان الطبيعي بقصة واسعة', images.models['DRS-002']);
  const m10 = insModel.run('1-010', 'COT-001', 'معطف شتوي طويل',     'أخرى',    'unisex', 'معطف شتوي بطانة حرير وحشو حراري', images.models['COT-001']);

  const modelIds = {
    m1: m1.lastInsertRowid, m2: m2.lastInsertRowid, m3: m3.lastInsertRowid,
    m4: m4.lastInsertRowid, m5: m5.lastInsertRowid, m6: m6.lastInsertRowid,
    m7: m7.lastInsertRowid, m8: m8.lastInsertRowid, m9: m9.lastInsertRowid,
    m10: m10.lastInsertRowid,
  };

  // ──────────── BOM Templates (one default per model) ────────────
  const insBom = db.prepare('INSERT INTO bom_templates (model_id, template_name, is_default, masnaiya, masrouf, margin_pct) VALUES (?,?,1,?,?,?)');
  const insBF = db.prepare('INSERT INTO bom_template_fabrics (template_id, fabric_code, role, meters_per_piece, waste_pct, color_note, sort_order) VALUES (?,?,?,?,?,?,?)');
  const insBA = db.prepare('INSERT INTO bom_template_accessories (template_id, accessory_code, accessory_name, quantity, unit_price) VALUES (?,?,?,?,?)');
  const insBS = db.prepare('INSERT INTO bom_template_sizes (template_id, color_label, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl) VALUES (?,?,?,?,?,?,?,?)');

  function createBom(modelId, masnaiya, masrouf, marginPct, fabrics, accessories, sizes) {
    const b = insBom.run(modelId, 'الافتراضي', masnaiya, masrouf, marginPct);
    const tid = b.lastInsertRowid;
    fabrics.forEach((f, i) => insBF.run(tid, f.code, f.role, f.meters, f.waste || 0, f.color || null, i));
    accessories.forEach(a => insBA.run(tid, a.code, a.name, a.qty, a.price));
    sizes.forEach(s => insBS.run(tid, s.color, s.s || 0, s.m || 0, s.l || 0, s.xl || 0, s.xxl || 0, s.xxxl || 0));
    return tid;
  }

  createBom(modelIds.m1, 90, 50, 25,
    [{ code: 'SLK-001', role: 'main', meters: 2.5, waste: 5, color: 'كحلي' }, { code: 'LNG-003', role: 'lining', meters: 2.0, color: 'بيج' }],
    [{ code: 'ZPR-002', name: 'سوستة مخفية', qty: 1, price: 12 }, { code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }, { code: 'THR-002', name: 'خيط حرير', qty: 0.5, price: 25 }],
    [{ color: 'كحلي', s: 5, m: 10, l: 15, xl: 10, xxl: 5 }, { color: 'أسود', s: 3, m: 8, l: 12, xl: 8, xxl: 4 }, { color: 'عنابي', s: 2, m: 6, l: 10, xl: 6, xxl: 3 }]
  );
  createBom(modelIds.m2, 70, 40, 20,
    [{ code: 'DNM-001', role: 'main', meters: 1.8, waste: 3, color: 'أزرق' }, { code: 'LNG-001', role: 'lining', meters: 0.5, color: 'أبيض' }],
    [{ code: 'BTN-002', name: 'زرار معدني', qty: 1, price: 2 }, { code: 'ZPR-001', name: 'سوستة معدنية', qty: 1, price: 8 }, { code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }, { code: 'BTN-004', name: 'زرار كبس', qty: 1, price: 1 }],
    [{ color: 'أزرق فاتح', s: 8, m: 15, l: 20, xl: 15, xxl: 8, xxxl: 3 }, { color: 'أزرق غامق', s: 5, m: 12, l: 18, xl: 12, xxl: 5, xxxl: 2 }, { color: 'أسود', s: 4, m: 10, l: 15, xl: 10, xxl: 6, xxxl: 2 }]
  );
  createBom(modelIds.m3, 120, 60, 30,
    [{ code: 'WOL-001', role: 'main', meters: 2.8, waste: 5, color: 'رمادي' }, { code: 'LNG-003', role: 'lining', meters: 2.5, color: 'بيج' }],
    [{ code: 'BTN-002', name: 'زرار معدني فضي', qty: 4, price: 2 }, { code: 'PAD-001', name: 'حشو كتف', qty: 2, price: 3 }, { code: 'ITF-001', name: 'فازلين لاصق', qty: 1.5, price: 20 }, { code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }, { code: 'THR-001', name: 'خيط بوليستر', qty: 1, price: 15 }],
    [{ color: 'رمادي', s: 3, m: 8, l: 12, xl: 10, xxl: 5, xxxl: 2 }, { color: 'كحلي', s: 2, m: 6, l: 10, xl: 8, xxl: 4, xxxl: 1 }]
  );
  createBom(modelIds.m4, 60, 35, 25,
    [{ code: 'CTN-001', role: 'main', meters: 1.6, waste: 4, color: 'أبيض' }],
    [{ code: 'BTN-001', name: 'زرار بلاستيك', qty: 8, price: 0.5 }, { code: 'ITF-001', name: 'فازلين ياقة', qty: 0.3, price: 20 }, { code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }, { code: 'THR-001', name: 'خيط بوليستر', qty: 0.5, price: 15 }],
    [{ color: 'أبيض', s: 10, m: 20, l: 25, xl: 20, xxl: 10, xxxl: 5 }, { color: 'أزرق فاتح', s: 8, m: 15, l: 20, xl: 15, xxl: 8, xxxl: 3 }, { color: 'وردي', s: 5, m: 10, l: 12, xl: 10, xxl: 5, xxxl: 2 }]
  );
  createBom(modelIds.m5, 55, 30, 25,
    [{ code: 'CRP-001', role: 'main', meters: 1.2, waste: 3, color: 'أسود' }, { code: 'LNG-002', role: 'lining', meters: 0.8, color: 'أسود' }],
    [{ code: 'ZPR-002', name: 'سوستة مخفية', qty: 1, price: 12 }, { code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }, { code: 'OTH-001', name: 'شريط حزام', qty: 0.8, price: 5 }],
    [{ color: 'أسود', s: 6, m: 12, l: 18, xl: 12, xxl: 6 }, { color: 'عنابي', s: 4, m: 8, l: 12, xl: 8, xxl: 4 }, { color: 'كحلي', s: 3, m: 6, l: 10, xl: 6, xxl: 3 }]
  );
  createBom(modelIds.m6, 100, 45, 20,
    [{ code: 'CRP-001', role: 'main', meters: 3.5, waste: 4, color: 'أسود' }, { code: 'LNG-002', role: 'lining', meters: 3.0, color: 'أسود' }],
    [{ code: 'OTH-001', name: 'شريط ساتان تزيين', qty: 2, price: 5 }, { code: 'BTN-004', name: 'كبس مخفي', qty: 3, price: 1 }, { code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }, { code: 'THR-002', name: 'خيط حرير', qty: 1, price: 25 }],
    [{ color: 'أسود/ذهبي', s: 8, m: 15, l: 20, xl: 15, xxl: 8, xxxl: 4 }, { color: 'أسود/فضي', s: 5, m: 10, l: 15, xl: 10, xxl: 5, xxxl: 2 }]
  );
  createBom(modelIds.m7, 40, 20, 30,
    [{ code: 'CTN-003', role: 'main', meters: 1.0, waste: 3, color: 'أسود' }],
    [{ code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }, { code: 'THR-001', name: 'خيط بوليستر', qty: 0.3, price: 15 }],
    [{ color: 'أسود', s: 15, m: 25, l: 30, xl: 25, xxl: 15, xxxl: 5 }, { color: 'أبيض', s: 12, m: 20, l: 25, xl: 20, xxl: 12, xxxl: 4 }, { color: 'رمادي', s: 10, m: 18, l: 22, xl: 18, xxl: 10, xxxl: 3 }, { color: 'كحلي', s: 8, m: 15, l: 20, xl: 15, xxl: 8, xxxl: 2 }]
  );
  createBom(modelIds.m8, 80, 40, 25,
    [{ code: 'WOL-002', role: 'main', meters: 1.2, waste: 4, color: 'بيج' }, { code: 'LNG-003', role: 'lining', meters: 1.0, color: 'بيج' }],
    [{ code: 'BTN-003', name: 'زرار خشب', qty: 5, price: 3.5 }, { code: 'ITF-001', name: 'فازلين', qty: 0.5, price: 20 }, { code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }],
    [{ color: 'بيج', s: 3, m: 6, l: 10, xl: 8, xxl: 4, xxxl: 2 }, { color: 'رمادي غامق', s: 2, m: 5, l: 8, xl: 6, xxl: 3, xxxl: 1 }]
  );
  createBom(modelIds.m9, 65, 30, 20,
    [{ code: 'LNN-001', role: 'main', meters: 2.2, waste: 4, color: 'أوف وايت' }, { code: 'LNG-005', role: 'lining', meters: 1.8, color: 'أبيض' }],
    [{ code: 'BTN-003', name: 'زرار خشب', qty: 6, price: 3.5 }, { code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }, { code: 'OTH-001', name: 'شريط حزام', qty: 1.2, price: 5 }],
    [{ color: 'أوف وايت', s: 4, m: 8, l: 14, xl: 10, xxl: 5, xxxl: 2 }, { color: 'بيج', s: 3, m: 6, l: 10, xl: 8, xxl: 4, xxxl: 1 }]
  );
  createBom(modelIds.m10, 150, 70, 25,
    [{ code: 'WOL-002', role: 'main', meters: 3.5, waste: 5, color: 'بيج' }, { code: 'LNG-004', role: 'lining', meters: 3.2, color: 'كحلي' }],
    [{ code: 'BTN-002', name: 'زرار معدني', qty: 6, price: 2 }, { code: 'PAD-001', name: 'حشو كتف', qty: 2, price: 3 }, { code: 'PAD-002', name: 'حشو صدر', qty: 2, price: 5 }, { code: 'ITF-001', name: 'فازلين', qty: 2, price: 20 }, { code: 'LBL-001', name: 'ليبل ماركة', qty: 1, price: 1.5 }, { code: 'LBL-002', name: 'ليبل مقاس', qty: 1, price: 0.3 }, { code: 'THR-002', name: 'خيط حرير', qty: 1.5, price: 25 }],
    [{ color: 'بيج', s: 2, m: 5, l: 8, xl: 6, xxl: 3, xxxl: 1 }, { color: 'أسود', s: 2, m: 4, l: 7, xl: 5, xxl: 3, xxxl: 1 }]
  );

  // ──────────── Work Orders (4) ────────────
  const insWO = db.prepare('INSERT INTO work_orders (wo_number, model_id, template_id, status, priority, assigned_to, masnaiya, masrouf, margin_pct, consumer_price, wholesale_price, notes, start_date, due_date, customer_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insWF = db.prepare('INSERT INTO wo_fabrics (wo_id, fabric_code, role, meters_per_piece, waste_pct, color_note, sort_order) VALUES (?,?,?,?,?,?,?)');
  const insWA = db.prepare('INSERT INTO wo_accessories (wo_id, accessory_code, accessory_name, quantity, unit_price) VALUES (?,?,?,?,?)');
  const insWS = db.prepare('INSERT INTO wo_sizes (wo_id, color_label, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl) VALUES (?,?,?,?,?,?,?,?)');
  const insWSt = db.prepare('INSERT INTO wo_stages (wo_id, stage_name, sort_order, status, assigned_to, started_at, completed_at) VALUES (?,?,?,?,?,?,?)');

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const twentyDaysAgo = new Date(Date.now() - 20 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const inTenDays = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const inTwentyDays = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);

  // WO-001: in_progress (DRS-001 فستان سهرة) — first 2 stages done, 3rd in progress
  const wo1 = insWO.run('WO-2026-001', modelIds.m1, null, 'in_progress', 'high', 'ورشة 1', 90, 50, 25, 450, 350, 'طلبية محل الزيتون', fiveDaysAgo, inTenDays, custIds.c3);
  const wo1id = wo1.lastInsertRowid;
  insWF.run(wo1id, 'SLK-001', 'main', 2.5, 5, 'كحلي', 0);
  insWF.run(wo1id, 'LNG-003', 'lining', 2.0, 0, 'بيج', 1);
  insWA.run(wo1id, 'ZPR-002', 'سوستة مخفية', 1, 12);
  insWA.run(wo1id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo1id, 'LBL-002', 'ليبل مقاس', 1, 0.3);
  insWA.run(wo1id, 'THR-002', 'خيط حرير', 0.5, 25);
  insWS.run(wo1id, 'كحلي', 5, 10, 15, 10, 5, 0);
  insWS.run(wo1id, 'أسود', 3, 8, 12, 8, 4, 0);
  insWS.run(wo1id, 'عنابي', 2, 6, 10, 6, 3, 0);
  stageTemplates.forEach((s, i) => {
    const status = i < 2 ? 'completed' : i === 2 ? 'in_progress' : 'pending';
    const started = i <= 2 ? fiveDaysAgo : null;
    const completed = i < 2 ? fiveDaysAgo : null;
    insWSt.run(wo1id, s.name, s.sort_order, status, 'ورشة 1', started, completed);
  });

  // WO-002: draft (PNT-001 بنطلون)
  const wo2 = insWO.run('WO-2026-002', modelIds.m2, null, 'draft', 'normal', 'ورشة 2', 70, 40, 20, 280, 220, 'طلبية شركة', null, inTwentyDays, custIds.c4);
  const wo2id = wo2.lastInsertRowid;
  insWF.run(wo2id, 'DNM-001', 'main', 1.8, 3, 'أزرق', 0);
  insWF.run(wo2id, 'LNG-001', 'lining', 0.5, 0, 'أبيض', 1);
  insWA.run(wo2id, 'BTN-002', 'زرار معدني', 1, 2);
  insWA.run(wo2id, 'ZPR-001', 'سوستة معدنية', 1, 8);
  insWA.run(wo2id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo2id, 'LBL-002', 'ليبل مقاس', 1, 0.3);
  insWA.run(wo2id, 'BTN-004', 'زرار كبس', 1, 1);
  insWS.run(wo2id, 'أزرق فاتح', 8, 15, 20, 15, 8, 3);
  insWS.run(wo2id, 'أزرق غامق', 5, 12, 18, 12, 5, 2);
  insWS.run(wo2id, 'أسود', 4, 10, 15, 10, 6, 2);
  stageTemplates.forEach(s => insWSt.run(wo2id, s.name, s.sort_order, 'pending', null, null, null));

  // WO-003: completed (TSH-001 تيشيرت)
  const wo3 = insWO.run('WO-2026-003', modelIds.m7, null, 'completed', 'low', 'ورشة 1', 40, 20, 30, 120, 90, 'طلبية سنوية', twentyDaysAgo, null, custIds.c1);
  const wo3id = wo3.lastInsertRowid;
  insWF.run(wo3id, 'CTN-003', 'main', 1.0, 3, 'أسود', 0);
  insWA.run(wo3id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo3id, 'LBL-002', 'ليبل مقاس', 1, 0.3);
  insWA.run(wo3id, 'THR-001', 'خيط بوليستر', 0.3, 15);
  insWS.run(wo3id, 'أسود', 15, 25, 30, 25, 15, 5);
  insWS.run(wo3id, 'أبيض', 12, 20, 25, 20, 12, 4);
  insWS.run(wo3id, 'رمادي', 10, 18, 22, 18, 10, 3);
  insWS.run(wo3id, 'كحلي', 8, 15, 20, 15, 8, 2);
  stageTemplates.forEach(s => insWSt.run(wo3id, s.name, s.sort_order, 'completed', 'ورشة 1', twentyDaysAgo, twentyDaysAgo));

  // WO-004: cancelled (SKR-001 تنورة كريب) — cancelled after fabric receipt
  const wo4 = insWO.run('WO-2026-004', modelIds.m5, null, 'cancelled', 'normal', 'ورشة 1', 55, 30, 25, 180, 140, 'تم الإلغاء - تغيير طلب العميل', tenDaysAgo, inTenDays, custIds.c5);
  const wo4id = wo4.lastInsertRowid;
  db.prepare('UPDATE work_orders SET cancel_reason=?, cancelled_at=? WHERE id=?').run('العميل غيّر الطلبية بالكامل وطلب تصميم مختلف', tenDaysAgo, wo4id);
  insWF.run(wo4id, 'CRP-001', 'main', 1.2, 3, 'أسود', 0);
  insWF.run(wo4id, 'LNG-002', 'lining', 0.8, 0, 'أسود', 1);
  insWA.run(wo4id, 'ZPR-002', 'سوستة مخفية', 1, 12);
  insWA.run(wo4id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo4id, 'LBL-002', 'ليبل مقاس', 1, 0.3);
  insWA.run(wo4id, 'OTH-001', 'شريط ساتان', 0.8, 5);
  insWS.run(wo4id, 'أسود', 6, 12, 18, 12, 6, 0);
  stageTemplates.forEach(s => insWSt.run(wo4id, s.name, s.sort_order, 'skipped', null, null, null));

  // ──────────── Purchase Orders (4) ────────────
  const insPO = db.prepare('INSERT INTO purchase_orders (po_number, supplier_id, po_type, total_amount, paid_amount, status, expected_date, notes) VALUES (?,?,?,?,?,?,?,?)');
  const insPOI = db.prepare('INSERT INTO purchase_order_items (po_id, item_type, fabric_code, accessory_code, description, quantity, unit, unit_price) VALUES (?,?,?,?,?,?,?,?)');

  const po1 = insPO.run('PO-2026-001', sup1.lastInsertRowid, 'fabric', 6000, 6000, 'received', '2026-02-20', 'طلبية أقمشة قطنية');
  insPOI.run(po1.lastInsertRowid, 'fabric', 'CTN-001', null, 'قطن مصري ممتاز', 30, 'meter', 120);
  insPOI.run(po1.lastInsertRowid, 'fabric', 'CTN-002', null, 'قطن مخلوط', 25, 'meter', 95);

  const po2 = insPO.run('PO-2026-002', sup3.lastInsertRowid, 'accessory', 1200, 0, 'sent', '2026-03-15', 'طلبية أزرار وإكسسوارات');
  insPOI.run(po2.lastInsertRowid, 'accessory', null, 'BTN-001', 'زرار بلاستيك صغير', 500, 'piece', 0.5);
  insPOI.run(po2.lastInsertRowid, 'accessory', null, 'BTN-002', 'زرار معدني فضي', 200, 'piece', 2);
  insPOI.run(po2.lastInsertRowid, 'accessory', null, 'ZPR-001', 'سوستة معدنية 20سم', 50, 'piece', 8);
  insPOI.run(po2.lastInsertRowid, 'accessory', null, 'LBL-001', 'ليبل ماركة منسوج', 100, 'piece', 1.5);

  const po3 = insPO.run('PO-2026-003', sup5.lastInsertRowid, 'fabric', 12500, 0, 'draft', '2026-04-01', 'طلبية حرير - عرض سعر');
  insPOI.run(po3.lastInsertRowid, 'fabric', 'SLK-001', null, 'حرير شيفون', 25, 'meter', 250);
  insPOI.run(po3.lastInsertRowid, 'fabric', 'SLK-002', null, 'حرير طبيعي', 20, 'meter', 320);

  const po4 = insPO.run('PO-2026-004', sup6.lastInsertRowid, 'fabric', 2000, 1500, 'received', '2026-02-28', 'طلبية بطائن');
  insPOI.run(po4.lastInsertRowid, 'fabric', 'LNG-001', null, 'بطانة قطن', 20, 'meter', 45);
  insPOI.run(po4.lastInsertRowid, 'fabric', 'LNG-002', null, 'بطانة بوليستر', 15, 'meter', 35);
  insPOI.run(po4.lastInsertRowid, 'fabric', 'LNG-003', null, 'بطانة ساتان', 10, 'meter', 55);

  // ──────────── Supplier Payments ────────────
  const insPayment = db.prepare('INSERT INTO supplier_payments (supplier_id, po_id, amount, payment_method, reference, notes) VALUES (?,?,?,?,?,?)');
  insPayment.run(sup1.lastInsertRowid, po1.lastInsertRowid, 6000, 'bank', 'TRF-2026-001', 'سداد كامل - طلبية أقمشة');
  insPayment.run(sup6.lastInsertRowid, po4.lastInsertRowid, 1500, 'cash', null, 'دفعة أولى - بطائن');

  // ──────────── V4: Fabric Inventory Batches (from received POs) ────────────
  const insBatch = db.prepare(`INSERT INTO fabric_inventory_batches (batch_code, fabric_code, supplier_id, po_id, po_item_id, received_meters, price_per_meter, used_meters, wasted_meters, batch_status, received_date, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  // PO-001 received: CTN-001 30m, CTN-002 25m
  const batch1 = insBatch.run('FB-2026-0001', 'CTN-001', sup1.lastInsertRowid, po1.lastInsertRowid, null, 30, 120, 0, 0, 'available', '2026-02-20', 'دفعة من PO-2026-001');
  const batch2 = insBatch.run('FB-2026-0002', 'CTN-002', sup1.lastInsertRowid, po1.lastInsertRowid, null, 25, 95, 0, 0, 'available', '2026-02-20', 'دفعة من PO-2026-001');
  // PO-004 received: LNG-001 20m, LNG-002 15m, LNG-003 10m
  const batch3 = insBatch.run('FB-2026-0003', 'LNG-001', sup6.lastInsertRowid, po4.lastInsertRowid, null, 20, 45, 0, 0, 'available', '2026-02-28', 'دفعة من PO-2026-004');
  const batch4 = insBatch.run('FB-2026-0004', 'LNG-002', sup6.lastInsertRowid, po4.lastInsertRowid, null, 15, 35, 0, 0, 'available', '2026-02-28', 'دفعة من PO-2026-004');
  const batch5 = insBatch.run('FB-2026-0005', 'LNG-003', sup6.lastInsertRowid, po4.lastInsertRowid, null, 10, 55, 0, 0, 'available', '2026-02-28', 'دفعة من PO-2026-004');

  // ──────────── Invoices (6) — with customer_id ────────────
  const insInv = db.prepare('INSERT INTO invoices (invoice_number, customer_name, customer_phone, customer_email, notes, subtotal, tax_pct, discount, total, status, due_date, wo_id, customer_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insII = db.prepare('INSERT INTO invoice_items (invoice_id, model_code, description, variant, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,?,?)');

  const inv1 = insInv.run('INV-001', 'محلات الزيتون', '01055544433', 'zeitoun@example.com',
    'طلبية محل الزيتون - الدفعة الأولى', 15750, 14, 500, 17455, 'paid', '2026-02-28', wo1id, custIds.c3, '2026-02-10 10:00:00');
  insII.run(inv1.lastInsertRowid, 'DRS-001', 'فستان سهرة كلاسيك - كحلي', 'كحلي', 15, 450, 6750, 0);
  insII.run(inv1.lastInsertRowid, 'SKR-001', 'تنورة كريب ميدي - أسود', 'أسود', 20, 180, 3600, 1);
  insII.run(inv1.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن - أبيض', 'أبيض', 30, 220, 6600, 2);
  insII.run(inv1.lastInsertRowid, null, 'خدمة توصيل', null, 1, 200, 200, 3);

  const inv2 = insInv.run('INV-002', 'بوتيك الورد', '01198765432', 'ward@example.com',
    'طلبية خاصة - حفل زفاف', 22500, 14, 1000, 24650, 'sent', '2026-03-20', null, custIds.c2, '2026-03-01 14:30:00');
  insII.run(inv2.lastInsertRowid, 'DRS-001', 'فستان سهرة كلاسيك - عنابي', 'عنابي', 25, 450, 11250, 0);
  insII.run(inv2.lastInsertRowid, 'ABY-001', 'عباية كريب مطرزة - أسود/ذهبي', 'أسود/ذهبي', 15, 550, 8250, 1);
  insII.run(inv2.lastInsertRowid, 'VES-001', 'فيست صوف كشمير - بيج', 'بيج', 10, 400, 4000, 2);
  insII.run(inv2.lastInsertRowid, null, 'تعديلات خاصة', null, 1, 500, 500, 3);

  const inv3 = insInv.run('INV-003', 'مؤسسة النخبة للأزياء', '01077788899', 'elite@fashion.com',
    'عرض سعر مبدئي - محل الأناقة', 9600, 0, 0, 9600, 'draft', '2026-04-01', null, custIds.c4, '2026-03-10 09:00:00');
  insII.run(inv3.lastInsertRowid, 'PNT-001', 'بنطلون جينز كاجوال - أزرق', 'أزرق فاتح', 20, 280, 5600, 0);
  insII.run(inv3.lastInsertRowid, 'TSH-001', 'تيشيرت قطن لايكرا - أسود', 'أسود', 40, 120, 4800, 1);

  const inv4 = insInv.run('INV-004', 'شركة الأناقة للملابس', '01012345678', 'elegance@example.com',
    'طلبية شهرية - بوتيك الورد', 18200, 14, 200, 20548, 'overdue', '2026-02-15', null, custIds.c1, '2026-01-20 11:00:00');
  insII.run(inv4.lastInsertRowid, 'DRS-002', 'فستان كتان صيفي - أوف وايت', 'أوف وايت', 12, 320, 3840, 0);
  insII.run(inv4.lastInsertRowid, 'SKR-001', 'تنورة كريب ميدي - عنابي', 'عنابي', 18, 180, 3240, 1);
  insII.run(inv4.lastInsertRowid, 'ABY-001', 'عباية كريب مطرزة - أسود/فضي', 'أسود/فضي', 10, 550, 5500, 2);
  insII.run(inv4.lastInsertRowid, 'SHR-001', 'قميص رسمي - أزرق فاتح', 'أزرق فاتح', 15, 220, 3300, 3);
  insII.run(inv4.lastInsertRowid, null, 'تغليف هدايا', null, 10, 15, 150, 4);
  insII.run(inv4.lastInsertRowid, null, 'شحن سريع', null, 1, 350, 350, 5);

  const inv5 = insInv.run('INV-005', 'مؤسسة النخبة للأزياء', '01077788899', 'elite@fashion.com',
    'طلبية شركة - ملابس رسمية', 35200, 14, 2000, 37828, 'paid', '2026-03-01', wo3id, custIds.c4, '2026-02-15 16:00:00');
  insII.run(inv5.lastInsertRowid, 'JKT-001', 'جاكيت صوف رسمي - رمادي', 'رمادي', 20, 650, 13000, 0);
  insII.run(inv5.lastInsertRowid, 'VES-001', 'فيست صوف كشمير - رمادي غامق', 'رمادي غامق', 20, 400, 8000, 1);
  insII.run(inv5.lastInsertRowid, 'SHR-001', 'قميص رسمي - أبيض', 'أبيض', 40, 220, 8800, 2);
  insII.run(inv5.lastInsertRowid, 'PNT-001', 'بنطلون جينز - أسود', 'أسود', 20, 280, 5600, 3);

  const inv6 = insInv.run('INV-006', 'أتيليه سارة', '01033322211', 'sara.atelier@example.com',
    'تم الإلغاء بطلب العميل', 5400, 0, 0, 5400, 'cancelled', '2026-03-10', null, custIds.c5, '2026-03-05 08:30:00');
  insII.run(inv6.lastInsertRowid, 'TSH-001', 'تيشيرت قطن - رمادي', 'رمادي', 30, 120, 3600, 0);
  insII.run(inv6.lastInsertRowid, 'TSH-001', 'تيشيرت قطن - كحلي', 'كحلي', 15, 120, 1800, 1);

  // ──────────── Employees (15) ────────────
  const insEmp = db.prepare(`INSERT INTO employees (emp_code, full_name, national_id, department, job_title, employment_type, salary_type, base_salary, standard_hours_per_day, standard_days_per_month, housing_allowance, transport_allowance, food_allowance, other_allowances, social_insurance, tax_deduction, other_deductions_fixed, overtime_rate_multiplier, hire_date, status, phone, address, bank_account, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const emp = {};
  [
    ['EMP-001', 'محمد أحمد الشريف',   '29001011234567', 'الإدارة',   'مدير المصنع',      'full_time', 'monthly', 15000, 8, 26, 2000, 500, 300, 0,    750, 500, 0,   1.5, '2020-01-01', 'active', '01012345678', 'المعادي - القاهرة',    'BANK-001-01234', 'مدير عام'],
    ['EMP-002', 'فاطمة حسن إبراهيم',  '29501021234567', 'المحاسبة',  'رئيسة الحسابات',   'full_time', 'monthly', 10000, 8, 26, 1000, 400, 300, 0,    500, 300, 0,   1.5, '2021-03-15', 'active', '01198765432', 'مدينة نصر - القاهرة',  'BANK-002-05678', 'محاسبة خبرة 10 سنوات'],
    ['EMP-003', 'أحمد محمود عبدالله',  '28801031234567', 'الإنتاج',   'مشرف إنتاج',       'full_time', 'monthly', 8000,  8, 26, 800,  400, 300, 200,  400, 200, 0,   1.5, '2021-06-01', 'active', '01055544433', 'شبرا الخيمة',          'BANK-003-09012', 'مشرف خط الإنتاج الأول'],
    ['EMP-004', 'سارة عبدالرحمن',     '29201041234567', 'الموارد البشرية', 'مديرة HR',   'full_time', 'monthly', 9000,  8, 26, 800,  400, 300, 0,    450, 250, 0,   1.5, '2022-01-10', 'active', '01077788899', 'المقطم - القاهرة',     'BANK-004-03456', ''],
    ['EMP-005', 'خالد يوسف حسن',      '29101051234567', 'الإنتاج',   'خياط رئيسي',       'full_time', 'monthly', 6000,  8, 26, 500,  300, 300, 0,    300, 100, 0,   1.5, '2022-04-01', 'active', '01033322211', 'حلوان',                'BANK-005-07890', 'خبرة في الأقمشة الفاخرة'],
    ['EMP-006', 'نورا محمد السيد',     '29601061234567', 'الإنتاج',   'خياطة',            'full_time', 'monthly', 5000,  8, 26, 400,  300, 300, 0,    250, 80,  0,   1.5, '2022-06-15', 'active', '01099988877', 'العباسية - القاهرة',   null,             ''],
    ['EMP-007', 'عمر إبراهيم فتحي',   '29301071234567', 'الإنتاج',   'فني قص',           'full_time', 'monthly', 5500,  8, 26, 400,  300, 300, 0,    275, 90,  0,   1.5, '2022-08-01', 'active', '01066677788', 'الزيتون - القاهرة',    'BANK-007-12345', ''],
    ['EMP-008', 'منى أحمد جمال',      '29401081234567', 'الإنتاج',   'عاملة تشطيب',      'full_time', 'monthly', 4500,  8, 26, 300,  300, 300, 0,    225, 70,  0,   1.5, '2023-01-01', 'active', '01044455566', 'عين شمس - القاهرة',    null,             ''],
    ['EMP-009', 'حسن علي محمد',       '28901091234567', 'الإنتاج',   'فني كي',           'full_time', 'monthly', 4500,  8, 26, 300,  300, 300, 0,    225, 70,  0,   1.5, '2023-03-15', 'active', '01022233344', 'دار السلام - القاهرة', null,             ''],
    ['EMP-010', 'ياسمين سعيد حسن',    '29701101234567', 'الإنتاج',   'فنية تغليف',       'full_time', 'monthly', 4000,  8, 26, 300,  300, 300, 0,    200, 60,  0,   1.5, '2023-06-01', 'active', '01088899900', 'مصر الجديدة',          null,             ''],
    ['EMP-011', 'عبدالله حسين',       '29102111234567', 'المخازن',   'أمين مخزن',        'full_time', 'monthly', 5000,  8, 26, 400,  300, 300, 0,    250, 80,  0,   1.5, '2023-08-01', 'active', '01011122233', 'المرج - القاهرة',      'BANK-011-67890', ''],
    ['EMP-012', 'رحاب عادل محمود',    '29502121234567', 'المحاسبة',  'محاسبة',           'full_time', 'monthly', 6000,  8, 26, 500,  300, 300, 0,    300, 100, 0,   1.5, '2023-09-15', 'active', '01055566677', 'التجمع الخامس',       'BANK-012-11111', ''],
    ['EMP-013', 'مصطفى كمال',         '29003131234567', 'الإنتاج',   'عامل يومي',        'daily',     'daily',   200,   8, 26, 0,    0,   0,   0,    0,   0,   0,   1.5, '2024-01-10', 'active', '01077711122', 'بولاق الدكرور',       null,             'عمالة يومية'],
    ['EMP-014', 'أمل صلاح الدين',     '29203141234567', 'الإنتاج',   'عاملة مراجعة جودة', 'full_time', 'monthly', 5000,  8, 26, 400,  300, 300, 0,    250, 80,  0,   1.5, '2024-03-01', 'active', '01033344455', 'الدقي - الجيزة',      null,             ''],
    ['EMP-015', 'كريم وليد سامي',     '29804151234567', 'الإنتاج',   'متدرب',            'full_time', 'monthly', 3000,  8, 26, 0,    200, 200, 0,    150, 0,   0,   1.5, '2025-01-01', 'active', '01099900011', 'فيصل - الجيزة',       null,             'متدرب جديد'],
  ].forEach(e => {
    const r = insEmp.run(...e);
    emp[e[0]] = r.lastInsertRowid;
  });

  // ──────────── Users (7 with different roles) ────────────
  const passHash = bcrypt.hashSync('123456', 10);
  const insUser = db.prepare('INSERT INTO users (username, full_name, email, password_hash, role, department, employee_id, status) VALUES (?,?,?,?,?,?,?,?)');

  insUser.run('admin', 'مدير النظام', 'admin@wk-hub.com', passHash, 'superadmin', 'الإدارة', emp['EMP-001'], 'active');
  insUser.run('manager1', 'محمد أحمد الشريف', 'mohamed@wk-hub.com', passHash, 'manager', 'الإدارة', emp['EMP-001'], 'active');
  insUser.run('accountant1', 'فاطمة حسن إبراهيم', 'fatima@wk-hub.com', passHash, 'accountant', 'المحاسبة', emp['EMP-002'], 'active');
  insUser.run('production1', 'أحمد محمود عبدالله', 'ahmed.m@wk-hub.com', passHash, 'production', 'الإنتاج', emp['EMP-003'], 'active');
  insUser.run('hr1', 'سارة عبدالرحمن', 'sara@wk-hub.com', passHash, 'hr', 'الموارد البشرية', emp['EMP-004'], 'active');
  insUser.run('viewer1', 'رحاب عادل محمود', 'rehab@wk-hub.com', passHash, 'viewer', 'المحاسبة', emp['EMP-012'], 'active');
  insUser.run('viewer2', 'عبدالله حسين', 'abdullah@wk-hub.com', passHash, 'viewer', 'المخازن', emp['EMP-011'], 'active');

  // ──────────── Attendance for last 2 months ────────────
  const insAtt = db.prepare('INSERT OR IGNORE INTO attendance (employee_id, work_date, day_of_week, scheduled_hours, actual_hours, attendance_status, late_minutes, notes) VALUES (?,?,?,?,?,?,?,?)');
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const allEmpIds = Object.values(emp);

  function generateAttendance(monthStr, year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d);
      const dayOfWeek = dt.getDay();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      // Skip Friday (5)
      if (dayOfWeek === 5) continue;
      for (const eid of allEmpIds) {
        const rand = Math.random();
        let status = 'present', hours = 8, late = 0;
        if (rand < 0.03) { status = 'absent'; hours = 0; }
        else if (rand < 0.08) { status = 'late'; hours = 7 + Math.random(); late = Math.floor(Math.random() * 45) + 10; }
        else if (rand < 0.10) { status = 'half_day'; hours = 4; }
        else if (rand < 0.15) { hours = 8 + Math.floor(Math.random() * 3) + 1; } // overtime
        else { hours = 8; }
        insAtt.run(eid, dateStr, dayNames[dayOfWeek], 8, Math.round(hours * 100) / 100, status, late, null);
      }
    }
  }

  const today = new Date();
  const curMonth = today.getMonth() + 1;
  const curYear = today.getFullYear();
  const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
  const prevYear = curMonth === 1 ? curYear - 1 : curYear;

  generateAttendance(`${prevYear}-${String(prevMonth).padStart(2, '0')}`, prevYear, prevMonth);
  generateAttendance(`${curYear}-${String(curMonth).padStart(2, '0')}`, curYear, curMonth);

  // ──────────── Payroll Periods (previous month calculated) ────────────
  const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const curMonthStr = `${curYear}-${String(curMonth).padStart(2, '0')}`;

  const insPP = db.prepare('INSERT INTO payroll_periods (period_month, period_name, status, total_gross, total_net, total_deductions, notes, calculated_at) VALUES (?,?,?,?,?,?,?,?)');
  const pp1 = insPP.run(prevMonthStr, `رواتب شهر ${prevMonth}/${prevYear}`, 'paid', 0, 0, 0, 'تم الصرف', new Date().toISOString());
  const pp2 = insPP.run(curMonthStr, `رواتب شهر ${curMonth}/${curYear}`, 'open', 0, 0, 0, '', null);

  // ──────────── Payroll Records for previous month ────────────
  const insPR = db.prepare(`INSERT INTO payroll_records (period_id, employee_id, days_worked, hours_worked, overtime_hours, absent_days, base_pay, overtime_pay, housing_allowance, transport_allowance, food_allowance, other_allowances, bonuses, gross_pay, absence_deduction, late_deduction, social_insurance, tax_deduction, loans_deduction, other_deductions, total_deductions, net_pay, payment_status, payment_method) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const empData = db.prepare(`SELECT * FROM employees WHERE status='active'`).all();
  let totalGross = 0, totalNet = 0, totalDed = 0;

  for (const e of empData) {
    const att = db.prepare(`SELECT 
      COUNT(CASE WHEN attendance_status='present' OR attendance_status='late' THEN 1 END) as present_days,
      COALESCE(SUM(actual_hours), 0) as total_hours,
      COALESCE(SUM(CASE WHEN actual_hours > scheduled_hours THEN actual_hours - scheduled_hours ELSE 0 END), 0) as ot_hours,
      COUNT(CASE WHEN attendance_status='absent' THEN 1 END) as absent_days,
      COUNT(CASE WHEN attendance_status='half_day' THEN 1 END) as half_days,
      COALESCE(SUM(late_minutes), 0) as total_late
    FROM attendance WHERE employee_id=? AND work_date LIKE ?`).get(e.id, prevMonthStr + '%');

    const daysWorked = (att.present_days || 0) + (att.half_days || 0) * 0.5;
    const dailyRate = e.salary_type === 'daily' ? e.base_salary : e.base_salary / e.standard_days_per_month;
    const basePay = e.salary_type === 'daily' ? daysWorked * dailyRate : e.base_salary;
    const otPay = (att.ot_hours || 0) * (dailyRate / e.standard_hours_per_day) * e.overtime_rate_multiplier;
    const absDed = (att.absent_days || 0) * dailyRate;
    const lateDed = Math.floor((att.total_late || 0) / 60) * (dailyRate / e.standard_hours_per_day) * 0.5;
    const gross = basePay + otPay + e.housing_allowance + e.transport_allowance + e.food_allowance + e.other_allowances;
    const totDed = absDed + lateDed + e.social_insurance + e.tax_deduction + e.other_deductions_fixed;
    const net = gross - totDed;

    insPR.run(pp1.lastInsertRowid, e.id, daysWorked, att.total_hours || 0, att.ot_hours || 0, att.absent_days || 0,
      Math.round(basePay), Math.round(otPay),
      e.housing_allowance, e.transport_allowance, e.food_allowance, e.other_allowances, 0,
      Math.round(gross), Math.round(absDed), Math.round(lateDed),
      e.social_insurance, e.tax_deduction, 0, e.other_deductions_fixed, Math.round(totDed), Math.round(net),
      'paid', e.bank_account ? 'bank' : 'cash');

    totalGross += gross; totalNet += net; totalDed += totDed;
  }

  db.prepare('UPDATE payroll_periods SET total_gross=?, total_net=?, total_deductions=? WHERE id=?')
    .run(Math.round(totalGross), Math.round(totalNet), Math.round(totalDed), pp1.lastInsertRowid);

  // ──────────── HR Adjustments ────────────
  const insAdj = db.prepare('INSERT INTO hr_adjustments (employee_id, period_id, adj_type, amount, description, applied) VALUES (?,?,?,?,?,?)');
  insAdj.run(emp['EMP-005'], pp1.lastInsertRowid, 'bonus', 500, 'مكافأة إتقان عمل', 1);
  insAdj.run(emp['EMP-003'], pp1.lastInsertRowid, 'bonus', 1000, 'مكافأة إشراف إضافي', 1);
  insAdj.run(emp['EMP-013'], pp1.lastInsertRowid, 'advance', 1000, 'سلفة - خصم من الراتب القادم', 0);
  insAdj.run(emp['EMP-008'], pp1.lastInsertRowid, 'deduction', 200, 'خصم تأخير متكرر', 1);
  insAdj.run(emp['EMP-006'], pp2.lastInsertRowid, 'bonus', 300, 'مكافأة أداء متميز', 0);
  insAdj.run(emp['EMP-015'], pp2.lastInsertRowid, 'loan', 2000, 'سلفة شخصية - تقسيط 4 شهور', 0);

  // ──────────── Audit Log samples ────────────
  const insAudit = db.prepare('INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, entity_label, created_at) VALUES (?,?,?,?,?,?,?)');
  const admin_id = db.prepare('SELECT id FROM users WHERE username=?').get('admin').id;
  insAudit.run(admin_id, 'admin', 'create', 'user', 'manager1', 'محمد أحمد الشريف', new Date(Date.now() - 86400000 * 30).toISOString());
  insAudit.run(admin_id, 'admin', 'create', 'user', 'accountant1', 'فاطمة حسن إبراهيم', new Date(Date.now() - 86400000 * 28).toISOString());
  insAudit.run(admin_id, 'admin', 'create', 'user', 'production1', 'أحمد محمود عبدالله', new Date(Date.now() - 86400000 * 28).toISOString());
  insAudit.run(admin_id, 'admin', 'create', 'user', 'hr1', 'سارة عبدالرحمن', new Date(Date.now() - 86400000 * 27).toISOString());
  insAudit.run(admin_id, 'admin', 'login', 'session', null, 'تسجيل دخول', new Date(Date.now() - 3600000).toISOString());

  // ──────────── Notifications (sample) ────────────
  const insNotif = db.prepare('INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id, is_read) VALUES (?,?,?,?,?,?,?)');
  insNotif.run(admin_id, 'low_stock', 'مخزون منخفض: خيط حرير', 'وصل مخزون خيط حرير (THR-002) إلى 8 وحدات — أقل من الحد الأدنى', 'accessory', null, 0);
  insNotif.run(admin_id, 'low_stock', 'مخزون منخفض: حرير طبيعي', 'وصل مخزون حرير طبيعي (SLK-002) إلى 12 متر — أقل من الحد الأدنى', 'fabric', null, 0);
  insNotif.run(admin_id, 'wo_overdue', 'أمر تشغيل متأخر', 'أمر التشغيل WO-2026-001 تجاوز موعد التسليم', 'work_order', wo1id, 0);
  insNotif.run(admin_id, 'invoice_overdue', 'فاتورة متأخرة', 'الفاتورة INV-004 متأخرة عن موعد السداد', 'invoice', inv4.lastInsertRowid, 1);
  insNotif.run(admin_id, 'wo_cancelled', 'إلغاء أمر تشغيل', 'تم إلغاء أمر التشغيل WO-2026-004 — السبب: تغيير طلب العميل', 'work_order', wo4id, 1);

  // ──────────── Accessory Stock Movements (sample) ────────────
  const insASM = db.prepare('INSERT INTO accessory_stock_movements (accessory_code, movement_type, qty, reference_type, reference_id, notes) VALUES (?,?,?,?,?,?)');
  insASM.run('BTN-001', 'in', 500, 'po', po2.lastInsertRowid, 'استلام من PO-2026-002');
  insASM.run('BTN-002', 'in', 200, 'po', po2.lastInsertRowid, 'استلام من PO-2026-002');
  insASM.run('ZPR-001', 'in', 80, 'po', po2.lastInsertRowid, 'استلام من PO-2026-002');
  insASM.run('LBL-001', 'out', 3, 'work_order', wo1id, 'صرف لأمر تشغيل WO-2026-001');
  insASM.run('THR-002', 'out', 0.5, 'work_order', wo1id, 'صرف لأمر تشغيل WO-2026-001');
  insASM.run('BTN-001', 'adjustment', 10, null, null, 'تسوية جرد سنوي');

  // ──────────── Fabric Stock Movements (sample) ────────────
  const insFSM = db.prepare('INSERT INTO fabric_stock_movements (fabric_code, movement_type, qty_meters, batch_id, reference_type, reference_id, notes) VALUES (?,?,?,?,?,?,?)');
  insFSM.run('CTN-001', 'in', 30, batch1.lastInsertRowid, 'po', po1.lastInsertRowid, 'استلام من PO-2026-001');
  insFSM.run('CTN-002', 'in', 25, batch2.lastInsertRowid, 'po', po1.lastInsertRowid, 'استلام من PO-2026-001');
  insFSM.run('LNG-001', 'in', 20, batch3.lastInsertRowid, 'po', po4.lastInsertRowid, 'استلام من PO-2026-004');
  insFSM.run('SLK-001', 'out', 5, null, 'work_order', wo1id, 'صرف لأمر تشغيل WO-2026-001');

  // ──────────── Machines ────────────
  const insMachine = db.prepare('INSERT INTO machines (code, name, machine_type, location, status, notes) VALUES (?,?,?,?,?,?)');
  const mach1 = insMachine.run('MCH-001', 'ماكينة خياطة جوكي DDL-8700', 'sewing', 'خط إنتاج 1', 'active', 'ماكينة خياطة مستقيمة عالية السرعة — Juki');
  const mach2 = insMachine.run('MCH-002', 'ماكينة خياطة جوكي MO-6816S', 'sewing', 'خط إنتاج 1', 'active', 'ماكينة أوفرلوك 5 خيوط — Juki');
  const mach3 = insMachine.run('MCH-003', 'ماكينة قص كايمر KM', 'cutting', 'قسم القص', 'active', 'ماكينة قص كهربائية — Kaimer');
  const mach4 = insMachine.run('MCH-004', 'مكبس بخار فيت VEIT 8363', 'pressing', 'قسم الكوي', 'active', 'مكبس بخار صناعي — Veit');
  const mach5 = insMachine.run('MCH-005', 'ماكينة خياطة براذر S-7220C', 'sewing', 'خط إنتاج 2', 'active', 'ماكينة خياطة مستقيمة إلكترونية — Brother');
  const mach6 = insMachine.run('MCH-006', 'ماكينة تطريز تاجيما TMEZ-SC', 'embroidery', 'قسم التطريز', 'active', 'ماكينة تطريز 6 رؤوس — Tajima');
  const mach7 = insMachine.run('MCH-007', 'ماكينة عراوي جوكي LBH-1790', 'sewing', 'خط إنتاج 1', 'maintenance', 'ماكينة عراوي أوتوماتيكية — في الصيانة — Juki');
  const mach8 = insMachine.run('MCH-008', 'ماكينة قص ليزر Golden Laser', 'cutting', 'قسم القص', 'inactive', 'معطلة — في انتظار قطع غيار — Golden Laser');

  // ──────────── Machine Maintenance ────────────
  const insMaint = db.prepare('INSERT INTO machine_maintenance (machine_id, maintenance_type, description, performed_by, performed_at, cost, next_due, notes) VALUES (?,?,?,?,?,?,?,?)');
  insMaint.run(mach1.lastInsertRowid, 'routine', 'صيانة دورية — تنظيف وتزييت', 'فني الصيانة أحمد', '2025-05-01', 150, '2025-08-01', 'تم تغيير الزيت والإبرة');
  insMaint.run(mach2.lastInsertRowid, 'routine', 'صيانة دورية — فحص شامل', 'فني الصيانة أحمد', '2025-04-15', 200, '2025-07-15', 'تم ضبط التوتر');
  insMaint.run(mach3.lastInsertRowid, 'repair', 'إصلاح شفرة القص', 'فني خارجي — محمود', '2025-03-20', 450, '2025-09-20', 'تم تغيير الشفرة بالكامل');
  insMaint.run(mach4.lastInsertRowid, 'routine', 'تنظيف خطوط البخار', 'فني الصيانة أحمد', '2025-05-10', 180, '2025-08-10', null);
  insMaint.run(mach7.lastInsertRowid, 'repair', 'إصلاح محرك العراوي', 'فني خارجي — كريم', '2025-06-01', 1200, '2025-09-01', 'في انتظار قطعة غيار');
  insMaint.run(mach6.lastInsertRowid, 'routine', 'صيانة دورية — تنظيف الرؤوس', 'فني الصيانة أحمد', '2025-05-20', 300, '2025-08-20', 'تم تنظيف جميع الرؤوس الست');

  // ──────────── Leave Requests ────────────
  const empIds = db.prepare('SELECT id, full_name FROM employees LIMIT 15').all();
  const insLeave = db.prepare('INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at) VALUES (?,?,?,?,?,?,?,?)');
  if (empIds.length >= 5) {
    insLeave.run(empIds[0].id, 'annual', '2025-07-01', '2025-07-05', 'إجازة سنوية — سفر عائلي', 'approved', admin_id, '2025-06-20');
    insLeave.run(empIds[1].id, 'sick', '2025-06-15', '2025-06-17', 'إجازة مرضية — تم تقديم تقرير طبي', 'approved', admin_id, '2025-06-15');
    insLeave.run(empIds[2].id, 'annual', '2025-08-10', '2025-08-14', 'إجازة سنوية', 'pending', null, null);
    insLeave.run(empIds[3].id, 'annual', '2025-06-25', '2025-06-26', 'ظروف شخصية', 'approved', admin_id, '2025-06-24');
    insLeave.run(empIds[4].id, 'annual', '2025-09-01', '2025-09-10', 'إجازة سنوية طويلة — فترة ذروة', 'pending', null, null);
    insLeave.run(empIds[0].id, 'sick', '2025-05-20', '2025-05-20', 'صداع شديد', 'approved', admin_id, '2025-05-20');
    insLeave.run(empIds[2].id, 'annual', '2025-04-10', '2025-04-11', 'ظروف طارئة', 'approved', admin_id, '2025-04-10');
  }

  // ──────────── Journal Entries (sample accounting) ────────────
  const insJE = db.prepare('INSERT INTO journal_entries (entry_number, entry_date, description, reference, status, created_by) VALUES (?,?,?,?,?,?)');

  // Look up account IDs from chart_of_accounts
  const getAccId = (code) => {
    const row = db.prepare('SELECT id FROM chart_of_accounts WHERE code = ?').get(code);
    return row ? row.id : null;
  };
  const insJEL = db.prepare('INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?,?,?,?,?)');

  // JE1: Purchase invoice payment
  const je1 = insJE.run('JE-2025-001', '2025-05-15', 'سداد فاتورة مشتريات أقمشة — PO-2026-001', 'PO-2026-001', 'posted', admin_id);
  const accCash = getAccId('1000') || getAccId('1100');
  const accInventory = getAccId('1300');
  if (accCash && accInventory) {
    insJEL.run(je1.lastInsertRowid, accInventory, 'تكلفة أقمشة', 12500, 0);
    insJEL.run(je1.lastInsertRowid, accCash, 'نقدية — بنك', 0, 12500);
  }

  // JE2: Sales revenue
  const je2 = insJE.run('JE-2025-002', '2025-05-20', 'إيراد مبيعات — فاتورة INV-001', 'INV-001', 'posted', admin_id);
  const accAR = getAccId('1200');
  const accRevenue = db.prepare("SELECT id FROM chart_of_accounts WHERE type = 'revenue' LIMIT 1").get();
  if (accAR && accRevenue) {
    insJEL.run(je2.lastInsertRowid, accAR, 'حسابات العملاء', 45000, 0);
    insJEL.run(je2.lastInsertRowid, accRevenue.id, 'إيرادات مبيعات', 0, 45000);
  }

  // JE3: Salary payment
  const je3 = insJE.run('JE-2025-003', '2025-05-30', 'صرف رواتب شهر مايو 2025', null, 'posted', admin_id);
  const accSalary = getAccId('5100');
  if (accSalary && accCash) {
    insJEL.run(je3.lastInsertRowid, accSalary, 'مصروفات رواتب', 85000, 0);
    insJEL.run(je3.lastInsertRowid, accCash, 'نقدية — بنك', 0, 85000);
  }

  // JE4: Draft entry
  const je4 = insJE.run('JE-2025-004', '2025-06-10', 'مصروفات صيانة معدات', null, 'draft', admin_id);
  const accMaint = getAccId('5200');
  if (accMaint && accCash) {
    insJEL.run(je4.lastInsertRowid, accMaint, 'مصروفات صيانة', 2500, 0);
    insJEL.run(je4.lastInsertRowid, accCash, 'نقدية — بنك', 0, 2500);
  }

  // ──────────── Expenses (4 sample) ────────────
  const insExp = db.prepare('INSERT INTO expenses (expense_type, description, amount, expense_date, payment_method, vendor_name, status, approved_by, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
  insExp.run('other', 'مستلزمات مكتبية', 850, '2026-02-10', 'cash', 'مكتبة النيل', 'approved', admin_id, 'أوراق + أحبار طابعة', admin_id);
  insExp.run('maintenance', 'صيانة مكيفات المصنع', 2500, '2026-02-15', 'bank', 'شركة التبريد', 'approved', admin_id, 'صيانة سنوية', admin_id);
  insExp.run('other', 'فاتورة كهرباء المصنع', 4200, '2026-03-01', 'bank', 'شركة الكهرباء', 'pending', null, 'فاتورة شهر فبراير', admin_id);
  insExp.run('other', 'نقل بضائع للعميل', 1200, '2026-03-05', 'cash', 'شركة النقل السريع', 'approved', admin_id, 'شحن طلبية محلات الزيتون', admin_id);

  // ══════════════════════════════════════════════════════════════
  //  V23 MODULES SEED DATA — MRP, Shipping, Scheduling, QC,
  //  Quotations, Sales Orders, Samples, Returns, Production Lines
  // ══════════════════════════════════════════════════════════════

  // ──────────── Production Lines (3 lines) ────────────
  // V23 migration already seeds 1 default line, but we cleared it. Re-create plus extras.
  const insLine = db.prepare('INSERT INTO production_lines (name, description, capacity_per_day, status) VALUES (?,?,?,?)');
  const line1 = insLine.run('خط إنتاج 1 - خياطة رئيسي', 'الخط الرئيسي — 4 ماكينات خياطة + أوفرلوك', 200, 'active');
  const line2 = insLine.run('خط إنتاج 2 - تشطيب وكي', 'كي وتشطيب نهائي + مراجعة جودة', 150, 'active');
  const line3 = insLine.run('خط إنتاج 3 - قص', 'قسم القص — ماكينة قص + طاولة فرد', 300, 'active');

  // ──────────── Production Schedule (5 entries — Gantt data) ────────────
  const insSched = db.prepare('INSERT INTO production_schedule (work_order_id, production_line_id, planned_start, planned_end, actual_start, actual_end, status, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?)');
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
  const ws = (offset) => { const d = new Date(weekStart); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

  insSched.run(wo1id, line1.lastInsertRowid, ws(0), ws(4), ws(0), null, 'in_progress', 'فستان سهرة — خياطة', admin_id);
  insSched.run(wo1id, line2.lastInsertRowid, ws(3), ws(6), null, null, 'planned', 'فستان سهرة — تشطيب وكي', admin_id);
  insSched.run(wo2id, line3.lastInsertRowid, ws(1), ws(2), ws(1), ws(2), 'completed', 'بنطلون جينز — قص', admin_id);
  insSched.run(wo2id, line1.lastInsertRowid, ws(3), ws(7), null, null, 'planned', 'بنطلون جينز — خياطة', admin_id);
  insSched.run(wo3id, line1.lastInsertRowid, ws(-14), ws(-7), ws(-14), ws(-8), 'completed', 'تيشيرت — خياطة كاملة', admin_id);

  // ──────────── QC Defect Codes (re-seed since cleared) ────────────
  const insDefect = db.prepare('INSERT INTO qc_defect_codes (code, name_ar, category, severity) VALUES (?,?,?,?)');
  [
    ['D001', 'خياطة غير منتظمة', 'sewing', 'minor'],
    ['D002', 'خيط مقطوع', 'sewing', 'major'],
    ['D003', 'عيب في القماش', 'fabric', 'critical'],
    ['D004', 'اختلاف لون', 'fabric', 'major'],
    ['D005', 'قياس خاطئ', 'measurement', 'critical'],
    ['D006', 'زرار مفقود', 'accessories', 'minor'],
    ['D007', 'سوستة عاطلة', 'accessories', 'major'],
    ['D008', 'بقعة/اتساخ', 'finishing', 'minor'],
    ['D009', 'كي غير متساوي', 'finishing', 'minor'],
    ['D010', 'ليبل خاطئ', 'labeling', 'minor'],
  ].forEach(d => insDefect.run(...d));

  // ──────────── QC Templates (2 templates) ────────────
  const insQCT = db.prepare('INSERT INTO qc_templates (name, model_code, description, aql_level, inspection_type, is_active) VALUES (?,?,?,?,?,?)');
  const insQCTI = db.prepare('INSERT INTO qc_template_items (template_id, check_point, category, severity, sort_order, accept_criteria) VALUES (?,?,?,?,?,?)');

  const qct1 = insQCT.run('فحص فستان سهرة', 'DRS-001', 'قالب فحص شامل للفساتين', 'II', 'normal', 1);
  [
    ['فحص القماش الخارجي', 'visual', 'critical', 1, 'لا عيوب أو بقع في القماش'],
    ['فحص الخياطة الجانبية', 'visual', 'major', 2, 'غرز منتظمة 12-14 غرزة/بوصة'],
    ['قياس الطول الكلي', 'measurement', 'critical', 3, 'الطول حسب المقاس ± 1سم'],
    ['فحص السوستة', 'visual', 'major', 4, 'سوستة سلسة بدون تعلق'],
    ['فحص البطانة', 'visual', 'minor', 5, 'بطانة مثبتة بشكل صحيح'],
    ['فحص الليبل', 'visual', 'minor', 6, 'ليبل الماركة + المقاس مثبت بشكل صحيح'],
    ['فحص التشطيب النهائي', 'visual', 'major', 7, 'لا خيوط زائدة — كي مناسب'],
  ].forEach(item => insQCTI.run(qct1.lastInsertRowid, ...item));

  const qct2 = insQCT.run('فحص قميص رسمي', 'SHR-001', 'قالب فحص قمصان', 'II', 'normal', 1);
  [
    ['فحص القماش', 'visual', 'critical', 1, 'لا عيوب في القماش'],
    ['فحص الياقة', 'visual', 'critical', 2, 'ياقة متناسقة — فازلين مثبت'],
    ['فحص الأزرار', 'visual', 'major', 3, '8 أزرار مثبتة بإحكام'],
    ['قياس عرض الصدر', 'measurement', 'major', 4, 'حسب جدول المقاسات ± 0.5سم'],
    ['فحص الأكمام', 'visual', 'minor', 5, 'طول متساوي — خياطة منتظمة'],
  ].forEach(item => insQCTI.run(qct2.lastInsertRowid, ...item));

  // ──────────── QC Inspections (3 inspections) ────────────
  const insQCI = db.prepare('INSERT INTO qc_inspections (work_order_id, template_id, inspection_number, inspector_id, inspection_date, lot_size, sample_size, passed, failed, result, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const insQCII = db.prepare('INSERT INTO qc_inspection_items (inspection_id, check_point, result, defect_code, defect_count, notes) VALUES (?,?,?,?,?,?)');

  // Inspection 1: WO1 (dress) — passed
  const qci1 = insQCI.run(wo1id, qct1.lastInsertRowid, 'QCI-2026-001', admin_id, '2026-03-15', 100, 20, 18, 2, 'pass', 'عيبان طفيفان فقط — مقبول');
  const qct1Items = db.prepare('SELECT * FROM qc_template_items WHERE template_id=? ORDER BY sort_order').all(qct1.lastInsertRowid);
  qct1Items.forEach(item => {
    const passed = Math.random() > 0.15;
    insQCII.run(qci1.lastInsertRowid, item.check_point, passed ? 'pass' : 'fail',
      passed ? null : 'D001', passed ? 0 : 1, passed ? null : 'عيب طفيف');
  });

  // Inspection 2: WO3 (t-shirt) — passed
  const qci2 = insQCI.run(wo3id, null, 'QCI-2026-002', admin_id, '2026-02-28', 350, 50, 48, 2, 'pass', 'جودة ممتازة');

  // Inspection 3: WO1 (dress) — in progress
  const qci3 = insQCI.run(wo1id, qct1.lastInsertRowid, 'QCI-2026-003', admin_id, new Date().toISOString().slice(0, 10), 100, 10, 0, 0, 'pending', 'فحص الدفعة الثانية');

  // ──────────── QC NCR (2 reports) ────────────
  const insNCR = db.prepare('INSERT INTO qc_ncr (ncr_number, inspection_id, work_order_id, severity, description, root_cause, corrective_action, preventive_action, status, assigned_to, closed_date, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  insNCR.run('NCR-2026-001', qci1.lastInsertRowid, wo1id, 'minor', 'خياطة غير منتظمة في الفساتين — تم اكتشاف عدم انتظام الغرز في الجانب الأيسر لـ 2 فستان',
    'إبرة الماكينة تحتاج تغيير', 'تم تغيير الإبرة وإعادة خياطة القطعتين', 'فحص الإبر قبل كل وردية', 'closed', admin_id, '2026-03-16', admin_id);
  insNCR.run('NCR-2026-002', null, wo1id, 'major', 'اختلاف لون البطانة — دفعة البطانة البيج أغمق من المعتاد',
    'دفعة جديدة من المورد بتدرج مختلف', null, null, 'open', null, null, admin_id);

  // ──────────── Quotations (3) ────────────
  const insQuot = db.prepare('INSERT INTO quotations (quotation_number, customer_id, status, valid_until, subtotal, tax_rate, tax_amount, discount, total, notes, terms, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const insQI = db.prepare('INSERT INTO quotation_items (quotation_id, model_code, description, variant, quantity, unit_price, total, notes) VALUES (?,?,?,?,?,?,?,?)');

  const quot1 = insQuot.run('QTN-2026-001', custIds.c4, 'accepted', '2026-04-01', 45000, 14, 6020, 2000, 49020,
    'عرض سعر ملابس رسمية — عقد ربع سنوي', 'الأسعار سارية 30 يوم — التوصيل خلال 14 يوم عمل', admin_id);
  insQI.run(quot1.lastInsertRowid, 'JKT-001', 'جاكيت صوف رسمي', 'رمادي', 30, 650, 19500, null);
  insQI.run(quot1.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن', 'أبيض', 50, 220, 11000, null);
  insQI.run(quot1.lastInsertRowid, 'PNT-001', 'بنطلون جينز كاجوال', 'أسود', 40, 280, 11200, null);
  insQI.run(quot1.lastInsertRowid, null, 'تعديلات خاصة حسب الطلب', null, 1, 3300, 3300, null);

  const quot2 = insQuot.run('QTN-2026-002', custIds.c2, 'sent', '2026-04-10', 18000, 14, 2520, 0, 20520,
    'عرض سعر فساتين سهرة — حفل موسم الصيف', null, admin_id);
  insQI.run(quot2.lastInsertRowid, 'DRS-001', 'فستان سهرة كلاسيك', 'كحلي', 15, 450, 6750, null);
  insQI.run(quot2.lastInsertRowid, 'DRS-001', 'فستان سهرة كلاسيك', 'عنابي', 10, 450, 4500, null);
  insQI.run(quot2.lastInsertRowid, 'DRS-002', 'فستان كتان صيفي', 'أوف وايت', 15, 320, 4800, null);
  insQI.run(quot2.lastInsertRowid, 'ABY-001', 'عباية كريب مطرزة', 'أسود/ذهبي', 5, 550, 2750, null);

  const quot3 = insQuot.run('QTN-2026-003', custIds.c1, 'draft', '2026-04-15', 7200, 0, 0, 500, 6700,
    'عرض سعر أولي — تيشيرتات صيفية', null, admin_id);
  insQI.run(quot3.lastInsertRowid, 'TSH-001', 'تيشيرت قطن لايكرا', 'أسود', 30, 120, 3600, null);
  insQI.run(quot3.lastInsertRowid, 'TSH-001', 'تيشيرت قطن لايكرا', 'أبيض', 30, 120, 3600, null);

  // ──────────── Sales Orders (2 — from converted quotation) ────────────
  const insSO = db.prepare('INSERT INTO sales_orders (so_number, quotation_id, customer_id, status, order_date, delivery_date, subtotal, tax_rate, tax_amount, discount, total, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insSOI = db.prepare('INSERT INTO sales_order_items (sales_order_id, model_code, description, variant, quantity, unit_price, total, produced_qty, shipped_qty, work_order_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)');

  const so1 = insSO.run('SO-2026-001', quot1.lastInsertRowid, custIds.c4, 'in_production', '2026-03-05', '2026-04-15', 45000, 14, 6020, 2000, 49020,
    'أمر بيع من عرض QTN-2026-001', admin_id);
  insSOI.run(so1.lastInsertRowid, 'JKT-001', 'جاكيت صوف رسمي', 'رمادي', 30, 650, 19500, 10, 0, null, null);
  insSOI.run(so1.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن', 'أبيض', 50, 220, 11000, 50, 0, null, null);
  insSOI.run(so1.lastInsertRowid, 'PNT-001', 'بنطلون جينز كاجوال', 'أسود', 40, 280, 11200, 0, 0, null, null);

  const so2 = insSO.run('SO-2026-002', null, custIds.c3, 'confirmed', '2026-03-12', '2026-04-20', 12600, 14, 1764, 0, 14364,
    'طلبية موسمية — محلات الزيتون', admin_id);
  insSOI.run(so2.lastInsertRowid, 'TSH-001', 'تيشيرت قطن لايكرا', 'أسود', 40, 120, 4800, 0, 0, null, null);
  insSOI.run(so2.lastInsertRowid, 'TSH-001', 'تيشيرت قطن لايكرا', 'رمادي', 30, 120, 3600, 0, 0, null, null);
  insSOI.run(so2.lastInsertRowid, 'SKR-001', 'تنورة كريب ميدي', 'أسود', 20, 180, 3600, 0, 0, null, null);
  insSOI.run(so2.lastInsertRowid, null, 'خدمة تغليف خاصة', null, 1, 600, 600, 0, 0, null, null);

  // ──────────── Samples (4) ────────────
  const insSample = db.prepare('INSERT INTO samples (sample_number, model_code, customer_id, status, description, fabrics_used, accessories_used, cost, requested_date, completion_date, customer_feedback, work_order_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');

  insSample.run('SMP-2026-001', 'JKT-001', custIds.c4, 'approved',
    'عينة جاكيت بليزر بلون كحلي — حسب المواصفات المرفقة',
    'صوف مخلوط WOL-001 — لون كحلي — بطانة ساتان LNG-003',
    'أزرار معدنية فضية 4 قطع + حشو كتف + فازلين',
    600, '2026-02-01', '2026-02-15',
    'عينة معتمدة — تم البدء بالإنتاج', null, admin_id);

  insSample.run('SMP-2026-002', 'DRS-001', custIds.c2, 'completed',
    'عينة فستان سهرة — لون برغندي خاص',
    'حرير شيفون SLK-001 — برغندي خاص — بطانة ساتان',
    'سوستة مخفية 60سم + ليبل خاص للبوتيك',
    500, '2026-02-10', '2026-03-01',
    'بانتظار موافقة العميل', null, admin_id);

  insSample.run('SMP-2026-003', 'TSH-001', custIds.c1, 'in_progress',
    'عينة تيشيرت بياقة V — حسب نموذج العميل',
    'قطن لايكرا CTN-003 — أبيض',
    'ليبل خاص بالعميل',
    100, '2026-03-05', null,
    null, null, admin_id);

  insSample.run('SMP-2026-004', 'ABY-001', custIds.c5, 'requested',
    'عينة عباية سوداء بتطريز يدوي خاص — حفل خطوبة',
    'كريب ثقيل CRP-001 — أسود + بطانة',
    'تطريز يدوي ذهبي على الأكمام + كبسات مخفية',
    700, '2026-03-18', null,
    null, null, admin_id);

  // ──────────── Shipments (3) ────────────
  const insShip = db.prepare('INSERT INTO shipments (shipment_number, shipment_type, status, customer_id, work_order_id, carrier_name, tracking_number, shipping_method, shipping_cost, weight, packages_count, ship_date, expected_delivery, actual_delivery, shipping_address, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insShipItem = db.prepare('INSERT INTO shipment_items (shipment_id, description, model_code, variant, quantity, weight, notes) VALUES (?,?,?,?,?,?,?)');
  const insPackList = db.prepare('INSERT INTO packing_lists (shipment_id, box_number, contents, quantity, weight, dimensions) VALUES (?,?,?,?,?,?)');

  const ship1 = insShip.run('SHP-2026-001', 'outbound', 'delivered', custIds.c3, wo3id,
    'شركة النقل السريع', 'TRK-2026-10045', 'road', 450, 57.8, 4,
    '2026-03-01', '2026-03-03', '2026-03-02',
    'شارع الهرم — الجيزة', 'تم التسليم بنجاح', admin_id);
  insShipItem.run(ship1.lastInsertRowid, 'تيشيرت قطن — أسود', 'TSH-001', 'أسود', 115, 23, null);
  insShipItem.run(ship1.lastInsertRowid, 'تيشيرت قطن — أبيض', 'TSH-001', 'أبيض', 93, 18.6, null);
  insShipItem.run(ship1.lastInsertRowid, 'تيشيرت قطن — رمادي', 'TSH-001', 'رمادي', 81, 16.2, null);
  insPackList.run(ship1.lastInsertRowid, 1, 'تيشيرت أسود — S/M/L', 60, 12, '60x40x30');
  insPackList.run(ship1.lastInsertRowid, 2, 'تيشيرت أسود — XL/2XL + أبيض S/M', 55, 11, '60x40x30');
  insPackList.run(ship1.lastInsertRowid, 3, 'تيشيرت أبيض L/XL/2XL', 53, 10.6, '60x40x30');
  insPackList.run(ship1.lastInsertRowid, 4, 'تيشيرت رمادي + كحلي', 81, 16.2, '60x40x35');

  const ship2 = insShip.run('SHP-2026-002', 'outbound', 'shipped', custIds.c4, null,
    'DHL Express', 'DHL-EG-2026-88877', 'express', 850, 15, 2,
    '2026-03-18', '2026-03-20', null,
    'شارع التحرير — وسط البلد — القاهرة', 'شحنة جزئية — قمصان فقط', admin_id);
  insShipItem.run(ship2.lastInsertRowid, 'قميص رسمي قطن — أبيض', 'SHR-001', 'أبيض', 50, 15, 'دفعة أولى كاملة');
  insPackList.run(ship2.lastInsertRowid, 1, 'قمصان رسمية S/M/L', 30, 9, '70x45x30');
  insPackList.run(ship2.lastInsertRowid, 2, 'قمصان رسمية XL/2XL/3XL', 20, 6, '70x45x25');

  const ship3 = insShip.run('SHP-2026-003', 'outbound', 'ready', custIds.c2, wo1id,
    null, null, null, 0, 0, 0,
    new Date().toISOString().slice(0, 10), ws(3), null,
    'شارع النيل — الدقي — الجيزة', 'قيد التحضير — في انتظار اكتمال الإنتاج', admin_id);
  insShipItem.run(ship3.lastInsertRowid, 'فستان سهرة — كحلي', 'DRS-001', 'كحلي', 20, 10, 'الدفعة الأولى');

  // ──────────── Sales Returns (2) ────────────
  const insSR = db.prepare('INSERT INTO sales_returns (return_number, invoice_id, customer_id, return_date, reason, status, subtotal, tax_amount, total, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const insSRI = db.prepare('INSERT INTO sales_return_items (return_id, description, model_code, quantity, unit_price, total) VALUES (?,?,?,?,?,?)');

  const sr1 = insSR.run('SR-2026-001', inv4.lastInsertRowid, custIds.c1,
    '2026-03-01', 'عيوب تصنيع', 'approved', 1640, 120, 1760,
    'مرتجع 4 فساتين بعيوب خياطة + 2 تنورة مقاس خاطئ', admin_id);
  insSRI.run(sr1.lastInsertRowid, 'فستان كتان صيفي — أوف وايت (عيب خياطة)', 'DRS-002', 4, 320, 1280);
  insSRI.run(sr1.lastInsertRowid, 'تنورة كريب ميدي — عنابي (مقاس خاطئ)', 'SKR-001', 2, 180, 360);

  const sr2 = insSR.run('SR-2026-002', inv1.lastInsertRowid, custIds.c3,
    '2026-03-10', 'زيادة في الكمية المطلوبة', 'draft', 900, 0, 900,
    'إرجاع 5 قمصان زيادة عن الطلب', admin_id);
  insSRI.run(sr2.lastInsertRowid, 'قميص رسمي قطن — أبيض (زيادة)', 'SHR-001', 5, 180, 900);

  // ──────────── Purchase Returns (1) ────────────
  const insPURet = db.prepare('INSERT INTO purchase_returns (return_number, purchase_order_id, supplier_id, return_date, reason, status, subtotal, total, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const insPURetI = db.prepare('INSERT INTO purchase_return_items (return_id, item_type, item_code, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?,?)');

  const pr1 = insPURet.run('PR-2026-001', po4.lastInsertRowid, sup6.lastInsertRowid,
    '2026-03-05', 'عيب في البضاعة', 'approved', 265, 275,
    'بطانة بوليستر 5 أمتار بعيوب نسيج', admin_id);
  insPURetI.run(pr1.lastInsertRowid, 'fabric', 'LNG-001', 'بطانة بوليستر — أسود (عيب نسيج)', 5, 35, 175);
  insPURetI.run(pr1.lastInsertRowid, 'fabric', 'LNG-002', 'بطانة قطن — أبيض (اتساخ)', 2, 45, 90);

  // ──────────── MRP Run (1 — with suggestions) ────────────
  const insMRP = db.prepare('INSERT INTO mrp_runs (run_date, status, notes, created_by) VALUES (?,?,?,?)');
  const insMRPS = db.prepare('INSERT INTO mrp_suggestions (mrp_run_id, item_type, item_id, item_code, item_name, required_qty, on_hand_qty, on_order_qty, shortage_qty, suggested_qty, supplier_id, supplier_name, unit_price, total_cost) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

  const mrp1 = insMRP.run(new Date().toISOString(), 'confirmed', 'تشغيل MRP تلقائي — بناءً على أوامر العمل النشطة', admin_id);
  insMRPS.run(mrp1.lastInsertRowid, 'fabric', 1, 'SLK-001', 'حرير شيفون', 50, 18, 0, 32, 35, sup5.lastInsertRowid, 'واردات الحرير', 250, 8750);
  insMRPS.run(mrp1.lastInsertRowid, 'fabric', 2, 'WOL-001', 'صوف مخلوط', 84, 22, 0, 62, 65, null, null, 200, 13000);
  insMRPS.run(mrp1.lastInsertRowid, 'accessory', 1, 'THR-002', 'خيط حرير', 15, 8, 0, 7, 10, null, null, 25, 250);
  insMRPS.run(mrp1.lastInsertRowid, 'accessory', 2, 'PAD-001', 'حشو كتف', 60, 45, 0, 15, 20, null, null, 3, 60);

  // ──────────── Customer Payments (3) ────────────
  const insCustPay = db.prepare('INSERT INTO customer_payments (customer_id, invoice_id, amount, payment_method, reference, notes) VALUES (?,?,?,?,?,?)');
  insCustPay.run(custIds.c3, inv1.lastInsertRowid, 17455, 'bank', 'TRF-C-2026-001', 'سداد كامل — فاتورة INV-001');
  insCustPay.run(custIds.c4, inv5.lastInsertRowid, 37828, 'bank', 'TRF-C-2026-002', 'سداد كامل — فاتورة INV-005');
  insCustPay.run(custIds.c4, inv5.lastInsertRowid, 10000, 'check', 'CHQ-2026-0045', 'دفعة على الحساب');

  // ══════════════════════════════════════════════════════════════
  //  ENHANCED REAL-LIFE SCENARIOS — Multiple POs, Batch Tracking,
  //  Full Pipeline Tests, QC Issues, Rush Orders, Bulk Orders
  // ══════════════════════════════════════════════════════════════

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const fortyDaysAgo = new Date(Date.now() - 40 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const inThirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // ──────────── Additional Work Orders (WO-005 to WO-010) ────────────

  // WO-005: URGENT Blazer order — full pipeline from quotation to delivery
  const wo5 = insWO.run('WO-2026-005', modelIds.m3, null, 'in_progress', 'urgent', 'ورشة 1', 120, 60, 30, 650, 500, 'طلبية عاجلة — بليزر رسمي لمؤسسة النخبة', fiveDaysAgo, ws(5), custIds.c4);
  const wo5id = wo5.lastInsertRowid;
  insWF.run(wo5id, 'WOL-001', 'main', 2.8, 5, 'رمادي', 0);
  insWF.run(wo5id, 'LNG-003', 'lining', 2.5, 0, 'بيج', 1);
  insWA.run(wo5id, 'BTN-002', 'زرار معدني فضي', 4, 2);
  insWA.run(wo5id, 'PAD-001', 'حشو كتف', 2, 3);
  insWA.run(wo5id, 'ITF-001', 'فازلين لاصق', 1.5, 20);
  insWA.run(wo5id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo5id, 'LBL-002', 'ليبل مقاس', 1, 0.3);
  insWA.run(wo5id, 'THR-001', 'خيط بوليستر', 1, 15);
  insWS.run(wo5id, 'رمادي', 5, 10, 15, 12, 6, 2);
  insWS.run(wo5id, 'كحلي', 3, 8, 12, 10, 5, 2);
  stageTemplates.forEach((s, i) => {
    const st = i < 3 ? 'completed' : i === 3 ? 'in_progress' : 'pending';
    insWSt.run(wo5id, s.name, s.sort_order, st, 'ورشة 1', i <= 3 ? fiveDaysAgo : null, i < 3 ? fiveDaysAgo : null);
  });

  // WO-006: Abaya rush order — with QC issues
  const wo6 = insWO.run('WO-2026-006', modelIds.m6, null, 'in_progress', 'urgent', 'ورشة 2', 100, 45, 20, 550, 420, 'طلبية عاجلة — عبايات مطرزة لبوتيك الورد', tenDaysAgo, ws(3), custIds.c2);
  const wo6id = wo6.lastInsertRowid;
  insWF.run(wo6id, 'CRP-001', 'main', 3.5, 4, 'أسود', 0);
  insWF.run(wo6id, 'LNG-002', 'lining', 3.0, 0, 'أسود', 1);
  insWA.run(wo6id, 'OTH-001', 'شريط ساتان تزيين', 2, 5);
  insWA.run(wo6id, 'BTN-004', 'كبس مخفي', 3, 1);
  insWA.run(wo6id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo6id, 'LBL-002', 'ليبل مقاس', 1, 0.3);
  insWA.run(wo6id, 'THR-002', 'خيط حرير', 1, 25);
  insWS.run(wo6id, 'أسود/ذهبي', 10, 20, 30, 20, 10, 5);
  insWS.run(wo6id, 'أسود/فضي', 5, 12, 18, 12, 6, 3);
  stageTemplates.forEach((s, i) => {
    const st = i < 5 ? 'completed' : i === 5 ? 'in_progress' : 'pending';
    insWSt.run(wo6id, s.name, s.sort_order, st, 'ورشة 2', i <= 5 ? tenDaysAgo : null, i < 5 ? tenDaysAgo : null);
  });

  // WO-007: Bulk shirt order — completed with full batch tracking
  const wo7 = insWO.run('WO-2026-007', modelIds.m4, null, 'completed', 'normal', 'ورشة 1', 60, 35, 25, 220, 170, 'طلبية شهرية كبيرة — قمصان رسمية', thirtyDaysAgo, null, custIds.c4);
  const wo7id = wo7.lastInsertRowid;
  insWF.run(wo7id, 'CTN-001', 'main', 1.6, 4, 'أبيض', 0);
  insWA.run(wo7id, 'BTN-001', 'زرار بلاستيك', 8, 0.5);
  insWA.run(wo7id, 'ITF-001', 'فازلين ياقة', 0.3, 20);
  insWA.run(wo7id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo7id, 'LBL-002', 'ليبل مقاس', 1, 0.3);
  insWA.run(wo7id, 'THR-001', 'خيط بوليستر', 0.5, 15);
  insWS.run(wo7id, 'أبيض', 15, 30, 40, 30, 15, 5);
  insWS.run(wo7id, 'أزرق فاتح', 10, 20, 30, 20, 10, 5);
  insWS.run(wo7id, 'وردي', 5, 12, 18, 12, 6, 2);
  stageTemplates.forEach(s => insWSt.run(wo7id, s.name, s.sort_order, 'completed', 'ورشة 1', thirtyDaysAgo, thirtyDaysAgo));

  // WO-008: Winter coat — in_progress, early stages
  const wo8 = insWO.run('WO-2026-008', modelIds.m10, null, 'in_progress', 'high', 'ورشة 2', 150, 70, 25, 900, 700, 'مجموعة شتاء — معاطف فاخرة', fiveDaysAgo, inTwentyDays, custIds.c1);
  const wo8id = wo8.lastInsertRowid;
  insWF.run(wo8id, 'WOL-002', 'main', 3.5, 5, 'بيج', 0);
  insWF.run(wo8id, 'LNG-004', 'lining', 3.2, 0, 'كحلي', 1);
  insWA.run(wo8id, 'BTN-002', 'زرار معدني', 6, 2);
  insWA.run(wo8id, 'PAD-001', 'حشو كتف', 2, 3);
  insWA.run(wo8id, 'PAD-002', 'حشو صدر', 2, 5);
  insWA.run(wo8id, 'ITF-001', 'فازلين', 2, 20);
  insWA.run(wo8id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo8id, 'THR-002', 'خيط حرير', 1.5, 25);
  insWS.run(wo8id, 'بيج', 3, 6, 10, 8, 4, 2);
  insWS.run(wo8id, 'أسود', 3, 5, 8, 6, 3, 1);
  stageTemplates.forEach((s, i) => {
    const st = i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'pending';
    insWSt.run(wo8id, s.name, s.sort_order, st, 'ورشة 2', i <= 1 ? fiveDaysAgo : null, i === 0 ? fiveDaysAgo : null);
  });

  // WO-009: Summer dress — draft, pending delivery of fabric
  const wo9 = insWO.run('WO-2026-009', modelIds.m9, null, 'draft', 'normal', null, 65, 30, 20, 320, 250, 'مجموعة صيف — فساتين كتان', null, inThirtyDays, custIds.c5);
  const wo9id = wo9.lastInsertRowid;
  insWF.run(wo9id, 'LNN-001', 'main', 2.2, 4, 'أوف وايت', 0);
  insWF.run(wo9id, 'LNG-005', 'lining', 1.8, 0, 'أبيض', 1);
  insWA.run(wo9id, 'BTN-003', 'زرار خشب', 6, 3.5);
  insWA.run(wo9id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo9id, 'LBL-002', 'ليبل مقاس', 1, 0.3);
  insWA.run(wo9id, 'OTH-001', 'شريط حزام', 1.2, 5);
  insWS.run(wo9id, 'أوف وايت', 5, 10, 15, 10, 5, 2);
  insWS.run(wo9id, 'بيج', 3, 8, 12, 8, 4, 2);
  stageTemplates.forEach(s => insWSt.run(wo9id, s.name, s.sort_order, 'pending', null, null, null));

  // WO-010: Vest completed — fully tracked and delivered
  const wo10 = insWO.run('WO-2026-010', modelIds.m8, null, 'completed', 'low', 'ورشة 1', 80, 40, 25, 400, 310, 'فيست كشمير — طلبية مؤسسة النخبة', fortyDaysAgo, null, custIds.c4);
  const wo10id = wo10.lastInsertRowid;
  insWF.run(wo10id, 'WOL-002', 'main', 1.2, 4, 'بيج', 0);
  insWF.run(wo10id, 'LNG-003', 'lining', 1.0, 0, 'بيج', 1);
  insWA.run(wo10id, 'BTN-003', 'زرار خشب', 5, 3.5);
  insWA.run(wo10id, 'ITF-001', 'فازلين', 0.5, 20);
  insWA.run(wo10id, 'LBL-001', 'ليبل ماركة', 1, 1.5);
  insWA.run(wo10id, 'LBL-002', 'ليبل مقاس', 1, 0.3);
  insWS.run(wo10id, 'بيج', 4, 8, 12, 10, 5, 2);
  insWS.run(wo10id, 'رمادي غامق', 3, 6, 10, 8, 4, 2);
  stageTemplates.forEach(s => insWSt.run(wo10id, s.name, s.sort_order, 'completed', 'ورشة 1', fortyDaysAgo, fortyDaysAgo));

  // ──────────── Additional Purchase Orders (PO-005 to PO-010) ────────────

  // PO-005: Partially received silk
  const po5 = insPO.run('PO-2026-005', sup5.lastInsertRowid, 'fabric', 8750, 5000, 'partial', '2026-03-10', 'طلبية حرير — وصل جزء');
  insPOI.run(po5.lastInsertRowid, 'fabric', 'SLK-001', null, 'حرير شيفون — كحلي', 20, 'meter', 250);
  insPOI.run(po5.lastInsertRowid, 'fabric', 'SLK-002', null, 'حرير طبيعي — أوف وايت', 15, 'meter', 320);

  // PO-006: Received wool for blazers and coats
  const po6 = insPO.run('PO-2026-006', sup1.lastInsertRowid, 'fabric', 14400, 14400, 'received', '2026-03-01', 'طلبية صوف — بليزرات ومعاطف');
  insPOI.run(po6.lastInsertRowid, 'fabric', 'WOL-001', null, 'صوف مخلوط — رمادي', 40, 'meter', 200);
  insPOI.run(po6.lastInsertRowid, 'fabric', 'WOL-002', null, 'صوف كشمير — بيج', 20, 'meter', 350);

  // PO-007: Received cotton (second batch)
  const po7 = insPO.run('PO-2026-007', sup1.lastInsertRowid, 'fabric', 8025, 8025, 'received', '2026-02-10', 'طلبية أقمشة قطنية — الدفعة الثانية');
  insPOI.run(po7.lastInsertRowid, 'fabric', 'CTN-001', null, 'قطن مصري ممتاز — أبيض', 40, 'meter', 120);
  insPOI.run(po7.lastInsertRowid, 'fabric', 'CTN-003', null, 'قطن لايكرا — أسود', 25, 'meter', 130);

  // PO-008: Sent zipper order (awaiting delivery)
  const po8 = insPO.run('PO-2026-008', sup4.lastInsertRowid, 'accessory', 2640, 0, 'sent', '2026-03-25', 'طلبية سوست — خط الإنتاج');
  insPOI.run(po8.lastInsertRowid, 'accessory', null, 'ZPR-001', 'سوستة معدنية 20سم', 100, 'piece', 8);
  insPOI.run(po8.lastInsertRowid, 'accessory', null, 'ZPR-002', 'سوستة مخفية 50سم', 80, 'piece', 12);
  insPOI.run(po8.lastInsertRowid, 'accessory', null, 'ZPR-003', 'سوستة بلاستيك 15سم', 60, 'piece', 5);
  insPOI.run(po8.lastInsertRowid, 'accessory', null, 'BTN-004', 'زرار كبس معدني', 200, 'piece', 1);

  // PO-009: Received buttons and labels (stock replenishment)
  const po9 = insPO.run('PO-2026-009', sup3.lastInsertRowid, 'accessory', 2225, 2225, 'received', '2026-02-25', 'طلبية أزرار وليبلات — مخزون احتياطي');
  insPOI.run(po9.lastInsertRowid, 'accessory', null, 'BTN-001', 'زرار بلاستيك صغير', 1000, 'piece', 0.5);
  insPOI.run(po9.lastInsertRowid, 'accessory', null, 'BTN-002', 'زرار معدني فضي', 300, 'piece', 2);
  insPOI.run(po9.lastInsertRowid, 'accessory', null, 'BTN-003', 'زرار خشب طبيعي', 200, 'piece', 3.5);
  insPOI.run(po9.lastInsertRowid, 'accessory', null, 'LBL-001', 'ليبل ماركة منسوج', 500, 'piece', 1.5);

  // PO-010: Partially received lining
  const po10 = insPO.run('PO-2026-010', sup6.lastInsertRowid, 'fabric', 3500, 2000, 'partial', '2026-03-15', 'طلبية بطائن — وصلت بطانة القطن فقط');
  insPOI.run(po10.lastInsertRowid, 'fabric', 'LNG-001', null, 'بطانة قطن', 30, 'meter', 45);
  insPOI.run(po10.lastInsertRowid, 'fabric', 'LNG-003', null, 'بطانة ساتان', 25, 'meter', 55);
  insPOI.run(po10.lastInsertRowid, 'fabric', 'LNG-004', null, 'بطانة حرير', 15, 'meter', 90);

  // ──────────── Additional Supplier Payments ────────────
  insPayment.run(sup5.lastInsertRowid, po5.lastInsertRowid, 5000, 'bank', 'TRF-2026-005', 'دفعة أولى — طلبية حرير');
  insPayment.run(sup1.lastInsertRowid, po6.lastInsertRowid, 14400, 'bank', 'TRF-2026-006', 'سداد كامل — طلبية صوف');
  insPayment.run(sup1.lastInsertRowid, po7.lastInsertRowid, 8025, 'bank', 'TRF-2026-007', 'سداد كامل — طلبية قطن');
  insPayment.run(sup3.lastInsertRowid, po9.lastInsertRowid, 2225, 'cash', null, 'سداد كامل — أزرار وليبلات');
  insPayment.run(sup6.lastInsertRowid, po10.lastInsertRowid, 2000, 'bank', 'TRF-2026-010', 'دفعة أولى — طلبية بطائن');

  // ──────────── Additional Fabric Batches (from new POs) ────────────
  // PO-005 partial: 12m silk received out of 20m ordered
  const batch6 = insBatch.run('FB-2026-0006', 'SLK-001', sup5.lastInsertRowid, po5.lastInsertRowid, null, 12, 250, 5, 0.3, 'available', '2026-03-10', 'دفعة جزئية من PO-2026-005 — 12 من 20 متر');
  // PO-006: wool received
  const batch7 = insBatch.run('FB-2026-0007', 'WOL-001', sup1.lastInsertRowid, po6.lastInsertRowid, null, 40, 200, 15, 1.2, 'available', '2026-03-01', 'دفعة صوف مخلوط من PO-2026-006');
  const batch8 = insBatch.run('FB-2026-0008', 'WOL-002', sup1.lastInsertRowid, po6.lastInsertRowid, null, 20, 350, 8, 0.5, 'available', '2026-03-01', 'دفعة كشمير من PO-2026-006');
  // PO-007: cotton received and partially used
  const batch9 = insBatch.run('FB-2026-0009', 'CTN-001', sup1.lastInsertRowid, po7.lastInsertRowid, null, 40, 120, 25, 2.0, 'available', '2026-02-10', 'دفعة قطن — WO-007 استهلكت 25م');
  const batch10 = insBatch.run('FB-2026-0010', 'CTN-003', sup1.lastInsertRowid, po7.lastInsertRowid, null, 25, 130, 0, 0, 'available', '2026-02-10', 'دفعة قطن لايكرا');
  // PO-010 partial: lining received
  const batch11 = insBatch.run('FB-2026-0011', 'LNG-001', sup6.lastInsertRowid, po10.lastInsertRowid, null, 30, 45, 0, 0, 'available', '2026-03-15', 'بطانة قطن من PO-2026-010');
  // Old depleted batch
  const batch12 = insBatch.run('FB-2026-0012', 'CRP-001', null, null, null, 50, 150, 48, 2, 'depleted', '2025-12-01', 'دفعة كريب قديمة — مستهلكة بالكامل');

  // ──────────── Additional Fabric Stock Movements ────────────
  insFSM.run('SLK-001', 'in', 12, batch6.lastInsertRowid, 'po', po5.lastInsertRowid, 'استلام جزئي من PO-2026-005');
  insFSM.run('SLK-001', 'out', 5, batch6.lastInsertRowid, 'work_order', wo6id, 'صرف لعبايات WO-006');
  insFSM.run('WOL-001', 'in', 40, batch7.lastInsertRowid, 'po', po6.lastInsertRowid, 'استلام من PO-2026-006');
  insFSM.run('WOL-001', 'out', 15, batch7.lastInsertRowid, 'work_order', wo5id, 'صرف لبليزرات WO-005');
  insFSM.run('WOL-002', 'in', 20, batch8.lastInsertRowid, 'po', po6.lastInsertRowid, 'استلام من PO-2026-006');
  insFSM.run('WOL-002', 'out', 8, batch8.lastInsertRowid, 'work_order', wo8id, 'صرف لمعاطف WO-008');
  insFSM.run('CTN-001', 'in', 40, batch9.lastInsertRowid, 'po', po7.lastInsertRowid, 'استلام من PO-2026-007');
  insFSM.run('CTN-001', 'out', 25, batch9.lastInsertRowid, 'work_order', wo7id, 'صرف لقمصان WO-007');
  insFSM.run('CTN-003', 'in', 25, batch10.lastInsertRowid, 'po', po7.lastInsertRowid, 'استلام من PO-2026-007');
  insFSM.run('LNG-001', 'in', 30, batch11.lastInsertRowid, 'po', po10.lastInsertRowid, 'استلام جزئي من PO-2026-010');
  insFSM.run('CRP-001', 'out', 48, batch12.lastInsertRowid, 'work_order', null, 'استهلاك دفعة كريب قديمة');

  // ──────────── Additional Accessory Stock Movements ────────────
  insASM.run('BTN-001', 'in', 1000, 'po', po9.lastInsertRowid, 'استلام من PO-2026-009');
  insASM.run('BTN-002', 'in', 300, 'po', po9.lastInsertRowid, 'استلام من PO-2026-009');
  insASM.run('BTN-003', 'in', 200, 'po', po9.lastInsertRowid, 'استلام من PO-2026-009');
  insASM.run('LBL-001', 'in', 500, 'po', po9.lastInsertRowid, 'استلام من PO-2026-009');
  insASM.run('BTN-002', 'out', 200, 'work_order', wo5id, 'صرف لبليزرات WO-005');
  insASM.run('PAD-001', 'out', 100, 'work_order', wo5id, 'حشو كتف لبليزرات WO-005');
  insASM.run('BTN-001', 'out', 1920, 'work_order', wo7id, 'أزرار قمصان WO-007');
  insASM.run('THR-002', 'out', 3, 'work_order', wo6id, 'خيط حرير لعبايات WO-006');
  insASM.run('BTN-003', 'out', 205, 'work_order', wo10id, 'أزرار خشب لفيست WO-010');

  // ──────────── Additional Invoices ────────────
  const inv7 = insInv.run('INV-007', 'مؤسسة النخبة للأزياء', '01077788899', 'elite@fashion.com',
    'طلبية قمصان رسمية — WO-007', 52800, 14, 0, 60192, 'paid', '2026-03-15', wo7id, custIds.c4, thirtyDaysAgo);
  insII.run(inv7.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن — أبيض', 'أبيض', 135, 220, 29700, 0);
  insII.run(inv7.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن — أزرق فاتح', 'أزرق فاتح', 95, 220, 20900, 1);
  insII.run(inv7.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن — وردي', 'وردي', 55, 220, 12100, 2);

  const inv8 = insInv.run('INV-008', 'مؤسسة النخبة للأزياء', '01077788899', 'elite@fashion.com',
    'فيست كشمير — WO-010', 16400, 14, 500, 18196, 'sent', '2026-03-20', wo10id, custIds.c4, fortyDaysAgo);
  insII.run(inv8.lastInsertRowid, 'VES-001', 'فيست صوف كشمير — بيج', 'بيج', 41, 400, 16400, 0);

  const inv9 = insInv.run('INV-009', 'بوتيك الورد', '01198765432', 'ward@example.com',
    'فاتورة مبدئية — عبايات مطرزة', 82500, 14, 3000, 91050, 'draft', '2026-04-01', wo6id, custIds.c2, now);
  insII.run(inv9.lastInsertRowid, 'ABY-001', 'عباية كريب مطرزة — أسود/ذهبي', 'أسود/ذهبي', 95, 550, 52250, 0);
  insII.run(inv9.lastInsertRowid, 'ABY-001', 'عباية كريب مطرزة — أسود/فضي', 'أسود/فضي', 56, 550, 30800, 1);

  // ──────────── Additional Quotations ────────────
  const quot4 = insQuot.run('QTN-2026-004', custIds.c1, 'sent', '2026-05-01', 120000, 14, 16800, 5000, 131800,
    'عرض سعر عقد سنوي — صيف وشتاء', 'الأسعار تشمل التوصيل — صلاحية 45 يوم', admin_id);
  insQI.run(quot4.lastInsertRowid, 'JKT-001', 'جاكيت صوف رسمي', 'كحلي', 50, 650, 32500, null);
  insQI.run(quot4.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن', 'أبيض', 100, 220, 22000, null);
  insQI.run(quot4.lastInsertRowid, 'PNT-001', 'بنطلون جينز', 'أسود', 60, 280, 16800, null);
  insQI.run(quot4.lastInsertRowid, 'TSH-001', 'تيشيرت قطن', 'أسود', 80, 120, 9600, null);
  insQI.run(quot4.lastInsertRowid, 'DRS-002', 'فستان كتان صيفي', 'أوف وايت', 40, 320, 12800, null);
  insQI.run(quot4.lastInsertRowid, 'COT-001', 'معطف شتوي', 'بيج', 30, 900, 27000, null);

  const quot5 = insQuot.run('QTN-2026-005', custIds.c5, 'rejected', '2026-03-15', 9000, 0, 0, 0, 9000,
    'عرض سعر فساتين خطوبة — رفض', 'رفض العميل — يريد أسعار أقل', admin_id);
  insQI.run(quot5.lastInsertRowid, 'DRS-001', 'فستان سهرة كلاسيك', 'عنابي', 10, 450, 4500, null);
  insQI.run(quot5.lastInsertRowid, 'ABY-001', 'عباية كريب مطرزة', 'أسود/ذهبي', 5, 550, 2750, null);
  insQI.run(quot5.lastInsertRowid, null, 'تعديلات تطريز خاصة', null, 1, 1750, 1750, null);

  // ──────────── Additional Sales Orders ────────────
  const so3 = insSO.run('SO-2026-003', null, custIds.c2, 'in_production', '2026-03-10', '2026-04-05', 82500, 14, 11550, 3000, 91050,
    'أمر بيع عبايات مطرزة — بوتيك الورد', admin_id);
  insSOI.run(so3.lastInsertRowid, 'ABY-001', 'عباية كريب مطرزة', 'أسود/ذهبي', 95, 550, 52250, 60, 0, wo6id, 'قيد الإنتاج');
  insSOI.run(so3.lastInsertRowid, 'ABY-001', 'عباية كريب مطرزة', 'أسود/فضي', 56, 550, 30800, 30, 0, wo6id, 'قيد الإنتاج');

  const so4 = insSO.run('SO-2026-004', null, custIds.c4, 'completed', '2026-02-15', '2026-03-10', 52800, 14, 7392, 0, 60192,
    'أمر بيع قمصان رسمية — تم التسليم', admin_id);
  insSOI.run(so4.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن', 'أبيض', 135, 220, 29700, 135, 135, wo7id, 'تم التسليم');
  insSOI.run(so4.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن', 'أزرق فاتح', 95, 220, 20900, 95, 95, wo7id, 'تم التسليم');
  insSOI.run(so4.lastInsertRowid, 'SHR-001', 'قميص رسمي قطن', 'وردي', 55, 220, 12100, 55, 55, wo7id, 'تم التسليم');

  // ──────────── Additional Shipments ────────────
  const ship4 = insShip.run('SHP-2026-004', 'outbound', 'delivered', custIds.c4, wo7id,
    'شركة النقل الموحد', 'TRK-2026-20088', 'road', 650, 85.5, 6,
    '2026-03-08', '2026-03-10', '2026-03-10',
    'شارع التحرير — وسط البلد', 'تم التسليم — 285 قميص رسمي', admin_id);
  insShipItem.run(ship4.lastInsertRowid, 'قميص رسمي — أبيض', 'SHR-001', 'أبيض', 135, 40.5, null);
  insShipItem.run(ship4.lastInsertRowid, 'قميص رسمي — أزرق فاتح', 'SHR-001', 'أزرق فاتح', 95, 28.5, null);
  insShipItem.run(ship4.lastInsertRowid, 'قميص رسمي — وردي', 'SHR-001', 'وردي', 55, 16.5, null);
  insPackList.run(ship4.lastInsertRowid, 1, 'قمصان أبيض S-L', 60, 18, '70x45x35');
  insPackList.run(ship4.lastInsertRowid, 2, 'قمصان أبيض XL-3XL', 75, 22.5, '70x45x35');
  insPackList.run(ship4.lastInsertRowid, 3, 'قمصان أزرق S-L', 45, 13.5, '70x45x30');
  insPackList.run(ship4.lastInsertRowid, 4, 'قمصان أزرق XL-3XL', 50, 15, '70x45x30');
  insPackList.run(ship4.lastInsertRowid, 5, 'قمصان وردي S-L', 30, 9, '60x40x25');
  insPackList.run(ship4.lastInsertRowid, 6, 'قمصان وردي XL-3XL', 25, 7.5, '60x40x25');

  const ship5 = insShip.run('SHP-2026-005', 'outbound', 'shipped', custIds.c4, wo10id,
    'Aramex', 'ARX-EG-2026-55544', 'express', 550, 12, 2,
    '2026-03-20', '2026-03-22', null,
    'شارع التحرير — وسط البلد', 'شحنة جزئية — 25 فيست', admin_id);
  insShipItem.run(ship5.lastInsertRowid, 'فيست كشمير — بيج', 'VES-001', 'بيج', 25, 7.5, 'الدفعة الأولى');
  insPackList.run(ship5.lastInsertRowid, 1, 'فيست بيج S/M/L', 15, 4.5, '60x40x25');
  insPackList.run(ship5.lastInsertRowid, 2, 'فيست بيج XL/2XL/3XL', 10, 3, '50x35x20');

  // ──────────── Additional Sales Returns ────────────
  const sr3 = insSR.run('SR-2026-003', inv7.lastInsertRowid, custIds.c4,
    '2026-03-18', 'مقاس خاطئ', 'approved', 2200, 308, 2508,
    'مرتجع 10 قمصان — مقاسات خاطئة', admin_id);
  insSRI.run(sr3.lastInsertRowid, 'قميص رسمي — أبيض (مقاس خاطئ)', 'SHR-001', 6, 220, 1320);
  insSRI.run(sr3.lastInsertRowid, 'قميص رسمي — أزرق فاتح (مقاس خاطئ)', 'SHR-001', 4, 220, 880);

  const sr4 = insSR.run('SR-2026-004', null, custIds.c2,
    '2026-03-22', 'تغيير رأي العميل', 'draft', 2750, 385, 3135,
    'إرجاع 5 عبايات — العميل غير التصميم', admin_id);
  insSRI.run(sr4.lastInsertRowid, 'عباية كريب مطرزة — أسود/فضي', 'ABY-001', 5, 550, 2750);

  // ──────────── Additional Purchase Returns ────────────
  const pr2 = insPURet.run('PR-2026-002', po6.lastInsertRowid, sup1.lastInsertRowid,
    '2026-03-08', 'عيب في الصباغة', 'draft', 1000, 1000,
    'صوف مخلوط 5 أمتار — لون غير متطابق', admin_id);
  insPURetI.run(pr2.lastInsertRowid, 'fabric', 'WOL-001', 'صوف مخلوط — رمادي (اختلاف لون)', 5, 200, 1000);

  // ──────────── Additional QC Inspections ────────────
  // QC on abaya — FAILED (rework needed)
  const qci4 = insQCI.run(wo6id, qct1.lastInsertRowid, 'QCI-2026-004', admin_id, '2026-03-18', 150, 30, 22, 8, 'fail', 'فشل — 8 عبايات بعيوب تطريز');
  insQCII.run(qci4.lastInsertRowid, 'فحص القماش الخارجي', 'pass', null, 0, null);
  insQCII.run(qci4.lastInsertRowid, 'فحص الخياطة الجانبية', 'pass', null, 0, null);
  insQCII.run(qci4.lastInsertRowid, 'فحص التطريز', 'fail', 'D001', 5, 'تطريز غير منتظم على الأكمام');
  insQCII.run(qci4.lastInsertRowid, 'فحص البطانة', 'pass', null, 0, null);
  insQCII.run(qci4.lastInsertRowid, 'فحص الليبل', 'fail', 'D010', 3, 'ليبل مقلوب');
  insQCII.run(qci4.lastInsertRowid, 'فحص التشطيب النهائي', 'pass', null, 0, null);

  // QC on blazer — PASSED
  const qci5 = insQCI.run(wo5id, qct2.lastInsertRowid, 'QCI-2026-005', admin_id, '2026-03-20', 50, 15, 14, 1, 'pass', 'جودة ممتازة — عيب طفيف واحد');
  insQCII.run(qci5.lastInsertRowid, 'فحص القماش', 'pass', null, 0, null);
  insQCII.run(qci5.lastInsertRowid, 'فحص الخياطة', 'pass', null, 0, null);
  insQCII.run(qci5.lastInsertRowid, 'فحص الأزرار', 'fail', 'D006', 1, 'زرار واحد غير محكم');
  insQCII.run(qci5.lastInsertRowid, 'قياس عرض الصدر', 'pass', null, 0, null);
  insQCII.run(qci5.lastInsertRowid, 'فحص الأكمام', 'pass', null, 0, null);

  // QC on shirt order — PASSED
  const qci6 = insQCI.run(wo7id, qct2.lastInsertRowid, 'QCI-2026-006', admin_id, '2026-02-25', 285, 40, 39, 1, 'pass', 'جودة ممتازة');

  // QC re-inspection on abaya after rework — PASSED
  const qci7 = insQCI.run(wo6id, qct1.lastInsertRowid, 'QCI-2026-007', admin_id, '2026-03-22', 150, 30, 29, 1, 'pass', 'إعادة فحص بعد إصلاح — مقبول');

  // ──────────── Additional NCR Reports ────────────
  insNCR.run('NCR-2026-003', qci4.lastInsertRowid, wo6id, 'major',
    'عيوب تطريز في عبايات — 5 قطع بتطريز غير منتظم + 3 بليبل مقلوب',
    'عامل التطريز جديد — لم يتم تدريبه', 'إعادة تطريز القطع المعيبة',
    'تدريب العمال الجدد — فحص أولي بعد 10 قطع', 'closed', admin_id, '2026-03-22', admin_id);
  insNCR.run('NCR-2026-004', qci5.lastInsertRowid, wo5id, 'minor',
    'زرار غير محكم في بليزر واحد',
    'خلل في ضبط ماكينة الأزرار', 'إعادة تثبيت الزرار',
    'فحص ضبط الماكينة يومياً', 'closed', admin_id, '2026-03-20', admin_id);

  // ──────────── Additional MRP Run ────────────
  const mrp2 = insMRP.run(new Date().toISOString(), 'draft', 'تشغيل MRP — فحص متطلبات أوامر العمل الجديدة', admin_id);
  insMRPS.run(mrp2.lastInsertRowid, 'fabric', 13, 'CRP-001', 'كريب ثقيل', 200, 50, 0, 150, 160, null, null, 150, 24000);
  insMRPS.run(mrp2.lastInsertRowid, 'fabric', 19, 'LNG-004', 'بطانة حرير', 96, 20, 15, 61, 65, sup6.lastInsertRowid, 'مصنع البطائن', 90, 5850);
  insMRPS.run(mrp2.lastInsertRowid, 'fabric', 8, 'LNN-001', 'كتان طبيعي', 103, 35, 0, 68, 70, null, null, 180, 12600);
  insMRPS.run(mrp2.lastInsertRowid, 'accessory', 2, 'BTN-002', 'زرار معدني فضي', 350, 200, 0, 150, 200, sup3.lastInsertRowid, 'مصنع الأزرار', 2, 400);
  insMRPS.run(mrp2.lastInsertRowid, 'accessory', 13, 'PAD-002', 'حشو صدر', 66, 30, 0, 36, 40, null, null, 5, 200);
  insMRPS.run(mrp2.lastInsertRowid, 'accessory', 6, 'ZPR-002', 'سوستة مخفية', 120, 60, 80, 0, 0, null, null, 12, 0);

  // ──────────── Additional Production Schedule ────────────
  insSched.run(wo5id, line1.lastInsertRowid, ws(-3), ws(2), ws(-3), null, 'in_progress', 'بليزر رسمي — خياطة عاجلة', admin_id);
  insSched.run(wo5id, line2.lastInsertRowid, ws(2), ws(4), null, null, 'planned', 'بليزر رسمي — تشطيب', admin_id);
  insSched.run(wo6id, line1.lastInsertRowid, ws(-7), ws(0), ws(-7), ws(-1), 'completed', 'عبايات — خياطة', admin_id);
  insSched.run(wo6id, line2.lastInsertRowid, ws(-1), ws(2), ws(-1), null, 'in_progress', 'عبايات — تشطيب بعد إصلاح QC', admin_id);
  insSched.run(wo8id, line3.lastInsertRowid, ws(0), ws(1), ws(0), null, 'in_progress', 'معاطف — قص', admin_id);
  insSched.run(wo8id, line1.lastInsertRowid, ws(2), ws(8), null, null, 'planned', 'معاطف — خياطة', admin_id);
  insSched.run(wo9id, line3.lastInsertRowid, ws(5), ws(6), null, null, 'planned', 'فساتين صيف — قص (انتظار القماش)', admin_id);

  // ──────────── Additional Samples ────────────
  insSample.run('SMP-2026-005', 'COT-001', custIds.c1, 'approved',
    'عينة معطف شتوي — صوف كشمير بيج مع بطانة حرير',
    'صوف كشمير WOL-002 + بطانة حرير LNG-004',
    'أزرار معدنية 6 قطع + حشو كتف وصدر + فازلين',
    1200, '2026-02-20', '2026-03-10',
    'معتمد — تصميم ممتاز', wo8id, admin_id);

  insSample.run('SMP-2026-006', 'DRS-002', custIds.c5, 'rejected',
    'عينة فستان كتان — رفض التصميم',
    'كتان طبيعي LNN-001 — أوف وايت',
    'أزرار خشب + شريط حزام',
    350, '2026-03-01', '2026-03-12',
    'رفض — يريد قصة أضيق', null, admin_id);

  // ──────────── Maintenance Orders ────────────
  const insMO = db.prepare('INSERT INTO maintenance_orders (machine_id, maintenance_type, title, description, priority, status, scheduled_date, completed_date, performed_by, cost, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  insMO.run(mach7.lastInsertRowid, 'corrective', 'إصلاح محرك ماكينة العراوي', 'توقف أثناء الإنتاج — محرك يحتاج إعادة لف', 'high', 'in_progress', ws(2), null, 'فني خارجي — كريم', 1500, null, admin_id);
  insMO.run(mach8.lastInsertRowid, 'corrective', 'إصلاح ماكينة قص ليزر', 'معطلة — قطع غيار من الخارج', 'high', 'pending', null, null, null, 5000, null, admin_id);
  insMO.run(mach1.lastInsertRowid, 'preventive', 'صيانة دورية — ماكينة خياطة', 'تنظيف وتزييت وتغيير إبرة', 'medium', 'completed', twentyDaysAgo, twentyDaysAgo, 'فني الصيانة أحمد', 180, null, admin_id);
  insMO.run(mach4.lastInsertRowid, 'preventive', 'فحص دوري — مكبس البخار', 'فحص خطوط البخار والصمامات', 'low', 'pending', ws(7), null, 'فني الصيانة أحمد', 150, null, admin_id);

  // ──────────── Additional Customer Payments ────────────
  insCustPay.run(custIds.c4, inv7.lastInsertRowid, 60192, 'bank', 'TRF-C-2026-003', 'سداد كامل — قمصان INV-007');
  insCustPay.run(custIds.c4, inv8.lastInsertRowid, 10000, 'bank', 'TRF-C-2026-004', 'دفعة أولى — فيست INV-008');
  insCustPay.run(custIds.c2, null, 25000, 'check', 'CHQ-2026-1234', 'دفعة مقدمة — عبايات مطرزة');

  // ──────────── Additional Expenses ────────────
  insExp.run('other', 'مستلزمات تغليف وشحن', 1800, '2026-03-10', 'cash', 'شركة التغليف المتحدة', 'approved', admin_id, 'كراتين + فوم + ستيكرز', admin_id);
  insExp.run('maintenance', 'قطع غيار ماكينة عراوي', 3500, '2026-03-15', 'bank', 'مورد قطع غيار Juki', 'pending', null, 'في انتظار وصول القطعة', admin_id);
  insExp.run('other', 'فاتورة مياه المصنع', 850, '2026-03-01', 'bank', 'شركة المياه', 'approved', admin_id, 'فاتورة شهر فبراير', admin_id);
  insExp.run('other', 'تدريب عمال جدد', 2000, '2026-03-20', 'cash', null, 'approved', admin_id, 'تدريب 3 عمال على التطريز', admin_id);

  // ──────────── Additional Journal Entries ────────────
  const je5 = insJE.run('JE-2025-005', '2025-06-15', 'شراء أقمشة صوف — PO-2026-006', 'PO-2026-006', 'posted', admin_id);
  if (accCash && accInventory) {
    insJEL.run(je5.lastInsertRowid, accInventory, 'مخزون أقمشة صوف', 14400, 0);
    insJEL.run(je5.lastInsertRowid, accCash, 'نقدية — بنك', 0, 14400);
  }

  const je6 = insJE.run('JE-2025-006', '2025-06-20', 'إيراد مبيعات — INV-007 قمصان', 'INV-007', 'posted', admin_id);
  if (accAR && accRevenue) {
    insJEL.run(je6.lastInsertRowid, accAR, 'حسابات العملاء', 60192, 0);
    insJEL.run(je6.lastInsertRowid, accRevenue.id, 'إيرادات مبيعات قمصان', 0, 60192);
  }

  const je7 = insJE.run('JE-2025-007', '2025-06-22', 'مردودات مبيعات — SR-2026-003', 'SR-2026-003', 'posted', admin_id);
  if (accAR && accRevenue) {
    insJEL.run(je7.lastInsertRowid, accRevenue.id, 'مردودات مبيعات', 2508, 0);
    insJEL.run(je7.lastInsertRowid, accAR, 'حسابات العملاء — تخفيض', 0, 2508);
  }

  // ──────────── Additional Notifications ────────────
  insNotif.run(admin_id, 'low_stock', 'فشل فحص الجودة — WO-006', 'فشل QCI-2026-004: 8 عبايات بعيوب تطريز', 'work_order', wo6id, 0);
  insNotif.run(admin_id, 'low_stock', 'استلام جزئي — PO-2026-005', 'تم استلام 12 من 20 متر حرير', 'purchase_order', po5.lastInsertRowid, 0);
  insNotif.run(admin_id, 'wo_overdue', 'أمر تشغيل عاجل — WO-005', 'طلبية بليزرات — الموعد خلال 5 أيام', 'work_order', wo5id, 0);
  insNotif.run(admin_id, 'low_stock', 'مخزون منخفض: صوف كشمير', 'WOL-002 أقل من الحد الأدنى بعد صرف WO-008', 'fabric', null, 0);
  insNotif.run(admin_id, 'invoice_overdue', 'مرتجع جديد — SR-003', 'مرتجع 10 قمصان بمقاسات خاطئة', 'return', null, 0);

  // ──────────── Additional Audit Log ────────────
  insAudit.run(admin_id, 'admin', 'create', 'work_order', 'WO-2026-005', 'بليزر رسمي — عاجل', new Date(Date.now() - 86400000 * 5).toISOString());
  insAudit.run(admin_id, 'admin', 'create', 'work_order', 'WO-2026-006', 'عبايات مطرزة', new Date(Date.now() - 86400000 * 10).toISOString());
  insAudit.run(admin_id, 'admin', 'update', 'qc_inspection', 'QCI-2026-004', 'فحص فاشل — عبايات', new Date(Date.now() - 86400000 * 4).toISOString());
  insAudit.run(admin_id, 'admin', 'create', 'purchase_order', 'PO-2026-006', 'طلبية صوف', new Date(Date.now() - 86400000 * 20).toISOString());
  insAudit.run(admin_id, 'admin', 'create', 'shipment', 'SHP-2026-004', 'شحن قمصان', new Date(Date.now() - 86400000 * 14).toISOString());
  insAudit.run(admin_id, 'admin', 'create', 'sales_return', 'SR-2026-003', 'مرتجع قمصان', new Date(Date.now() - 86400000 * 3).toISOString());

  // ──────────── Summary ────────────
  const counts = {};
  for (const [key, table] of [['settings','settings'],['stageTemplates','stage_templates'],['customers','customers'],['suppliers','suppliers'],['fabrics','fabrics'],['accessories','accessories'],['models','models'],['bomTemplates','bom_templates'],['workOrders','work_orders'],['woStages','wo_stages'],['purchaseOrders','purchase_orders'],['invoices','invoices'],['fabricBatches','fabric_inventory_batches'],['employees','employees'],['users','users'],['attendance','attendance'],['payrollPeriods','payroll_periods'],['payrollRecords','payroll_records'],['hrAdjustments','hr_adjustments'],['notifications','notifications'],['accStockMvts','accessory_stock_movements'],['fabStockMvts','fabric_stock_movements'],['auditLog','audit_log'],['machines','machines'],['maintenance','machine_maintenance'],['maintenanceOrders','maintenance_orders'],['leaveRequests','leave_requests'],['journalEntries','journal_entries'],['journalLines','journal_entry_lines'],['expenses','expenses'],['productionLines','production_lines'],['productionSchedule','production_schedule'],['qcTemplates','qc_templates'],['qcInspections','qc_inspections'],['qcNCR','qc_ncr'],['qcDefectCodes','qc_defect_codes'],['quotations','quotations'],['salesOrders','sales_orders'],['samples','samples'],['shipments','shipments'],['packingLists','packing_lists'],['salesReturns','sales_returns'],['purchaseReturns','purchase_returns'],['mrpRuns','mrp_runs'],['mrpSuggestions','mrp_suggestions'],['customerPayments','customer_payments'],['supplierPayments','supplier_payments']]) {
    counts[key] = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
  }

  console.log(`Seed complete! (v23 — all modules — enhanced scenarios)
  ─── Core Data ───
  - ${counts.settings} settings
  - ${counts.stageTemplates} stage templates
  - ${counts.customers} customers
  - ${counts.suppliers} suppliers
  - ${counts.fabrics} fabrics (15 main + 5 lining)
  - ${counts.accessories} accessories (with stock tracking)
  - ${counts.models} models
  - ${counts.bomTemplates} BOM templates (1 per model)
  ─── Production ───
  - ${counts.workOrders} work orders (draft/in_progress/completed/cancelled)
  - ${counts.woStages} wo_stages total
  - ${counts.productionLines} production lines
  - ${counts.productionSchedule} production schedule entries
  ─── Procurement ───
  - ${counts.purchaseOrders} purchase orders (draft/sent/partial/received)
  - ${counts.fabricBatches} fabric inventory batches (available/in_use/depleted)
  - ${counts.supplierPayments} supplier payments
  ─── Sales ───
  - ${counts.invoices} invoices with items
  - ${counts.quotations} quotations (draft/sent/accepted/rejected)
  - ${counts.salesOrders} sales orders
  - ${counts.samples} samples (requested/in_progress/completed/approved/rejected)
  - ${counts.shipments} shipments
  - ${counts.packingLists} packing lists
  ─── Returns ───
  - ${counts.salesReturns} sales returns
  - ${counts.purchaseReturns} purchase returns
  ─── Quality ───
  - ${counts.qcTemplates} QC templates
  - ${counts.qcInspections} QC inspections (pass/fail/pending)
  - ${counts.qcNCR} NCR reports
  - ${counts.qcDefectCodes} defect codes
  ─── MRP ───
  - ${counts.mrpRuns} MRP runs
  - ${counts.mrpSuggestions} MRP suggestions
  ─── Finance ───
  - ${counts.expenses} expenses
  - ${counts.journalEntries} journal entries
  - ${counts.journalLines} journal entry lines
  - ${counts.customerPayments} customer payments
  ─── HR ───
  - ${counts.employees} employees
  - ${counts.users} users (all passwords: 123456)
  - ${counts.attendance} attendance records (2 months)
  - ${counts.payrollPeriods} payroll periods
  - ${counts.payrollRecords} payroll records
  - ${counts.hrAdjustments} HR adjustments
  ─── Machines ───
  - ${counts.machines} machines
  - ${counts.maintenance} machine maintenance records
  - ${counts.maintenanceOrders} maintenance orders
  ─── Inventory Tracking ───
  - ${counts.accStockMvts} accessory stock movements
  - ${counts.fabStockMvts} fabric stock movements
  ─── Other ───
  - ${counts.leaveRequests} leave requests
  - ${counts.notifications} notifications
  - ${counts.auditLog} audit log entries`);

  console.log('\nLogin credentials (all passwords: 123456):');
  console.log('  admin       - مدير النظام (superadmin)');
  console.log('  manager1    - مدير (manager)');
  console.log('  accountant1 - محاسبة (accountant)');
  console.log('  production1 - إنتاج (production)');
  console.log('  hr1         - موارد بشرية (hr)');
  console.log('  viewer1     - مشاهد (viewer)');
  console.log('  viewer2     - مشاهد (viewer)');
}

seed();
