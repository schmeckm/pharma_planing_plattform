const { RmslForecastEngine } = require('./rmslForecastEngine');
const { remainingShelfLifeMonths } = require('../utils/dateUtils');

class ProductionSequencingEngine {
  constructor() {
    this.rmslEngine = new RmslForecastEngine();
  }

  /**
   * Evaluate packaging order sequence on a production line.
   */
  evaluateSequence(orders, batches, rulesData, lineId = null) {
    let lineOrders = orders
      .filter((o) => o.status === 'OPEN')
      .filter((o) => !lineId || o.productionLine === lineId)
      .sort((a, b) => new Date(a.plannedStartDate) - new Date(b.plannedStartDate));

    const sequence = [];
    const issues = [];
    let lastEnd = null;
    let jpLastSequence = (rulesData.sequenceState?.JP?.lastAllocatedSequence) || 0;

    for (let i = 0; i < lineOrders.length; i++) {
      const order = lineOrders[i];
      const entry = {
        sequence: i + 1,
        packagingOrderId: order.packagingOrderId,
        processOrder: order.processOrder,
        productionLine: order.productionLine,
        plannedStartDate: order.plannedStartDate,
        plannedEndDate: order.plannedEndDate,
        destinationCountry: order.destinationCountry,
        priority: order.priority,
        compliance: { sequenceGap: false, japanSequence: 'N/A', fifo: 'PENDING', rmsl: 'PENDING' },
      };

      if (lastEnd && new Date(order.plannedStartDate) < new Date(lastEnd)) {
        entry.compliance.sequenceGap = true;
        issues.push({
          type: 'OVERLAP',
          packagingOrderId: order.packagingOrderId,
          message: `Order overlaps previous slot ending ${lastEnd}`,
          severity: 'HIGH',
        });
      }

      if (order.destinationCountry === 'JP') {
        const jpBatches = batches
          .filter((b) => b.materialNumber === order.materialNumber && b.approvedCountries?.includes('JP'))
          .sort((a, b) => (a.batchSequence || 0) - (b.batchSequence || 0));
        const expectedSeq = jpLastSequence + 1;
        const nextBatch = jpBatches.find((b) => b.batchSequence === expectedSeq);
        entry.compliance.japanSequence = nextBatch
          ? `Valid — expects batch sequence ${expectedSeq} (${nextBatch.batchId})`
          : `Violation — expected sequence ${expectedSeq}, no matching batch`;
        if (!nextBatch) {
          issues.push({
            type: 'JAPAN_SEQUENCE',
            packagingOrderId: order.packagingOrderId,
            message: entry.compliance.japanSequence,
            severity: 'HIGH',
          });
        } else {
          jpLastSequence = expectedSeq;
          const countryRule = (rulesData.countryRules || []).find((r) => r.countryCode === 'JP');
          const rmsl = this.rmslEngine.calculateTriplePoint(nextBatch, order, countryRule);
          entry.compliance.rmsl = rmsl.overallPassed ? 'OK' : 'AT_RISK';
          entry.rmslForecast = rmsl;
          if (!rmsl.overallPassed) {
            issues.push({
              type: 'RMSL_SEQUENCE',
              packagingOrderId: order.packagingOrderId,
              message: `RMSL risk in sequence slot ${i + 1}`,
              severity: 'MEDIUM',
            });
          }
        }
      }

      const fifoCandidates = batches
        .filter((b) => b.materialNumber === order.materialNumber && b.qualityStatus === 'RELEASED')
        .sort((a, b) => new Date(a.productionDate) - new Date(b.productionDate));
      entry.compliance.fifo = fifoCandidates.length
        ? `Oldest: ${fifoCandidates[0].batchId} (${fifoCandidates[0].productionDate})`
        : 'No eligible batch';

      sequence.push(entry);
      lastEnd = order.plannedEndDate || order.plannedStartDate;
    }

    return {
      lineId: lineId || 'ALL',
      orderCount: sequence.length,
      sequence,
      issues,
      compliant: issues.filter((i) => i.severity === 'HIGH').length === 0,
    };
  }

  /**
   * Re-sequence orders (what-if) and re-evaluate.
   */
  simulateResequence(orders, newOrderIds, batches, rulesData, lineId) {
    const orderMap = Object.fromEntries(orders.map((o) => [o.packagingOrderId, { ...o }]));
    let cursor = orderMap[newOrderIds[0]]?.plannedStartDate;
    const resequenced = [];

    for (const id of newOrderIds) {
      const o = orderMap[id];
      if (!o) continue;
      const duration = o.plannedEndDate && o.plannedStartDate
        ? Math.max(1, Math.round((new Date(o.plannedEndDate) - new Date(o.plannedStartDate)) / 86400000))
        : 2;
      o.plannedStartDate = cursor;
      o.plannedEndDate = require('../utils/dateUtils').addDays(cursor, duration);
      cursor = o.plannedEndDate;
      resequenced.push(o);
    }

    const others = orders.filter((o) => !newOrderIds.includes(o.packagingOrderId));
    return this.evaluateSequence([...resequenced, ...others], batches, rulesData, lineId);
  }
}

module.exports = { ProductionSequencingEngine };
