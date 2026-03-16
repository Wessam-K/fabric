const db = require('./database');

function seed() {
  console.log('Seeding WK-Hub database...');

  // Clear existing data
  db.exec(`
    DELETE FROM invoice_items;
    DELETE FROM invoices;
    DELETE FROM cost_snapshots;
    DELETE FROM model_accessories;
    DELETE FROM model_fabrics;
    DELETE FROM model_sizes;
    DELETE FROM models;
    DELETE FROM accessories;
    DELETE FROM fabrics;
    DELETE FROM settings;
  `);

  // ──────────── Settings ────────────
  const insSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  [['masnaiya_default', '90'], ['masrouf_default', '50'], ['waste_pct_default', '5'], ['margin_default', '30']].forEach(s => insSetting.run(...s));

  // ──────────── Fabrics (20) ────────────
  const insFab = db.prepare('INSERT INTO fabrics (code, name, fabric_type, price_per_m, supplier, color) VALUES (?, ?, ?, ?, ?, ?)');
  [
    // Main fabrics
    ['CTN-001', 'قطن مصري ممتاز', 'main', 120, 'مصنع النسيج المصري', 'أبيض'],
    ['CTN-002', 'قطن مخلوط', 'main', 95, 'مصنع النسيج المصري', 'بيج'],
    ['CTN-003', 'قطن لايكرا', 'main', 130, 'مصنع النسيج المصري', 'أسود'],
    ['PLY-001', 'بوليستر ساتان', 'main', 85, 'شركة الأقمشة الدولية', 'أسود'],
    ['PLY-002', 'بوليستر كريب', 'main', 90, 'شركة الأقمشة الدولية', 'كحلي'],
    ['SLK-001', 'حرير شيفون', 'main', 250, 'واردات الحرير', 'كحلي'],
    ['SLK-002', 'حرير طبيعي', 'main', 320, 'واردات الحرير', 'أوف وايت'],
    ['LNN-001', 'كتان طبيعي', 'main', 180, 'مصنع الكتان', 'أوف وايت'],
    ['DNM-001', 'جينز ثقيل', 'main', 110, 'مصانع الجينز', 'أزرق'],
    ['DNM-002', 'جينز خفيف', 'main', 90, 'مصانع الجينز', 'أزرق فاتح'],
    ['WOL-001', 'صوف مخلوط', 'main', 200, 'شركة الصوف', 'رمادي'],
    ['WOL-002', 'صوف كشمير', 'main', 350, 'شركة الصوف', 'بيج'],
    ['CRP-001', 'كريب ثقيل', 'main', 150, 'مصنع الأقمشة', 'أسود'],
    ['VLV-001', 'قطيفة', 'both', 170, 'مصنع القطيفة', 'عنابي'],
    ['TFL-001', 'تافتا', 'main', 140, 'مصنع الأقمشة', 'ذهبي'],
    // Lining fabrics
    ['LNG-001', 'بطانة قطن', 'lining', 45, 'مصنع البطائن', 'أبيض'],
    ['LNG-002', 'بطانة بوليستر', 'lining', 35, 'مصنع البطائن', 'أسود'],
    ['LNG-003', 'بطانة ساتان', 'lining', 55, 'مصنع البطائن', 'بيج'],
    ['LNG-004', 'بطانة حرير', 'lining', 90, 'مصنع البطائن', 'كحلي'],
    ['LNG-005', 'بطانة شفافة', 'lining', 25, 'مصنع البطائن', 'أبيض'],
  ].forEach(f => insFab.run(...f));

  // ──────────── Accessories (15) ────────────
  const insAcc = db.prepare('INSERT INTO accessories (code, acc_type, name, unit_price, unit, supplier) VALUES (?, ?, ?, ?, ?, ?)');
  [
    ['BTN-001', 'button', 'زرار بلاستيك صغير', 0.5, 'piece', 'مصنع الأزرار'],
    ['BTN-002', 'button', 'زرار معدني فضي', 2.0, 'piece', 'مصنع الأزرار'],
    ['BTN-003', 'button', 'زرار خشب طبيعي', 3.5, 'piece', 'مصنع الأزرار'],
    ['BTN-004', 'button', 'زرار كبس معدني', 1.0, 'piece', 'مصنع الأزرار'],
    ['ZPR-001', 'zipper', 'سوستة معدنية 20سم', 8.0, 'piece', 'شركة السوست'],
    ['ZPR-002', 'zipper', 'سوستة مخفية 50سم', 12.0, 'piece', 'شركة السوست'],
    ['ZPR-003', 'zipper', 'سوستة بلاستيك 15سم', 5.0, 'piece', 'شركة السوست'],
    ['THR-001', 'thread', 'خيط بوليستر أبيض', 15.0, 'roll', 'مصنع الخيوط'],
    ['THR-002', 'thread', 'خيط حرير', 25.0, 'roll', 'مصنع الخيوط'],
    ['LBL-001', 'label', 'ليبل ماركة منسوج', 1.5, 'piece', 'مصنع الليبلات'],
    ['LBL-002', 'label', 'ليبل مقاس', 0.3, 'piece', 'مصنع الليبلات'],
    ['PAD-001', 'padding', 'حشو كتف', 3.0, 'piece', 'مصنع الحشو'],
    ['PAD-002', 'padding', 'حشو صدر', 5.0, 'piece', 'مصنع الحشو'],
    ['ITF-001', 'interfacing', 'فازلين لاصق', 20.0, 'meter', 'مصنع الفازلين'],
    ['OTH-001', 'other', 'شريط ساتان', 5.0, 'meter', 'مصنع الشرائط'],
  ].forEach(a => insAcc.run(...a));

  // ──────────── Prepared statements for models ────────────
  const insModel = db.prepare('INSERT INTO models (serial_number, model_code, model_name, masnaiya, masrouf, consumer_price, wholesale_price, notes) VALUES (?,?,?,?,?,?,?,?)');
  const insMF = db.prepare('INSERT INTO model_fabrics (model_id, fabric_code, role, meters_per_piece, waste_pct, color_note, sort_order) VALUES (?,?,?,?,?,?,?)');
  const insMA = db.prepare('INSERT INTO model_accessories (model_id, accessory_code, accessory_name, quantity, unit_price) VALUES (?,?,?,?,?)');
  const insMS = db.prepare('INSERT INTO model_sizes (model_id, color_label, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl) VALUES (?,?,?,?,?,?,?,?)');
  const insCS = db.prepare('INSERT INTO cost_snapshots (model_id, total_pieces, total_meters_main, total_meters_lining, main_fabric_cost, lining_cost, accessories_cost, masnaiya, masrouf, total_cost, cost_per_piece, consumer_price, wholesale_price) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');

  function calcAndInsert(modelId, fabrics, accessories, sizes, masnaiya, masrouf, consumerPrice, wholesalePrice) {
    let grandTotal = sizes.reduce((s, r) => s + r[2] + r[3] + r[4] + r[5] + r[6] + r[7], 0);
    let mainCost = 0, liningCost = 0, totalMetersMain = 0, totalMetersLining = 0;
    for (const f of fabrics) {
      const fab = db.prepare('SELECT price_per_m FROM fabrics WHERE code=?').get(f[1]);
      const price = fab?.price_per_m || 0;
      const meters = f[3] * grandTotal;
      if (f[2] === 'main') {
        mainCost += meters * price * (1 + f[4] / 100);
        totalMetersMain += meters;
      } else {
        liningCost += meters * price;
        totalMetersLining += meters;
      }
    }
    const accCost = accessories.reduce((s, a) => {
      const acc = db.prepare('SELECT unit_price FROM accessories WHERE code=?').get(a[1]);
      return s + a[3] * (acc?.unit_price || a[4]);
    }, 0);
    const totalCost = mainCost + liningCost + accCost + masnaiya + masrouf;
    const costPerPiece = grandTotal > 0 ? totalCost / grandTotal : 0;
    insCS.run(modelId, grandTotal,
      Math.round(totalMetersMain * 100) / 100,
      Math.round(totalMetersLining * 100) / 100,
      Math.round(mainCost * 100) / 100,
      Math.round(liningCost * 100) / 100,
      Math.round(accCost * 100) / 100,
      masnaiya, masrouf,
      Math.round(totalCost * 100) / 100,
      Math.round(costPerPiece * 100) / 100,
      consumerPrice, wholesalePrice
    );
    return { grandTotal, costPerPiece: Math.round(costPerPiece * 100) / 100 };
  }

  // ──────────── Model 1: DRS-001 فستان سهرة ────────────
  const m1 = insModel.run('1-001', 'DRS-001', 'فستان سهرة كلاسيك', 90, 50, 450, 350, 'فستان سهرة طويل بأكمام وتطريز يدوي');
  const m1id = m1.lastInsertRowid;
  const m1f = [[m1id, 'SLK-001', 'main', 2.5, 5, 'كحلي', 0], [m1id, 'LNG-003', 'lining', 2.0, 0, 'بيج', 1]];
  m1f.forEach(f => insMF.run(...f));
  const m1a = [[m1id, 'ZPR-002', 'سوستة مخفية', 1, 12.0], [m1id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m1id, 'LBL-002', 'ليبل مقاس', 1, 0.3], [m1id, 'THR-002', 'خيط حرير', 0.5, 25.0]];
  m1a.forEach(a => insMA.run(...a));
  const m1s = [[m1id, 'كحلي', 5, 10, 15, 10, 5, 0], [m1id, 'أسود', 3, 8, 12, 8, 4, 0], [m1id, 'عنابي', 2, 6, 10, 6, 3, 0]];
  m1s.forEach(s => insMS.run(...s));
  const m1c = calcAndInsert(m1id, m1f, m1a, m1s, 90, 50, 450, 350);

  // ──────────── Model 2: PNT-001 بنطلون جينز ────────────
  const m2 = insModel.run('1-002', 'PNT-001', 'بنطلون جينز كاجوال', 70, 40, 280, 220, 'بنطلون جينز بقصة مستقيمة مع 5 جيوب');
  const m2id = m2.lastInsertRowid;
  const m2f = [[m2id, 'DNM-001', 'main', 1.8, 3, 'أزرق', 0], [m2id, 'LNG-001', 'lining', 0.5, 0, 'أبيض', 1]];
  m2f.forEach(f => insMF.run(...f));
  const m2a = [[m2id, 'BTN-002', 'زرار معدني', 1, 2.0], [m2id, 'ZPR-001', 'سوستة معدنية', 1, 8.0], [m2id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m2id, 'LBL-002', 'ليبل مقاس', 1, 0.3], [m2id, 'BTN-004', 'زرار كبس', 1, 1.0]];
  m2a.forEach(a => insMA.run(...a));
  const m2s = [[m2id, 'أزرق فاتح', 8, 15, 20, 15, 8, 3], [m2id, 'أزرق غامق', 5, 12, 18, 12, 5, 2], [m2id, 'أسود', 4, 10, 15, 10, 6, 2]];
  m2s.forEach(s => insMS.run(...s));
  const m2c = calcAndInsert(m2id, m2f, m2a, m2s, 70, 40, 280, 220);

  // ──────────── Model 3: JKT-001 جاكيت صوف ────────────
  const m3 = insModel.run('1-003', 'JKT-001', 'جاكيت صوف رسمي', 120, 60, 650, 500, 'جاكيت صوف بليزر بطانة ساتان وحشو كتف');
  const m3id = m3.lastInsertRowid;
  const m3f = [[m3id, 'WOL-001', 'main', 2.8, 5, 'رمادي', 0], [m3id, 'LNG-003', 'lining', 2.5, 0, 'بيج', 1]];
  m3f.forEach(f => insMF.run(...f));
  const m3a = [[m3id, 'BTN-002', 'زرار معدني فضي', 4, 2.0], [m3id, 'PAD-001', 'حشو كتف', 2, 3.0], [m3id, 'ITF-001', 'فازلين لاصق', 1.5, 20.0], [m3id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m3id, 'LBL-002', 'ليبل مقاس', 1, 0.3], [m3id, 'THR-001', 'خيط بوليستر', 1, 15.0]];
  m3a.forEach(a => insMA.run(...a));
  const m3s = [[m3id, 'رمادي', 3, 8, 12, 10, 5, 2], [m3id, 'كحلي', 2, 6, 10, 8, 4, 1]];
  m3s.forEach(s => insMS.run(...s));
  const m3c = calcAndInsert(m3id, m3f, m3a, m3s, 120, 60, 650, 500);

  // ──────────── Model 4: SHR-001 قميص رسمي ────────────
  const m4 = insModel.run('1-004', 'SHR-001', 'قميص رسمي قطن', 60, 35, 220, 170, 'قميص رسمي بياقة كلاسيك وأزرار صدف');
  const m4id = m4.lastInsertRowid;
  const m4f = [[m4id, 'CTN-001', 'main', 1.6, 4, 'أبيض', 0]];
  m4f.forEach(f => insMF.run(...f));
  const m4a = [[m4id, 'BTN-001', 'زرار بلاستيك', 8, 0.5], [m4id, 'ITF-001', 'فازلين ياقة', 0.3, 20.0], [m4id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m4id, 'LBL-002', 'ليبل مقاس', 1, 0.3], [m4id, 'THR-001', 'خيط بوليستر', 0.5, 15.0]];
  m4a.forEach(a => insMA.run(...a));
  const m4s = [[m4id, 'أبيض', 10, 20, 25, 20, 10, 5], [m4id, 'أزرق فاتح', 8, 15, 20, 15, 8, 3], [m4id, 'وردي', 5, 10, 12, 10, 5, 2]];
  m4s.forEach(s => insMS.run(...s));
  const m4c = calcAndInsert(m4id, m4f, m4a, m4s, 60, 35, 220, 170);

  // ──────────── Model 5: SKR-001 تنورة ────────────
  const m5 = insModel.run('1-005', 'SKR-001', 'تنورة كريب ميدي', 55, 30, 180, 140, 'تنورة ميدي بقصة A-line مع حزام');
  const m5id = m5.lastInsertRowid;
  const m5f = [[m5id, 'CRP-001', 'main', 1.2, 3, 'أسود', 0], [m5id, 'LNG-002', 'lining', 0.8, 0, 'أسود', 1]];
  m5f.forEach(f => insMF.run(...f));
  const m5a = [[m5id, 'ZPR-002', 'سوستة مخفية', 1, 12.0], [m5id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m5id, 'LBL-002', 'ليبل مقاس', 1, 0.3], [m5id, 'OTH-001', 'شريط حزام', 0.8, 5.0]];
  m5a.forEach(a => insMA.run(...a));
  const m5s = [[m5id, 'أسود', 6, 12, 18, 12, 6, 0], [m5id, 'عنابي', 4, 8, 12, 8, 4, 0], [m5id, 'كحلي', 3, 6, 10, 6, 3, 0]];
  m5s.forEach(s => insMS.run(...s));
  const m5c = calcAndInsert(m5id, m5f, m5a, m5s, 55, 30, 180, 140);

  // ──────────── Model 6: ABY-001 عباية ────────────
  const m6 = insModel.run('1-006', 'ABY-001', 'عباية كريب مطرزة', 100, 45, 550, 420, 'عباية كريب سوداء بتطريز ذهبي على الأكمام');
  const m6id = m6.lastInsertRowid;
  const m6f = [[m6id, 'CRP-001', 'main', 3.5, 4, 'أسود', 0], [m6id, 'LNG-002', 'lining', 3.0, 0, 'أسود', 1]];
  m6f.forEach(f => insMF.run(...f));
  const m6a = [[m6id, 'OTH-001', 'شريط ساتان تزيين', 2, 5.0], [m6id, 'BTN-004', 'كبس مخفي', 3, 1.0], [m6id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m6id, 'LBL-002', 'ليبل مقاس', 1, 0.3], [m6id, 'THR-002', 'خيط حرير', 1, 25.0]];
  m6a.forEach(a => insMA.run(...a));
  const m6s = [[m6id, 'أسود/ذهبي', 8, 15, 20, 15, 8, 4], [m6id, 'أسود/فضي', 5, 10, 15, 10, 5, 2]];
  m6s.forEach(s => insMS.run(...s));
  const m6c = calcAndInsert(m6id, m6f, m6a, m6s, 100, 45, 550, 420);

  // ──────────── Model 7: TSH-001 تيشيرت ────────────
  const m7 = insModel.run('1-007', 'TSH-001', 'تيشيرت قطن لايكرا', 40, 20, 120, 90, 'تيشيرت رجالي بياقة دائرية');
  const m7id = m7.lastInsertRowid;
  const m7f = [[m7id, 'CTN-003', 'main', 1.0, 3, 'أسود', 0]];
  m7f.forEach(f => insMF.run(...f));
  const m7a = [[m7id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m7id, 'LBL-002', 'ليبل مقاس', 1, 0.3], [m7id, 'THR-001', 'خيط بوليستر', 0.3, 15.0]];
  m7a.forEach(a => insMA.run(...a));
  const m7s = [[m7id, 'أسود', 15, 25, 30, 25, 15, 5], [m7id, 'أبيض', 12, 20, 25, 20, 12, 4], [m7id, 'رمادي', 10, 18, 22, 18, 10, 3], [m7id, 'كحلي', 8, 15, 20, 15, 8, 2]];
  m7s.forEach(s => insMS.run(...s));
  const m7c = calcAndInsert(m7id, m7f, m7a, m7s, 40, 20, 120, 90);

  // ──────────── Model 8: VES-001 فيست ────────────
  const m8 = insModel.run('1-008', 'VES-001', 'فيست صوف كشمير', 80, 40, 400, 320, 'فيست رسمي بدون أكمام بطانة ساتان');
  const m8id = m8.lastInsertRowid;
  const m8f = [[m8id, 'WOL-002', 'main', 1.2, 4, 'بيج', 0], [m8id, 'LNG-003', 'lining', 1.0, 0, 'بيج', 1]];
  m8f.forEach(f => insMF.run(...f));
  const m8a = [[m8id, 'BTN-003', 'زرار خشب', 5, 3.5], [m8id, 'ITF-001', 'فازلين', 0.5, 20.0], [m8id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m8id, 'LBL-002', 'ليبل مقاس', 1, 0.3]];
  m8a.forEach(a => insMA.run(...a));
  const m8s = [[m8id, 'بيج', 3, 6, 10, 8, 4, 2], [m8id, 'رمادي غامق', 2, 5, 8, 6, 3, 1]];
  m8s.forEach(s => insMS.run(...s));
  const m8c = calcAndInsert(m8id, m8f, m8a, m8s, 80, 40, 400, 320);

  // ──────────── Model 9: DRS-002 فستان كاجوال ────────────
  const m9 = insModel.run('1-009', 'DRS-002', 'فستان كتان صيفي', 65, 30, 320, 250, 'فستان صيفي من الكتان الطبيعي بقصة واسعة');
  const m9id = m9.lastInsertRowid;
  const m9f = [[m9id, 'LNN-001', 'main', 2.2, 4, 'أوف وايت', 0], [m9id, 'LNG-005', 'lining', 1.8, 0, 'أبيض', 1]];
  m9f.forEach(f => insMF.run(...f));
  const m9a = [[m9id, 'BTN-003', 'زرار خشب', 6, 3.5], [m9id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m9id, 'LBL-002', 'ليبل مقاس', 1, 0.3], [m9id, 'OTH-001', 'شريط حزام', 1.2, 5.0]];
  m9a.forEach(a => insMA.run(...a));
  const m9s = [[m9id, 'أوف وايت', 4, 8, 14, 10, 5, 2], [m9id, 'بيج', 3, 6, 10, 8, 4, 1]];
  m9s.forEach(s => insMS.run(...s));
  const m9c = calcAndInsert(m9id, m9f, m9a, m9s, 65, 30, 320, 250);

  // ──────────── Model 10: COT-001 معطف ────────────
  const m10 = insModel.run('1-010', 'COT-001', 'معطف شتوي طويل', 150, 70, 850, 680, 'معطف شتوي بطانة حرير وحشو حراري');
  const m10id = m10.lastInsertRowid;
  const m10f = [[m10id, 'WOL-002', 'main', 3.5, 5, 'بيج', 0], [m10id, 'LNG-004', 'lining', 3.2, 0, 'كحلي', 1]];
  m10f.forEach(f => insMF.run(...f));
  const m10a = [[m10id, 'BTN-002', 'زرار معدني', 6, 2.0], [m10id, 'PAD-001', 'حشو كتف', 2, 3.0], [m10id, 'PAD-002', 'حشو صدر', 2, 5.0], [m10id, 'ITF-001', 'فازلين', 2, 20.0], [m10id, 'LBL-001', 'ليبل ماركة', 1, 1.5], [m10id, 'LBL-002', 'ليبل مقاس', 1, 0.3], [m10id, 'THR-002', 'خيط حرير', 1.5, 25.0]];
  m10a.forEach(a => insMA.run(...a));
  const m10s = [[m10id, 'بيج', 2, 5, 8, 6, 3, 1], [m10id, 'أسود', 2, 4, 7, 5, 3, 1]];
  m10s.forEach(s => insMS.run(...s));
  const m10c = calcAndInsert(m10id, m10f, m10a, m10s, 150, 70, 850, 680);

  // ──────────── Invoices (6) ────────────
  const insInv = db.prepare('INSERT INTO invoices (invoice_number, customer_name, customer_phone, customer_email, notes, subtotal, tax_pct, discount, total, status, due_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const insII = db.prepare('INSERT INTO invoice_items (invoice_id, model_code, description, variant, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,?,?)');

  // Invoice 1 — paid
  const inv1 = insInv.run('INV-001', 'أحمد محمد العلي', '01012345678', 'ahmed@example.com',
    'طلبية محل الزيتون - الدفعة الأولى', 15750, 14, 500, 17455, 'paid', '2026-02-28', '2026-02-10 10:00:00');
  const inv1id = inv1.lastInsertRowid;
  insII.run(inv1id, 'DRS-001', 'فستان سهرة كلاسيك - كحلي', 'كحلي', 15, 450, 6750, 0);
  insII.run(inv1id, 'SKR-001', 'تنورة كريب ميدي - أسود', 'أسود', 20, 180, 3600, 1);
  insII.run(inv1id, 'SHR-001', 'قميص رسمي قطن - أبيض', 'أبيض', 30, 220, 6600, 2);
  insII.run(inv1id, null, 'خدمة توصيل', null, 1, 200, 200, 3);

  // Invoice 2 — sent
  const inv2 = insInv.run('INV-002', 'فاطمة حسن', '01198765432', 'fatima.h@example.com',
    'طلبية خاصة - حفل زفاف', 22500, 14, 1000, 24650, 'sent', '2026-03-20', '2026-03-01 14:30:00');
  const inv2id = inv2.lastInsertRowid;
  insII.run(inv2id, 'DRS-001', 'فستان سهرة كلاسيك - عنابي', 'عنابي', 25, 450, 11250, 0);
  insII.run(inv2id, 'ABY-001', 'عباية كريب مطرزة - أسود/ذهبي', 'أسود/ذهبي', 15, 550, 8250, 1);
  insII.run(inv2id, 'VES-001', 'فيست صوف كشمير - بيج', 'بيج', 10, 400, 4000, 2);
  insII.run(inv2id, null, 'تعديلات خاصة', null, 1, 500, 500, 3);

  // Invoice 3 — draft
  const inv3 = insInv.run('INV-003', 'محمد سعيد الخطيب', '01055544433', null,
    'عرض سعر مبدئي - محل الأناقة', 9600, 0, 0, 9600, 'draft', '2026-04-01', '2026-03-10 09:00:00');
  const inv3id = inv3.lastInsertRowid;
  insII.run(inv3id, 'PNT-001', 'بنطلون جينز كاجوال - أزرق', 'أزرق فاتح', 20, 280, 5600, 0);
  insII.run(inv3id, 'TSH-001', 'تيشيرت قطن لايكرا - أسود', 'أسود', 40, 120, 4800, 1);

  // Invoice 4 — overdue
  const inv4 = insInv.run('INV-004', 'سارة عبدالله', '01077788899', 'sara.a@example.com',
    'طلبية شهرية - بوتيك الورد', 18200, 14, 200, 20548, 'overdue', '2026-02-15', '2026-01-20 11:00:00');
  const inv4id = inv4.lastInsertRowid;
  insII.run(inv4id, 'DRS-002', 'فستان كتان صيفي - أوف وايت', 'أوف وايت', 12, 320, 3840, 0);
  insII.run(inv4id, 'SKR-001', 'تنورة كريب ميدي - عنابي', 'عنابي', 18, 180, 3240, 1);
  insII.run(inv4id, 'ABY-001', 'عباية كريب مطرزة - أسود/فضي', 'أسود/فضي', 10, 550, 5500, 2);
  insII.run(inv4id, 'SHR-001', 'قميص رسمي - أزرق فاتح', 'أزرق فاتح', 15, 220, 3300, 3);
  insII.run(inv4id, null, 'تغليف هدايا', null, 10, 15, 150, 4);
  insII.run(inv4id, null, 'شحن سريع', null, 1, 350, 350, 5);

  // Invoice 5 — paid
  const inv5 = insInv.run('INV-005', 'يوسف إبراهيم', '01033322211', 'youssef@example.com',
    'طلبية شركة - ملابس رسمية', 35200, 14, 2000, 37828, 'paid', '2026-03-01', '2026-02-15 16:00:00');
  const inv5id = inv5.lastInsertRowid;
  insII.run(inv5id, 'JKT-001', 'جاكيت صوف رسمي - رمادي', 'رمادي', 20, 650, 13000, 0);
  insII.run(inv5id, 'VES-001', 'فيست صوف كشمير - رمادي غامق', 'رمادي غامق', 20, 400, 8000, 1);
  insII.run(inv5id, 'SHR-001', 'قميص رسمي - أبيض', 'أبيض', 40, 220, 8800, 2);
  insII.run(inv5id, 'PNT-001', 'بنطلون جينز - أسود', 'أسود', 20, 280, 5600, 3);

  // Invoice 6 — cancelled
  const inv6 = insInv.run('INV-006', 'نورا علي', '01099988877', null,
    'تم الإلغاء بطلب العميل', 5400, 0, 0, 5400, 'cancelled', '2026-03-10', '2026-03-05 08:30:00');
  const inv6id = inv6.lastInsertRowid;
  insII.run(inv6id, 'TSH-001', 'تيشيرت قطن - رمادي', 'رمادي', 30, 120, 3600, 0);
  insII.run(inv6id, 'TSH-001', 'تيشيرت قطن - كحلي', 'كحلي', 15, 120, 1800, 1);

  const totalInvItems = db.prepare('SELECT COUNT(*) as c FROM invoice_items').get().c;

  // ──────────── Suppliers (6) ────────────
  db.exec(`DELETE FROM supplier_payments; DELETE FROM purchase_order_items; DELETE FROM purchase_orders; DELETE FROM suppliers; DELETE FROM work_order_stages; DELETE FROM work_orders;`);

  const insSup = db.prepare('INSERT INTO suppliers (code, name, type, contact_person, phone, email, address, rating, notes) VALUES (?,?,?,?,?,?,?,?,?)');
  const sup1 = insSup.run('SUP-001', 'مصنع النسيج المصري', 'fabric', 'أحمد حسن', '01012345678', 'ahmed@textile-eg.com', 'المنطقة الصناعية - العاشر من رمضان', 5, 'مورد أقمشة قطنية ممتاز');
  const sup2 = insSup.run('SUP-002', 'شركة الأقمشة الدولية', 'fabric', 'محمد علي', '01198765432', 'info@intl-fabrics.com', 'وسط البلد - القاهرة', 4, 'بوليستر وأقمشة صناعية');
  const sup3 = insSup.run('SUP-003', 'مصنع الأزرار', 'accessory', 'فاطمة سعيد', '01055544433', 'buttons@factory.com', 'شبرا الخيمة', 4, 'أزرار ومستلزمات');
  const sup4 = insSup.run('SUP-004', 'شركة السوست', 'accessory', 'خالد محمود', '01077788899', 'zippers@co.com', 'حلوان', 3, 'سوست وإكسسوارات');
  const sup5 = insSup.run('SUP-005', 'واردات الحرير', 'fabric', 'سارة أحمد', '01033322211', 'silk@imports.com', 'الإسكندرية', 5, 'حرير طبيعي ومستورد');
  const sup6 = insSup.run('SUP-006', 'مصنع البطائن', 'fabric', 'يوسف إبراهيم', '01099988877', 'lining@factory.com', 'المنصورة', 4, 'بطائن بجميع الأنواع');

  // ──────────── Purchase Orders (4) ────────────
  const insPO = db.prepare('INSERT INTO purchase_orders (po_number, supplier_id, subtotal, tax_pct, discount, total, status, expected_date, notes) VALUES (?,?,?,?,?,?,?,?,?)');
  const insPOI = db.prepare('INSERT INTO purchase_order_items (po_id, item_type, item_code, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?,?)');

  const po1 = insPO.run('PO-001', sup1.lastInsertRowid, 6000, 14, 0, 6840, 'received', '2026-02-20', 'طلبية أقمشة قطنية');
  insPOI.run(po1.lastInsertRowid, 'fabric', 'CTN-001', 'قطن مصري ممتاز', 30, 120, 3600);
  insPOI.run(po1.lastInsertRowid, 'fabric', 'CTN-002', 'قطن مخلوط', 25.26, 95, 2400);

  const po2 = insPO.run('PO-002', sup3.lastInsertRowid, 1200, 0, 50, 1150, 'sent', '2026-03-15', 'طلبية أزرار وإكسسوارات');
  insPOI.run(po2.lastInsertRowid, 'accessory', 'BTN-001', 'زرار بلاستيك صغير', 500, 0.5, 250);
  insPOI.run(po2.lastInsertRowid, 'accessory', 'BTN-002', 'زرار معدني فضي', 200, 2.0, 400);
  insPOI.run(po2.lastInsertRowid, 'accessory', 'ZPR-001', 'سوستة معدنية 20سم', 50, 8.0, 400);
  insPOI.run(po2.lastInsertRowid, 'accessory', 'LBL-001', 'ليبل ماركة منسوج', 100, 1.5, 150);

  const po3 = insPO.run('PO-003', sup5.lastInsertRowid, 12500, 14, 500, 13750, 'draft', '2026-04-01', 'طلبية حرير - عرض سعر');
  insPOI.run(po3.lastInsertRowid, 'fabric', 'SLK-001', 'حرير شيفون', 25, 250, 6250);
  insPOI.run(po3.lastInsertRowid, 'fabric', 'SLK-002', 'حرير طبيعي', 19.53, 320, 6250);

  const po4 = insPO.run('PO-004', sup6.lastInsertRowid, 2000, 0, 0, 2000, 'received', '2026-02-28', 'طلبية بطائن');
  insPOI.run(po4.lastInsertRowid, 'fabric', 'LNG-001', 'بطانة قطن', 20, 45, 900);
  insPOI.run(po4.lastInsertRowid, 'fabric', 'LNG-002', 'بطانة بوليستر', 15, 35, 525);
  insPOI.run(po4.lastInsertRowid, 'fabric', 'LNG-003', 'بطانة ساتان', 10.45, 55, 575);

  // ──────────── Supplier Payments ────────────
  const insPayment = db.prepare('INSERT INTO supplier_payments (supplier_id, po_id, amount, payment_method, reference, notes) VALUES (?,?,?,?,?,?)');
  insPayment.run(sup1.lastInsertRowid, po1.lastInsertRowid, 6840, 'bank_transfer', 'TRF-2026-001', 'سداد كامل - طلبية أقمشة');
  insPayment.run(sup6.lastInsertRowid, po4.lastInsertRowid, 1500, 'cash', null, 'دفعة أولى - بطائن');

  // ──────────── Work Orders (3) ────────────
  const insWO = db.prepare('INSERT INTO work_orders (wo_number, model_id, quantity, priority, status, assigned_to, notes, start_date) VALUES (?,?,?,?,?,?,?,?)');
  const insWOS = db.prepare('INSERT INTO work_order_stages (work_order_id, stage_id, status) VALUES (?,?,?)');
  const prodStages = db.prepare('SELECT * FROM production_stages WHERE is_active=1 ORDER BY sort_order').all();

  // WO-001 — in progress (stages 1-2 done)
  const wo1 = insWO.run('WO-001', m1id, 107, 'high', 'in_progress', 'ورشة 1', 'طلبية محل الزيتون', datetime('now', '-5 days'));
  prodStages.forEach((s, i) => {
    const status = i < 2 ? 'completed' : i === 2 ? 'in_progress' : 'pending';
    insWOS.run(wo1.lastInsertRowid, s.id, status);
  });

  // WO-002 — draft
  const wo2 = insWO.run('WO-002', m2id, 190, 'normal', 'draft', 'ورشة 2', 'طلبية شركة', null);
  prodStages.forEach((s) => {
    insWOS.run(wo2.lastInsertRowid, s.id, 'pending');
  });

  // WO-003 — completed
  const wo3 = insWO.run('WO-003', m7id, 437, 'low', 'completed', 'ورشة 1', 'طلبية سنوية', datetime('now', '-20 days'));
  prodStages.forEach((s) => {
    insWOS.run(wo3.lastInsertRowid, s.id, 'completed');
  });

  const totalPO = db.prepare('SELECT COUNT(*) as c FROM purchase_orders').get().c;
  const totalSup = db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c;
  const totalWO = db.prepare('SELECT COUNT(*) as c FROM work_orders').get().c;

  console.log(`Seed complete! Added:
  - 4 settings
  - 20 fabrics (15 main + 5 lining)
  - 15 accessories
  - 10 models with fabrics, accessories, sizes & cost snapshots
  - 6 invoices with ${totalInvItems} line items (2 paid, 1 sent, 1 draft, 1 overdue, 1 cancelled)
  - ${totalSup} suppliers
  - ${totalPO} purchase orders with items
  - ${totalWO} work orders with stages`);
}

function datetime(base, offset) {
  const d = new Date();
  if (offset) {
    const match = offset.match(/([+-]?\d+)\s*(days?|hours?|minutes?)/);
    if (match) {
      const val = parseInt(match[1]);
      const unit = match[2];
      if (unit.startsWith('day')) d.setDate(d.getDate() + val);
      else if (unit.startsWith('hour')) d.setHours(d.getHours() + val);
    }
  }
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

seed();
