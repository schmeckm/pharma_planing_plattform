const { BaseAgent } = require('./baseAgent');

class PlanningAgent extends BaseAgent {
  constructor(tools) {
    super('planning-agent', tools);
  }

  /**
   * Morning briefing — reads orders, inventory, calendars, performance.
   * Planner remains final approver; output is advisory only.
   */
  buildDailySummary(context) {
    const {
      orders = [],
      batches = [],
      exceptions = [],
      twinProjection,
      predictions,
      inspectionLots = [],
      linePerformance = [],
      schedulingEvidence,
      t = (key, params) => key,
    } = context;

    const openOrders = orders.filter((o) => o.status === 'OPEN' || o.status === 'PLANNED').length;
    const outcomes = twinProjection?.projections?.allocationOutcomes || [];
    const allocatable = outcomes.filter((o) => o.projectedStatus !== 'FAILED').length;
    const atRisk = outcomes.filter((o) => o.projectedStatus === 'FAILED' || (o.riskScore || 0) >= 30).length;
    const inventoryRisks = (predictions?.horizons?.[0]?.expiringInventory || []).length
      + batches.filter((b) => (b.remainingShelfLifeMonths || 99) < 6).length;
    const japanSequenceRisks = exceptions.filter(
      (e) => e.type?.includes('JAPAN') || e.typeLabel?.includes('Sequence'),
    ).length + outcomes.filter((o) => o.destinationCountry === 'JP' && o.projectedStatus === 'FAILED').length;

    const pendingLots = inspectionLots.filter((l) => l.status === 'IN_PROGRESS' || l.status === 'PENDING').length;

    const cs = schedulingEvidence?.constraintSummary || {};
    const scheduling = schedulingEvidence ? {
      engine: schedulingEvidence.engine,
      solverStatus: schedulingEvidence.solverStatus,
      fromCache: schedulingEvidence.fromCache,
      eligible: cs.eligible ?? null,
      blocked: cs.blocked ?? null,
      qaBlocked: cs.qaBlocked ?? null,
      atpFailed: cs.atpFailed ?? null,
      tricFailed: cs.tricFailed ?? null,
      rmslFailed: cs.rmslFailed ?? null,
      peakUtilization: schedulingEvidence.kpis?.peakUtilization ?? null,
      sequenceCount: (schedulingEvidence.sequenceSample || []).length,
      topPriority: schedulingEvidence.topPriority || [],
    } : null;

    const dataSourcesRead = [
      t('dataSources.packagingOrders'),
      t('dataSources.inventory'),
      t('dataSources.qualityStock'),
      t('dataSources.inspectionLots', { count: inspectionLots.length }),
      t('dataSources.lineCalendars'),
      t('dataSources.linePerformance', { count: linePerformance.length }),
      t('dataSources.digitalTwin'),
    ];
    if (schedulingEvidence) {
      dataSourcesRead.push(t('dataSources.scheduling', {
        engine: schedulingEvidence.engine || '—',
        status: schedulingEvidence.solverStatus || '—',
      }));
    }

    return {
      agentId: this.name,
      label: t('dailySummaryLabel'),
      advisorNote: t('advisorNote.planning'),
      summary: {
        openOrders,
        allocatableOrders: allocatable || Math.max(0, openOrders - atRisk),
        ordersAtRisk: atRisk,
        inventoryRisks,
        japanSequenceRisks,
        pendingInspectionLots: pendingLots,
        recommendedActions: 0,
        scheduling,
      },
      schedulingEvidence,
      dataSourcesRead,
      topLineScores: linePerformance
        .slice()
        .sort((a, b) => (b.lineScore || 0) - (a.lineScore || 0))
        .slice(0, 3)
        .map((r) => ({
          materialNumber: r.materialNumber,
          lineId: r.lineId,
          lineScore: r.lineScore,
          reason: r.reason || t('lineScoreReason'),
        })),
    };
  }

  async run(context) {
    const { twinProjection, exceptions, schedulingEvidence, t = (key, params) => key } = context;
    const recommendations = [];
    const dailySummary = this.buildDailySummary(context);

    const failures = twinProjection?.projections?.allocationOutcomes?.filter(
      (o) => o.projectedStatus === 'FAILED',
    ) || [];

    for (const fail of failures) {
      recommendations.push(
        this.createRecommendation({
          type: 'RESCHEDULE_OR_ALT_BATCH',
          targetId: fail.packagingOrderId,
          packagingOrderId: fail.packagingOrderId,
          action: t('planning.reviewOrder', {
            orderId: fail.packagingOrderId,
            country: fail.destinationCountry,
          }),
          rationale: t('planning.twinFailure', {
            horizon: context.horizonDays || 7,
            rmsl: fail.rmsl || 'N/A',
          }),
          impact: t('planning.impactDelivery', { country: fail.destinationCountry }),
          confidence: 0.85,
          evidence: [`twin:projection:${fail.packagingOrderId}`, 'RULE-RMSL'],
          approverRole: 'PLANNER',
        }),
      );
    }

    const blockedByConstraints = schedulingEvidence?.blockedSample || [];
    for (const blocked of blockedByConstraints.slice(0, 3)) {
      recommendations.push(
        this.createRecommendation({
          type: 'CONSTRAINT_BLOCKED',
          targetId: blocked.packagingOrderId,
          packagingOrderId: blocked.packagingOrderId,
          action: t('planning.constraintBlocked', { orderId: blocked.packagingOrderId }),
          rationale: t('planning.constraintBlockedRationale', {
            reasons: (blocked.blockReasons || ['COMPLIANCE']).join(', '),
          }),
          impact: t('planning.constraintBlockedImpact'),
          confidence: 0.88,
          evidence: [`scheduling:constraint:${blocked.packagingOrderId}`, `solver:${schedulingEvidence?.solverStatus}`],
          approverRole: 'PLANNER',
        }),
      );
    }

    const openExceptions = (exceptions || []).filter((e) => e.status === 'OPEN');
    for (const ex of openExceptions.slice(0, 3)) {
      if (ex.type === 'RMSL_VIOLATION' || ex.type?.includes('RMSL')) {
        recommendations.push(
          this.createRecommendation({
            type: 'ESCALATE_RMSL',
            targetId: ex.packagingOrderId,
            packagingOrderId: ex.packagingOrderId,
            action: t('planning.whatIfDelay'),
            rationale: ex.message,
            impact: t('planning.impactRmsl'),
            confidence: 0.82,
            evidence: [ex.exceptionId],
            approverRole: 'PLANNER',
          }),
        );
      }
    }

    dailySummary.summary.recommendedActions = recommendations.length;

    return {
      agentId: this.name,
      dailySummary,
      recommendations,
      count: recommendations.length,
    };
  }
}

module.exports = { PlanningAgent };
