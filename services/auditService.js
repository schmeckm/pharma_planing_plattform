const { JsonRepository } = require('../utils/jsonRepository');
const { generateId } = require('../utils/idGenerator');
const { ENGINE_VERSION } = require('../engines/executionPhases');

class AuditService {
  constructor(repository = new JsonRepository()) {
    this.repository = repository;
  }

  buildDecisionEntry({ order, batch, result, execute, userId, packingMapping = null }) {
    const compliancePassed = !(result.ruleChecks || []).some(
      (c) => (c.phase === 'COMPLIANCE' || !c.phase) && c.result === 'FAILED',
    );
    const availabilityPassed = !(result.ruleChecks || []).some(
      (c) => c.phase === 'AVAILABILITY' && c.result === 'FAILED',
    );

    return {
      decisionId: generateId('DEC'),
      timestamp: new Date().toISOString(),
      packagingOrderId: order.packagingOrderId,
      salesOrderId: order.salesOrderId || null,
      batchId: batch?.batchId || result.recommendedBatchId,
      allocatedQuantity: result.allocatedQuantity,
      status: execute && batch ? 'SUCCESS' : result.status,
      destinationCountry: order.destinationCountry,
      ruleChecks: result.ruleChecks,
      executionPhases: result.executionPhases,
      executionStrategy: result.executionStrategy || 'COMPLIANCE_FIRST',
      executionPriority: ['COMPLIANCE', 'AVAILABILITY', 'MARKET_RULES', 'FIFO', 'OPTIMIZATION'],
      ruleSetVersion: result.ruleSetVersion,
      engineVersion: ENGINE_VERSION,
      packingSystem: packingMapping ? {
        packingSystemId: packingMapping.packingSystemId,
        salesOrderId: packingMapping.salesOrderId,
      } : null,
      failureReasons: result.failureReasons,
      explanation: result.status === 'FAILED'
        ? `Blocked at compliance gate: ${result.failureReasons?.join('; ')}`
        : `Batch ${batch?.batchId} allocated — compliance-first strategy, all gates passed`,
      executionMode: execute ? 'EXECUTE' : 'SIMULATE',
      userId,
      riskLevel: result.risk?.level,
      riskScore: result.risk?.score,
      timeRmsl: result.timeRmsl || null,
      gmpAudit: {
        immutable: true,
        complianceFirst: true,
        compliancePhasePassed: compliancePassed,
        availabilityPhasePassed: availabilityPassed,
        recordedAt: new Date().toISOString(),
      },
    };
  }

  recordDecision(params) {
    const entry = this.buildDecisionEntry(params);
    this.repository.appendToArray('auditTrail', entry);
    return entry;
  }

  appendDecisionEntries(entries = []) {
    if (!entries.length) return [];
    return this.repository.appendManyToArray('auditTrail', entries);
  }

  recordRelease({ order, batch, releasedQuantity, userId, previousStatus }) {
    const entry = {
      decisionId: generateId('DEC'),
      timestamp: new Date().toISOString(),
      packagingOrderId: order.packagingOrderId,
      salesOrderId: order.salesOrderId || null,
      batchId: batch?.batchId || order.allocatedBatchId || null,
      allocatedQuantity: releasedQuantity,
      status: 'RELEASED',
      destinationCountry: order.destinationCountry,
      ruleChecks: [],
      failureReasons: [],
      explanation: batch
        ? `Batch ${batch.batchId} released — ${releasedQuantity} EA returned to inventory`
        : 'Simulation recommendation cleared',
      executionMode: 'RELEASE',
      userId,
      previousStatus,
      gmpAudit: {
        immutable: true,
        complianceFirst: true,
        recordedAt: new Date().toISOString(),
      },
    };

    this.repository.appendToArray('auditTrail', entry);
    return entry;
  }

  getAuditTrail({ packagingOrderId, batchId, status, limit = 100 } = {}) {
    const all = this.repository.readArray('auditTrail');
    const filtered = all
      .slice()
      .reverse()
      .filter((entry) => {
        if (packagingOrderId && entry.packagingOrderId !== packagingOrderId) return false;
        if (batchId && entry.batchId !== batchId) return false;
        if (status && entry.status !== status) return false;
        return true;
      })
      .slice(0, limit);

    return { total: all.length, entries: filtered };
  }
}

module.exports = { AuditService };
