const { RESULT, ComplianceEngine } = require('./complianceEngine');
const { RmslForecastEngine } = require('./rmslForecastEngine');
const { FifoEngine } = require('./fifoEngine');

class SequenceValidationEngine {
  constructor() {
    this.compliance = new ComplianceEngine();
    this.rmsl = new RmslForecastEngine();
    this.fifo = new FifoEngine();
  }

  validateOrderPlacement(order, batch, rulesData, context = {}) {
    const countryRule = (rulesData.countryRules || []).find(
      (r) => r.countryCode === order.destinationCountry
    );
    const issues = [];
    const checks = [];

    if (!countryRule) {
      issues.push({ code: 'NO_COUNTRY_RULE', severity: 'HIGH', message: `No rules for ${order.destinationCountry}` });
      return { valid: false, issues, checks };
    }

    const tricDef = { ruleId: 'RULE-002', ruleName: 'TRIC Validation' };
    const tric = this.compliance.checkTric(batch, order.destinationCountry, countryRule, tricDef);
    checks.push(tric);
    if (tric.result === RESULT.FAILED) {
      issues.push({ code: 'TRIC', severity: 'HIGH', message: tric.message });
    }

    const rmslForecast = this.rmsl.calculateTriplePoint(batch, order, countryRule);
    checks.push({ ruleName: 'RMSL Triple-Point', phase: 'COMPLIANCE', result: rmslForecast.overallPassed ? RESULT.PASSED : RESULT.FAILED, rmslForecast });
    for (const w of rmslForecast.warnings) {
      issues.push({ code: w.code, severity: w.severity, message: w.message });
    }

    const fifoCandidates = this.fifo.selectCandidates(context.batches || [], order.material || order.materialNumber);
    const fifoOk = fifoCandidates[0]?.batchId === batch.batchId;
    checks.push({
      ruleName: 'FIFO',
      result: fifoOk ? RESULT.PASSED : RESULT.FAILED,
      message: fifoOk ? `Batch ${batch.batchId} is FIFO-compliant` : `FIFO deviation — oldest is ${fifoCandidates[0]?.batchId}`,
    });
    if (!fifoOk) {
      issues.push({ code: 'FIFO_DEVIATION', severity: 'MEDIUM', message: checks[checks.length - 1].message });
    }

    return {
      valid: issues.filter((i) => i.severity === 'HIGH').length === 0,
      issues,
      checks,
      rmslForecast,
      recommendedBatchId: batch.batchId,
      riskScore: issues.length * 10 + (rmslForecast.overallPassed ? 0 : 30),
    };
  }

  validateJapanSequence(ordersOnLine, batches, rulesData) {
    const jpOrders = ordersOnLine.filter((o) => o.destinationCountry === 'JP');
    if (!jpOrders.length) return { valid: true, issues: [] };

    const issues = [];
    let expectedSeq = (rulesData.sequenceState?.JP?.lastAllocatedSequence) || 0;

    for (const order of jpOrders) {
      expectedSeq += 1;
      const batch = batches.find(
        (b) => b.materialNumber === (order.material || order.materialNumber)
          && b.batchSequence === expectedSeq
          && b.approvedCountries?.includes('JP')
      );
      if (!batch) {
        issues.push({
          code: 'JP_SEQUENCE',
          severity: 'HIGH',
          packagingOrder: order.packagingOrder || order.packagingOrderId,
          message: `Japan continuous sequence expects batch sequence ${expectedSeq}`,
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

module.exports = { SequenceValidationEngine };
