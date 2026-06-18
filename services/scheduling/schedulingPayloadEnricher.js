const { HistoricalPerformanceEngine } = require('../../engines/historicalPerformanceEngine');

/**
 * Enrich rough/planned orders before OR-Tools CP-SAT:
 * - duration from throughput × OEE × yield × performanceFactor
 * - preferred line from Line Score ranking
 * - per-line scores for solver objective
 */
function enrichOrdersForSolver({ orders = [], lines = [], performanceRecords = [] }) {
  const perf = HistoricalPerformanceEngine.fromRepository(performanceRecords);
  perf.setLineFactors(lines);

  return orders.map((raw) => {
    const material = raw.materialNumber || raw.material;
    const quantity = raw.quantity || 0;
    const recommendation = perf.recommendLine(material, lines, {
      preferredLine: raw.preferredLine || raw.productionLine,
    });
    const best = recommendation.candidates[0];
    const bestLineId = recommendation.recommendedLineId || lines[0]?.lineId;
    const lineScores = Object.fromEntries(
      recommendation.candidates.map((c) => [c.lineId, c.adjustedLineScore]),
    );

    let durationHours = raw.durationHours;
    if ((!durationHours || durationHours <= 0) && quantity > 0 && bestLineId) {
      durationHours = perf.estimateRunHours(material, bestLineId, quantity);
    }

    return {
      ...raw,
      packagingOrderId: raw.packagingOrder || raw.packagingOrderId,
      materialNumber: material,
      preferredLine: raw.preferredLine || raw.productionLine || bestLineId,
      bestLineId,
      durationHours: durationHours || 16,
      lineScores,
      expectedOee: best?.components?.oee ?? null,
      performanceFactor: best?.performanceFactor ?? 1,
      adjustedLineScore: best?.adjustedLineScore ?? null,
    };
  });
}

module.exports = { enrichOrdersForSolver };
