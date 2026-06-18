const fs = require('fs');
const path = require('path');
const { getProvider } = require('../providers');
const { TimeBasedAllocationEngine } = require('../engines/timeBasedAllocationEngine');
const { RmslForecastEngine } = require('../engines/rmslForecastEngine');
const { ProductionSequencingEngine } = require('../engines/productionSequencingEngine');
const { CapacityPlanningEngine } = require('../engines/capacityPlanningEngine');
const { AllocationService } = require('./allocationService');
const { PerformanceService } = require('./performanceService');
const { addDays } = require('../utils/dateUtils');
const { generateId } = require('../utils/idGenerator');

class TimePlanningService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.performance = new PerformanceService(provider);
    this.timeEngine = new TimeBasedAllocationEngine(provider);
    this.rmslEngine = new RmslForecastEngine();
    this.sequencingEngine = new ProductionSequencingEngine();
    this.capacityEngine = new CapacityPlanningEngine();
    this.allocationService = new AllocationService();
  }

  _dataDir() {
    return process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
  }

  _readItems(name) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(this._dataDir(), `${name}.json`), 'utf-8'));
      return data.items || data;
    } catch {
      return [];
    }
  }

  _orders() {
    return this.provider.getOrders();
  }

  _rules() {
    return this.provider.getRules();
  }

  _batches() {
    return this.provider.getBatches();
  }

  getTimeline(lineId = null) {
    const orders = this._orders().filter((o) => !lineId || o.productionLine === lineId);
    return {
      timestamp: new Date().toISOString(),
      lineId,
      orders: orders.map((o) => ({
        packagingOrderId: o.packagingOrderId,
        processOrder: o.processOrder,
        productionLine: o.productionLine,
        plannedStartDate: o.plannedStartDate,
        plannedEndDate: o.plannedEndDate,
        requestedDeliveryDate: o.requestedDeliveryDate || o.salesOrder?.requestedDeliveryDate,
        priority: o.priority,
        market: o.market || o.destinationCountry,
        status: o.status,
        destinationCountry: o.destinationCountry,
      })),
    };
  }

  getGantt(lineId = 'PACK_LINE_01') {
    return {
      timestamp: new Date().toISOString(),
      ...this.timeEngine.buildGantt(this._orders(), lineId),
    };
  }

  getCapacityDashboard(horizonDays = 14) {
    const lines = this.performance.getLinesForHorizon('long');
    const analysis = this.performance.getHistoricalAnalysis();
    return {
      timestamp: new Date().toISOString(),
      performanceSource: 'HISTORICAL_ORDERS',
      completedOrderCount: analysis.completedOrderCount,
      ...this.capacityEngine.buildHeatmap(
        this._orders().filter((o) => o.status === 'OPEN' || o.status === 'PLANNED'),
        lines,
        this._readItems('lineCalendars'),
        horizonDays
      ),
    };
  }

  getRmslRiskDashboard() {
    const orders = this._orders();
    const batches = this._batches();
    const rules = this._rules();
    const portfolio = this.rmslEngine.assessPortfolio(orders, batches, rules);

    return {
      timestamp: new Date().toISOString(),
      orders: portfolio.map(({ order, forecast }) => ({
        packagingOrderId: order.packagingOrderId,
        processOrder: order.processOrder,
        destinationCountry: order.destinationCountry,
        plannedStartDate: order.plannedStartDate,
        batchId: forecast.batchId,
        checkpoints: forecast.checkpoints,
        warnings: forecast.warnings,
        overallPassed: forecast.overallPassed,
      })),
      summary: {
        total: portfolio.length,
        atRisk: portfolio.filter((p) => !p.forecast.overallPassed).length,
        warnings: portfolio.reduce((s, p) => s + p.forecast.warnings.length, 0),
      },
    };
  }

  getMarketDeliveryRisk() {
    const orders = this._orders();
    const batches = this._batches();
    const rules = this._rules();
    const byMarket = {};

    for (const order of orders.filter((o) => o.status === 'OPEN')) {
      const market = order.market || order.destinationCountry;
      if (!byMarket[market]) {
        byMarket[market] = { market, orders: [], riskLevel: 'LOW', deliveryRisks: 0 };
      }
      const countryRule = (rules.countryRules || []).find((r) => r.countryCode === order.destinationCountry);
      const batch = batches.find(
        (b) => b.materialNumber === order.materialNumber && b.qualityStatus === 'RELEASED'
      );
      if (batch) {
        const fc = this.rmslEngine.calculateTriplePoint(batch, order, countryRule);
        const deliveryCp = fc.checkpoints.find((c) => c.checkpoint === 'CUSTOMER_DELIVERY');
        byMarket[market].orders.push({
          packagingOrderId: order.packagingOrderId,
          requestedDeliveryDate: order.requestedDeliveryDate,
          deliveryRmslMonths: deliveryCp?.rmslMonths,
          deliveryPassed: deliveryCp?.passed,
          warnings: fc.warnings.filter((w) => w.code.includes('DELIVERY')),
        });
        if (!deliveryCp?.passed) {
          byMarket[market].deliveryRisks += 1;
          byMarket[market].riskLevel = 'HIGH';
        } else if (fc.warnings.length && byMarket[market].riskLevel !== 'HIGH') {
          byMarket[market].riskLevel = 'MEDIUM';
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      markets: Object.values(byMarket),
    };
  }

  getSequencing(lineId = 'PACK_LINE_01') {
    return {
      timestamp: new Date().toISOString(),
      ...this.sequencingEngine.evaluateSequence(
        this._orders(), this._batches(), this._rules(), lineId
      ),
    };
  }

  getDigitalTwin(horizonDays = 7) {
    return this.timeEngine.simulateFuture(horizonDays);
  }

  /**
   * Time-based what-if: shift dates, change sequence, change line.
   */
  simulateWhatIf({
    packagingOrderId,
    shiftDays = 0,
    productionLine = null,
    newSequence = null,
    lineId = 'PACK_LINE_01',
  }) {
    const orders = this._orders();
    const order = orders.find((o) => o.packagingOrderId === packagingOrderId);
    if (!order) throw new Error(`Order ${packagingOrderId} not found`);

    const rules = this._rules();
    const batches = this._batches();
    const countryRule = (rules.countryRules || []).find(
      (r) => r.countryCode === order.destinationCountry
    );
    const baselineBatch = batches.find(
      (b) => b.materialNumber === order.materialNumber && b.qualityStatus === 'RELEASED'
    );

    const baselineAlloc = this.allocationService.simulate({ packagingOrderId });
    const baselineRmsl = baselineBatch
      ? this.rmslEngine.calculateTriplePoint(baselineBatch, order, countryRule)
      : null;

    const modifiedOrder = {
      ...order,
      plannedStartDate: shiftDays ? addDays(order.plannedStartDate, shiftDays) : order.plannedStartDate,
      plannedEndDate: shiftDays
        ? addDays(order.plannedEndDate || order.plannedStartDate, shiftDays)
        : order.plannedEndDate,
      productionLine: productionLine || order.productionLine,
    };

    const shiftedRmsl = baselineBatch
      ? this.rmslEngine.forecastShiftImpact(baselineBatch, order, countryRule, shiftDays)
      : null;

    let sequenceImpact = null;
    if (newSequence?.length) {
      sequenceImpact = this.sequencingEngine.simulateResequence(
        orders, newSequence, batches, rules, lineId
      );
    }

    const lineCheck = productionLine
      ? this.capacityEngine.checkLineAvailability(
        productionLine,
        modifiedOrder.plannedStartDate,
        modifiedOrder.plannedEndDate || modifiedOrder.plannedStartDate,
        this._readItems('lineCalendars'),
        this._readItems('productionLines')
      )
      : null;

    const deliveryBaseline = baselineRmsl?.checkpoints?.find((c) => c.checkpoint === 'CUSTOMER_DELIVERY');
    const deliveryShifted = shiftedRmsl?.shifted?.find((c) => c.checkpoint === 'CUSTOMER_DELIVERY');

    const impactAnalysis = [];
    if (shiftDays !== 0 && deliveryBaseline && deliveryShifted) {
      impactAnalysis.push({
        area: 'RMSL at Delivery',
        change: `${deliveryBaseline.percentOfThreshold}% → ${deliveryShifted.percentOfThreshold}% of threshold`,
        impact: shiftedRmsl.rmslPercentChange < 0
          ? `RMSL decreases by ${Math.abs(shiftedRmsl.rmslPercentChange)}% — delivery date risk may increase`
          : 'RMSL margin improved',
      });
    }
    if (sequenceImpact) {
      impactAnalysis.push({
        area: 'Production Sequence',
        change: sequenceImpact.compliant ? 'Sequence valid' : `${sequenceImpact.issues.length} issue(s)`,
        impact: sequenceImpact.compliant
          ? 'Japan sequence remains valid'
          : sequenceImpact.issues.map((i) => i.message).join('; '),
      });
    }
    if (lineCheck && !lineCheck.available) {
      impactAnalysis.push({
        area: 'Line Availability',
        change: productionLine,
        impact: `Maintenance conflict: ${lineCheck.conflicts.map((c) => c.date).join(', ')}`,
      });
    }

    const scenario = {
      scenarioId: generateId('TPL'),
      packagingOrderId,
      parameters: { shiftDays, productionLine, newSequence, lineId },
      modifiedOrder: {
        plannedStartDate: modifiedOrder.plannedStartDate,
        plannedEndDate: modifiedOrder.plannedEndDate,
        productionLine: modifiedOrder.productionLine,
      },
      baseline: {
        allocation: { status: baselineAlloc.status, batchId: baselineAlloc.recommendedBatchId },
        rmsl: baselineRmsl?.checkpoints,
      },
      scenario: {
        rmsl: shiftedRmsl,
        sequence: sequenceImpact,
        lineAvailability: lineCheck,
      },
      impactAnalysis,
      warnings: shiftedRmsl?.warnings || [],
      summary: this._whatIfSummary(shiftDays, shiftedRmsl, sequenceImpact, lineCheck),
      createdAt: new Date().toISOString(),
    };

    return scenario;
  }

  _whatIfSummary(shiftDays, shiftedRmsl, sequenceImpact, lineCheck) {
    const parts = [];
    if (shiftDays) {
      parts.push(`Move order by ${shiftDays} day(s)`);
      if (shiftedRmsl) {
        const d = shiftedRmsl.shifted?.find((c) => c.checkpoint === 'CUSTOMER_DELIVERY');
        parts.push(`RMSL at delivery: ${d?.percentOfThreshold}% of threshold`);
      }
    }
    if (sequenceImpact?.compliant) parts.push('Japan sequence remains valid');
    if (lineCheck && !lineCheck.available) parts.push('Production line conflict detected');
    return parts.join('. ') || 'No significant impact detected';
  }

  evaluateOrderRmsl(packagingOrderId, batchId = null) {
    const order = this.provider.getOrderById(packagingOrderId);
    if (!order) throw new Error(`Order ${packagingOrderId} not found`);
    const batches = batchId
      ? this._batches().filter((b) => b.batchId === batchId)
      : this._batches().filter((b) => b.materialNumber === order.materialNumber);
    const rules = this._rules();
    const countryRule = (rules.countryRules || []).find(
      (r) => r.countryCode === order.destinationCountry
    );
    return batches.map((b) => this.rmslEngine.calculateTriplePoint(b, order, countryRule));
  }
}

module.exports = { TimePlanningService };
