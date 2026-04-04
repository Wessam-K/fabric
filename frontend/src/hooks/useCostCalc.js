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
    // Use integer piasters (cents) to avoid floating-point drift
    const toPiasters = (v) => Math.round(safeParse(v) * 100);
    const fromPiasters = (v) => v / 100;
    const gtp = Math.max(0, safeParse(grandTotalPieces));

    let main_fabric_cost_p = 0;
    let lining_cost_p = 0;
    let waste_cost_p = 0;

    for (const f of fabrics) {
      const meters = safeParse(f.meters);
      const price_p = toPiasters(f.price_per_meter);
      const waste = safeParse(f.waste_pct);
      const role = f.role || 'main';
      const baseCost_p = Math.round(meters * price_p);

      if (role === 'lining') {
        lining_cost_p += baseCost_p;
      } else {
        const wasteCostPart_p = Math.round(baseCost_p * waste / 100);
        waste_cost_p += wasteCostPart_p;
        main_fabric_cost_p += baseCost_p;
      }
    }

    let accessories_cost_p = 0;
    for (const a of accessories) {
      accessories_cost_p += Math.round(safeParse(a.quantity) * toPiasters(a.unit_price || a.price) * gtp);
    }

    let extra_expenses_total_p = 0;
    for (const e of extraExpenses) {
      extra_expenses_total_p += toPiasters(e.amount);
    }

    const m = safeParse(masnaiya);
    const r = safeParse(masrouf);
    const margin = safeParse(marginPct);
    const masnaiya_total_p = Math.round(toPiasters(m) * gtp);
    const masrouf_total_p = Math.round(toPiasters(r) * gtp);
    const total_cost_p = main_fabric_cost_p + waste_cost_p + lining_cost_p + accessories_cost_p + masnaiya_total_p + masrouf_total_p + extra_expenses_total_p;
    const cost_per_piece = gtp > 0 ? fromPiasters(Math.round(total_cost_p / gtp)) : 0;
    const waste_cost_per_piece = gtp > 0 ? fromPiasters(Math.round(waste_cost_p / gtp)) : 0;
    const extra_cost_per_piece = gtp > 0 ? fromPiasters(Math.round(extra_expenses_total_p / gtp)) : 0;
    const suggested_consumer_price = cost_per_piece > 0 ? Math.round(cost_per_piece * (1 + margin / 100) * 100) / 100 : 0;

    return {
      main_fabric_cost: fromPiasters(main_fabric_cost_p),
      lining_cost: fromPiasters(lining_cost_p),
      accessories_cost: fromPiasters(accessories_cost_p),
      waste_cost: fromPiasters(waste_cost_p),
      waste_cost_per_piece,
      extra_expenses: fromPiasters(extra_expenses_total_p),
      extra_cost_per_piece,
      masnaiya: m,
      masrouf: r,
      masnaiya_total: fromPiasters(masnaiya_total_p),
      masrouf_total: fromPiasters(masrouf_total_p),
      total_cost: fromPiasters(total_cost_p),
      grand_total_pieces: gtp,
      total_pieces: gtp,
      cost_per_piece,
      suggested_consumer_price,
      margin_pct: margin,
    };
  }, [fabrics, accessories, masnaiya, masrouf, grandTotalPieces, extraExpenses, marginPct]);
}
