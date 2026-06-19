const { JsonRepository } = require('../utils/jsonRepository');
const { generateId } = require('../utils/idGenerator');
const { MaterialPlanningOwnershipService } = require('./materialPlanningOwnershipService');

const DIMENSION_KEYS = {
  mrpController: 'mrpController',
  detailedScheduler: 'detailedScheduler',
  productionLine: 'productionLine',
  productPortfolio: 'productPortfolio',
  planningArea: 'planningArea',
};

function emptyBucket(key, label) {
  return {
    key,
    label: label || key,
    orderCount: 0,
    ordersMoved: 0,
    lateOrders: 0,
    rmslViolations: 0,
    riskScore: 0,
    activationCount: 0,
    lateOrdersAvoided: 0,
    rmslViolationsReduced: 0,
    riskScoreImprovement: 0,
    oeeDelta: 0,
  };
}

class PlanningImpactService {
  constructor(repository = new JsonRepository()) {
    this.repository = repository;
    this.ownership = new MaterialPlanningOwnershipService(repository);
  }

  _loadEvents() {
    return this.repository.read('planningImpactEvents') || { events: [] };
  }

  _saveEvents(store) {
    this.repository.write('planningImpactEvents', store);
  }

  _extractAggregates(comparison = {}) {
    const lateB = comparison.lateOrders?.before ?? 0;
    const lateA = comparison.lateOrders?.after ?? 0;
    const rmslB = comparison.rmslViolations?.before ?? 0;
    const rmslA = comparison.rmslViolations?.after ?? 0;
    const riskB = comparison.riskDelta?.before ?? 0;
    const riskA = comparison.riskDelta?.after ?? 0;
    return {
      lateOrdersBefore: lateB,
      lateOrdersAfter: lateA,
      lateOrdersAvoided: Math.max(0, lateB - lateA),
      rmslViolationsBefore: rmslB,
      rmslViolationsAfter: rmslA,
      rmslViolationsReduced: Math.max(0, rmslB - rmslA),
      riskScoreBefore: riskB,
      riskScoreAfter: riskA,
      riskScoreImprovement: Math.max(0, riskB - riskA),
      ordersMoved: comparison.ordersMoved ?? 0,
      oeeBefore: comparison.oeeImpact?.before ?? null,
      oeeAfter: comparison.oeeImpact?.after ?? null,
      oeeDelta: comparison.oeeImpact?.delta ?? null,
      deliveryRiskBefore: comparison.deliveryRisk?.before ?? null,
      deliveryRiskAfter: comparison.deliveryRisk?.after ?? null,
      complianceIssuesBefore: comparison.complianceImpact?.before ?? null,
      complianceIssuesAfter: comparison.complianceImpact?.after ?? null,
    };
  }

  _labelForDimension(dimensionKey, key, sampleOrder) {
    const own = this.ownership.resolveForOrder(sampleOrder);
    if (dimensionKey === DIMENSION_KEYS.mrpController) {
      return own?.mrpControllerName || `MRP ${key}`;
    }
    if (dimensionKey === DIMENSION_KEYS.detailedScheduler) {
      return own?.detailedSchedulerName || `Scheduler ${key}`;
    }
    if (dimensionKey === DIMENSION_KEYS.productPortfolio) return key;
    if (dimensionKey === DIMENSION_KEYS.planningArea) return key;
    if (dimensionKey === DIMENSION_KEYS.productionLine) return key;
    return key;
  }

  _buildDimensions(items = [], comparison = {}) {
    const movedIds = new Set((comparison.moved || []).map((m) => m.packagingOrder));
    const dims = {
      mrpController: {},
      detailedScheduler: {},
      productionLine: {},
      productPortfolio: {},
      planningArea: {},
    };

    for (const item of items) {
      const own = this.ownership.resolveForOrder(item) || {};
      const id = item.packagingOrder || item.packagingOrderId;
      const pairs = [
        ['mrpController', own.mrpController || 'UNASSIGNED'],
        ['detailedScheduler', own.detailedScheduler || 'UNASSIGNED'],
        ['productionLine', item.productionLine || 'UNASSIGNED'],
        ['productPortfolio', own.productPortfolio || 'UNASSIGNED'],
        ['planningArea', own.planningArea || 'UNASSIGNED'],
      ];

      for (const [dim, key] of pairs) {
        if (!dims[dim][key]) {
          dims[dim][key] = emptyBucket(key, this._labelForDimension(dim, key, item));
        }
        const bucket = dims[dim][key];
        bucket.orderCount += 1;
        if (movedIds.has(id)) bucket.ordersMoved += 1;
        if (item.late) bucket.lateOrders += 1;
        if (item.rmslViolation) bucket.rmslViolations += 1;
        bucket.riskScore += item.riskScore || 0;
      }
    }

    return dims;
  }

  /**
   * Persist planning impact when a sequence is activated or directly confirmed.
   */
  recordActivation({
    userId = 'SYSTEM',
    userName = null,
    eventType = 'PLAN_ACTIVATED',
    draftScheduleId = null,
    scheduleId = null,
    plantId = '1000',
    label = null,
    horizonDays = null,
    comparison = null,
    items = [],
  } = {}) {
    if (!comparison) return null;

    const aggregates = this._extractAggregates(comparison);
    const dimensions = this._buildDimensions(items, comparison);
    const event = {
      impactEventId: generateId('IMP'),
      eventType,
      timestamp: new Date().toISOString(),
      userId,
      userName: userName || userId,
      draftScheduleId,
      scheduleId,
      plantId,
      label,
      horizonDays,
      itemCount: items.length,
      aggregates,
      dimensions,
      comparisonSummary: comparison.summary || null,
      ordersMoved: comparison.ordersMoved ?? 0,
    };

    const store = this._loadEvents();
    store.events = [event, ...(store.events || [])].slice(0, 500);
    this._saveEvents(store);
    return event;
  }

  /**
   * Manueller Planungsbeitrag aus dem Tages-Wizard (Schritt Impact).
   */
  recordContribution({
    userId = 'SYSTEM',
    userName = null,
    note = '',
    comparison = null,
    items = [],
    aiAssisted = false,
    horizonDays = null,
  } = {}) {
    const aggregates = comparison ? this._extractAggregates(comparison) : {
      lateOrdersAvoided: 0,
      rmslViolationsReduced: 0,
      riskScoreImprovement: 0,
      ordersMoved: 0,
    };
    const dimensions = comparison ? this._buildDimensions(items, comparison) : {};
    const event = {
      impactEventId: generateId('IMP'),
      eventType: 'PLANNING_CONTRIBUTION',
      timestamp: new Date().toISOString(),
      userId,
      userName: userName || userId,
      note: note || null,
      aiAssisted,
      horizonDays,
      itemCount: items.length,
      aggregates,
      dimensions,
      comparisonSummary: comparison?.summary || note || 'Manuell dokumentierter Planungsbeitrag',
      ordersMoved: comparison?.ordersMoved ?? 0,
    };

    const store = this._loadEvents();
    store.events = [event, ...(store.events || [])].slice(0, 500);
    this._saveEvents(store);
    return event;
  }
    userId,
    scope,
    horizonDays,
    sinceDays = 90,
    mrpController = null,
    productionLine = null,
    productPortfolio = null,
  } = {}) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - sinceDays);
    let filtered = (events || []).filter((e) => new Date(e.timestamp) >= cutoff);

    if (horizonDays) {
      filtered = filtered.filter((e) => !e.horizonDays || e.horizonDays <= horizonDays);
    }

    if (scope === 'mine' && userId) {
      const roles = this.ownership.userPlanningRoles(userId);
      filtered = filtered.filter((e) => {
        if (e.userId === userId) return true;
        return this._eventTouchesUser(e, userId, roles);
      });
    }

    if (mrpController) {
      filtered = filtered.filter((e) => (e.dimensions?.mrpController?.[mrpController]?.orderCount || 0) > 0);
    }
    if (productionLine) {
      filtered = filtered.filter((e) => (e.dimensions?.productionLine?.[productionLine]?.orderCount || 0) > 0);
    }
    if (productPortfolio) {
      filtered = filtered.filter((e) => (e.dimensions?.productPortfolio?.[productPortfolio]?.orderCount || 0) > 0);
    }

    return filtered;
  }

  _eventTouchesUser(event, userId, roles) {
    const sched = event.dimensions?.detailedScheduler || {};
    const mrp = event.dimensions?.mrpController || {};
    for (const key of roles.schedulerIds) {
      if (sched[key]?.orderCount > 0) return true;
    }
    for (const key of roles.mrpControllerIds) {
      if (mrp[key]?.orderCount > 0) return true;
    }
    return false;
  }

  _mergeBuckets(target, source, activationWeight = 1) {
    for (const [key, bucket] of Object.entries(source || {})) {
      if (!target[key]) target[key] = emptyBucket(key, bucket.label || key);
      const t = target[key];
      t.label = bucket.label || t.label;
      t.orderCount += bucket.orderCount || 0;
      t.ordersMoved += bucket.ordersMoved || 0;
      t.lateOrders += bucket.lateOrders || 0;
      t.rmslViolations += bucket.rmslViolations || 0;
      t.riskScore += bucket.riskScore || 0;
      t.activationCount += activationWeight;
    }
  }

  _rollupSummary(events) {
    const summary = emptyBucket('TOTAL', 'Total');
    summary.activationCount = events.length;
    for (const event of events) {
      const a = event.aggregates || {};
      summary.orderCount += event.itemCount || 0;
      summary.ordersMoved += a.ordersMoved || 0;
      summary.lateOrdersAvoided += a.lateOrdersAvoided || 0;
      summary.rmslViolationsReduced += a.rmslViolationsReduced || 0;
      summary.riskScoreImprovement += a.riskScoreImprovement || 0;
      if (a.oeeDelta != null) summary.oeeDelta += a.oeeDelta;
    }
    if (events.length && summary.oeeDelta) {
      summary.oeeDelta = Math.round((summary.oeeDelta / events.length) * 10) / 10;
    }
    return summary;
  }

  getPlanningImpact({
    groupBy = 'productPortfolio',
    scope = 'all',
    userId = null,
    horizonDays = null,
    sinceDays = 90,
    limit = 20,
    mrpController = null,
    productionLine = null,
    productPortfolio = null,
  } = {}) {
    const dimKey = DIMENSION_KEYS[groupBy] || groupBy;
    const allEvents = this._loadEvents().events || [];
    const events = this._filterEvents(allEvents, {
      userId,
      scope,
      horizonDays,
      sinceDays,
      mrpController,
      productionLine,
      productPortfolio,
    });
    const groups = {};

    for (const event of events) {
      const slice = event.dimensions?.[dimKey] || {};
      for (const [key, bucket] of Object.entries(slice)) {
        if (!groups[key]) groups[key] = emptyBucket(key, bucket.label || key);
        const g = groups[key];
        g.label = bucket.label || g.label;
        g.orderCount += bucket.orderCount || 0;
        g.ordersMoved += bucket.ordersMoved || 0;
        g.lateOrders += bucket.lateOrders || 0;
        g.rmslViolations += bucket.rmslViolations || 0;
        g.riskScore += bucket.riskScore || 0;
        g.activationCount += 1;

        const agg = event.aggregates || {};
        const share = event.itemCount > 0 ? (bucket.orderCount || 0) / event.itemCount : 0;
        g.lateOrdersAvoided += Math.round((agg.lateOrdersAvoided || 0) * share);
        g.rmslViolationsReduced += Math.round((agg.rmslViolationsReduced || 0) * share);
        g.riskScoreImprovement += Math.round((agg.riskScoreImprovement || 0) * share);
        if (agg.oeeDelta != null) g.oeeDelta += agg.oeeDelta * share;
      }
    }

    const rows = Object.values(groups)
      .sort((a, b) => (b.riskScoreImprovement + b.lateOrdersAvoided) - (a.riskScoreImprovement + a.lateOrdersAvoided))
      .slice(0, limit);

    return {
      timestamp: new Date().toISOString(),
      scope,
      groupBy: dimKey,
      horizonDays,
      sinceDays,
      eventCount: events.length,
      summary: this._rollupSummary(events),
      groups: rows,
      recentEvents: events.slice(0, 10).map((e) => ({
        impactEventId: e.impactEventId,
        timestamp: e.timestamp,
        userId: e.userId,
        userName: e.userName,
        eventType: e.eventType,
        itemCount: e.itemCount,
        aggregates: e.aggregates,
        comparisonSummary: e.comparisonSummary,
      })),
      ownershipCatalog: this.ownership.list(),
      filterOptions: {
        mrpControllers: [...new Set(this.ownership.list().map((r) => r.mrpController).filter(Boolean))],
        productionLines: [...new Set(this.ownership.list().map((r) => r.primaryLine).filter(Boolean))],
        productPortfolios: [...new Set(this.ownership.list().map((r) => r.productPortfolio).filter(Boolean))],
      },
    };
  }
}

module.exports = { PlanningImpactService, DIMENSION_KEYS };
