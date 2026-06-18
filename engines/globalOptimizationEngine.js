/**
 * Global Optimization Engine — multi-objective batch selection (MVP 3.0 heuristic).
 * Production: OR-Tools / Gurobi MIP formulation.
 */
class GlobalOptimizationEngine {
  optimize(orders, batches, rules, objectives = {}) {
    const weights = {
      minimizeExpiry: objectives.minimizeExpiry ?? 0.25,
      maximizeRmsl: objectives.maximizeRmsl ?? 0.25,
      maximizeServiceLevel: objectives.maximizeServiceLevel ?? 0.25,
      minimizeBlocked: objectives.minimizeBlocked ?? 0.25,
    };

    const assignments = [];
    const usedBatchQty = {};

    for (const order of orders) {
      const candidates = batches.filter(
        (b) =>
          b.materialNumber === order.materialNumber &&
          b.qualityStatus === 'RELEASED' &&
          (b.approvedCountries || []).includes(order.destinationCountry)
      );

      let best = null;
      let bestScore = -Infinity;

      for (const batch of candidates) {
        const available = (batch.availableQuantity || 0) - (usedBatchQty[batch.batchId] || 0);
        if (available < order.quantity) continue;

        const score = this._scoreBatch(batch, order, weights);
        if (score > bestScore) {
          bestScore = score;
          best = batch;
        }
      }

      if (best) {
        usedBatchQty[best.batchId] = (usedBatchQty[best.batchId] || 0) + order.quantity;
        assignments.push({
          packagingOrderId: order.packagingOrderId,
          batchId: best.batchId,
          score: Math.round(bestScore * 100) / 100,
          objectives: weights,
        });
      } else {
        assignments.push({
          packagingOrderId: order.packagingOrderId,
          batchId: null,
          score: 0,
          blocked: true,
        });
      }
    }

    return {
      assignments,
      summary: {
        total: orders.length,
        assigned: assignments.filter((a) => a.batchId).length,
        blocked: assignments.filter((a) => a.blocked).length,
        avgScore:
          assignments.filter((a) => a.score > 0).reduce((s, a) => s + a.score, 0) /
            (assignments.filter((a) => a.score > 0).length || 1),
      },
    };
  }

  _scoreBatch(batch, order, weights) {
    const expiryScore = new Date(batch.expiryDate).getTime() / 1e15; // prefer earlier expiry use (FIFO)
    const rmslScore = (new Date(batch.expiryDate) - new Date()) / (365 * 24 * 3600 * 1000);
    const serviceScore = 1.0;
    return (
      weights.minimizeExpiry * expiryScore +
      weights.maximizeRmsl * rmslScore * 0.1 +
      weights.maximizeServiceLevel * serviceScore
    );
  }
}

module.exports = { GlobalOptimizationEngine };
