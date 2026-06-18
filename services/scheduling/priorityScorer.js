const { RiskEngine } = require('../../engines/riskEngine');

const PRIORITY_WEIGHT = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * Combines business priority + allocation risk for OR-Tools objective weights.
 */
class PriorityScorer {
  constructor() {
    this.risk = new RiskEngine();
  }

  score(order, constraintItem, context = {}) {
    const { batches = [], rulesData = {} } = context;
    const countryRule = (rulesData.countryRules || []).find(
      (r) => r.countryCode === order.destinationCountry,
    );
    const batch = batches.find((b) => b.batchId === constraintItem?.recommendedBatchId);
    const eligibleBatchCount = batches.filter(
      (b) => b.materialNumber === (order.materialNumber || order.material)
        && b.qualityStatus === 'RELEASED',
    ).length;

    const risk = this.risk.assess({
      order,
      batch,
      countryRule,
      eligibleBatchCount,
      referenceDate: context.referenceDate || new Date(),
    });

    const priorityRank = PRIORITY_WEIGHT[order.priority] ?? 9;
    const urgencyDays = order.requestedDeliveryDate
      ? Math.max(0, Math.round((new Date(order.requestedDeliveryDate) - new Date()) / 86400000))
      : 30;

    const priorityScore = Math.min(
      100,
      Math.round(
        (100 - risk.score * 0.5)
        + (priorityRank === 0 ? 20 : priorityRank === 1 ? 10 : 0)
        + Math.max(0, 30 - urgencyDays),
      ),
    );

    return {
      packagingOrderId: order.packagingOrderId || order.packagingOrder,
      priorityScore,
      riskScore: risk.score,
      riskLevel: risk.level,
      priority: order.priority,
      urgencyDays,
      eligible: constraintItem?.eligible !== false,
    };
  }

  rank(orders, constraintItems, context = {}) {
    const byId = Object.fromEntries(
      constraintItems.map((c) => [c.packagingOrderId, c]),
    );
    return orders
      .map((order) => {
        const id = order.packagingOrderId || order.packagingOrder;
        return this.score(order, byId[id], context);
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }
}

module.exports = { PriorityScorer };
