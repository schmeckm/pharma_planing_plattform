const { remainingShelfLifeMonths } = require('../utils/dateUtils');

class DigitalTwinEngine {
  constructor(provider) {
    this.provider = provider;
  }

  buildSnapshot(horizonDays = 7) {
    const referenceDate = new Date();
    const horizonEnd = new Date(referenceDate);
    horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

    const orders = this.provider.getOrders({ status: 'OPEN' });
    const batches = this.provider.getBatches();
    const rules = this.provider.getRules();
    const lines = this.provider.getProductionLines?.() || [];
    const { PerformanceService } = require('../services/performanceService');
    const { resolvePerformanceHorizonMode } = require('../utils/planningHorizon');
    const perfSvc = new PerformanceService(this.provider);
    const enrichedLines = perfSvc.getLinesForHorizon(resolvePerformanceHorizonMode(horizonDays));

    return {
      timestamp: referenceDate.toISOString(),
      horizonDays,
      horizonEnd: horizonEnd.toISOString().slice(0, 10),
      entities: {
        packagingOrders: orders.length,
        batches: batches.length,
        productionLines: lines.length,
        plants: [...new Set(batches.map((b) => b.plant))],
        markets: [...new Set(orders.map((o) => o.destinationCountry))],
      },
      projections: this._project(orders, batches, rules, enrichedLines, referenceDate, horizonDays),
    };
  }

  _project(orders, batches, rules, lines, referenceDate, horizonDays) {
    const countryRules = rules.countryRules || [];
    const atRiskMarkets = [];
    const rmslViolations = [];
    const allocationOutcomes = [];

    for (const order of orders) {
      const countryRule = countryRules.find((r) => r.countryCode === order.destinationCountry);
      const materialBatches = batches.filter(
        (b) => b.materialNumber === order.materialNumber && b.qualityStatus === 'RELEASED'
      );

      let bestBatch = null;
      let bestRmsl = -1;
      for (const batch of materialBatches) {
        const rmsl = remainingShelfLifeMonths(batch.expiryDate, referenceDate);
        if (rmsl > bestRmsl) {
          bestRmsl = rmsl;
          bestBatch = batch;
        }
      }

      const threshold = countryRule?.rmslThresholdMonths || 12;
      const passed = bestBatch && bestRmsl >= threshold;
      const plannedDate = new Date(order.plannedStartDate);
      const daysUntil = (plannedDate - referenceDate) / (1000 * 60 * 60 * 24);

      allocationOutcomes.push({
        packagingOrderId: order.packagingOrderId,
        destinationCountry: order.destinationCountry,
        projectedStatus: passed ? 'SIMULATED' : 'FAILED',
        recommendedBatchId: bestBatch?.batchId || null,
        rmsl: bestRmsl > 0 ? Math.round(bestRmsl * 10) / 10 : null,
        daysUntilPlanned: Math.round(daysUntil),
      });

      if (!passed) {
        rmslViolations.push({
          packagingOrderId: order.packagingOrderId,
          country: order.destinationCountry,
          bestRmsl: bestRmsl,
          threshold,
        });
        if (!atRiskMarkets.includes(order.destinationCountry)) {
          atRiskMarkets.push(order.destinationCountry);
        }
      }
    }

    const lineUtilization = this._computeLineUtilization(orders, lines, horizonDays);

    return {
      allocationOutcomes,
      rmslViolations,
      atRiskMarkets: atRiskMarkets.map((c) => ({
        countryCode: c,
        riskLevel: rmslViolations.filter((v) => v.country === c).length > 2 ? 'HIGH' : 'MEDIUM',
        orderCount: rmslViolations.filter((v) => v.country === c).length,
      })),
      lineUtilization,
      summary: {
        totalOrders: orders.length,
        projectedSuccess: allocationOutcomes.filter((o) => o.projectedStatus === 'SIMULATED').length,
        projectedFailed: allocationOutcomes.filter((o) => o.projectedStatus === 'FAILED').length,
        peakUtilization: lineUtilization.peakPercent,
        averageUtilization: lineUtilization.averagePercent,
      },
    };
  }

  _effectiveCapacity(line, horizonDays) {
    const factor = line?.performanceFactor ?? line?.derivedPerformanceFactor ?? 1;
    const clamped = Math.min(1.5, Math.max(0.5, Number(factor) || 1));
    return Math.round((line.capacityUnitsPerDay || 5000) * clamped * horizonDays);
  }

  _computeLineUtilization(orders, lines, horizonDays) {
    if (!lines.length) {
      return { peakPercent: 0, averagePercent: 0, byLine: [] };
    }

    const byLine = lines.map((line) => {
      const lineOrders = orders.filter((o) => o.productionLine === line.lineId);
      const scheduledQty = lineOrders.reduce((s, o) => s + (o.quantity || 0), 0);
      const capacity = this._effectiveCapacity(line, horizonDays);
      const percent = capacity ? Math.min(100, Math.round((scheduledQty / capacity) * 1000) / 10) : 0;
      return {
        lineId: line.lineId,
        lineName: line.lineName,
        scheduledOrders: lineOrders.length,
        scheduledQuantity: scheduledQty,
        capacityUnits: capacity,
        performanceFactor: line.performanceFactor ?? 1,
        derivedOee: line.derivedOee ?? null,
        utilizationPercent: percent,
      };
    });

    const peakPercent = Math.max(0, ...byLine.map((l) => l.utilizationPercent));
    const averagePercent = byLine.length
      ? Math.round((byLine.reduce((s, l) => s + l.utilizationPercent, 0) / byLine.length) * 10) / 10
      : 0;

    return { peakPercent, averagePercent, byLine };
  }
}

module.exports = { DigitalTwinEngine };
