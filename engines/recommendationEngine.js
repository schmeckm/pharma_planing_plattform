const { remainingShelfLifeMonths } = require('../utils/dateUtils');
const { generateId } = require('../utils/idGenerator');

class RecommendationEngine {
  generate(orders, batches, bulkInventory, inspectionLots, predictions, capacity) {
    const recommendations = [];
    const ref = new Date();

    // Inventory transfer: CH surplus → JP shortage
    const chBatch = batches.find((b) => b.approvedCountries?.includes('CH') && b.availableQuantity > 5000);
    const jpOrders = orders.filter((o) => o.destinationCountry === 'JP' && o.status === 'OPEN');
    if (chBatch && jpOrders.length) {
      recommendations.push({
        recommendationId: generateId('REC'),
        type: 'INVENTORY_TRANSFER',
        priority: 'HIGH',
        title: 'Transfer inventory from Switzerland to Japan',
        action: `Move 3000 EA from ${chBatch.batchId} to JP distribution`,
        rationale: 'JP market has 3 open orders; CH batch has surplus capacity',
        impact: { serviceLevelDelta: 2.1, expiryRiskDelta: -0.5 },
        status: 'PENDING',
      });
    }

    // Batch reallocation for blocked orders
    const blocked = orders.filter((o) => o.status === 'OPEN' && !o.allocatedBatchId);
    for (const order of blocked.slice(0, 2)) {
      const alt = batches.find(
        (b) => b.materialNumber === order.materialNumber
          && b.qualityStatus === 'RELEASED'
          && b.approvedCountries?.includes(order.destinationCountry)
          && remainingShelfLifeMonths(b.expiryDate, ref) >= 12
      );
      if (alt) {
        recommendations.push({
          recommendationId: generateId('REC'),
          type: 'BATCH_REALLOCATION',
          priority: 'HIGH',
          packagingOrderId: order.packagingOrderId,
          title: `Use alternative batch for ${order.packagingOrderId}`,
          action: `Reallocate to ${alt.batchId}`,
          rationale: 'Resolves RMSL compliance risk with approved alternative batch',
          impact: { blockedOrdersDelta: -1 },
          status: 'PENDING',
        });
      }
    }

    // QA prioritization
    for (const lot of (inspectionLots || []).filter((l) => l.status === 'IN_PROGRESS')) {
      recommendations.push({
        recommendationId: generateId('REC'),
        type: 'QA_PRIORITIZATION',
        priority: 'MEDIUM',
        batchId: lot.batchId,
        title: `Prioritize QA release for ${lot.batchId}`,
        action: 'Escalate inspection lot to QA queue head',
        rationale: 'Batch required for upcoming JP packaging orders',
        status: 'PENDING',
      });
    }

    // Demand prioritization
    const backorders = jpOrders.filter((o) => {
      const d = new Date(o.plannedStartDate);
      return (d - ref) / 86400000 <= 14;
    });
    if (backorders.length) {
      recommendations.push({
        recommendationId: generateId('REC'),
        type: 'DEMAND_PRIORITIZATION',
        priority: 'MEDIUM',
        title: 'Prioritize Japan demand for next 14 days',
        action: `Sequence ${backorders.length} packaging orders ahead of lower-priority markets`,
        rationale: 'Japan sequence rules and near-term delivery commitments',
        status: 'PENDING',
      });
    }

    // Packaging sequence optimization
    const weekCap = capacity?.[0];
    if (weekCap && weekCap.utilizationPercent > 85) {
      recommendations.push({
        recommendationId: generateId('REC'),
        type: 'PACKAGING_SEQUENCE',
        priority: 'MEDIUM',
        plantId: weekCap.plantId,
        title: 'Optimize packaging sequence at Plant 1000',
        action: 'Spread PO load across weeks 2026-06-16 and 2026-06-23',
        rationale: `Capacity utilization at ${weekCap.utilizationPercent}% — bottleneck risk`,
        impact: { capacityUtilizationDelta: -12 },
        status: 'PENDING',
      });
    }

    // Expiry risk from predictions
    const expiryRisks = predictions?.horizons?.[0]?.expiringInventory || [];
    for (const risk of expiryRisks.slice(0, 2)) {
      recommendations.push({
        recommendationId: generateId('REC'),
        type: 'INVENTORY_TRANSFER',
        priority: 'HIGH',
        batchId: risk.batchId,
        title: `Redistribute expiring inventory ${risk.batchId}`,
        action: 'Allocate to high-velocity markets before expiry window',
        rationale: risk.reason || 'Inventory expiry within 90 days',
        status: 'PENDING',
      });
    }

    return recommendations.sort((a, b) => {
      const p = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (p[a.priority] || 9) - (p[b.priority] || 9);
    });
  }
}

module.exports = { RecommendationEngine };
