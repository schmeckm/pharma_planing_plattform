const { AllocationService } = require('./allocationService');
const { loadComplianceContext } = require('../utils/complianceContext');
const { getProvider } = require('../providers');

class ComplianceExplainService {
  constructor(allocationService = new AllocationService(), provider = getProvider()) {
    this.allocation = allocationService;
    this.provider = provider;
  }

  explain(packagingOrderId) {
    const context = loadComplianceContext();
    const order = this.provider.getOrderById(packagingOrderId);
    if (!order) return { error: 'NOT_FOUND', message: `Order ${packagingOrderId} not found` };

    const simulation = this.allocation.simulate({ packagingOrderId, userId: 'COMPLIANCE_EXPLAIN' });
    const mapping = context.getPackingMapping(packagingOrderId);
    const audit = this.provider.getAuditTrail({ packagingOrderId, limit: 1 });

    const complianceChecks = (simulation.ruleChecks || []).filter((c) => c.phase === 'COMPLIANCE' || !c.phase);
    const availabilityChecks = (simulation.ruleChecks || []).filter((c) => c.phase === 'AVAILABILITY');
    const marketChecks = (simulation.ruleChecks || []).filter((c) => c.phase === 'MARKET_RULES');
    const fifoChecks = (simulation.ruleChecks || []).filter((c) => c.phase === 'FIFO');
    const optChecks = (simulation.ruleChecks || []).filter((c) => c.phase === 'OPTIMIZATION');

    return {
      packagingOrderId,
      salesOrderId: order.salesOrderId,
      destinationCountry: order.destinationCountry,
      status: simulation.status,
      recommendedBatchId: simulation.recommendedBatchId,
      executionStrategy: simulation.executionStrategy || 'COMPLIANCE_FIRST',
      executionPriority: ['COMPLIANCE', 'AVAILABILITY', 'MARKET_RULES', 'FIFO', 'OPTIMIZATION'],
      ruleSetVersion: simulation.ruleSetVersion,
      packingSystem: mapping ? {
        packingSystemId: mapping.packingSystemId,
        salesOrderId: mapping.salesOrderId,
        validationStatus: mapping.validationStatus,
      } : null,
      phases: {
        compliance: { checks: complianceChecks, passed: !complianceChecks.some((c) => c.result === 'FAILED') },
        availability: { checks: availabilityChecks, passed: !availabilityChecks.some((c) => c.result === 'FAILED') },
        marketRules: { checks: marketChecks, passed: !marketChecks.some((c) => c.result === 'FAILED') },
        fifo: { checks: fifoChecks },
        optimization: { checks: optChecks },
      },
      explanation: this._buildNarrative(simulation, order, mapping),
      failureReasons: simulation.failureReasons,
      alternativeBatches: simulation.alternativeBatches,
      gmpAuditRef: audit.entries?.[0]?.decisionId,
    };
  }

  _buildNarrative(simulation, order, mapping) {
    if (simulation.status === 'FAILED') {
      return `Allocation blocked for ${order.packagingOrderId} (${order.destinationCountry}). `
        + `Compliance gates failed before FIFO/optimization: ${simulation.failureReasons?.join('; ')}`;
    }
    const batch = simulation.recommendedBatchId;
    const parts = [
      `Batch ${batch} selected for packaging order ${order.packagingOrderId}.`,
      mapping ? `Packing system confirms FG→SO link to ${mapping.salesOrderId}.` : null,
      'Compliance and ATP availability gates passed (quality stock, inspection lot, TRIC, RMSL).',
      'Market rules satisfied.',
      'FIFO applied among compliant candidates.',
    ].filter(Boolean);
    return parts.join(' ');
  }
}

module.exports = { ComplianceExplainService };
