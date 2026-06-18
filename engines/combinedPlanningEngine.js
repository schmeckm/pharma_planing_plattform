const { addDays, daysBetween, todayISO } = require('../utils/dateUtils');

const DEFAULT_DELIVERY_BUFFER_DAYS = parseInt(process.env.PLANNING_DELIVERY_BUFFER_DAYS || '2', 10);
const DEFAULT_QA_BUFFER_DAYS = parseInt(process.env.PLANNING_QA_BUFFER_DAYS || '0', 10);
const HOURS_PER_PLANNING_DAY = parseFloat(process.env.PLANNING_HOURS_PER_DAY || '8');

/**
 * Kombinierte Vor- und Rückwärtsplanung auf Verpackungsauftragsebene.
 *
 * Rückwärts: Liefertermin → spätestes Verpackungsende/-beginn
 * Vorwärts: Freigabe / Charge ready_at / Horizont → frühestes Verpackungsbeginn/-ende
 * Kombination: Schnittmenge der Fenster → empfohlener Start/Ende
 */
class CombinedPlanningEngine {
  constructor({
    deliveryBufferDays = DEFAULT_DELIVERY_BUFFER_DAYS,
    qaBufferDays = DEFAULT_QA_BUFFER_DAYS,
    hoursPerDay = HOURS_PER_PLANNING_DAY,
  } = {}) {
    this.deliveryBufferDays = deliveryBufferDays;
    this.qaBufferDays = qaBufferDays;
    this.hoursPerDay = hoursPerDay;
  }

  _durationDays(durationHours) {
    const h = Number(durationHours);
    if (!Number.isFinite(h) || h <= 0) return 1;
    return Math.max(1, Math.ceil(h / this.hoursPerDay));
  }

  _maxDate(...dates) {
    const valid = dates.filter(Boolean).sort();
    return valid[valid.length - 1] || null;
  }

  /**
   * @param {object} order
   * @param {object} options
   * @param {number} options.durationHours
   * @param {string} options.anchorDate — Planungshorizont / heute
   * @param {object|null} options.batch — empfohlene Charge (productionDate ≈ ready_at)
   * @param {object|null} options.constraintItem — Ergebnis ConstraintPipeline
   */
  calculateOrder(order, {
    durationHours,
    anchorDate = todayISO(),
    batch = null,
    constraintItem = null,
  } = {}) {
    const orderId = order.packagingOrderId || order.packagingOrder;
    const durationDays = this._durationDays(durationHours ?? order.durationHours);
    const deliveryDate = order.requestedDeliveryDate?.slice(0, 10) || null;
    const releaseDate = order.releaseDate?.slice(0, 10) || null;
    const batchReady = batch?.productionDate?.slice(0, 10) || null;

    const backward = this._backwardWindow(deliveryDate, durationDays);
    const forward = this._forwardWindow({
      releaseDate,
      batchReady,
      anchorDate,
      durationDays,
      qaBufferDays: this.qaBufferDays,
    });
    const combined = this._mergeWindows(forward, backward, durationDays);
    const masterData = this._masterDataStatus(constraintItem);

    const issues = [];
    if (!deliveryDate) {
      issues.push({ code: 'NO_DELIVERY_DATE', severity: 'MEDIUM', message: 'No delivery date — forward planning only' });
    }
    if (!masterData.eligible) {
      issues.push({
        code: 'CONSTRAINT_BLOCKED',
        severity: 'HIGH',
        message: 'Master data/ATP/RMSL/TRIC not executable (constraint pipeline)',
      });
    }
    if (combined.late) {
      issues.push({
        code: 'LATE_VS_DELIVERY',
        severity: 'HIGH',
        message: `Earliest end ${combined.plannedEndDate} after latest window ${backward.latestPackagingEnd || '—'}`,
      });
    }
    if (!combined.feasibleWindow) {
      issues.push({
        code: 'NO_FEASIBLE_WINDOW',
        severity: 'HIGH',
        message: 'Forward and backward windows do not overlap',
      });
    }

    return {
      packagingOrderId: orderId,
      planningMethod: deliveryDate ? 'COMBINED_FORWARD_BACKWARD' : 'FORWARD_ONLY',
      durationHours: durationHours ?? order.durationHours,
      durationDays,
      requestedDeliveryDate: deliveryDate,
      backward,
      forward,
      plannedStartDate: combined.plannedStartDate,
      plannedEndDate: combined.plannedEndDate,
      feasibleWindow: combined.feasibleWindow,
      late: combined.late,
      slackDaysToDelivery: combined.slackDaysToDelivery,
      masterData,
      recommendedBatchId: constraintItem?.recommendedBatchId || batch?.batchId || null,
      issues,
    };
  }

  _backwardWindow(deliveryDate, durationDays) {
    if (!deliveryDate) {
      return {
        latestPackagingEnd: null,
        latestPackagingStart: null,
        deliveryBufferDays: this.deliveryBufferDays,
      };
    }

    const latestPackagingEnd = addDays(deliveryDate, -this.deliveryBufferDays);
    const latestPackagingStart = addDays(latestPackagingEnd, -(durationDays - 1));

    return {
      latestPackagingEnd,
      latestPackagingStart,
      deliveryBufferDays: this.deliveryBufferDays,
      targetDeliveryDate: deliveryDate,
    };
  }

  _forwardWindow({ releaseDate, batchReady, anchorDate, durationDays, qaBufferDays }) {
    const materialReady = this._maxDate(releaseDate, batchReady);
    const earliestMaterialGate = materialReady ? addDays(materialReady, qaBufferDays) : null;
    const earliestPackagingStart = this._maxDate(anchorDate, todayISO(), earliestMaterialGate);
    const earliestPackagingEnd = earliestPackagingStart
      ? addDays(earliestPackagingStart, durationDays - 1)
      : null;

    return {
      earliestPackagingStart,
      earliestPackagingEnd,
      releaseDate,
      batchReadyAt: batchReady,
      qaBufferDays,
      anchorDate,
    };
  }

  _mergeWindows(forward, backward, durationDays) {
    let plannedStartDate = forward.earliestPackagingStart;
    let plannedEndDate = forward.earliestPackagingEnd;

    if (backward.latestPackagingEnd && plannedEndDate && plannedEndDate > backward.latestPackagingEnd) {
      plannedEndDate = backward.latestPackagingEnd;
      plannedStartDate = addDays(plannedEndDate, -(durationDays - 1));
    }

    let feasibleWindow = true;
    let late = false;

    if (backward.latestPackagingEnd && forward.earliestPackagingEnd) {
      if (forward.earliestPackagingEnd > backward.latestPackagingEnd) {
        feasibleWindow = false;
        late = true;
      }
    }

    if (backward.latestPackagingStart && plannedStartDate && plannedStartDate > backward.latestPackagingStart) {
      feasibleWindow = false;
    }

    const slackDaysToDelivery = backward.targetDeliveryDate && plannedEndDate
      ? daysBetween(plannedEndDate, backward.targetDeliveryDate)
      : null;

    return {
      plannedStartDate,
      plannedEndDate,
      feasibleWindow,
      late,
      slackDaysToDelivery,
    };
  }

  _masterDataStatus(constraintItem) {
    if (!constraintItem) {
      return { eligible: true, hardConstraints: null, qaBlocked: false };
    }
    return {
      eligible: constraintItem.eligible !== false,
      hardConstraints: constraintItem.hardConstraints || null,
      qaBlocked: !!constraintItem.qaBlocked,
      recommendedBatchId: constraintItem.recommendedBatchId || null,
    };
  }

  /**
   * @param {object[]} orders
   * @param {object} context
   */
  calculateBatch(orders = [], {
    anchorDate = todayISO(),
    constraintItems = [],
    batches = [],
    durationByOrderId = {},
  } = {}) {
    const constraintMap = Object.fromEntries(
      constraintItems.map((c) => [c.packagingOrderId, c]),
    );
    const batchMap = Object.fromEntries(batches.map((b) => [b.batchId, b]));

    const items = orders.map((order) => {
      const id = order.packagingOrderId || order.packagingOrder;
      const constraintItem = constraintMap[id];
      const batchId = constraintItem?.recommendedBatchId
        || order.allocatedBatchId
        || order.recommendedBatchId;
      const batch = batchId ? batchMap[batchId] : null;
      const durationHours = durationByOrderId[id] ?? order.durationHours;

      return this.calculateOrder(order, {
        durationHours,
        anchorDate,
        batch,
        constraintItem,
      });
    });

    const feasible = items.filter((i) => i.feasibleWindow && i.masterData.eligible && !i.late);
    const late = items.filter((i) => i.late);
    const blocked = items.filter((i) => !i.masterData.eligible);

    return {
      anchorDate,
      planningMethod: 'COMBINED_FORWARD_BACKWARD',
      items,
      summary: {
        total: items.length,
        feasible: feasible.length,
        late: late.length,
        blocked: blocked.length,
        forwardOnly: items.filter((i) => i.planningMethod === 'FORWARD_ONLY').length,
      },
    };
  }
}

module.exports = { CombinedPlanningEngine };
