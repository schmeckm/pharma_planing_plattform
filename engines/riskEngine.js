const { remainingShelfLifeMonths } = require('../utils/dateUtils');

const RISK_LEVEL = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' };

class RiskEngine {
  /**
   * Calculate allocation risk score from multiple factors.
   * @returns {{ score: number, level: string, factors: Array }}
   */
  assess({
    order,
    batch,
    countryRule,
    eligibleBatchCount,
    atpCoverage,
    batchSplitRestricted = false,
    lineReliability = null,
    referenceDate = new Date(),
  }) {
    const factors = [];
    let score = 0;

    // Eligible batches (fewer = higher risk)
    const batchCount = eligibleBatchCount ?? 0;
    if (batchCount === 0) {
      score += 40;
      factors.push({ factor: 'Eligible Batches', value: 0, impact: 'HIGH', message: 'No compliant batches available' });
    } else if (batchCount === 1) {
      score += 25;
      factors.push({ factor: 'Eligible Batches', value: 1, impact: 'HIGH', message: 'Only one compliant batch — no fallback' });
    } else if (batchCount <= 3) {
      score += 12;
      factors.push({ factor: 'Eligible Batches', value: batchCount, impact: 'MEDIUM', message: 'Limited batch options' });
    } else {
      factors.push({ factor: 'Eligible Batches', value: batchCount, impact: 'LOW', message: 'Multiple compliant batches available' });
    }

    // RMSL margin
    if (batch && countryRule) {
      const rmsl = remainingShelfLifeMonths(batch.expiryDate, referenceDate);
      const threshold = countryRule.rmslThresholdMonths || 12;
      const margin = rmsl - threshold;
      if (margin < 3) {
        score += 30;
        factors.push({ factor: 'RMSL Margin', value: `${margin.toFixed(1)} mo`, impact: 'HIGH', message: 'RMSL margin critically low' });
      } else if (margin < 6) {
        score += 15;
        factors.push({ factor: 'RMSL Margin', value: `${margin.toFixed(1)} mo`, impact: 'MEDIUM', message: 'RMSL margin below comfort zone' });
      } else {
        factors.push({ factor: 'RMSL Margin', value: `${margin.toFixed(1)} mo`, impact: 'LOW', message: 'Adequate RMSL margin' });
      }
    }

    // ATP inventory coverage
    if (batch && order) {
      const coverage = atpCoverage ?? (batch.availableQuantity / order.quantity);
      if (coverage < 1) {
        score += 35;
        factors.push({ factor: 'ATP Inventory Coverage', value: `${(coverage * 100).toFixed(0)}%`, impact: 'HIGH', message: 'ATP inventory insufficient for order quantity' });
      } else if (coverage < 1.2) {
        score += 15;
        factors.push({ factor: 'ATP Inventory Coverage', value: `${(coverage * 100).toFixed(0)}%`, impact: 'MEDIUM', message: 'ATP coverage is tight — limited buffer' });
      } else {
        factors.push({ factor: 'ATP Inventory Coverage', value: `${(coverage * 100).toFixed(0)}%`, impact: 'LOW', message: 'Adequate ATP inventory coverage' });
      }
    }

    // Batch split restriction
    const splitRestricted = batchSplitRestricted || (countryRule && countryRule.allowBatchSplit === false);
    if (splitRestricted) {
      score += 10;
      factors.push({
        factor: 'Batch Split Restriction',
        value: 'Not Allowed',
        impact: 'MEDIUM',
        message: 'Full order quantity must come from a single batch',
      });
    }

    // Market restrictions
    if (countryRule?.requiresContinuousSequence) {
      score += 10;
      factors.push({ factor: 'Market Restrictions', value: 'Sequence', impact: 'MEDIUM', message: 'Continuous batch sequence required (Japan)' });
    }
    if (countryRule?.requiresTric === false) {
      factors.push({ factor: 'Market Restriction', value: 'Open Market', impact: 'LOW', message: 'No market release approval required' });
    } else if (countryRule?.requiresTric) {
      score += 5;
      factors.push({ factor: 'Market Restriction', value: 'TRIC Required', impact: 'MEDIUM', message: 'Market release approval required for destination' });
    }

    // Delivery urgency
    if (order?.salesOrder?.requestedDeliveryDate) {
      const delivery = new Date(order.salesOrder.requestedDeliveryDate);
      const daysUntil = (delivery - referenceDate) / (1000 * 60 * 60 * 24);
      if (daysUntil < 14) {
        score += 20;
        factors.push({ factor: 'Delivery Urgency', value: `${Math.round(daysUntil)} days`, impact: 'HIGH', message: 'Delivery within 2 weeks' });
      } else if (daysUntil < 30) {
        score += 10;
        factors.push({ factor: 'Delivery Urgency', value: `${Math.round(daysUntil)} days`, impact: 'MEDIUM', message: 'Delivery within 30 days' });
      } else {
        factors.push({ factor: 'Delivery Urgency', value: `${Math.round(daysUntil)} days`, impact: 'LOW', message: 'Adequate lead time' });
      }
    }

    // Line reliability (sequencing / production performance)
    if (lineReliability != null) {
      if (lineReliability < 80) {
        score += 18;
        factors.push({ factor: 'Line Reliability', value: `${lineReliability}%`, impact: 'HIGH', message: 'Production line has low historical reliability' });
      } else if (lineReliability < 90) {
        score += 8;
        factors.push({ factor: 'Line Reliability', value: `${lineReliability}%`, impact: 'MEDIUM', message: 'Production line reliability below target' });
      } else {
        factors.push({ factor: 'Line Reliability', value: `${lineReliability}%`, impact: 'LOW', message: 'Production line reliability acceptable' });
      }
    }

    score = Math.min(100, score);
    let level = RISK_LEVEL.LOW;
    if (score >= 50) level = RISK_LEVEL.HIGH;
    else if (score >= 25) level = RISK_LEVEL.MEDIUM;

    return { score, level, factors };
  }

  /** Planning-context risk including line reliability */
  assessPlanning(order, options = {}) {
    return this.assess({
      order,
      batch: options.batch,
      countryRule: options.countryRule,
      eligibleBatchCount: options.eligibleBatchCount,
      lineReliability: order.lineReliability ?? options.lineReliability,
      referenceDate: options.referenceDate,
    });
  }
}

module.exports = { RiskEngine, RISK_LEVEL };
