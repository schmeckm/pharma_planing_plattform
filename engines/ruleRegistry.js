const { EXECUTION_PHASE } = require('./executionPhases');
const { isRuleEffective } = require('../utils/ruleEffectiveDate');
const { checkConfirmedScheduleSlot } = require('./capacityGateEngine');

const GATE_PHASE_ORDER = [
  EXECUTION_PHASE.COMPLIANCE,
  EXECUTION_PHASE.AVAILABILITY,
  EXECUTION_PHASE.MARKET_RULES,
  EXECUTION_PHASE.PRODUCTION,
];

const SELECTION_PHASE_ORDER = [
  EXECUTION_PHASE.FIFO,
  EXECUTION_PHASE.OPTIMIZATION,
];

/**
 * Build ordered gate pipeline from admin ruleDefinitions (active + priority).
 */
function buildGatePipeline(ruleDefinitions = [], referenceDate = new Date()) {
  const pipeline = {};
  for (const phase of GATE_PHASE_ORDER) {
    pipeline[phase] = ruleDefinitions
      .filter((r) => r.ruleType === phase && isRuleEffective(r, referenceDate))
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  }
  return pipeline;
}

function sortRuleDefinitions(ruleDefinitions = []) {
  const phaseOrder = [...GATE_PHASE_ORDER, ...SELECTION_PHASE_ORDER];
  return [...ruleDefinitions].sort((a, b) => {
    const phaseA = phaseOrder.indexOf(a.ruleType);
    const phaseB = phaseOrder.indexOf(b.ruleType);
    const rankA = phaseA === -1 ? 99 : phaseA;
    const rankB = phaseB === -1 ? 99 : phaseB;
    if (rankA !== rankB) return rankA - rankB;
    return (a.priority ?? 99) - (b.priority ?? 99);
  });
}

function createRuleEvaluator(ruleId) {
  const evaluators = {
    'RULE-007': (engine, ctx) => engine.compliance.checkPackingMapping(
      ctx.order, engine._resolveRuleDef('RULE-007'), ctx.complianceContext,
    ),
    'RULE-008': (engine, ctx) => engine.compliance.checkQualityStock(
      ctx.batch, engine._resolveRuleDef('RULE-008') || engine._resolveRuleDef('RULE-001'),
    ),
    'RULE-009': (engine, ctx) => engine.compliance.checkInspectionLot(
      ctx.batch, engine._resolveRuleDef('RULE-009'), ctx.complianceContext,
    ),
    'RULE-001': (engine, ctx) => engine.compliance.checkQualityStatus(
      ctx.batch, engine._resolveRuleDef('RULE-001'),
    ),
    'RULE-002': (engine, ctx) => engine.compliance.checkTric(
      ctx.batch, ctx.order.destinationCountry, ctx.countryRule, engine._resolveRuleDef('RULE-002'),
    ),
    'RULE-003': (engine, ctx) => {
      const rmslRef = ctx.order.plannedStartDate ? new Date(ctx.order.plannedStartDate) : ctx.referenceDate;
      return engine.compliance.checkRmsl(
        ctx.batch, ctx.order.destinationCountry, ctx.countryRule, engine._resolveRuleDef('RULE-003'), rmslRef,
      );
    },
    'RULE-004': (engine, ctx) => engine.compliance.checkBatchSplit(
      ctx.batch, ctx.order, ctx.countryRule, engine._resolveRuleDef('RULE-004'),
    ),
    'RULE-010': (engine, ctx) => engine.compliance.checkAtp(
      ctx.batch, ctx.order, engine._resolveRuleDef('RULE-010'), ctx.complianceContext,
    ),
    'RULE-011': (engine, ctx) => engine.compliance.checkReservedInventory(
      ctx.batch, ctx.order, engine._resolveRuleDef('RULE-011'), ctx.complianceContext,
    ),
    'RULE-005': (engine, ctx) => {
      if (!ctx.countryRule?.requiresContinuousSequence) return null;
      const def = engine._resolveRuleDef('RULE-005');
      if (!def) return null;
      return engine.compliance.checkJapanSequence(ctx.batch, ctx.lastSequence, def);
    },
    'RULE-014': (engine, ctx) => {
      const def = engine._resolveRuleDef('RULE-014');
      if (!def) return null;
      return checkConfirmedScheduleSlot(ctx.order, def, ctx.complianceContext);
    },
  };

  return evaluators[ruleId] || null;
}

module.exports = {
  GATE_PHASE_ORDER,
  SELECTION_PHASE_ORDER,
  buildGatePipeline,
  sortRuleDefinitions,
  createRuleEvaluator,
};
