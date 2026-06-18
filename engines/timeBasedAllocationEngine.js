const { addDays, daysBetween, todayISO } = require('../utils/dateUtils');
const { RmslForecastEngine } = require('./rmslForecastEngine');
const { ProductionSequencingEngine } = require('./productionSequencingEngine');
const { DigitalTwinEngine } = require('./digitalTwinEngine');

class TimeBasedAllocationEngine {
  constructor(provider) {
    this.provider = provider;
    this.rmslEngine = new RmslForecastEngine();
    this.sequencingEngine = new ProductionSequencingEngine();
    this.twinEngine = new DigitalTwinEngine(provider);
  }

  /**
   * Time-aware allocation evaluation for a single order + batch.
   */
  evaluate(order, batch, rulesData) {
    const countryRule = (rulesData.countryRules || []).find(
      (r) => r.countryCode === order.destinationCountry
    );
    const rmslForecast = this.rmslEngine.calculateTriplePoint(batch, order, countryRule);

    return {
      packagingOrderId: order.packagingOrderId,
      batchId: batch.batchId,
      timeAware: true,
      plannedWindow: {
        start: order.plannedStartDate,
        end: order.plannedEndDate,
        delivery: order.requestedDeliveryDate,
        productionLine: order.productionLine,
      },
      rmslForecast,
      passed: rmslForecast.overallPassed,
      warnings: rmslForecast.warnings,
    };
  }

  /**
   * Future-state digital twin with time horizons.
   */
  simulateFuture(horizonDays = 7) {
    const referenceDate = new Date();
    const horizonEnd = addDays(todayISO(), horizonDays);
    const orders = this.provider.getOrders({ status: 'OPEN' });
    const batches = this.provider.getBatches();
    const rules = this.provider.getRules();

    const twinBase = this.twinEngine.buildSnapshot(horizonDays);
    const atRiskOrders = [];
    const expiringBatches = [];

    for (const order of orders) {
      if (order.plannedStartDate && order.plannedStartDate <= horizonEnd) {
        const batchesForOrder = batches.filter(
          (b) => b.materialNumber === order.materialNumber && b.qualityStatus === 'RELEASED'
        );
        let orderRisk = 'LOW';
        for (const batch of batchesForOrder) {
          const countryRule = (rules.countryRules || []).find(
            (r) => r.countryCode === order.destinationCountry
          );
          const fc = this.rmslEngine.calculateTriplePoint(batch, order, countryRule);
          if (!fc.overallPassed) orderRisk = 'HIGH';
          else if (fc.warnings.length) orderRisk = 'MEDIUM';
        }
        if (orderRisk !== 'LOW') {
          atRiskOrders.push({
            packagingOrderId: order.packagingOrderId,
            plannedStartDate: order.plannedStartDate,
            destinationCountry: order.destinationCountry,
            riskLevel: orderRisk,
          });
        }
      }
    }

    for (const batch of batches) {
      const rmslAtHorizon = require('../utils/dateUtils').remainingShelfLifeMonths(
        batch.expiryDate, horizonEnd
      );
      if (rmslAtHorizon < 6 && batch.availableQuantity > 0) {
        expiringBatches.push({
          batchId: batch.batchId,
          rmslAtHorizon,
          availableQuantity: batch.availableQuantity,
          expiryDate: batch.expiryDate,
        });
      }
    }

    return {
      ...twinBase,
      horizonDays,
      horizonEnd,
      timeAware: true,
      atRiskOrders,
      expiringBatches,
      summary: {
        ...twinBase.projections.summary,
        ordersAtRisk: atRiskOrders.length,
        batchesExpiring: expiringBatches.length,
      },
    };
  }

  buildGantt(orders, lineId = null) {
    const filtered = orders
      .filter((o) => o.status === 'OPEN')
      .filter((o) => !lineId || o.productionLine === lineId)
      .sort((a, b) => new Date(a.plannedStartDate) - new Date(b.plannedStartDate));

    if (!filtered.length) return { bars: [], timelineStart: todayISO(), timelineEnd: todayISO() };

    const timelineStart = filtered.reduce(
      (min, o) => (o.plannedStartDate < min ? o.plannedStartDate : min),
      filtered[0].plannedStartDate
    );
    const timelineEnd = filtered.reduce(
      (max, o) => {
        const end = o.plannedEndDate || o.plannedStartDate;
        return end > max ? end : max;
      },
      filtered[0].plannedEndDate || filtered[0].plannedStartDate
    );

    const totalDays = Math.max(1, daysBetween(timelineStart, timelineEnd) + 1);

    const bars = filtered.map((o) => {
      const startOffset = daysBetween(timelineStart, o.plannedStartDate);
      const duration = Math.max(
        1,
        daysBetween(o.plannedStartDate, o.plannedEndDate || o.plannedStartDate) + 1
      );
      return {
        id: o.packagingOrderId,
        processOrder: o.processOrder,
        label: `${o.packagingOrderId} (${o.destinationCountry})`,
        productionLine: o.productionLine,
        startDate: o.plannedStartDate,
        endDate: o.plannedEndDate || o.plannedStartDate,
        startOffset,
        duration,
        widthPercent: Math.round((duration / totalDays) * 1000) / 10,
        leftPercent: Math.round((startOffset / totalDays) * 1000) / 10,
        priority: o.priority,
        market: o.market || o.destinationCountry,
        requestedDeliveryDate: o.requestedDeliveryDate,
      };
    });

    return { timelineStart, timelineEnd, totalDays, bars, productionLine: lineId };
  }
}

module.exports = { TimeBasedAllocationEngine };
