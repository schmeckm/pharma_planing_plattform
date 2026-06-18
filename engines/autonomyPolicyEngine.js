const DEFAULT_POLICY = {
  enabled: true,
  autonomyMode: 'TIERED',
  minConfidence: 0.9,
  allowedActions: ['AUTO_SEQUENCE', 'AUTO_ALLOCATE', 'AUTO_CONFIRM_SEQUENCE', 'AUTO_HARD_ALLOCATE'],
  maxOrdersPerRun: 200,
  blockIssueCodes: ['CAPACITY', 'JAPAN_SEQUENCE', 'FIFO_DEVIATION', 'NO_BATCH'],
  blockRiskLevels: ['HIGH', 'CRITICAL'],
  blockCountries: [],
  allowHardAllocation: false,
  dryRunDefault: false,
  /** Per risk tier — human-in-the-loop for HIGH always */
  tiers: {
    LOW: {
      autoSequence: true,
      autoConfirmSequence: true,
      autoAllocateDraft: true,
      autoHardAllocate: false,
      minConfidence: 0.88,
    },
    MEDIUM: {
      autoSequence: true,
      autoConfirmSequence: false,
      autoAllocateDraft: true,
      autoHardAllocate: false,
      minConfidence: 0.92,
    },
    HIGH: {
      autoSequence: false,
      autoConfirmSequence: false,
      autoAllocateDraft: false,
      autoHardAllocate: false,
      minConfidence: 1,
    },
  },
  autoHardAllocateMinConfidence: 0.96,
};

const RISK_TO_TIER = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'HIGH' };

class AutonomyPolicyEngine {
  constructor(policy = {}) {
    this.policy = {
      ...DEFAULT_POLICY,
      ...policy,
      tiers: { ...DEFAULT_POLICY.tiers, ...(policy.tiers || {}) },
    };
  }

  getPolicy() {
    return { ...this.policy, tiers: { ...this.policy.tiers } };
  }

  riskTier(riskLevel) {
    return RISK_TO_TIER[riskLevel] || 'HIGH';
  }

  resolveTierActions(tier, confidence) {
    const cfg = this.policy.tiers[tier] || this.policy.tiers.HIGH;
    const ok = confidence >= cfg.minConfidence;
    return {
      tier,
      minConfidence: cfg.minConfidence,
      autoSequence: ok && cfg.autoSequence,
      autoConfirmSequence: ok && cfg.autoConfirmSequence,
      autoAllocateDraft: ok && cfg.autoAllocateDraft,
      autoHardAllocate: ok && cfg.autoHardAllocate && this.policy.allowHardAllocation
        && confidence >= this.policy.autoHardAllocateMinConfidence,
    };
  }

  evaluateSequence(sequence = []) {
    const blockers = [];
    for (const order of sequence) {
      const poId = order.packagingOrder || order.packagingOrderId;
      if (order.planningStatus === 'FAILED') {
        blockers.push({ packagingOrderId: poId, reason: 'Sequence placement failed' });
        continue;
      }
      for (const issue of order.issues || []) {
        if (this.policy.blockIssueCodes.includes(issue.code)) {
          blockers.push({ packagingOrderId: poId, reason: issue.message, code: issue.code });
        }
      }
      if (order.destinationCountry === 'JP' && (order.issues || []).length > 0) {
        blockers.push({ packagingOrderId: poId, reason: 'Sequence check requires planner review', code: 'JAPAN_SEQUENCE' });
      }
    }

    const confidence = blockers.length === 0
      ? 0.95
      : blockers.length <= 2
        ? 0.82
        : 0.65;

    const tier = blockers.length === 0 ? 'LOW' : blockers.length <= 2 ? 'MEDIUM' : 'HIGH';
    const tierActions = this.resolveTierActions(tier, confidence);

    return {
      action: 'AUTO_SEQUENCE',
      tier,
      allowed: this.policy.allowedActions.includes('AUTO_SEQUENCE') && tierActions.autoSequence,
      autoExecute: tierActions.autoSequence && blockers.length === 0,
      autoConfirm: tierActions.autoConfirmSequence && blockers.length === 0,
      confidence,
      blockers,
      tierActions,
      humanRequired: tier === 'HIGH' || blockers.length > 0,
    };
  }

  evaluateAllocation(simResult, order = {}) {
    const poId = order.packagingOrderId || simResult.packagingOrderId;
    const blockers = [];

    if (this.policy.blockCountries.includes(order.destinationCountry)) {
      blockers.push({ reason: `Country ${order.destinationCountry} requires manual approval` });
    }

    const status = simResult.status;
    if (status === 'FAILED' || !simResult.recommendedBatchId) {
      blockers.push({ reason: simResult.failureReasons?.[0] || 'Allocation simulation failed' });
    }

    const failedRules = (simResult.ruleChecks || []).filter((c) => c.result === 'FAILED');
    for (const rule of failedRules) {
      blockers.push({ reason: rule.message, ruleName: rule.ruleName });
    }

    const riskLevel = simResult.risk?.level || 'HIGH';
    if (riskLevel && this.policy.blockRiskLevels.includes(riskLevel)) {
      blockers.push({ reason: `Risk level ${riskLevel}`, code: 'RISK' });
    }

    let confidence = 0.5;
    if (blockers.length === 0 && simResult.recommendedBatchId) {
      confidence = riskLevel === 'LOW' ? 0.96 : riskLevel === 'MEDIUM' ? 0.88 : 0.75;
    }

    const tier = this.riskTier(riskLevel);
    const tierActions = this.resolveTierActions(tier, confidence);

    return {
      action: 'AUTO_ALLOCATE',
      packagingOrderId: poId,
      riskLevel,
      tier,
      allowed: this.policy.allowedActions.includes('AUTO_ALLOCATE') && tierActions.autoAllocateDraft && blockers.length === 0,
      autoExecute: blockers.length === 0 && tierActions.autoAllocateDraft,
      autoHardAllocate: blockers.length === 0 && tierActions.autoHardAllocate,
      confidence,
      blockers,
      recommendedBatchId: simResult.recommendedBatchId,
      tierActions,
      humanRequired: tier === 'HIGH' || blockers.length > 0,
    };
  }
}

module.exports = { AutonomyPolicyEngine, DEFAULT_POLICY };
