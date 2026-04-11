/**
 * WK-Hub Comprehensive Seed Script v2
 * Generates 3 months of realistic production data for a garment factory ERP
 * Period: January 5, 2026 – April 5, 2026
 * 
 * Idempotent: uses INSERT OR IGNORE / INSERT OR REPLACE throughout
 * Egypt weekend: Friday (5) + Saturday (6)
 * Currency: EGP (Egyptian Pounds)
 */

const db = require('./database');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const pathMod = require('path');

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
const SEED_START = new Date('2026-01-05');
const SEED_END   = new Date('2026-04-05');

function dt(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }
function dd(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, dec = 2) { return +(Math.random() * (max - min) + min).toFixed(dec); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) { const s = [...arr].sort(() => Math.random() - 0.5); return s.slice(0, Math.min(n, s.length)); }
function randDate(from, to) {
  const f = from.getTime(), t = to.getTime();
  return new Date(f + Math.random() * (t - f));
}
function randWeekday(from, to) {
  let d;
  do { d = randDate(from, to); } while (!isWeekday(d));
  return d;
}
function isWeekday(d) { const day = d.getDay(); return day !== 5 && day !== 6; }
function pad(n, len = 3) { return String(n).padStart(len, '0'); }

// ─── MINIMAL PNG GENERATOR (no dependencies) ──
function makePNG(r, g, b) {
  const W = 64, H = 64;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const off = y * (1 + W * 3);
    raw[off] = 0;
    for (let x = 0; x < W; x++) {
      const px = off + 1 + x * 3;
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b;
    }
  }
  const zlib = require('zlib');
  const deflated = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const crcTable = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) | 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const tp = Buffer.from(type, 'ascii');
    const body = Buffer.concat([tp, data]);
    const crc32buf = Buffer.alloc(4);
    crc32buf.writeInt32BE(crc32(body));
    return Buffer.concat([len, body, crc32buf]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', Buffer.alloc(0))]);
}

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

// ═══════════════════════════════════════════════════
// DATA DEFINITIONS
// ═══════════════════════════════════════════════════

const SUPPLIERS = [
  { code: 'SUP-001', name: 'Al-Nile Textiles',       name_ar: 'نسيج النيل',             type: 'fabric',    phone: '01001234567', email: 'info@alnile-textiles.com',    address: 'المنطقة الصناعية، القاهرة',    city: 'القاهرة',     contact: 'أحمد محمود',   terms: 'net_30', rating: 5 },
  { code: 'SUP-002', name: 'Delta Cotton Co',        name_ar: 'شركة دلتا للقطن',        type: 'fabric',    phone: '01112345678', email: 'sales@deltacotton.com',       address: 'شارع الجمهورية، المنصورة',     city: 'المنصورة',    contact: 'محمد حسن',     terms: 'net_30', rating: 4 },
  { code: 'SUP-003', name: 'Sphinx Accessories',     name_ar: 'إكسسوارات سفنكس',        type: 'accessory', phone: '01223456789', email: 'orders@sphinx-acc.com',       address: 'شبرا الخيمة، القاهرة',         city: 'القاهرة',     contact: 'ياسر عبدالله', terms: 'net_30', rating: 4 },
  { code: 'SUP-004', name: 'Mediterranean Threads',  name_ar: 'خيوط البحر المتوسط',      type: 'accessory', phone: '01098765432', email: 'med@threads.com',             address: 'كورنيش البحر، الإسكندرية',     city: 'الإسكندرية',  contact: 'عمر خالد',     terms: 'net_60', rating: 4 },
  { code: 'SUP-005', name: 'Nile Buttons & Zippers', name_ar: 'أزرار وسوست النيل',       type: 'accessory', phone: '01556789012', email: 'sales@nile-bz.com',           address: 'الوراق، الجيزة',               city: 'الجيزة',      contact: 'حسام فاروق',   terms: 'net_30', rating: 5 },
  { code: 'SUP-006', name: 'Eastern Fabric House',   name_ar: 'دار الأقمشة الشرقية',     type: 'fabric',    phone: '01234567890', email: 'eastern@fabrichouse.com',     address: 'مدينة نصر، القاهرة',           city: 'القاهرة',     contact: 'سامي إبراهيم', terms: 'net_30', rating: 4 },
  { code: 'SUP-007', name: 'Horizon Lining Co',      name_ar: 'أفق للبطائن',             type: 'accessory', phone: '01067890123', email: 'info@horizon-lining.com',     address: 'المنطقة الحرة، السويس',        city: 'السويس',      contact: 'رامي عادل',    terms: 'net_30', rating: 3 },
  { code: 'SUP-008', name: 'Pharaoh Elastic Supply', name_ar: 'فرعون للمطاط',            type: 'accessory', phone: '01178901234', email: 'pharaoh@elastic.com',         address: 'المعادي، القاهرة',             city: 'القاهرة',     contact: 'طارق سعيد',    terms: 'net_30', rating: 4 },
];

const FABRICS = [
  { code: 'FAB-001', name: 'Plain Cotton 60/40',       name_ar: 'قطن سادة 60/40',       type: 'main',   supplier: 'SUP-001', price: 18.50, color: 'أبيض',         rgb: [255, 255, 255] },
  { code: 'FAB-002', name: 'Twill Denim Blue',         name_ar: 'تويل دينيم أزرق',      type: 'main',   supplier: 'SUP-001', price: 32.00, color: 'أزرق دينيم',   rgb: [0, 86, 148] },
  { code: 'FAB-003', name: 'Polyester Blend Black',    name_ar: 'بوليستر مخلوط أسود',    type: 'main',   supplier: 'SUP-002', price: 22.00, color: 'أسود',         rgb: [30, 30, 30] },
  { code: 'FAB-004', name: 'Linen Summer Beige',       name_ar: 'كتان صيفي بيج',        type: 'main',   supplier: 'SUP-006', price: 45.00, color: 'بيج',          rgb: [210, 180, 140] },
  { code: 'FAB-005', name: 'Fleece Warm Grey',         name_ar: 'فليس دافئ رمادي',      type: 'main',   supplier: 'SUP-002', price: 28.00, color: 'رمادي',        rgb: [160, 160, 160] },
  { code: 'FAB-006', name: 'Stretch Jersey White',     name_ar: 'جيرسي مطاط أبيض',      type: 'main',   supplier: 'SUP-001', price: 19.00, color: 'أبيض',         rgb: [250, 250, 250] },
  { code: 'FAB-007', name: 'Canvas Heavy Duty',        name_ar: 'كانفاس ثقيل',          type: 'main',   supplier: 'SUP-006', price: 38.00, color: 'كاكي',         rgb: [189, 183, 107] },
  { code: 'FAB-008', name: 'Satin Silk-feel Black',    name_ar: 'ساتان حريري أسود',     type: 'main',   supplier: 'SUP-001', price: 55.00, color: 'أسود',         rgb: [20, 20, 20] },
  { code: 'FAB-009', name: 'Interlock Cotton',         name_ar: 'قطن إنترلوك',          type: 'lining', supplier: 'SUP-002', price: 14.00, color: 'أبيض',         rgb: [240, 240, 240] },
  { code: 'FAB-010', name: 'Pocket Lining Grey',       name_ar: 'بطانة جيب رمادي',      type: 'lining', supplier: 'SUP-007', price: 11.00, color: 'رمادي',        rgb: [180, 180, 180] },
  { code: 'FAB-011', name: 'Fusible Interlining',      name_ar: 'فازلين لاصق',          type: 'lining', supplier: 'SUP-007', price: 9.50,  color: 'أبيض',         rgb: [245, 245, 245] },
  { code: 'FAB-012', name: 'Woven Elastic Waistband',  name_ar: 'شريط خصر مطاط محاك',   type: 'main',   supplier: 'SUP-008', price: 7.00,  color: 'أسود',         rgb: [10, 10, 10] },
];

const ACCESSORIES = [
  { code: 'ACC-001', name: 'Brass Button 15mm',         name_ar: 'زر نحاس 15مم',         type: 'button',    supplier: 'SUP-003', price: 0.85,  unit: 'piece', qty: 5000,  rgb: [184, 134, 11] },
  { code: 'ACC-002', name: 'Plastic Button 12mm',       name_ar: 'زر بلاستيك 12مم',      type: 'button',    supplier: 'SUP-003', price: 0.45,  unit: 'piece', qty: 8000,  rgb: [200, 200, 200] },
  { code: 'ACC-003', name: 'Metal Zipper 20cm',         name_ar: 'سوستة معدن 20سم',      type: 'zipper',    supplier: 'SUP-005', price: 3.20,  unit: 'piece', qty: 2000,  rgb: [169, 169, 169] },
  { code: 'ACC-004', name: 'Invisible Zipper 22cm',     name_ar: 'سوستة مخفية 22سم',     type: 'zipper',    supplier: 'SUP-005', price: 2.80,  unit: 'piece', qty: 2500,  rgb: [100, 100, 100] },
  { code: 'ACC-005', name: 'Elastic Band 3cm',          name_ar: 'شريط مطاط 3سم',        type: 'elastic',   supplier: 'SUP-008', price: 1.10,  unit: 'meter', qty: 3000,  rgb: [220, 220, 220] },
  { code: 'ACC-006', name: 'Elastic Band 5cm',          name_ar: 'شريط مطاط 5سم',        type: 'elastic',   supplier: 'SUP-008', price: 1.60,  unit: 'meter', qty: 2000,  rgb: [200, 200, 200] },
  { code: 'ACC-007', name: 'Polyester Thread White',    name_ar: 'خيط بوليستر أبيض',     type: 'thread',    supplier: 'SUP-004', price: 12.00, unit: 'roll',  qty: 500,   rgb: [255, 255, 240] },
  { code: 'ACC-008', name: 'Polyester Thread Black',    name_ar: 'خيط بوليستر أسود',     type: 'thread',    supplier: 'SUP-004', price: 12.00, unit: 'roll',  qty: 500,   rgb: [40, 40, 40] },
  { code: 'ACC-009', name: 'Label Woven Brand',         name_ar: 'ليبل ماركة محاك',       type: 'label',     supplier: 'SUP-004', price: 0.30,  unit: 'piece', qty: 10000, rgb: [255, 215, 0] },
  { code: 'ACC-010', name: 'Care Label (wash instr.)',  name_ar: 'ليبل تعليمات غسيل',    type: 'label',     supplier: 'SUP-004', price: 0.20,  unit: 'piece', qty: 10000, rgb: [255, 255, 255] },
  { code: 'ACC-011', name: 'Hang Tag w/ string',        name_ar: 'تاج تعليق بخيط',       type: 'packaging', supplier: 'SUP-003', price: 0.50,  unit: 'piece', qty: 5000,  rgb: [139, 119, 101] },
  { code: 'ACC-012', name: 'Polybag 40x60cm',           name_ar: 'كيس بولي 40×60سم',     type: 'packaging', supplier: 'SUP-003', price: 0.25,  unit: 'piece', qty: 8000,  rgb: [200, 230, 255] },
  { code: 'ACC-013', name: 'Cardboard Box 30x20x10',    name_ar: 'كرتونة 30×20×10سم',    type: 'packaging', supplier: 'SUP-003', price: 4.50,  unit: 'piece', qty: 1000,  rgb: [160, 120, 60] },
  { code: 'ACC-014', name: 'Hook & Eye Set',            name_ar: 'طقم عراوي',             type: 'other',     supplier: 'SUP-005', price: 0.60,  unit: 'piece', qty: 3000,  rgb: [192, 192, 192] },
  { code: 'ACC-015', name: 'Shoulder Pad Medium',       name_ar: 'كتافة متوسطة',          type: 'padding',   supplier: 'SUP-006', price: 2.40,  unit: 'piece', qty: 1500,  rgb: [240, 240, 240] },
];

const CUSTOMERS = [
  { code: 'CUS-001', name: 'Nile Fashion House',       name_ar: 'دار أزياء النيل',       phone: '01001112233', email: 'orders@nilefashion.com',  address: 'الزمالك، القاهرة',         city: 'القاهرة',     type: 'wholesale', terms: 'صافي 30 يوم', limit: 200000 },
  { code: 'CUS-002', name: 'Delta Clothing Ltd',       name_ar: 'دلتا للملابس',          phone: '01112223344', email: 'info@deltaclothing.com',  address: 'شارع الجمهورية، المنصورة', city: 'المنصورة',    type: 'wholesale', terms: 'صافي 45 يوم', limit: 150000 },
  { code: 'CUS-003', name: 'Cairo Ready-Wear',         name_ar: 'القاهرة للملابس الجاهزة', phone: '01223334455', email: 'sales@cairoreadywear.com', address: 'مدينة نصر، القاهرة',      city: 'القاهرة',     type: 'retail',    terms: 'نقدي',        limit: 80000 },
  { code: 'CUS-004', name: 'Export Garments Inc',      name_ar: 'شركة تصدير الملابس',     phone: '01098887766', email: 'export@garments-inc.com', address: 'الحي التجاري، الإسكندرية', city: 'الإسكندرية',  type: 'wholesale', terms: 'صافي 60 يوم', limit: 500000 },
  { code: 'CUS-005', name: 'Stars Boutique Chain',     name_ar: 'سلسلة بوتيك ستارز',     phone: '01556667788', email: 'info@starsboutique.com',  address: 'شارع فيصل، الجيزة',       city: 'الجيزة',      type: 'retail',    terms: 'صافي 30 يوم', limit: 100000 },
  { code: 'CUS-006', name: 'Gulf Fashion Trading',     name_ar: 'الخليج لتجارة الأزياء',  phone: '01234445566', email: 'gulf@fashiontrading.com', address: 'المعادي، القاهرة',         city: 'القاهرة',     type: 'wholesale', terms: 'صافي 30 يوم', limit: 300000 },
];

const MODELS = [
  { code: 'MOD-001', name: "Men's Cotton Shirt",     name_ar: 'قميص قطن رجالي',      category: 'shirt',    gender: 'male',   unitPrice: 185 },
  { code: 'MOD-002', name: "Women's Blouse",         name_ar: 'بلوزة نسائية',         category: 'blouse',   gender: 'female', unitPrice: 220 },
  { code: 'MOD-003', name: "Men's Denim Trousers",   name_ar: 'بنطلون جينز رجالي',   category: 'trousers', gender: 'male',   unitPrice: 260 },
  { code: 'MOD-004', name: "Children's T-Shirt",     name_ar: 'تيشيرت أطفال',         category: 'tshirt',   gender: 'kids',   unitPrice: 95 },
  { code: 'MOD-005', name: "Women's Linen Dress",    name_ar: 'فستان كتان نسائي',    category: 'dress',    gender: 'female', unitPrice: 310 },
  { code: 'MOD-006', name: "Men's Jacket",           name_ar: 'جاكيت رجالي',          category: 'jacket',   gender: 'male',   unitPrice: 490 },
];

// BOM definitions: model_code → [{ fabric_code, meters_per_piece, role }]
const MODEL_BOM_FABRICS = {
  'MOD-001': [ { fabric: 'FAB-001', meters: 2.2, role: 'main' }, { fabric: 'FAB-009', meters: 0.3, role: 'lining' }, { fabric: 'FAB-011', meters: 0.4, role: 'lining' } ],
  'MOD-002': [ { fabric: 'FAB-008', meters: 1.8, role: 'main' }, { fabric: 'FAB-009', meters: 0.3, role: 'lining' }, { fabric: 'FAB-011', meters: 0.3, role: 'lining' } ],
  'MOD-003': [ { fabric: 'FAB-002', meters: 2.8, role: 'main' }, { fabric: 'FAB-010', meters: 0.4, role: 'lining' } ],
  'MOD-004': [ { fabric: 'FAB-006', meters: 1.2, role: 'main' } ],
  'MOD-005': [ { fabric: 'FAB-004', meters: 3.0, role: 'main' }, { fabric: 'FAB-009', meters: 0.5, role: 'lining' } ],
  'MOD-006': [ { fabric: 'FAB-007', meters: 3.2, role: 'main' }, { fabric: 'FAB-005', meters: 1.0, role: 'lining' }, { fabric: 'FAB-011', meters: 0.6, role: 'lining' }, { fabric: 'FAB-012', meters: 0.3, role: 'main' } ],
};

const MODEL_BOM_ACCESSORIES = {
  'MOD-001': [ { acc: 'ACC-001', qty: 8 }, { acc: 'ACC-007', qty: 0.05 }, { acc: 'ACC-009', qty: 1 }, { acc: 'ACC-010', qty: 1 }, { acc: 'ACC-011', qty: 1 }, { acc: 'ACC-012', qty: 1 } ],
  'MOD-002': [ { acc: 'ACC-002', qty: 6 }, { acc: 'ACC-004', qty: 1 }, { acc: 'ACC-007', qty: 0.05 }, { acc: 'ACC-009', qty: 1 }, { acc: 'ACC-010', qty: 1 }, { acc: 'ACC-011', qty: 1 }, { acc: 'ACC-012', qty: 1 } ],
  'MOD-003': [ { acc: 'ACC-001', qty: 1 }, { acc: 'ACC-003', qty: 1 }, { acc: 'ACC-005', qty: 0.3 }, { acc: 'ACC-008', qty: 0.05 }, { acc: 'ACC-009', qty: 1 }, { acc: 'ACC-010', qty: 1 }, { acc: 'ACC-012', qty: 1 } ],
  'MOD-004': [ { acc: 'ACC-007', qty: 0.03 }, { acc: 'ACC-009', qty: 1 }, { acc: 'ACC-010', qty: 1 }, { acc: 'ACC-012', qty: 1 } ],
  'MOD-005': [ { acc: 'ACC-004', qty: 1 }, { acc: 'ACC-014', qty: 2 }, { acc: 'ACC-007', qty: 0.05 }, { acc: 'ACC-009', qty: 1 }, { acc: 'ACC-010', qty: 1 }, { acc: 'ACC-011', qty: 1 }, { acc: 'ACC-012', qty: 1 } ],
  'MOD-006': [ { acc: 'ACC-001', qty: 6 }, { acc: 'ACC-003', qty: 1 }, { acc: 'ACC-015', qty: 2 }, { acc: 'ACC-008', qty: 0.08 }, { acc: 'ACC-009', qty: 1 }, { acc: 'ACC-010', qty: 1 }, { acc: 'ACC-011', qty: 1 }, { acc: 'ACC-012', qty: 1 }, { acc: 'ACC-013', qty: 0.1 } ],
};

const STAGE_TEMPLATES = [
  { name: 'قص',          name_en: 'Cutting',       sort: 1, color: '#3B82F6' },
  { name: 'خياطة',       name_en: 'Sewing',        sort: 2, color: '#8B5CF6' },
  { name: 'كي',          name_en: 'Ironing',       sort: 3, color: '#F59E0B' },
  { name: 'مراجعة جودة', name_en: 'Quality Check', sort: 4, color: '#10B981' },
  { name: 'تغليف',      name_en: 'Packing',       sort: 5, color: '#6366F1' },
  { name: 'تسليم',      name_en: 'Shipping',      sort: 6, color: '#EC4899' },
];

// 18 Work Orders with specific stage distributions
// Stage quantities: [cut, sewn, ironed, qc_passed, packed, shipped]
const WORK_ORDERS = [
  { num: 'WO-2026-001', cust: 'CUS-001', model: 'MOD-001', qty: 200,  status: 'completed',   priority: 'normal', stages: [200,200,200,200,200,200], startOff: 0,  dueOff: 21  },
  { num: 'WO-2026-002', cust: 'CUS-002', model: 'MOD-003', qty: 300,  status: 'in_progress', priority: 'high',   stages: [300,300,300,200,200,200], startOff: 5,  dueOff: 30  },
  { num: 'WO-2026-003', cust: 'CUS-003', model: 'MOD-004', qty: 500,  status: 'in_progress', priority: 'normal', stages: [500,400,300,0,0,0],       startOff: 10, dueOff: 35, pauseNote: 'انتظار قماش إضافي' },
  { num: 'WO-2026-004', cust: 'CUS-001', model: 'MOD-002', qty: 150,  status: 'in_progress', priority: 'high',   stages: [150,150,100,50,50,50],    startOff: 15, dueOff: 40  },
  { num: 'WO-2026-005', cust: 'CUS-004', model: 'MOD-005', qty: 250,  status: 'completed',   priority: 'normal', stages: [250,250,250,250,250,250], startOff: 3,  dueOff: 28  },
  { num: 'WO-2026-006', cust: 'CUS-005', model: 'MOD-001', qty: 100,  status: 'in_progress', priority: 'low',    stages: [100,50,0,0,0,0],          startOff: 20, dueOff: 50, pauseNote: 'مشكلة في ماكينة الخياطة' },
  { num: 'WO-2026-007', cust: 'CUS-006', model: 'MOD-006', qty: 80,   status: 'in_progress', priority: 'high',   stages: [80,80,80,80,80,0],        startOff: 8,  dueOff: 32, subcontract: { name: 'ورشة البدر للخياطة', cost: 4800, notes: 'تعهيد خياطة الجاكيت — خياطة متقدمة' } },
  { num: 'WO-2026-008', cust: 'CUS-002', model: 'MOD-001', qty: 400,  status: 'in_progress', priority: 'urgent', stages: [400,350,200,0,0,0],       startOff: 25, dueOff: 55, subcontract: { name: 'مصنع الأمل للملابس', cost: 12000, notes: 'تعهيد قص وخياطة — طلبية كبيرة' } },
  { num: 'WO-2026-009', cust: 'CUS-001', model: 'MOD-003', qty: 180,  status: 'pending',     priority: 'normal', stages: [0,0,0,0,0,0],             startOff: 60, dueOff: 80  },
  { num: 'WO-2026-010', cust: 'CUS-003', model: 'MOD-002', qty: 220,  status: 'in_progress', priority: 'normal', stages: [220,220,220,200,200,180], startOff: 12, dueOff: 38  },
  { num: 'WO-2026-011', cust: 'CUS-004', model: 'MOD-004', qty: 600,  status: 'completed',   priority: 'high',   stages: [600,600,500,400,400,400], startOff: 2,  dueOff: 30  },
  { num: 'WO-2026-012', cust: 'CUS-001', model: 'MOD-006', qty: 60,   status: 'completed',   priority: 'normal', stages: [60,60,60,60,60,60],       startOff: 18, dueOff: 42  },
  { num: 'WO-2026-013', cust: 'CUS-006', model: 'MOD-005', qty: 300,  status: 'in_progress', priority: 'normal', stages: [300,200,0,0,0,0],         startOff: 30, dueOff: 60, pauseNote: 'انتظار وصول بطانة من المورد', subcontract: { name: 'ورشة النور للتطريز', cost: 9000, notes: 'تعهيد تطريز الفستان الكتان' } },
  { num: 'WO-2026-014', cust: 'CUS-005', model: 'MOD-003', qty: 120,  status: 'in_progress', priority: 'normal', stages: [120,120,120,120,100,0],   startOff: 22, dueOff: 48  },
  { num: 'WO-2026-015', cust: 'CUS-002', model: 'MOD-006', qty: 90,   status: 'pending',     priority: 'normal', stages: [0,0,0,0,0,0],             startOff: 65, dueOff: 85  },
  { num: 'WO-2026-016', cust: 'CUS-003', model: 'MOD-001', qty: 350,  status: 'in_progress', priority: 'high',   stages: [350,350,300,200,0,0],     startOff: 28, dueOff: 55  },
  { num: 'WO-2026-017', cust: 'CUS-001', model: 'MOD-002', qty: 200,  status: 'completed',   priority: 'normal', stages: [200,200,200,200,200,200], startOff: 7,  dueOff: 28  },
  { num: 'WO-2026-018', cust: 'CUS-004', model: 'MOD-001', qty: 450,  status: 'pending',     priority: 'urgent', stages: [0,0,0,0,0,0],             startOff: 70, dueOff: 90  },
];

// Invoices linked to work orders
const INVOICES = [
  { num: 'INV-2026-001', wo: 'WO-2026-001', status: 'paid',           shipped: 200 },
  { num: 'INV-2026-002', wo: 'WO-2026-005', status: 'paid',           shipped: 250 },
  { num: 'INV-2026-003', wo: 'WO-2026-011', status: 'paid',           shipped: 400 },
  { num: 'INV-2026-004', wo: 'WO-2026-012', status: 'paid',           shipped: 60  },
  { num: 'INV-2026-005', wo: 'WO-2026-017', status: 'paid',           shipped: 200 },
  { num: 'INV-2026-006', wo: 'WO-2026-002', status: 'partially_paid', shipped: 200 },
  { num: 'INV-2026-007', wo: 'WO-2026-004', status: 'sent',           shipped: 50  },
  { num: 'INV-2026-008', wo: 'WO-2026-007', status: 'draft',          shipped: 0   },
  { num: 'INV-2026-009', wo: 'WO-2026-010', status: 'sent',           shipped: 180 },
  { num: 'INV-2026-010', wo: 'WO-2026-014', status: 'draft',          shipped: 0   },
];

const EMPLOYEES = [
  { code: 'EMP-001', name: 'أحمد حسن',     natId: '28501011234567', dept: 'production', title: 'عامل قص',       type: 'full_time', salary_type: 'monthly', salary: 4500 },
  { code: 'EMP-002', name: 'سارة محمد',     natId: '29002021234567', dept: 'production', title: 'عاملة خياطة',    type: 'full_time', salary_type: 'monthly', salary: 4200 },
  { code: 'EMP-003', name: 'عمر علي',       natId: '28803031234567', dept: 'production', title: 'عامل كي',       type: 'full_time', salary_type: 'monthly', salary: 3800 },
  { code: 'EMP-004', name: 'فاطمة إبراهيم', natId: '29204041234567', dept: 'quality',    title: 'مفتشة جودة',     type: 'full_time', salary_type: 'monthly', salary: 5000 },
  { code: 'EMP-005', name: 'خالد محمود',    natId: '28705051234567', dept: 'production', title: 'مشرف تغليف',     type: 'full_time', salary_type: 'monthly', salary: 5500 },
  { code: 'EMP-006', name: 'منى سعد',       natId: '29106061234567', dept: 'shipping',   title: 'منسقة شحن',      type: 'full_time', salary_type: 'monthly', salary: 4800 },
];

const MACHINES = [
  { code: 'MACH-001', name: 'Singer Industrial Sewing', type: 'sewing_machine', brand: 'Singer',    model: 'S920',  status: 'active',      cost_hr: 15, capacity_hr: 25 },
  { code: 'MACH-002', name: 'Brother Overlock',         type: 'overlock',       brand: 'Brother',   model: 'OV600', status: 'active',      cost_hr: 18, capacity_hr: 30 },
  { code: 'MACH-003', name: 'Industrial Iron Press',    type: 'pressing',       brand: 'Veit',      model: 'HP500', status: 'active',      cost_hr: 12, capacity_hr: 40 },
  { code: 'MACH-004', name: 'Cutting Table Electric',   type: 'cutting',        brand: 'Eastman',   model: 'EC700', status: 'maintenance', cost_hr: 20, capacity_hr: 50 },
];

const USERS = [
  { username: 'admin',   name: 'مدير النظام',   email: 'admin@fabric.local',   role: 'superadmin',  dept: 'management' },
  { username: 'wessam',  name: 'وسام خطاب',      email: 'wessam@fabric.local',  role: 'superadmin',  dept: 'management' },
  { username: 'manager', name: 'مدير الإنتاج',   email: 'manager@fabric.local', role: 'manager',     dept: 'production' },
  { username: 'viewer',  name: 'مستخدم عرض',     email: 'viewer@fabric.local',  role: 'viewer',      dept: 'management' },
];

// ═══════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════
function seed() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  WK-Hub Seed — Generating 3 months of data');
  console.log(`  Period: ${dd(SEED_START)} → ${dd(SEED_END)}`);
  console.log('═══════════════════════════════════════════════════\n');

  // DB tables are initialized by require('./database')

  // ─── 1. USERS ───────────────────────────────────
  console.log('  → Seeding users...');
  const hash = bcrypt.hashSync('123456', 12);
  const insUser = db.prepare(`INSERT OR IGNORE INTO users (username, full_name, email, password_hash, role, department, status, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const userIds = [];
  for (const u of USERS) {
    insUser.run(u.username, u.name, u.email, hash, u.role, u.dept, 'active', dt(addDays(SEED_START, -30)));
    const row = db.prepare('SELECT id FROM users WHERE username=?').get(u.username);
    if (row) userIds.push(row.id);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM users').get().c} users`);

  // ─── 1b. SETTINGS ──────────────────────────────────
  console.log('  → Seeding settings...');
  const insSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)');
  const settingsData = {
    company_name: 'مصنع النيل للملابس',
    company_name_en: 'Nile Garments Factory',
    tax_rate: '14',
    currency: 'EGP',
    low_stock_threshold: '50',
    default_page_size: '25',
    aging_bucket_1: '30',
    aging_bucket_2: '60',
    aging_bucket_3: '90',
    dashboard_list_limit: '10',
    cost_history_limit: '20',
    quality_history_limit: '50',
    report_default_limit: '100',
  };
  for (const [k, v] of Object.entries(settingsData)) { insSetting.run(k, v); }
  console.log(`    ✓ ${Object.keys(settingsData).length} settings`);

  // ─── 2. STAGE TEMPLATES ──────────────────────────
  console.log('  → Seeding stage templates...');
  const insStage = db.prepare(`INSERT OR IGNORE INTO stage_templates (name, color, sort_order, is_default) VALUES (?,?,?,1)`);
  for (const s of STAGE_TEMPLATES) {
    insStage.run(s.name, s.color, s.sort);
  }
  const stages = db.prepare('SELECT * FROM stage_templates WHERE is_default=1 ORDER BY sort_order').all();
  console.log(`    ✓ ${stages.length} stage templates`);

  // ─── 3. SUPPLIERS ────────────────────────────────
  console.log('  → Seeding suppliers...');
  const insSupplier = db.prepare(`INSERT OR IGNORE INTO suppliers (code, name, supplier_type, phone, email, address, contact_name, payment_terms, rating, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const s of SUPPLIERS) {
    insSupplier.run(s.code, s.name_ar, s.type, s.phone, s.email, s.address, s.contact, s.terms, s.rating, 'active', dt(addDays(SEED_START, -60)));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c} suppliers`);

  // ─── 4. FABRICS + IMAGES ──────────────────────────
  console.log('  → Seeding fabrics + placeholder images...');
  const seedImgDir = pathMod.join(__dirname, 'seed-images');
  const fabricUploadDir = pathMod.join(__dirname, 'uploads', 'fabrics');
  ensureDir(seedImgDir);
  ensureDir(fabricUploadDir);

  const insFabric = db.prepare(`INSERT OR IGNORE INTO fabrics (code, name, fabric_type, price_per_m, supplier_id, supplier, color, image_path, available_meters, low_stock_threshold, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

  for (const f of FABRICS) {
    const suppRow = db.prepare('SELECT id, name FROM suppliers WHERE code=?').get(f.supplier);
    const suppId = suppRow ? suppRow.id : null;
    const suppName = suppRow ? suppRow.name : '';

    // Generate placeholder image
    const pngBuf = makePNG(f.rgb[0], f.rgb[1], f.rgb[2]);
    const imgName = `${f.code}.png`;
    fs.writeFileSync(pathMod.join(seedImgDir, imgName), pngBuf);
    fs.writeFileSync(pathMod.join(fabricUploadDir, imgName), pngBuf);
    const imgPath = `/uploads/fabrics/${imgName}`;

    insFabric.run(f.code, f.name_ar, f.type, f.price, suppId, suppName, f.color, imgPath, 0, 50, 'active', dt(addDays(SEED_START, -30)));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM fabrics').get().c} fabrics`);

  // ─── 5. ACCESSORIES + IMAGES ──────────────────────
  console.log('  → Seeding accessories + placeholder images...');
  const accUploadDir = pathMod.join(__dirname, 'uploads', 'accessories');
  ensureDir(accUploadDir);

  const insAcc = db.prepare(`INSERT OR IGNORE INTO accessories (code, name, acc_type, unit_price, unit, supplier_id, supplier, quantity_on_hand, low_stock_threshold, image_path, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

  for (const a of ACCESSORIES) {
    const suppRow = db.prepare('SELECT id, name FROM suppliers WHERE code=?').get(a.supplier);
    const suppId = suppRow ? suppRow.id : null;
    const suppName = suppRow ? suppRow.name : '';

    const pngBuf = makePNG(a.rgb[0], a.rgb[1], a.rgb[2]);
    const imgName = `${a.code}.png`;
    fs.writeFileSync(pathMod.join(seedImgDir, imgName), pngBuf);
    fs.writeFileSync(pathMod.join(accUploadDir, imgName), pngBuf);
    const imgPath = `/uploads/accessories/${imgName}`;

    insAcc.run(a.code, a.name_ar, a.type, a.price, a.unit, suppId, suppName, a.qty, 100, imgPath, 'active', dt(addDays(SEED_START, -30)));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM accessories').get().c} accessories`);

  // ─── 6. CUSTOMERS ────────────────────────────────
  console.log('  → Seeding customers...');
  const insCust = db.prepare(`INSERT OR IGNORE INTO customers (code, name, phone, email, address, city, customer_type, payment_terms, credit_limit, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const c of CUSTOMERS) {
    const created = dt(addDays(SEED_START, -45));
    insCust.run(c.code, c.name_ar, c.phone, c.email, c.address, c.city, c.type, c.terms, c.limit, 'active', created, created);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM customers').get().c} customers`);

  // ─── 7. MODELS + BOM ─────────────────────────────
  console.log('  → Seeding models + BOM templates...');
  const insModel = db.prepare(`INSERT OR IGNORE INTO models (model_code, model_name, category, gender, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`);
  const insBomTmpl = db.prepare(`INSERT OR IGNORE INTO bom_templates (model_id, template_name, is_default, masnaiya, masrouf, margin_pct, created_at) VALUES (?,?,1,90,50,25,?)`);
  const insBomFab = db.prepare(`INSERT OR IGNORE INTO bom_template_fabrics (template_id, fabric_code, role, meters_per_piece, waste_pct, sort_order) VALUES (?,?,?,?,5,?)`);
  const insBomAcc = db.prepare(`INSERT OR IGNORE INTO bom_template_accessories (template_id, accessory_code, accessory_name, quantity, unit_price) VALUES (?,?,?,?,?)`);

  const modelMap = {}; // code → { id, tmplId, unitPrice }

  for (const m of MODELS) {
    const created = dt(addDays(SEED_START, -30));
    insModel.run(m.code, m.name_ar, m.category, m.gender, 'active', created, created);
    const modelRow = db.prepare('SELECT id FROM models WHERE model_code=?').get(m.code);
    if (!modelRow) continue;

    insBomTmpl.run(modelRow.id, `الوصفة الأساسية — ${m.name_ar}`, created);
    const tmplRow = db.prepare('SELECT id FROM bom_templates WHERE model_id=? AND is_default=1').get(modelRow.id);
    if (!tmplRow) continue;

    modelMap[m.code] = { id: modelRow.id, tmplId: tmplRow.id, unitPrice: m.unitPrice };

    // BOM fabrics
    const bomFabs = MODEL_BOM_FABRICS[m.code] || [];
    bomFabs.forEach((bf, idx) => {
      insBomFab.run(tmplRow.id, bf.fabric, bf.role, bf.meters, idx + 1);
    });

    // BOM accessories
    const bomAccs = MODEL_BOM_ACCESSORIES[m.code] || [];
    for (const ba of bomAccs) {
      const accRow = db.prepare('SELECT name, unit_price FROM accessories WHERE code=?').get(ba.acc);
      if (accRow) {
        insBomAcc.run(tmplRow.id, ba.acc, accRow.name, ba.qty, accRow.unit_price);
      }
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM models').get().c} models with BOM`);

  // ─── 8. PURCHASE ORDERS ──────────────────────────
  console.log('  → Seeding purchase orders...');
  const insPO = db.prepare(`INSERT OR IGNORE INTO purchase_orders (po_number, supplier_id, po_type, status, order_date, expected_date, received_date, total_amount, paid_amount, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insPOItem = db.prepare(`INSERT OR IGNORE INTO purchase_order_items (po_id, item_type, fabric_code, accessory_code, description, quantity, unit, unit_price, received_qty, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insBatch = db.prepare(`INSERT OR IGNORE INTO fabric_inventory_batches (batch_code, fabric_code, po_id, po_item_id, supplier_id, ordered_meters, received_meters, used_meters, wasted_meters, price_per_meter, received_date, batch_status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  // Track fabric batches for WO consumption later
  const fabricBatches = []; // { id, fabricCode, receivedMeters, usedMeters, wastedMeters, pricePerMeter, poId }

  const PO_DEFS = [
    // Fabric POs
    { num: 'PO-2026-001', supplier: 'SUP-001', type: 'fabric', status: 'received', dayOff: 2,  items: [{ code: 'FAB-001', qty: 2000, price: 18.50 }, { code: 'FAB-002', qty: 1500, price: 32.00 }, { code: 'FAB-006', qty: 1000, price: 19.00 }] },
    { num: 'PO-2026-002', supplier: 'SUP-002', type: 'fabric', status: 'received', dayOff: 5,  items: [{ code: 'FAB-003', qty: 1200, price: 22.00 }, { code: 'FAB-005', qty: 800, price: 28.00 }, { code: 'FAB-009', qty: 1500, price: 14.00 }] },
    { num: 'PO-2026-003', supplier: 'SUP-006', type: 'fabric', status: 'received', dayOff: 8,  items: [{ code: 'FAB-004', qty: 900, price: 45.00 }, { code: 'FAB-007', qty: 700, price: 38.00 }] },
    { num: 'PO-2026-004', supplier: 'SUP-001', type: 'fabric', status: 'received', dayOff: 15, items: [{ code: 'FAB-008', qty: 600, price: 55.00 }, { code: 'FAB-001', qty: 1500, price: 18.50 }] },
    { num: 'PO-2026-005', supplier: 'SUP-007', type: 'fabric', status: 'partial',  dayOff: 25, items: [{ code: 'FAB-010', qty: 1000, price: 11.00 }, { code: 'FAB-011', qty: 1200, price: 9.50 }] },
    { num: 'PO-2026-006', supplier: 'SUP-008', type: 'fabric', status: 'received', dayOff: 12, items: [{ code: 'FAB-012', qty: 500, price: 7.00 }] },
    // Accessory POs
    { num: 'PO-2026-007', supplier: 'SUP-003', type: 'accessory', status: 'received', dayOff: 3,  items: [{ code: 'ACC-001', qty: 5000, price: 0.85 }, { code: 'ACC-002', qty: 8000, price: 0.45 }, { code: 'ACC-011', qty: 5000, price: 0.50 }, { code: 'ACC-012', qty: 8000, price: 0.25 }] },
    { num: 'PO-2026-008', supplier: 'SUP-005', type: 'accessory', status: 'received', dayOff: 6,  items: [{ code: 'ACC-003', qty: 2000, price: 3.20 }, { code: 'ACC-004', qty: 2500, price: 2.80 }, { code: 'ACC-014', qty: 3000, price: 0.60 }] },
    { num: 'PO-2026-009', supplier: 'SUP-004', type: 'accessory', status: 'received', dayOff: 10, items: [{ code: 'ACC-007', qty: 500, price: 12.00 }, { code: 'ACC-008', qty: 500, price: 12.00 }, { code: 'ACC-009', qty: 10000, price: 0.30 }, { code: 'ACC-010', qty: 10000, price: 0.20 }] },
    { num: 'PO-2026-010', supplier: 'SUP-008', type: 'accessory', status: 'received', dayOff: 14, items: [{ code: 'ACC-005', qty: 3000, price: 1.10 }, { code: 'ACC-006', qty: 2000, price: 1.60 }] },
    { num: 'PO-2026-011', supplier: 'SUP-003', type: 'accessory', status: 'partial',  dayOff: 35, items: [{ code: 'ACC-013', qty: 1000, price: 4.50 }, { code: 'ACC-011', qty: 3000, price: 0.50 }] },
    { num: 'PO-2026-012', supplier: 'SUP-006', type: 'accessory', status: 'sent',  dayOff: 55, items: [{ code: 'ACC-015', qty: 1500, price: 2.40 }] },
  ];

  for (const po of PO_DEFS) {
    const suppRow = db.prepare('SELECT id FROM suppliers WHERE code=?').get(po.supplier);
    if (!suppRow) continue;
    const orderDate = addDays(SEED_START, po.dayOff);
    const expectedDate = addDays(orderDate, 14);
    const receivedDate = (po.status === 'received' || po.status === 'partial') ? addDays(orderDate, randInt(7, 14)) : null;

    // Calculate total
    let totalAmount = 0;
    for (const item of po.items) totalAmount += item.qty * item.price;
    totalAmount = +totalAmount.toFixed(2);

    const paidAmount = po.status === 'received' ? totalAmount : (po.status === 'partial' ? +(totalAmount * 0.6).toFixed(2) : 0);

    insPO.run(po.num, suppRow.id, po.type, po.status, dd(orderDate), dd(expectedDate),
      receivedDate ? dd(receivedDate) : null, totalAmount, paidAmount, null, dt(orderDate));

    const poRow = db.prepare('SELECT id FROM purchase_orders WHERE po_number=?').get(po.num);
    if (!poRow) continue;

    for (const item of po.items) {
      const isFabric = item.code.startsWith('FAB');
      const receivedQty = po.status === 'received' ? item.qty : (po.status === 'partial' ? Math.floor(item.qty * 0.6) : 0);

      insPOItem.run(poRow.id, isFabric ? 'fabric' : 'accessory',
        isFabric ? item.code : null,
        !isFabric ? item.code : null,
        item.code, item.qty, isFabric ? 'meter' : 'piece', item.price, receivedQty, null);

      const poItemRow = db.prepare('SELECT id FROM purchase_order_items WHERE po_id=? AND (fabric_code=? OR accessory_code=?)').get(poRow.id, item.code, item.code);

      // Create fabric batch
      if (isFabric && receivedQty > 0) {
        const batchCode = `BATCH-${item.code}-${po.num.replace('PO-', '')}`;
        insBatch.run(batchCode, item.code, poRow.id, poItemRow ? poItemRow.id : null, suppRow.id,
          item.qty, receivedQty, 0, 0, item.price,
          receivedDate ? dd(receivedDate) : null, 'available', dt(orderDate));

        const batchRow = db.prepare('SELECT id FROM fabric_inventory_batches WHERE batch_code=?').get(batchCode);
        if (batchRow) {
          fabricBatches.push({
            id: batchRow.id, fabricCode: item.code, receivedMeters: receivedQty,
            usedMeters: 0, wastedMeters: 0, pricePerMeter: item.price, poId: poRow.id
          });
        }
      }

      // Update accessory stock from received POs
      if (!isFabric && receivedQty > 0) {
        db.prepare('UPDATE accessories SET quantity_on_hand = quantity_on_hand + ? WHERE code=?').run(receivedQty, item.code);
      }
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM purchase_orders').get().c} purchase orders, ${fabricBatches.length} fabric batches`);

  // ─── 9. EMPLOYEES ────────────────────────────────
  console.log('  → Seeding employees...');
  const insEmp = db.prepare(`INSERT OR IGNORE INTO employees (emp_code, full_name, national_id, department, job_title, employment_type, salary_type, base_salary, status, hire_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const employeeIds = [];
  for (const e of EMPLOYEES) {
    const hireDate = dd(addDays(SEED_START, -365));
    insEmp.run(e.code, e.name, e.natId, e.dept, e.title, e.type, e.salary_type, e.salary, 'active', hireDate, dt(addDays(SEED_START, -365)));
    const row = db.prepare('SELECT id FROM employees WHERE emp_code=?').get(e.code);
    if (row) employeeIds.push(row.id);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM employees').get().c} employees`);

  // ─── 10. MACHINES ─────────────────────────────────
  console.log('  → Seeding machines...');
  const insMachine = db.prepare(`INSERT OR IGNORE INTO machines (code, name, machine_type, brand, model_number, status, cost_per_hour, capacity_per_hour, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const machineIds = [];
  for (const m of MACHINES) {
    const created = dt(addDays(SEED_START, -180));
    insMachine.run(m.code, m.name, m.type, m.brand, m.model, m.status, m.cost_hr, m.capacity_hr, created, created);
    const row = db.prepare('SELECT id FROM machines WHERE code=?').get(m.code);
    if (row) machineIds.push(row.id);
  }

  // Maintenance records for MACH-004
  const mach4 = db.prepare("SELECT id FROM machines WHERE code='MACH-004'").get();
  if (mach4) {
    const insMaint = db.prepare(`INSERT OR IGNORE INTO machine_maintenance (machine_id, maintenance_type, title, description, cost, performed_by, performed_at, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
    insMaint.run(mach4.id, 'corrective', 'إصلاح موتور القص', 'تعطل موتور طاولة القص الكهربائية — تم الاستبدال', 3500, 'فني صيانة خارجي', dt(addDays(SEED_START, 40)), 'completed', dt(addDays(SEED_START, 40)));
    insMaint.run(mach4.id, 'preventive', 'صيانة دورية', 'صيانة دورية شاملة — تغيير سكاكين القص', 1200, 'فني صيانة خارجي', dt(addDays(SEED_START, 55)), 'completed', dt(addDays(SEED_START, 55)));
    insMaint.run(mach4.id, 'corrective', 'مشكلة كهربائية', 'قصر في الدائرة الكهربائية — تحت الإصلاح', 0, 'فني صيانة خارجي', dt(addDays(SEED_START, 75)), 'in_progress', dt(addDays(SEED_START, 75)));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM machines').get().c} machines`);

  // ─── 11. WORK ORDERS ──────────────────────────────
  console.log('  → Seeding work orders...');
  const insWO = db.prepare(`INSERT OR IGNORE INTO work_orders (wo_number, model_id, template_id, status, priority, quantity, start_date, due_date, completed_date, masnaiya, masrouf, margin_pct, consumer_price, wholesale_price, customer_id, notes, is_subcontracted, subcontractor_name, subcontract_cost, subcontract_notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insWOStage = db.prepare(`INSERT OR IGNORE INTO wo_stages (wo_id, stage_name, sort_order, status, quantity_in_stage, quantity_completed, quantity_rejected, started_at, completed_at, machine_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insWOFabBatch = db.prepare(`INSERT OR IGNORE INTO wo_fabric_batches (wo_id, batch_id, fabric_code, role, planned_meters_per_piece, planned_total_meters, waste_pct, actual_total_meters, actual_meters_per_piece, waste_meters, waste_cost, price_per_meter, planned_cost, actual_cost, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insWOAccDetail = db.prepare(`INSERT OR IGNORE INTO wo_accessories_detail (wo_id, accessory_code, accessory_name, quantity_per_piece, unit_price, planned_total_cost, actual_quantity, actual_cost, notes) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insWOFab = db.prepare(`INSERT OR IGNORE INTO wo_fabrics (wo_id, fabric_code, role, meters_per_piece, waste_pct, color_note, planned_meters, actual_meters, sort_order) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insWOAccSummary = db.prepare(`INSERT OR IGNORE INTO wo_accessories (wo_id, accessory_code, accessory_name, quantity, unit_price, notes) VALUES (?,?,?,?,?,?)`);

  const woMap = {}; // wo_number → { id, customerId, modelCode, status, qty, stages }

  for (const wo of WORK_ORDERS) {
    const mm = modelMap[wo.model];
    if (!mm) { console.log(`    ⚠ Model ${wo.model} not found, skipping ${wo.num}`); continue; }

    const custRow = db.prepare('SELECT id FROM customers WHERE code=?').get(wo.cust);
    if (!custRow) continue;

    const startDate = addDays(SEED_START, wo.startOff);
    const dueDate = addDays(SEED_START, wo.dueOff);
    let completedDate = null;
    if (wo.status === 'completed') {
      completedDate = addDays(startDate, randInt(14, 25));
      if (completedDate > SEED_END) completedDate = addDays(SEED_END, -2);
    }

    const masnaiya = 90, masrouf = 50, marginPct = 25;
    const cp = mm.unitPrice;
    const wp = +(cp * 0.78).toFixed(2);
    const notes = wo.pauseNote || null;
    const created = dt(startDate);

    const sub = wo.subcontract || null;
    insWO.run(wo.num, mm.id, mm.tmplId, wo.status, wo.priority, wo.qty,
      dd(startDate), dd(dueDate), completedDate ? dd(completedDate) : null,
      masnaiya, masrouf, marginPct, cp, wp, custRow.id, notes,
      sub ? 1 : 0, sub ? sub.name : null, sub ? sub.cost : 0, sub ? sub.notes : null,
      created, created);

    const woRow = db.prepare('SELECT id FROM work_orders WHERE wo_number=?').get(wo.num);
    if (!woRow) continue;

    woMap[wo.num] = { id: woRow.id, customerId: custRow.id, modelCode: wo.model, status: wo.status, qty: wo.qty, stageQtys: wo.stages, startDate, completedDate };

    // Create stages
    const stageNames = ['قص', 'خياطة', 'كي', 'مراجعة جودة', 'تغليف', 'تسليم'];
    const [cut, sewn, ironed, qcPassed, packed, shipped] = wo.stages;

    for (let si = 0; si < stageNames.length; si++) {
      const stageQty = wo.stages[si];
      let stStatus = 'pending', qtyInStage = 0, qtyCompleted = 0, qtyRejected = 0;
      let startedAt = null, completedAt = null;

      if (stageQty > 0) {
        const nextQty = si < 5 ? wo.stages[si + 1] : 0;
        if (stageQty === wo.qty && (si === stageNames.length - 1 || nextQty === stageQty || wo.status === 'completed')) {
          stStatus = 'completed';
          qtyCompleted = stageQty;
        } else if (nextQty > 0 && nextQty < stageQty) {
          stStatus = 'completed';
          qtyCompleted = stageQty;
          qtyRejected = si <= 1 ? randInt(0, Math.ceil(wo.qty * 0.02)) : 0;
        } else if (nextQty === 0 && stageQty > 0 && stageQty < wo.qty) {
          // Partially in progress
          stStatus = 'in_progress';
          qtyCompleted = stageQty;
          qtyInStage = wo.qty - stageQty;
        } else if (nextQty === 0 && stageQty === wo.qty) {
          // Fully completed at this stage, next not started
          stStatus = 'completed';
          qtyCompleted = stageQty;
        } else {
          stStatus = 'completed';
          qtyCompleted = stageQty;
        }

        startedAt = dt(addDays(startDate, si * 2 + 1));
        if (stStatus === 'completed') {
          completedAt = dt(addDays(startDate, si * 2 + 3));
        }
      }

      // For completed WOs, all stages are completed
      if (wo.status === 'completed' && stageQty > 0) {
        stStatus = 'completed';
        qtyCompleted = stageQty;
        startedAt = dt(addDays(startDate, si * 2 + 1));
        completedAt = dt(addDays(startDate, si * 2 + 3));
      }

      const machId = machineIds.length > 0 ? machineIds[si % machineIds.length] : null;
      insWOStage.run(woRow.id, stageNames[si], si + 1, stStatus, qtyInStage, qtyCompleted, qtyRejected, startedAt, completedAt, machId, null);
    }

    // Link fabric batches to WO — consume fabric at cutting
    const bomFabs = MODEL_BOM_FABRICS[wo.model] || [];
    if (cut > 0) {
      for (const bf of bomFabs) {
        const matchBatch = fabricBatches.find(b => b.fabricCode === bf.fabric && (b.receivedMeters - b.usedMeters - b.wastedMeters) > 5);
        if (!matchBatch) continue;

        const plannedTotal = +(bf.meters * wo.qty).toFixed(2);
        const actualTotal = +(bf.meters * cut * 1.02).toFixed(2); // 2% waste factor
        const wastePct = 5;
        const wasteMeters = +(actualTotal * wastePct / 100).toFixed(2);
        const price = matchBatch.pricePerMeter;
        const plannedCost = +(plannedTotal * price).toFixed(2);
        const actualCost = +(actualTotal * price).toFixed(2);
        const wasteCost = +(wasteMeters * price).toFixed(2);

        // Cap to available
        const avail = matchBatch.receivedMeters - matchBatch.usedMeters - matchBatch.wastedMeters;
        const useMeters = Math.min(actualTotal, avail * 0.9);

        matchBatch.usedMeters += useMeters;
        matchBatch.wastedMeters += Math.min(wasteMeters, (avail - useMeters) * 0.5);

        insWOFabBatch.run(woRow.id, matchBatch.id, bf.fabric, bf.role, bf.meters, plannedTotal, wastePct,
          useMeters, +(useMeters / cut).toFixed(3), wasteMeters, wasteCost, price, plannedCost, +(useMeters * price).toFixed(2),
          bomFabs.indexOf(bf) + 1, created);
      }
    }

    // Populate wo_fabrics summary table (for by-fabric report)
    if (cut > 0) {
      for (let fi = 0; fi < bomFabs.length; fi++) {
        const bf = bomFabs[fi];
        const plannedM = +(bf.meters * wo.qty).toFixed(2);
        const actualM = +(bf.meters * cut).toFixed(2);
        insWOFab.run(woRow.id, bf.fabric, bf.role, bf.meters, 5, null, plannedM, actualM, fi + 1);
      }
    }

    // Link accessories to WO — consumed at packing
    const bomAccs = MODEL_BOM_ACCESSORIES[wo.model] || [];
    const accConsumeQty = packed > 0 ? packed : (cut > 0 ? cut : 0);
    if (accConsumeQty > 0) {
      for (const ba of bomAccs) {
        const accRow = db.prepare('SELECT name, unit_price FROM accessories WHERE code=?').get(ba.acc);
        if (!accRow) continue;
        const plannedQty = +(ba.qty * wo.qty).toFixed(1);
        const actualQty = +(ba.qty * accConsumeQty).toFixed(1);
        const price = accRow.unit_price;
        const plannedCost = +(plannedQty * price).toFixed(2);
        const actualCost = +(actualQty * price).toFixed(2);

        insWOAccDetail.run(woRow.id, ba.acc, accRow.name, ba.qty, price, plannedCost, actualQty, actualCost, null);

        // Deduct from stock
        if (actualQty > 0) {
          db.prepare('UPDATE accessories SET quantity_on_hand = MAX(0, quantity_on_hand - ?) WHERE code=?').run(actualQty, ba.acc);
        }
      }
    }

    // Populate wo_accessories summary table (for by-accessory report)
    if (accConsumeQty > 0) {
      for (const ba of bomAccs) {
        const accRow2 = db.prepare('SELECT name, unit_price FROM accessories WHERE code=?').get(ba.acc);
        if (accRow2) {
          const totalQtyAcc = +(ba.qty * accConsumeQty).toFixed(1);
          insWOAccSummary.run(woRow.id, ba.acc, accRow2.name, totalQtyAcc, accRow2.unit_price, null);
        }
      }
    }

    // Update WO pieces_completed for completed/in_progress
    if (wo.status === 'completed' || shipped > 0) {
      const piecesCompleted = shipped > 0 ? shipped : wo.qty;
      db.prepare('UPDATE work_orders SET pieces_completed=?, total_invoiced_qty=? WHERE id=?').run(piecesCompleted, shipped, woRow.id);
    }
  }

  // Update fabric batch used_meters and available_meters in DB
  for (const b of fabricBatches) {
    db.prepare('UPDATE fabric_inventory_batches SET used_meters=?, wasted_meters=? WHERE id=?').run(
      +b.usedMeters.toFixed(2), +b.wastedMeters.toFixed(2), b.id);
    if (b.receivedMeters - b.usedMeters - b.wastedMeters <= 0) {
      db.prepare("UPDATE fabric_inventory_batches SET batch_status='depleted' WHERE id=?").run(b.id);
    }
  }

  // Recalculate fabric available_meters
  db.prepare(`UPDATE fabrics SET available_meters = COALESCE((
    SELECT SUM(CASE WHEN received_meters - used_meters - wasted_meters > 0 THEN received_meters - used_meters - wasted_meters ELSE 0 END)
    FROM fabric_inventory_batches WHERE fabric_code = fabrics.code AND batch_status IN ('available','reserved')
  ), 0)`).run();

  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM work_orders').get().c} work orders`);

  // ─── 11b. COST SNAPSHOTS ───────────────────────────
  console.log('  → Seeding cost snapshots...');
  const insCostSnap = db.prepare(`INSERT OR IGNORE INTO cost_snapshots (wo_id, model_id, total_pieces, total_meters_main, total_meters_lining, main_fabric_cost, lining_cost, accessories_cost, masnaiya, masrouf, waste_cost, extra_expenses, total_cost, cost_per_piece, snapshot_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  for (const woNum of Object.keys(woMap)) {
    const wo = woMap[woNum];
    const woDef = WORK_ORDERS.find(w => w.num === woNum);
    if (!woDef || woDef.stages[0] === 0) continue; // skip if no cutting done

    const model = MODELS.find(m => m.code === wo.modelCode);
    if (!model) continue;

    // Get fabric costs from wo_fabric_batches
    const fabricCosts = db.prepare(`SELECT role, COALESCE(SUM(actual_cost),0) as cost, COALESCE(SUM(actual_total_meters),0) as meters FROM wo_fabric_batches WHERE wo_id=? GROUP BY role`).all(wo.id);
    let mainFabCost = 0, liningCost = 0, mainMeters = 0, liningMeters = 0, totalWaste = 0;
    for (const fc of fabricCosts) {
      if (fc.role === 'main') { mainFabCost = fc.cost; mainMeters = fc.meters; }
      else { liningCost += fc.cost; liningMeters += fc.meters; }
    }
    totalWaste = db.prepare('SELECT COALESCE(SUM(waste_cost),0) as w FROM wo_fabric_batches WHERE wo_id=?').get(wo.id).w;

    // Get accessory costs from wo_accessories_detail
    const accCost = db.prepare('SELECT COALESCE(SUM(actual_cost),0) as c FROM wo_accessories_detail WHERE wo_id=?').get(wo.id).c;

    const masnaiya = +(((mainFabCost + liningCost + accCost) * 0.05)).toFixed(2);
    const masrouf = +(15 * woDef.stages[0]).toFixed(2);
    const totalCost = +(mainFabCost + liningCost + accCost + masnaiya + masrouf + totalWaste).toFixed(2);
    const costPerPiece = woDef.stages[0] > 0 ? +(totalCost / woDef.stages[0]).toFixed(2) : 0;
    const snapDate = dd(addDays(wo.startDate, 2));

    insCostSnap.run(wo.id, modelMap[wo.modelCode]?.id || null, woDef.stages[0], +mainMeters.toFixed(2), +liningMeters.toFixed(2),
      +mainFabCost.toFixed(2), +liningCost.toFixed(2), +accCost.toFixed(2), masnaiya, masrouf, +totalWaste.toFixed(2), 0,
      totalCost, costPerPiece, snapDate);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM cost_snapshots').get().c} cost snapshots`);

  // ─── 12. INVOICES ─────────────────────────────────
  console.log('  → Seeding invoices...');
  const insInv = db.prepare(`INSERT OR IGNORE INTO invoices (invoice_number, customer_id, customer_name, wo_id, status, subtotal, tax_pct, discount, total, due_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insInvItem = db.prepare(`INSERT OR IGNORE INTO invoice_items (invoice_id, description, model_code, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,?)`);
  const insPayment = db.prepare(`INSERT OR IGNORE INTO customer_payments (customer_id, invoice_id, amount, payment_date, payment_method, reference, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`);

  for (const inv of INVOICES) {
    const wo = woMap[inv.wo];
    if (!wo) continue;

    const mm = MODELS.find(m => m.code === wo.modelCode);
    if (!mm) continue;

    const custRow = db.prepare('SELECT id, name FROM customers WHERE id=?').get(wo.customerId);
    if (!custRow) continue;

    const shippedQty = inv.shipped || 0;
    const qtyForInvoice = shippedQty > 0 ? shippedQty : wo.qty;
    const subtotal = +(qtyForInvoice * mm.unitPrice).toFixed(2);
    const taxPct = 14; // Egypt VAT
    const discount = 0;
    const total = +(subtotal * (1 + taxPct / 100) - discount).toFixed(2);

    const invoiceDate = wo.completedDate ? addDays(wo.completedDate, randInt(1, 5)) : addDays(wo.startDate, randInt(20, 40));
    const dueDate = addDays(invoiceDate, 30);
    const created = dt(invoiceDate);

    insInv.run(inv.num, custRow.id, custRow.name, wo.id, inv.status, subtotal, taxPct, discount, total,
      dd(dueDate), null, created, created);

    const invRow = db.prepare('SELECT id FROM invoices WHERE invoice_number=?').get(inv.num);
    if (!invRow) continue;

    insInvItem.run(invRow.id, `${mm.name_ar} — ${inv.wo}`, mm.code, qtyForInvoice, mm.unitPrice, subtotal, 1);

    // Create payments for paid/partially_paid invoices
    if (inv.status === 'paid') {
      const payDate = addDays(invoiceDate, randInt(5, 20));
      insPayment.run(custRow.id, invRow.id, total, dd(payDate), pick(['bank', 'cash']), `RCV-${inv.num}`, userIds[0], dt(payDate));
    } else if (inv.status === 'partially_paid') {
      const partialAmount = +(total * 0.6).toFixed(2);
      const payDate = addDays(invoiceDate, randInt(5, 15));
      insPayment.run(custRow.id, invRow.id, partialAmount, dd(payDate), 'bank', `RCV-${inv.num}-P1`, userIds[0], dt(payDate));
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM invoices').get().c} invoices`);

  // ─── 12b. SHIPMENTS ────────────────────────────────
  console.log('  → Seeding shipments...');
  try {
    const insShip = db.prepare(`INSERT OR IGNORE INTO shipments (shipment_number, shipment_type, status, customer_id, work_order_id, invoice_id, carrier_name, packages_count, ship_date, actual_delivery, shipping_address, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insShipItem = db.prepare(`INSERT OR IGNORE INTO shipment_items (shipment_id, description, model_code, quantity, unit, notes) VALUES (?,?,?,?,?,?)`);
    let shipNum = 1;
    for (const inv of INVOICES) {
      if (inv.shipped <= 0) continue;
      const wo = woMap[inv.wo];
      if (!wo) continue;
      const mm = MODELS.find(m => m.code === wo.modelCode);
      if (!mm) continue;

      const invRow = db.prepare('SELECT id FROM invoices WHERE invoice_number=?').get(inv.num);
      const shipDate = wo.completedDate ? addDays(wo.completedDate, randInt(1, 3)) : addDays(wo.startDate, 20);
      const deliveryDate = addDays(shipDate, randInt(1, 3));

      const shipCode = `SHP-2026-${pad(shipNum++)}`;
      const custAddr = db.prepare('SELECT address FROM customers WHERE id=?').get(wo.customerId);

      insShip.run(shipCode, 'outbound', 'delivered', wo.customerId, wo.id, invRow ? invRow.id : null,
        'شركة النقل السريع', Math.ceil(inv.shipped / 50), dd(shipDate), dd(deliveryDate),
        custAddr ? custAddr.address : '', `شحنة ${inv.num}`, userIds[0], dt(shipDate));

      const shipRow = db.prepare('SELECT id FROM shipments WHERE shipment_number=?').get(shipCode);
      if (shipRow) {
        insShipItem.run(shipRow.id, `${mm.name_ar} — ${inv.wo}`, mm.code, inv.shipped, 'piece', null);
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM shipments').get().c} shipments`);
  } catch (e) { console.log('    ⚠ Skipping shipments:', e.message); }

  // ─── 13. JOURNAL ENTRIES ────────────────────────
  console.log('  → Seeding journal entries...');
  // Ensure chart of accounts exists
  const insCoA = db.prepare(`INSERT OR IGNORE INTO chart_of_accounts (code, name_ar, type, is_active, created_at) VALUES (?,?,?,1,datetime('now'))`);
  const accounts = [
    { code: '1100', name: 'النقدية والبنوك', type: 'asset' },
    { code: '1110', name: 'الصندوق', type: 'asset' },
    { code: '1120', name: 'البنك', type: 'asset' },
    { code: '1200', name: 'المخزون — أقمشة', type: 'asset' },
    { code: '1210', name: 'المخزون — إكسسوارات', type: 'asset' },
    { code: '1300', name: 'الحسابات المدينة (العملاء)', type: 'asset' },
    { code: '1400', name: 'مصروفات مدفوعة مقدماً', type: 'asset' },
    { code: '1500', name: 'الأصول الثابتة — معدات', type: 'asset' },
    { code: '1510', name: 'الأصول الثابتة — مركبات', type: 'asset' },
    { code: '2100', name: 'الحسابات الدائنة (الموردين)', type: 'liability' },
    { code: '2200', name: 'إيرادات مؤجلة', type: 'liability' },
    { code: '2300', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability' },
    { code: '3100', name: 'رأس المال', type: 'equity' },
    { code: '3200', name: 'الأرباح المحتجزة', type: 'equity' },
    { code: '4100', name: 'إيرادات المبيعات', type: 'revenue' },
    { code: '4200', name: 'إيرادات خدمات', type: 'revenue' },
    { code: '5100', name: 'تكلفة البضاعة المباعة', type: 'expense' },
    { code: '5200', name: 'مصروفات عمومية وإدارية', type: 'expense' },
    { code: '5300', name: 'مصروفات الرواتب والأجور', type: 'expense' },
    { code: '5400', name: 'مصروفات الإيجار', type: 'expense' },
    { code: '5500', name: 'مصروفات الصيانة', type: 'expense' },
  ];
  for (const a of accounts) { insCoA.run(a.code, a.name, a.type); }

  const insJE = db.prepare(`INSERT OR IGNORE INTO journal_entries (entry_number, entry_date, description, reference, status, created_by, created_at) VALUES (?,?,?,?,?,?,?)`);

  // Check if journal_entry_lines table exists
  let hasJELines = false;
  try {
    db.prepare("SELECT 1 FROM journal_entry_lines LIMIT 0").get();
    hasJELines = true;
  } catch (e) { /* table doesn't exist */ }

  // Helper: get account_id from code
  function acctId(code) {
    const row = db.prepare('SELECT id FROM chart_of_accounts WHERE code=?').get(code);
    return row ? row.id : null;
  }

  let jeNum = 1;
  // JE for received POs (Debit: Inventory, Credit: Accounts Payable)
  for (const po of PO_DEFS) {
    if (po.status === 'ordered') continue;
    let totalAmt = 0;
    for (const item of po.items) {
      const rcvd = po.status === 'received' ? item.qty : Math.floor(item.qty * 0.6);
      totalAmt += rcvd * item.price;
    }
    totalAmt = +totalAmt.toFixed(2);
    const entryNum = `JE-2026-${pad(jeNum++)}`;
    const poDate = addDays(SEED_START, po.dayOff + randInt(7, 14));
    insJE.run(entryNum, dd(poDate), `استلام بضاعة — ${po.num}`, po.num, 'posted', userIds[0], dt(poDate));

    if (hasJELines) {
      const jeRow = db.prepare('SELECT id FROM journal_entries WHERE entry_number=?').get(entryNum);
      if (jeRow) {
        const insJELine = db.prepare(`INSERT OR IGNORE INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)`);
        const invAcct = acctId(po.type === 'fabric' ? '1200' : '1210');
        const apAcct = acctId('2100');
        if (invAcct) insJELine.run(jeRow.id, invAcct, totalAmt, 0, `مخزون — ${po.num}`);
        if (apAcct) insJELine.run(jeRow.id, apAcct, 0, totalAmt, `دائنون — ${po.num}`);
      }
    }
  }

  // JE for invoices issued (Debit: AR, Credit: Revenue)
  for (const inv of INVOICES) {
    if (inv.status === 'draft') continue;
    const wo = woMap[inv.wo];
    if (!wo) continue;
    const mm = MODELS.find(m => m.code === wo.modelCode);
    if (!mm) continue;
    const qtyForInvoice = inv.shipped > 0 ? inv.shipped : wo.qty;
    const subtotal = +(qtyForInvoice * mm.unitPrice).toFixed(2);
    const total = +(subtotal * 1.14).toFixed(2);

    const entryNum = `JE-2026-${pad(jeNum++)}`;
    const invDate = wo.completedDate ? addDays(wo.completedDate, randInt(1, 5)) : addDays(wo.startDate, 30);
    insJE.run(entryNum, dd(invDate), `فاتورة — ${inv.num}`, inv.num, 'posted', userIds[0], dt(invDate));

    if (hasJELines) {
      const jeRow = db.prepare('SELECT id FROM journal_entries WHERE entry_number=?').get(entryNum);
      if (jeRow) {
        const insJELine = db.prepare(`INSERT OR IGNORE INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)`);
        const arAcct = acctId('1300');
        const revAcct = acctId('4100');
        if (arAcct) insJELine.run(jeRow.id, arAcct, total, 0, `عملاء — ${inv.num}`);
        if (revAcct) insJELine.run(jeRow.id, revAcct, 0, total, `إيرادات — ${inv.num}`);
      }
    }
  }

  // JE for payments received
  for (const inv of INVOICES) {
    if (inv.status !== 'paid' && inv.status !== 'partially_paid') continue;
    const wo = woMap[inv.wo];
    if (!wo) continue;
    const mm = MODELS.find(m => m.code === wo.modelCode);
    if (!mm) continue;
    const qtyForInvoice = inv.shipped > 0 ? inv.shipped : wo.qty;
    const subtotal = +(qtyForInvoice * mm.unitPrice).toFixed(2);
    const total = +(subtotal * 1.14).toFixed(2);
    const payAmount = inv.status === 'paid' ? total : +(total * 0.6).toFixed(2);

    const entryNum = `JE-2026-${pad(jeNum++)}`;
    const payDate = wo.completedDate ? addDays(wo.completedDate, randInt(10, 25)) : addDays(wo.startDate, 40);
    insJE.run(entryNum, dd(payDate), `تحصيل — ${inv.num}`, inv.num, 'posted', userIds[0], dt(payDate));

    if (hasJELines) {
      const jeRow = db.prepare('SELECT id FROM journal_entries WHERE entry_number=?').get(entryNum);
      if (jeRow) {
        const insJELine = db.prepare(`INSERT OR IGNORE INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)`);
        const cashAcct = acctId('1110');
        const arAcct = acctId('1300');
        if (cashAcct) insJELine.run(jeRow.id, cashAcct, payAmount, 0, `نقدية — ${inv.num}`);
        if (arAcct) insJELine.run(jeRow.id, arAcct, 0, payAmount, `عملاء — ${inv.num}`);
      }
    }
  }

  // JE for operating expenses (monthly rent, salaries, maintenance)
  const expenseEntries = [
    { desc: 'إيجار المصنع — يناير', acct: '5400', amount: 15000, day: 5 },
    { desc: 'إيجار المصنع — فبراير', acct: '5400', amount: 15000, day: 35 },
    { desc: 'إيجار المصنع — مارس', acct: '5400', amount: 15000, day: 63 },
    { desc: 'رواتب يناير', acct: '5300', amount: 45000, day: 28 },
    { desc: 'رواتب فبراير', acct: '5300', amount: 45000, day: 56 },
    { desc: 'رواتب مارس', acct: '5300', amount: 47000, day: 84 },
    { desc: 'صيانة معدات', acct: '5500', amount: 3500, day: 22 },
    { desc: 'مصروفات إدارية — يناير', acct: '5200', amount: 8000, day: 10 },
    { desc: 'مصروفات إدارية — فبراير', acct: '5200', amount: 7500, day: 40 },
    { desc: 'مصروفات إدارية — مارس', acct: '5200', amount: 9000, day: 70 },
  ];
  if (hasJELines) {
    for (const exp of expenseEntries) {
      const entryNum = `JE-2026-${pad(jeNum++)}`;
      const expDate = addDays(SEED_START, exp.day);
      insJE.run(entryNum, dd(expDate), exp.desc, '', 'posted', userIds[0], dt(expDate));
      const jeRow = db.prepare('SELECT id FROM journal_entries WHERE entry_number=?').get(entryNum);
      if (jeRow) {
        const insJELine = db.prepare(`INSERT OR IGNORE INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)`);
        const expAcct = acctId(exp.acct);
        const cashAcct = acctId('1110');
        if (expAcct) insJELine.run(jeRow.id, expAcct, exp.amount, 0, exp.desc);
        if (cashAcct) insJELine.run(jeRow.id, cashAcct, 0, exp.amount, `دفع — ${exp.desc}`);
      }
    }
  }

  // JE for initial capital injection
  if (hasJELines) {
    const capEntry = `JE-2026-${pad(jeNum++)}`;
    const capDate = addDays(SEED_START, 0);
    insJE.run(capEntry, dd(capDate), 'رأس المال المؤسس', '', 'posted', userIds[0], dt(capDate));
    const jeRow = db.prepare('SELECT id FROM journal_entries WHERE entry_number=?').get(capEntry);
    if (jeRow) {
      const insJELine = db.prepare(`INSERT OR IGNORE INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)`);
      const cashAcct = acctId('1110');
      const capAcct = acctId('3100');
      if (cashAcct) insJELine.run(jeRow.id, cashAcct, 500000, 0, 'إيداع رأس المال');
      if (capAcct) insJELine.run(jeRow.id, capAcct, 0, 500000, 'رأس المال المؤسس');
    }
  }

  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM journal_entries').get().c} journal entries`);

  // ─── 14. QUALITY CHECKS ───────────────────────────
  console.log('  → Seeding quality checks...');
  try {
    const insQC = db.prepare(`INSERT OR IGNORE INTO wo_stage_qc (wo_id, stage_id, checked_by, checked_at, items_checked, items_passed, items_failed, defect_notes, qc_status) VALUES (?,?,?,?,?,?,?,?,?)`);
    for (const woNum of Object.keys(woMap)) {
      const wo = woMap[woNum];
      if (wo.stageQtys[3] === 0) continue; // No QC stage data

      const qcStageRow = db.prepare("SELECT id FROM wo_stages WHERE wo_id=? AND stage_name='مراجعة جودة'").get(wo.id);
      if (!qcStageRow) continue;

      const checked = wo.stageQtys[3];
      // Add some rejects for 2-3 WOs
      let failed = 0;
      if (woNum === 'WO-2026-002' || woNum === 'WO-2026-011') {
        failed = randInt(3, 8);
      }
      const passed = checked - failed;
      const defectNotes = failed > 0 ? 'عيوب خياطة بسيطة — تم إعادة التشغيل' : null;
      const qcStatus = failed > 0 ? 'partial' : 'passed';

      const qcDate = wo.completedDate || addDays(wo.startDate, 15);
      const checkerId = employeeIds.length > 3 ? employeeIds[3] : (userIds[0] || 1); // QC inspector

      insQC.run(wo.id, qcStageRow.id, checkerId, dt(qcDate), checked, passed, failed, defectNotes, qcStatus);
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM wo_stage_qc').get().c} quality checks`);
  } catch (e) { console.log('    ⚠ Skipping QC (table may not exist):', e.message); }

  // ─── 15. ATTENDANCE ────────────────────────────────
  console.log('  → Seeding attendance...');
  try {
    const insAtt = db.prepare(`INSERT OR IGNORE INTO attendance (employee_id, work_date, day_of_week, scheduled_hours, actual_hours, attendance_status, late_minutes, created_at) VALUES (?,?,?,?,?,?,?,?)`);
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    let d = new Date(SEED_START);
    while (d <= SEED_END) {
      if (isWeekday(d)) {
        for (const empId of employeeIds) {
          const status = Math.random() < 0.92 ? 'present' : (Math.random() < 0.5 ? 'absent' : 'late');
          const scheduled = 8;
          const actual = status === 'absent' ? 0 : (status === 'late' ? randFloat(5, 7.5) : randFloat(7.5, 9));
          const lateMins = status === 'late' ? randInt(10, 60) : 0;
          insAtt.run(empId, dd(d), dayNames[d.getDay()], scheduled, actual, status, lateMins, dt(d));
        }
      }
      d = addDays(d, 1);
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM attendance').get().c} attendance records`);
  } catch (e) { console.log('    ⚠ Skipping attendance:', e.message); }

  // ─── 15b. PAYROLL PERIODS & RECORDS ─────────────────
  console.log('  → Seeding payroll...');
  try {
    const insPayrollPeriod = db.prepare(`INSERT OR IGNORE INTO payroll_periods (period_month, period_name, status, total_gross, total_net, total_deductions, notes, calculated_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
    const insPayrollRec = db.prepare(`INSERT OR IGNORE INTO payroll_records (period_id, employee_id, days_worked, hours_worked, overtime_hours, absent_days, base_pay, overtime_pay, housing_allowance, transport_allowance, food_allowance, other_allowances, bonuses, gross_pay, absence_deduction, late_deduction, social_insurance, tax_deduction, loans_deduction, other_deductions, total_deductions, net_pay, payment_status, payment_date, payment_method) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    const payrollMonths = [
      { month: '2026-01', name: 'يناير 2026', endDate: '2026-01-31' },
      { month: '2026-02', name: 'فبراير 2026', endDate: '2026-02-28' },
      { month: '2026-03', name: 'مارس 2026', endDate: '2026-03-31' },
    ];

    for (const pm of payrollMonths) {
      let periodGross = 0, periodNet = 0, periodDeductions = 0;

      insPayrollPeriod.run(pm.month, pm.name, 'paid', 0, 0, 0, null, `${pm.endDate} 18:00:00`, `${pm.endDate} 18:00:00`);
      const periodRow = db.prepare('SELECT id FROM payroll_periods WHERE period_month=?').get(pm.month);
      if (!periodRow) continue;

      for (let ei = 0; ei < EMPLOYEES.length; ei++) {
        const emp = EMPLOYEES[ei];
        const empRow = db.prepare('SELECT id FROM employees WHERE emp_code=?').get(emp.code);
        if (!empRow) continue;

        // Calculate from attendance
        const attStats = db.prepare(`SELECT 
          COUNT(CASE WHEN attendance_status='present' OR attendance_status='late' THEN 1 END) as days_present,
          COUNT(CASE WHEN attendance_status='absent' THEN 1 END) as absent_days,
          COALESCE(SUM(actual_hours),0) as total_hours,
          COALESCE(SUM(CASE WHEN actual_hours > 8 THEN actual_hours - 8 ELSE 0 END),0) as overtime_hours
          FROM attendance WHERE employee_id=? AND work_date >= ? AND work_date <= ?`).get(empRow.id, `${pm.month}-01`, pm.endDate);

        const daysWorked = attStats ? attStats.days_present : 22;
        const absentDays = attStats ? attStats.absent_days : 1;
        const hoursWorked = attStats ? +attStats.total_hours.toFixed(1) : 176;
        const overtimeHours = attStats ? +attStats.overtime_hours.toFixed(1) : 4;

        const basePay = emp.salary;
        const dailyRate = emp.salary_type === 'daily' ? emp.salary : +(emp.salary / 26).toFixed(2);
        const overtimePay = +(overtimeHours * dailyRate / 8 * 1.5).toFixed(2);
        const housing = +(basePay * 0.1).toFixed(2);
        const transport = 300;
        const food = 200;
        const bonus = Math.random() < 0.3 ? randInt(200, 500) : 0;
        const grossPay = +(basePay + overtimePay + housing + transport + food + bonus).toFixed(2);

        const absenceDeduction = +(absentDays * dailyRate).toFixed(2);
        const socialInsurance = +(basePay * 0.11).toFixed(2);
        const taxDeduction = basePay >= 5000 ? +(basePay * 0.05).toFixed(2) : 0;
        const totalDeductions = +(absenceDeduction + socialInsurance + taxDeduction).toFixed(2);
        const netPay = +(grossPay - totalDeductions).toFixed(2);

        insPayrollRec.run(periodRow.id, empRow.id, daysWorked, hoursWorked, overtimeHours, absentDays,
          basePay, overtimePay, housing, transport, food, 0, bonus, grossPay,
          absenceDeduction, 0, socialInsurance, taxDeduction, 0, 0, totalDeductions, netPay,
          'paid', pm.endDate, 'bank');

        periodGross += grossPay;
        periodNet += netPay;
        periodDeductions += totalDeductions;
      }

      db.prepare('UPDATE payroll_periods SET total_gross=?, total_net=?, total_deductions=?, status=? WHERE id=?')
        .run(+periodGross.toFixed(2), +periodNet.toFixed(2), +periodDeductions.toFixed(2), 'paid', periodRow.id);
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM payroll_periods').get().c} payroll periods, ${db.prepare('SELECT COUNT(*) as c FROM payroll_records').get().c} payroll records`);
  } catch (e) { console.log('    ⚠ Skipping payroll:', e.message); }

  // ─── 16. EXPENSES ──────────────────────────────────
  console.log('  → Seeding expenses...');
  const insExp = db.prepare(`INSERT OR IGNORE INTO expenses (expense_type, amount, description, expense_date, payment_method, currency, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  const expenseCategories = [
    { type: 'utilities',   desc: 'فاتورة كهرباء',     min: 3000,  max: 8000 },
    { type: 'utilities',   desc: 'فاتورة مياه',       min: 500,   max: 1500 },
    { type: 'other',       desc: 'إيجار المصنع',      min: 25000, max: 25000 },
    { type: 'maintenance', desc: 'صيانة ماكينات',      min: 1000,  max: 5000 },
    { type: 'transport',   desc: 'نقل وتوصيل',        min: 2000,  max: 6000 },
    { type: 'other',       desc: 'مستلزمات مكتبية',    min: 500,   max: 2000 },
  ];

  for (let month = 0; month < 3; month++) {
    for (const cat of expenseCategories) {
      const expDate = addDays(SEED_START, month * 30 + randInt(1, 25));
      const amount = cat.min === cat.max ? cat.min : randFloat(cat.min, cat.max, 0);
      insExp.run(cat.type, amount, `${cat.desc} — شهر ${month + 1}`, dd(expDate), 'bank', 'EGP', 'approved', userIds[0], dt(expDate));
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM expenses').get().c} expenses`);

  // ─── 17. AUDIT LOG (seed a few initial entries) ────
  console.log('  → Seeding audit log...');
  const insAudit = db.prepare(`INSERT OR IGNORE INTO audit_log (user_id, username, action, entity_type, entity_id, entity_label, created_at) VALUES (?,?,?,?,?,?,?)`);
  insAudit.run(userIds[0], 'admin', 'SEED', 'system', 0, 'Seed script executed', dt(new Date()));
  insAudit.run(userIds[0], 'admin', 'LOGIN', 'user', userIds[0], 'Admin initial login', dt(addDays(SEED_START, -1)));
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM audit_log').get().c} audit entries`);

  // ─── 18. PERMISSIONS (default roles) ────────────
  console.log('  → Seeding permissions...');
  try {
    const insPerm = db.prepare(`INSERT OR IGNORE INTO role_permissions (role, module, action) VALUES (?,?,?)`);
    const modules = ['fabrics', 'accessories', 'customers', 'suppliers', 'models', 'workorders', 'invoices', 'purchaseorders', 'hr', 'machines', 'expenses', 'reports', 'exports', 'quality', 'settings', 'users', 'auditlog', 'dashboard', 'notifications', 'shipments', 'accounting'];
    const actions = ['view', 'create', 'edit', 'delete', 'export'];
    // superadmin/manager get all
    for (const role of ['superadmin', 'manager']) {
      for (const mod of modules) {
        for (const act of actions) {
          insPerm.run(role, mod, act);
        }
      }
    }
    // viewer gets view + export only
    for (const mod of modules) {
      insPerm.run('viewer', mod, 'view');
      insPerm.run('viewer', mod, 'export');
    }
    console.log(`    ✓ Permissions seeded`);
  } catch (e) { console.log('    ⚠ Skipping permissions:', e.message); }

  // ─── 19. NOTIFICATIONS ─────────────────────────────
  console.log('  → Seeding notifications...');
  try {
    const insNotif = db.prepare(`INSERT OR IGNORE INTO notifications (user_id, type, title, body, reference_type, reference_id, is_read, created_at) VALUES (?,?,?,?,?,?,?,?)`);
    // Low stock alerts
    const lowFabs = db.prepare("SELECT code, name, available_meters FROM fabrics WHERE available_meters < 50 AND status='active'").all();
    for (const f of lowFabs) {
      insNotif.run(userIds[0], 'stock_alert', `تنبيه مخزون منخفض — ${f.name}`, `المتوفر: ${f.available_meters} متر فقط`, 'fabric', null, 0, dt(addDays(SEED_END, -5)));
    }
    // Overdue WO alerts
    const overdueWOs = db.prepare("SELECT id, wo_number FROM work_orders WHERE due_date < date('now') AND status NOT IN ('completed','cancelled')").all();
    for (const w of overdueWOs) {
      insNotif.run(userIds[0], 'overdue_wo', `أمر شغل متأخر — ${w.wo_number}`, `تجاوز الموعد المحدد`, 'work_order', w.id, 0, dt(addDays(SEED_END, -3)));
    }
    // Machine maintenance alert
    if (mach4) {
      insNotif.run(userIds[0], 'maintenance', 'تنبيه صيانة ماكينة', 'ماكينة القص الكهربائية تحت الصيانة — MACH-004', 'machine', mach4.id, 0, dt(addDays(SEED_END, -2)));
    }
    // Invoice payment due
    const dueInvoices = db.prepare("SELECT id, invoice_number FROM invoices WHERE status IN ('sent','partially_paid') AND due_date <= date('now')").all();
    for (const inv of dueInvoices) {
      insNotif.run(userIds[0], 'payment_due', `فاتورة مستحقة — ${inv.invoice_number}`, `يرجى متابعة التحصيل`, 'invoice', inv.id, 0, dt(addDays(SEED_END, -1)));
    }
    // System notification
    insNotif.run(userIds[0], 'system', 'تم تحديث النظام', 'تم تحديث نظام WK-Hub إلى الإصدار الأخير', null, null, 1, dt(addDays(SEED_START, 10)));
    insNotif.run(userIds[1] || userIds[0], 'system', 'مرحباً بك في WK-Hub', 'نظام إدارة المصنع جاهز للاستخدام', null, null, 1, dt(addDays(SEED_START, 1)));
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM notifications').get().c} notifications`);
  } catch (e) { console.log('    ⚠ Skipping notifications:', e.message); }

  // ─── 20. SUPPLIER PAYMENTS ─────────────────────────
  console.log('  → Seeding supplier payments...');
  try {
    const insSupPay = db.prepare(`INSERT OR IGNORE INTO supplier_payments (supplier_id, po_id, amount, payment_date, payment_method, reference, notes) VALUES (?,?,?,?,?,?,?)`);
    const paidPOs = db.prepare("SELECT id, supplier_id, total_amount, paid_amount, po_number, order_date FROM purchase_orders WHERE paid_amount > 0").all();
    for (const po of paidPOs) {
      const payDate = addDays(new Date(po.order_date), randInt(10, 30));
      insSupPay.run(po.supplier_id, po.id, po.paid_amount, dd(payDate), pick(['bank','check']), `PAY-${po.po_number}`, null);
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM supplier_payments').get().c} supplier payments`);
  } catch (e) { console.log('    ⚠ Skipping supplier payments:', e.message); }

  // ─── 21. STOCK MOVEMENTS ───────────────────────────
  console.log('  → Seeding stock movements...');
  try {
    const insFabMove = db.prepare(`INSERT OR IGNORE INTO fabric_stock_movements (fabric_code, movement_type, qty_meters, batch_id, reference_type, reference_id, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
    const insAccMove = db.prepare(`INSERT OR IGNORE INTO accessory_stock_movements (accessory_code, movement_type, qty, reference_type, reference_id, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`);

    // Fabric receiving from POs
    for (const po of PO_DEFS) {
      if (po.status === 'sent') continue;
      const poRow = db.prepare('SELECT id FROM purchase_orders WHERE po_number=?').get(po.num);
      if (!poRow) continue;
      const receiveDate = addDays(SEED_START, po.dayOff + randInt(7, 14));
      for (const item of po.items) {
        if (!item.code.startsWith('FAB')) continue;
        const rcvd = po.status === 'received' ? item.qty : Math.floor(item.qty * 0.6);
        if (rcvd <= 0) continue;
        const batch = db.prepare('SELECT id FROM fabric_inventory_batches WHERE fabric_code=? AND po_id=?').get(item.code, poRow.id);
        insFabMove.run(item.code, 'in', rcvd, batch ? batch.id : null, 'purchase_order', poRow.id, `استلام ${po.num}`, userIds[0], dt(receiveDate));
      }
      for (const item of po.items) {
        if (!item.code.startsWith('ACC')) continue;
        const rcvd = po.status === 'received' ? item.qty : Math.floor(item.qty * 0.6);
        if (rcvd <= 0) continue;
        insAccMove.run(item.code, 'in', rcvd, 'purchase_order', poRow.id, `استلام ${po.num}`, userIds[0], dt(receiveDate));
      }
    }

    // Fabric consumption from WOs
    for (const woNum of Object.keys(woMap)) {
      const wo = woMap[woNum];
      if (wo.stageQtys[0] === 0) continue;
      const fabRows = db.prepare('SELECT fabric_code, actual_meters FROM wo_fabrics WHERE wo_id=?').all(wo.id);
      for (const fb of fabRows) {
        if (!fb.actual_meters || fb.actual_meters <= 0) continue;
        insFabMove.run(fb.fabric_code, 'out', -fb.actual_meters, null, 'work_order', wo.id, `استهلاك ${woNum}`, userIds[0], dt(addDays(wo.startDate, 1)));
      }
    }

    // Accessory consumption from WOs
    for (const woNum of Object.keys(woMap)) {
      const wo = woMap[woNum];
      if (wo.stageQtys[0] === 0) continue;
      const accRows = db.prepare('SELECT accessory_code, quantity FROM wo_accessories WHERE wo_id=?').all(wo.id);
      for (const ac of accRows) {
        if (!ac.quantity || ac.quantity <= 0) continue;
        insAccMove.run(ac.accessory_code, 'out', -ac.quantity, 'work_order', wo.id, `استهلاك ${woNum}`, userIds[0], dt(addDays(wo.startDate, 1)));
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM fabric_stock_movements').get().c} fabric movements, ${db.prepare('SELECT COUNT(*) as c FROM accessory_stock_movements').get().c} accessory movements`);
  } catch (e) { console.log('    ⚠ Skipping stock movements:', e.message); }

  // ─── 22. CUSTOMER CONTACTS & NOTES ─────────────────
  console.log('  → Seeding customer contacts & notes...');
  try {
    const insContact = db.prepare(`INSERT OR IGNORE INTO customer_contacts (customer_id, name, title, phone, email, is_primary, created_at) VALUES (?,?,?,?,?,?,?)`);
    const insNote = db.prepare(`INSERT OR IGNORE INTO customer_notes (customer_id, note, created_by, created_at) VALUES (?,?,?,?)`);

    const contactDefs = [
      { cust: 1, name: 'محمد سالم', title: 'مدير المشتريات', phone: '01001234567', email: 'mohamed@nile-fashion.com', primary: 1 },
      { cust: 1, name: 'هدى أحمد', title: 'محاسبة', phone: '01001234568', email: 'hoda@nile-fashion.com', primary: 0 },
      { cust: 2, name: 'عمرو حسين', title: 'مالك', phone: '01112345678', email: 'amr@delta-clothing.com', primary: 1 },
      { cust: 3, name: 'ليلى عبدالله', title: 'مديرة المبيعات', phone: '01223456789', email: 'layla@cairo-garments.com', primary: 1 },
      { cust: 3, name: 'أحمد ماهر', title: 'مدير الجودة', phone: '01223456790', email: 'ahmed@cairo-garments.com', primary: 0 },
      { cust: 4, name: 'سامي فوزي', title: 'مدير التصدير', phone: '01098765432', email: 'sami@export-co.com', primary: 1 },
      { cust: 5, name: 'نورا مصطفى', title: 'صاحبة السلسلة', phone: '01287654321', email: 'noura@boutique-stars.com', primary: 1 },
      { cust: 6, name: 'خالد العتيبي', title: 'مدير المشتريات', phone: '+966501234567', email: 'khaled@gulf-fashion.com', primary: 1 },
      { cust: 6, name: 'فهد الشمري', title: 'محاسب', phone: '+966501234568', email: 'fahad@gulf-fashion.com', primary: 0 },
    ];
    for (const c of contactDefs) {
      insContact.run(c.cust, c.name, c.title, c.phone, c.email, c.primary, dt(addDays(SEED_START, -40)));
    }

    const noteDefs = [
      { cust: 1, note: 'عميل منتظم — يفضل التسليم أيام الأحد والثلاثاء' },
      { cust: 1, note: 'طلب خصم 5% على الطلبيات فوق 500 قطعة — تمت الموافقة' },
      { cust: 2, note: 'شحن دائماً عبر شركة النقل السريع — لا يقبل بديل' },
      { cust: 3, note: 'يطلب شهادة جودة مع كل شحنة' },
      { cust: 4, note: 'عميل تصدير — يتطلب وثائق جمركية مع كل شحنة' },
      { cust: 4, note: 'الدفع بالدولار — L/C عبر بنك مصر' },
      { cust: 5, note: 'تفضل التصميمات الحديثة والألوان الفاتحة' },
      { cust: 6, note: 'عميل خليجي — الشحن الجوي مطلوب — تحمل تكلفة الشحن' },
    ];
    for (const n of noteDefs) {
      insNote.run(n.cust, n.note, userIds[0], dt(addDays(SEED_START, randInt(-30, 0))));
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM customer_contacts').get().c} contacts, ${db.prepare('SELECT COUNT(*) as c FROM customer_notes').get().c} notes`);
  } catch (e) { console.log('    ⚠ Skipping customer contacts/notes:', e.message); }

  // ─── 23. HR — LEAVE BALANCES, REQUESTS, ADJUSTMENTS ──
  console.log('  → Seeding HR leave & adjustments...');
  try {
    const insLeaveBalance = db.prepare(`INSERT OR IGNORE INTO leave_balances (employee_id, leave_type, year, entitled_days, used_days, carried_over) VALUES (?,?,?,?,?,?)`);
    const insLeaveReq = db.prepare(`INSERT OR IGNORE INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
    const insHRAdjust = db.prepare(`INSERT OR IGNORE INTO hr_adjustments (employee_id, period_id, adj_type, amount, description, applied, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`);

    for (const empId of employeeIds) {
      insLeaveBalance.run(empId, 'annual', 2026, 21, randInt(0, 5), randInt(0, 3));
      insLeaveBalance.run(empId, 'sick', 2026, 7, randInt(0, 2), 0);
      insLeaveBalance.run(empId, 'casual', 2026, 6, randInt(0, 2), 0);
    }

    // Some leave requests
    const leaveTypes = ['annual', 'sick', 'casual'];
    const leaveReqs = [
      { emp: 0, type: 'annual', startOff: 20, days: 3, reason: 'إجازة سنوية', status: 'approved' },
      { emp: 1, type: 'sick', startOff: 35, days: 2, reason: 'مرض — إجازة مرضية', status: 'approved' },
      { emp: 2, type: 'annual', startOff: 50, days: 5, reason: 'إجازة عيد الفطر', status: 'approved' },
      { emp: 3, type: 'casual', startOff: 40, days: 1, reason: 'ظرف طارئ', status: 'approved' },
      { emp: 4, type: 'annual', startOff: 75, days: 4, reason: 'إجازة شخصية', status: 'pending' },
      { emp: 0, type: 'sick', startOff: 60, days: 1, reason: 'صداع شديد', status: 'approved' },
    ];
    for (const lr of leaveReqs) {
      const empId = employeeIds[lr.emp];
      if (!empId) continue;
      const startDate = addDays(SEED_START, lr.startOff);
      const endDate = addDays(startDate, lr.days - 1);
      const reviewedAt = lr.status === 'approved' ? dt(addDays(startDate, -1)) : null;
      insLeaveReq.run(empId, lr.type, dd(startDate), dd(endDate), lr.reason, lr.status, lr.status === 'approved' ? userIds[0] : null, reviewedAt, dt(addDays(startDate, -2)));
    }

    // HR adjustments (bonuses, deductions)
    const periodIds = db.prepare('SELECT id, period_month FROM payroll_periods ORDER BY period_month LIMIT 3').all();
    const adjustDefs = [
      { emp: 0, type: 'bonus', amount: 500, desc: 'مكافأة إنتاج متميز' },
      { emp: 1, type: 'bonus', amount: 300, desc: 'مكافأة التزام' },
      { emp: 2, type: 'deduction', amount: 200, desc: 'خصم غياب بدون إذن' },
      { emp: 3, type: 'bonus', amount: 400, desc: 'مكافأة جودة — صفر عيوب' },
      { emp: 4, type: 'deduction', amount: 150, desc: 'خصم تأخير متكرر' },
      { emp: 5, type: 'bonus', amount: 250, desc: 'مكافأة شحن سريع' },
    ];
    for (const adj of adjustDefs) {
      const empId = employeeIds[adj.emp];
      const periodId = periodIds.length > 1 ? periodIds[1].id : (periodIds[0] ? periodIds[0].id : null);
      if (!empId || !periodId) continue;
      insHRAdjust.run(empId, periodId, adj.type, adj.amount, adj.desc, 1, userIds[0], dt(addDays(SEED_START, 45)));
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM leave_balances').get().c} leave balances, ${db.prepare('SELECT COUNT(*) as c FROM leave_requests').get().c} leave requests, ${db.prepare('SELECT COUNT(*) as c FROM hr_adjustments').get().c} HR adjustments`);
  } catch (e) { console.log('    ⚠ Skipping HR leave:', e.message); }

  // ─── 24. QC TEMPLATES & INSPECTIONS ────────────────
  console.log('  → Seeding QC templates & inspections...');
  try {
    const insQCT = db.prepare(`INSERT OR IGNORE INTO qc_templates (name, model_code, description, aql_level, inspection_type, is_active, created_at) VALUES (?,?,?,?,?,?,?)`);
    const insQCTI = db.prepare(`INSERT OR IGNORE INTO qc_template_items (template_id, check_point, category, severity, accept_criteria, sort_order) VALUES (?,?,?,?,?,?)`);
    const insQCI = db.prepare(`INSERT OR IGNORE INTO qc_inspections (work_order_id, stage_id, template_id, inspection_number, inspector_id, inspection_date, lot_size, sample_size, passed, failed, result, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insQCII = db.prepare(`INSERT OR IGNORE INTO qc_inspection_items (inspection_id, check_point, result, defect_code, defect_count, notes) VALUES (?,?,?,?,?,?)`);
    const insNCR = db.prepare(`INSERT OR IGNORE INTO qc_ncr (ncr_number, inspection_id, work_order_id, severity, description, root_cause, corrective_action, preventive_action, status, assigned_to, due_date, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    // QC Templates
    const qcTemplates = [
      { name: 'فحص قميص رجالي', model: 'MOD-001', desc: 'قالب فحص جودة القمصان الرجالي', aql: 'Level II', type: 'normal' },
      { name: 'فحص فستان نسائي', model: 'MOD-005', desc: 'قالب فحص جودة الفساتين النسائية', aql: 'Level II', type: 'tightened' },
      { name: 'فحص عام — ملابس خارجية', model: null, desc: 'قالب فحص عام للملابس الخارجية والجاكيتات', aql: 'Level I', type: 'reduced' },
    ];
    for (const t of qcTemplates) {
      insQCT.run(t.name, t.model, t.desc, t.aql, t.type, 1, dt(addDays(SEED_START, -10)));
    }

    // QC Template items for first template
    const tmpl1 = db.prepare("SELECT id FROM qc_templates WHERE name='فحص قميص رجالي'").get();
    if (tmpl1) {
      const checkPoints = [
        { cp: 'خياطة الأكمام', cat: 'sewing', sev: 'major', criteria: 'غرز متساوية — لا خيوط ظاهرة' },
        { cp: 'تثبيت الأزرار', cat: 'sewing', sev: 'major', criteria: 'مثبتة بإحكام — 4 ثقوب' },
        { cp: 'الياقة', cat: 'sewing', sev: 'critical', criteria: 'متماثلة — تقوية داخلية' },
        { cp: 'القياسات', cat: 'measurement', sev: 'critical', criteria: 'ضمن ±1 سم من المواصفات' },
        { cp: 'نظافة القماش', cat: 'appearance', sev: 'minor', criteria: 'لا بقع — لا خيوط زائدة' },
        { cp: 'الكي النهائي', cat: 'appearance', sev: 'minor', criteria: 'مكوي بدون تجاعيد' },
      ];
      checkPoints.forEach((cp, i) => insQCTI.run(tmpl1.id, cp.cp, cp.cat, cp.sev, cp.criteria, i + 1));
    }

    // QC Inspections for completed/in-progress WOs
    let inspNum = 1;
    const qcInspector = employeeIds.length > 3 ? employeeIds[3] : userIds[0];
    for (const woNum of Object.keys(woMap)) {
      const wo = woMap[woNum];
      if (wo.stageQtys[3] === 0) continue; // No QC data
      const qcStage = db.prepare("SELECT id FROM wo_stages WHERE wo_id=? AND stage_name='مراجعة جودة'").get(wo.id);
      if (!qcStage) continue;

      const lotSize = wo.qty;
      const sampleSize = Math.min(lotSize, Math.max(8, Math.floor(lotSize * 0.1)));
      const failed = (woNum === 'WO-2026-002' || woNum === 'WO-2026-011') ? randInt(2, 5) : 0;
      const passed = sampleSize - failed;
      const result = failed > 0 ? 'conditional' : 'pass';
      const inspDate = wo.completedDate || addDays(wo.startDate, 15);

      insQCI.run(wo.id, qcStage.id, tmpl1 ? tmpl1.id : null, `QCI-2026-${pad(inspNum)}`, qcInspector,
        dd(inspDate), lotSize, sampleSize, passed, failed, result, failed > 0 ? 'عيوب بسيطة تم معالجتها' : 'فحص ناجح', dt(inspDate));

      const inspRow = db.prepare('SELECT id FROM qc_inspections WHERE inspection_number=?').get(`QCI-2026-${pad(inspNum)}`);
      if (inspRow) {
        insQCII.run(inspRow.id, 'خياطة الأكمام', failed > 0 ? 'fail' : 'pass', failed > 0 ? 'SEW-01' : null, failed > 0 ? failed : 0, null);
        insQCII.run(inspRow.id, 'الياقة', 'pass', null, 0, null);
        insQCII.run(inspRow.id, 'القياسات', 'pass', null, 0, null);
        insQCII.run(inspRow.id, 'نظافة القماش', 'pass', null, 0, null);
      }

      // NCR for WOs with failures
      if (failed > 0 && inspRow) {
        insNCR.run(`NCR-2026-${pad(inspNum)}`, inspRow.id, wo.id, 'minor',
          'عيوب خياطة في الأكمام — غرز غير متساوية',
          'سرعة ماكينة الخياطة عالية + خيط رفيع',
          'إعادة خياطة القطع المعيبة — تم الانتهاء',
          'تعديل سرعة الماكينة — تغيير الخيط إلى نوع أقوى',
          'closed', qcInspector, dd(addDays(inspDate, 3)), userIds[0], dt(inspDate));
      }
      inspNum++;
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM qc_templates').get().c} QC templates, ${db.prepare('SELECT COUNT(*) as c FROM qc_inspections').get().c} inspections, ${db.prepare('SELECT COUNT(*) as c FROM qc_ncr').get().c} NCRs`);
  } catch (e) { console.log('    ⚠ Skipping QC:', e.message); }

  // ─── 25. QUOTATIONS & SALES ORDERS ─────────────────
  console.log('  → Seeding quotations & sales orders...');
  try {
    const insQuot = db.prepare(`INSERT OR IGNORE INTO quotations (quotation_number, customer_id, status, valid_until, subtotal, tax_rate, tax_amount, discount, total, notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insQuotItem = db.prepare(`INSERT OR IGNORE INTO quotation_items (quotation_id, model_code, description, quantity, unit_price, total, notes) VALUES (?,?,?,?,?,?,?)`);
    const insSO = db.prepare(`INSERT OR IGNORE INTO sales_orders (so_number, quotation_id, customer_id, status, order_date, delivery_date, subtotal, tax_rate, tax_amount, discount, total, notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insSOItem = db.prepare(`INSERT OR IGNORE INTO sales_order_items (sales_order_id, model_code, description, quantity, produced_qty, shipped_qty, unit_price, total, work_order_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`);

    const quotDefs = [
      { num: 'QUO-2026-001', cust: 1, status: 'accepted', models: [{ code: 'MOD-001', qty: 500, price: 185 }, { code: 'MOD-002', qty: 200, price: 295 }] },
      { num: 'QUO-2026-002', cust: 2, status: 'accepted', models: [{ code: 'MOD-003', qty: 300, price: 350 }] },
      { num: 'QUO-2026-003', cust: 4, status: 'sent', models: [{ code: 'MOD-005', qty: 150, price: 420 }, { code: 'MOD-006', qty: 100, price: 490 }] },
      { num: 'QUO-2026-004', cust: 5, status: 'draft', models: [{ code: 'MOD-001', qty: 400, price: 180 }] },
      { num: 'QUO-2026-005', cust: 6, status: 'accepted', models: [{ code: 'MOD-006', qty: 80, price: 490 }, { code: 'MOD-005', qty: 300, price: 420 }] },
      { num: 'QUO-2026-006', cust: 3, status: 'expired', models: [{ code: 'MOD-004', qty: 600, price: 130 }] },
    ];

    for (const q of quotDefs) {
      const subtotal = q.models.reduce((s, m) => s + m.qty * m.price, 0);
      const taxRate = 14;
      const taxAmount = +(subtotal * taxRate / 100).toFixed(2);
      const total = +(subtotal + taxAmount).toFixed(2);
      const created = dt(addDays(SEED_START, randInt(-10, 20)));
      const validUntil = dd(addDays(SEED_START, 60));

      insQuot.run(q.num, q.cust, q.status, validUntil, subtotal, taxRate, taxAmount, 0, total, null, userIds[0], created, created);

      const qRow = db.prepare('SELECT id FROM quotations WHERE quotation_number=?').get(q.num);
      if (!qRow) continue;
      for (const m of q.models) {
        const modelRow = db.prepare('SELECT model_name FROM models WHERE model_code=?').get(m.code);
        insQuotItem.run(qRow.id, m.code, modelRow ? modelRow.model_name : m.code, m.qty, m.price, +(m.qty * m.price).toFixed(2), null);
      }
    }

    // Sales orders from accepted quotations
    const soDefs = [
      { num: 'SO-2026-001', quot: 'QUO-2026-001', cust: 1, status: 'in_production', dayOff: 5 },
      { num: 'SO-2026-002', quot: 'QUO-2026-002', cust: 2, status: 'in_production', dayOff: 10 },
      { num: 'SO-2026-003', quot: 'QUO-2026-005', cust: 6, status: 'confirmed', dayOff: 15 },
    ];
    for (const so of soDefs) {
      const qRow = db.prepare('SELECT * FROM quotations WHERE quotation_number=?').get(so.quot);
      if (!qRow) continue;
      const orderDate = addDays(SEED_START, so.dayOff);
      const deliveryDate = addDays(orderDate, 45);
      const created = dt(orderDate);
      insSO.run(so.num, qRow.id, so.cust, so.status, dd(orderDate), dd(deliveryDate), qRow.subtotal, qRow.tax_rate, qRow.tax_amount, 0, qRow.total, null, userIds[0], created, created);

      const soRow = db.prepare('SELECT id FROM sales_orders WHERE so_number=?').get(so.num);
      if (!soRow) continue;
      const qItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id=?').all(qRow.id);
      for (const qi of qItems) {
        const woRow = db.prepare('SELECT id FROM work_orders WHERE model_id=(SELECT id FROM models WHERE model_code=?) LIMIT 1').get(qi.model_code);
        insSOItem.run(soRow.id, qi.model_code, qi.description, qi.quantity, so.status === 'in_production' ? Math.floor(qi.quantity * 0.5) : 0, 0, qi.unit_price, qi.total, woRow ? woRow.id : null, null);
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM quotations').get().c} quotations, ${db.prepare('SELECT COUNT(*) as c FROM sales_orders').get().c} sales orders`);
  } catch (e) { console.log('    ⚠ Skipping quotations/SOs:', e.message); }

  // ─── 26. PURCHASE RETURNS ──────────────────────────
  console.log('  → Seeding purchase returns...');
  try {
    const insPR = db.prepare(`INSERT OR IGNORE INTO purchase_returns (return_number, purchase_order_id, supplier_id, return_date, reason, status, subtotal, tax_amount, total, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insPRI = db.prepare(`INSERT OR IGNORE INTO purchase_return_items (return_id, item_type, item_code, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?,?)`);

    const prDefs = [
      { num: 'PR-2026-001', po: 'PO-2026-001', reason: 'عيب في القماش — لون مختلف عن العينة', status: 'approved', items: [{ code: 'FAB-001', type: 'fabric', qty: 50, price: 18.50 }] },
      { num: 'PR-2026-002', po: 'PO-2026-003', reason: 'قماش تالف أثناء الشحن', status: 'draft', items: [{ code: 'FAB-004', type: 'fabric', qty: 30, price: 45.00 }] },
    ];
    for (const pr of prDefs) {
      const poRow = db.prepare('SELECT id, supplier_id FROM purchase_orders WHERE po_number=?').get(pr.po);
      if (!poRow) continue;
      const subtotal = pr.items.reduce((s, i) => s + i.qty * i.price, 0);
      const taxAmount = +(subtotal * 0.14).toFixed(2);
      const total = +(subtotal + taxAmount).toFixed(2);
      const returnDate = dd(addDays(SEED_START, randInt(20, 40)));
      insPR.run(pr.num, poRow.id, poRow.supplier_id, returnDate, pr.reason, pr.status, subtotal, taxAmount, total, null, userIds[0], dt(addDays(SEED_START, randInt(20, 40))));

      const prRow = db.prepare('SELECT id FROM purchase_returns WHERE return_number=?').get(pr.num);
      if (!prRow) continue;
      for (const item of pr.items) {
        insPRI.run(prRow.id, item.type, item.code, item.code, item.qty, item.price, +(item.qty * item.price).toFixed(2));
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM purchase_returns').get().c} purchase returns`);
  } catch (e) { console.log('    ⚠ Skipping purchase returns:', e.message); }

  // ─── 27. SALES RETURNS ─────────────────────────────
  console.log('  → Seeding sales returns...');
  try {
    const insSR = db.prepare(`INSERT OR IGNORE INTO sales_returns (return_number, invoice_id, customer_id, return_date, reason, status, subtotal, tax_amount, total, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insSRI = db.prepare(`INSERT OR IGNORE INTO sales_return_items (return_id, item_type, item_code, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?,?)`);

    // Return 5 pieces from INV-001 (paid, WO-001 MOD-001 @185)
    const inv1 = db.prepare("SELECT id, customer_id FROM invoices WHERE invoice_number='INV-2026-001'").get();
    if (inv1) {
      const qty = 5, price = 185, subtotal = qty * price;
      const taxAmount = +(subtotal * 0.14).toFixed(2);
      const total = +(subtotal + taxAmount).toFixed(2);
      insSR.run('SR-2026-001', inv1.id, inv1.customer_id, dd(addDays(SEED_START, 35)), 'عيب في الخياطة — إرجاع جزئي', 'approved', subtotal, taxAmount, total, null, userIds[0], dt(addDays(SEED_START, 35)));
      const srRow = db.prepare("SELECT id FROM sales_returns WHERE return_number='SR-2026-001'").get();
      if (srRow) {
        insSRI.run(srRow.id, 'other', 'MOD-001', 'قميص قطن رجالي', qty, price, subtotal);
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM sales_returns').get().c} sales returns`);
  } catch (e) { console.log('    ⚠ Skipping sales returns:', e.message); }

  // ─── 28. SAMPLES ───────────────────────────────────
  console.log('  → Seeding samples...');
  try {
    const insSample = db.prepare(`INSERT OR IGNORE INTO samples (sample_number, model_code, customer_id, status, description, fabrics_used, accessories_used, cost, requested_date, completion_date, customer_feedback, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    const sampleDefs = [
      { num: 'SMP-2026-001', model: 'MOD-001', cust: 1, status: 'approved', desc: 'عينة قميص قطن — لون أبيض', cost: 120, feedback: 'ممتاز — موافقة على الإنتاج', dayOff: -5, completeDayOff: 3 },
      { num: 'SMP-2026-002', model: 'MOD-003', cust: 2, status: 'approved', desc: 'عينة عباءة حرير — لون أسود', cost: 280, feedback: 'جيد جداً مع تعديل طفيف في الطول', dayOff: -3, completeDayOff: 5 },
      { num: 'SMP-2026-003', model: 'MOD-005', cust: 4, status: 'in_progress', desc: 'عينة فستان كتان — لون بيج', cost: 350, feedback: null, dayOff: 10, completeDayOff: null },
      { num: 'SMP-2026-004', model: 'MOD-006', cust: 6, status: 'rejected', desc: 'عينة جاكيت صوف — لون رمادي', cost: 420, feedback: 'اللون غير مطابق — يرجى إعادة بلون أغمق', dayOff: 5, completeDayOff: 12 },
      { num: 'SMP-2026-005', model: 'MOD-002', cust: 5, status: 'requested', desc: 'عينة بنطلون كتان — لون كحلي', cost: 180, feedback: null, dayOff: 20, completeDayOff: null },
    ];
    for (const s of sampleDefs) {
      const reqDate = dd(addDays(SEED_START, s.dayOff));
      const compDate = s.completeDayOff ? dd(addDays(SEED_START, s.completeDayOff)) : null;
      const created = dt(addDays(SEED_START, s.dayOff));
      insSample.run(s.num, s.model, s.cust, s.status, s.desc, JSON.stringify([s.model]), JSON.stringify([]), s.cost, reqDate, compDate, s.feedback, userIds[0], created, created);
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM samples').get().c} samples`);
  } catch (e) { console.log('    ⚠ Skipping samples:', e.message); }

  // ─── 29. MAINTENANCE ORDERS ────────────────────────
  console.log('  → Seeding maintenance orders...');
  try {
    const insMO = db.prepare(`INSERT OR IGNORE INTO maintenance_orders (machine_id, maintenance_type, title, description, priority, status, scheduled_date, completed_date, performed_by, cost, notes, barcode, created_by, is_deleted, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`);
    const insMOP = db.prepare(`INSERT OR IGNORE INTO maintenance_parts (mo_id, part_name, part_number, quantity, unit_cost, supplier, notes) VALUES (?,?,?,?,?,?,?)`);

    const moDefs = [
      { machine: 1, type: 'preventive', title: 'صيانة دورية — ماكينة خياطة', desc: 'تنظيف وتزييت — تغيير إبر', priority: 'medium', status: 'completed', schedOff: 15, compOff: 16, cost: 350, by: 'فني صيانة داخلي',
        parts: [{ name: 'إبر خياطة صناعية', pn: 'NDL-001', qty: 10, cost: 15 }, { name: 'زيت ماكينات', pn: 'OIL-001', qty: 2, cost: 45 }] },
      { machine: 2, type: 'corrective', title: 'إصلاح قاطع الخيط', desc: 'قاطع الخيط لا يعمل — تم الاستبدال', priority: 'high', status: 'completed', schedOff: 30, compOff: 31, cost: 600, by: 'فني صيانة خارجي',
        parts: [{ name: 'قاطع خيط أوفرلوك', pn: 'CUT-002', qty: 1, cost: 400 }] },
      { machine: 3, type: 'preventive', title: 'صيانة دورية — مكواة', desc: 'تنظيف سطح المكواة — فحص ثرموستات', priority: 'low', status: 'completed', schedOff: 45, compOff: 45, cost: 200, by: 'فني صيانة داخلي', parts: [] },
      { machine: 4, type: 'corrective', title: 'إصلاح موتور طاولة القص', desc: 'تعطل الموتور — قيد الإصلاح', priority: 'critical', status: 'in_progress', schedOff: 70, compOff: null, cost: 3500, by: 'فني صيانة خارجي',
        parts: [{ name: 'موتور كهربائي 2HP', pn: 'MOT-004', qty: 1, cost: 2800 }, { name: 'حزام نقل', pn: 'BLT-001', qty: 2, cost: 120 }] },
      { machine: 1, type: 'preventive', title: 'صيانة ربع سنوية', desc: 'صيانة شاملة — فحص جميع الأجزاء', priority: 'medium', status: 'pending', schedOff: 85, compOff: null, cost: 0, by: null, parts: [] },
    ];
    for (const mo of moDefs) {
      const schedDate = dd(addDays(SEED_START, mo.schedOff));
      const compDate = mo.compOff ? dd(addDays(SEED_START, mo.compOff)) : null;
      const created = dt(addDays(SEED_START, mo.schedOff - 2));
      insMO.run(mo.machine, mo.type, mo.title, mo.desc, mo.priority, mo.status, schedDate, compDate, mo.by, mo.cost, mo.notes || null, `MO-${pad(moDefs.indexOf(mo) + 1)}`, userIds[0], created, created);

      if (mo.parts.length > 0) {
        const moRow = db.prepare("SELECT id FROM maintenance_orders WHERE barcode=?").get(`MO-${pad(moDefs.indexOf(mo) + 1)}`);
        if (moRow) {
          for (const p of mo.parts) {
            insMOP.run(moRow.id, p.name, p.pn, p.qty, p.cost, null, null);
          }
        }
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM maintenance_orders').get().c} maintenance orders, ${db.prepare('SELECT COUNT(*) as c FROM maintenance_parts').get().c} parts`);
  } catch (e) { console.log('    ⚠ Skipping maintenance orders:', e.message); }

  // ─── 30. PRODUCTION SCHEDULE ───────────────────────
  console.log('  → Seeding production schedule...');
  try {
    const insSched = db.prepare(`INSERT OR IGNORE INTO production_schedule (work_order_id, production_line_id, machine_id, stage_id, planned_start, planned_end, actual_start, actual_end, priority, status, notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const prodLine = db.prepare('SELECT id FROM production_lines LIMIT 1').get();

    for (const woNum of Object.keys(woMap)) {
      const wo = woMap[woNum];
      const stages = db.prepare('SELECT id, stage_name, sort_order, status FROM wo_stages WHERE wo_id=? ORDER BY sort_order').all(wo.id);
      for (const stage of stages) {
        const planStart = addDays(wo.startDate, stage.sort_order * 2);
        const planEnd = addDays(planStart, 2);
        const machineId = stage.sort_order <= 2 ? (machineIds[stage.sort_order - 1] || null) : (stage.sort_order === 3 ? (machineIds[2] || null) : null);
        const actualStart = stage.status !== 'pending' ? dd(planStart) : null;
        const actualEnd = stage.status === 'completed' ? dd(planEnd) : null;
        const status = stage.status === 'completed' ? 'completed' : (stage.status === 'in_progress' ? 'in_progress' : 'planned');
        const created = dt(addDays(wo.startDate, -1));

        insSched.run(wo.id, prodLine ? prodLine.id : null, machineId, stage.id, dd(planStart), dd(planEnd), actualStart, actualEnd, wo.stageQtys[0] > 0 ? 1 : 5, status, null, userIds[0], created, created);
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM production_schedule').get().c} schedule entries`);
  } catch (e) { console.log('    ⚠ Skipping production schedule:', e.message); }

  // ─── 31. STAGE MOVEMENT LOG ────────────────────────
  console.log('  → Seeding stage movement log...');
  try {
    const insMove = db.prepare(`INSERT OR IGNORE INTO stage_movement_log (wo_id, from_stage_id, to_stage_id, from_stage_name, to_stage_name, qty_moved, qty_rejected, rejection_reason, moved_by_user_id, moved_by_name, moved_at, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const stageNames = ['قص', 'خياطة', 'كي', 'مراجعة جودة', 'تغليف', 'تسليم'];

    for (const woNum of Object.keys(woMap)) {
      const wo = woMap[woNum];
      const stages = db.prepare('SELECT id, stage_name, sort_order FROM wo_stages WHERE wo_id=? ORDER BY sort_order').all(wo.id);
      if (stages.length < 2) continue;

      for (let i = 0; i < stages.length - 1; i++) {
        const qtyMoved = wo.stageQtys[i + 1]; // qty that reached the next stage
        if (qtyMoved <= 0) break;
        const rejected = (i === 1 && (woNum === 'WO-2026-002' || woNum === 'WO-2026-011')) ? randInt(2, 5) : 0;
        const moveDate = addDays(wo.startDate, (i + 1) * 2);
        insMove.run(wo.id, stages[i].id, stages[i + 1].id, stages[i].stage_name, stages[i + 1].stage_name, qtyMoved, rejected, rejected > 0 ? 'عيوب خياطة' : null, userIds[0], 'مدير النظام', dt(moveDate), null);
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM stage_movement_log').get().c} stage movements`);
  } catch (e) { console.log('    ⚠ Skipping stage movement log:', e.message); }

  // ─── 32. WO EXTRA EXPENSES, WASTE, SIZES ───────────
  console.log('  → Seeding WO details (expenses, waste, sizes)...');
  try {
    const insWoExp = db.prepare(`INSERT OR IGNORE INTO wo_extra_expenses (wo_id, description, amount, stage_id, recorded_at, notes) VALUES (?,?,?,?,?,?)`);
    const insWoWaste = db.prepare(`INSERT OR IGNORE INTO wo_waste (work_order_id, waste_meters, price_per_meter, waste_cost, notes, recorded_by_user_id, recorded_at) VALUES (?,?,?,?,?,?,?)`);
    const insWoInv = db.prepare(`INSERT OR IGNORE INTO wo_invoices (work_order_id, invoice_id, qty_invoiced, unit_price, created_at) VALUES (?,?,?,?,?)`);

    // Extra expenses on some WOs
    const extraExpDefs = [
      { wo: 'WO-2026-002', desc: 'طباعة لوجو إضافي', amount: 450 },
      { wo: 'WO-2026-003', desc: 'تطريز يدوي إضافي', amount: 1200 },
      { wo: 'WO-2026-008', desc: 'نقل خارجي للمقاول', amount: 800 },
      { wo: 'WO-2026-011', desc: 'مواد تغليف فاخرة', amount: 600 },
      { wo: 'WO-2026-016', desc: 'أجرة عمالة إضافية — وردية ليلية', amount: 2500 },
    ];
    for (const exp of extraExpDefs) {
      const woRow = db.prepare('SELECT id FROM work_orders WHERE wo_number=?').get(exp.wo);
      if (!woRow) continue;
      insWoExp.run(woRow.id, exp.desc, exp.amount, null, dt(addDays(SEED_START, 30)), null);
    }

    // Fabric waste from completed/in-progress WOs that have cutting done
    for (const woNum of Object.keys(woMap)) {
      const wo = woMap[woNum];
      if (wo.stageQtys[0] === 0) continue; // no cutting = no waste
      const fabs = db.prepare('SELECT fabric_code, actual_meters FROM wo_fabrics WHERE wo_id=?').all(wo.id);
      for (const fb of fabs) {
        if (!fb.actual_meters || fb.actual_meters <= 0) continue;
        const wastePct = randFloat(3, 8);
        const wasteMeters = +(fb.actual_meters * wastePct / 100).toFixed(2);
        const priceRow = db.prepare('SELECT price_per_m FROM fabrics WHERE code=?').get(fb.fabric_code);
        const pricePerMeter = priceRow ? priceRow.price_per_m : 20;
        const wasteCost = +(wasteMeters * pricePerMeter).toFixed(2);
        insWoWaste.run(wo.id, wasteMeters, pricePerMeter, wasteCost, 'هدر قص عادي', userIds[0], dt(addDays(wo.startDate, 2)));
      }
    }

    // WO-Invoice links
    for (const inv of INVOICES) {
      const woData = woMap[inv.wo];
      if (!woData) continue;
      const invRow = db.prepare('SELECT id FROM invoices WHERE invoice_number=?').get(inv.num);
      if (!invRow) continue;
      const mm = MODELS.find(m => m.code === woData.modelCode);
      const qtyInv = inv.shipped > 0 ? inv.shipped : woData.qty;
      insWoInv.run(woData.id, invRow.id, qtyInv, mm ? mm.unitPrice : 100, dt(addDays(SEED_START, 30)));
    }

    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM wo_extra_expenses').get().c} WO expenses, ${db.prepare('SELECT COUNT(*) as c FROM wo_waste').get().c} waste records, ${db.prepare('SELECT COUNT(*) as c FROM wo_invoices').get().c} WO-invoice links`);
  } catch (e) { console.log('    ⚠ Skipping WO details:', e.message); }

  // ─── 32b. WO FABRIC & ACCESSORY CONSUMPTION ───────
  console.log('  → Seeding WO consumption records...');
  try {
    const insFC = db.prepare(`INSERT OR IGNORE INTO wo_fabric_consumption (work_order_id, fabric_id, fabric_code, po_id, batch_id, planned_meters, actual_meters, price_per_meter, total_cost, notes, recorded_by_user_id, recorded_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insAC = db.prepare(`INSERT OR IGNORE INTO wo_accessory_consumption (work_order_id, accessory_id, accessory_code, planned_qty, actual_qty, unit_price, total_cost, recorded_at) VALUES (?,?,?,?,?,?,?,?)`);

    for (const woNum of Object.keys(woMap)) {
      const wo = woMap[woNum];
      if (wo.stageQtys[0] === 0) continue;
      const recordDate = dt(addDays(wo.startDate, 2));

      // Fabric consumption
      const woFabs = db.prepare('SELECT wf.*, f.id as fid FROM wo_fabrics wf JOIN fabrics f ON f.code=wf.fabric_code WHERE wf.wo_id=?').all(wo.id);
      for (const wf of woFabs) {
        if (!wf.actual_meters || wf.actual_meters <= 0) continue;
        const batch = db.prepare('SELECT id, po_id FROM fabric_inventory_batches WHERE fabric_code=? LIMIT 1').get(wf.fabric_code);
        const priceRow = db.prepare('SELECT price_per_m FROM fabrics WHERE code=?').get(wf.fabric_code);
        const ppm = priceRow ? priceRow.price_per_m : 20;
        insFC.run(wo.id, wf.fid, wf.fabric_code, batch ? batch.po_id : null, batch ? batch.id : null,
          +(wf.actual_meters * 1.05).toFixed(2), wf.actual_meters,
          ppm, +(wf.actual_meters * ppm).toFixed(2), null, userIds[0], recordDate, recordDate);
      }

      // Accessory consumption
      const woAccs = db.prepare('SELECT wa.*, a.id as aid FROM wo_accessories wa JOIN accessories a ON a.code=wa.accessory_code WHERE wa.wo_id=?').all(wo.id);
      for (const wa of woAccs) {
        if (!wa.quantity || wa.quantity <= 0) continue;
        const priceRow = db.prepare('SELECT unit_price FROM accessories WHERE code=?').get(wa.accessory_code);
        const up = priceRow ? priceRow.unit_price : 1;
        insAC.run(wo.id, wa.aid, wa.accessory_code, Math.ceil(wa.quantity * 1.05), wa.quantity, up, +(wa.quantity * up).toFixed(2), recordDate);
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM wo_fabric_consumption').get().c} fabric consumption, ${db.prepare('SELECT COUNT(*) as c FROM wo_accessory_consumption').get().c} accessory consumption`);
  } catch (e) { console.log('    ⚠ Skipping WO consumption:', e.message); }

  // ─── 32c. WO SIZES ────────────────────────────────
  console.log('  → Seeding WO sizes...');
  try {
    const insWS = db.prepare(`INSERT OR IGNORE INTO wo_sizes (wo_id, color_label, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl) VALUES (?,?,?,?,?,?,?,?)`);
    for (const woNum of Object.keys(woMap)) {
      const wo = woMap[woNum];
      const q = wo.qty;
      // Distribute sizes (rough realistic bell-curve)
      const s = Math.round(q * 0.10), m = Math.round(q * 0.25), l = Math.round(q * 0.25);
      const xl = Math.round(q * 0.20), xxl = Math.round(q * 0.12);
      const xxxl = q - s - m - l - xl - xxl;
      insWS.run(wo.id, 'لون أساسي', s, m, l, xl, xxl, xxxl);
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM wo_sizes').get().c} WO size records`);
  } catch (e) { console.log('    ⚠ Skipping WO sizes:', e.message); }

  // ─── 32d. PARTIAL INVOICES ────────────────────────
  console.log('  → Seeding partial invoices...');
  try {
    const insPI = db.prepare(`INSERT OR IGNORE INTO partial_invoices (wo_id, invoice_id, pieces_invoiced, cost_per_piece, invoice_price_per_piece, notes, created_at) VALUES (?,?,?,?,?,?,?)`);
    // For some completed WOs that have invoices, add partial invoice records
    for (const inv of INVOICES) {
      const woData = woMap[inv.wo];
      if (!woData) continue;
      const invRow = db.prepare('SELECT id FROM invoices WHERE invoice_number=?').get(inv.num);
      if (!invRow) continue;
      const mm = MODELS.find(m => m.code === woData.modelCode);
      const costPP = mm ? +(mm.unitPrice * 0.65).toFixed(2) : 60;
      const invPricePP = mm ? mm.unitPrice : 100;
      const pieces = inv.shipped > 0 ? inv.shipped : woData.qty;
      insPI.run(woData.id, invRow.id, pieces, costPP, invPricePP, null, dt(addDays(SEED_START, 30)));
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM partial_invoices').get().c} partial invoices`);
  } catch (e) { console.log('    ⚠ Skipping partial invoices:', e.message); }

  // ─── 33. WAREHOUSE ZONES ───────────────────────────
  console.log('  → Seeding warehouse zones...');
  try {
    const whRow = db.prepare('SELECT id FROM warehouses LIMIT 1').get();
    if (whRow) {
      const insZone = db.prepare(`INSERT OR IGNORE INTO warehouse_zones (warehouse_id, code, name, zone_type, created_at) VALUES (?,?,?,?,?)`);
      const zones = [
        { code: 'Z-FAB', name: 'منطقة الأقمشة', type: 'raw_material' },
        { code: 'Z-ACC', name: 'منطقة الإكسسوارات', type: 'raw_material' },
        { code: 'Z-WIP', name: 'منطقة تحت التشغيل', type: 'wip' },
        { code: 'Z-FG', name: 'منطقة المنتجات الجاهزة', type: 'finished_goods' },
        { code: 'Z-SHIP', name: 'منطقة الشحن', type: 'shipping' },
      ];
      for (const z of zones) {
        insZone.run(whRow.id, z.code, z.name, z.type, dt(addDays(SEED_START, -60)));
      }
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM warehouse_zones').get().c} warehouse zones`);
  } catch (e) { console.log('    ⚠ Skipping warehouse zones:', e.message); }

  // ─── 34. DOCUMENTS ─────────────────────────────────
  console.log('  → Seeding documents...');
  try {
    const insDoc = db.prepare(`INSERT OR IGNORE INTO documents (entity_type, entity_id, file_name, file_path, file_type, file_size, category, description, uploaded_by, created_at, title) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const docDefs = [
      { entity: 'purchase_order', id: 1, name: 'PO-2026-001.pdf', path: '/uploads/documents/PO-2026-001.pdf', type: 'application/pdf', size: 45000, cat: 'purchase_order', desc: 'أمر شراء — نسيج النيل', title: 'أمر شراء PO-2026-001' },
      { entity: 'invoice', id: 1, name: 'INV-2026-001.pdf', path: '/uploads/documents/INV-2026-001.pdf', type: 'application/pdf', size: 32000, cat: 'invoice', desc: 'فاتورة بيع', title: 'فاتورة INV-2026-001' },
      { entity: 'work_order', id: 1, name: 'WO-spec-001.pdf', path: '/uploads/documents/WO-spec-001.pdf', type: 'application/pdf', size: 128000, cat: 'specification', desc: 'مواصفات أمر شغل', title: 'مواصفات WO-2026-001' },
      { entity: 'customer', id: 4, name: 'export-license.pdf', path: '/uploads/documents/export-license.pdf', type: 'application/pdf', size: 95000, cat: 'license', desc: 'رخصة تصدير — شركة تصدير الملابس', title: 'رخصة تصدير' },
      { entity: 'supplier', id: 1, name: 'supplier-contract.pdf', path: '/uploads/documents/supplier-contract.pdf', type: 'application/pdf', size: 78000, cat: 'contract', desc: 'عقد توريد سنوي', title: 'عقد توريد — نسيج النيل' },
    ];
    for (const d of docDefs) {
      insDoc.run(d.entity, d.id, d.name, d.path, d.type, d.size, d.cat, d.desc, userIds[0], dt(addDays(SEED_START, randInt(0, 30))), d.title);
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM documents').get().c} documents`);
  } catch (e) { console.log('    ⚠ Skipping documents:', e.message); }

  // ─── 35. BOM TEMPLATE SIZES ────────────────────────
  console.log('  → Seeding BOM template sizes...');
  try {
    const insBomSize = db.prepare(`INSERT OR IGNORE INTO bom_template_sizes (template_id, color_label, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl) VALUES (?,?,?,?,?,?,?,?)`);
    // Add size breakdown for MOD-001 (shirt) and MOD-002 (pants)
    const tmplMod1 = db.prepare("SELECT bt.id FROM bom_templates bt JOIN models m ON bt.model_id=m.id WHERE m.model_code='MOD-001' LIMIT 1").get();
    const tmplMod2 = db.prepare("SELECT bt.id FROM bom_templates bt JOIN models m ON bt.model_id=m.id WHERE m.model_code='MOD-002' LIMIT 1").get();
    if (tmplMod1) {
      insBomSize.run(tmplMod1.id, 'أبيض', 30, 50, 40, 30, 20, 10);
      insBomSize.run(tmplMod1.id, 'أزرق فاتح', 20, 40, 35, 25, 15, 5);
    }
    if (tmplMod2) {
      insBomSize.run(tmplMod2.id, 'كحلي', 25, 45, 40, 30, 20, 10);
      insBomSize.run(tmplMod2.id, 'بيج', 20, 35, 30, 25, 15, 5);
    }
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM bom_template_sizes').get().c} BOM sizes`);
  } catch (e) { console.log('    ⚠ Skipping BOM sizes:', e.message); }

  // ─── 36. REPORT SCHEDULES ─────────────────────────
  console.log('  → Seeding report schedules...');
  try {
    const insRS = db.prepare(`INSERT OR IGNORE INTO report_schedules (name, report_type, frequency, day_of_week, day_of_month, hour, recipients, filters, format, enabled, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    insRS.run('تقرير المبيعات الأسبوعي', 'sales', 'weekly', 0, null, 9, JSON.stringify(['admin@fabric.local', 'wessam@fabric.local']), null, 'xlsx', 1, userIds[0], dt(addDays(SEED_START, 5)));
    insRS.run('تقرير المخزون الشهري', 'inventory', 'monthly', null, 1, 8, JSON.stringify(['admin@fabric.local']), null, 'xlsx', 1, userIds[0], dt(addDays(SEED_START, 5)));
    insRS.run('تقرير الإنتاج اليومي', 'production', 'daily', null, null, 18, JSON.stringify(['manager@fabric.local']), null, 'csv', 1, userIds[0], dt(addDays(SEED_START, 5)));
    console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM report_schedules').get().c} report schedules`);
  } catch (e) { console.log('    ⚠ Skipping report schedules:', e.message); }

  // ─── CURRENT-MONTH DATA ─────────────────────────
  // Move some completed WOs and paid invoices into the current month
  // so dashboard KPIs (monthly_revenue, completed_this_month) show real data
  console.log('  → Adjusting dates for current-month dashboard visibility...');
  const now = new Date();
  const thisMonth1 = new Date(now.getFullYear(), now.getMonth(), 1);
  const recentDate1 = dd(addDays(thisMonth1, 2));  // 3rd of current month
  const recentDate2 = dd(addDays(thisMonth1, 4));  // 5th of current month
  const recentDt1 = dt(addDays(thisMonth1, 2));
  const recentDt2 = dt(addDays(thisMonth1, 4));

  // Move WO-2026-011 and WO-2026-012 completed_date into current month
  db.prepare("UPDATE work_orders SET completed_date=?, updated_at=? WHERE wo_number='WO-2026-011'").run(recentDate1, recentDt1);
  db.prepare("UPDATE work_orders SET completed_date=?, updated_at=? WHERE wo_number='WO-2026-012'").run(recentDate2, recentDt2);

  // Move their invoices (INV-2026-003, INV-2026-004) created_at into current month so monthly_revenue picks them up
  db.prepare("UPDATE invoices SET created_at=?, updated_at=? WHERE invoice_number='INV-2026-003'").run(recentDt1, recentDt1);
  db.prepare("UPDATE invoices SET created_at=?, updated_at=? WHERE invoice_number='INV-2026-004'").run(recentDt2, recentDt2);

  // Also move the partially_paid invoice (INV-2026-006) into current month
  const recentDate3 = dd(addDays(thisMonth1, 6));
  const recentDt3 = dt(addDays(thisMonth1, 6));
  db.prepare("UPDATE invoices SET created_at=?, updated_at=? WHERE invoice_number='INV-2026-006'").run(recentDt3, recentDt3);

  // Move payment dates for those invoices too
  const inv3Row = db.prepare("SELECT id FROM invoices WHERE invoice_number='INV-2026-003'").get();
  const inv4Row = db.prepare("SELECT id FROM invoices WHERE invoice_number='INV-2026-004'").get();
  const inv6Row = db.prepare("SELECT id FROM invoices WHERE invoice_number='INV-2026-006'").get();
  if (inv3Row) db.prepare("UPDATE customer_payments SET payment_date=? WHERE invoice_id=?").run(recentDate1, inv3Row.id);
  if (inv4Row) db.prepare("UPDATE customer_payments SET payment_date=? WHERE invoice_id=?").run(recentDate2, inv4Row.id);
  if (inv6Row) db.prepare("UPDATE customer_payments SET payment_date=? WHERE invoice_id=?").run(recentDate3, inv6Row.id);

  // Move some expenses into current month for total_expenses_this_month
  const recentExpDate = dd(addDays(thisMonth1, 1));
  db.prepare("UPDATE expenses SET expense_date=? WHERE id IN (SELECT id FROM expenses WHERE status='approved' AND is_deleted=0 LIMIT 5)").run(recentExpDate);

  // Add attendance for today
  const todayStr = dd(now);
  const insAtt2 = db.prepare(`INSERT OR IGNORE INTO attendance (employee_id, work_date, attendance_status, actual_hours, scheduled_hours, notes) VALUES (?,?,?,?,?,?)`);
  const empIds2 = db.prepare('SELECT id FROM employees LIMIT 6').all();
  empIds2.forEach(e => {
    insAtt2.run(e.id, todayStr, 'present', 8, 8, null);
  });

  // Add payroll period for current month
  const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currMonthName = now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  db.prepare("INSERT OR IGNORE INTO payroll_periods (period_month, period_name, status, total_gross, total_net, total_deductions) VALUES (?,?,?,?,?,?)")
    .run(currMonthStr, currMonthName, 'open', 0, 0, 0);

  console.log(`    ✓ Moved 2 completed WOs + 2 invoices into current month (${currMonthStr})`);
  console.log(`    ✓ Added ${empIds2.length} attendance records for today (${todayStr})`);

  // Update total_production_cost on all WOs from cost_snapshots
  const woCosts = db.prepare(`
    SELECT wo_id, SUM(total_cost) as total_cost FROM cost_snapshots GROUP BY wo_id
  `).all();
  const updWOCost = db.prepare('UPDATE work_orders SET total_production_cost=? WHERE id=?');
  for (const wc of woCosts) {
    updWOCost.run(Math.round(wc.total_cost * 100) / 100, wc.wo_id);
  }
  console.log(`    ✓ Updated production costs on ${woCosts.length} work orders`);
  // ═══════════════════════════════════════════════════
  // SEED VERIFICATION ASSERTIONS
  // ═══════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  SEED VERIFICATION');
  console.log('═══════════════════════════════════════════════════\n');

  const summary = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    suppliers: db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c,
    fabrics: db.prepare('SELECT COUNT(*) as c FROM fabrics').get().c,
    accessories: db.prepare('SELECT COUNT(*) as c FROM accessories').get().c,
    customers: db.prepare('SELECT COUNT(*) as c FROM customers').get().c,
    models: db.prepare('SELECT COUNT(*) as c FROM models').get().c,
    purchase_orders: db.prepare('SELECT COUNT(*) as c FROM purchase_orders').get().c,
    work_orders: db.prepare('SELECT COUNT(*) as c FROM work_orders').get().c,
    invoices: db.prepare('SELECT COUNT(*) as c FROM invoices').get().c,
    fabric_total_meters: db.prepare('SELECT ROUND(SUM(available_meters),2) as c FROM fabrics').get().c,
    accessory_total_units: db.prepare('SELECT ROUND(SUM(quantity_on_hand),2) as c FROM accessories').get().c,
    wo_by_status: db.prepare("SELECT status, COUNT(*) as c FROM work_orders GROUP BY status").all(),
    invoiced_total: db.prepare("SELECT ROUND(SUM(total),2) as c FROM invoices WHERE status IN ('paid','sent','partially_paid')").get().c,
    cost_snapshots: db.prepare('SELECT COUNT(*) as c FROM cost_snapshots').get().c,
    wo_fabrics: db.prepare('SELECT COUNT(*) as c FROM wo_fabrics').get().c,
    wo_accessories: db.prepare('SELECT COUNT(*) as c FROM wo_accessories').get().c,
    payroll_periods: db.prepare('SELECT COUNT(*) as c FROM payroll_periods').get().c,
    payroll_records: db.prepare('SELECT COUNT(*) as c FROM payroll_records').get().c,
    shipments: db.prepare('SELECT COUNT(*) as c FROM shipments').get().c,
    notifications: db.prepare('SELECT COUNT(*) as c FROM notifications').get().c,
    subcontracted_wos: db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE is_subcontracted=1").get().c,
    supplier_payments: (() => { try { return db.prepare('SELECT COUNT(*) as c FROM supplier_payments').get().c; } catch(e) { return 0; } })(),
  };

  console.log('\n✅ SEED SUMMARY:\n', JSON.stringify(summary, null, 2));

  // Assertions
  console.assert(summary.suppliers >= 8, '❌ Expected >= 8 suppliers');
  console.assert(summary.fabrics >= 12, '❌ Expected >= 12 fabrics');
  console.assert(summary.accessories >= 15, '❌ Expected >= 15 accessories');
  console.assert(summary.customers >= 6, '❌ Expected >= 6 customers');
  console.assert(summary.models >= 6, '❌ Expected >= 6 models');
  console.assert(summary.work_orders >= 18, '❌ Expected >= 18 work orders');
  console.assert(summary.purchase_orders >= 12, '❌ Expected >= 12 purchase orders');
  console.assert(summary.invoices >= 10, '❌ Expected >= 10 invoices');
  console.assert(summary.fabric_total_meters > 0, '❌ Fabric inventory must not be zero');
  console.assert(summary.cost_snapshots >= 10, '❌ Expected >= 10 cost snapshots');
  console.assert(summary.wo_fabrics >= 10, '❌ Expected >= 10 wo_fabrics records');
  console.assert(summary.wo_accessories >= 10, '❌ Expected >= 10 wo_accessories records');
  console.assert(summary.payroll_periods >= 3, '❌ Expected >= 3 payroll periods');
  console.assert(summary.payroll_records >= 15, '❌ Expected >= 15 payroll records');

  // Verify no negative fabric meters
  const fabrics = db.prepare('SELECT code, available_meters FROM fabrics').all();
  fabrics.forEach(f => {
    console.assert(f.available_meters >= 0, `❌ Fabric ${f.code} has negative available_meters: ${f.available_meters}`);
  });

  // Verify no negative accessory quantities
  const accs = db.prepare('SELECT code, quantity_on_hand FROM accessories').all();
  accs.forEach(a => {
    console.assert(a.quantity_on_hand >= 0, `❌ Accessory ${a.code} has negative quantity_on_hand: ${a.quantity_on_hand}`);
  });

  // Verify completed WOs have completed_date
  const badCompletedWOs = db.prepare("SELECT COUNT(*) as c FROM work_orders WHERE status='completed' AND completed_date IS NULL").get().c;
  console.assert(badCompletedWOs === 0, `❌ ${badCompletedWOs} completed WOs missing completed_date`);

  // Verify no negative invoices
  const negInv = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE total < 0").get().c;
  console.assert(negInv === 0, '❌ Found invoices with negative totals');

  console.log('\n✅ All seed assertions passed');

  // Login credentials info
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  LOGIN CREDENTIALS');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Username: admin     | Password: 123456 (superadmin)');
  console.log('  Username: wessam    | Password: 123456 (superadmin)');
  console.log('  Username: manager   | Password: 123456 (manager)');
  console.log('  Username: viewer    | Password: 123456 (viewer)');
  console.log('═══════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════
try {
  seed();
} catch (err) {
  console.error('❌ SEED FAILED:', err);
  process.exit(1);
}
