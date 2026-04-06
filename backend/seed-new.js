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
  { num: 'WO-2026-007', cust: 'CUS-006', model: 'MOD-006', qty: 80,   status: 'in_progress', priority: 'high',   stages: [80,80,80,80,80,0],        startOff: 8,  dueOff: 32  },
  { num: 'WO-2026-008', cust: 'CUS-002', model: 'MOD-001', qty: 400,  status: 'in_progress', priority: 'urgent', stages: [400,350,200,0,0,0],       startOff: 25, dueOff: 55  },
  { num: 'WO-2026-009', cust: 'CUS-001', model: 'MOD-003', qty: 180,  status: 'pending',     priority: 'normal', stages: [0,0,0,0,0,0],             startOff: 60, dueOff: 80  },
  { num: 'WO-2026-010', cust: 'CUS-003', model: 'MOD-002', qty: 220,  status: 'in_progress', priority: 'normal', stages: [220,220,220,200,200,180], startOff: 12, dueOff: 38  },
  { num: 'WO-2026-011', cust: 'CUS-004', model: 'MOD-004', qty: 600,  status: 'completed',   priority: 'high',   stages: [600,600,500,400,400,400], startOff: 2,  dueOff: 30  },
  { num: 'WO-2026-012', cust: 'CUS-001', model: 'MOD-006', qty: 60,   status: 'completed',   priority: 'normal', stages: [60,60,60,60,60,60],       startOff: 18, dueOff: 42  },
  { num: 'WO-2026-013', cust: 'CUS-006', model: 'MOD-005', qty: 300,  status: 'in_progress', priority: 'normal', stages: [300,200,0,0,0,0],         startOff: 30, dueOff: 60, pauseNote: 'انتظار وصول بطانة من المورد' },
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
  const insWO = db.prepare(`INSERT OR IGNORE INTO work_orders (wo_number, model_id, template_id, status, priority, quantity, start_date, due_date, completed_date, masnaiya, masrouf, margin_pct, consumer_price, wholesale_price, customer_id, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insWOStage = db.prepare(`INSERT OR IGNORE INTO wo_stages (wo_id, stage_name, sort_order, status, quantity_in_stage, quantity_completed, quantity_rejected, started_at, completed_at, machine_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insWOFabBatch = db.prepare(`INSERT OR IGNORE INTO wo_fabric_batches (wo_id, batch_id, fabric_code, role, planned_meters_per_piece, planned_total_meters, waste_pct, actual_total_meters, actual_meters_per_piece, waste_meters, waste_cost, price_per_meter, planned_cost, actual_cost, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insWOAccDetail = db.prepare(`INSERT OR IGNORE INTO wo_accessories_detail (wo_id, accessory_code, accessory_name, quantity_per_piece, unit_price, planned_total_cost, actual_quantity, actual_cost, notes) VALUES (?,?,?,?,?,?,?,?,?)`);

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

    insWO.run(wo.num, mm.id, mm.tmplId, wo.status, wo.priority, wo.qty,
      dd(startDate), dd(dueDate), completedDate ? dd(completedDate) : null,
      masnaiya, masrouf, marginPct, cp, wp, custRow.id, notes, created, created);

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

  // ─── 13. JOURNAL ENTRIES ────────────────────────
  console.log('  → Seeding journal entries...');
  // Ensure chart of accounts exists
  const insCoA = db.prepare(`INSERT OR IGNORE INTO chart_of_accounts (code, name_ar, type, is_active, created_at) VALUES (?,?,?,1,datetime('now'))`);
  const accounts = [
    { code: '1100', name: 'المخزون — أقمشة', type: 'asset' },
    { code: '1200', name: 'المخزون — إكسسوارات', type: 'asset' },
    { code: '1300', name: 'الحسابات المدينة (العملاء)', type: 'asset' },
    { code: '1400', name: 'النقدية والبنوك', type: 'asset' },
    { code: '2100', name: 'الحسابات الدائنة (الموردين)', type: 'liability' },
    { code: '4100', name: 'إيرادات المبيعات', type: 'revenue' },
    { code: '5100', name: 'تكلفة البضاعة المباعة', type: 'expense' },
    { code: '5200', name: 'مصروفات عمومية', type: 'expense' },
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
        const invAcctCode = po.type === 'fabric' ? '1300' : '1300';
        const invAcct = acctId(invAcctCode);
        const apAcct = acctId('2100') || acctId('2000');
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
        const arAcct = acctId('1200') || acctId('1300');
        const revAcct = acctId('4000') || acctId('4100');
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
        const cashAcct = acctId('1000') || acctId('1100');
        const arAcct = acctId('1200') || acctId('1300');
        if (cashAcct) insJELine.run(jeRow.id, cashAcct, payAmount, 0, `نقدية — ${inv.num}`);
        if (arAcct) insJELine.run(jeRow.id, arAcct, 0, payAmount, `عملاء — ${inv.num}`);
      }
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
    const modules = ['fabrics', 'accessories', 'customers', 'suppliers', 'models', 'workorders', 'invoices', 'purchaseorders', 'hr', 'machines', 'expenses', 'reports', 'exports', 'quality', 'settings', 'users', 'auditlog'];
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
