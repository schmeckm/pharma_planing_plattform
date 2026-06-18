export const GATE_PHASE_ORDER = ['COMPLIANCE', 'AVAILABILITY', 'MARKET_RULES', 'PRODUCTION'];
export const SELECTION_PHASE_ORDER = ['FIFO', 'OPTIMIZATION'];

export function isGateRuleType(ruleType) {
  return GATE_PHASE_ORDER.includes(ruleType);
}

export function sortRuleDefinitions(ruleDefinitions = []) {
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

export function isRuleEffective(rule, referenceDate = new Date()) {
  if (!rule || rule.active === false) return false;
  const ref = new Date(referenceDate);
  if (rule.effectiveFrom && ref < new Date(rule.effectiveFrom)) return false;
  if (rule.effectiveTo && ref > new Date(rule.effectiveTo)) return false;
  return true;
}

export function getApplicableGateRules(ruleDefinitions = [], referenceDate = new Date()) {
  return sortRuleDefinitions(
    ruleDefinitions.filter((r) => isRuleEffective(r, referenceDate) && isGateRuleType(r.ruleType)),
  );
}
