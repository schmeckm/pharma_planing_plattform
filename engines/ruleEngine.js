const { RESULT } = require('./complianceEngine');
const { EXECUTION_PHASE } = require('./executionPhases');
const { GATE_PHASE_ORDER, buildGatePipeline, createRuleEvaluator, sortRuleDefinitions } = require('./ruleRegistry');
const { isRuleEffective } = require('../utils/ruleEffectiveDate');

class RuleEngine {
  constructor(complianceEngine, rulesData, integrationService = null) {
    this.compliance = complianceEngine;
    this.rulesData = rulesData;
    this.integrationService = integrationService;
  }

  getAllRuleDefinitions() {
    return this.rulesData.ruleDefinitions || [];
  }

  getRuleDefinitions() {
    return this.getAllRuleDefinitions().filter((r) => r.active !== false);
  }

  getSortedRuleDefinitions() {
    return sortRuleDefinitions(this.getAllRuleDefinitions());
  }

  getApplicableGateRules(referenceDate = new Date()) {
    return sortRuleDefinitions(
      this.getAllRuleDefinitions().filter(
        (r) => isRuleEffective(r, referenceDate) && GATE_PHASE_ORDER.includes(r.ruleType),
      ),
    );
  }

  getGatePipeline(referenceDate = new Date()) {
    return buildGatePipeline(this.getAllRuleDefinitions(), referenceDate);
  }

  getRuleByType(type) {
    return this.getRuleDefinitions().find((r) => r.ruleType === type);
  }

  _resolveRuleDef(ruleId) {
    return this.getAllRuleDefinitions().find((r) => r.ruleId === ruleId);
  }

  getRuleById(ruleId) {
    const def = this._resolveRuleDef(ruleId);
    if (!def || def.active === false) return undefined;
    return def;
  }

  getCountryRule(countryCode) {
    return (this.rulesData.countryRules || []).find(
      (r) => r.countryCode === countryCode && r.active !== false,
    );
  }

  getRuleSetVersion() {
    return this.rulesData.ruleSetVersion || '1.0.0';
  }

  /**
   * Gate evaluation driven by admin ruleDefinitions (active + priority per phase).
   * FIFO/OPTIMIZATION remain in OptimizationEngine.
   */
  evaluateBatchForOrder(batch, order, referenceDate, lastSequence, context = {}) {
    const countryRule = this.getCountryRule(order.destinationCountry);
    if (!countryRule) {
      return {
        passed: false,
        checks: [],
        failures: [`No country rules configured for ${order.destinationCountry}`],
        phases: {},
        ruleSetVersion: this.getRuleSetVersion(),
      };
    }

    const phases = {
      [EXECUTION_PHASE.COMPLIANCE]: { passed: true, checks: [], failures: [] },
      [EXECUTION_PHASE.AVAILABILITY]: { passed: true, checks: [], failures: [] },
      [EXECUTION_PHASE.MARKET_RULES]: { passed: true, checks: [], failures: [] },
      [EXECUTION_PHASE.PRODUCTION]: { passed: true, checks: [], failures: [] },
    };

    const complianceContext = {
      ...context,
      reservations: context.getReservations?.(batch.batchId) || context.reservations || [],
    };

    const evalCtx = {
      batch,
      order,
      countryRule,
      referenceDate,
      lastSequence,
      complianceContext,
    };

    const pipeline = this.getGatePipeline(referenceDate);

    for (const phaseKey of GATE_PHASE_ORDER) {
      for (const ruleDef of pipeline[phaseKey] || []) {
        const check = this._runRule(ruleDef, evalCtx, phaseKey);
        if (!check) continue;
        phases[phaseKey].checks.push(check);
        if (check.result === RESULT.FAILED) {
          phases[phaseKey].failures.push(check.message);
          phases[phaseKey].passed = false;
          break;
        }
      }
      if (!phases[phaseKey].passed) {
        return this._buildResult(phases);
      }
    }

    return this._buildResult(phases);
  }

  _runRule(ruleDef, evalCtx, phaseKey) {
    const integration = this.integrationService?.getConfig(ruleDef.ruleId);
    if (integration?.enabled) {
      const check = this.integrationService.evaluateSync(integration, evalCtx, ruleDef);
      if (check && !check.phase) check.phase = phaseKey;
      return check;
    }

    const evaluator = createRuleEvaluator(ruleDef.ruleId);
    if (!evaluator) {
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase: phaseKey,
        result: RESULT.SKIPPED,
        message: `${ruleDef.ruleName}: no built-in evaluator — configure integration JSON`,
      };
    }

    const check = evaluator(this, evalCtx);
    if (!check) return null;
    if (!check.phase) check.phase = phaseKey;
    return check;
  }

  _buildResult(phases) {
    const allChecks = [
      ...phases.COMPLIANCE.checks,
      ...phases.AVAILABILITY.checks,
      ...phases.MARKET_RULES.checks,
      ...phases.PRODUCTION.checks,
    ];
    const allFailures = [
      ...phases.COMPLIANCE.failures,
      ...phases.AVAILABILITY.failures,
      ...phases.MARKET_RULES.failures,
      ...phases.PRODUCTION.failures,
    ];
    return {
      passed: phases.COMPLIANCE.passed
        && phases.AVAILABILITY.passed
        && phases.MARKET_RULES.passed
        && phases.PRODUCTION.passed,
      checks: allChecks,
      failures: allFailures,
      phases,
      ruleSetVersion: this.getRuleSetVersion(),
    };
  }
}

module.exports = { RuleEngine };
