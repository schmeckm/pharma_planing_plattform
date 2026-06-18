const { BaseAgent } = require('./baseAgent');

class QAAgent extends BaseAgent {
  constructor(tools) {
    super('qa-agent', tools);
  }

  async run(context) {
    const { inspectionLots = [], blockedOrders = [], exceptions = [], orders = [], t = (key, params) => key } = context;
    const recommendations = [];

    for (const lot of inspectionLots.filter((l) => l.status === 'PENDING' || l.status === 'IN_PROGRESS')) {
      const lotId = lot.inspectionLotId || lot.lotId;
      const blockedByBatch = blockedOrders.filter((o) => o.waitingBatchId === lot.batchId);
      const linkedOrder = orders.find((o) =>
        blockedByBatch.some((b) => b.packagingOrderId === o.packagingOrderId),
      ) || orders.find((o) => o.materialNumber === lot.materialNumber && o.status === 'OPEN');

      const expectedRelease = lot.expectedReleaseDate
        ? t('qa.expectedRelease', { date: lot.expectedReleaseDate })
        : t('qa.expectedReleasePending');

      recommendations.push(
        this.createRecommendation({
          type: 'PRIORITIZE_RELEASE',
          targetId: lotId,
          packagingOrderId: linkedOrder?.packagingOrderId || blockedByBatch[0]?.packagingOrderId,
          action: t('qa.prioritizeRelease', { lotId, batchId: lot.batchId }),
          rationale: `${expectedRelease}. ${blockedByBatch.length ? t('qa.allocationsWaiting', { count: blockedByBatch.length }) : t('qa.releaseUnblocks')}`,
          impact: linkedOrder
            ? t('qa.impactUnblockOrder', { orderId: linkedOrder.packagingOrderId })
            : blockedByBatch[0]
              ? t('qa.impactUnblockOrder', { orderId: blockedByBatch[0].packagingOrderId })
              : t('qa.impactInventory'),
          confidence: blockedByBatch.length ? 0.9 : 0.72,
          evidence: [`inspection:${lotId}`, lot.batchId, ...blockedByBatch.map((o) => o.packagingOrderId)],
          approverRole: 'QA',
        }),
      );
    }

    const qualityExceptions = exceptions.filter(
      (e) => (e.type === 'QUALITY_BLOCKED' || e.type === 'MISSING_INVENTORY') && e.status === 'OPEN',
    );
    for (const ex of qualityExceptions.slice(0, 2)) {
      recommendations.push(
        this.createRecommendation({
          type: 'QA_REVIEW',
          targetId: ex.exceptionId,
          packagingOrderId: ex.packagingOrderId,
          action: t('qa.reviewQuality'),
          rationale: ex.message,
          impact: t('qa.impactPath', { orderId: ex.packagingOrderId }),
          confidence: 0.88,
          evidence: [ex.exceptionId],
          approverRole: 'QA',
        }),
      );
    }

    return { agentId: this.name, recommendations, count: recommendations.length };
  }
}

module.exports = { QAAgent };
