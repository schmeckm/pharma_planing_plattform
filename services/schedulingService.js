const { getProvider } = require('../providers');
const { JsonRepository } = require('../utils/jsonRepository');
const { ConstraintPipeline } = require('./scheduling/constraintPipeline');
const { PriorityScorer } = require('./scheduling/priorityScorer');
const { HeuristicOptimizer } = require('./scheduling/heuristicOptimizer');
const { OrtoolsOptimizer } = require('./scheduling/ortoolsOptimizer');
const { LineOptimizationService } = require('./lineOptimizationService');

const DEFAULT_CACHE_TTL_MS = parseInt(process.env.SCHEDULING_CACHE_TTL_MS || '300000', 10);
const COMBINED_PLANNING_ENABLED = process.env.COMBINED_PLANNING !== 'false';

/**
 * Roche Planner MVP 2.0 — scheduling facade.
 * Constraint pipeline (ATP/TRIC/RMSL/QA) → priority → optimizer (OR-Tools | heuristic).
 */
class SchedulingService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.constraints = new ConstraintPipeline(provider);
    this.priority = new PriorityScorer();
    this.lineOpt = new LineOptimizationService(provider);
    this.heuristic = new HeuristicOptimizer(provider);
    this.optimizer = process.env.SCHEDULING_OPTIMIZER === 'ortools'
      ? new OrtoolsOptimizer(provider, this.heuristic, this.lineOpt)
      : this.heuristic;
    this._cache = { key: null, at: 0, result: null };
    this._constraintCache = { key: null, at: 0, result: null };
    this._repo = new JsonRepository();
  }

  _combinedPlanning() {
    if (!this._combinedPlanningSvc) {
      const { CombinedPlanningService } = require('./scheduling/combinedPlanningService');
      this._combinedPlanningSvc = new CombinedPlanningService(this.provider);
    }
    return this._combinedPlanningSvc;
  }

  runCombinedPlanning({ startAnchor, orders, packagingOrderIds, horizonDays } = {}) {
    if (!COMBINED_PLANNING_ENABLED) {
      return {
        disabled: true,
        message: 'Kombinierte Vor-/Rückwärtsplanung deaktiviert (COMBINED_PLANNING=false)',
      };
    }
    return this._combinedPlanning().calculate({ startAnchor, orders, packagingOrderIds, horizonDays });
  }

  _roughOrdersList() {
    const data = this._repo.read('roughPlannedOrders');
    const items = data?.items || [];
    return items.map((raw) => ({
      ...raw,
      packagingOrderId: raw.packagingOrder || raw.packagingOrderId,
      materialNumber: raw.materialNumber || raw.material,
      status: raw.status || 'PLANNED',
    }));
  }

  async getOptimizerStatus() {
    const { OrtoolsOptimizer } = require('./scheduling/ortoolsOptimizer');
    const mode = process.env.SCHEDULING_OPTIMIZER || 'heuristic';
    const status = {
      mode,
      optimizer: this.optimizer.name,
      cacheTtlMs: DEFAULT_CACHE_TTL_MS,
      roughOrderCount: this._roughCount(),
      maxHeuristicOrders: parseInt(process.env.SCHEDULING_MAX_HEURISTIC_ORDERS || '80', 10),
      horizonDaysDefault: parseInt(process.env.SCHEDULING_HORIZON_DAYS || '14', 10),
      ortoolsMaxTimeSeconds: parseFloat(process.env.ORTOOLS_MAX_TIME_SECONDS || '120'),
      productionScaleHint: this._roughCount() > 80
        ? 'Use SCHEDULING_OPTIMIZER=ortools for 80+ orders/day'
        : null,
    };
    if (mode === 'ortools') {
      status.sidecar = await OrtoolsOptimizer.ping();
    }
    return status;
  }

  _cacheKey(startAnchor) {
    const roughCount = this._roughCount();
    const rules = this.provider.getRules();
    const rulesVersion = rules.version || rules.repositoryVersion || '1';
    return `${this.optimizer.name}::${startAnchor}::${roughCount}::${rulesVersion}`;
  }

  _roughCount() {
    const data = this._repo.read('roughPlannedOrders');
    return (data?.items || []).length;
  }

  _loadPlanningInputs() {
    const lines = this.lineOpt._lines();
    const calendars = this.lineOpt._calendars();
    const batches = this.provider.getBatches();
    const rulesData = this.provider.getRules();
    const orders = this.provider.getOrders().filter(
      (o) => o.status === 'OPEN' || o.status === 'PLANNED',
    );
    return { lines, calendars, batches, rulesData, orders };
  }

  _constraintCacheKey(orders) {
    const rules = this.provider.getRules();
    const rulesVersion = rules.version || rules.repositoryVersion || '1';
    const batches = this.provider.getBatches();
    return `${orders.length}::${batches.length}::${rulesVersion}`;
  }

  _evaluateConstraintsCached(orders) {
    const ttl = DEFAULT_CACHE_TTL_MS;
    const key = this._constraintCacheKey(orders);
    if (
      this._constraintCache.key === key
      && this._constraintCache.result
      && Date.now() - this._constraintCache.at < ttl
    ) {
      return this._constraintCache.result;
    }
    const result = this.constraints.evaluate(orders);
    this._constraintCache = { key, at: Date.now(), result };
    return result;
  }

  evaluateConstraints({ packagingOrderIds = [] } = {}) {
    const { orders, rulesData, batches } = this._loadPlanningInputs();
    const subset = packagingOrderIds.length
      ? orders.filter((o) => packagingOrderIds.includes(o.packagingOrderId))
      : orders;
    const target = subset.length ? subset : orders;
    if (packagingOrderIds.length) {
      return this.constraints.evaluate(target);
    }
    return this._evaluateConstraintsCached(target);
  }

  /**
   * Full optimize run — use for explicit "Optimize" actions only.
   */
  async optimizeSequence({
    startAnchor = '2026-09-01',
    horizonDays = parseInt(process.env.SCHEDULING_HORIZON_DAYS || '14', 10),
    persistScenario = process.env.SCHEDULING_PERSIST_SCENARIOS === 'true',
  } = {}) {
    const { lines, calendars, batches, rulesData, orders } = this._loadPlanningInputs();
    const roughOrders = this._roughOrdersList();
    const constraintOrders = roughOrders.length ? roughOrders : orders;
    const constraintResult = this._evaluateConstraintsCached(constraintOrders);
    const eligibleOrders = constraintOrders.filter((o) => {
      const id = o.packagingOrderId || o.packagingOrder;
      const item = constraintResult.items.find((c) => c.packagingOrderId === id);
      return item?.eligible !== false;
    });

    const priorityScores = this.priority.rank(eligibleOrders.length ? eligibleOrders : constraintOrders, constraintResult.items, {
      batches,
      rulesData,
    });

    const combinedPlanning = COMBINED_PLANNING_ENABLED
      ? this._combinedPlanning().calculate({ orders: constraintOrders, startAnchor })
      : null;

    const roughCount = this._roughCount();
    const maxHeuristic = parseInt(process.env.SCHEDULING_MAX_HEURISTIC_ORDERS || '80', 10);
    if (this.optimizer.name === 'heuristic-line-sequencer' && roughCount > maxHeuristic) {
      const rough = this._roughFallback(startAnchor);
      if (rough) {
        const skipped = {
          ...rough,
          constraintSummary: constraintResult.summary,
          priorityScores: priorityScores.slice(0, 20),
          generatedAt: new Date().toISOString(),
          solverStatus: 'SKIPPED_TOO_LARGE',
          meta: {
            orderCount: roughCount,
            maxHeuristic,
            message: 'Heuristic optimize skipped for large datasets — use OR-Tools (Phase B) or reduce rough orders.',
          },
        };
        this._cache = { key: this._cacheKey(startAnchor), at: Date.now(), result: skipped };
        return skipped;
      }
    }

    const run = this.optimizer.optimize
      ? await Promise.resolve(this.optimizer.optimize({
        startAnchor,
        horizonDays,
        constraintItems: constraintResult.items,
        priorityScores,
        lines,
        calendars,
        persistScenario,
        combinedPlanningItems: combinedPlanning?.items || [],
      }))
      : this.heuristic.optimize({ startAnchor, persistScenario, horizonDays });

    const result = {
      ...run,
      constraintSummary: constraintResult.summary,
      combinedPlanning: combinedPlanning
        ? {
            summary: combinedPlanning.summary,
            constraintSummary: combinedPlanning.constraintSummary,
            sample: combinedPlanning.items.slice(0, 10),
          }
        : null,
      priorityScores: priorityScores.slice(0, 20),
      generatedAt: new Date().toISOString(),
    };

    this._cache = { key: this._cacheKey(startAnchor), at: Date.now(), result };
    return result;
  }

  /**
   * Dashboard-safe — returns cache or saved schedule without re-running heavy optimize.
   */
  async getRecommendedSequence({
    startAnchor = '2026-09-01',
    horizonDays = null,
    forceRefresh = false,
  } = {}) {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const horizon = parseHorizonDays(horizonDays);
    const key = this._cacheKey(startAnchor);
    const ttl = DEFAULT_CACHE_TTL_MS;
    if (
      !forceRefresh
      && this._cache.key === key
      && this._cache.result
      && Date.now() - this._cache.at < ttl
    ) {
      return { ...this._cache.result, fromCache: true };
    }

    if (!forceRefresh) {
      const saved = this._readSavedSchedule();
      if (saved?.items?.length) {
        return this._fromSavedSchedule(saved, startAnchor, horizon);
      }
      const rough = this._roughFallback(startAnchor, horizon);
      if (rough) return rough;
    }

    return this.optimizeSequence({ startAnchor, horizonDays: horizon, persistScenario: false });
  }

  _roughFallback(startAnchor, horizonDays = null) {
    try {
      const { parseHorizonDays } = require('../utils/planningHorizon');
      const snapshot = this.lineOpt.getOrders({
        startAnchor,
        horizonDays: parseHorizonDays(horizonDays),
      });
      if (!snapshot.orders?.length) return null;
      return {
        engine: 'rough-simulated',
        solverStatus: 'NOT_OPTIMIZED',
        startAnchor,
        sequence: snapshot.orders,
        ganttTasks: snapshot.ganttTasks,
        timelineStart: snapshot.timelineStart || startAnchor,
        timelineEnd: snapshot.timelineEnd,
        score: {},
        kpis: snapshot.kpis || {},
        fromRoughSimulation: true,
        generatedAt: snapshot.timestamp || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  _readSavedSchedule() {
    return this._repo.read('optimizedSchedule') || null;
  }

  _fromSavedSchedule(schedule, startAnchor, horizonDays = null) {
    const { resolveGanttTimeline, parseHorizonDays } = require('../utils/planningHorizon');
    const items = schedule.items || [];
    const anchor = startAnchor || items[0]?.plannedStartDate || '2026-09-01';
    const { timelineStart, timelineEnd } = resolveGanttTimeline({
      startAnchor: anchor,
      horizonDays: parseHorizonDays(horizonDays),
      orderEndDates: items.map((o) => o.plannedEndDate || o.plannedStartDate),
    });

    return {
      engine: 'saved-schedule',
      solverStatus: schedule.status || 'SAVED',
      startAnchor,
      sequence: items,
      ganttTasks: this.lineOpt.sequencer.toGanttTasks(items, timelineStart, timelineEnd),
      timelineStart,
      timelineEnd,
      score: schedule.score || {},
      kpis: schedule.kpis || {},
      fromSavedSchedule: true,
      generatedAt: schedule.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Dashboard / briefing safe — constraints + cached/saved schedule, never re-optimizes.
   */
  getExplanationEvidence({ startAnchor = '2026-09-01' } = {}) {
    const roughOrders = this._roughOrdersList();
    const constraintOrders = roughOrders.length ? roughOrders : this._loadPlanningInputs().orders;
    const constraintResult = this._evaluateConstraintsCached(constraintOrders);
    const key = this._cacheKey(startAnchor);
    const ttl = DEFAULT_CACHE_TTL_MS;
    let scheduleResult = null;

    if (
      this._cache.key === key
      && this._cache.result
      && Date.now() - this._cache.at < ttl
    ) {
      scheduleResult = { ...this._cache.result, fromCache: true };
    } else {
      const saved = this._readSavedSchedule();
      if (saved?.items?.length) {
        scheduleResult = this._fromSavedSchedule(saved, startAnchor);
      } else {
        scheduleResult = this._roughFallback(startAnchor);
      }
    }

    if (!scheduleResult) {
      scheduleResult = {
        engine: 'none',
        solverStatus: 'NO_SCHEDULE',
        startAnchor,
        sequence: [],
        score: {},
        kpis: {},
      };
    }

    if (!scheduleResult.constraintSummary) {
      scheduleResult = { ...scheduleResult, constraintSummary: constraintResult.summary };
    }
    if (!scheduleResult.priorityScores?.length) {
      const roughOrders = this._roughOrdersList();
      const orders = roughOrders.length
        ? roughOrders
        : this._loadPlanningInputs().orders;
      scheduleResult = {
        ...scheduleResult,
        priorityScores: this.priority.rank(orders, constraintResult.items, {
          batches: this.provider.getBatches(),
          rulesData: this.provider.getRules(),
        }).slice(0, 20),
      };
    }

    return this.buildExplanationContext(scheduleResult, constraintResult.items);
  }

  /** Structured evidence for PlannerAgent / GPT — no LLM calls here. */
  buildExplanationContext(scheduleResult, constraintItems = []) {
    const blockedSample = constraintItems
      .filter((i) => !i.eligible)
      .slice(0, 5)
      .map((i) => ({
        packagingOrderId: i.packagingOrderId,
        destinationCountry: i.destinationCountry,
        qaBlocked: i.qaBlocked,
        hardConstraints: i.hardConstraints,
        blockReasons: [
          i.qaBlocked ? 'QA' : null,
          !i.hardConstraints?.atp ? 'ATP' : null,
          !i.hardConstraints?.tric ? 'TRIC' : null,
          !i.hardConstraints?.rmsl ? 'RMSL' : null,
        ].filter(Boolean),
      }));
    return {
      engine: scheduleResult.engine,
      solverStatus: scheduleResult.solverStatus,
      constraintSummary: scheduleResult.constraintSummary,
      score: scheduleResult.score,
      kpis: scheduleResult.kpis,
      topPriority: (scheduleResult.priorityScores || []).slice(0, 5),
      sequenceSample: (scheduleResult.sequence || []).slice(0, 10).map((o) => ({
        packagingOrderId: o.packagingOrderId || o.packagingOrder,
        productionLine: o.productionLine,
        plannedStartDate: o.plannedStartDate,
        plannedEndDate: o.plannedEndDate,
        recommendedBatchId: o.recommendedBatchId,
        riskScore: o.riskScore,
      })),
      meta: scheduleResult.meta,
      fromCache: scheduleResult.fromCache,
      blockedSample,
    };
  }
}

module.exports = { SchedulingService };
