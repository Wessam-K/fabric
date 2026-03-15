const db = require('./database');

function seed() {
  console.log('Seeding WK-Hub database...');

  // Clear existing data
  db.exec(`
    DELETE FROM cost_snapshots;
    DELETE FROM model_accessories;
    DELETE FROM model_fabrics;
    DELETE FROM model_sizes;
    DELETE FROM models;
    DELETE FROM accessories;
    DELETE FROM fabrics;
    DELETE FROM settings;
  `);

  // Seed settings
  const insSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  [['masnaiya_default', '90'], ['masrouf_default', '50'], ['waste_pct_default', '5'], ['margin_default', '30']].forEach(s => insSetting.run(...s));

  // Seed fabrics (12)
  const insFab = db.prepare('INSERT INTO fabrics (code, name, fabric_type, price_per_m, supplier, color) VALUES (?, ?, ?, ?, ?, ?)');
  [
    ['CTN-001', 'قطن مصري', 'main', 120, 'مصنع النسيج المصري', 'أبيض'],
    ['CTN-002', 'قطن مخلوط', 'main', 95, 'مصنع النسيج المصري', 'بيج'],
    ['PLY-001', 'بوليستر ساتان', 'main', 85, 'شركة الأقمشة الدولية', 'أسود'],
    ['SLK-001', 'حرير شيفون', 'main', 250, 'واردات الحرير', 'كحلي'],
    ['LNN-001', 'كتان طبيعي', 'main', 180, 'مصنع الكتان', 'أوف وايت'],
    ['DNM-001', 'جينز', 'main', 110, 'مصانع الجينز', 'أزرق'],
    ['WOL-001', 'صوف مخلوط', 'main', 200, 'شركة الصوف', 'رمادي'],
    ['CRP-001', 'كريب', 'main', 150, 'مصنع الأقمشة', 'أسود'],
    ['LNG-001', 'بطانة قطن', 'lining', 45, 'مصنع البطائن', 'أبيض'],
    ['LNG-002', 'بطانة بوليستر', 'lining', 35, 'مصنع البطائن', 'أسود'],
    ['LNG-003', 'بطانة ساتان', 'lining', 55, 'مصنع البطائن', 'بيج'],
    ['VLV-001', 'قطيفة', 'both', 170, 'مصنع القطيفة', 'عنابي'],
  ].forEach(f => insFab.run(...f));

  // Seed accessories (10)
  const insAcc = db.prepare('INSERT INTO accessories (code, acc_type, name, unit_price, unit, supplier) VALUES (?, ?, ?, ?, ?, ?)');
  [
    ['BTN-001', 'button', 'زرار بلاستيك صغير', 0.5, 'piece', 'مصنع الأزرار'],
    ['BTN-002', 'button', 'زرار معدني فضي', 2.0, 'piece', 'مصنع الأزرار'],
    ['ZPR-001', 'zipper', 'سوستة معدنية 20سم', 8.0, 'piece', 'شركة السوست'],
    ['ZPR-002', 'zipper', 'سوستة مخفية 50سم', 12.0, 'piece', 'شركة السوست'],
    ['THR-001', 'thread', 'خيط بوليستر أبيض', 15.0, 'roll', 'مصنع الخيوط'],
    ['LBL-001', 'label', 'ليبل ماركة منسوج', 1.5, 'piece', 'مصنع الليبلات'],
    ['LBL-002', 'label', 'ليبل مقاس', 0.3, 'piece', 'مصنع الليبلات'],
    ['PAD-001', 'padding', 'حشو كتف', 3.0, 'piece', 'مصنع الحشو'],
    ['ITF-001', 'interfacing', 'فازلين لاصق', 20.0, 'meter', 'مصنع الفازلين'],
    ['OTH-001', 'other', 'شريط ساتان', 5.0, 'meter', 'مصنع الشرائط'],
  ].forEach(a => insAcc.run(...a));

  // Helper: insert model with nested data and cost snapshot
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
  }

  // --- Model 1: DRS-001 Dress ---
  const m1 = insModel.run('1-001', 'DRS-001', 'فستان سهرة كلاسيك', 90, 50, 450, 350, 'موديل فستان سهرة بأكمام طويلة');
  const m1id = m1.lastInsertRowid;
  const m1fabrics = [
    [m1id, 'SLK-001', 'main', 2.5, 5, 'كحلي', 0],
    [m1id, 'LNG-003', 'lining', 2.0, 0, 'بيج', 0],
  ];
  m1fabrics.forEach(f => insMF.run(...f));
  const m1acc = [
    [m1id, 'ZPR-002', 'سوستة مخفية', 1, 12.0],
    [m1id, 'LBL-001', 'ليبل ماركة', 1, 1.5],
    [m1id, 'LBL-002', 'ليبل مقاس', 1, 0.3],
    [m1id, 'THR-001', 'خيط بوليستر', 0.5, 15.0],
  ];
  m1acc.forEach(a => insMA.run(...a));
  const m1sizes = [
    [m1id, 'كحلي', 5, 10, 15, 10, 5, 0],
    [m1id, 'أسود', 3, 8, 12, 8, 4, 0],
  ];
  m1sizes.forEach(s => insMS.run(...s));
  calcAndInsert(m1id, m1fabrics, m1acc, m1sizes, 90, 50, 450, 350);

  // --- Model 2: PNT-001 Pants ---
  const m2 = insModel.run('1-002', 'PNT-001', 'بنطلون جينز كاجوال', 70, 40, 280, 220, 'بنطلون جينز بقصة مستقيمة');
  const m2id = m2.lastInsertRowid;
  const m2fabrics = [
    [m2id, 'DNM-001', 'main', 1.8, 3, 'أزرق', 0],
    [m2id, 'LNG-001', 'lining', 0.5, 0, 'أبيض', 0],
  ];
  m2fabrics.forEach(f => insMF.run(...f));
  const m2acc = [
    [m2id, 'BTN-002', 'زرار معدني', 1, 2.0],
    [m2id, 'ZPR-001', 'سوستة معدنية', 1, 8.0],
    [m2id, 'LBL-001', 'ليبل ماركة', 1, 1.5],
    [m2id, 'LBL-002', 'ليبل مقاس', 1, 0.3],
  ];
  m2acc.forEach(a => insMA.run(...a));
  const m2sizes = [
    [m2id, 'أزرق فاتح', 8, 15, 20, 15, 8, 3],
    [m2id, 'أزرق غامق', 5, 12, 18, 12, 5, 2],
  ];
  m2sizes.forEach(s => insMS.run(...s));
  calcAndInsert(m2id, m2fabrics, m2acc, m2sizes, 70, 40, 280, 220);

  // --- Model 3: JKT-001 Jacket ---
  const m3 = insModel.run('1-003', 'JKT-001', 'جاكيت صوف رسمي', 120, 60, 650, 500, 'جاكيت صوف بتصميم رسمي مع بطانة ساتان');
  const m3id = m3.lastInsertRowid;
  const m3fabrics = [
    [m3id, 'WOL-001', 'main', 2.8, 5, 'رمادي', 0],
    [m3id, 'LNG-003', 'lining', 2.5, 0, 'بيج', 0],
  ];
  m3fabrics.forEach(f => insMF.run(...f));
  const m3acc = [
    [m3id, 'BTN-002', 'زرار معدني فضي', 4, 2.0],
    [m3id, 'PAD-001', 'حشو كتف', 2, 3.0],
    [m3id, 'ITF-001', 'فازلين لاصق', 1.5, 20.0],
    [m3id, 'LBL-001', 'ليبل ماركة', 1, 1.5],
    [m3id, 'LBL-002', 'ليبل مقاس', 1, 0.3],
    [m3id, 'THR-001', 'خيط بوليستر', 1, 15.0],
  ];
  m3acc.forEach(a => insMA.run(...a));
  const m3sizes = [
    [m3id, 'رمادي', 3, 8, 12, 10, 5, 2],
    [m3id, 'كحلي', 2, 6, 10, 8, 4, 1],
  ];
  m3sizes.forEach(s => insMS.run(...s));
  calcAndInsert(m3id, m3fabrics, m3acc, m3sizes, 120, 60, 650, 500);

  console.log('Seed complete! Added 4 settings, 12 fabrics, 10 accessories, 3 models with cost snapshots.');
}

seed();
