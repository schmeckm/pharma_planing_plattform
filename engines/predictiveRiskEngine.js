const { remainingShelfLifeMonths } = require('../utils/dateUtils');

class PredictiveRiskEngine {
  predict(orders, batches, rules, horizons = [7, 30, 90], options = {}) {
    const { lines = [] } = options;
    const referenceDate = new Date();
    const countryRules = rules.countryRules || [];
    const predictions = [];

    for (const horizon of horizons) {
      const horizonDate = new Date(referenceDate);
      horizonDate.setDate(horizonDate.getDate() + horizon);

      const horizonPredictions = {
        horizonDays: horizon,
        horizonDate: horizonDate.toISOString().slice(0, 10),
        rmslViolations: [],
        expiringInventory: [],
        marketShortages: [],
        bottlenecks: [],
      };

      // RMSL violations forecast
      for (const order of orders.filter((o) => o.status === 'OPEN')) {
        const cr = countryRules.find((r) => r.countryCode === order.destinationCountry);
        const threshold = cr?.rmslThresholdMonths || 12;
        const eligible = batches.filter(
          (b) => b.materialNumber === order.materialNumber && b.qualityStatus === 'RELEASED'
        );
        const maxRmsl = Math.max(
          0,
          ...eligible.map((b) => remainingShelfLifeMonths(b.expiryDate, horizonDate))
        );
        if (maxRmsl < threshold) {
          horizonPredictions.rmslViolations.push({
            packagingOrderId: order.packagingOrderId,
            country: order.destinationCountry,
            maxRmslAtHorizon: Math.round(maxRmsl * 10) / 10,
            threshold,
            severity: maxRmsl < threshold * 0.5 ? 'HIGH' : 'MEDIUM',
          });
        }
      }

      // Expiring inventory
      for (const batch of batches) {
        const rmsl = remainingShelfLifeMonths(batch.expiryDate, horizonDate);
        if (rmsl < 6 && batch.availableQuantity > 0) {
          horizonPredictions.expiringInventory.push({
            batchId: batch.batchId,
            rmslAtHorizon: Math.round(rmsl * 10) / 10,
            quantity: batch.availableQuantity,
          });
        }
      }

      // Market shortages (no eligible batch)
      const markets = [...new Set(orders.map((o) => o.destinationCountry))];
      for (const market of markets) {
        const marketOrders = orders.filter((o) => o.destinationCountry === market && o.status === 'OPEN');
        const failedCount = horizonPredictions.rmslViolations.filter((v) => v.country === market).length;
        if (failedCount >= marketOrders.length * 0.5 && marketOrders.length > 0) {
          horizonPredictions.marketShortages.push({
            country: market,
            affectedOrders: failedCount,
            totalOrders: marketOrders.length,
            riskLevel: 'HIGH',
          });
        }
      }

      // Japan sequence bottlenecks
      const jpOrders = orders.filter((o) => o.destinationCountry === 'JP' && o.status === 'OPEN');
      if (jpOrders.length > 1 && horizon <= 30) {
        horizonPredictions.bottlenecks.push({
          type: 'JAPAN_SEQUENCE',
          message: `${jpOrders.length} JP orders require continuous batch sequence`,
          riskLevel: 'MEDIUM',
        });
      }

      // Capacity bottlenecks per production line
      const lineCapacity = Object.fromEntries(
        lines.map((l) => [l.lineId, (l.capacityUnitsPerDay || 5000) * horizon]),
      );
      const lineLoad = {};
      for (const order of orders.filter((o) => o.status === 'OPEN' && o.productionLine)) {
        lineLoad[order.productionLine] = (lineLoad[order.productionLine] || 0) + (order.quantity || 0);
      }
      for (const [lineId, qty] of Object.entries(lineLoad)) {
        const capacity = lineCapacity[lineId] || 5000 * horizon;
        const util = capacity ? qty / capacity : 0;
        if (util >= 0.85) {
          horizonPredictions.bottlenecks.push({
            type: 'CAPACITY_BOTTLENECK',
            lineId,
            utilizationPercent: Math.round(util * 1000) / 10,
            riskLevel: util >= 1 ? 'HIGH' : 'MEDIUM',
            message: `Line ${lineId} projected at ${Math.round(util * 100)}% capacity by T+${horizon}`,
          });
        }
      }

      // Delivery risks — orders planned after requested delivery
      const deliveryRisks = orders.filter((o) => {
        if (o.status !== 'OPEN' || !o.requestedDeliveryDate || !o.plannedEndDate) return false;
        return o.plannedEndDate > o.requestedDeliveryDate;
      });
      if (deliveryRisks.length > 0) {
        horizonPredictions.deliveryRisks = deliveryRisks.slice(0, 10).map((o) => ({
          packagingOrderId: o.packagingOrderId,
          plannedEndDate: o.plannedEndDate,
          requestedDeliveryDate: o.requestedDeliveryDate,
          severity: 'HIGH',
        }));
      }

      predictions.push(horizonPredictions);
    }

    return {
      generatedAt: referenceDate.toISOString(),
      horizons: predictions,
      overallRisk: this._overallRisk(predictions),
    };
  }

  _overallRisk(predictions) {
    const h7 = predictions.find((p) => p.horizonDays === 7);
    if (!h7) return 'LOW';
    const score =
      h7.rmslViolations.length * 2 +
      h7.marketShortages.length * 5 +
      h7.bottlenecks.length * 3;
    if (score >= 15) return 'HIGH';
    if (score >= 5) return 'MEDIUM';
    return 'LOW';
  }
}

module.exports = { PredictiveRiskEngine };
