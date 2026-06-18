const PHASE_STEPS = [
  { key: 'COMPLIANCE', label: 'Compliance Gate', shortLabel: 'Compliance', hint: 'Quality, packing mapping, TRIC, shelf-life policy' },
  { key: 'AVAILABILITY', label: 'Availability Gate', shortLabel: 'ATP', hint: 'ATP and reservations — before batch assignment' },
  { key: 'MARKET_RULES', label: 'Market Rules', shortLabel: 'Market', hint: 'Country sequencing' },
  { key: 'PRODUCTION', label: 'Production Gate', shortLabel: 'Gantt', hint: 'Confirmed line slot from scheduling before batch assignment' },
  { key: 'FIFO', label: 'Batch Selection (FIFO)', shortLabel: 'Assign', hint: 'Assign batch only after all gates passed' },
  { key: 'OPTIMIZATION', label: 'Optimization', shortLabel: 'Optimize', hint: 'Final batch selection rationale' },
];

export { PHASE_STEPS };

export const RULE_EXECUTION_ORDER = [
  'RULE-007',
  'RULE-008',
  'RULE-009',
  'RULE-001',
  'RULE-002',
  'RULE-003',
  'RULE-004',
  'RULE-010',
  'RULE-011',
  'RULE-005',
  'RULE-014',
  'RULE-006',
  'RULE-012',
];

const PHASE_ORDER = ['COMPLIANCE', 'AVAILABILITY', 'MARKET_RULES', 'PRODUCTION', 'FIFO', 'OPTIMIZATION'];

function plannerSafe(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/TRIC Validation/gi, 'Market Release Check')
    .replace(/RMSL Validation/gi, 'Shelf-Life Risk Check');
}

export function sortRuleChecks(checks = [], ruleDefinitions = []) {
  const defMap = new Map((ruleDefinitions || []).map((r) => [r.ruleId, r]));
  return [...checks].sort((a, b) => {
    const phaseA = PHASE_ORDER.indexOf(a.phase || 'COMPLIANCE');
    const phaseB = PHASE_ORDER.indexOf(b.phase || 'COMPLIANCE');
    if (phaseA !== phaseB) return phaseA - phaseB;

    const priA = defMap.get(a.ruleId)?.priority ?? RULE_EXECUTION_ORDER.indexOf(a.ruleId);
    const priB = defMap.get(b.ruleId)?.priority ?? RULE_EXECUTION_ORDER.indexOf(b.ruleId);
    const rankA = priA === -1 ? 999 : priA;
    const rankB = priB === -1 ? 999 : priB;
    return rankA - rankB;
  });
}

export function formatFailureTooltip(source) {
  if (!source) return '';
  const status = source.status || source.simulationStatus;
  if (status !== 'FAILED') return '';

  const reasons = (source.failureReasons || []).filter(Boolean).map(plannerSafe);
  const failedCheck = sortRuleChecks(source.ruleChecks || []).find((c) => c.result === 'FAILED');
  const lines = [];

  if (failedCheck?.message) {
    const label = failedCheck.ruleName ? `${plannerSafe(failedCheck.ruleName)}: ` : '';
    lines.push(`${label}${plannerSafe(failedCheck.message)}`);
  }

  for (const reason of reasons) {
    if (!lines.includes(reason) && !lines.some((l) => l.includes(reason))) {
      lines.push(reason);
    }
  }

  if (!lines.length) {
    return 'Simulation failed — open Weiter for full details';
  }

  return lines.join('\n');
}

export function auditEntryToSimulationResult(entry) {
  if (!entry) return null;
  return {
    packagingOrderId: entry.packagingOrderId,
    status: entry.status,
    recommendedBatchId: entry.batchId,
    allocatedQuantity: entry.allocatedQuantity,
    ruleChecks: entry.ruleChecks || [],
    executionPhases: entry.executionPhases,
    executionStrategy: entry.executionStrategy,
    ruleSetVersion: entry.ruleSetVersion,
    failureReasons: entry.failureReasons || [],
    alternativeBatches: entry.alternativeBatches || [],
    risk: entry.riskLevel
      ? { level: entry.riskLevel, score: entry.riskScore }
      : entry.risk || null,
  };
}

const GATE_PHASES = ['COMPLIANCE', 'AVAILABILITY', 'MARKET_RULES', 'PRODUCTION', 'FIFO'];

export function allGatesPassed(result) {
  if (!result || result.status === 'FAILED') return false;
  if (!result.recommendedBatchId) return false;
  if (!['SIMULATED', 'SUCCESS'].includes(result.status)) return false;

  const phases = result.executionPhases;
  if (phases && typeof phases === 'object') {
    for (const key of ['COMPLIANCE', 'AVAILABILITY', 'MARKET_RULES', 'PRODUCTION']) {
      if (phases[key]?.passed === false) return false;
    }
  }

  const checks = result.ruleChecks || [];
  return !checks.some(
    (c) => c.result === 'FAILED' && GATE_PHASES.includes(c.phase || 'COMPLIANCE'),
  );
}

export function visibleRuleChecks(checks = [], ruleDefinitions = []) {
  const sorted = sortRuleChecks(checks, ruleDefinitions);
  const visible = [];
  for (const check of sorted) {
    visible.push(check);
    if (check.result === 'FAILED') break;
  }
  return visible;
}

function collectExecutedSteps(result) {
  const phases = result?.executionPhases;
  const checks = sortRuleChecks(result?.ruleChecks || []);
  const steps = [];

  if (phases && typeof phases === 'object') {
    for (const step of PHASE_STEPS) {
      if (step.key === 'FIFO' || step.key === 'OPTIMIZATION') continue;
      const phase = phases[step.key];
      if (!phase) continue;
      steps.push({
        ...step,
        status: phase.passed === false ? 'failed' : 'success',
        checks: phase.checks || [],
        failures: phase.failures || [],
      });
    }
  } else if (checks.length) {
    for (const step of PHASE_STEPS) {
      if (step.key === 'FIFO' || step.key === 'OPTIMIZATION') continue;
      const stepChecks = checks.filter((c) => {
        const phase = c.phase || 'COMPLIANCE';
        if (step.key === 'COMPLIANCE') return phase === 'COMPLIANCE';
        return phase === step.key;
      });
      if (!stepChecks.length) continue;
      const failed = stepChecks.some((c) => c.result === 'FAILED');
      steps.push({
        ...step,
        status: failed ? 'failed' : 'success',
        checks: stepChecks,
        failures: stepChecks.filter((c) => c.result === 'FAILED').map((c) => c.message),
      });
    }
  }

  for (const step of PHASE_STEPS) {
    if (step.key !== 'FIFO' && step.key !== 'OPTIMIZATION') continue;
    const stepChecks = checks.filter((c) => c.phase === step.key);
    if (!stepChecks.length) continue;
    const failed = stepChecks.some((c) => c.result === 'FAILED');
    steps.push({
      ...step,
      status: failed ? 'failed' : 'success',
      checks: stepChecks,
      failures: stepChecks.filter((c) => c.result === 'FAILED').map((c) => c.message),
    });
  }

  return steps;
}

function decorateTimelineStep(step, index) {
  return {
    ...step,
    stepNumber: index + 1,
    isGate: ['COMPLIANCE', 'AVAILABILITY', 'MARKET_RULES', 'PRODUCTION'].includes(step.key),
    isAssignmentStep: step.key === 'FIFO',
    showAssignmentMarker: step.key === 'FIFO',
  };
}

export function buildAlgorithmSteps(result) {
  if (!result) return [];

  const executed = collectExecutedSteps(result);
  const executedByKey = Object.fromEntries(executed.map((step) => [step.key, step]));
  const hasExecution = executed.length > 0;

  let flowBlocked = false;

  return PHASE_STEPS.map((stepDef, index) => {
    if (flowBlocked) {
      return decorateTimelineStep({
        ...stepDef,
        status: 'blocked',
        checks: [],
        failures: [],
      }, index);
    }

    const ran = executedByKey[stepDef.key];
    if (ran) {
      if (ran.status === 'failed') flowBlocked = true;
      return decorateTimelineStep({ ...stepDef, ...ran }, index);
    }

    if (!hasExecution) return null;

    if (stepDef.key === 'MARKET_RULES' || stepDef.key === 'OPTIMIZATION') {
      return decorateTimelineStep({
        ...stepDef,
        status: 'success',
        checks: [],
        failures: [],
        emptyNote: stepDef.key === 'MARKET_RULES'
          ? 'No additional market rules for this country'
          : 'No separate optimization step recorded',
      }, index);
    }

    return null;
  }).filter(Boolean);
}
