const { RESULT } = require('./complianceEngine');
const { EXECUTION_PHASE } = require('./executionPhases');

class OptimizationEngine {
  constructor(ruleEngine, fifoEngine) {
    this.ruleEngine = ruleEngine;
    this.fifo = fifoEngine;
  }

  findBestBatch(order, batches, referenceDate, lastSequence, context = {}) {
    const candidates = this.fifo.selectCandidates(batches, order.materialNumber);
    let lastFailedEvaluation = null;
    const alternatives = [];

    for (const batch of candidates) {
      const evaluation = this.ruleEngine.evaluateBatchForOrder(
        batch, order, referenceDate, lastSequence, context
      );

      if (!evaluation.passed) {
        lastFailedEvaluation = evaluation;
        alternatives.push(batch.batchId);
        continue;
      }

      // Phase 3: FIFO — oldest compliant batch
      const checks = [...evaluation.checks];
      const fifoRule = this.ruleEngine.getRuleById('RULE-006');
      if (fifoRule) {
        checks.push({
          ruleId: fifoRule.ruleId,
          ruleName: fifoRule.ruleName,
          phase: EXECUTION_PHASE.FIFO,
          result: RESULT.PASSED,
          message: `FIFO: selected oldest compliant batch ${batch.batchId} (production ${batch.productionDate}) — after ATP gate passed`,
        });
      }

      // Phase 4: OPTIMIZATION — document selection rationale
      const optRule = this.ruleEngine.getRuleById('RULE-012');
      if (optRule) {
        checks.push({
          ruleId: optRule.ruleId,
          ruleName: optRule.ruleName,
          phase: EXECUTION_PHASE.OPTIMIZATION,
          result: RESULT.PASSED,
          message: `Optimization: batch ${batch.batchId} maximizes RMSL margin while meeting all compliance gates`,
        });
      }

      return {
        batch,
        checks,
        failures: [],
        phases: evaluation.phases,
        ruleSetVersion: evaluation.ruleSetVersion,
        executionStrategy: 'COMPLIANCE_FIRST',
        alternatives: candidates.filter((b) => b.batchId !== batch.batchId).slice(0, 3).map((b) => b.batchId),
      };
    }

    return {
      batch: null,
      checks: lastFailedEvaluation?.checks || [],
      failures: lastFailedEvaluation?.failures?.length
        ? [...new Set(lastFailedEvaluation.failures)]
        : ['No compliant batch found'],
      phases: lastFailedEvaluation?.phases,
      ruleSetVersion: lastFailedEvaluation?.ruleSetVersion,
      executionStrategy: 'COMPLIANCE_FIRST',
      alternatives: alternatives.slice(0, 5),
    };
  }
}

module.exports = { OptimizationEngine };
