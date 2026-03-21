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
  console.log('Seeding WK-Hub database (v12 schema)...');

  // Generate placeholder images
  const images = seedImages();
  console.log('  ✓ Generated placeholder images for models, fabrics, and accessories');

  // Disable FK constraints during seed
  db.pragma('foreign_keys = OFF');

  // ──────────── Clear data (all tables including V9) ────────────
  const tables = [
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
    'audit_log', 'users', 'employees'
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

  // ──────────── Summary ────────────
  const counts = {};
  for (const [key, table] of [['settings','settings'],['stageTemplates','stage_templates'],['customers','customers'],['suppliers','suppliers'],['fabrics','fabrics'],['accessories','accessories'],['models','models'],['bomTemplates','bom_templates'],['workOrders','work_orders'],['woStages','wo_stages'],['purchaseOrders','purchase_orders'],['invoices','invoices'],['fabricBatches','fabric_inventory_batches'],['employees','employees'],['users','users'],['attendance','attendance'],['payrollPeriods','payroll_periods'],['payrollRecords','payroll_records'],['hrAdjustments','hr_adjustments'],['notifications','notifications'],['accStockMvts','accessory_stock_movements'],['fabStockMvts','fabric_stock_movements'],['auditLog','audit_log']]) {
    counts[key] = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
  }

  console.log(`Seed complete! (v9)
  - ${counts.settings} settings
  - ${counts.stageTemplates} stage templates
  - ${counts.customers} customers
  - ${counts.suppliers} suppliers
  - ${counts.fabrics} fabrics (15 main + 5 lining)
  - ${counts.accessories} accessories (with stock tracking)
  - ${counts.models} models
  - ${counts.bomTemplates} BOM templates (1 per model)
  - ${counts.workOrders} work orders (incl. 1 cancelled)
  - ${counts.woStages} wo_stages total
  - ${counts.purchaseOrders} purchase orders with items
  - ${counts.fabricBatches} fabric inventory batches
  - ${counts.invoices} invoices with items (customer-linked)
  - ${counts.employees} employees
  - ${counts.users} users (all passwords: 123456)
  - ${counts.attendance} attendance records (2 months)
  - ${counts.payrollPeriods} payroll periods
  - ${counts.payrollRecords} payroll records
  - ${counts.hrAdjustments} HR adjustments
  - ${counts.notifications} notifications
  - ${counts.accStockMvts} accessory stock movements
  - ${counts.fabStockMvts} fabric stock movements
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
