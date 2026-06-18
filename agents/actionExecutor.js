const { generateId } = require('../utils/idGenerator');

class ActionExecutor {
  constructor({ lineOptimizationService, allocationService, dailyPlanningService, provider }) {
    this.lineOpt = lineOptimizationService;
    this.allocation = allocationService;
    this.dailyPlanning = dailyPlanningService;
    this.provider = provider;
  }

  execute(action, context, userId = 'AUTOPILOT') {
    switch (action) {
      case 'AUTO_SEQUENCE':
        return this._executeSequence(context, userId);
      case 'AUTO_CONFIRM_SEQUENCE':
        return this._executeConfirmSequence(context, userId);
      case 'AUTO_ALLOCATE':
        return this._executeAllocationDraft(context, userId);
      case 'AUTO_HARD_ALLOCATE':
        return this._executeHardAllocate(context, userId);
      default:
        return { executed: false, reason: `Unknown action: ${action}` };
    }
  }

  _executeSequence({ sequence, label }, userId) {
    const seq = (sequence || []).map((o) => ({
      packagingOrder: o.packagingOrder || o.packagingOrderId,
      productionLine: o.productionLine,
      plannedStartDate: o.plannedStartDate,
      plannedEndDate: o.plannedEndDate,
      recommendedBatchId: o.recommendedBatchId,
    }));

    const saved = this.lineOpt.saveSequence({
      sequence: seq,
      label: label || 'Autopilot — draft production sequence',
      userId,
    });

    return {
      executed: true,
      action: 'AUTO_SEQUENCE',
      scheduleId: saved.scheduleId,
      itemCount: saved.itemCount,
      kpis: saved.kpis,
      mode: 'DRAFT_SAVED',
      advisorNote: 'Sequence saved as draft — planner confirms before hard allocation.',
    };
  }

  _executeConfirmSequence({ sequence, label }, userId) {
    if (!this.dailyPlanning) {
      return { executed: false, action: 'AUTO_CONFIRM_SEQUENCE', reason: 'Planning service unavailable' };
    }
    const seq = (sequence || []).map((o) => ({
      packagingOrder: o.packagingOrder || o.packagingOrderId,
      productionLine: o.productionLine,
      plannedStartDate: o.plannedStartDate,
      plannedEndDate: o.plannedEndDate,
    }));
    const confirmed = this.dailyPlanning.confirmSequence({
      sequence: seq,
      label: label || 'Autopilot — confirmed sequence (LOW risk tier)',
      userId,
    });
    return {
      executed: true,
      action: 'AUTO_CONFIRM_SEQUENCE',
      scheduleId: confirmed.scheduleId,
      draftScheduleId: confirmed.draftScheduleId,
      itemCount: confirmed.itemCount,
      mode: confirmed.shadowPlanning ? 'READY' : 'CONFIRMED',
      advisorNote: confirmed.shadowPlanning
        ? 'Entwurf freigegeben (READY) — Schichtleiter muss Plan aktivieren vor RULE-014/Allocate.'
        : 'Sequence confirmed — still requires hard allocation per order.',
    };
  }

  _executeAllocationDraft({ packagingOrderId, simResult }, userId) {
    if (!simResult?.recommendedBatchId) {
      return { executed: false, action: 'AUTO_ALLOCATE', packagingOrderId, reason: 'No compliant batch' };
    }

    const updated = this.provider.updateOrder(packagingOrderId, {
      allocatedBatchId: simResult.recommendedBatchId,
      allocatedQuantity: simResult.allocatedQuantity || simResult.quantity,
      allocationStatus: 'AUTO_DRAFT',
      allocationDraftAt: new Date().toISOString(),
      allocationDraftBy: userId,
    });

    return {
      executed: true,
      action: 'AUTO_ALLOCATE',
      packagingOrderId,
      batchId: simResult.recommendedBatchId,
      quantity: simResult.allocatedQuantity,
      order: updated,
      mode: 'DRAFT_ASSIGNMENT',
      advisorNote: 'Draft batch assignment — planner confirms hard allocation.',
    };
  }

  _executeHardAllocate({ packagingOrderId, simResult, allowHardAllocation }, userId) {
    if (!allowHardAllocation) {
      return {
        executed: false,
        action: 'AUTO_HARD_ALLOCATE',
        packagingOrderId,
        reason: 'Hard allocation disabled in policy — human approval required',
      };
    }
    try {
      const result = this.allocation.execute({
        packagingOrderId,
        batchId: simResult.recommendedBatchId,
        userId,
        source: 'AUTOPILOT',
      });
      return {
        executed: true,
        action: 'AUTO_HARD_ALLOCATE',
        packagingOrderId,
        batchId: simResult.recommendedBatchId,
        mode: 'HARD_ALLOCATED',
        result,
        advisorNote: 'Hard allocation executed (LOW risk + policy enabled).',
      };
    } catch (err) {
      return {
        executed: false,
        action: 'AUTO_HARD_ALLOCATE',
        packagingOrderId,
        reason: err.message,
      };
    }
  }
}

module.exports = { ActionExecutor };
