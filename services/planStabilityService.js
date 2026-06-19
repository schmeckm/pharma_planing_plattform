/**
 * Production Plan Stability (PPS) — Anker-Snapshots und Planänderungs-Events nach Freigabe.
 */

const { JsonRepository } = require('../utils/jsonRepository');
const { generateId } = require('../utils/idGenerator');

class PlanStabilityService {
  constructor(repository = new JsonRepository()) {
    this.repository = repository;
  }

  _loadSnapshots() {
    return this.repository.read('workPlanSnapshots') || { snapshots: [], activeSnapshotId: null };
  }

  _saveSnapshots(store) {
    this.repository.write('workPlanSnapshots', store);
  }

  _loadChanges() {
    return this.repository.read('planChangeEvents') || { events: [] };
  }

  _saveChanges(store) {
    this.repository.write('planChangeEvents', store);
  }

  getActiveSnapshot() {
    const store = this._loadSnapshots();
    if (!store.activeSnapshotId) return null;
    return (store.snapshots || []).find((s) => s.snapshotId === store.activeSnapshotId) || null;
  }

  /**
   * Setzt PPS-Anker bei Confirm/Activate — WorkPlanSnapshot mit stabilityAnchorAt.
   */
  createWorkPlanSnapshot({
    scheduleId = null,
    draftScheduleId = null,
    items = [],
    userId = 'SYSTEM',
    userName = null,
    label = null,
    eventType = 'PLAN_ACTIVATED',
  } = {}) {
    const anchorAt = new Date().toISOString();
    const snapshot = {
      snapshotId: generateId('WPS'),
      scheduleId,
      draftScheduleId,
      stabilityAnchorAt: anchorAt,
      createdAt: anchorAt,
      createdBy: userId,
      createdByName: userName || userId,
      label: label || 'Work plan snapshot',
      eventType,
      itemCount: items.length,
      items: items.map((item) => ({
        orderId: item.packagingOrder || item.packagingOrderId || item.orderId,
        line: item.productionLine,
        qty: item.quantity ?? item.orderQuantity,
        batch: item.batchId || item.recommendedBatch || null,
        plannedStart: item.plannedStartDate || item.plannedStartDateTime?.slice(0, 10),
        plannedEnd: item.plannedEndDate || item.plannedEndDateTime?.slice(0, 10),
        horizonType: item.horizonType || null,
        mrpController: item.mrpController || null,
      })),
    };

    const store = this._loadSnapshots();
    store.snapshots = [snapshot, ...(store.snapshots || [])].slice(0, 100);
    store.activeSnapshotId = snapshot.snapshotId;
    this._saveSnapshots(store);

    const schedule = this.repository.read('optimizedSchedule') || {};
    this.repository.write('optimizedSchedule', {
      ...schedule,
      stabilityAnchorAt: anchorAt,
      activeSnapshotId: snapshot.snapshotId,
    });

    return snapshot;
  }

  recordPlanChange({
    orderId,
    field,
    oldValue,
    newValue,
    userId = 'SYSTEM',
    userName = null,
    relevantForPPS = true,
    aiAssisted = false,
    source = 'MANUAL',
  }) {
    if (oldValue === newValue) return null;
    const active = this.getActiveSnapshot();
    const event = {
      changeEventId: generateId('PCE'),
      orderId,
      changedAt: new Date().toISOString(),
      field,
      oldValue,
      newValue,
      userId,
      userName: userName || userId,
      relevantForPPS,
      aiAssisted,
      source,
      snapshotId: active?.snapshotId || null,
    };
    const store = this._loadChanges();
    store.events = [event, ...(store.events || [])].slice(0, 2000);
    this._saveChanges(store);
    return event;
  }

  /** Vergleicht moved-Orders aus Impact-Vergleich mit aktivem Snapshot. */
  recordChangesFromComparison(comparison, { userId = 'SYSTEM', userName = null, aiAssisted = false } = {}) {
    const active = this.getActiveSnapshot();
    if (!active || !comparison?.moved?.length) return [];

    const anchorByOrder = Object.fromEntries(
      (active.items || []).map((i) => [i.orderId, i]),
    );
    const recorded = [];

    for (const move of comparison.moved) {
      const orderId = move.packagingOrder || move.packagingOrderId;
      const anchor = anchorByOrder[orderId];
      if (!anchor) continue;

      if (move.fromLine && move.toLine && move.fromLine !== move.toLine) {
        recorded.push(this.recordPlanChange({
          orderId,
          field: 'productionLine',
          oldValue: move.fromLine,
          newValue: move.toLine,
          userId,
          userName,
          aiAssisted,
          source: 'SEQUENCE_MOVE',
        }));
      }
      if (move.fromDate && move.toDate && move.fromDate !== move.toDate) {
        recorded.push(this.recordPlanChange({
          orderId,
          field: 'plannedStartDate',
          oldValue: move.fromDate,
          newValue: move.toDate,
          userId,
          userName,
          aiAssisted,
          source: 'SEQUENCE_MOVE',
        }));
      } else if (anchor.plannedStart && move.toDate && anchor.plannedStart !== move.toDate) {
        recorded.push(this.recordPlanChange({
          orderId,
          field: 'plannedStartDate',
          oldValue: anchor.plannedStart,
          newValue: move.toDate,
          userId,
          userName,
          aiAssisted,
          source: 'SEQUENCE_MOVE',
        }));
      }
    }

    return recorded.filter(Boolean);
  }

  getPpsMetrics({ sinceDays = 90, productionLine = null, mrpController = null } = {}) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - sinceDays);
    const active = this.getActiveSnapshot();
    const changes = (this._loadChanges().events || []).filter((e) => {
      if (new Date(e.changedAt) < cutoff) return false;
      if (!e.relevantForPPS) return false;
      if (productionLine && e.field === 'productionLine' && e.newValue !== productionLine && e.oldValue !== productionLine) {
        return false;
      }
      return true;
    });

    const anchorItems = active?.items || [];
    const changedOrderIds = new Set(changes.map((c) => c.orderId));
    let scopedItems = anchorItems;
    if (productionLine) {
      scopedItems = scopedItems.filter((i) => i.line === productionLine);
    }
    if (mrpController) {
      scopedItems = scopedItems.filter((i) => i.mrpController === mrpController);
    }

    const totalCount = scopedItems.length;
    const stableCount = scopedItems.filter((i) => !changedOrderIds.has(i.orderId)).length;
    const ppsPercent = totalCount ? Math.round((stableCount / totalCount) * 1000) / 10 : null;

    return {
      timestamp: new Date().toISOString(),
      sinceDays,
      activeSnapshotId: active?.snapshotId || null,
      stabilityAnchorAt: active?.stabilityAnchorAt || null,
      totalCount,
      stableCount,
      changedCount: totalCount - stableCount,
      ppsPercent,
      recentChanges: changes.slice(0, 20),
      filter: { productionLine, mrpController },
    };
  }
}

module.exports = { PlanStabilityService };
