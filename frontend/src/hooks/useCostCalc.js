import { useMemo } from 'react';

/**
 * Cost calculation hook.
 *
 * Formulas:
 *   main_fabric_cost  = SUM of each main fabric: meters × price  (waste tracked separately)
 *   waste_cost         = SUM of each main fabric waste: meters × price × waste%/100
 *   lining_cost        = SUM of each lining fabric: meters × price  (NO waste)
 *   accessories_cost   = SUM of each accessory: quantity × price
 *   total_cost         = main_fabric_cost + waste_cost + lining_cost + accessories_cost + masnaiya + masrouf
 *   cost_per_piece     = total_cost / grand_total_pieces  (if grand_total > 0)
 */
export default function useCostCalc({ fabrics = [], accessories = [], masnaiya = 0, masrouf = 0, grandTotalPieces = 0, extraExpenses = [], marginPct = 25 }) {
  return useMemo(() => {
    const safeParse = (v) => parseFloat(v) || 0;
    const gtp = Math.max(0, safeParse(grandTotalPieces));

    let main_fabric_cost = 0;
    let lining_cost = 0;
    let waste_cost = 0;

    for (const f of fabrics) {
      const meters = safeParse(f.meters);
      const price = safeParse(f.price_per_meter);
      const waste = safeParse(f.waste_pct);
      const role = f.role || 'main';
      const baseCost = meters * price;

      if (role === 'lining') {
        lining_cost += baseCost;
      } else {
        const wasteCostPart = baseCost * (waste / 100);
        waste_cost += wasteCostPart;
        main_fabric_cost += baseCost;
      }
    }

    let accessories_cost = 0;
    for (const a of accessories) {
      accessories_cost += safeParse(a.quantity) * safeParse(a.unit_price || a.price) * gtp;
    }

    let extra_expenses_total = 0;
    for (const e of extraExpenses) {
      extra_expenses_total += safeParse(e.amount);
    }

    const m = safeParse(masnaiya);
    const r = safeParse(masrouf);
    const margin = safeParse(marginPct);
    const masnaiya_total = m * gtp;
    const masrouf_total = r * gtp;
    const total_cost = main_fabric_cost + waste_cost + lining_cost + accessories_cost + masnaiya_total + masrouf_total + extra_expenses_total;
    const cost_per_piece = gtp > 0 ? total_cost / gtp : 0;
    const waste_cost_per_piece = gtp > 0 ? waste_cost / gtp : 0;
    const extra_cost_per_piece = gtp > 0 ? extra_expenses_total / gtp : 0;
    const suggested_consumer_price = cost_per_piece > 0 ? cost_per_piece * (1 + margin / 100) : 0;

    return {
      main_fabric_cost,
      lining_cost,
      accessories_cost,
      waste_cost,
      waste_cost_per_piece,
      extra_expenses: extra_expenses_total,
      extra_cost_per_piece,
      masnaiya: m,
      masrouf: r,
      masnaiya_total,
      masrouf_total,
      total_cost,
      grand_total_pieces: gtp,
      total_pieces: gtp,
      cost_per_piece,
      suggested_consumer_price,
      margin_pct: margin,
    };
  }, [fabrics, accessories, masnaiya, masrouf, grandTotalPieces, extraExpenses, marginPct]);
}
