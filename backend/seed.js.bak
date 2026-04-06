/**
 * WK-Hub Comprehensive Seed Script
 * Generates 3 months of realistic production data for a garment factory ERP
 * Period: January 1, 2026 – March 25, 2026
 */

const db = require('./database');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const pathMod = require('path');

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
const START = new Date('2026-01-01');
const END   = new Date('2026-04-03');

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
function isWeekday(d) { const day = d.getDay(); return day !== 5 && day !== 6; } // Egypt: Fri+Sat weekend
function pad(n, len = 4) { return String(n).padStart(len, '0'); }

// ─── MINIMAL PNG GENERATOR (no dependencies) ──
// Creates a small 64×64 solid-color PNG for seed image testing
function makePNG(r, g, b) {
  // Raw pixel data: 64 rows, each row = filter byte (0) + 64 pixels × 3 bytes (RGB)
  const W = 64, H = 64;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const off = y * (1 + W * 3);
    raw[off] = 0; // filter byte
    for (let x = 0; x < W; x++) {
      const px = off + 1 + x * 3;
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b;
    }
  }
  const zlib = require('zlib');
  const deflated = zlib.deflateSync(raw);
  // Build PNG file
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const tp = Buffer.from(type, 'ascii');
    const body = Buffer.concat([tp, data]);
    const crc32buf = Buffer.alloc(4);
    let crc = crc32(body);
    crc32buf.writeInt32BE(crc);
    return Buffer.concat([len, body, crc32buf]);
  }
  // CRC32 table
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
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const iend = Buffer.alloc(0);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', iend)]);
}

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

// Showcase work orders with specific stage breakdowns
const SHOWCASE_WOS = [
  {
    label: 'عباية سوداء - إنتاج كبير',
    model_code: 'ABY-001', quantity: 200, priority: 'urgent', status: 'in_progress',
    stages: [
      { name: 'استلام قماش', status: 'completed', in_stage: 0, completed: 200, rejected: 0 },
      { name: 'قص',          status: 'completed', in_stage: 0, completed: 200, rejected: 2 },
      { name: 'خياطة',       status: 'in_progress', in_stage: 100, completed: 98, rejected: 0 },
      { name: 'تشطيب',      status: 'in_progress', in_stage: 48, completed: 50, rejected: 0 },
      { name: 'كي',          status: 'in_progress', in_stage: 50, completed: 0, rejected: 0 },
      { name: 'تغليف',      status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'مراجعة جودة', status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'تسليم',      status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
    ],
  },
  {
    label: 'تيشيرت قطن - شبه مكتمل',
    model_code: 'TSH-001', quantity: 300, priority: 'high', status: 'in_progress',
    stages: [
      { name: 'استلام قماش', status: 'completed', in_stage: 0, completed: 300, rejected: 0 },
      { name: 'قص',          status: 'completed', in_stage: 0, completed: 300, rejected: 3 },
      { name: 'خياطة',       status: 'completed', in_stage: 0, completed: 297, rejected: 5 },
      { name: 'تشطيب',      status: 'completed', in_stage: 0, completed: 292, rejected: 0 },
      { name: 'كي',          status: 'completed', in_stage: 0, completed: 292, rejected: 0 },
      { name: 'تغليف',      status: 'completed', in_stage: 0, completed: 292, rejected: 0 },
      { name: 'مراجعة جودة', status: 'in_progress', in_stage: 142, completed: 150, rejected: 2 },
      { name: 'تسليم',      status: 'in_progress', in_stage: 0, completed: 100, rejected: 0 },
    ],
  },
  {
    label: 'فستان سواريه - بداية إنتاج',
    model_code: 'DRS-003', quantity: 80, priority: 'high', status: 'in_progress',
    stages: [
      { name: 'استلام قماش', status: 'completed', in_stage: 0, completed: 80, rejected: 0 },
      { name: 'قص',          status: 'in_progress', in_stage: 30, completed: 50, rejected: 1 },
      { name: 'خياطة',       status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'تشطيب',      status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'كي',          status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'تغليف',      status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'مراجعة جودة', status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'تسليم',      status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
    ],
  },
  {
    label: 'جاكيت جينز - معلق (مشكلة مواد)',
    model_code: 'JKT-002', quantity: 150, priority: 'normal', status: 'in_progress',
    stages: [
      { name: 'استلام قماش', status: 'completed', in_stage: 0, completed: 150, rejected: 0 },
      { name: 'قص',          status: 'completed', in_stage: 0, completed: 148, rejected: 2 },
      { name: 'خياطة',       status: 'in_progress', in_stage: 60, completed: 88, rejected: 3 },
      { name: 'تشطيب',      status: 'in_progress', in_stage: 35, completed: 50, rejected: 0 },
      { name: 'كي',          status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'تغليف',      status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'مراجعة جودة', status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
      { name: 'تسليم',      status: 'pending',   in_stage: 0, completed: 0, rejected: 0 },
    ],
  },
  {
    label: 'يونيفورم مدرسي - مكتمل بالكامل',
    model_code: 'UNF-001', quantity: 500, priority: 'normal', status: 'completed',
    stages: [
      { name: 'استلام قماش', status: 'completed', in_stage: 0, completed: 500, rejected: 0 },
      { name: 'قص',          status: 'completed', in_stage: 0, completed: 500, rejected: 5 },
      { name: 'خياطة',       status: 'completed', in_stage: 0, completed: 495, rejected: 8 },
      { name: 'تشطيب',      status: 'completed', in_stage: 0, completed: 487, rejected: 0 },
      { name: 'كي',          status: 'completed', in_stage: 0, completed: 487, rejected: 0 },
      { name: 'تغليف',      status: 'completed', in_stage: 0, completed: 487, rejected: 0 },
      { name: 'مراجعة جودة', status: 'completed', in_stage: 0, completed: 485, rejected: 2 },
      { name: 'تسليم',      status: 'completed', in_stage: 0, completed: 485, rejected: 0 },
    ],
  },
];

// ═══════════════════════════════════════════════════
// REALISTIC DATA POOLS
// ═══════════════════════════════════════════════════

const SUPPLIER_DATA = [
  { code: 'SUP-001', name: 'مصنع النسيج المصري', type: 'fabric',    phone: '01001234567', email: 'info@egyptian-textile.com', address: 'المنطقة الصناعية، العاشر من رمضان',  contact: 'أحمد محمود',   terms: 'صافي 30 يوم', rating: 5 },
  { code: 'SUP-002', name: 'شركة الأقمشة الدولية', type: 'fabric',   phone: '01112345678', email: 'sales@intl-fabrics.com',    address: 'شارع الجمهورية، الإسكندرية',       contact: 'محمد حسن',     terms: 'صافي 45 يوم', rating: 4 },
  { code: 'SUP-003', name: 'واردات الحرير',       type: 'fabric',    phone: '01223456789', email: 'silk@imports.com',          address: 'شارع الأزهر، القاهرة',             contact: 'ياسر عبدالله', terms: 'دفع مقدم',    rating: 4 },
  { code: 'SUP-004', name: 'مصنع الكتان',         type: 'fabric',    phone: '01098765432', email: 'linen@factory.com',         address: 'طنطا، الغربية',                     contact: 'عمر خالد',     terms: 'صافي 30 يوم', rating: 3 },
  { code: 'SUP-005', name: 'مصانع الجينز',        type: 'fabric',    phone: '01556789012', email: 'denim@mills.com',           address: 'المحلة الكبرى، الغربية',            contact: 'حسام فاروق',   terms: 'صافي 60 يوم', rating: 5 },
  { code: 'SUP-006', name: 'شركة الصوف',          type: 'fabric',    phone: '01234567890', email: 'wool@company.com',          address: 'بورسعيد',                           contact: 'سامي إبراهيم', terms: 'صافي 30 يوم', rating: 4 },
  { code: 'SUP-007', name: 'مصنع البطائن',        type: 'fabric',    phone: '01067890123', email: 'lining@factory.com',        address: 'شبرا الخيمة، القليوبية',            contact: 'رامي عادل',    terms: 'صافي 15 يوم', rating: 3 },
  { code: 'SUP-008', name: 'مصنع الأزرار والسوست', type: 'accessory', phone: '01178901234', email: 'buttons@factory.com',      address: 'الوراق، الجيزة',                    contact: 'طارق سعيد',    terms: 'صافي 15 يوم', rating: 4 },
  { code: 'SUP-009', name: 'مصنع الخيوط الذهبية',  type: 'accessory', phone: '01289012345', email: 'threads@golden.com',       address: 'المنصورة، الدقهلية',                contact: 'وليد مصطفى',   terms: 'نقدي',        rating: 5 },
  { code: 'SUP-010', name: 'شركة المستلزمات المتحدة', type: 'both',  phone: '01590123456', email: 'supplies@united.com',       address: 'مدينة نصر، القاهرة',                contact: 'خالد نبيل',    terms: 'صافي 30 يوم', rating: 4 },
  { code: 'SUP-011', name: 'مصنع الفازلين والحشو',  type: 'accessory', phone: '01034567890', email: 'interfacing@padco.com',   address: 'السادس من أكتوبر، الجيزة',          contact: 'هاني جمال',    terms: 'صافي 15 يوم', rating: 3 },
  { code: 'SUP-012', name: 'مصنع الليبلات والتغليف', type: 'accessory', phone: '01145678901', email: 'labels@packco.com',      address: 'العبور، القليوبية',                  contact: 'أيمن فوزي',    terms: 'صافي 30 يوم', rating: 4 },
];

const CUSTOMER_DATA = [
  { code: 'CUST-001', name: 'بوتيك الأناقة',          phone: '01001112233', email: 'elegance@boutique.com',  address: 'الزمالك، القاهرة',      city: 'القاهرة',     type: 'wholesale', terms: 'صافي 30 يوم', limit: 100000 },
  { code: 'CUST-002', name: 'مول فاشن سيتي',          phone: '01112223344', email: 'info@fashioncity.com',   address: 'التجمع الخامس، القاهرة', city: 'القاهرة',     type: 'wholesale', terms: 'صافي 45 يوم', limit: 200000 },
  { code: 'CUST-003', name: 'شركة تصدير الملابس',     phone: '01223334455', email: 'export@garments.com',    address: 'الحي التجاري، الإسكندرية', city: 'الإسكندرية', type: 'wholesale', terms: 'صافي 60 يوم', limit: 500000 },
  { code: 'CUST-004', name: 'محلات السلطان',           phone: '01098887766', email: 'sultan@shops.com',       address: 'شارع فيصل، الجيزة',     city: 'الجيزة',      type: 'wholesale', terms: 'صافي 30 يوم', limit: 80000 },
  { code: 'CUST-005', name: 'ماركة ستايل مصر',        phone: '01556667788', email: 'style@egypt.com',        address: 'مدينة نصر، القاهرة',    city: 'القاهرة',     type: 'wholesale', terms: 'نقدي',        limit: 50000 },
  { code: 'CUST-006', name: 'سلسلة محلات النجمة',     phone: '01234445566', email: 'star@chain.com',         address: 'المنصورة، الدقهلية',    city: 'المنصورة',    type: 'wholesale', terms: 'صافي 30 يوم', limit: 150000 },
  { code: 'CUST-007', name: 'شركة الموضة العربية',    phone: '01067778899', email: 'arabfashion@co.com',     address: 'الدقي، الجيزة',         city: 'الجيزة',      type: 'wholesale', terms: 'صافي 45 يوم', limit: 300000 },
  { code: 'CUST-008', name: 'أحمد السيد - تاجر جملة', phone: '01178889900', email: 'ahmed.sayed@gmail.com',  address: 'الموسكي، القاهرة',      city: 'القاهرة',     type: 'retail',    terms: 'نقدي',        limit: 30000 },
  { code: 'CUST-009', name: 'دار الأزياء الحديثة',    phone: '01289990011', email: 'modern@fashionhouse.com', address: 'المعادي، القاهرة',      city: 'القاهرة',     type: 'wholesale', terms: 'صافي 30 يوم', limit: 120000 },
  { code: 'CUST-010', name: 'مصنع ملابس التصدير',     phone: '01590001122', email: 'export@factory.com',     address: 'بورسعيد',               city: 'بورسعيد',     type: 'wholesale', terms: 'صافي 60 يوم', limit: 400000 },
];

const EXTRA_FABRICS = [
  { code: 'CTN-003', name: 'قطن جيرسي',        type: 'main',   price: 105, color: 'وردي',     supplier_idx: 0 },
  { code: 'CTN-004', name: 'قطن بيكيه',         type: 'main',   price: 130, color: 'كحلي',     supplier_idx: 0 },
  { code: 'PLY-002', name: 'بوليستر تفتا',      type: 'main',   price: 75,  color: 'فضي',      supplier_idx: 1 },
  { code: 'PLY-003', name: 'بوليستر شيفون',     type: 'main',   price: 90,  color: 'سماوي',    supplier_idx: 1 },
  { code: 'SLK-002', name: 'حرير طبيعي',        type: 'main',   price: 320, color: 'ذهبي',     supplier_idx: 2 },
  { code: 'LNN-002', name: 'كتان مغسول',        type: 'main',   price: 195, color: 'زيتي',     supplier_idx: 3 },
  { code: 'DNM-002', name: 'جينز ستريتش',       type: 'main',   price: 125, color: 'أزرق غامق', supplier_idx: 4 },
  { code: 'DNM-003', name: 'جينز شامبري',       type: 'main',   price: 100, color: 'أزرق فاتح', supplier_idx: 4 },
  { code: 'WOL-002', name: 'صوف كشمير',         type: 'main',   price: 350, color: 'بيج',      supplier_idx: 5 },
  { code: 'WOL-003', name: 'صوف تويد',          type: 'main',   price: 220, color: 'بني',      supplier_idx: 5 },
  { code: 'CRP-002', name: 'كريب جورجيت',       type: 'main',   price: 165, color: 'أحمر',     supplier_idx: 1 },
  { code: 'VLV-002', name: 'قطيفة ناعمة',       type: 'both',   price: 190, color: 'أخضر زمردي', supplier_idx: 9 },
  { code: 'GBR-001', name: 'جبردين',            type: 'main',   price: 140, color: 'كاكي',     supplier_idx: 0 },
  { code: 'ORG-001', name: 'أورجانزا',          type: 'main',   price: 210, color: 'أبيض',     supplier_idx: 2 },
  { code: 'TUL-001', name: 'تول فرنسي',         type: 'main',   price: 160, color: 'أبيض',     supplier_idx: 2 },
  { code: 'FLN-001', name: 'فلانيل',            type: 'main',   price: 115, color: 'أحمر كاروه', supplier_idx: 0 },
  { code: 'LCR-001', name: 'ليكرا',             type: 'main',   price: 135, color: 'أسود',     supplier_idx: 1 },
  { code: 'TWL-001', name: 'قماش مناشف',        type: 'main',   price: 95,  color: 'أبيض',     supplier_idx: 0 },
  { code: 'LNG-004', name: 'بطانة تريكو',       type: 'lining', price: 40,  color: 'رمادي',    supplier_idx: 6 },
  { code: 'LNG-005', name: 'بطانة حرير صناعي',  type: 'lining', price: 60,  color: 'بيج',      supplier_idx: 6 },
  { code: 'NPN-001', name: 'نيوبرين',           type: 'main',   price: 175, color: 'أسود',     supplier_idx: 9 },
  { code: 'SQN-001', name: 'قماش ترتر',         type: 'main',   price: 280, color: 'ذهبي',     supplier_idx: 2 },
  { code: 'BRC-001', name: 'بروكار',            type: 'main',   price: 300, color: 'عنابي وذهبي', supplier_idx: 2 },
  { code: 'CTN-005', name: 'قطن عضوي',          type: 'main',   price: 155, color: 'طبيعي',    supplier_idx: 0 },
  { code: 'PLY-004', name: 'مايكروفايبر',        type: 'main',   price: 80,  color: 'أبيض',     supplier_idx: 1 },
  { code: 'CTN-006', name: 'بوبلين',            type: 'main',   price: 110, color: 'أزرق فاتح', supplier_idx: 0 },
  { code: 'CTN-007', name: 'قطن لاكوست',        type: 'main',   price: 125, color: 'أصفر',     supplier_idx: 0 },
  { code: 'WOL-004', name: 'صوف ميرينو',        type: 'main',   price: 280, color: 'كحلي',     supplier_idx: 5 },
];

const EXTRA_ACCESSORIES = [
  { code: 'BTN-003', type: 'button',       name: 'زرار خشب طبيعي',    price: 3,    unit: 'piece', supplier_idx: 7 },
  { code: 'BTN-004', type: 'button',       name: 'زرار معدني ذهبي',   price: 4,    unit: 'piece', supplier_idx: 7 },
  { code: 'BTN-005', type: 'button',       name: 'زرار كبسولة',       price: 1.5,  unit: 'piece', supplier_idx: 7 },
  { code: 'ZPR-003', type: 'zipper',       name: 'سوستة بلاستيك 30سم', price: 5,   unit: 'piece', supplier_idx: 7 },
  { code: 'ZPR-004', type: 'zipper',       name: 'سوستة YKK 60سم',    price: 18,   unit: 'piece', supplier_idx: 7 },
  { code: 'THR-002', type: 'thread',       name: 'خيط بوليستر أسود',   price: 15,   unit: 'roll',  supplier_idx: 8 },
  { code: 'THR-003', type: 'thread',       name: 'خيط حرير',          price: 35,   unit: 'roll',  supplier_idx: 8 },
  { code: 'THR-004', type: 'thread',       name: 'خيط تطريز',         price: 25,   unit: 'roll',  supplier_idx: 8 },
  { code: 'LBL-003', type: 'label',        name: 'ليبل غسيل',         price: 0.2,  unit: 'piece', supplier_idx: 11 },
  { code: 'LBL-004', type: 'label',        name: 'تاج سعر',           price: 0.15, unit: 'piece', supplier_idx: 11 },
  { code: 'ELS-001', type: 'elastic',      name: 'أستيك عريض 3سم',    price: 8,    unit: 'meter', supplier_idx: 9 },
  { code: 'ELS-002', type: 'elastic',      name: 'أستيك رفيع 1سم',    price: 4,    unit: 'meter', supplier_idx: 9 },
  { code: 'PKG-001', type: 'packaging',    name: 'كيس بولي شفاف',     price: 1,    unit: 'piece', supplier_idx: 11 },
  { code: 'PKG-002', type: 'packaging',    name: 'علبة كرتون ماركة',   price: 5,    unit: 'piece', supplier_idx: 11 },
  { code: 'PKG-003', type: 'packaging',    name: 'شماعة بلاستيك',     price: 2,    unit: 'piece', supplier_idx: 11 },
  { code: 'ITF-002', type: 'interfacing',  name: 'فازلين قماشي',      price: 25,   unit: 'meter', supplier_idx: 10 },
  { code: 'PAD-002', type: 'padding',      name: 'حشو صدر',           price: 5,    unit: 'piece', supplier_idx: 10 },
  { code: 'OTH-002', type: 'other',        name: 'ريفيت جينز',        price: 0.5,  unit: 'piece', supplier_idx: 7 },
  { code: 'OTH-003', type: 'other',        name: 'هوك وعروة',         price: 1,    unit: 'piece', supplier_idx: 7 },
  { code: 'OTH-004', type: 'other',        name: 'شريط لاصق حراري',   price: 12,   unit: 'meter', supplier_idx: 10 },
];

const EXTRA_MODELS = [
  { code: 'SHR-001', name: 'قميص رجالي كلاسيك',     cat: 'قمصان',   gender: 'male',   masnaiya: 60,  masrouf: 35, cp: 250,  wp: 190, notes: 'قميص رجالي بياقة كلاسيكية' },
  { code: 'SHR-002', name: 'قميص بولو',              cat: 'قمصان',   gender: 'male',   masnaiya: 50,  masrouf: 30, cp: 200,  wp: 155, notes: 'بولو شيرت بأكمام قصيرة' },
  { code: 'DRS-002', name: 'فستان كاجوال صيفي',      cat: 'فساتين',  gender: 'female', masnaiya: 70,  masrouf: 40, cp: 320,  wp: 250, notes: 'فستان كاجوال بطبعة زهور' },
  { code: 'DRS-003', name: 'فستان سواريه',           cat: 'فساتين',  gender: 'female', masnaiya: 150, masrouf: 80, cp: 850,  wp: 650, notes: 'فستان سواريه مطرز' },
  { code: 'PNT-002', name: 'بنطلون قماش رسمي',       cat: 'بنطلونات', gender: 'male',   masnaiya: 65,  masrouf: 35, cp: 300,  wp: 230, notes: 'بنطلون رسمي بكسرة أمامية' },
  { code: 'PNT-003', name: 'بنطلون كارغو',           cat: 'بنطلونات', gender: 'unisex', masnaiya: 75,  masrouf: 40, cp: 280,  wp: 215, notes: 'كارغو بجيوب جانبية' },
  { code: 'JKT-002', name: 'جاكيت جينز',            cat: 'جاكيتات', gender: 'unisex', masnaiya: 100, masrouf: 55, cp: 450,  wp: 350, notes: 'جاكيت جينز كلاسيكي' },
  { code: 'JKT-003', name: 'جاكيت بومبر',           cat: 'جاكيتات', gender: 'male',   masnaiya: 110, masrouf: 55, cp: 520,  wp: 400, notes: 'بومبر جاكيت بسوستة' },
  { code: 'SKR-001', name: 'تنورة ميدي',            cat: 'تنانير',   gender: 'female', masnaiya: 55,  masrouf: 30, cp: 220,  wp: 170, notes: 'تنورة أسفل الركبة' },
  { code: 'SKR-002', name: 'تنورة بليسيه',           cat: 'تنانير',   gender: 'female', masnaiya: 65,  masrouf: 35, cp: 260,  wp: 200, notes: 'تنورة بليسيه طويلة' },
  { code: 'BLZ-001', name: 'بلوزة شيفون',           cat: 'بلوزات',  gender: 'female', masnaiya: 45,  masrouf: 25, cp: 180,  wp: 140, notes: 'بلوزة شيفون بأكمام واسعة' },
  { code: 'BLZ-002', name: 'بلوزة كروشيه',          cat: 'بلوزات',  gender: 'female', masnaiya: 80,  masrouf: 35, cp: 280,  wp: 210, notes: 'بلوزة كروشيه يدوي' },
  { code: 'TSH-001', name: 'تيشيرت قطن',            cat: 'تيشيرتات', gender: 'unisex', masnaiya: 30,  masrouf: 20, cp: 120,  wp: 90,  notes: 'تيشيرت قطن أساسي' },
  { code: 'TSH-002', name: 'تيشيرت أوفر سايز',      cat: 'تيشيرتات', gender: 'unisex', masnaiya: 35,  masrouf: 22, cp: 150,  wp: 115, notes: 'تيشيرت أوفر سايز بطبعة' },
  { code: 'VES-001', name: 'فيست صوف',              cat: 'فيستات',  gender: 'male',   masnaiya: 85,  masrouf: 45, cp: 380,  wp: 290, notes: 'فيست صوف رسمي' },
  { code: 'ABY-001', name: 'عباية سوداء',            cat: 'عبايات',  gender: 'female', masnaiya: 80,  masrouf: 40, cp: 400,  wp: 300, notes: 'عباية كريب سوداء مطرزة' },
  { code: 'ABY-002', name: 'عباية ملونة',            cat: 'عبايات',  gender: 'female', masnaiya: 90,  masrouf: 45, cp: 450,  wp: 340, notes: 'عباية بألوان ربيعية' },
  { code: 'UNF-001', name: 'يونيفورم مدرسي',        cat: 'يونيفورم', gender: 'kids',   masnaiya: 40,  masrouf: 25, cp: 160,  wp: 120, notes: 'يونيفورم مدرسة ابتدائي' },
  { code: 'UNF-002', name: 'يونيفورم مصنع',         cat: 'يونيفورم', gender: 'unisex', masnaiya: 45,  masrouf: 28, cp: 180,  wp: 135, notes: 'يونيفورم عمال مصنع' },
  { code: 'COT-001', name: 'معطف شتوي',             cat: 'معاطف',   gender: 'unisex', masnaiya: 130, masrouf: 70, cp: 700,  wp: 540, notes: 'معطف شتوي ببطانة فرو' },
  { code: 'SET-001', name: 'طقم تراكسوت',           cat: 'أطقم',    gender: 'unisex', masnaiya: 80,  masrouf: 45, cp: 350,  wp: 270, notes: 'طقم تراكسوت رياضي' },
  { code: 'KDS-001', name: 'فستان أطفال',           cat: 'أطفال',   gender: 'kids',   masnaiya: 40,  masrouf: 22, cp: 160,  wp: 120, notes: 'فستان بناتي بفراشات' },
  { code: 'KDS-002', name: 'طقم أطفال ولادي',       cat: 'أطفال',   gender: 'kids',   masnaiya: 45,  masrouf: 25, cp: 180,  wp: 135, notes: 'طقم قميص وبنطلون أطفال' },
];

const MACHINE_DATA = [
  { code: 'MCH-001', name: 'ماكينة خياطة سنجر',   type: 'sewing',   brand: 'Singer',   model: 'S900',     price: 15000,  cap: 50,  cost: 8  },
  { code: 'MCH-002', name: 'ماكينة خياطة جوكي',   type: 'sewing',   brand: 'Juki',     model: 'DDL-8700', price: 25000,  cap: 60,  cost: 10 },
  { code: 'MCH-003', name: 'ماكينة أوفرلوك',      type: 'overlock', brand: 'Brother',  model: 'N800',     price: 18000,  cap: 80,  cost: 7  },
  { code: 'MCH-004', name: 'ماكينة أوفرلوك 5 خيط', type: 'overlock', brand: 'Juki',     model: 'MO-6800',  price: 30000,  cap: 70,  cost: 12 },
  { code: 'MCH-005', name: 'ماكينة قص أوتوماتيك', type: 'cutting',  brand: 'Eastman',  model: 'Brute',    price: 45000,  cap: 200, cost: 15 },
  { code: 'MCH-006', name: 'مكبس حراري',          type: 'pressing', brand: 'Hashima',  model: 'HP-450',   price: 35000,  cap: 100, cost: 12 },
  { code: 'MCH-007', name: 'ماكينة تطريز كمبيوتر', type: 'embroidery', brand: 'Tajima', model: 'TMEZ-SC',  price: 120000, cap: 30,  cost: 25 },
  { code: 'MCH-008', name: 'ماكينة عراوي',        type: 'buttonhole', brand: 'Juki',   model: 'LBH-1790', price: 40000,  cap: 120, cost: 8  },
  { code: 'MCH-009', name: 'ماكينة كي بخار',      type: 'steam',    brand: 'Veit',     model: '8363',     price: 20000,  cap: 80,  cost: 6  },
  { code: 'MCH-010', name: 'ماكينة خياطة فلاتلوك', type: 'flatlock', brand: 'Pegasus',  model: 'W500',     price: 22000,  cap: 55,  cost: 9  },
  { code: 'MCH-011', name: 'طاولة قص يدوي',       type: 'cutting',  brand: 'Custom',   model: 'CT-300',   price: 8000,   cap: 50,  cost: 3  },
  { code: 'MCH-012', name: 'ماكينة طباعة ليبلات', type: 'label',    brand: 'TSC',      model: 'TTP-345',  price: 12000,  cap: 500, cost: 2  },
];

const EMPLOYEE_DATA = [
  { code: 'EMP-001', name: 'محمد أحمد حسن',       dept: 'الإنتاج',     title: 'مشرف إنتاج',     type: 'full_time', salary: 8000, hire: '2024-03-15' },
  { code: 'EMP-002', name: 'فاطمة محمود السيد',    dept: 'الإنتاج',     title: 'خياطة أولى',     type: 'full_time', salary: 5500, hire: '2024-06-01' },
  { code: 'EMP-003', name: 'أحمد عبدالرحمن',      dept: 'الإنتاج',     title: 'عامل قص',       type: 'full_time', salary: 5000, hire: '2024-08-01' },
  { code: 'EMP-004', name: 'سارة خالد عبدالله',    dept: 'الإنتاج',     title: 'خياطة',          type: 'full_time', salary: 4500, hire: '2025-01-10' },
  { code: 'EMP-005', name: 'حسن إبراهيم محمد',    dept: 'الإنتاج',     title: 'عامل كي',       type: 'full_time', salary: 4000, hire: '2025-02-01' },
  { code: 'EMP-006', name: 'منى عادل حسين',       dept: 'الإنتاج',     title: 'عاملة تشطيب',    type: 'full_time', salary: 4200, hire: '2025-03-15' },
  { code: 'EMP-007', name: 'عمر سعيد فاروق',      dept: 'الإنتاج',     title: 'خياط',           type: 'full_time', salary: 5000, hire: '2025-04-01' },
  { code: 'EMP-008', name: 'نورهان محمد علي',      dept: 'الجودة',      title: 'مراقب جودة',     type: 'full_time', salary: 5500, hire: '2024-09-01' },
  { code: 'EMP-009', name: 'كريم طارق أحمد',      dept: 'المخزن',      title: 'أمين مخزن',      type: 'full_time', salary: 4500, hire: '2024-07-01' },
  { code: 'EMP-010', name: 'هبة مصطفى سالم',      dept: 'المحاسبة',    title: 'محاسبة',         type: 'full_time', salary: 7000, hire: '2024-04-01' },
  { code: 'EMP-011', name: 'يوسف وائل أنور',      dept: 'الإنتاج',     title: 'عامل تغليف',     type: 'full_time', salary: 3800, hire: '2025-06-01' },
  { code: 'EMP-012', name: 'رانيا حسام الدين',     dept: 'الإنتاج',     title: 'خياطة',          type: 'full_time', salary: 4500, hire: '2025-07-01' },
  { code: 'EMP-013', name: 'عبدالله جمال عوض',    dept: 'الصيانة',     title: 'فني صيانة',      type: 'full_time', salary: 6000, hire: '2024-10-01' },
  { code: 'EMP-014', name: 'ياسمين فوزي',         dept: 'الموارد البشرية', title: 'أخصائية HR',  type: 'full_time', salary: 6500, hire: '2025-01-01' },
  { code: 'EMP-015', name: 'مصطفى رضا',           dept: 'الإنتاج',     title: 'خياط',           type: 'daily',    salary: 250,  hire: '2025-09-01' },
  { code: 'EMP-016', name: 'آية حمدي',            dept: 'الإنتاج',     title: 'عاملة تشطيب',    type: 'daily',    salary: 200,  hire: '2025-10-01' },
  { code: 'EMP-017', name: 'إسلام نادر',          dept: 'الشحن',       title: 'عامل شحن',      type: 'full_time', salary: 4000, hire: '2025-08-01' },
  { code: 'EMP-018', name: 'دعاء السيد',          dept: 'الإنتاج',     title: 'خياطة',          type: 'full_time', salary: 4800, hire: '2025-05-01' },
  { code: 'EMP-019', name: 'تامر حسني',           dept: 'الإنتاج',     title: 'مشغل ماكينة تطريز', type: 'full_time', salary: 5500, hire: '2025-02-15' },
  { code: 'EMP-020', name: 'سمير عبدالعزيز',      dept: 'المخزن',      title: 'مساعد أمين مخزن', type: 'full_time', salary: 3800, hire: '2025-11-01' },
];

const USER_DATA = [
  { username: 'admin',    name: 'مدير النظام',      role: 'superadmin',  email: 'admin@wkhub.com',      empIdx: null },
  { username: 'wessam',   name: 'وسام خطاب',        role: 'superadmin',  email: 'wessam@wkhub.com',     empIdx: null },
  { username: 'mhamed',   name: 'محمد أحمد حسن',    role: 'production',  email: 'mhamed@wkhub.com',     empIdx: 0 },
  { username: 'heba',     name: 'هبة مصطفى سالم',   role: 'accountant',  email: 'heba@wkhub.com',       empIdx: 9 },
  { username: 'norhan',   name: 'نورهان محمد علي',   role: 'production',  email: 'norhan@wkhub.com',     empIdx: 7 },
  { username: 'yasmine',  name: 'ياسمين فوزي',      role: 'hr',          email: 'yasmine@wkhub.com',    empIdx: 13 },
  { username: 'viewer',   name: 'مستخدم عرض',       role: 'viewer',      email: 'viewer@wkhub.com',     empIdx: null },
  { username: 'manager',  name: 'مدير المصنع',       role: 'manager',     email: 'manager@wkhub.com',    empIdx: null },
];

// ═══════════════════════════════════════════════════
// SEED EXECUTION
// ═══════════════════════════════════════════════════

console.log('🏭 WK-Hub Seed: Starting comprehensive data generation...');
console.log(`📅 Period: ${dd(START)} → ${dd(END)} (≈3 months)`);
const t0 = Date.now();

// Wrap everything in a transaction for speed + atomicity
const seedAll = db.transaction(() => {

  // ─── 1. SUPPLIERS ─────────────────────────────
  console.log('  → Seeding suppliers...');
  const insSupplier = db.prepare(`INSERT OR IGNORE INTO suppliers (code, name, supplier_type, phone, email, address, contact_name, payment_terms, rating, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const supplierIds = {};
  for (const s of SUPPLIER_DATA) {
    const created = dt(addDays(START, -randInt(30, 365)));
    insSupplier.run(s.code, s.name, s.type, s.phone, s.email, s.address, s.contact, s.terms, s.rating, 'active', created);
    const row = db.prepare('SELECT id FROM suppliers WHERE code=?').get(s.code);
    if (row) supplierIds[s.code] = row.id;
  }
  console.log(`    ✓ ${Object.keys(supplierIds).length} suppliers`);

  // ─── 2. EXTRA FABRICS ─────────────────────────
  console.log('  → Seeding extra fabrics...');
  const insFabric = db.prepare(`INSERT OR IGNORE INTO fabrics (code, name, fabric_type, price_per_m, supplier_id, supplier, color, status, available_meters, low_stock_threshold, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const f of EXTRA_FABRICS) {
    const supData = SUPPLIER_DATA[f.supplier_idx];
    const supId = supplierIds[supData.code] || null;
    const avail = randFloat(0, 800, 1);
    insFabric.run(f.code, f.name, f.type, f.price, supId, supData.name, f.color, 'active', avail, 20, dt(addDays(START, -randInt(10, 200))));
  }
  // Update existing fabrics with available_meters and supplier_id
  for (const s of SUPPLIER_DATA) {
    const sid = supplierIds[s.code];
    if (sid) {
      db.prepare('UPDATE fabrics SET supplier_id=? WHERE supplier=? AND supplier_id IS NULL').run(sid, s.name);
    }
  }
  db.prepare('UPDATE fabrics SET available_meters = ? WHERE available_meters IS NULL OR available_meters = 0').run(0);
  const existingFabrics = db.prepare('SELECT code, available_meters FROM fabrics WHERE available_meters = 0').all();
  for (const f of existingFabrics) {
    db.prepare('UPDATE fabrics SET available_meters = ? WHERE code = ?').run(randFloat(50, 500, 1), f.code);
  }
  const fabricCount = db.prepare('SELECT COUNT(*) as c FROM fabrics').get().c;
  console.log(`    ✓ ${fabricCount} total fabrics`);

  // Generate seed images for fabrics (programmatic, no hardcoded URLs)
  const fabricUploadDir = pathMod.join(__dirname, 'uploads', 'fabrics');
  ensureDir(fabricUploadDir);
  const FABRIC_COLORS = [
    [200,50,50],[50,50,200],[50,150,50],[180,140,60],[100,50,150],[50,150,180],
    [220,120,50],[140,80,60],[30,30,30],[200,200,200],[180,50,120],[50,120,80],
    [160,160,50],[80,130,200],[200,100,100],[100,60,40],[70,100,70],[200,180,150],
  ];
  const allFabricsForImg = db.prepare("SELECT code FROM fabrics WHERE status='active' AND (image_path IS NULL OR image_path = '')").all();
  let imgCount = 0;
  for (const fab of allFabricsForImg) {
    const c = FABRIC_COLORS[imgCount % FABRIC_COLORS.length];
    const safeCode = fab.code.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const fname = `fab-seed-${safeCode}.png`;
    const fpath = pathMod.join(fabricUploadDir, fname);
    if (!fs.existsSync(fpath)) {
      fs.writeFileSync(fpath, makePNG(c[0], c[1], c[2]));
    }
    db.prepare("UPDATE fabrics SET image_path=? WHERE code=?").run(`/uploads/fabrics/${fname}`, fab.code);
    imgCount++;
  }
  console.log(`    ✓ ${imgCount} fabric images generated`);

  // ─── 3. EXTRA ACCESSORIES ─────────────────────
  console.log('  → Seeding extra accessories...');
  const insAcc = db.prepare(`INSERT OR IGNORE INTO accessories (code, acc_type, name, unit_price, unit, supplier_id, supplier, status, quantity_on_hand, low_stock_threshold, reorder_qty, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const a of EXTRA_ACCESSORIES) {
    const supData = SUPPLIER_DATA[a.supplier_idx];
    const supId = supplierIds[supData.code] || null;
    const onHand = randFloat(20, 2000, 0);
    insAcc.run(a.code, a.type, a.name, a.price, a.unit, supId, supData.name, 'active', onHand, 10, 50, dt(addDays(START, -randInt(10, 200))));
  }
  // Update existing accessories stock
  db.prepare('UPDATE accessories SET quantity_on_hand = CASE WHEN quantity_on_hand IS NULL OR quantity_on_hand = 0 THEN ? ELSE quantity_on_hand END WHERE 1=1').run(0);
  const existingAccs = db.prepare('SELECT code, quantity_on_hand FROM accessories WHERE quantity_on_hand = 0 OR quantity_on_hand IS NULL').all();
  for (const a of existingAccs) {
    db.prepare('UPDATE accessories SET quantity_on_hand = ? WHERE code = ?').run(randInt(50, 1000), a.code);
  }
  const accCount = db.prepare('SELECT COUNT(*) as c FROM accessories').get().c;
  console.log(`    ✓ ${accCount} total accessories`);

  // ─── 4. CUSTOMERS ─────────────────────────────
  console.log('  → Seeding customers...');
  const insCust = db.prepare(`INSERT OR IGNORE INTO customers (code, name, phone, email, address, city, customer_type, contact_name, payment_terms, credit_limit, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const customerIds = {};
  for (const c of CUSTOMER_DATA) {
    const created = dt(addDays(START, -randInt(30, 300)));
    insCust.run(c.code, c.name, c.phone, c.email, c.address, c.city, c.type, c.name.split(' ')[0], c.terms, c.limit, 'active', created);
    const row = db.prepare('SELECT id FROM customers WHERE code=?').get(c.code);
    if (row) customerIds[c.code] = row.id;
  }
  console.log(`    ✓ ${Object.keys(customerIds).length} customers`);

  // ─── 5. EMPLOYEES ─────────────────────────────
  console.log('  → Seeding employees...');
  const insEmp = db.prepare(`INSERT OR IGNORE INTO employees (emp_code, full_name, department, job_title, employment_type, salary_type, base_salary, hire_date, status, phone, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const employeeIds = [];
  for (const e of EMPLOYEE_DATA) {
    const salaryType = e.type === 'daily' ? 'daily' : 'monthly';
    const phone = '010' + String(randInt(10000000, 99999999));
    insEmp.run(e.code, e.name, e.dept, e.title, e.type, salaryType, e.salary, e.hire, 'active', phone, dt(new Date(e.hire)));
    const row = db.prepare('SELECT id FROM employees WHERE emp_code=?').get(e.code);
    if (row) employeeIds.push(row.id);
  }
  console.log(`    ✓ ${employeeIds.length} employees`);

  // ─── 6. USERS ─────────────────────────────────
  console.log('  → Seeding users...');
  const hash = bcrypt.hashSync('123456', 12);
  const insUser = db.prepare(`INSERT OR IGNORE INTO users (username, full_name, email, password_hash, role, status, employee_id, must_change_password, created_at) VALUES (?,?,?,?,?,?,?,0,?)`);
  const userIds = [];
  for (const u of USER_DATA) {
    const empId = u.empIdx !== null ? employeeIds[u.empIdx] : null;
    insUser.run(u.username, u.name, u.email, hash, u.role, 'active', empId, dt(addDays(START, -randInt(1, 60))));
    const row = db.prepare('SELECT id FROM users WHERE username=?').get(u.username);
    if (row) userIds.push(row.id);
  }
  console.log(`    ✓ ${userIds.length} users (password: 123456)`);

  // ─── 7. EXTRA MODELS ─────────────────────────
  console.log('  → Seeding models...');
  const insModel = db.prepare(`INSERT OR IGNORE INTO models (model_code, serial_number, model_name, category, gender, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  let serialIdx = 4; // existing models have 1-001, 1-002, 1-003
  for (const m of EXTRA_MODELS) {
    const serial = `1-${pad(serialIdx, 3)}`;
    const created = dt(addDays(START, -randInt(5, 90)));
    insModel.run(m.code, serial, m.name, m.cat, m.gender, 'active', m.notes, created);
    serialIdx++;
  }
  // Update existing models with categories
  db.prepare("UPDATE models SET category='فساتين' WHERE model_code='DRS-001' AND (category IS NULL OR category='')").run();
  db.prepare("UPDATE models SET category='بنطلونات', gender='male' WHERE model_code='PNT-001' AND (category IS NULL OR category='')").run();
  db.prepare("UPDATE models SET category='جاكيتات', gender='male' WHERE model_code='JKT-001' AND (category IS NULL OR category='')").run();
  const modelCount = db.prepare('SELECT COUNT(*) as c FROM models').get().c;
  console.log(`    ✓ ${modelCount} total models`);

  // Generate seed images for models
  const modelUploadDir = pathMod.join(process.env.WK_DB_DIR || __dirname, 'uploads', 'models');
  ensureDir(modelUploadDir);
  const allModelsForImg = db.prepare("SELECT model_code FROM models WHERE status='active' AND (model_image IS NULL OR model_image = '')").all();
  let mdlImgCount = 0;
  for (const mdl of allModelsForImg) {
    const c = FABRIC_COLORS[(mdlImgCount + 5) % FABRIC_COLORS.length];
    const fname = `mdl-seed-${mdl.model_code.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    const fpath = pathMod.join(modelUploadDir, fname);
    if (!fs.existsSync(fpath)) {
      fs.writeFileSync(fpath, makePNG(c[0], c[1], c[2]));
    }
    db.prepare("UPDATE models SET model_image=? WHERE model_code=?").run(`/uploads/models/${fname}`, mdl.model_code);
    mdlImgCount++;
  }
  console.log(`    ✓ ${mdlImgCount} model images generated`);

  // ─── 8. MACHINES ──────────────────────────────
  console.log('  → Seeding machines...');
  const insMachine = db.prepare(`INSERT OR IGNORE INTO machines (code, name, machine_type, brand, model_number, status, purchase_price, capacity_per_hour, cost_per_hour, purchase_date, barcode, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const m of MACHINE_DATA) {
    const purchaseDate = dd(addDays(START, -randInt(180, 720)));
    insMachine.run(m.code, m.name, m.type, m.brand, m.model, 'active', m.price, m.cap, m.cost, purchaseDate, m.code, dt(new Date(purchaseDate)));
  }
  const machineCount = db.prepare('SELECT COUNT(*) as c FROM machines').get().c;
  console.log(`    ✓ ${machineCount} machines`);

  // ─── 9. BOM TEMPLATES for new models ──────────
  console.log('  → Seeding BOM templates...');
  const allFabrics = db.prepare('SELECT code, fabric_type, price_per_m FROM fabrics WHERE status=?').all('active');
  const mainFabrics = allFabrics.filter(f => f.fabric_type === 'main' || f.fabric_type === 'both');
  const liningFabrics = allFabrics.filter(f => f.fabric_type === 'lining' || f.fabric_type === 'both');
  const allAccs = db.prepare('SELECT code, name, unit_price FROM accessories WHERE status=?').all('active');
  const allModels = db.prepare('SELECT id, model_code FROM models').all();

  const insBom = db.prepare('INSERT OR IGNORE INTO bom_templates (model_id, template_name, is_default, masnaiya, masrouf, margin_pct, created_at) VALUES (?,?,?,?,?,?,?)');
  const insBomFab = db.prepare('INSERT INTO bom_template_fabrics (template_id, fabric_code, role, meters_per_piece, waste_pct, sort_order) VALUES (?,?,?,?,?,?)');
  const insBomAcc = db.prepare('INSERT INTO bom_template_accessories (template_id, accessory_code, accessory_name, quantity, unit_price) VALUES (?,?,?,?,?)');
  const insBomSize = db.prepare('INSERT INTO bom_template_sizes (template_id, color_label, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl) VALUES (?,?,?,?,?,?,?,?)');

  let bomCount = 0;
  for (const model of allModels) {
    const existing = db.prepare('SELECT id FROM bom_templates WHERE model_id=?').get(model.id);
    if (existing) continue;

    const mData = EXTRA_MODELS.find(m => m.code === model.model_code) || { masnaiya: 70, masrouf: 40 };
    const tmpl = insBom.run(model.id, 'الافتراضي', 1, mData.masnaiya, mData.masrouf, 25, dt(addDays(START, -randInt(1, 60))));
    const tid = tmpl.lastInsertRowid;

    // Add 1-2 main fabrics
    const mains = pickN(mainFabrics, randInt(1, 2));
    mains.forEach((f, i) => {
      insBomFab.run(tid, f.code, 'main', randFloat(1, 3, 2), randInt(3, 8), i);
    });
    // 60% chance of lining
    if (Math.random() < 0.6 && liningFabrics.length > 0) {
      const lin = pick(liningFabrics);
      insBomFab.run(tid, lin.code, 'lining', randFloat(0.5, 2, 2), randInt(3, 6), 10);
    }
    // 2-5 accessories
    const accs = pickN(allAccs, randInt(2, 5));
    for (const a of accs) {
      insBomAcc.run(tid, a.code, a.name, randFloat(1, 8, 1), a.unit_price);
    }
    // Size distribution
    insBomSize.run(tid, 'أساسي', randInt(5, 20), randInt(20, 50), randInt(30, 60), randInt(20, 50), randInt(10, 30), randInt(5, 15));
    bomCount++;
  }
  console.log(`    ✓ ${bomCount} new BOM templates`);

  // ─── 10. PURCHASE ORDERS ──────────────────────
  console.log('  → Seeding purchase orders...');
  const supplierList = db.prepare('SELECT id, code, name, supplier_type FROM suppliers WHERE status=?').all('active');
  const fabricList = db.prepare('SELECT code, name, price_per_m, fabric_type FROM fabrics WHERE status=?').all('active');
  const accList = db.prepare('SELECT code, name, unit_price, unit, acc_type FROM accessories WHERE status=?').all('active');

  const insPO = db.prepare(`INSERT OR IGNORE INTO purchase_orders (po_number, supplier_id, po_type, status, order_date, expected_date, received_date, total_amount, paid_amount, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insPOItem = db.prepare(`INSERT OR IGNORE INTO purchase_order_items (po_id, item_type, fabric_code, accessory_code, description, quantity, unit, unit_price, received_qty, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insSupPayment = db.prepare(`INSERT OR IGNORE INTO supplier_payments (po_id, supplier_id, amount, payment_date, payment_method, reference, notes) VALUES (?,?,?,?,?,?,?)`);
  const insBatch = db.prepare(`INSERT OR IGNORE INTO fabric_inventory_batches (batch_code, fabric_code, po_id, po_item_id, supplier_id, ordered_meters, received_meters, used_meters, wasted_meters, price_per_meter, received_date, batch_status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insAccBatch = db.prepare(`INSERT OR IGNORE INTO accessory_inventory_batches (batch_code, accessory_code, po_id, po_item_id, supplier_id, ordered_qty, received_qty, used_qty, price_per_unit, unit, batch_status, received_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const poStatuses = ['received', 'received', 'received', 'received', 'received', 'partial', 'partial', 'sent', 'sent', 'draft', 'cancelled'];
  let poNum = 1;
  let batchNum = 1;
  let accBatchNum = 1;
  const poIds = [];
  const fabricBatches = [];
  const accBatches = [];

  // Generate ~60 POs across 3 months
  for (let i = 0; i < 60; i++) {
    const orderDate = randDate(START, END);
    if (!isWeekday(orderDate) && Math.random() < 0.7) continue; // fewer weekend orders

    const supplier = pick(supplierList);
    const isFabricSupplier = supplier.supplier_type === 'fabric' || supplier.supplier_type === 'both';
    const isAccessorySupplier = supplier.supplier_type === 'accessory' || supplier.supplier_type === 'both';
    const poType = isFabricSupplier && isAccessorySupplier ? pick(['fabric', 'accessory', 'mixed']) :
                   isFabricSupplier ? 'fabric' : 'accessory';

    const status = pick(poStatuses);
    const expectedDate = addDays(orderDate, randInt(7, 45));
    let receivedDate = null;
    if (['received', 'partial'].includes(status)) {
      const delay = randInt(-5, 15); // some early, some late
      receivedDate = addDays(expectedDate, delay);
      if (receivedDate > END) receivedDate = addDays(END, -randInt(0, 5));
    }

    const poNumber = `PO-${dd(orderDate).replace(/-/g, '').slice(2)}-${pad(poNum)}`;
    let totalAmount = 0;
    const itemCount = randInt(1, 6);
    const items = [];

    for (let j = 0; j < itemCount; j++) {
      let itemType, itemCode, desc, qty, unit, unitPrice;
      if ((poType === 'fabric' || (poType === 'mixed' && Math.random() < 0.6)) && fabricList.length > 0) {
        const fab = pick(fabricList);
        itemType = 'fabric';
        itemCode = fab.code;
        desc = fab.name;
        qty = randFloat(50, 500, 1);
        unit = 'meter';
        unitPrice = fab.price_per_m * randFloat(0.85, 1.05, 2); // slight price variance
      } else if (accList.length > 0) {
        const acc = pick(accList);
        itemType = 'accessory';
        itemCode = acc.code;
        desc = acc.name;
        qty = randFloat(50, 2000, 0);
        unit = acc.unit;
        unitPrice = acc.unit_price * randFloat(0.9, 1.1, 2);
      } else continue;

      const lineTotal = +(qty * unitPrice).toFixed(2);
      totalAmount += lineTotal;

      let receivedQty = 0;
      if (status === 'received') receivedQty = qty * randFloat(0.95, 1.05, 2); // slight variance
      else if (status === 'partial') receivedQty = qty * randFloat(0.3, 0.8, 2);

      items.push({ itemType, fabricCode: itemType === 'fabric' ? itemCode : null, accCode: itemType === 'accessory' ? itemCode : null, desc, qty, unit, unitPrice, receivedQty });
    }

    if (items.length === 0) continue;

    totalAmount = +totalAmount.toFixed(2);
    let paidAmount = 0;
    if (status === 'received') paidAmount = totalAmount * randFloat(0.7, 1, 2);
    else if (status === 'partial') paidAmount = totalAmount * randFloat(0.2, 0.6, 2);
    else if (status === 'sent') paidAmount = totalAmount * randFloat(0, 0.3, 2);
    paidAmount = +paidAmount.toFixed(2);

    const statusNote = status === 'cancelled' ? 'تم الإلغاء بسبب تأخر التوريد' : '';
    const createdAt = dt(orderDate);

    const poResult = insPO.run(poNumber, supplier.id, poType, status, dd(orderDate), dd(expectedDate),
              receivedDate ? dd(receivedDate) : null, totalAmount, paidAmount, statusNote, createdAt);
    if (poResult.changes === 0) continue;
    const poId = Number(poResult.lastInsertRowid);
    poIds.push(poId);

    for (const item of items) {
      const poItemResult = insPOItem.run(poId, item.itemType, item.fabricCode, item.accCode, item.desc, item.qty, item.unit, item.unitPrice, item.receivedQty, null);
      const poItemId = Number(poItemResult.lastInsertRowid);

      // Create fabric inventory batches for received fabric items — used_meters will be filled by WO consumption later
      if (item.itemType === 'fabric' && item.receivedQty > 0 && receivedDate) {
        const batchCode = `BTH-${pad(batchNum, 5)}`;
        const batchResult = insBatch.run(batchCode, item.fabricCode, poId, poItemId, supplier.id, item.qty, item.receivedQty, 0, 0, item.unitPrice, dd(receivedDate), 'available', createdAt);
        if (batchResult.changes > 0) {
          fabricBatches.push({ id: Number(batchResult.lastInsertRowid), fabricCode: item.fabricCode, receivedMeters: +item.receivedQty.toFixed(2), usedMeters: 0, wastedMeters: 0, pricePerMeter: item.unitPrice, poId, poItemId });
        }
        batchNum++;
      }

      // Create accessory inventory batches for received accessory items
      if (item.itemType === 'accessory' && item.receivedQty > 0 && receivedDate) {
        const abCode = `ABT-${pad(accBatchNum, 5)}`;
        const accBatchResult = insAccBatch.run(abCode, item.accCode, poId, poItemId, supplier.id, item.qty, item.receivedQty, 0, item.unitPrice, item.unit, 'available', dd(receivedDate), createdAt);
        if (accBatchResult.changes > 0) {
          accBatches.push({ id: Number(accBatchResult.lastInsertRowid), accCode: item.accCode, receivedQty: +item.receivedQty.toFixed(2), usedQty: 0, pricePerUnit: item.unitPrice, poId });
        }
        accBatchNum++;
      }
    }

    // Supplier payments for paid POs
    if (paidAmount > 0 && receivedDate) {
      const payDate = addDays(new Date(receivedDate > END ? END : receivedDate), randInt(0, 14));
      if (payDate <= END) {
        insSupPayment.run(poId, supplier.id, paidAmount, dd(payDate), pick(['cash', 'bank', 'check']), `PAY-${poNumber}`, null);
      }
    }

    poNum++;
  }
  const poCount = db.prepare('SELECT COUNT(*) as c FROM purchase_orders').get().c;
  console.log(`    ✓ ${poCount} purchase orders, ${fabricBatches.length} fabric batches`);

  // ─── 11. WORK ORDERS ──────────────────────────
  console.log('  → Seeding work orders...');
  const woStatuses = ['completed', 'completed', 'completed', 'completed', 'in_progress', 'in_progress', 'in_progress', 'draft', 'draft', 'pending', 'cancelled'];
  const priorities = ['normal', 'normal', 'normal', 'high', 'high', 'low', 'urgent'];
  const stages = db.prepare('SELECT * FROM stage_templates WHERE is_default=1 ORDER BY sort_order').all();
  const modelList = db.prepare('SELECT m.id, m.model_code, m.model_name, bt.id as tmpl_id, bt.masnaiya, bt.masrouf, bt.margin_pct FROM models m LEFT JOIN bom_templates bt ON bt.model_id=m.id AND bt.is_default=1 WHERE m.status=?').all('active');
  const customerList = db.prepare('SELECT id, code FROM customers WHERE status=?').all('active');

  const insWO = db.prepare(`INSERT OR IGNORE INTO work_orders (wo_number, model_id, template_id, status, priority, quantity, start_date, due_date, completed_date, masnaiya, masrouf, margin_pct, consumer_price, wholesale_price, customer_id, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insWOStage = db.prepare(`INSERT OR IGNORE INTO wo_stages (wo_id, stage_name, sort_order, status, quantity_in_stage, quantity_completed, quantity_rejected, started_at, completed_at, machine_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insWOSize = db.prepare(`INSERT OR IGNORE INTO wo_sizes (wo_id, color_label, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl) VALUES (?,?,?,?,?,?,?,?)`);
  const insWOFabBatch = db.prepare(`INSERT OR IGNORE INTO wo_fabric_batches (wo_id, batch_id, fabric_code, role, planned_meters_per_piece, planned_total_meters, waste_pct, actual_total_meters, actual_meters_per_piece, waste_meters, waste_cost, price_per_meter, planned_cost, actual_cost, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insCostSnap = db.prepare(`INSERT OR IGNORE INTO cost_snapshots (wo_id, model_id, total_pieces, total_meters_main, main_fabric_cost, lining_cost, accessories_cost, masnaiya, masrouf, waste_cost, total_cost, cost_per_piece, snapshot_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insFabConsumption = db.prepare(`INSERT OR IGNORE INTO wo_fabric_consumption (work_order_id, fabric_id, fabric_code, batch_id, po_id, planned_meters, actual_meters, price_per_meter, total_cost, recorded_by_user_id, recorded_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insAccConsumption = db.prepare(`INSERT OR IGNORE INTO wo_accessory_consumption (work_order_id, accessory_id, accessory_code, planned_qty, actual_qty, unit_price, total_cost, recorded_at) VALUES (?,?,?,?,?,?,?,?)`);
  const insWOWaste = db.prepare(`INSERT OR IGNORE INTO wo_waste (work_order_id, waste_meters, price_per_meter, waste_cost, notes, recorded_by_user_id, recorded_at) VALUES (?,?,?,?,?,?,?)`);
  const insWOAccDetail = db.prepare(`INSERT OR IGNORE INTO wo_accessories_detail (wo_id, accessory_code, accessory_name, quantity_per_piece, unit_price, planned_total_cost, actual_quantity, actual_cost, notes) VALUES (?,?,?,?,?,?,?,?,?)`);

  let woNum = 1;
  const woIds = [];
  const machineIds = db.prepare('SELECT id FROM machines WHERE status=?').all('active').map(r => r.id);

  for (let i = 0; i < 75; i++) {
    const startDate = randDate(START, addDays(END, -5));
    const model = pick(modelList);
    const status = pick(woStatuses);
    const priority = pick(priorities);
    const quantity = randInt(20, 500);
    const dueDate = addDays(startDate, randInt(7, 35));
    let completedDate = null;
    if (status === 'completed') {
      completedDate = addDays(startDate, randInt(5, 30));
      if (completedDate > END) completedDate = addDays(END, -randInt(0, 3));
    }

    const masnaiya = model.masnaiya || 70;
    const masrouf = model.masrouf || 40;
    const marginPct = model.margin_pct || 25;
    const cp = +(masnaiya + masrouf + randFloat(50, 200)).toFixed(2);
    const wp = +(cp * 0.78).toFixed(2);
    const customer = Math.random() < 0.7 ? pick(customerList) : null;

    const woNumber = `WO-${dd(startDate).replace(/-/g, '').slice(2)}-${pad(woNum)}`;
    const createdAt = dt(startDate);

    insWO.run(woNumber, model.id, model.tmpl_id, status, priority, quantity, dd(startDate), dd(dueDate),
              completedDate ? dd(completedDate) : null, masnaiya, masrouf, marginPct, cp, wp,
              customer ? customer.id : null, null, createdAt, createdAt);
    const woResult = db.prepare('SELECT id FROM work_orders WHERE wo_number=?').get(woNumber);
    if (!woResult) continue;
    const woId = woResult.id;
    woIds.push({ id: woId, status, quantity, startDate, completedDate, modelId: model.id });

    // Sizes
    const qs = randInt(2, Math.ceil(quantity * 0.08));
    const qm = randInt(5, Math.ceil(quantity * 0.2));
    const ql = randInt(5, Math.ceil(quantity * 0.25));
    const qxl = randInt(3, Math.ceil(quantity * 0.2));
    const q2xl = randInt(1, Math.ceil(quantity * 0.12));
    const q3xl = randInt(0, Math.ceil(quantity * 0.06));
    insWOSize.run(woId, 'أساسي', qs, qm, ql, qxl, q2xl, q3xl);

    // Stages
    let remaining = quantity;
    for (const stage of stages) {
      let stStatus = 'pending', qtyInStage = 0, qtyCompleted = 0, qtyRejected = 0;
      let startedAt = null, completedAt = null;
      let machineId = machineIds.length > 0 ? pick(machineIds) : null;

      if (status === 'completed') {
        stStatus = 'completed';
        qtyCompleted = remaining;
        qtyRejected = Math.random() < 0.15 ? randInt(1, Math.ceil(quantity * 0.03)) : 0;
        remaining -= qtyRejected;
        startedAt = dt(addDays(startDate, stage.sort_order));
        completedAt = dt(addDays(startDate, stage.sort_order + randInt(1, 3)));
      } else if (status === 'in_progress') {
        const activeStageIdx = randInt(1, stages.length - 2);
        if (stage.sort_order < stages[activeStageIdx].sort_order) {
          stStatus = 'completed';
          qtyCompleted = remaining;
          startedAt = dt(addDays(startDate, stage.sort_order));
          completedAt = dt(addDays(startDate, stage.sort_order + randInt(1, 3)));
        } else if (stage.sort_order === stages[activeStageIdx].sort_order) {
          stStatus = 'in_progress';
          qtyInStage = remaining;
          qtyCompleted = Math.floor(remaining * randFloat(0.1, 0.8));
          startedAt = dt(addDays(startDate, stage.sort_order));
        }
      } else if (status === 'pending' || status === 'draft') {
        if (stage.sort_order === 1 && status === 'pending') {
          qtyInStage = quantity;
        }
      }

      insWOStage.run(woId, stage.name, stage.sort_order, stStatus, qtyInStage, qtyCompleted, qtyRejected, startedAt, completedAt, machineId, null);
    }

    // Link fabric batches to WO + create consumption records
    let woMainFabricCost = 0, woLiningCost = 0, woAccCost = 0, woWasteCost = 0, woTotalMainMeters = 0;
    if (model.tmpl_id) {
      const bomFabs = db.prepare('SELECT fabric_code, role, meters_per_piece, waste_pct, sort_order FROM bom_template_fabrics WHERE template_id=?').all(model.tmpl_id);
      for (const bf of bomFabs) {
        const matchBatch = fabricBatches.find(b => b.fabricCode === bf.fabric_code && (b.receivedMeters - b.usedMeters - b.wastedMeters) > 5);
        if (!matchBatch) continue;

        const batchAvail = matchBatch.receivedMeters - matchBatch.usedMeters - matchBatch.wastedMeters;
        const plannedTotal = +(bf.meters_per_piece * quantity).toFixed(2);
        const wastePct = bf.waste_pct || 5;
        const price = matchBatch.pricePerMeter;
        const plannedCost = +(plannedTotal * price).toFixed(2);

        // For completed/in_progress WOs, compute actual consumption
        let actualTotal = 0, actualPerPiece = 0, wasteMeters = 0, actualCost = 0, wasteCostLine = 0;
        if (status === 'completed' || status === 'in_progress') {
          const factor = status === 'completed' ? 1.0 : randFloat(0.3, 0.8, 2);
          actualPerPiece = +(bf.meters_per_piece * randFloat(0.95, 1.08, 3)).toFixed(3);
          actualTotal = +(actualPerPiece * quantity * factor).toFixed(2);
          // Cap consumption to available batch meters
          if (actualTotal > batchAvail * 0.95) actualTotal = +(batchAvail * 0.9).toFixed(2);
          if (actualTotal < 1) { continue; }
          actualPerPiece = +(actualTotal / (quantity * factor)).toFixed(3);
          wasteMeters = +(actualTotal * wastePct / 100 * randFloat(0.5, 1.5, 2)).toFixed(2);
          if (wasteMeters > batchAvail - actualTotal) wasteMeters = +((batchAvail - actualTotal) * 0.5).toFixed(2);
          if (wasteMeters < 0) wasteMeters = 0;
          actualCost = +(actualTotal * price).toFixed(2);
          wasteCostLine = +(wasteMeters * price).toFixed(2);

          // Deduct from batch
          matchBatch.usedMeters += actualTotal;
          matchBatch.wastedMeters += wasteMeters;
        }

        insWOFabBatch.run(woId, matchBatch.id, bf.fabric_code, bf.role, bf.meters_per_piece, plannedTotal, wastePct,
            actualTotal || null, actualPerPiece || null, wasteMeters || 0, wasteCostLine || 0, price, plannedCost, actualCost || null, bf.sort_order, createdAt);

        if (bf.role === 'main') { woMainFabricCost += actualCost || plannedCost; woTotalMainMeters += actualTotal || plannedTotal; }
        else { woLiningCost += actualCost || plannedCost; }
        woWasteCost += wasteCostLine;

        // Create fabric consumption record for completed/in_progress
        if (actualTotal > 0) {
          const fabricRow = db.prepare('SELECT id FROM fabrics WHERE code=?').get(bf.fabric_code);
          const fabricId = fabricRow ? fabricRow.id : 0;
          insFabConsumption.run(woId, fabricId, bf.fabric_code, matchBatch.id, matchBatch.poId, plannedTotal, actualTotal, price, actualCost, pick(userIds), createdAt, createdAt);

          // Create waste record if significant
          if (wasteMeters > 0.5) {
            insWOWaste.run(woId, wasteMeters, price, wasteCostLine, `هالك ${bf.role === 'main' ? 'قماش أساسي' : 'بطانة'} - ${bf.fabric_code}`, pick(userIds), createdAt);
          }
        }
      }

      // Accessories consumption from BOM
      const bomAccs = db.prepare('SELECT accessory_code, accessory_name, quantity, unit_price FROM bom_template_accessories WHERE template_id=?').all(model.tmpl_id);
      for (const ba of bomAccs) {
        const plannedQty = +(ba.quantity * quantity).toFixed(1);
        const price = ba.unit_price;
        const plannedCost = +(plannedQty * price).toFixed(2);

        let actualQty = 0, actualCostAcc = 0;
        if (status === 'completed' || status === 'in_progress') {
          const factor = status === 'completed' ? 1.0 : randFloat(0.3, 0.8, 2);
          actualQty = +(ba.quantity * quantity * factor * randFloat(0.95, 1.08, 2)).toFixed(1);
          actualCostAcc = +(actualQty * price).toFixed(2);

          // Deduct from accessory batch if exists
          const matchAccBatch = accBatches.find(b => b.accCode === ba.accessory_code && (b.receivedQty - b.usedQty) > 0);
          if (matchAccBatch) {
            matchAccBatch.usedQty += actualQty;
          }

          // Also deduct from accessories.quantity_on_hand
          db.prepare('UPDATE accessories SET quantity_on_hand = MAX(0, quantity_on_hand - ?) WHERE code = ?').run(actualQty, ba.accessory_code);
        }

        woAccCost += actualCostAcc || plannedCost;

        // wo_accessories_detail record
        insWOAccDetail.run(woId, ba.accessory_code, ba.accessory_name, ba.quantity, price, plannedCost, actualQty || null, actualCostAcc || null, null);

        // Consumption record for completed/in_progress
        if (actualQty > 0) {
          const accRow = db.prepare('SELECT id FROM accessories WHERE code=?').get(ba.accessory_code);
          const accId = accRow ? accRow.id : 0;
          insAccConsumption.run(woId, accId, ba.accessory_code, plannedQty, actualQty, price, actualCostAcc, createdAt);
        }
      }
    }

    // Cost snapshot for completed WOs — computed from REAL consumption data
    if (status === 'completed') {
      const masnaiyaTotal = +(masnaiya * quantity).toFixed(2);
      const masroufTotal = +(masrouf * quantity).toFixed(2);
      const totalCost = +(woMainFabricCost + woLiningCost + woAccCost + masnaiyaTotal + masroufTotal + woWasteCost).toFixed(2);
      const costPP = totalCost > 0 ? +(totalCost / quantity).toFixed(2) : 0;
      insCostSnap.run(woId, model.id, quantity, +woTotalMainMeters.toFixed(2), +woMainFabricCost.toFixed(2), +woLiningCost.toFixed(2), +woAccCost.toFixed(2), masnaiya, masrouf, +woWasteCost.toFixed(2), totalCost, costPP, completedDate ? dd(completedDate) : dd(END));

      // Update WO totals
      db.prepare('UPDATE work_orders SET total_production_cost=?, cost_per_piece=?, waste_cost_total=?, actual_cost_per_piece=? WHERE id=?')
        .run(totalCost, costPP, +woWasteCost.toFixed(2), costPP, woId);
    }

    woNum++;
  }

  // ─── 11a. SHOWCASE WORK ORDERS (specific stage breakdowns) ──
  console.log('  → Seeding showcase work orders...');
  for (const sw of SHOWCASE_WOS) {
    const model = modelList.find(m => m.model_code === sw.model_code) || pick(modelList);
    const startDate = addDays(START, randInt(10, 45));
    const dueDate = addDays(startDate, randInt(14, 35));
    let completedDate = null;
    if (sw.status === 'completed') {
      completedDate = addDays(startDate, randInt(10, 28));
      if (completedDate > END) completedDate = addDays(END, -2);
    }
    const masnaiya = model.masnaiya || 70;
    const masrouf = model.masrouf || 40;
    const marginPct = model.margin_pct || 25;
    const cp = +(masnaiya + masrouf + randFloat(50, 200)).toFixed(2);
    const wp = +(cp * 0.78).toFixed(2);
    const customer = pick(customerList);

    const woNumber = `WO-${dd(startDate).replace(/-/g, '').slice(2)}-${pad(woNum)}`;
    const createdAt = dt(startDate);

    insWO.run(woNumber, model.id, model.tmpl_id, sw.status, sw.priority, sw.quantity,
              dd(startDate), dd(dueDate), completedDate ? dd(completedDate) : null,
              masnaiya, masrouf, marginPct, cp, wp, customer.id,
              sw.label, createdAt, createdAt);
    const swResult = db.prepare('SELECT id FROM work_orders WHERE wo_number=?').get(woNumber);
    if (!swResult) continue;
    const woId = swResult.id;
    woIds.push({ id: woId, status: sw.status, quantity: sw.quantity, startDate, completedDate, modelId: model.id });

    // Sizes
    const qs = Math.ceil(sw.quantity * 0.06);
    const qm = Math.ceil(sw.quantity * 0.18);
    const ql = Math.ceil(sw.quantity * 0.24);
    const qxl = Math.ceil(sw.quantity * 0.22);
    const q2xl = Math.ceil(sw.quantity * 0.15);
    const q3xl = Math.ceil(sw.quantity * 0.08);
    insWOSize.run(woId, 'أساسي', qs, qm, ql, qxl, q2xl, q3xl);

    // Insert exact stages per showcase definition
    for (let si = 0; si < sw.stages.length; si++) {
      const stg = sw.stages[si];
      const startedAt = stg.status !== 'pending' ? dt(addDays(startDate, si + 1)) : null;
      const completedAt = stg.status === 'completed' ? dt(addDays(startDate, si + 2)) : null;
      const machineId = machineIds.length > 0 ? pick(machineIds) : null;
      insWOStage.run(woId, stg.name, si + 1, stg.status, stg.in_stage, stg.completed, stg.rejected,
                     startedAt, completedAt, machineId, null);
    }

    // Fabric consumption for showcase WOs
    let scMainCost = 0, scLiningCost = 0, scAccCost = 0, scWasteCost = 0, scTotalMeters = 0;
    if (model.tmpl_id) {
      const bomFabs = db.prepare('SELECT fabric_code, role, meters_per_piece, waste_pct, sort_order FROM bom_template_fabrics WHERE template_id=?').all(model.tmpl_id);
      for (const bf of bomFabs) {
        const matchBatch = fabricBatches.find(b => b.fabricCode === bf.fabric_code && (b.receivedMeters - b.usedMeters - b.wastedMeters) > 5);
        if (!matchBatch) continue;
        const batchAvail = matchBatch.receivedMeters - matchBatch.usedMeters - matchBatch.wastedMeters;
        const plannedTotal = +(bf.meters_per_piece * sw.quantity).toFixed(2);
        const wastePct = bf.waste_pct || 5;
        const price = matchBatch.pricePerMeter;
        const plannedCost = +(plannedTotal * price).toFixed(2);
        const factor = sw.status === 'completed' ? 1.0 : 0.6;
        let actualTotal = +(bf.meters_per_piece * 1.02 * sw.quantity * factor).toFixed(2);
        if (actualTotal > batchAvail * 0.9) actualTotal = +(batchAvail * 0.85).toFixed(2);
        if (actualTotal < 1) continue;
        const actualPerPiece = +(actualTotal / (sw.quantity * factor)).toFixed(3);
        let wasteMeters = +(actualTotal * wastePct / 100).toFixed(2);
        if (wasteMeters > batchAvail - actualTotal) wasteMeters = +((batchAvail - actualTotal) * 0.3).toFixed(2);
        if (wasteMeters < 0) wasteMeters = 0;
        const actualCost = +(actualTotal * price).toFixed(2);
        const wasteCostLine = +(wasteMeters * price).toFixed(2);
        matchBatch.usedMeters += actualTotal;
        matchBatch.wastedMeters += wasteMeters;
        insWOFabBatch.run(woId, matchBatch.id, bf.fabric_code, bf.role, bf.meters_per_piece, plannedTotal, wastePct,
            actualTotal, actualPerPiece, wasteMeters, wasteCostLine, price, plannedCost, actualCost, bf.sort_order, createdAt);
        if (bf.role === 'main') { scMainCost += actualCost; scTotalMeters += actualTotal; }
        else { scLiningCost += actualCost; }
        scWasteCost += wasteCostLine;
        const fabricRow = db.prepare('SELECT id FROM fabrics WHERE code=?').get(bf.fabric_code);
        if (fabricRow) {
          insFabConsumption.run(woId, fabricRow.id, bf.fabric_code, matchBatch.id, matchBatch.poId, plannedTotal, actualTotal, price, actualCost, pick(userIds), createdAt, createdAt);
        }
        if (wasteMeters > 0.5) {
          insWOWaste.run(woId, wasteMeters, price, wasteCostLine, `هالك ${bf.role === 'main' ? 'قماش' : 'بطانة'} - ${bf.fabric_code}`, pick(userIds), createdAt);
        }
      }
      const bomAccs = db.prepare('SELECT accessory_code, accessory_name, quantity, unit_price FROM bom_template_accessories WHERE template_id=?').all(model.tmpl_id);
      for (const ba of bomAccs) {
        const plannedQty = +(ba.quantity * sw.quantity).toFixed(1);
        const factor = sw.status === 'completed' ? 1.0 : 0.6;
        const actualQty = +(ba.quantity * sw.quantity * factor * 1.02).toFixed(1);
        const actualCostAcc = +(actualQty * ba.unit_price).toFixed(2);
        const matchAccBatch = accBatches.find(b => b.accCode === ba.accessory_code && (b.receivedQty - b.usedQty) > 0);
        if (matchAccBatch) matchAccBatch.usedQty += actualQty;
        db.prepare('UPDATE accessories SET quantity_on_hand = MAX(0, quantity_on_hand - ?) WHERE code = ?').run(actualQty, ba.accessory_code);
        scAccCost += actualCostAcc;
        insWOAccDetail.run(woId, ba.accessory_code, ba.accessory_name, ba.quantity, ba.unit_price, +(plannedQty * ba.unit_price).toFixed(2), actualQty, actualCostAcc, null);
        const accRow = db.prepare('SELECT id FROM accessories WHERE code=?').get(ba.accessory_code);
        if (accRow) insAccConsumption.run(woId, accRow.id, ba.accessory_code, plannedQty, actualQty, ba.unit_price, actualCostAcc, createdAt);
      }
    }
    if (sw.status === 'completed') {
      const masnaiyaTotal = +(masnaiya * sw.quantity).toFixed(2);
      const masroufTotal = +(masrouf * sw.quantity).toFixed(2);
      const totalCost = +(scMainCost + scLiningCost + scAccCost + masnaiyaTotal + masroufTotal + scWasteCost).toFixed(2);
      const costPP = totalCost > 0 ? +(totalCost / sw.quantity).toFixed(2) : 0;
      insCostSnap.run(woId, model.id, sw.quantity, +scTotalMeters.toFixed(2), +scMainCost.toFixed(2), +scLiningCost.toFixed(2), +scAccCost.toFixed(2), masnaiya, masrouf, +scWasteCost.toFixed(2), totalCost, costPP, completedDate ? dd(completedDate) : dd(END));
      db.prepare('UPDATE work_orders SET total_production_cost=?, cost_per_piece=?, waste_cost_total=?, actual_cost_per_piece=? WHERE id=?')
        .run(totalCost, costPP, +scWasteCost.toFixed(2), costPP, woId);
    }
    woNum++;
  }
  console.log(`    ✓ ${SHOWCASE_WOS.length} showcase work orders added`);

  const woCount = db.prepare('SELECT COUNT(*) as c FROM work_orders').get().c;
  console.log(`    ✓ ${woCount} work orders total`);

  // ─── 11b. FINALIZE INVENTORY ──────────────────
  // Update fabric_inventory_batches with accumulated used/wasted meters
  for (const batch of fabricBatches) {
    const avail = batch.receivedMeters - batch.usedMeters - batch.wastedMeters;
    const bStatus = avail < 1 ? 'depleted' : 'available';
    db.prepare('UPDATE fabric_inventory_batches SET used_meters=?, wasted_meters=?, batch_status=? WHERE id=?')
      .run(+(batch.usedMeters).toFixed(2), +(batch.wastedMeters).toFixed(3), bStatus, batch.id);
  }
  // Update accessory_inventory_batches with accumulated used qty
  for (const batch of accBatches) {
    const avail = batch.receivedQty - batch.usedQty;
    const bStatus = avail < 1 ? 'depleted' : 'available';
    db.prepare('UPDATE accessory_inventory_batches SET used_qty=?, batch_status=? WHERE id=?')
      .run(+(batch.usedQty).toFixed(2), bStatus, batch.id);
  }
  // Recalculate fabric available_meters from batch data
  db.prepare('UPDATE fabrics SET available_meters = 0').run();
  const batchSums = db.prepare('SELECT fabric_code, SUM(received_meters - used_meters - wasted_meters) as avail FROM fabric_inventory_batches WHERE batch_status != ? GROUP BY fabric_code').all('depleted');
  for (const bs of batchSums) {
    db.prepare('UPDATE fabrics SET available_meters = ? WHERE code = ?').run(Math.max(0, +bs.avail.toFixed(2)), bs.fabric_code);
  }
  // Also add a baseline for fabrics with no batches
  db.prepare("UPDATE fabrics SET available_meters = ? WHERE available_meters = 0 AND status = 'active'").run(0);

  console.log(`    ✓ Inventory finalized: ${fabricBatches.length} fabric batches, ${accBatches.length} accessory batches`);

  // ─── 12. INVOICES ─────────────────────────────
  console.log('  → Seeding invoices...');
  const insInv = db.prepare(`INSERT OR IGNORE INTO invoices (invoice_number, customer_name, customer_phone, customer_id, wo_id, status, tax_pct, discount, subtotal, total, due_date, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insInvItem = db.prepare(`INSERT OR IGNORE INTO invoice_items (invoice_id, description, model_code, quantity, unit_price, total, sort_order) VALUES (?,?,?,?,?,?,?)`);
  const insCustPayment = db.prepare(`INSERT OR IGNORE INTO customer_payments (customer_id, invoice_id, amount, payment_date, payment_method, reference, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`);

  const invStatuses = ['paid', 'paid', 'paid', 'sent', 'sent', 'draft', 'overdue'];
  let invNum = 1;
  const completedWOs = woIds.filter(w => w.status === 'completed');

  for (const wo of completedWOs) {
    if (Math.random() < 0.15) continue; // 15% of completed WOs have no invoice yet

    const model = db.prepare('SELECT model_code, model_name FROM models WHERE id=?').get(wo.modelId);
    const customer = pick(customerList);
    const custData = CUSTOMER_DATA.find(c => c.code === customer.code);
    if (!custData) continue;
    const status = pick(invStatuses);
    const invoiceDate = wo.completedDate ? addDays(wo.completedDate, randInt(0, 5)) : addDays(wo.startDate, randInt(10, 30));
    if (invoiceDate > END) continue;

    const unitPrice = randFloat(100, 600);
    const subtotal = +(wo.quantity * unitPrice).toFixed(2);
    const taxPct = 14;
    const discount = Math.random() < 0.3 ? randFloat(0, subtotal * 0.1) : 0;
    const total = +((subtotal - discount) * (1 + taxPct / 100)).toFixed(2);
    const dueDate = addDays(invoiceDate, randInt(15, 60));

    const invNumber = `INV-${dd(invoiceDate).replace(/-/g, '').slice(2)}-${pad(invNum)}`;
    const invResult = insInv.run(invNumber, custData.name, custData.phone, customer.id, wo.id, status, taxPct, +discount.toFixed(2), subtotal, total, dd(dueDate), null, dt(invoiceDate));
    if (invResult.changes === 0) continue;
    const invId = Number(invResult.lastInsertRowid);

    insInvItem.run(invId, model?.model_name || 'منتج', model?.model_code, wo.quantity, unitPrice, subtotal, 1);

    // Customer payments for paid invoices
    if (status === 'paid') {
      const payDate = addDays(invoiceDate, randInt(0, 30));
      if (payDate <= END) {
        insCustPayment.run(customer.id, invId, total, dd(payDate), pick(['cash', 'bank', 'check']), `RCV-${invNumber}`, pick(userIds), dt(payDate));
      }
    } else if (status === 'sent' && Math.random() < 0.4) {
      // Partial payment
      const partial = +(total * randFloat(0.3, 0.7)).toFixed(2);
      const payDate = addDays(invoiceDate, randInt(5, 25));
      if (payDate <= END) {
        insCustPayment.run(customer.id, invId, partial, dd(payDate), pick(['cash', 'bank']), `RCV-${invNumber}-P`, pick(userIds), dt(payDate));
      }
    }

    invNum++;
  }
  const invCount = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;
  console.log(`    ✓ ${invCount} invoices`);

  // ─── 13. QUOTATIONS ───────────────────────────
  console.log('  → Seeding quotations...');
  const insQuot = db.prepare(`INSERT INTO quotations (quotation_number, customer_id, status, valid_until, subtotal, tax_rate, tax_amount, discount, total, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insQuotItem = db.prepare(`INSERT OR IGNORE INTO quotation_items (quotation_id, model_code, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?)`);
  const quotStatuses = ['accepted', 'accepted', 'sent', 'sent', 'draft', 'rejected', 'expired', 'converted'];

  for (let i = 0; i < 25; i++) {
    const qDate = randDate(START, END);
    const customer = pick(customerList);
    const status = pick(quotStatuses);
    const model = pick(modelList);
    const qty = randInt(50, 500);
    const unitPrice = randFloat(100, 500);
    const subtotal = +(qty * unitPrice).toFixed(2);
    const taxRate = 14;
    const taxAmount = +(subtotal * 0.14).toFixed(2);
    const total = +(subtotal + taxAmount).toFixed(2);

    const qNum = `QT-${dd(qDate).replace(/-/g, '').slice(2)}-${pad(i + 1)}`;
    const quotResult = insQuot.run(qNum, customer.id, status, dd(addDays(qDate, 30)), subtotal, taxRate, taxAmount, 0, total, null, pick(userIds), dt(qDate));
    if (quotResult.changes === 0) continue;
    const qId = Number(quotResult.lastInsertRowid);
    insQuotItem.run(qId, model.model_code, model.model_name || 'موديل', qty, unitPrice, subtotal);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM quotations').get().c} quotations`);

  // ─── 14. SALES ORDERS ─────────────────────────
  console.log('  → Seeding sales orders...');
  const insSO = db.prepare(`INSERT OR IGNORE INTO sales_orders (so_number, customer_id, status, order_date, delivery_date, subtotal, tax_rate, tax_amount, total, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insSOItem = db.prepare(`INSERT OR IGNORE INTO sales_order_items (sales_order_id, model_code, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?)`);
  const soStatuses = ['completed', 'completed', 'in_production', 'in_production', 'confirmed', 'draft', 'shipped'];

  for (let i = 0; i < 20; i++) {
    const soDate = randDate(START, END);
    const customer = pick(customerList);
    const model = pick(modelList);
    const qty = randInt(30, 300);
    const unitPrice = randFloat(100, 500);
    const subtotal = +(qty * unitPrice).toFixed(2);
    const taxAmount = +(subtotal * 0.14).toFixed(2);
    const total = +(subtotal + taxAmount).toFixed(2);

    const soNum = `SO-${dd(soDate).replace(/-/g, '').slice(2)}-${pad(i + 1)}`;
    const soResult = insSO.run(soNum, customer.id, pick(soStatuses), dd(soDate), dd(addDays(soDate, randInt(14, 45))), subtotal, 14, taxAmount, total, null, pick(userIds), dt(soDate));
    if (soResult.changes === 0) continue;
    const soId = Number(soResult.lastInsertRowid);
    insSOItem.run(soId, model.model_code, model.model_name || 'موديل', qty, unitPrice, subtotal);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM sales_orders').get().c} sales orders`);

  // ─── 15. SHIPMENTS ────────────────────────────
  console.log('  → Seeding shipments...');
  const insShip = db.prepare(`INSERT OR IGNORE INTO shipments (shipment_number, shipment_type, status, customer_id, carrier_name, tracking_number, shipping_cost, packages_count, ship_date, expected_delivery, actual_delivery, shipping_address, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insShipItem = db.prepare(`INSERT OR IGNORE INTO shipment_items (shipment_id, description, model_code, quantity, unit) VALUES (?,?,?,?,?)`);
  const carriers = ['أرامكس', 'فيدكس مصر', 'النيل للشحن', 'DHL مصر', 'شحن داخلي'];
  const shipStatuses = ['delivered', 'delivered', 'delivered', 'shipped', 'in_transit', 'ready'];

  for (let i = 0; i < 30; i++) {
    const shipDate = randDate(addDays(START, 7), END);
    const customer = pick(customerList);
    const custData = CUSTOMER_DATA.find(c => c.code === customer.code);
    if (!custData) continue;
    const model = pick(modelList);
    const status = pick(shipStatuses);
    const expectedDel = addDays(shipDate, randInt(2, 10));
    const actualDel = status === 'delivered' ? dd(addDays(shipDate, randInt(1, 8))) : null;

    const shipNum = `SHP-${dd(shipDate).replace(/-/g, '').slice(2)}-${pad(i + 1)}`;
    const tracking = `TRK${randInt(100000000, 999999999)}`;
    const shipResult = insShip.run(shipNum, 'outbound', status, customer.id, pick(carriers), tracking, randFloat(50, 500), randInt(1, 10), dd(shipDate), dd(expectedDel), actualDel, custData?.address || '', null, pick(userIds), dt(shipDate));
    if (shipResult.changes === 0) continue;
    const shipId = Number(shipResult.lastInsertRowid);
    insShipItem.run(shipId, model.model_name || 'شحنة', model.model_code, randInt(20, 300), 'pcs');
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM shipments').get().c} shipments`);

  // ─── 16. EXPENSES ─────────────────────────────
  console.log('  → Seeding expenses...');
  const insExpense = db.prepare(`INSERT OR IGNORE INTO expenses (expense_type, amount, description, expense_date, status, created_by, vendor_name, payment_method, currency, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const expenseTypes = ['production', 'utilities', 'maintenance', 'transport', 'salary', 'raw_material', 'other'];
  const expenseDescs = {
    production: ['مستلزمات إنتاج', 'صيانة خط إنتاج', 'أدوات قص', 'إبر ماكينة', 'زيت ماكينات'],
    utilities: ['فاتورة كهرباء', 'فاتورة مياه', 'فاتورة غاز', 'إنترنت وتليفون'],
    maintenance: ['صيانة ماكينة خياطة', 'صيانة مكبس حراري', 'صيانة تكييف', 'قطع غيار'],
    transport: ['شحن مواد خام', 'توصيل طلبات', 'بنزين سيارة المصنع', 'نقل عمال'],
    salary: ['سلفة موظف', 'حوافز إنتاج', 'أجر عامل يومي'],
    raw_material: ['شراء أقمشة عينات', 'مستلزمات تغليف', 'كراتين شحن'],
    other: ['مصاريف ضيافة', 'أدوات مكتبية', 'رسوم حكومية', 'تأمينات اجتماعية'],
  };

  for (let i = 0; i < 80; i++) {
    const eDate = randDate(START, END);
    const eType = pick(expenseTypes);
    const desc = pick(expenseDescs[eType]);
    const amount = eType === 'utilities' ? randFloat(500, 5000) :
                   eType === 'salary' ? randFloat(1000, 8000) :
                   eType === 'maintenance' ? randFloat(200, 3000) :
                   randFloat(100, 2000);
    const status = Math.random() < 0.8 ? 'approved' : (Math.random() < 0.5 ? 'pending' : 'rejected');
    insExpense.run(eType, +amount.toFixed(2), desc, dd(eDate), status, pick(userIds), null, pick(['cash', 'bank']), 'EGP', dt(eDate));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM expenses').get().c} expenses`);

  // ─── 17. ATTENDANCE (3 months) ────────────────
  console.log('  → Seeding attendance...');
  const insAtt = db.prepare(`INSERT OR IGNORE INTO attendance (employee_id, work_date, day_of_week, scheduled_hours, actual_hours, attendance_status, late_minutes, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  let attCount = 0;

  for (const empId of employeeIds) {
    let d = new Date(START);
    while (d <= END) {
      const dayOfWeek = d.getDay();
      const dayName = dayNames[dayOfWeek];

      if (dayOfWeek === 5) { // Friday - holiday
        insAtt.run(empId, dd(d), dayName, 0, 0, 'holiday', 0, dt(d));
      } else if (dayOfWeek === 6) { // Saturday - half day sometimes
        if (Math.random() < 0.4) {
          insAtt.run(empId, dd(d), dayName, 4, randFloat(3, 5, 1), 'half_day', 0, dt(d));
        } else {
          insAtt.run(empId, dd(d), dayName, 0, 0, 'holiday', 0, dt(d));
        }
      } else {
        const rand = Math.random();
        if (rand < 0.03) { // 3% absent
          insAtt.run(empId, dd(d), dayName, 8, 0, 'absent', 0, dt(d));
        } else if (rand < 0.10) { // 7% late
          const late = randInt(5, 45);
          insAtt.run(empId, dd(d), dayName, 8, randFloat(7, 8.5, 1), 'late', late, dt(d));
        } else if (rand < 0.13) { // 3% leave
          insAtt.run(empId, dd(d), dayName, 8, 0, 'leave', 0, dt(d));
        } else { // normal
          const ot = Math.random() < 0.2 ? randFloat(1, 3, 1) : 0;
          insAtt.run(empId, dd(d), dayName, 8, +(8 + ot).toFixed(1), 'present', 0, dt(d));
        }
      }
      attCount++;
      d = addDays(d, 1);
    }
  }
  console.log(`    ✓ ${attCount} attendance records`);

  // ─── 18. PAYROLL ──────────────────────────────
  console.log('  → Seeding payroll...');
  const insPeriod = db.prepare(`INSERT OR IGNORE INTO payroll_periods (period_month, period_name, status, total_gross, total_net, total_deductions, calculated_at, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const insPayroll = db.prepare(`INSERT OR IGNORE INTO payroll_records (period_id, employee_id, days_worked, hours_worked, overtime_hours, absent_days, base_pay, overtime_pay, gross_pay, social_insurance, tax_deduction, total_deductions, net_pay, payment_status, payment_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const months = ['2026-01', '2026-02', '2026-03'];
  const monthNames = ['يناير 2026', 'فبراير 2026', 'مارس 2026'];

  for (let mi = 0; mi < months.length; mi++) {
    const month = months[mi];
    const isPaid = mi < 2; // Jan and Feb paid, March open
    const status = isPaid ? 'paid' : 'calculated';
    let totalGross = 0, totalNet = 0, totalDed = 0;

    insPeriod.run(month, monthNames[mi], status, 0, 0, 0, dt(addDays(new Date(month + '-28'), 0)), dt(new Date(month + '-01')));
    const periodId = db.prepare('SELECT id FROM payroll_periods WHERE period_month=?').get(month)?.id;
    if (!periodId) continue;

    for (const empId of employeeIds) {
      const emp = db.prepare('SELECT base_salary, employment_type FROM employees WHERE id=?').get(empId);
      if (!emp) continue;

      const daysWorked = randInt(20, 26);
      const hoursWorked = +(daysWorked * 8 + randFloat(0, 15, 1)).toFixed(1);
      const overtimeHours = randFloat(0, 15, 1);
      const absentDays = randInt(0, 3);

      let basePay = emp.employment_type === 'daily' ? emp.base_salary * daysWorked : emp.base_salary;
      const otPay = emp.employment_type === 'daily' ? emp.base_salary / 8 * 1.5 * overtimeHours : emp.base_salary / 208 * 1.5 * overtimeHours;
      const grossPay = +(basePay + otPay).toFixed(2);
      const si = +(grossPay * 0.11).toFixed(2);
      const tax = +(grossPay * 0.05).toFixed(2);
      const totalDedEmp = +(si + tax).toFixed(2);
      const netPay = +(grossPay - totalDedEmp).toFixed(2);

      insPayroll.run(periodId, empId, daysWorked, hoursWorked, overtimeHours, absentDays, +basePay.toFixed(2), +otPay.toFixed(2), grossPay, si, tax, totalDedEmp, netPay, isPaid ? 'paid' : 'pending', isPaid ? month + '-28' : null);

      totalGross += grossPay;
      totalNet += netPay;
      totalDed += totalDedEmp;
    }

    db.prepare('UPDATE payroll_periods SET total_gross=?, total_net=?, total_deductions=? WHERE id=?').run(+totalGross.toFixed(2), +totalNet.toFixed(2), +totalDed.toFixed(2), periodId);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM payroll_periods').get().c} payroll periods, ${db.prepare('SELECT COUNT(*) as c FROM payroll_records').get().c} payroll records`);

  // ─── 19. LEAVE REQUESTS ───────────────────────
  console.log('  → Seeding leave requests...');
  const insLeave = db.prepare(`INSERT OR IGNORE INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, created_at) VALUES (?,?,?,?,?,?,?)`);
  const leaveTypes = ['annual', 'annual', 'sick', 'emergency', 'annual'];
  const leaveReasons = ['إجازة سنوية', 'إجازة مرضية', 'ظرف عائلي طارئ', 'إجازة شخصية', 'إجازة زواج'];

  for (let i = 0; i < 30; i++) {
    const empId = pick(employeeIds);
    const startD = randDate(START, addDays(END, -3));
    const duration = randInt(1, 5);
    const endD = addDays(startD, duration);
    const leaveType = pick(leaveTypes);
    const status = Math.random() < 0.7 ? 'approved' : (Math.random() < 0.5 ? 'pending' : 'rejected');
    insLeave.run(empId, leaveType, dd(startD), dd(endD), pick(leaveReasons), status, dt(startD));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM leave_requests').get().c} leave requests`);

  // ─── 20. MAINTENANCE ORDERS ───────────────────
  console.log('  → Seeding maintenance orders...');
  const insMaint = db.prepare(`INSERT OR IGNORE INTO maintenance_orders (machine_id, maintenance_type, title, description, priority, status, scheduled_date, completed_date, cost, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const machineList = db.prepare('SELECT id, name FROM machines WHERE status=?').all('active');
  const maintTypes = ['preventive', 'corrective', 'routine'];
  const maintTitles = ['صيانة دورية', 'تغيير زيت', 'إصلاح عطل', 'تنظيف عام', 'تغيير إبرة', 'ضبط الشد', 'فحص كهربائي', 'تغيير حزام'];

  for (let i = 0; i < 25; i++) {
    const mDate = randDate(START, END);
    const machine = pick(machineList);
    const mType = pick(maintTypes);
    const status = Math.random() < 0.6 ? 'completed' : (Math.random() < 0.5 ? 'in_progress' : 'pending');
    const completedDate = status === 'completed' ? dd(addDays(mDate, randInt(0, 3))) : null;
    insMaint.run(machine.id, mType, pick(maintTitles), `صيانة ${machine.name}`, pick(['low', 'medium', 'high']), status, dd(mDate), completedDate, randFloat(50, 2000), pick(userIds), dt(mDate));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM maintenance_orders').get().c} maintenance orders`);

  // ─── 21. QC INSPECTIONS ────────────────────────
  console.log('  → Seeding QC inspections...');
  const insQCInsp = db.prepare(`INSERT OR IGNORE INTO qc_inspections (work_order_id, inspection_number, inspector_id, inspection_date, lot_size, sample_size, passed, failed, result, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insQCItem = db.prepare(`INSERT OR IGNORE INTO qc_inspection_items (inspection_id, check_point, result, defect_count, notes) VALUES (?,?,?,?,?)`);
  const checkPoints = ['جودة الخياطة', 'تناسق اللون', 'دقة المقاسات', 'نظافة القطعة', 'جودة التشطيب', 'سلامة الأزرار/السوست'];
  const inspectorId = userIds.length > 4 ? userIds[4] : userIds[0]; // norhan

  let qcNum = 1;
  for (const wo of woIds.filter(w => ['completed', 'in_progress'].includes(w.status))) {
    if (Math.random() < 0.3) continue; // not all WOs inspected
    const inspDate = wo.completedDate ? addDays(wo.completedDate, -randInt(0, 3)) :
                     addDays(wo.startDate, randInt(5, 20));
    if (inspDate > END) continue;

    const lotSize = wo.quantity;
    const sampleSize = Math.min(lotSize, randInt(10, 50));
    const failed = randInt(0, Math.ceil(sampleSize * 0.1));
    const passed = sampleSize - failed;
    const result = failed === 0 ? 'pass' : failed < sampleSize * 0.05 ? 'conditional' : 'fail';

    const qcNumber = `QC-${pad(qcNum)}`;
    const inspResult = insQCInsp.run(wo.id, qcNumber, inspectorId, dt(inspDate), lotSize, sampleSize, passed, failed, result, dt(inspDate));
    if (inspResult.changes === 0) continue;
    const inspId = Number(inspResult.lastInsertRowid);

    for (const cp of checkPoints) {
      const cpResult = Math.random() < 0.9 ? 'pass' : 'fail';
      insQCItem.run(inspId, cp, cpResult, cpResult === 'fail' ? randInt(1, 5) : 0, null);
    }
    qcNum++;
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM qc_inspections').get().c} QC inspections`);

  // ─── 22. SAMPLES ──────────────────────────────
  console.log('  → Seeding samples...');
  const insSample = db.prepare(`INSERT OR IGNORE INTO samples (sample_number, model_code, customer_id, status, description, cost, requested_date, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  const sampleStatuses = ['completed', 'approved', 'sent', 'in_progress', 'requested', 'converted'];

  for (let i = 0; i < 15; i++) {
    const sDate = randDate(START, END);
    const model = pick(modelList);
    const customer = pick(customerList);
    const sNum = `SMP-${pad(i + 1)}`;
    insSample.run(sNum, model.model_code, customer.id, pick(sampleStatuses), `عينة ${model.model_name || model.model_code}`, randFloat(50, 500), dd(sDate), pick(userIds), dt(sDate));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM samples').get().c} samples`);

  // ─── 23. RETURNS ──────────────────────────────
  console.log('  → Seeding returns...');
  const insReturn = db.prepare(`INSERT OR IGNORE INTO sales_returns (return_number, customer_id, return_date, reason, status, subtotal, total, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insReturnItem = db.prepare(`INSERT OR IGNORE INTO sales_return_items (return_id, description, model_code, quantity, unit_price, total) VALUES (?,?,?,?,?,?)`);
  const returnReasons = ['عيب في الخياطة', 'اختلاف لون', 'مقاس خاطئ', 'تلف أثناء الشحن', 'طلب خاطئ'];

  for (let i = 0; i < 8; i++) {
    const rDate = randDate(addDays(START, 15), END);
    const customer = pick(customerList);
    const model = pick(modelList);
    const qty = randInt(5, 30);
    const unitPrice = randFloat(100, 400);
    const subtotal = +(qty * unitPrice).toFixed(2);
    const total = +(subtotal * 1.14).toFixed(2);
    const rNum = `SR-${pad(i + 1)}`;
    const retResult = insReturn.run(rNum, customer.id, dd(rDate), pick(returnReasons), pick(['approved', 'completed', 'draft']), subtotal, total, pick(userIds), dt(rDate));
    if (retResult.changes === 0) continue;
    const retId = Number(retResult.lastInsertRowid);
    insReturnItem.run(retId, model.model_name || 'منتج', model.model_code, qty, unitPrice, subtotal);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM sales_returns').get().c} returns`);

  // ─── 24. JOURNAL ENTRIES ──────────────────────
  console.log('  → Seeding journal entries...');
  const insJE = db.prepare(`INSERT OR IGNORE INTO journal_entries (entry_number, entry_date, description, status, created_by, created_at) VALUES (?,?,?,?,?,?)`);
  const insJEL = db.prepare(`INSERT OR IGNORE INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)`);
  const accounts = db.prepare('SELECT id, code, name_ar, type FROM chart_of_accounts').all();
  const getAccId = (code) => accounts.find(a => a.code === code)?.id;

  for (let i = 0; i < 40; i++) {
    const jeDate = randDate(START, END);
    const jeNum = `JE-${dd(jeDate).replace(/-/g, '').slice(2)}-${pad(i + 1)}`;
    const status = Math.random() < 0.7 ? 'posted' : 'draft';
    const descriptions = ['تسجيل مبيعات', 'تسجيل مشتريات', 'دفع رواتب', 'مصاريف تشغيلية', 'دفع مورد', 'تحصيل عميل'];
    const desc = pick(descriptions);
    const jeResult = insJE.run(jeNum, dd(jeDate), desc, status, pick(userIds), dt(jeDate));
    if (jeResult.changes === 0) continue;
    const jeId = Number(jeResult.lastInsertRowid);

    const amount = randFloat(500, 50000);
    // Simple double-entry
    if (desc.includes('مبيعات')) {
      insJEL.run(jeId, getAccId('1200'), amount, 0, 'ذمم مدينة');
      insJEL.run(jeId, getAccId('4000'), 0, amount, 'إيرادات مبيعات');
    } else if (desc.includes('مشتريات')) {
      insJEL.run(jeId, getAccId('1300'), amount, 0, 'مخزون أقمشة');
      insJEL.run(jeId, getAccId('2000'), 0, amount, 'ذمم دائنة');
    } else if (desc.includes('رواتب')) {
      insJEL.run(jeId, getAccId('5100'), amount, 0, 'رواتب');
      insJEL.run(jeId, getAccId('1000'), 0, amount, 'نقدية');
    } else if (desc.includes('مصاريف')) {
      insJEL.run(jeId, getAccId('5200'), amount, 0, 'مصاريف تشغيلية');
      insJEL.run(jeId, getAccId('1000'), 0, amount, 'نقدية');
    } else if (desc.includes('مورد')) {
      insJEL.run(jeId, getAccId('2000'), amount, 0, 'سداد مورد');
      insJEL.run(jeId, getAccId('1100'), 0, amount, 'بنك');
    } else {
      insJEL.run(jeId, getAccId('1000'), amount, 0, 'تحصيل');
      insJEL.run(jeId, getAccId('1200'), 0, amount, 'تحصيل عميل');
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM journal_entries').get().c} journal entries`);

  // ─── 25. NOTIFICATIONS ────────────────────────
  console.log('  → Seeding notifications...');
  const insNotif = db.prepare(`INSERT OR IGNORE INTO notifications (user_id, type, title, body, reference_type, reference_id, is_read, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const notifTemplates = [
    { type: 'wo_status', title: 'تحديث أمر إنتاج', body: 'تم تحديث حالة أمر الإنتاج', ref: 'work_order' },
    { type: 'po_received', title: 'استلام أمر شراء', body: 'تم استلام شحنة من المورد', ref: 'purchase_order' },
    { type: 'low_stock', title: 'تنبيه مخزون منخفض', body: 'المخزون أقل من الحد الأدنى', ref: 'fabric' },
    { type: 'invoice_overdue', title: 'فاتورة متأخرة', body: 'تجاوزت الفاتورة تاريخ الاستحقاق', ref: 'invoice' },
    { type: 'maintenance_due', title: 'صيانة مطلوبة', body: 'موعد صيانة ماكينة', ref: 'machine' },
    { type: 'qc_fail', title: 'فشل فحص الجودة', body: 'الفحص لم يجتز معايير الجودة', ref: 'qc_inspection' },
  ];

  for (let i = 0; i < 100; i++) {
    const nDate = randDate(START, END);
    const userId = pick(userIds);
    const tmpl = pick(notifTemplates);
    insNotif.run(userId, tmpl.type, tmpl.title, tmpl.body, tmpl.ref, randInt(1, 50), Math.random() < 0.6 ? 1 : 0, dt(nDate));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM notifications').get().c} notifications`);

  // ─── 26. AUDIT LOG ────────────────────────────
  console.log('  → Seeding audit log...');
  const insAudit = db.prepare(`INSERT OR IGNORE INTO audit_log (user_id, username, action, entity_type, entity_id, entity_label, created_at) VALUES (?,?,?,?,?,?,?)`);
  const auditActions = ['create', 'update', 'delete', 'status_change', 'login', 'export'];
  const entityTypes = ['model', 'work_order', 'purchase_order', 'invoice', 'fabric', 'accessory', 'supplier', 'customer', 'employee', 'expense'];

  for (let i = 0; i < 200; i++) {
    const aDate = randDate(START, END);
    const userIdx = randInt(0, userIds.length - 1);
    const user = USER_DATA[userIdx];
    const userId = userIds[userIdx];
    insAudit.run(userId, user?.username || 'system', pick(auditActions), pick(entityTypes), String(randInt(1, 50)), null, dt(aDate));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM audit_log').get().c} audit log entries`);

  // ─── 27. STAGE MOVEMENT LOG ───────────────────
  console.log('  → Seeding stage movement log...');
  const insMove = db.prepare(`INSERT OR IGNORE INTO stage_movement_log (wo_id, from_stage_name, to_stage_name, qty_moved, moved_by_name, moved_at, notes) VALUES (?,?,?,?,?,?,?)`);
  const stageNames = stages.map(s => s.name);

  for (const wo of woIds.filter(w => ['completed', 'in_progress'].includes(w.status))) {
    const moveCount = randInt(3, 10);
    for (let m = 0; m < moveCount; m++) {
      const fromIdx = randInt(0, stageNames.length - 2);
      const moveDate = addDays(wo.startDate, randInt(1, 25));
      if (moveDate > END) continue;
      const mover = pick(EMPLOYEE_DATA.filter(e => e.dept === 'الإنتاج'));
      insMove.run(wo.id, stageNames[fromIdx], stageNames[fromIdx + 1], randInt(10, wo.quantity), mover?.name || 'عامل', dt(moveDate), null);
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM stage_movement_log').get().c} stage movements`);

  // ─── 28. FABRIC & ACCESSORY STOCK MOVEMENTS ──
  console.log('  → Seeding stock movements...');
  const insFSM = db.prepare(`INSERT OR IGNORE INTO fabric_stock_movements (fabric_code, movement_type, qty_meters, reference_type, reference_id, notes, created_at) VALUES (?,?,?,?,?,?,?)`);
  const insASM = db.prepare(`INSERT OR IGNORE INTO accessory_stock_movements (accessory_code, movement_type, qty, reference_type, reference_id, notes, created_at) VALUES (?,?,?,?,?,?,?)`);

  // Fabric: inbound from PO batches
  for (const batch of fabricBatches) {
    insFSM.run(batch.fabricCode, 'in', batch.receivedMeters, 'purchase_order', batch.poId, `استلام دفعة ${batch.id}`, dt(randDate(START, END)));
    if (batch.usedMeters > 0) {
      insFSM.run(batch.fabricCode, 'out', -batch.usedMeters, 'work_order', null, `صرف للإنتاج`, dt(randDate(START, END)));
    }
    if (batch.wastedMeters > 0) {
      insFSM.run(batch.fabricCode, 'adjustment', -batch.wastedMeters, 'work_order', null, `هالك إنتاج`, dt(randDate(START, END)));
    }
  }
  // Accessory: inbound from PO batches
  for (const batch of accBatches) {
    insASM.run(batch.accCode, 'in', batch.receivedQty, 'purchase_order', batch.poId, `استلام دفعة ${batch.id}`, dt(randDate(START, END)));
    if (batch.usedQty > 0) {
      insASM.run(batch.accCode, 'out', batch.usedQty, 'work_order', null, `صرف للإنتاج`, dt(randDate(START, END)));
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM fabric_stock_movements').get().c} fabric movements, ${db.prepare('SELECT COUNT(*) as c FROM accessory_stock_movements').get().c} accessory movements`);

  // ─── 29. PURCHASE RETURNS ─────────────────────
  console.log('  → Seeding purchase returns...');
  const insPR = db.prepare(`INSERT OR IGNORE INTO purchase_returns (return_number, purchase_order_id, supplier_id, return_date, reason, status, subtotal, tax_amount, total, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insPRItem = db.prepare(`INSERT OR IGNORE INTO purchase_return_items (return_id, item_type, item_code, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?,?)`);
  const prReasons = ['عيب في القماش', 'لون مختلف عن الطلب', 'كمية زائدة', 'مواد تالفة', 'خطأ في التوريد'];

  const receivedPOs = db.prepare("SELECT id, supplier_id FROM purchase_orders WHERE status='received'").all();
  for (let i = 0; i < 6; i++) {
    const po = pick(receivedPOs);
    if (!po) continue;
    const rDate = randDate(addDays(START, 20), END);
    const rNum = `PR-${pad(i + 1)}`;
    const qty = randFloat(5, 50, 0);
    const unitPrice = randFloat(50, 200);
    const subtotal = +(qty * unitPrice).toFixed(2);
    const taxAmount = +(subtotal * 0.14).toFixed(2);
    const total = +(subtotal + taxAmount).toFixed(2);
    const prResult = insPR.run(rNum, po.id, po.supplier_id, dd(rDate), pick(prReasons), pick(['approved', 'completed', 'draft']), subtotal, taxAmount, total, null, pick(userIds), dt(rDate));
    if (prResult.changes === 0) continue;
    const prId = Number(prResult.lastInsertRowid);
    const poItem = db.prepare('SELECT fabric_code, accessory_code, description, unit_price FROM purchase_order_items WHERE po_id=? LIMIT 1').get(po.id);
    const itemType = poItem?.fabric_code ? 'fabric' : 'accessory';
    const itemCode = poItem?.fabric_code || poItem?.accessory_code || '';
    insPRItem.run(prId, itemType, itemCode, poItem?.description || 'مرتجع', qty, unitPrice, subtotal);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM purchase_returns').get().c} purchase returns`);

  // ─── 30. QC TEMPLATES ─────────────────────────
  console.log('  → Seeding QC templates...');
  const insQCTmpl = db.prepare(`INSERT OR IGNORE INTO qc_templates (name, model_code, description, aql_level, inspection_type, is_active, created_at) VALUES (?,?,?,?,?,?,?)`);
  const insQCTmplItem = db.prepare(`INSERT OR IGNORE INTO qc_template_items (template_id, check_point, category, severity, accept_criteria, sort_order) VALUES (?,?,?,?,?,?)`);

  const qcTemplates = [
    { name: 'فحص ملابس عامة', model: null, desc: 'قالب فحص عام لجميع الملابس', aql: 'II', type: 'normal' },
    { name: 'فحص عبايات متميز', model: 'ABY-001', desc: 'فحص تفصيلي للعبايات المطرزة', aql: 'I', type: 'tightened' },
    { name: 'فحص يونيفورم', model: 'UNF-001', desc: 'فحص سريع لليونيفورم المدرسي', aql: 'III', type: 'reduced' },
    { name: 'فحص فساتين سواريه', model: 'DRS-003', desc: 'فحص دقيق لفساتين السهرة', aql: 'I', type: 'tightened' },
    { name: 'فحص جاكيتات', model: 'JKT-002', desc: 'فحص جاكيتات جينز وبومبر', aql: 'II', type: 'normal' },
  ];

  const qcCheckPoints = [
    { cp: 'استقامة الخياطة', cat: 'stitching', sev: 'major', criteria: 'لا انحراف أكثر من 1مم' },
    { cp: 'تناسق اللون', cat: 'visual', sev: 'major', criteria: 'متطابق مع عينة الماستر' },
    { cp: 'دقة المقاسات', cat: 'measurement', sev: 'critical', criteria: 'ضمن ±1سم من جدول المقاسات' },
    { cp: 'نظافة القطعة', cat: 'visual', sev: 'minor', criteria: 'خالية من البقع والأتربة' },
    { cp: 'جودة التشطيب', cat: 'finishing', sev: 'minor', criteria: 'حواف نظيفة بدون خيوط ظاهرة' },
    { cp: 'سلامة الأزرار', cat: 'accessories', sev: 'minor', criteria: 'مثبتة بإحكام - لا تسقط خلال الشد' },
    { cp: 'سحاب سلس', cat: 'accessories', sev: 'major', criteria: 'يفتح ويغلق بدون عوائق' },
    { cp: 'تماثل الأجزاء', cat: 'measurement', sev: 'major', criteria: 'الطرفان متماثلان ±2مم' },
    { cp: 'جودة التطريز', cat: 'stitching', sev: 'major', criteria: 'منتظم ومتصل بدون فراغات' },
    { cp: 'قوة القماش', cat: 'fabric', sev: 'critical', criteria: 'لا تمزق عند الشد المعقول' },
  ];

  for (const tmpl of qcTemplates) {
    const tmplResult = insQCTmpl.run(tmpl.name, tmpl.model, tmpl.desc, tmpl.aql, tmpl.type, 1, dt(addDays(START, -randInt(5, 30))));
    if (tmplResult.changes === 0) continue;
    const tid = Number(tmplResult.lastInsertRowid);
    const cpList = tmpl.type === 'tightened' ? qcCheckPoints : pickN(qcCheckPoints, randInt(5, 8));
    cpList.forEach((cp, i) => {
      insQCTmplItem.run(tid, cp.cp, cp.cat, cp.sev, cp.criteria, i + 1);
    });
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM qc_templates').get().c} QC templates`);

  // ─── 31. QC Non-Conformance Reports ──────────
  console.log('  → Seeding NCR records...');
  const insNCR = db.prepare(`INSERT OR IGNORE INTO qc_ncr (ncr_number, inspection_id, work_order_id, severity, description, root_cause, corrective_action, preventive_action, status, assigned_to, due_date, closed_date, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const failedInspections = db.prepare("SELECT id, work_order_id FROM qc_inspections WHERE result IN ('fail','conditional')").all();
  const ncrDescs = [
    { desc: 'خياطة غير منتظمة في الياقة', root: 'إبرة ماكينة بالية', corrective: 'تغيير الإبرة وإعادة الخياطة', preventive: 'جدول فحص إبر أسبوعي' },
    { desc: 'اختلاف درجة لون القماش', root: 'دفعة قماش مختلفة', corrective: 'فرز واستبدال القطع المتأثرة', preventive: 'فحص اللون قبل القص' },
    { desc: 'مقاس أصغر من المطلوب', root: 'خطأ في الباترون', corrective: 'تعديل الباترون وإعادة القص', preventive: 'مراجعة ثنائية للباترون' },
    { desc: 'سحاب معيب', root: 'دفعة سحابات معيبة من المورد', corrective: 'استبدال السحابات المعيبة', preventive: 'فحص عينات المستلزمات عند الاستلام' },
    { desc: 'خيط ظاهر في التشطيب', root: 'عدم قص الخيوط الزائدة', corrective: 'إعادة تشطيب القطع', preventive: 'تشديد مراقبة مرحلة التشطيب' },
  ];

  let ncrNum = 1;
  for (const insp of failedInspections.slice(0, 8)) {
    const ncrData = pick(ncrDescs);
    const ncrDate = randDate(addDays(START, 10), END);
    const status = pick(['open', 'investigating', 'resolved', 'closed']);
    const closedDate = status === 'closed' ? dd(addDays(ncrDate, randInt(3, 15))) : null;
    insNCR.run(`NCR-${pad(ncrNum)}`, insp.id, insp.work_order_id, pick(['minor', 'major', 'critical']),
      ncrData.desc, ncrData.root, ncrData.corrective, ncrData.preventive,
      status, pick(userIds), dd(addDays(ncrDate, randInt(5, 20))), closedDate, pick(userIds), dt(ncrDate));
    ncrNum++;
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM qc_ncr').get().c} NCRs`);

  // ─── 32. PRODUCTION SCHEDULE ──────────────────
  console.log('  → Seeding production schedule...');
  const insProdSched = db.prepare(`INSERT OR IGNORE INTO production_schedule (work_order_id, production_line_id, machine_id, planned_start, planned_end, actual_start, actual_end, priority, status, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

  const activeWOs = woIds.filter(w => ['in_progress', 'completed', 'pending'].includes(w.status));
  const prodLineId = db.prepare('SELECT id FROM production_lines LIMIT 1').get()?.id || 1;

  for (const wo of activeWOs.slice(0, 40)) {
    const pStart = dd(wo.startDate);
    const pEnd = dd(addDays(wo.startDate, randInt(7, 28)));
    const aStart = wo.status !== 'pending' ? pStart : null;
    const aEnd = wo.status === 'completed' && wo.completedDate ? dd(wo.completedDate) : null;
    const schedStatus = wo.status === 'completed' ? 'completed' : wo.status === 'in_progress' ? 'in_progress' : 'planned';
    const machId = machineIds.length > 0 ? pick(machineIds) : null;
    insProdSched.run(wo.id, prodLineId, machId, pStart, pEnd, aStart, aEnd, randInt(1, 10), schedStatus, null, pick(userIds), dt(wo.startDate));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM production_schedule').get().c} production schedules`);

  // ─── 33. PACKING LISTS ────────────────────────
  console.log('  → Seeding packing lists...');
  const insPackList = db.prepare(`INSERT OR IGNORE INTO packing_lists (shipment_id, box_number, contents, quantity, weight, dimensions, notes) VALUES (?,?,?,?,?,?,?)`);

  const allShipments = db.prepare("SELECT id FROM shipments WHERE status IN ('shipped','delivered','in_transit')").all();
  for (const ship of allShipments) {
    const boxCount = randInt(1, 5);
    for (let b = 1; b <= boxCount; b++) {
      insPackList.run(ship.id, b, pick(['قمصان', 'بنطلونات', 'فساتين', 'عبايات', 'تيشيرتات', 'جاكيتات']),
        randInt(10, 60), randFloat(2, 15, 1), `${randInt(30, 60)}x${randInt(30, 50)}x${randInt(20, 40)}سم`, null);
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM packing_lists').get().c} packing list entries`);

  // ─── 34. CUSTOMER CONTACTS ────────────────────
  console.log('  → Seeding customer contacts...');
  const insCustContact = db.prepare(`INSERT OR IGNORE INTO customer_contacts (customer_id, name, title, phone, email, is_primary, created_at) VALUES (?,?,?,?,?,?,?)`);

  const allCustomerIds = db.prepare('SELECT id, name FROM customers').all();
  const contactTitles = ['مدير المشتريات', 'مسؤول الاستلام', 'المدير المالي', 'مدير المبيعات', 'مسؤول الجودة'];
  const contactNames = ['أحمد محمود', 'سارة خالد', 'محمد إبراهيم', 'فاطمة حسن', 'عمر طارق', 'هدى سعيد', 'كريم وائل', 'نور المصري'];

  for (const cust of allCustomerIds) {
    const contactCount = randInt(1, 3);
    for (let c = 0; c < contactCount; c++) {
      const name = pick(contactNames);
      insCustContact.run(cust.id, name, pick(contactTitles), '01' + randInt(0, 2) + String(randInt(10000000, 99999999)),
        name.split(' ')[0].toLowerCase() + '@' + pick(['gmail.com', 'company.com', 'outlook.com']),
        c === 0 ? 1 : 0, dt(addDays(START, -randInt(10, 90))));
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM customer_contacts').get().c} customer contacts`);

  // ─── 35. CUSTOMER NOTES ───────────────────────
  console.log('  → Seeding customer notes...');
  const insCustNote = db.prepare(`INSERT OR IGNORE INTO customer_notes (customer_id, note, created_by, created_at) VALUES (?,?,?,?)`);

  const noteTemplates = [
    'العميل يفضل التسليم صباحاً قبل 10',
    'يطلب دائماً عينة قبل الإنتاج الكبير',
    'ملاحظة: يتأخر في السداد أحياناً',
    'عميل مميز - أولوية في التسليم',
    'يحتاج فواتير مفصلة بالمقاسات',
    'طلب تغيير تصميم الليبل الخاص به',
    'زيارة تفقدية للمصنع الأسبوع القادم',
    'اهتمام بخط الإنتاج الجديد للعبايات',
    'طلب عرض أسعار لموسم الصيف',
    'تم الاتفاق على خصم 5% للطلبات فوق 1000 قطعة',
  ];

  for (const cust of allCustomerIds) {
    const noteCount = randInt(1, 4);
    for (let n = 0; n < noteCount; n++) {
      insCustNote.run(cust.id, pick(noteTemplates), pick(userIds), dt(randDate(START, END)));
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM customer_notes').get().c} customer notes`);

  // ─── 36. LEAVE BALANCES ───────────────────────
  console.log('  → Seeding leave balances...');
  const insLeaveBalance = db.prepare(`INSERT OR IGNORE INTO leave_balances (employee_id, leave_type, year, entitled_days, used_days, carried_over) VALUES (?,?,?,?,?,?)`);
  const leaveBalTypes = ['annual', 'sick', 'emergency'];

  for (const empId of employeeIds) {
    for (const lt of leaveBalTypes) {
      const entitled = lt === 'annual' ? 21 : lt === 'sick' ? 15 : 3;
      const used = randFloat(0, entitled * 0.6, 0);
      const carried = lt === 'annual' ? randFloat(0, 5, 0) : 0;
      insLeaveBalance.run(empId, lt, 2026, entitled, used, carried);
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM leave_balances').get().c} leave balances`);

  // ─── 37. MAINTENANCE PARTS ────────────────────
  console.log('  → Seeding maintenance parts...');
  const insMaintPart = db.prepare(`INSERT OR IGNORE INTO maintenance_parts (mo_id, part_name, part_number, quantity, unit_cost, supplier, notes) VALUES (?,?,?,?,?,?,?)`);
  const partNames = [
    { name: 'إبرة ماكينة', pn: 'NDL-001', cost: 5 },
    { name: 'حزام ناقل', pn: 'BLT-001', cost: 120 },
    { name: 'محرك سيرفو', pn: 'SRV-001', cost: 800 },
    { name: 'لوحة تحكم', pn: 'PCB-001', cost: 1500 },
    { name: 'زيت تشحيم', pn: 'OIL-001', cost: 45 },
    { name: 'ترس بلاستيك', pn: 'GER-001', cost: 35 },
    { name: 'مقص دائري', pn: 'BLD-001', cost: 250 },
    { name: 'قدم ماكينة', pn: 'FT-001', cost: 60 },
  ];

  const maintOrders = db.prepare('SELECT id FROM maintenance_orders').all();
  for (const mo of maintOrders) {
    const partCount = randInt(1, 3);
    const parts = pickN(partNames, partCount);
    for (const p of parts) {
      insMaintPart.run(mo.id, p.name, p.pn, randInt(1, 5), p.cost, pick(['قطع غيار جوكي', 'مستلزمات سنجر', 'المتحدة للقطع']), null);
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM maintenance_parts').get().c} maintenance parts`);

  // ─── 38. WO EXTRA EXPENSES ────────────────────
  console.log('  → Seeding WO extra expenses...');
  const insWOExpense = db.prepare(`INSERT OR IGNORE INTO wo_extra_expenses (wo_id, description, amount, recorded_at, notes) VALUES (?,?,?,?,?)`);
  const extraExpDescs = ['أجرة عمالة إضافية', 'مواد تغليف خاصة', 'نقل عاجل', 'مصاريف تطريز خارجي', 'أقمشة بديلة', 'طباعة خاصة'];

  for (const wo of woIds.filter(w => w.status === 'completed' || w.status === 'in_progress')) {
    if (Math.random() < 0.6) continue; // 40% of WOs have extra expenses
    const expCount = randInt(1, 3);
    for (let e = 0; e < expCount; e++) {
      insWOExpense.run(wo.id, pick(extraExpDescs), randFloat(100, 2000), dt(randDate(wo.startDate, END)), null);
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM wo_extra_expenses').get().c} WO extra expenses`);

  // ─── 39. HR ADJUSTMENTS ───────────────────────
  console.log('  → Seeding HR adjustments...');
  const insHRAdj = db.prepare(`INSERT OR IGNORE INTO hr_adjustments (employee_id, period_id, adj_type, amount, description, applied, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const adjTypes = [
    { type: 'bonus', desc: 'حافز إنتاج', min: 200, max: 1500 },
    { type: 'bonus', desc: 'مكافأة تميز', min: 500, max: 2000 },
    { type: 'deduction', desc: 'خصم تأخير', min: 50, max: 300 },
    { type: 'deduction', desc: 'خصم غياب', min: 100, max: 500 },
    { type: 'loan', desc: 'سلفة شخصية', min: 1000, max: 5000 },
    { type: 'loan_repayment', desc: 'قسط سلفة', min: 200, max: 1000 },
    { type: 'advance', desc: 'عهدة مالية', min: 500, max: 3000 },
  ];

  const payrollPeriods = db.prepare('SELECT id FROM payroll_periods').all();
  for (let i = 0; i < 30; i++) {
    const empId = pick(employeeIds);
    const period = pick(payrollPeriods);
    const adj = pick(adjTypes);
    const amount = randFloat(adj.min, adj.max, 0);
    insHRAdj.run(empId, period?.id || null, adj.type, amount, adj.desc, Math.random() < 0.7 ? 1 : 0, pick(userIds), dt(randDate(START, END)));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM hr_adjustments').get().c} HR adjustments`);

  // ─── 40. DOCUMENTS ────────────────────────────
  console.log('  → Seeding documents...');
  const insDoc = db.prepare(`INSERT OR IGNORE INTO documents (entity_type, entity_id, file_name, file_path, file_type, file_size, category, title, description, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const docTypes = [
    { entity: 'work_order', cat: 'specification', title: 'مواصفات فنية', ext: 'pdf' },
    { entity: 'work_order', cat: 'pattern', title: 'ملف باترون', ext: 'pdf' },
    { entity: 'model', cat: 'design', title: 'تصميم الموديل', ext: 'png' },
    { entity: 'model', cat: 'tech_pack', title: 'ملف تقني', ext: 'pdf' },
    { entity: 'invoice', cat: 'receipt', title: 'إيصال دفع', ext: 'pdf' },
    { entity: 'purchase_order', cat: 'contract', title: 'عقد توريد', ext: 'pdf' },
    { entity: 'supplier', cat: 'license', title: 'رخصة تجارية', ext: 'pdf' },
    { entity: 'customer', cat: 'agreement', title: 'اتفاقية تعاون', ext: 'pdf' },
    { entity: 'employee', cat: 'id_document', title: 'صورة بطاقة', ext: 'jpg' },
    { entity: 'maintenance_order', cat: 'report', title: 'تقرير صيانة', ext: 'pdf' },
  ];

  for (let i = 0; i < 40; i++) {
    const doc = pick(docTypes);
    const entityId = randInt(1, 15);
    const fileName = `${doc.cat}_${entityId}_${randInt(1000, 9999)}.${doc.ext}`;
    insDoc.run(doc.entity, entityId, fileName, `/uploads/documents/${fileName}`, doc.ext, randInt(10000, 5000000), doc.cat, doc.title, `${doc.title} - مستند ${i + 1}`, pick(userIds), dt(randDate(START, END)));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM documents').get().c} documents`);

  // ─── 41. WAREHOUSE ZONES ──────────────────────
  console.log('  → Seeding warehouse zones...');
  const insWHZone = db.prepare(`INSERT OR IGNORE INTO warehouse_zones (warehouse_id, code, name, zone_type, created_at) VALUES (?,?,?,?,?)`);
  const mainWH = db.prepare("SELECT id FROM warehouses WHERE code='MAIN'").get();
  const whId = mainWH ? mainWH.id : 1;

  const zones = [
    { code: 'Z-FAB', name: 'منطقة الأقمشة', type: 'storage' },
    { code: 'Z-ACC', name: 'منطقة الإكسسوارات', type: 'storage' },
    { code: 'Z-FIN', name: 'منطقة المنتج النهائي', type: 'storage' },
    { code: 'Z-RCV', name: 'منطقة الاستلام', type: 'receiving' },
    { code: 'Z-SHP', name: 'منطقة الشحن', type: 'shipping' },
    { code: 'Z-QC', name: 'منطقة فحص الجودة', type: 'staging' },
  ];

  for (const z of zones) {
    insWHZone.run(whId, z.code, z.name, z.type, dt(addDays(START, -30)));
  }
  const zoneIds = db.prepare('SELECT id, code FROM warehouse_zones WHERE warehouse_id=?').all(whId);
  console.log(`    ✓ ${zoneIds.length} warehouse zones`);

  // ─── 42. LOCATION STOCK ───────────────────────
  console.log('  → Seeding location stock...');
  const insFLS = db.prepare(`INSERT OR IGNORE INTO fabric_location_stock (fabric_code, warehouse_id, zone_id, batch_id, quantity_meters) VALUES (?,?,?,?,?)`);
  const insALS = db.prepare(`INSERT OR IGNORE INTO accessory_location_stock (accessory_code, warehouse_id, zone_id, batch_id, quantity) VALUES (?,?,?,?,?)`);
  const fabZone = zoneIds.find(z => z.code === 'Z-FAB');
  const accZone = zoneIds.find(z => z.code === 'Z-ACC');

  // Fabric location stock from available batches
  const availFabBatches = db.prepare("SELECT id, fabric_code, received_meters - used_meters - wasted_meters as avail FROM fabric_inventory_batches WHERE batch_status='available'").all();
  for (const b of availFabBatches) {
    if (b.avail > 0 && fabZone) {
      insFLS.run(b.fabric_code, whId, fabZone.id, b.id, +(b.avail).toFixed(2));
    }
  }
  // Accessory location stock from available batches
  const availAccBatches = db.prepare("SELECT id, accessory_code, received_qty - used_qty as avail FROM accessory_inventory_batches WHERE batch_status='available'").all();
  for (const b of availAccBatches) {
    if (b.avail > 0 && accZone) {
      insALS.run(b.accessory_code, whId, accZone.id, b.id, +(b.avail).toFixed(2));
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM fabric_location_stock').get().c} fabric location records, ${db.prepare('SELECT COUNT(*) as c FROM accessory_location_stock').get().c} accessory location records`);

  // ─── 43. REPORT SCHEDULES ─────────────────────
  console.log('  → Seeding report schedules...');
  const insReportSched = db.prepare(`INSERT OR IGNORE INTO report_schedules (name, report_type, frequency, day_of_week, day_of_month, hour, recipients, filters, format, enabled, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

  const reportSchedules = [
    { name: 'تقرير الإنتاج الأسبوعي', type: 'production', freq: 'weekly', dow: 0, dom: 1, hour: 8, format: 'xlsx' },
    { name: 'تقرير المخزون الشهري', type: 'inventory', freq: 'monthly', dow: 0, dom: 1, hour: 9, format: 'xlsx' },
    { name: 'تقرير المبيعات اليومي', type: 'sales', freq: 'daily', dow: 0, dom: 1, hour: 18, format: 'csv' },
    { name: 'تقرير المصاريف الشهري', type: 'expenses', freq: 'monthly', dow: 0, dom: 5, hour: 10, format: 'xlsx' },
    { name: 'تقرير الرواتب الشهري', type: 'payroll', freq: 'monthly', dow: 0, dom: 28, hour: 12, format: 'xlsx' },
    { name: 'تقرير الجودة الأسبوعي', type: 'quality', freq: 'weekly', dow: 4, dom: 1, hour: 14, format: 'xlsx' },
  ];

  for (const rs of reportSchedules) {
    insReportSched.run(rs.name, rs.type, rs.freq, rs.dow, rs.dom, rs.hour,
      JSON.stringify(['admin@wkhub.com', 'manager@wkhub.com']),
      '{}', rs.format, 1, pick(userIds), dt(addDays(START, -randInt(1, 30))));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM report_schedules').get().c} report schedules`);

  // ─── 44. MRP RUNS ─────────────────────────────
  console.log('  → Seeding MRP runs...');
  const insMRPRun = db.prepare(`INSERT OR IGNORE INTO mrp_runs (run_date, status, notes, created_by, created_at) VALUES (?,?,?,?,?)`);
  const insMRPSugg = db.prepare(`INSERT OR IGNORE INTO mrp_suggestions (mrp_run_id, item_type, item_id, item_code, item_name, required_qty, on_hand_qty, on_order_qty, shortage_qty, suggested_qty, supplier_id, supplier_name, unit_price, total_cost, po_created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  for (let i = 0; i < 5; i++) {
    const runDate = randDate(START, END);
    const status = pick(['draft', 'confirmed', 'confirmed', 'confirmed']);
    const mrpResult = insMRPRun.run(dt(runDate), status, `تشغيل MRP رقم ${i + 1}`, pick(userIds), dt(runDate));
    if (mrpResult.changes === 0) continue;
    const mrpId = Number(mrpResult.lastInsertRowid);

    // Generate 3-8 suggestions per run
    const suggCount = randInt(3, 8);
    for (let j = 0; j < suggCount; j++) {
      const isFabric = Math.random() < 0.6;
      if (isFabric) {
        const fab = pick(fabricList);
        const required = randFloat(100, 500, 0);
        const onHand = randFloat(0, 200, 0);
        const onOrder = randFloat(0, 100, 0);
        const shortage = Math.max(0, required - onHand - onOrder);
        const suggested = +(shortage * 1.2).toFixed(0);
        const sup = pick(supplierList.filter(s => s.supplier_type === 'fabric' || s.supplier_type === 'both'));
        const price = fab.price_per_m;
        insMRPSugg.run(mrpId, 'fabric', 0, fab.code, fab.name, required, onHand, onOrder, shortage, suggested,
          sup?.id || null, sup?.name || '', price, +(suggested * price).toFixed(2), status === 'confirmed' && Math.random() < 0.5 ? 1 : 0);
      } else {
        const acc = pick(accList);
        const required = randFloat(200, 2000, 0);
        const onHand = randFloat(0, 500, 0);
        const onOrder = randFloat(0, 200, 0);
        const shortage = Math.max(0, required - onHand - onOrder);
        const suggested = +(shortage * 1.2).toFixed(0);
        const sup = pick(supplierList.filter(s => s.supplier_type === 'accessory' || s.supplier_type === 'both'));
        const price = acc.unit_price;
        insMRPSugg.run(mrpId, 'accessory', 0, acc.code, acc.name, required, onHand, onOrder, shortage, suggested,
          sup?.id || null, sup?.name || '', price, +(suggested * price).toFixed(2), 0);
      }
    }
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM mrp_runs').get().c} MRP runs, ${db.prepare('SELECT COUNT(*) as c FROM mrp_suggestions').get().c} suggestions`);

  // ─── 45. WO STAGE QC ─────────────────────────
  console.log('  → Seeding stage-level QC...');
  const insStageQC = db.prepare(`INSERT OR IGNORE INTO wo_stage_qc (wo_id, stage_id, checked_by, checked_at, items_checked, items_passed, items_failed, defect_notes, qc_status) VALUES (?,?,?,?,?,?,?,?,?)`);

  const completedWOStages = db.prepare("SELECT ws.id as stage_id, ws.wo_id, ws.quantity_completed FROM wo_stages ws WHERE ws.status='completed' AND ws.stage_name IN ('خياطة','تشطيب','مراجعة جودة') AND ws.quantity_completed > 0").all();
  for (const stg of completedWOStages.slice(0, 60)) {
    const checked = stg.quantity_completed;
    const failed = Math.random() < 0.15 ? randInt(1, Math.ceil(checked * 0.05)) : 0;
    const passed = checked - failed;
    const qcStatus = failed === 0 ? 'passed' : failed < checked * 0.03 ? 'partial' : 'failed';
    insStageQC.run(stg.wo_id, stg.stage_id, pick(userIds), dt(randDate(START, END)), checked, passed, failed,
      failed > 0 ? pick(['خيط ظاهر', 'عدم تماثل', 'بقعة', 'خياطة منحرفة']) : null, qcStatus);
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM wo_stage_qc').get().c} stage QC records`);

  // ─── 46. ADDITIONAL PRODUCTION LINES ──────────
  console.log('  → Seeding production lines...');
  const insProdLine = db.prepare(`INSERT OR IGNORE INTO production_lines (name, description, capacity_per_day, status, created_at) VALUES (?,?,?,?,?)`);
  const extraLines = [
    { name: 'خط إنتاج فرعي', desc: 'خط إنتاج ثانوي للطلبات الصغيرة', cap: 200, status: 'active' },
    { name: 'خط التطريز', desc: 'خط مخصص للتطريز والزخرفة', cap: 100, status: 'active' },
    { name: 'خط العينات', desc: 'خط الإنتاج التجريبي للعينات', cap: 50, status: 'active' },
  ];
  for (const line of extraLines) {
    insProdLine.run(line.name, line.desc, line.cap, line.status, dt(addDays(START, -60)));
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM production_lines').get().c} production lines`);

  // ─── 47. SALES ORDER ITEMS (fix missing) ──────
  console.log('  → Fixing sales order items...');
  const soWithoutItems = db.prepare(`SELECT so.id, so.so_number, so.subtotal FROM sales_orders so WHERE NOT EXISTS (SELECT 1 FROM sales_order_items WHERE sales_order_id = so.id)`).all();
  const insSOItemFix = db.prepare(`INSERT INTO sales_order_items (sales_order_id, model_code, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?)`);
  for (const so of soWithoutItems) {
    const model = pick(modelList);
    const qty = randInt(30, 300);
    const unitPrice = so.subtotal > 0 ? +(so.subtotal / qty).toFixed(2) : randFloat(100, 500);
    const total = +(qty * unitPrice).toFixed(2);
    insSOItemFix.run(so.id, model.model_code, model.model_name || 'موديل', qty, unitPrice, total);
  }
  console.log(`    ✓ Fixed ${soWithoutItems.length} sales orders with missing items`);

  // ─── 48. ADDITIONAL INVOICES (sent/overdue for active period) ─
  console.log('  → Seeding late-period invoices...');
  const marchWOs = woIds.filter(w => w.status === 'completed' && w.startDate >= addDays(END, -40));
  for (let i = 0; i < Math.min(10, marchWOs.length); i++) {
    const wo = marchWOs[i];
    const model = db.prepare('SELECT model_code, model_name FROM models WHERE id=?').get(wo.modelId);
    const customer = pick(customerList);
    const custData = CUSTOMER_DATA.find(c => c.code === customer.code);
    if (!custData) continue;
    const invoiceDate = wo.completedDate ? addDays(wo.completedDate, randInt(0, 3)) : addDays(END, -randInt(5, 20));
    if (invoiceDate > END) continue;

    const unitPrice = randFloat(100, 600);
    const subtotal = +(wo.quantity * unitPrice).toFixed(2);
    const taxPct = 14;
    const total = +(subtotal * (1 + taxPct / 100)).toFixed(2);
    const dueDate = addDays(invoiceDate, randInt(15, 60));
    const status = dueDate < END ? 'overdue' : 'sent';

    const invNumber = `INV-${dd(invoiceDate).replace(/-/g, '').slice(2)}-${pad(invNum)}`;
    try {
      const inv2Result = insInv.run(invNumber, custData.name, custData.phone, customer.id, wo.id, status, taxPct, 0, subtotal, total, dd(dueDate), null, dt(invoiceDate));
      const invId = Number(inv2Result.lastInsertRowid);
      insInvItem.run(invId, model?.model_name || 'منتج', model?.model_code, wo.quantity, unitPrice, subtotal, 1);
      invNum++;
    } catch(e) {} // duplicate WO invoice links may fail
  }
  console.log(`    ✓ ${db.prepare('SELECT COUNT(*) as c FROM invoices').get().c} total invoices`);

}); // end transaction

// ═══════════════════════════════════════════════════
// EXECUTE
// ═══════════════════════════════════════════════════
try {
  seedAll();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Seed completed in ${elapsed}s`);

  // ─── SUMMARY ──────────────────────────────────
  console.log('\n═══ SEED SUMMARY ═══');
  const tables = [
    'suppliers', 'customers', 'employees', 'users', 'fabrics', 'accessories',
    'models', 'machines', 'bom_templates', 'purchase_orders', 'purchase_order_items',
    'fabric_inventory_batches', 'accessory_inventory_batches', 'supplier_payments',
    'work_orders', 'wo_stages', 'wo_sizes', 'wo_fabric_batches', 'wo_accessories_detail',
    'wo_fabric_consumption', 'wo_accessory_consumption', 'wo_waste', 'wo_extra_expenses', 'wo_stage_qc',
    'cost_snapshots', 'invoices', 'invoice_items', 'customer_payments',
    'quotations', 'sales_orders', 'sales_order_items', 'shipments', 'packing_lists',
    'expenses', 'attendance', 'payroll_periods',
    'payroll_records', 'hr_adjustments', 'leave_requests', 'leave_balances',
    'maintenance_orders', 'maintenance_parts',
    'qc_inspections', 'qc_templates', 'qc_template_items', 'qc_ncr',
    'samples', 'sales_returns', 'purchase_returns', 'purchase_return_items',
    'journal_entries', 'notifications', 'audit_log',
    'stage_movement_log', 'fabric_stock_movements', 'accessory_stock_movements',
    'production_lines', 'production_schedule', 'mrp_runs', 'mrp_suggestions',
    'documents', 'customer_contacts', 'customer_notes',
    'warehouses', 'warehouse_zones', 'fabric_location_stock', 'accessory_location_stock',
    'report_schedules',
  ];
  let total = 0;
  for (const t of tables) {
    try {
      const c = db.prepare(`SELECT COUNT(*) as c FROM [${t}]`).get().c;
      if (c > 0) { console.log(`  ${t}: ${c}`); total += c; }
    } catch {}
  }
  console.log(`\n  TOTAL: ${total} records across ${tables.length} entity tables`);
  console.log('\n  📌 Login credentials: any username from [admin, wessam, manager, heba, mhamed, norhan, yasmine, viewer]');
  console.log('  📌 Password for all: 123456');

} catch (err) {
  console.error('❌ Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
