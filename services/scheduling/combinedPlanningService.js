const { CombinedPlanningEngine } = require('../../engines/combinedPlanningEngine');
const { ConstraintPipeline } = require('./constraintPipeline');
const { enrichOrdersForSolver } = require('./schedulingPayloadEnricher');
const { getProvider } = require('../../providers');
const { getDefaultHorizonDays, resolvePerformanceHorizonMode } = require('../../utils/planningHorizon');
/**
 * Kombinierte Vor-/Rückwärtsplanung + Stammdaten/ATP-Vorprüfung für die Linienplanung.
 */
class CombinedPlanningService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.constraints = new ConstraintPipeline(provider);
    this.engine = new CombinedPlanningEngine();
  }

  _lines(horizonDays = null) {
    try {
      const { PerformanceService } = require('../performanceService');
      const days = horizonDays ?? getDefaultHorizonDays();
      return new PerformanceService(this.provider).getLinesForHorizon(resolvePerformanceHorizonMode(days));
    } catch {
      return [];
    }
  }
  _performanceRecords() {
    try {
      const { PerformanceService } = require('../performanceService');
      return new PerformanceService(this.provider).getPerformanceRecords();
    } catch {
      return [];
    }
  }

  /**
   * Vollständiger Lauf: Constraints → Dauer anreichern → Vor-/Rückwärtsfenster
   */
  calculate({ orders = [], startAnchor = null, packagingOrderIds = [], horizonDays = null } = {}) {
    const rulesData = this.provider.getRules();
    const batches = this.provider.getBatches();
    let targetOrders = orders;

    if (!targetOrders.length) {
      const rough = this.provider.getOrders?.() || [];
      targetOrders = rough.filter((o) => ['OPEN', 'PLANNED'].includes(o.status));
    }

    if (packagingOrderIds.length) {
      const idSet = new Set(packagingOrderIds);
      targetOrders = targetOrders.filter((o) => idSet.has(o.packagingOrderId || o.packagingOrder));
    }

    const normalized = targetOrders.map((o) => ({
      ...o,
      packagingOrderId: o.packagingOrderId || o.packagingOrder,
    }));

    const constraintResult = this.constraints.evaluate(normalized);
    const planningHorizon = horizonDays ?? getDefaultHorizonDays();
    const lines = this._lines(planningHorizon);
    const enriched = enrichOrdersForSolver({
      orders: normalized,
      lines,
      performanceRecords: this._performanceRecords(),
    });

    const durationByOrderId = Object.fromEntries(
      enriched.map((o) => [o.packagingOrderId, o.durationHours]),
    );

    const anchor = startAnchor
      || enriched[0]?.plannedStartDate
      || new Date().toISOString().slice(0, 10);

    const result = this.engine.calculateBatch(normalized, {
      anchorDate: anchor,
      constraintItems: constraintResult.items,
      batches,
      durationByOrderId,
    });

    return {
      ...result,
      constraintSummary: constraintResult.summary,
      planningHorizon: {
        horizonDays: planningHorizon,
        performanceMode: resolvePerformanceHorizonMode(planningHorizon),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Planungsfenster auf Aufträge für den Solver mergen.
   */
  applyWindowsToOrders(orders = [], combinedItems = []) {
    const byId = Object.fromEntries(combinedItems.map((i) => [i.packagingOrderId, i]));
    return orders.map((order) => {
      const id = order.packagingOrderId || order.packagingOrder;
      const plan = byId[id];
      if (!plan) return order;
      return {
        ...order,
        combinedPlanning: {
          backward: plan.backward,
          forward: plan.forward,
          feasibleWindow: plan.feasibleWindow,
          late: plan.late,
          slackDaysToDelivery: plan.slackDaysToDelivery,
          masterData: plan.masterData,
        },
        plannedStartDate: plan.plannedStartDate || order.plannedStartDate,
        plannedEndDate: plan.plannedEndDate || order.plannedEndDate,
        planningStatus: plan.feasibleWindow && plan.masterData.eligible ? 'COMBINED_OK' : 'AT_RISK',
        late: plan.late,
      };
    });
  }
}

module.exports = { CombinedPlanningService };
