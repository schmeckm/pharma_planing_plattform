const { RESULT } = require('./complianceEngine');

const BLOCKED_PLANNING_STATUSES = ['BLOCKED', 'FAILED', 'UNPLACED'];
const BLOCKED_ALLOCATION_STATUSES = ['UNPLACED', 'BLOCKED'];

function resolveSlot(order, context = {}) {
  const orderId = order.packagingOrderId || order.packagingOrder;
  const fromContext = context.getScheduleSlot?.(orderId);
  if (fromContext) return fromContext;

  if (order.productionLine && order.plannedStartDate && order.plannedEndDate) {
    return {
      packagingOrderId: orderId,
      productionLine: order.productionLine,
      plannedStartDate: order.plannedStartDate,
      plannedEndDate: order.plannedEndDate,
      expectedOee: order.expectedOee,
      planningStatus: order.planningStatus || 'OPTIMIZED',
      allocationStatus: order.allocationStatus,
    };
  }

  return null;
}

function checkConfirmedScheduleSlot(order, ruleDef, context = {}) {
  const params = ruleDef.parameters || {};
  const requireConfirmed = params.requireConfirmedSchedule !== false;
  const minOee = params.minExpectedOee;
  const allowedPlanningStatuses = params.allowedPlanningStatuses || ['OPTIMIZED', 'CONFIRMED', 'VALID'];
  const scheduleMeta = context.scheduleMeta;

  if (!scheduleMeta) {
    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'PRODUCTION',
      result: RESULT.FAILED,
      message: 'No production schedule loaded — run line planning and confirm the Gantt before allocating',
    };
  }

  if (requireConfirmed && scheduleMeta.status !== 'CONFIRMED') {
    const shadow = context.shadowPlanning;
    const draft = context.draftHint;
    let message = `Production schedule ${scheduleMeta.scheduleId || 'unknown'} is ${scheduleMeta.status || 'DRAFT'} — confirm Gantt before allocating`;

    if (shadow && scheduleMeta.status === 'SAVED') {
      message = 'Plan ist nur gespeichert (SAVED), nicht produktiv bestätigt — in Production Sequencing: Confirm Sequence, dann Plan aktivieren';
    } else if (shadow && scheduleMeta.status === 'SUPERSEDED') {
      message = 'Produktivplan durch Shadow-Planning ersetzt — in Production Sequencing Plan aktivieren, danach erneut simulieren';
    } else if (shadow && draft?.status === 'READY') {
      message = `Entwurf ${draft.draftScheduleId} ist freigegeben (READY) — bitte Plan aktivieren in Production Sequencing, danach erneut simulieren`;
    } else if (shadow && draft?.status === 'DRAFT') {
      message = `Nur Entwurf (DRAFT) vorhanden — Confirm Sequence und Plan aktivieren in Production Sequencing`;
    }

    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'PRODUCTION',
      result: RESULT.FAILED,
      message,
      evidence: {
        scheduleId: scheduleMeta.scheduleId,
        status: scheduleMeta.status,
        shadowPlanning: shadow || false,
        draftScheduleId: draft?.draftScheduleId,
        draftStatus: draft?.status,
      },
    };
  }

  const slot = resolveSlot(order, context);
  const orderId = order.packagingOrderId || order.packagingOrder;

  if (!slot) {
    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'PRODUCTION',
      result: RESULT.FAILED,
      message: `Order ${orderId} has no confirmed Gantt slot — run scheduling for this packaging order first`,
    };
  }

  if (!slot.productionLine || !slot.plannedStartDate || !slot.plannedEndDate) {
    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'PRODUCTION',
      result: RESULT.FAILED,
      message: `Gantt slot for ${orderId} is incomplete (line, planned start, or end missing)`,
      evidence: {
        productionLine: slot.productionLine,
        plannedStartDate: slot.plannedStartDate,
        plannedEndDate: slot.plannedEndDate,
      },
    };
  }

  const planningStatus = slot.planningStatus || 'OPTIMIZED';
  if (BLOCKED_PLANNING_STATUSES.includes(planningStatus)) {
    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'PRODUCTION',
      result: RESULT.FAILED,
      message: `Gantt slot for ${orderId} is ${planningStatus} on ${slot.productionLine}`,
      evidence: { planningStatus, productionLine: slot.productionLine },
    };
  }

  if (slot.allocationStatus && BLOCKED_ALLOCATION_STATUSES.includes(slot.allocationStatus)) {
    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'PRODUCTION',
      result: RESULT.FAILED,
      message: `Schedule marks ${orderId} as ${slot.allocationStatus} — resolve planning issues before allocating`,
      evidence: { allocationStatus: slot.allocationStatus },
    };
  }

  if (!allowedPlanningStatuses.includes(planningStatus)) {
    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase: 'PRODUCTION',
      result: RESULT.FAILED,
      message: `Planning status ${planningStatus} is not allowed for allocation (allowed: ${allowedPlanningStatuses.join(', ')})`,
    };
  }

  if (minOee != null && Number.isFinite(Number(minOee))) {
    const oee = Number(slot.expectedOee);
    if (!Number.isFinite(oee) || oee < Number(minOee)) {
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase: 'PRODUCTION',
        result: RESULT.FAILED,
        message: `Expected OEE ${slot.expectedOee ?? 'n/a'}% on ${slot.productionLine} is below minimum ${minOee}%`,
        evidence: { expectedOee: slot.expectedOee, minExpectedOee: minOee },
      };
    }
  }

  return {
    ruleId: ruleDef.ruleId,
    ruleName: ruleDef.ruleName,
    phase: 'PRODUCTION',
    result: RESULT.PASSED,
    message: `Confirmed Gantt slot on ${slot.productionLine}: ${slot.plannedStartDate} → ${slot.plannedEndDate}`,
    evidence: {
      scheduleId: scheduleMeta.scheduleId,
      productionLine: slot.productionLine,
      plannedStartDate: slot.plannedStartDate,
      plannedEndDate: slot.plannedEndDate,
      expectedOee: slot.expectedOee,
      planningStatus,
    },
  };
}

module.exports = { checkConfirmedScheduleSlot, RESULT };
