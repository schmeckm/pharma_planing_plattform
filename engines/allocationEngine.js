const { generateId } = require('../utils/idGenerator');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { ComplianceEngine } = require('./complianceEngine');
const { FifoEngine } = require('./fifoEngine');
const { SequencingEngine } = require('./sequencingEngine');
const { RuleEngine } = require('./ruleEngine');
const { OptimizationEngine } = require('./optimizationEngine');
const { RiskEngine } = require('./riskEngine');
const { RmslForecastEngine } = require('./rmslForecastEngine');
const { InventoryEngine } = require('./inventoryEngine');
const { loadComplianceContext } = require('../utils/complianceContext');

/**
 * Allocation engine — orchestrates compliance, FIFO, sequencing, and batch selection.
 * Controllers delegate here; business rules come from rulesV2 (effective-dated) merged with rules.json definitions.
 */
class AllocationEngine {
  constructor({ repository, dataService, auditService }) {
    this.repository = repository;
    this.dataService = dataService;
    this.auditService = auditService;
    this.complianceEngine = new ComplianceEngine();
    this.fifoEngine = new FifoEngine();
    this.inventoryEngine = new InventoryEngine(repository);
    this.sequencingEngine = new SequencingEngine(repository);
    this.riskEngine = new RiskEngine();
    this.rmslForecastEngine = new RmslForecastEngine();
  }

  _buildRulePipeline() {
    const rulesData = this.dataService.getRules();
    const { RuleIntegrationService } = require('../services/ruleIntegrationService');
    const integrationService = new RuleIntegrationService(this.repository.dataDir);
    const ruleEngine = new RuleEngine(this.complianceEngine, rulesData, integrationService);
    const optimizationEngine = new OptimizationEngine(ruleEngine, this.fifoEngine);
    return { rulesData, ruleEngine, optimizationEngine };
  }

  simulate({ packagingOrderId, userId = 'SYSTEM' }) {
    return this._run({ packagingOrderId, execute: false, userId });
  }

  execute({ packagingOrderId, batchId = null, userId = 'SYSTEM', force = false }) {
    return this._run({ packagingOrderId, execute: true, userId, batchId, force });
  }

  release({ packagingOrderId, userId = 'SYSTEM' }) {
    const order = this.dataService.getPackagingOrder(packagingOrderId);
    const batchId = order.allocatedBatchId;
    const qty = order.allocatedQuantity || order.quantity;
    const previousStatus = order.status;
    const hadAllocation = Boolean(
      batchId && ['ALLOCATED', 'PARTIALLY_ALLOCATED', 'SUCCESS'].includes(order.status),
    );

    const { entries } = this.auditService.getAuditTrail({ packagingOrderId, limit: 20 });
    const lastSim = entries.find((e) => e.status === 'SIMULATED' || e.status === 'SUCCESS');

    if (!hadAllocation && !batchId && !lastSim && order.status !== 'SIMULATED') {
      throw new ValidationError(`Order ${packagingOrderId} has no batch assignment to release`);
    }

    const effectiveBatchId = batchId || lastSim?.batchId || null;
    let batch = null;

    if (hadAllocation && batchId) {
      batch = this.inventoryEngine.restoreQuantity(batchId, qty);
    } else if (effectiveBatchId) {
      batch = this.dataService.getAllBatchesRaw().find((b) => b.batchId === effectiveBatchId) || null;
    }

    const updated = this.dataService.updatePackagingOrder(packagingOrderId, {
      status: 'PLANNED',
      allocatedBatchId: null,
      allocatedQuantity: null,
    });

    this.auditService.recordRelease({
      order: updated,
      batch,
      releasedQuantity: hadAllocation ? qty : 0,
      userId,
      previousStatus,
    });

    return {
      packagingOrderId,
      status: 'RELEASED',
      previousStatus,
      releasedBatchId: effectiveBatchId,
      releasedQuantity: hadAllocation ? qty : 0,
      inventoryRestored: hadAllocation,
    };
  }

  massRelease({ packagingOrderIds = [], userId = 'SYSTEM' }) {
    let orderIds = packagingOrderIds;
    if (!orderIds.length) {
      const { entries } = this.auditService.getAuditTrail({ limit: 500 });
      const simOrders = new Set(
        entries
          .filter((e) => e.status === 'SIMULATED' || e.status === 'SUCCESS')
          .map((e) => e.packagingOrderId),
      );
      orderIds = this.dataService
        .getPackagingOrders()
        .filter(
          (o) =>
            o.allocatedBatchId
            || o.status === 'ALLOCATED'
            || o.status === 'SIMULATED'
            || o.status === 'PARTIALLY_ALLOCATED'
            || simOrders.has(o.packagingOrderId),
        )
        .map((o) => o.packagingOrderId);
    }

    const results = [];
    for (const id of orderIds) {
      try {
        results.push(this.release({ packagingOrderId: id, userId }));
      } catch (err) {
        results.push({
          packagingOrderId: id,
          status: 'FAILED',
          failureReasons: [err.message],
        });
      }
    }

    return {
      releaseId: generateId('REL'),
      timestamp: new Date().toISOString(),
      totalOrders: results.length,
      successful: results.filter((r) => r.status === 'RELEASED').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      results,
    };
  }

  massSimulate({ packagingOrderIds = [], destinationCountry = null, statusFilter = 'PLANNED', userId = 'SYSTEM' }) {
    let orderIds = packagingOrderIds;
    if (!orderIds.length) {
      orderIds = this.dataService
        .getPackagingOrders({ status: statusFilter, country: destinationCountry })
        .map((o) => o.packagingOrderId);
    }

    const results = [];
    const auditEntries = [];
    for (const id of orderIds) {
      try {
        const result = this._run({
          packagingOrderId: id,
          execute: false,
          userId,
          deferAudit: true,
        });
        if (result._auditEntry) {
          auditEntries.push(result._auditEntry);
          delete result._auditEntry;
        }
        results.push(result);
      } catch (err) {
        results.push({
          packagingOrderId: id,
          status: 'FAILED',
          failureReasons: [err.message],
          ruleChecks: [],
        });
      }
    }

    try {
      this.auditService.appendDecisionEntries(auditEntries);
    } catch (err) {
      for (const result of results) {
        if (result.status === 'SIMULATED' || result.status === 'SUCCESS') {
          result.status = 'FAILED';
          result.failureReasons = [
            ...(result.failureReasons || []),
            `Audit persistence failed: ${err.message}`,
          ];
        }
      }
    }

    return {
      simulationId: generateId('SIM'),
      timestamp: new Date().toISOString(),
      totalOrders: results.length,
      successful: results.filter((r) => r.status === 'SIMULATED' || r.status === 'SUCCESS').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      results,
    };
  }

  _run({ packagingOrderId, execute, userId, batchId = null, force = false, deferAudit = false }) {
    const order = this.dataService.getPackagingOrder(packagingOrderId);
    const complianceContext = loadComplianceContext();

    if (order.status === 'CLOSED' && !force) {
      throw new ValidationError(`Order ${packagingOrderId} is closed`);
    }

    const { rulesData, ruleEngine, optimizationEngine } = this._buildRulePipeline();
    const batches = this.dataService.getAllBatchesRaw();
    const referenceDate = new Date();
    const lastSequence = this.sequencingEngine.getLastSequence(order.destinationCountry, rulesData);

    let selected = null;
    let checks = [];
    let failures = [];
    let alternatives = [];
    let phases = null;
    let ruleSetVersion = rulesData.ruleSetVersion || '1.0.0';
    let executionStrategy = 'COMPLIANCE_FIRST';

    if (batchId && !execute) {
      const batch = batches.find((b) => b.batchId === batchId);
      if (!batch) throw new NotFoundError('Batch', batchId);
      const evaluation = ruleEngine.evaluateBatchForOrder(
        batch, order, referenceDate, lastSequence, complianceContext,
      );
      checks = evaluation.checks;
      failures = evaluation.failures;
      phases = evaluation.phases;
      ruleSetVersion = evaluation.ruleSetVersion;
      selected = evaluation.passed || force ? batch : null;
    } else {
      const result = optimizationEngine.findBestBatch(
        order, batches, referenceDate, lastSequence, complianceContext,
      );
      selected = result.batch;
      checks = result.checks;
      failures = result.failures;
      alternatives = result.alternatives;
      phases = result.phases;
      ruleSetVersion = result.ruleSetVersion || ruleSetVersion;
      executionStrategy = result.executionStrategy || executionStrategy;
    }

    let status;
    let allocatedQuantity = 0;

    if (selected && execute && !force) {
      const freshBatch = this.dataService.getAllBatchesRaw().find((b) => b.batchId === selected.batchId);
      const revalidation = ruleEngine.evaluateBatchForOrder(
        freshBatch || selected, order, referenceDate, lastSequence, complianceContext,
      );
      if (!revalidation.passed) {
        selected = null;
        checks = revalidation.checks;
        failures = revalidation.failures;
        phases = revalidation.phases;
      }
    }

    if (selected) {
      status = execute ? 'SUCCESS' : 'SIMULATED';
      allocatedQuantity = order.quantity;
      if (execute) this._persistAllocation(order, selected, rulesData);
    } else {
      status = 'FAILED';
      if (execute && failures.length) {
        failures = [...failures];
      } else if (execute) {
        failures = ['Execute blocked — gates no longer pass. Re-simulate before allocating.'];
      }
    }

    const countryRule = (rulesData.countryRules || []).find((r) => r.countryCode === order.destinationCountry);
    const eligibleCount = alternatives.length + (selected ? 1 : 0);
    const timeRmsl = selected && countryRule
      ? this.rmslForecastEngine.calculateTriplePoint(selected, order, countryRule)
      : null;

    const risk = this.riskEngine.assess({
      order,
      batch: selected,
      countryRule,
      eligibleBatchCount: eligibleCount || batches.filter((b) => b.materialNumber === order.materialNumber).length,
      referenceDate,
    });

    const allocationResult = {
      packagingOrderId,
      salesOrderId: order.salesOrderId,
      status,
      recommendedBatchId: selected?.batchId || null,
      allocatedQuantity,
      ruleChecks: checks,
      failureReasons: failures.length ? failures : selected ? [] : ['No compliant batch found'],
      alternativeBatches: alternatives,
      executionStrategy,
      executionPhases: phases,
      ruleSetVersion,
      timeRmsl,
      risk,
    };

    const packingMapping = complianceContext.getPackingMapping(packagingOrderId);
    if (deferAudit) {
      allocationResult._auditEntry = this.auditService.buildDecisionEntry({
        order,
        batch: selected,
        result: allocationResult,
        execute,
        userId,
        packingMapping,
      });
    } else {
      this.auditService.recordDecision({
        order,
        batch: selected,
        result: allocationResult,
        execute,
        userId,
        packingMapping,
      });
    }

    return allocationResult;
  }

  _persistAllocation(order, batch, rulesData) {
    this.inventoryEngine.deductQuantity(batch.batchId, order.quantity);
    this.dataService.updatePackagingOrder(order.packagingOrderId, {
      status: 'ALLOCATED',
      allocatedBatchId: batch.batchId,
      allocatedQuantity: order.quantity,
    });
    this.sequencingEngine.updateSequenceAfterAllocation(order, batch, rulesData);
  }
}

module.exports = { AllocationEngine };
