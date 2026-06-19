const { JsonRepository } = require('../utils/jsonRepository');
const { daysBetween, addDays } = require('../utils/dateUtils');
const { generateId } = require('../utils/idGenerator');

/** Specificity rank — lower number = higher priority in resolution. */
const SCOPE_RANK = {
  MATERIAL: 1,
  MATERIAL_GROUP: 2,
  PRODUCT_FAMILY: 3,
  PACKAGING_LINE: 4,
  WORK_CENTER: 5,
  PLANT: 6,
  PLANNING_AREA: 7,
};

const HORIZON_TYPE_RULES = {
  FROZEN: { reschedulingAllowed: false, optimizationAllowed: false, isAutoSchedulable: false },
  FIXED: { reschedulingAllowed: true, optimizationAllowed: false, isAutoSchedulable: true },
  FLEXIBLE: { reschedulingAllowed: true, optimizationAllowed: true, isAutoSchedulable: true },
  FORECAST: { reschedulingAllowed: false, optimizationAllowed: false, isAutoSchedulable: false },
};

const OUT_OF_HORIZON = {
  horizonId: null,
  horizonName: 'Out of horizon',
  horizonType: 'OUT_OF_HORIZON',
  reschedulingAllowed: false,
  optimizationAllowed: false,
  isAutoSchedulable: false,
  isEditable: false,
  horizonViolation: false,
};

class PlanningHorizonEngine {
  constructor(repository = new JsonRepository()) {
    this.repo = repository;
  }

  loadRules() {
    const items = this.repo.readArray('planningHorizons', 'items');
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((r) => {
      if (r.validFrom && today < r.validFrom.slice(0, 10)) return false;
      if (r.validTo && today > r.validTo.slice(0, 10)) return false;
      return true;
    });
  }

  /**
   * Build scheduling context from order-like object.
   */
  buildContext(order, materialMeta = null) {
    const material = order.materialNumber || order.material || order.finishedGoodMaterial;
    const meta = materialMeta || {};
    return {
      materialNumber: material,
      materialGroup: order.materialGroup || meta.campaignGroup || meta.materialGroup || null,
      productFamily: order.productFamily || meta.packageType || meta.productFamily || null,
      packagingLine: order.packagingLine || order.productionLine || order.assignedLine || null,
      workCenterId: order.workCenterId || order.bottleneckWorkCenter || null,
      plant: order.plant || order.plantId || '1000',
      planningArea: order.planningArea || 'PACKAGING',
    };
  }

  _ruleMatchesScope(rule, ctx) {
    const val = rule.scopeValue;
    if (!val || val === '*') return true;
    switch (rule.scopeType) {
      case 'MATERIAL':
        return ctx.materialNumber === val;
      case 'MATERIAL_GROUP':
        return ctx.materialGroup === val;
      case 'PRODUCT_FAMILY':
        return ctx.productFamily === val;
      case 'PACKAGING_LINE':
        return ctx.packagingLine === val;
      case 'WORK_CENTER':
        return ctx.workCenterId === val;
      case 'PLANT':
        return ctx.plant === val;
      case 'PLANNING_AREA':
        return ctx.planningArea === val;
      default:
        return false;
    }
  }

  _ruleMatchesMeta(rule, ctx) {
    if (rule.plant && rule.plant !== '*' && rule.plant !== ctx.plant) return false;
    if (rule.planningArea && rule.planningArea !== '*' && rule.planningArea !== ctx.planningArea) return false;
    return this._ruleMatchesScope(rule, ctx);
  }

  /**
   * Resolve applicable horizon band for an order on a given planning date.
   */
  resolveHorizon(orderContext, { anchorDate, targetDate, rules = null } = {}) {
    const anchor = anchorDate || new Date().toISOString().slice(0, 10);
    const target = targetDate || orderContext.plannedStartDate || anchor;
    const offsetDays = daysBetween(anchor, target.slice(0, 10));
    const allRules = rules || this.loadRules();

    const matching = allRules.filter((r) => this._ruleMatchesMeta(r, orderContext));
    if (!matching.length) {
      return { ...OUT_OF_HORIZON, offsetDays, applicablePlanningHorizon: null };
    }

    let bestRank = Infinity;
    for (const r of matching) {
      const rank = SCOPE_RANK[r.scopeType] ?? 99;
      if (rank < bestRank) bestRank = rank;
    }

    const atLevel = matching.filter((r) => (SCOPE_RANK[r.scopeType] ?? 99) === bestRank);
    const band = atLevel
      .filter((r) => offsetDays >= r.startOffsetDays && offsetDays <= r.endOffsetDays)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];

    if (!band) {
      return {
        ...OUT_OF_HORIZON,
        offsetDays,
        applicablePlanningHorizon: null,
        horizonViolation: false,
      };
    }

    const typeDefaults = HORIZON_TYPE_RULES[band.horizonType] || HORIZON_TYPE_RULES.FLEXIBLE;
    return {
      applicablePlanningHorizon: band.horizonId,
      horizonName: band.horizonName,
      horizonType: band.horizonType,
      horizonId: band.horizonId,
      offsetDays,
      startOffsetDays: band.startOffsetDays,
      endOffsetDays: band.endOffsetDays,
      scopeType: band.scopeType,
      scopeValue: band.scopeValue,
      reschedulingAllowed: band.allowRescheduling ?? typeDefaults.reschedulingAllowed,
      optimizationAllowed: band.isAutoSchedulable ?? typeDefaults.optimizationAllowed,
      isAutoSchedulable: band.isAutoSchedulable ?? typeDefaults.isAutoSchedulable,
      isEditable: band.isEditable ?? true,
      horizonViolation: false,
      priority: band.priority,
    };
  }

  /**
   * Check whether an automatic scheduling action is permitted.
   */
  canAutoMove(orderContext, { anchorDate, targetDate, isManualOverride = false } = {}) {
    const horizon = this.resolveHorizon(orderContext, { anchorDate, targetDate });
    if (horizon.horizonType === 'OUT_OF_HORIZON') {
      return { allowed: false, reason: 'OUT_OF_HORIZON', horizon };
    }
    if (isManualOverride && horizon.isEditable !== false) {
      return { allowed: true, reason: 'MANUAL_OVERRIDE', horizon };
    }
    if (horizon.horizonType === 'FROZEN') {
      return { allowed: false, reason: 'FROZEN_HORIZON', horizon };
    }
    if (horizon.horizonType === 'FIXED' && !horizon.reschedulingAllowed) {
      return { allowed: false, reason: 'FIXED_HORIZON_NO_RESCHEDULE', horizon };
    }
    if (horizon.horizonType === 'FORECAST') {
      return { allowed: false, reason: 'FORECAST_ONLY', horizon };
    }
    return { allowed: true, reason: 'OK', horizon };
  }

  canOptimize(orderContext, { anchorDate, targetDate } = {}) {
    const horizon = this.resolveHorizon(orderContext, { anchorDate, targetDate });
    if (horizon.horizonType === 'OUT_OF_HORIZON') {
      return { allowed: false, horizon };
    }
    return { allowed: !!horizon.optimizationAllowed, horizon };
  }

  buildHorizonViolationException(order, horizon, { anchorDate, attemptedAction = 'move' } = {}) {
    const material = order.materialNumber || order.material || order.finishedGoodMaterial || order.orderNumber;
    const orderRef = order.orderNumber || order.orderId || order.packagingOrder || order.packagingOrderId;
    return {
      exceptionId: generateId('EXC-PH'),
      type: 'PLANNING_HORIZON_VIOLATION',
      typeLabel: 'Planning Horizon Violation',
      orderNumber: orderRef,
      packagingOrderId: orderRef,
      materialNumber: material,
      horizonId: horizon.applicablePlanningHorizon,
      horizonType: horizon.horizonType,
      severity: horizon.horizonType === 'FROZEN' ? 'HIGH' : 'MEDIUM',
      status: 'OPEN',
      message: `Order ${orderRef} is inside the ${(horizon.horizonType || 'frozen').toLowerCase()} horizon `
        + `for material ${material} and cannot be automatically ${attemptedAction === 'optimize' ? 'optimized' : 'moved'}.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      anchorDate,
      offsetDays: horizon.offsetDays,
    };
  }

  annotateOrder(order, materialMeta, { anchorDate, targetDate } = {}) {
    const ctx = this.buildContext(order, materialMeta);
    const horizon = this.resolveHorizon(ctx, { anchorDate, targetDate: targetDate || order.plannedStartDate });
    return {
      ...order,
      applicablePlanningHorizon: horizon.applicablePlanningHorizon,
      horizonType: horizon.horizonType,
      horizonViolation: false,
      reschedulingAllowed: horizon.reschedulingAllowed,
      optimizationAllowed: horizon.optimizationAllowed,
      planningHorizonMeta: horizon,
    };
  }

  annotateScheduleItems(orders, { anchorDate, materialByNumber = {} } = {}) {
    return orders.map((order) => {
      const meta = materialByNumber[order.materialNumber || order.material || order.finishedGoodMaterial];
      return this.annotateOrder(order, meta, {
        anchorDate,
        targetDate: order.plannedStartDate || order.scheduledStartDate,
      });
    });
  }
}

module.exports = {
  PlanningHorizonEngine,
  SCOPE_RANK,
  HORIZON_TYPE_RULES,
  OUT_OF_HORIZON,
};
