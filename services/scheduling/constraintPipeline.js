const { ComplianceEngine, RESULT } = require('../../engines/complianceEngine');
const { RmslForecastEngine } = require('../../engines/rmslForecastEngine');
const { InventoryEngine } = require('../../engines/inventoryEngine');
const { FifoEngine } = require('../../engines/fifoEngine');
const { JsonRepository } = require('../../utils/jsonRepository');
const { loadComplianceContext } = require('../../utils/complianceContext');

const TRIC_RULE = { ruleId: 'RULE-002', ruleName: 'TRIC Validation' };
const ATP_RULE = { ruleId: 'RULE-ATP', ruleName: 'ATP Check' };

/**
 * Pre-optimization compliance gate — reuses existing pharma engines.
 * Output feeds OR-Tools as eligible (order, batch) pairs and hard-fail list.
 */
class ConstraintPipeline {
  constructor(provider, repository = new JsonRepository()) {
    this.provider = provider;
    this.compliance = new ComplianceEngine();
    this.rmsl = new RmslForecastEngine();
    this.inventory = new InventoryEngine(repository);
    this.fifo = new FifoEngine();
  }

  _countryRules(rulesData) {
    if (rulesData?.countryRules?.length) return rulesData.countryRules;
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const dir = process.env.HAP_DATA_DIR || path.join(__dirname, '../../data');
      const legacy = JSON.parse(fs.readFileSync(path.join(dir, 'rules.json'), 'utf-8'));
      return legacy.countryRules || [];
    } catch {
      return [];
    }
  }

  _countryRule(rulesData, countryCode) {
    return this._countryRules(rulesData).find((r) => r.countryCode === countryCode) || null;
  }

  _inspectionLots() {
    try {
      const repo = new JsonRepository();
      const lots = repo.readArray('inspectionLots');
      return lots || [];
    } catch {
      return [];
    }
  }

  _lotForBatch(batchId, lots) {
    return lots.find((lot) => lot.batchId === batchId) || null;
  }

  _blockedByQa(batch, lots) {
    if (!batch) return false;
    const lot = this._lotForBatch(batch.batchId, lots);
    return lot != null && (lot.status === 'PENDING' || lot.status === 'IN_PROGRESS');
  }

  _pickBestBatch(order, batches, rulesData) {
    const countryRule = this._countryRule(rulesData, order.destinationCountry);
    if (!countryRule) return { batch: null, checks: [], passed: false };

    const candidates = this.fifo
      .selectCandidates(batches, order.materialNumber || order.material)
      .filter((b) => b.qualityStatus === 'RELEASED')
      .filter((b) => !order.destinationCountry || (b.approvedCountries || []).includes(order.destinationCountry));

    for (const batch of candidates) {
      const checks = this._runBatchChecks(order, batch, countryRule, batches, rulesData);
      const passed = checks.every((c) => c.result === RESULT.PASSED || c.result === RESULT.SKIPPED);
      if (passed) return { batch, checks, passed: true };
    }

    const first = candidates[0];
    if (!first) {
      return { batch: null, checks: [{ phase: 'COMPLIANCE', result: RESULT.FAILED, message: 'No eligible batch' }], passed: false };
    }
    return {
      batch: first,
      checks: this._runBatchChecks(order, first, countryRule, batches, rulesData),
      passed: false,
    };
  }

  _runBatchChecks(order, batch, countryRule, allBatches, rulesData) {
    const checks = [];
    checks.push(this.compliance.checkTric(batch, order.destinationCountry, countryRule, TRIC_RULE));
    checks.push(this.inventory.checkAtp(batch, order, ATP_RULE, {
      reservations: loadComplianceContext().reservations,
    }));
    const rmslForecast = this.rmsl.calculateTriplePoint(batch, order, countryRule);
    checks.push({
      ruleName: 'RMSL Triple-Point',
      phase: 'COMPLIANCE',
      result: rmslForecast.overallPassed ? RESULT.PASSED : RESULT.FAILED,
      rmslForecast,
    });
    const fifoCandidates = this.fifo.selectCandidates(allBatches, order.materialNumber || order.material);
    const fifoOk = fifoCandidates[0]?.batchId === batch.batchId;
    checks.push({
      ruleName: 'FIFO',
      result: fifoOk ? RESULT.PASSED : RESULT.FAILED,
      message: fifoOk ? `Batch ${batch.batchId} is FIFO-compliant` : 'FIFO deviation',
    });
    return checks;
  }

  /**
   * @param {object[]} orders
   * @returns {{ items: object[], summary: object }}
   */
  evaluate(orders = []) {
    const rulesData = this.provider.getRules();
    const batches = this.provider.getBatches();
    const lots = this._inspectionLots();
    const items = [];

    for (const order of orders) {
      const { batch, checks, passed } = this._pickBestBatch(order, batches, rulesData);
      const qaBlocked = batch ? this._blockedByQa(batch, lots) : false;
      const hardFailed = qaBlocked || !passed;

      items.push({
        packagingOrderId: order.packagingOrderId || order.packagingOrder,
        materialNumber: order.materialNumber || order.material,
        destinationCountry: order.destinationCountry,
        eligible: !hardFailed,
        recommendedBatchId: batch?.batchId || null,
        qaBlocked,
        checks,
        hardConstraints: {
          atp: checks.some((c) => c.ruleName === 'ATP Check' && c.result === RESULT.PASSED),
          tric: checks.some((c) => c.ruleName === 'TRIC Validation' && (c.result === RESULT.PASSED || c.result === RESULT.SKIPPED)),
          rmsl: checks.some((c) => c.ruleName === 'RMSL Triple-Point' && c.result === RESULT.PASSED),
          qaReleased: !qaBlocked,
        },
      });
    }

    const eligible = items.filter((i) => i.eligible);
    return {
      items,
      summary: {
        total: items.length,
        eligible: eligible.length,
        blocked: items.length - eligible.length,
        qaBlocked: items.filter((i) => i.qaBlocked).length,
        atpFailed: items.filter((i) => !i.hardConstraints.atp).length,
        tricFailed: items.filter((i) => !i.hardConstraints.tric).length,
        rmslFailed: items.filter((i) => !i.hardConstraints.rmsl).length,
      },
    };
  }
}

module.exports = { ConstraintPipeline };
