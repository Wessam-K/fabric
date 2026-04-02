/**
 * T4: Unit tests for cost calculation formulas
 * Tests invoice subtotal/tax/total and work-order cost-per-piece formulas
 * Run: node --test tests/cost.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { round2, safeMultiply, safeAdd, safeSubtract } = require('../utils/money');

// ── Replicate invoice total formula from routes/invoices.js ──
function calcInvoiceTotal(items, discount, taxPct) {
  const subtotal = (items || []).reduce(
    (s, item) => safeAdd(s, safeMultiply(parseFloat(item.quantity) || 0, parseFloat(item.unit_price) || 0)),
    0,
  );
  const discountAmt = parseFloat(discount) || 0;
  const taxAmt = round2(safeSubtract(subtotal, discountAmt) * ((parseFloat(taxPct) || 0) / 100));
  const total = round2(safeAdd(safeSubtract(subtotal, discountAmt), taxAmt));
  return { subtotal, taxAmt, total };
}

// ── Replicate WO cost-per-piece formula from routes/workorders.js ──
function calcWOCost({ fabrics, accessories, totalPieces, masnaiya, masrouf, extraExpenses, marginPct }) {
  let mainCost = 0, liningCost = 0, wasteCost = 0;
  for (const f of fabrics) {
    const meters = f.meters || 0;
    const price = f.price || 0;
    const waste = f.waste_pct || 0;
    const base = meters * price;
    if (f.role === 'lining') { liningCost += base; }
    else { mainCost += base; wasteCost += base * (waste / 100); }
  }
  let accCost = 0;
  for (const a of accessories) accCost += (a.qty || 0) * (a.price || 0);

  let extraTotal = 0;
  for (const e of (extraExpenses || [])) extraTotal += e.amount || 0;

  const masnaiyaTotal = (masnaiya || 0) * totalPieces;
  const masroufTotal = (masrouf || 0) * totalPieces;
  const totalCost = mainCost + liningCost + accCost + masnaiyaTotal + masroufTotal + wasteCost + extraTotal;
  const costPerPiece = totalPieces > 0 ? totalCost / totalPieces : 0;
  const margin = marginPct || 0;
  const suggestedConsumer = costPerPiece * (1 + margin / 100);
  return { mainCost: round2(mainCost), liningCost: round2(liningCost), wasteCost: round2(wasteCost), accCost: round2(accCost), totalCost: round2(totalCost), costPerPiece: round2(costPerPiece), suggestedConsumer: round2(suggestedConsumer) };
}

describe('Cost Calculations', () => {
  describe('Invoice Total', () => {
    it('sums items correctly', () => {
      const { subtotal, total } = calcInvoiceTotal([
        { quantity: 10, unit_price: 50 },
        { quantity: 5, unit_price: 100 },
      ], 0, 0);
      assert.equal(subtotal, 1000);
      assert.equal(total, 1000);
    });

    it('applies discount', () => {
      const { subtotal, total } = calcInvoiceTotal([{ quantity: 10, unit_price: 100 }], 200, 0);
      assert.equal(subtotal, 1000);
      assert.equal(total, 800);
    });

    it('applies tax after discount', () => {
      const { subtotal, taxAmt, total } = calcInvoiceTotal([{ quantity: 10, unit_price: 100 }], 200, 14);
      assert.equal(subtotal, 1000);
      assert.equal(taxAmt, 112); // (1000-200)*14% = 112
      assert.equal(total, 912);  // 800 + 112
    });

    it('handles empty items', () => {
      const { subtotal, total } = calcInvoiceTotal([], 0, 14);
      assert.equal(subtotal, 0);
      assert.equal(total, 0);
    });

    it('handles null items', () => {
      const { subtotal, total } = calcInvoiceTotal(null, 0, 0);
      assert.equal(subtotal, 0);
      assert.equal(total, 0);
    });

    it('rounds to 2 decimal places', () => {
      const { total } = calcInvoiceTotal([{ quantity: 3, unit_price: 33.33 }], 0, 10);
      // subtotal=99.99, tax=10%, total=109.989 -> round2=109.99
      assert.equal(total, 109.99);
    });
  });

  describe('Work Order Cost', () => {
    it('calculates basic fabric cost', () => {
      const r = calcWOCost({
        fabrics: [{ role: 'main', meters: 100, price: 50, waste_pct: 5 }],
        accessories: [],
        totalPieces: 100,
        masnaiya: 0, masrouf: 0, extraExpenses: [], marginPct: 0,
      });
      assert.equal(r.mainCost, 5000);
      assert.equal(r.wasteCost, 250);
      assert.equal(r.totalCost, 5250);
      assert.equal(r.costPerPiece, 52.5);
    });

    it('separates lining cost', () => {
      const r = calcWOCost({
        fabrics: [
          { role: 'main', meters: 100, price: 50, waste_pct: 0 },
          { role: 'lining', meters: 50, price: 30, waste_pct: 0 },
        ],
        accessories: [],
        totalPieces: 100,
        masnaiya: 0, masrouf: 0, extraExpenses: [], marginPct: 0,
      });
      assert.equal(r.mainCost, 5000);
      assert.equal(r.liningCost, 1500);
      assert.equal(r.totalCost, 6500);
    });

    it('includes accessories', () => {
      const r = calcWOCost({
        fabrics: [],
        accessories: [{ qty: 200, price: 2.5 }],
        totalPieces: 100,
        masnaiya: 0, masrouf: 0, extraExpenses: [], marginPct: 0,
      });
      assert.equal(r.accCost, 500);
      assert.equal(r.costPerPiece, 5);
    });

    it('includes masnaiya and masrouf per piece', () => {
      const r = calcWOCost({
        fabrics: [],
        accessories: [],
        totalPieces: 100,
        masnaiya: 10, masrouf: 5,
        extraExpenses: [], marginPct: 0,
      });
      assert.equal(r.totalCost, 1500); // 10*100 + 5*100
      assert.equal(r.costPerPiece, 15);
    });

    it('includes extra expenses', () => {
      const r = calcWOCost({
        fabrics: [],
        accessories: [],
        totalPieces: 100,
        masnaiya: 0, masrouf: 0,
        extraExpenses: [{ amount: 500 }, { amount: 300 }],
        marginPct: 0,
      });
      assert.equal(r.totalCost, 800);
      assert.equal(r.costPerPiece, 8);
    });

    it('calculates margin-based consumer price', () => {
      const r = calcWOCost({
        fabrics: [{ role: 'main', meters: 100, price: 100, waste_pct: 0 }],
        accessories: [],
        totalPieces: 100,
        masnaiya: 0, masrouf: 0,
        extraExpenses: [], marginPct: 25,
      });
      assert.equal(r.costPerPiece, 100);
      assert.equal(r.suggestedConsumer, 125);
    });

    it('handles zero pieces gracefully', () => {
      const r = calcWOCost({
        fabrics: [{ role: 'main', meters: 100, price: 50, waste_pct: 0 }],
        accessories: [],
        totalPieces: 0,
        masnaiya: 10, masrouf: 5,
        extraExpenses: [], marginPct: 25,
      });
      assert.equal(r.costPerPiece, 0);
      assert.equal(r.suggestedConsumer, 0);
    });

    it('full cost breakdown', () => {
      const r = calcWOCost({
        fabrics: [
          { role: 'main', meters: 200, price: 60, waste_pct: 3 },
          { role: 'lining', meters: 100, price: 25, waste_pct: 0 },
        ],
        accessories: [{ qty: 500, price: 1.5 }],
        totalPieces: 200,
        masnaiya: 15, masrouf: 8,
        extraExpenses: [{ amount: 1000 }],
        marginPct: 30,
      });
      // main: 200*60=12000, waste: 12000*3%=360, lining: 100*25=2500
      // acc: 500*1.5=750, masnaiya: 15*200=3000, masrouf: 8*200=1600, extra: 1000
      // total: 12000+360+2500+750+3000+1600+1000=21210
      assert.equal(r.mainCost, 12000);
      assert.equal(r.wasteCost, 360);
      assert.equal(r.liningCost, 2500);
      assert.equal(r.accCost, 750);
      assert.equal(r.totalCost, 21210);
      assert.equal(r.costPerPiece, 106.05);
      assert.equal(r.suggestedConsumer, 137.87); // 106.05 * 1.30
    });
  });
});
