const { generateId } = require('../utils/idGenerator');

const EXCEPTION_TYPES = {
  TRIC_VIOLATION: 'Market Release Violation',
  RMSL_VIOLATION: 'Shelf-Life Risk',
  MISSING_INVENTORY: 'Missing Inventory',
  BATCH_SPLIT_RESTRICTION: 'Batch Split Restriction',
  JAPAN_SEQUENCE_VIOLATION: 'Japan Sequence Violation',
  MISSING_SALES_ORDER_LINK: 'Missing Sales Order Link',
  MISSING_PACKING_SYSTEM_REF: 'Missing Packing System Reference',
  QUALITY_BLOCKED: 'Quality Blocked',
  NO_COMPLIANT_BATCH: 'No Compliant Batch',
  PLANNING_HORIZON_VIOLATION: 'Planning Horizon Violation',
};

class ExceptionEngine {
  mapFailureToExceptionType(failures = [], ruleChecks = []) {
    const text = [...failures, ...ruleChecks.map((c) => c.message)].join(' ').toLowerCase();
    if (text.includes('packing system') || text.includes('packing mapping') || text.includes('packing reference')) {
      return 'MISSING_PACKING_SYSTEM_REF';
    }
    if (text.includes('sales order') && (text.includes('missing') || text.includes('link') || text.includes('none'))) {
      return 'MISSING_SALES_ORDER_LINK';
    }
    if (text.includes('tric') || text.includes('market release')) return 'TRIC_VIOLATION';
    if (text.includes('rmsl') || text.includes('shelf')) return 'RMSL_VIOLATION';
    if (text.includes('split')) return 'BATCH_SPLIT_RESTRICTION';
    if (text.includes('sequence') || text.includes('japan')) return 'JAPAN_SEQUENCE_VIOLATION';
    if (text.includes('quality') || text.includes('blocked')) return 'QUALITY_BLOCKED';
    if (text.includes('atp') || text.includes('insufficient') || text.includes('inventory')) return 'MISSING_INVENTORY';
    return 'NO_COMPLIANT_BATCH';
  }

  severityFromRisk(riskLevel) {
    return { HIGH: 'CRITICAL', MEDIUM: 'WARNING', LOW: 'INFO' }[riskLevel] || 'WARNING';
  }

  buildException({ order, result, risk, userId = 'SYSTEM' }) {
    const type = this.mapFailureToExceptionType(result.failureReasons, result.ruleChecks);
    return {
      exceptionId: generateId('EXC'),
      type,
      typeLabel: EXCEPTION_TYPES[type] || type,
      packagingOrderId: order.packagingOrderId,
      destinationCountry: order.destinationCountry,
      batchId: result.recommendedBatchId,
      status: 'OPEN',
      severity: this.severityFromRisk(risk?.level),
      riskLevel: risk?.level || 'MEDIUM',
      riskScore: risk?.score || 0,
      message: result.failureReasons?.[0] || 'Allocation could not be completed',
      failureReasons: result.failureReasons || [],
      ruleChecks: result.ruleChecks || [],
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: null,
      createdBy: userId,
    };
  }
}

module.exports = { ExceptionEngine, EXCEPTION_TYPES };
