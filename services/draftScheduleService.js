const { JsonRepository } = require('../utils/jsonRepository');
const { getProvider } = require('../providers');
const { generateId } = require('../utils/idGenerator');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { isShadowPlanningEnabled } = require('../utils/shadowPlanning');

const DRAFT_STATUS = {
  DRAFT: 'DRAFT',
  READY: 'READY',
  FAILED: 'FAILED',
  ACTIVATED: 'ACTIVATED',
  SUPERSEDED: 'SUPERSEDED',
};

class DraftScheduleService {
  constructor(provider = getProvider(), repository = new JsonRepository()) {
    this.provider = provider;
    this.repository = repository;
  }

  _loadStore() {
    return this.repository.read('draftSchedules') || { drafts: [] };
  }

  _saveStore(store) {
    this.repository.write('draftSchedules', store);
  }

  listDrafts({ status, limit = 20 } = {}) {
    const store = this._loadStore();
    let drafts = [...(store.drafts || [])];
    if (status) drafts = drafts.filter((d) => d.status === status);
    drafts.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return drafts.slice(0, limit);
  }

  getDraft(draftScheduleId) {
    const draft = this._loadStore().drafts?.find((d) => d.draftScheduleId === draftScheduleId);
    if (!draft) throw new NotFoundError('DraftSchedule', draftScheduleId);
    return draft;
  }

  getLatestDraft({ status } = {}) {
    const drafts = this.listDrafts({ status, limit: 1 });
    return drafts[0] || null;
  }

  _buildDraftRecord({ sim, label, userId, status }) {
    const now = new Date().toISOString();
    return {
      draftScheduleId: generateId('DRF'),
      scheduleId: generateId('SCH'),
      scheduleType: 'LINE_SEQUENCING',
      plantId: '1000',
      label,
      status,
      items: sim.result || [],
      score: sim.score || {},
      kpis: sim.kpis || {},
      comparison: sim.comparison || null,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      readyAt: status === DRAFT_STATUS.READY ? now : null,
      readyBy: status === DRAFT_STATUS.READY ? userId : null,
      activatedAt: null,
      activatedBy: null,
    };
  }

  _upsertDraft(draft) {
    const store = this._loadStore();
    const drafts = store.drafts || [];
    const idx = drafts.findIndex((d) => d.draftScheduleId === draft.draftScheduleId);
    if (idx === -1) {
      drafts.unshift(draft);
    } else {
      drafts[idx] = { ...drafts[idx], ...draft, updatedAt: draft.updatedAt };
    }
    this._saveStore({ drafts: drafts.slice(0, 50) });
    return draft;
  }

  _supersedeStaleSavedProductionSchedule() {
    if (!isShadowPlanningEnabled()) return;
    try {
      const current = this.repository.read('optimizedSchedule');
      if (!current || current.status === 'CONFIRMED') return;
      if (!['SAVED', 'DRAFT'].includes(current.status)) return;
      this.repository.write('optimizedSchedule', {
        ...current,
        status: 'SUPERSEDED',
        items: [],
        supersededAt: new Date().toISOString(),
        supersededReason: 'Shadow-Planning: produktiver Plan nur nach Plan aktivieren (activate-draft)',
      });
    } catch {
      /* kein Abbruch bei Schreibfehler */
    }
  }

  saveDraftFromSimulation({ sim, label = 'Draft plant sequence', userId = 'SYSTEM' }) {
    const draft = this._buildDraftRecord({
      sim,
      label,
      userId,
      status: DRAFT_STATUS.DRAFT,
    });
    this._upsertDraft(draft);
    this._supersedeStaleSavedProductionSchedule();
    return {
      saved: true,
      shadowPlanning: true,
      draftScheduleId: draft.draftScheduleId,
      scheduleId: draft.scheduleId,
      scheduleType: draft.scheduleType,
      status: draft.status,
      itemCount: draft.items.length,
      comparison: draft.comparison,
      kpis: draft.kpis,
    };
  }

  _buildDetailedDraftRecord({ schedule, label, userId, status }) {
    const now = new Date().toISOString();
    return {
      draftScheduleId: generateId('DRF'),
      scheduleId: schedule.scheduleId || generateId('DSCH'),
      scheduleType: 'DETAILED_SCHEDULING',
      plantId: '1000',
      label,
      status,
      items: schedule.scheduledOrders || [],
      blockedOrders: schedule.blockedOrders || [],
      ganttTasks: schedule.ganttTasks || [],
      exceptions: schedule.exceptions || [],
      utilization: schedule.utilization || [],
      score: schedule.solver?.score || {},
      kpis: schedule.kpis || {},
      comparison: null,
      startAnchor: schedule.startAnchor,
      timelineEnd: schedule.timelineEnd,
      granularity: schedule.granularity || 'hour',
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      readyAt: status === DRAFT_STATUS.READY ? now : null,
      readyBy: status === DRAFT_STATUS.READY ? userId : null,
      activatedAt: null,
      activatedBy: null,
    };
  }

  confirmDetailedSchedule({
    schedule,
    label = 'Confirmed detailed schedule',
    userId = 'SYSTEM',
    draftScheduleId = null,
  }) {
    if (!schedule?.scheduledOrders?.length) {
      throw new ValidationError('Detailed schedule enthält keine geplanten Aufträge');
    }
    const now = new Date().toISOString();
    let draft;

    if (draftScheduleId) {
      const existing = this.getDraft(draftScheduleId);
      draft = {
        ...existing,
        label,
        status: DRAFT_STATUS.READY,
        items: schedule.scheduledOrders,
        blockedOrders: schedule.blockedOrders || [],
        ganttTasks: schedule.ganttTasks || [],
        exceptions: schedule.exceptions || [],
        utilization: schedule.utilization || [],
        kpis: schedule.kpis || {},
        startAnchor: schedule.startAnchor,
        timelineEnd: schedule.timelineEnd,
        granularity: schedule.granularity || 'hour',
        updatedAt: now,
        updatedBy: userId,
        readyAt: now,
        readyBy: userId,
      };
    } else {
      draft = this._buildDetailedDraftRecord({
        schedule,
        label,
        userId,
        status: DRAFT_STATUS.READY,
      });
    }

    this._supersedeOtherReady(draft.draftScheduleId);
    this._upsertDraft(draft);

    return {
      confirmed: true,
      ready: true,
      shadowPlanning: true,
      scheduleType: 'DETAILED_SCHEDULING',
      draftScheduleId: draft.draftScheduleId,
      scheduleId: draft.scheduleId,
      status: draft.status,
      itemCount: draft.items.length,
      blockedCount: draft.blockedOrders?.length || 0,
      kpis: draft.kpis,
      message: 'Detailed schedule als Shadow-Entwurf in draftSchedules.json gespeichert.',
    };
  }

  markReadyFromSimulation({
    sim,
    label = 'Confirmed plant sequence',
    userId = 'SYSTEM',
    draftScheduleId = null,
  }) {
    const now = new Date().toISOString();
    let draft;

    if (draftScheduleId) {
      const existing = this.getDraft(draftScheduleId);
      draft = {
        ...existing,
        label,
        status: DRAFT_STATUS.READY,
        items: sim.result || [],
        score: sim.score || {},
        kpis: sim.kpis || {},
        comparison: sim.comparison || null,
        updatedAt: now,
        updatedBy: userId,
        readyAt: now,
        readyBy: userId,
      };
    } else {
      draft = this._buildDraftRecord({
        sim,
        label,
        userId,
        status: DRAFT_STATUS.READY,
      });
    }

    this._supersedeOtherReady(draft.draftScheduleId);
    this._upsertDraft(draft);
    this._supersedeStaleSavedProductionSchedule();

    return {
      confirmed: true,
      ready: true,
      shadowPlanning: true,
      draftScheduleId: draft.draftScheduleId,
      scheduleId: draft.scheduleId,
      status: draft.status,
      itemCount: draft.items.length,
      comparison: draft.comparison,
      kpis: draft.kpis,
      orders: draft.items,
      message: 'Entwurf freigegeben — Plan aktivieren übernimmt Daten in die Produktion.',
    };
  }

  _supersedeOtherReady(keepId) {
    const store = this._loadStore();
    const drafts = (store.drafts || []).map((d) => {
      if (d.draftScheduleId === keepId) return d;
      if (d.status === DRAFT_STATUS.READY) {
        return { ...d, status: DRAFT_STATUS.SUPERSEDED, updatedAt: new Date().toISOString() };
      }
      return d;
    });
    this._saveStore({ drafts });
  }

  _applyItemsToOrders(items) {
    for (const item of items) {
      const poId = item.packagingOrder || item.packagingOrderId;
      try {
        this.provider.updateOrder(poId, {
          plannedStartDate: item.plannedStartDate,
          plannedEndDate: item.plannedEndDate,
          productionLine: item.productionLine,
          status: 'PLANNED',
        });
      } catch {
        /* Grobplan-Aufträge existieren ggf. nicht in orders.json */
      }
    }
  }

  activateDraft({ draftScheduleId = null, userId = 'SYSTEM', userName = null, horizonDays = null } = {}) {
    const draft = draftScheduleId
      ? this.getDraft(draftScheduleId)
      : this.getLatestDraft({ status: DRAFT_STATUS.READY });

    if (!draft) {
      throw new ValidationError('Kein freigegebener Entwurf (READY) zum Aktivieren vorhanden');
    }
    if (draft.status !== DRAFT_STATUS.READY) {
      throw new ValidationError(
        `Entwurf ${draft.draftScheduleId} hat Status ${draft.status} — nur READY kann aktiviert werden`,
      );
    }
    if (!draft.items?.length) {
      throw new ValidationError('Entwurf enthält keine Planpositionen');
    }

    const now = new Date().toISOString();
    const schedule = {
      scheduleId: draft.scheduleId || generateId('SCH'),
      plantId: draft.plantId || '1000',
      label: draft.label || 'Activated plant sequence',
      status: 'CONFIRMED',
      confirmedAt: now,
      confirmedBy: userId,
      updatedAt: now,
      updatedBy: userId,
      activatedFromDraftId: draft.draftScheduleId,
      items: draft.items,
      score: draft.score || {},
      kpis: draft.kpis || {},
    };

    this.repository.write('optimizedSchedule', schedule);
    this._applyItemsToOrders(draft.items);

    const activated = {
      ...draft,
      status: DRAFT_STATUS.ACTIVATED,
      activatedAt: now,
      activatedBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };
    this._upsertDraft(activated);

    let impactEvent = null;
    try {
      const { PlanningImpactService } = require('./planningImpactService');
      impactEvent = new PlanningImpactService(this.repository).recordActivation({
        userId,
        userName,
        eventType: 'PLAN_ACTIVATED',
        draftScheduleId: draft.draftScheduleId,
        scheduleId: schedule.scheduleId,
        plantId: draft.plantId,
        label: draft.label,
        horizonDays,
        comparison: draft.comparison,
        items: draft.items,
      });
    } catch {
      /* impact logging must not block activation */
    }

    let workPlanSnapshot = null;
    try {
      const { PlanStabilityService } = require('./planStabilityService');
      workPlanSnapshot = new PlanStabilityService(this.repository).createWorkPlanSnapshot({
        scheduleId: schedule.scheduleId,
        draftScheduleId: draft.draftScheduleId,
        items: draft.items,
        userId,
        userName,
        label: draft.label,
        eventType: 'PLAN_ACTIVATED',
      });
    } catch {
      /* PPS-Anker darf Aktivierung nicht blockieren */
    }

    return {
      activated: true,
      shadowPlanning: true,
      draftScheduleId: draft.draftScheduleId,
      scheduleId: schedule.scheduleId,
      status: schedule.status,
      itemCount: schedule.items.length,
      comparison: draft.comparison,
      kpis: draft.kpis,
      impactEventId: impactEvent?.impactEventId || null,
      stabilityAnchorAt: workPlanSnapshot?.stabilityAnchorAt || null,
      snapshotId: workPlanSnapshot?.snapshotId || null,
      message: 'Plan in Produktion übernommen — Allokation (RULE-014) kann nun bestätigten Gantt-Slot prüfen.',
    };
  }
}

module.exports = { DraftScheduleService, DRAFT_STATUS };
