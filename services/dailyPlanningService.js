const fs = require('fs');
const path = require('path');
const { LineOptimizationService } = require('./lineOptimizationService');
const { SchedulingService } = require('./schedulingService');
const { AllocationService } = require('./allocationService');
const { ExceptionService } = require('./exceptionService');
const { PerformanceService } = require('./performanceService');
const { getProvider } = require('../providers');
const { generateId } = require('../utils/idGenerator');
const { todayISO, addDays } = require('../utils/dateUtils');
const { isShadowPlanningEnabled } = require('../utils/shadowPlanning');
const { DraftScheduleService } = require('./draftScheduleService');
const { PlanningOrderSourceService } = require('./planningOrderSourceService');
const { PlanStabilityService } = require('./planStabilityService');
const { SafeSchedulerWrapper } = require('./safeSchedulerWrapper');
const { OperationPlanningEngine } = require('../engines/operationPlanningEngine');
const { resolveGanttTimeline, parseHorizonDays } = require('../utils/planningHorizon');

const PLANNER_LABELS = {
  MARKET_RELEASE_CHECK: 'Market Release Check',
  SHELF_LIFE_RISK: 'Shelf-Life Risk',
  WHAT_IF_SIMULATION: 'What-if Simulation',
  RECOMMENDED_SEQUENCE: 'Recommended Sequence',
  PLANNING_EXCEPTIONS: 'Planning Exceptions',
  CONFIRMED_BATCH_ASSIGNMENT: 'Confirmed Batch Assignment',
};

class DailyPlanningService {
  constructor() {
    this.provider = getProvider();
    this.lineOpt = new LineOptimizationService(this.provider);
    this.scheduling = new SchedulingService(this.provider);
    this.allocation = new AllocationService();
    this.exceptions = new ExceptionService();
    this.performance = new PerformanceService();
    this.draftSchedules = new DraftScheduleService(this.provider);
    this.safeScheduler = new SafeSchedulerWrapper(this.scheduling);
    this.operationPlanner = new OperationPlanningEngine();
    this.orderSource = new PlanningOrderSourceService();
    this.planStability = new PlanStabilityService();
  }

  async operationsWhatIf({
    overrides = [],
    sequence = [],
    startAnchor = null,
    horizonDays = null,
    manualOverride = true,
  }) {
    const { parseHorizonDays, resolveGanttTimeline } = require('../utils/planningHorizon');
    const horizon = parseHorizonDays(horizonDays);
    const anchor = startAnchor || sequence[0]?.plannedStartDate || this._resolveStartAnchor(null);
    const scheduled = await this.operationPlanner.rescheduleWithOverrides(sequence, overrides, {
      startAnchor: anchor,
      horizonDays: horizon,
      manualOverride,
    });
    const capacity = this.operationPlanner.buildWorkCenterCapacity(scheduled.operations, {
      horizonDays: horizon,
      startDate: anchor,
    });
    const { timelineStart, timelineEnd } = resolveGanttTimeline({
      startAnchor: anchor,
      horizonDays: horizon,
      orderEndDates: scheduled.operations.map((o) => o.plannedEndDate),
    });
    return {
      timestamp: new Date().toISOString(),
      label: 'Operations what-if',
      overrides,
      horizonViolations: scheduled.horizonViolations || [],
      operationPlan: {
        phase: 5,
        operations: scheduled.operations,
        ordersWithOperations: scheduled.orders,
        workCenters: scheduled.workCenters,
        bottleneckWorkCenters: scheduled.bottleneckWorkCenters,
        operationGanttTasks: this.operationPlanner.toOperationGanttTasks(
          scheduled.operations,
          timelineStart,
          timelineEnd,
        ),
        workCenterSwimlanes: this.operationPlanner.workCentersAsSwimlanes(),
        workCenterCapacity: capacity,
        operationTimelineStart: timelineStart,
        operationTimelineEnd: timelineEnd,
        routingSummary: scheduled.solverMeta?.routingSource || null,
        operationsSolver: scheduled.solverMeta || null,
      },
    };
  }

  async _buildOperationPlan(orders, { startAnchor = null, horizonDays = null } = {}) {
    const horizon = parseHorizonDays(horizonDays);
    const anchor = startAnchor || orders[0]?.plannedStartDate || '2026-09-01';
    const scheduled = await this.operationPlanner.buildOperationSchedule(orders, {
      startAnchor: anchor,
      horizonDays: horizon,
    });
    const capacity = this.operationPlanner.buildWorkCenterCapacity(scheduled.operations, {
      horizonDays: horizon,
      startDate: anchor,
    });
    const { timelineStart, timelineEnd } = resolveGanttTimeline({
      startAnchor: anchor,
      horizonDays: horizon,
      orderEndDates: scheduled.operations.map((o) => o.plannedEndDate),
    });
    return {
      phase: 5,
      operations: scheduled.operations,
      ordersWithOperations: scheduled.orders,
      workCenters: scheduled.workCenters,
      bottleneckWorkCenters: scheduled.bottleneckWorkCenters,
      operationGanttTasks: this.operationPlanner.toOperationGanttTasks(
        scheduled.operations,
        timelineStart,
        timelineEnd,
      ),
      workCenterSwimlanes: this.operationPlanner.workCentersAsSwimlanes(),
      workCenterCapacity: capacity,
      operationTimelineStart: timelineStart,
      operationTimelineEnd: timelineEnd,
      routingSummary: scheduled.solverMeta?.routingSource || null,
      operationsSolver: scheduled.solverMeta || null,
    };
  }

  _resolveStartAnchor(startAnchor) {
    if (startAnchor) return startAnchor;
    const rough = this.orderSource.list();
    return rough[0]?.plannedStartDate
      || rough[0]?.roughPlannedStart?.slice(0, 10)
      || '2026-09-01';
  }

  _formatRecommendedFromDaily(daily, anchor) {
    return {
      timestamp: new Date().toISOString(),
      label: PLANNER_LABELS.RECOMMENDED_SEQUENCE,
      startAnchor: anchor || daily.timelineStart,
      sequence: daily.orders,
      ganttTasks: daily.ganttTasks,
      timelineStart: daily.timelineStart,
      timelineEnd: daily.timelineEnd,
      score: {},
      kpis: daily.kpis,
      comparison: null,
      scenarioId: null,
      engine: 'rough-simulated',
      solverStatus: 'NOT_OPTIMIZED',
      fromRoughSimulation: true,
    };
  }

  _mapScheduleResult(result, anchor) {
    return {
      timestamp: result.generatedAt || new Date().toISOString(),
      label: PLANNER_LABELS.RECOMMENDED_SEQUENCE,
      startAnchor: anchor,
      sequence: result.sequence || [],
      ganttTasks: result.ganttTasks || [],
      timelineStart: result.timelineStart,
      timelineEnd: result.timelineEnd,
      score: result.score || {},
      kpis: result.kpis || {},
      comparison: result.comparison || null,
      scenarioId: result.scenarioId || null,
      engine: result.engine,
      solverStatus: result.solverStatus,
      fromCache: result.fromCache,
      fromSavedSchedule: result.fromSavedSchedule,
      fromRoughSimulation: result.fromRoughSimulation,
      constraintSummary: result.constraintSummary,
    };
  }

  _dir() {
    return process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
  }

  _read(name) {
    try {
      return JSON.parse(fs.readFileSync(path.join(this._dir(), `${name}.json`), 'utf-8'));
    } catch {
      return { items: [] };
    }
  }

  _write(name, data) {
    fs.writeFileSync(path.join(this._dir(), `${name}.json`), JSON.stringify(data, null, 2));
  }

  _normalizeOrder(raw) {
    const poId = raw.packagingOrder || raw.packagingOrderId;
    return {
      ...raw,
      packagingOrder: poId,
      packagingOrderId: poId,
      plannedStartDate: raw.plannedStartDate || raw.roughPlannedStart?.slice(0, 10),
      plannedEndDate: raw.plannedEndDate || raw.roughPlannedEnd?.slice(0, 10),
      actualStartDate: raw.actualStartDate ?? null,
      actualEndDate: raw.actualEndDate ?? null,
      requestedDeliveryDate: raw.requestedDeliveryDate,
      productionLine: raw.productionLine || raw.preferredLine,
      durationHours: raw.durationHours,
      priority: raw.priority,
    };
  }

  _filterByDate(orders, date) {
    if (!date) return orders;
    return orders.filter((o) => {
      const start = o.plannedStartDate || o.roughPlannedStart?.slice(0, 10);
      const end = o.plannedEndDate || o.roughPlannedEnd?.slice(0, 10);
      return start <= date && end >= date;
    });
  }

  _plannerIssue(issue) {
    if (!issue?.message) return issue;
    let msg = issue.message;
    msg = msg.replace(/TRIC/gi, 'Market Release');
    msg = msg.replace(/RMSL/gi, 'Shelf-Life Risk');
    msg = msg.replace(/Japan Sequence/gi, 'Sequence Check');
    return { ...issue, message: msg };
  }

  _enrichWithPlannerLabels(orders) {
    return orders.map((o) => ({
      ...o,
      issues: (o.issues || []).map((i) => this._plannerIssue(i)),
    }));
  }

  getDailyOrders({ date = null, startAnchor = null, horizonDays = null } = {}) {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const horizon = parseHorizonDays(horizonDays);
    const anchor = this._resolveStartAnchor(startAnchor);
    const rough = this.orderSource.list().map((o) => this._normalizeOrder(o));
    const schedule = this._read('optimizedSchedule');
    const scheduled = (schedule.items || []).map((o) => this._normalizeOrder(o));

    const base = scheduled.length ? scheduled : rough;
    const simulated = this.lineOpt.getOrders({ startAnchor: anchor, horizonDays: horizon });
    const orderMap = Object.fromEntries(
      simulated.orders.map((o) => [o.packagingOrder || o.packagingOrderId, o])
    );

    const merged = base.map((r) => {
      const enriched = orderMap[r.packagingOrder || r.packagingOrderId] || r;
      return this._normalizeOrder({ ...r, ...enriched });
    });

    const filtered = this._filterByDate(merged, date);
    const lines = this.lineOpt.getLines();

    return {
      timestamp: new Date().toISOString(),
      planningDate: date || todayISO(),
      orders: this._enrichWithPlannerLabels(filtered.length ? filtered : merged),
      ganttTasks: simulated.ganttTasks,
      timelineStart: simulated.timelineStart,
      timelineEnd: simulated.timelineEnd,
      lines: lines.lines,
      calendars: lines.calendars,
      kpis: {
        ...simulated.kpis,
        ordersForDate: filtered.length,
        roughPlanned: rough.length,
        confirmedSequence: schedule.status === 'CONFIRMED',
        ...(() => {
          const exec = this.orderSource.getSummary();
          return {
            executableOrders: exec.executable,
            blockedOrders: exec.blocked,
            executableRate: exec.executableRate,
          };
        })(),
      },
      executability: this.orderSource.getSummary(),
    };
  }

  async getRecommendedSequence({
    startAnchor = null,
    horizonDays = null,
    forceRefresh = false,
    dailySnapshot = null,
  } = {}) {
    const anchor = this._resolveStartAnchor(startAnchor);
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const horizon = parseHorizonDays(horizonDays);

    if (!forceRefresh && dailySnapshot?.ganttTasks?.length) {
      return {
        ...this._formatRecommendedFromDaily(dailySnapshot, anchor),
        shadowPlanning: isShadowPlanningEnabled(),
        planningHorizon: { startAnchor: anchor, horizonDays: horizon },
      };
    }

    const result = forceRefresh
      ? await this._runOptimizeWithSafeWrapper(anchor, horizon)
      : await this._runRecommendedWithSafeWrapper(anchor, forceRefresh);

    return {
      ...this._mapScheduleResult(result, anchor),
      shadowPlanning: isShadowPlanningEnabled(),
      schedulerDegraded: result.schedulerDegraded || false,
      schedulerMessage: result.schedulerMessage || null,
      planningHorizon: { startAnchor: anchor, horizonDays: horizon },
    };
  }

  async _runOptimizeWithSafeWrapper(anchor, horizonDays) {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const horizon = parseHorizonDays(horizonDays);
    const outcome = await this.safeScheduler.optimizeSequence({
      startAnchor: anchor,
      horizonDays: horizon,
      persistScenario: false,
    });
    if (outcome.ok) return outcome.result;
    const fallback = await this.scheduling.getRecommendedSequence({
      startAnchor: anchor,
      forceRefresh: false,
    });
    return {
      ...fallback,
      schedulerDegraded: true,
      schedulerMessage: outcome.message,
    };
  }

  async _runRecommendedWithSafeWrapper(anchor, forceRefresh) {
    const outcome = await this.safeScheduler.getRecommendedSequence({
      startAnchor: anchor,
      forceRefresh,
    });
    if (outcome.ok) return outcome.result;
    return {
      engine: 'degraded',
      solverStatus: 'DEGRADED',
      sequence: [],
      ganttTasks: [],
      score: {},
      kpis: {},
      schedulerDegraded: true,
      schedulerMessage: outcome.message,
    };
  }

  async optimizeSequence({ startAnchor = null, horizonDays = null } = {}) {
    const anchor = this._resolveStartAnchor(startAnchor);
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const horizon = parseHorizonDays(horizonDays);
    const result = await this._runOptimizeWithSafeWrapper(anchor, horizon);
    const mapped = {
      ...this._mapScheduleResult(result, anchor),
      shadowPlanning: isShadowPlanningEnabled(),
      schedulerDegraded: result.schedulerDegraded || false,
      schedulerMessage: result.schedulerMessage || null,
      planningHorizon: { startAnchor: anchor, horizonDays: horizon },
      operationPlan: await this._buildOperationPlan(result.sequence || [], {
        startAnchor: anchor,
        horizonDays: horizon,
      }),
    };
    return mapped;
  }

  async whatIf({ sequence, compareToBaseline = true, horizonDays = null }) {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const horizon = parseHorizonDays(horizonDays);
    const result = this.lineOpt.simulate({
      sequence,
      compareToBaseline,
      horizonDays: horizon,
      startAnchor: sequence[0]?.plannedStartDate,
    });
    return {
      timestamp: new Date().toISOString(),
      label: PLANNER_LABELS.WHAT_IF_SIMULATION,
      scenarioId: result.scenarioId,
      sequence: result.sequence,
      orders: this._enrichWithPlannerLabels(result.result),
      ganttTasks: result.ganttTasks,
      timelineStart: result.timelineStart,
      timelineEnd: result.timelineEnd,
      score: result.score,
      kpis: result.kpis,
      comparison: result.comparison,
      operationPlan: await this._buildOperationPlan(result.result || sequence, {
        startAnchor: sequence[0]?.plannedStartDate,
        horizonDays: horizon,
      }),
    };
  }

  confirmSequence({
    sequence,
    label = 'Confirmed plant sequence',
    userId = 'SYSTEM',
    userName = null,
    draftScheduleId = null,
    horizonDays = null,
  }) {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const horizon = parseHorizonDays(horizonDays);
    const sim = this.lineOpt.simulate({ sequence, compareToBaseline: true, persistScenario: false, horizonDays: horizon });

    if (isShadowPlanningEnabled()) {
      return this.draftSchedules.markReadyFromSimulation({
        sim,
        label,
        userId,
        draftScheduleId,
      });
    }

    const schedule = {
      scheduleId: generateId('SCH'),
      plantId: '1000',
      label,
      status: 'CONFIRMED',
      confirmedAt: new Date().toISOString(),
      confirmedBy: userId,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
      items: sim.result,
      score: sim.score,
      kpis: sim.kpis,
    };

    this._write('optimizedSchedule', schedule);

    for (const item of sim.result) {
      const poId = item.packagingOrder || item.packagingOrderId;
      try {
        this.lineOpt.provider.updateOrder(poId, {
          plannedStartDate: item.plannedStartDate,
          plannedEndDate: item.plannedEndDate,
          productionLine: item.productionLine,
          status: 'PLANNED',
        });
      } catch { /* rough-only orders may not exist in orders.json */ }
    }

    let impactEvent = null;
    try {
      const { PlanningImpactService } = require('./planningImpactService');
      impactEvent = new PlanningImpactService().recordActivation({
        userId,
        userName,
        eventType: 'PLAN_CONFIRMED',
        scheduleId: schedule.scheduleId,
        plantId: schedule.plantId,
        label,
        horizonDays: horizon,
        comparison: sim.comparison,
        items: sim.result,
      });
    } catch {
      /* non-blocking */
    }

    let workPlanSnapshot = null;
    try {
      workPlanSnapshot = this.planStability.createWorkPlanSnapshot({
        scheduleId: schedule.scheduleId,
        items: sim.result,
        userId,
        userName,
        label,
        eventType: 'PLAN_CONFIRMED',
      });
    } catch {
      /* non-blocking */
    }

    return {
      confirmed: true,
      label: PLANNER_LABELS.CONFIRMED_BATCH_ASSIGNMENT,
      scheduleId: schedule.scheduleId,
      status: schedule.status,
      itemCount: schedule.items.length,
      comparison: sim.comparison,
      kpis: sim.kpis,
      impactEventId: impactEvent?.impactEventId || null,
      stabilityAnchorAt: workPlanSnapshot?.stabilityAnchorAt || null,
      snapshotId: workPlanSnapshot?.snapshotId || null,
      orders: this._enrichWithPlannerLabels(schedule.items),
    };
  }

  activateDraft({ draftScheduleId = null, userId = 'SYSTEM', userName = null, horizonDays = null } = {}) {
    return this.draftSchedules.activateDraft({ draftScheduleId, userId, userName, horizonDays });
  }

  getDraftStatus({ draftScheduleId = null } = {}) {
    const draft = draftScheduleId
      ? this.draftSchedules.getDraft(draftScheduleId)
      : this.draftSchedules.getLatestDraft();
    const schedule = this._read('optimizedSchedule');
    return {
      timestamp: new Date().toISOString(),
      shadowPlanning: isShadowPlanningEnabled(),
      draft: draft
        ? {
            draftScheduleId: draft.draftScheduleId,
            scheduleId: draft.scheduleId,
            status: draft.status,
            label: draft.label,
            itemCount: (draft.items || []).length,
            updatedAt: draft.updatedAt,
            readyAt: draft.readyAt,
            activatedAt: draft.activatedAt,
          }
        : null,
      productionSchedule: {
        scheduleId: schedule.scheduleId,
        status: schedule.status,
        confirmedAt: schedule.confirmedAt,
        itemCount: (schedule.items || []).length,
      },
    };
  }

  simulateBatchAssignment({ packagingOrderIds = [], sequence = [], userId = 'SYSTEM' } = {}) {
    let orderIds = packagingOrderIds;
    if (!orderIds.length && sequence.length) {
      orderIds = sequence.map((s) => s.packagingOrder || s.packagingOrderId);
    }
    if (!orderIds.length) {
      const daily = this.getDailyOrders();
      orderIds = daily.orders.map((o) => o.packagingOrder || o.packagingOrderId);
    }

    const results = [];
    for (const poId of orderIds) {
      try {
        const sim = this.allocation.simulate({ packagingOrderId: poId, userId });
        results.push({
          packagingOrderId: poId,
          status: sim.status,
          recommendedBatchId: sim.recommendedBatchId,
          allocatedQuantity: sim.allocatedQuantity,
          risk: sim.risk,
          ruleChecks: (sim.ruleChecks || []).map((c) => ({
            ...c,
            ruleName: (c.ruleName || '')
              .replace('TRIC Validation', PLANNER_LABELS.MARKET_RELEASE_CHECK)
              .replace('RMSL Validation', `${PLANNER_LABELS.SHELF_LIFE_RISK} Check`)
              .replace('Optimization Engine', PLANNER_LABELS.RECOMMENDED_SEQUENCE),
          })),
          failures: sim.failureReasons || [],
        });
      } catch (err) {
        results.push({
          packagingOrderId: poId,
          status: 'FAILED',
          error: err.message,
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      label: PLANNER_LABELS.WHAT_IF_SIMULATION,
      simulationId: generateId('BSIM'),
      totalOrders: results.length,
      successful: results.filter((r) => r.status === 'SIMULATED' || r.status === 'SUCCESS').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      results,
    };
  }

  getConfirmedSchedule() {
    const schedule = this._read('optimizedSchedule');
    return {
      timestamp: new Date().toISOString(),
      label: PLANNER_LABELS.CONFIRMED_BATCH_ASSIGNMENT,
      scheduleId: schedule.scheduleId,
      status: schedule.status,
      confirmedAt: schedule.confirmedAt,
      confirmedBy: schedule.confirmedBy,
      itemCount: (schedule.items || []).length,
      orders: this._enrichWithPlannerLabels((schedule.items || []).map((o) => this._normalizeOrder(o))),
      kpis: schedule.kpis,
      comparison: schedule.comparison,
    };
  }

  async getPlannerDashboard({ date = null, startAnchor = null, horizonDays = null } = {}) {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const horizon = parseHorizonDays(horizonDays);
    const anchor = this._resolveStartAnchor(startAnchor);
    const daily = this.getDailyOrders({ date, startAnchor: anchor, horizonDays: horizon });
    const recommended = await this.getRecommendedSequence({
      startAnchor: anchor,
      horizonDays: horizon,
      forceRefresh: false,
      dailySnapshot: daily,
    });
    const batchPreview = this.simulateBatchAssignment({ sequence: recommended.sequence.slice(0, 5) });
    const materials = [...new Set(daily.orders.map((o) => o.materialNumber).filter(Boolean))];

    const lineRecommendations = materials.map((materialNumber) => {
      try {
        const rec = this.performance.recommendLine(materialNumber);
        return {
          materialNumber,
          recommendedLineId: rec.recommendedLineId,
          lineScore: rec.candidates?.[0]?.lineScore,
          candidates: (rec.candidates || []).slice(0, 2),
        };
      } catch {
        return { materialNumber, recommendedLineId: null };
      }
    });

    const storedPlanning = (this.provider.getPlanningExceptions?.({ status: 'OPEN' }) || []);

    const sequenceOrders = recommended.sequence?.length ? recommended.sequence : daily.orders;
    const operationPlan = await this._buildOperationPlan(sequenceOrders, {
      startAnchor: anchor,
      horizonDays: horizon,
    });

    return {
      timestamp: new Date().toISOString(),
      planningDate: daily.planningDate,
      label: 'Planner Dashboard',
      kpis: {
        openOrders: daily.kpis.openOrders ?? daily.orders.length,
        highRiskOrders: daily.kpis.highRiskOrders ?? 0,
        lateOrders: daily.kpis.lateOrders ?? 0,
        rmslRiskOrders: daily.kpis.rmslRiskOrders ?? 0,
        japanSequenceIssues: daily.kpis.jpSequenceIssues ?? 0,
        peakUtilization: daily.kpis.peakUtilization ?? 0,
        planningExceptions: storedPlanning.length + (daily.kpis.highRiskOrders || 0),
        roughPlanned: daily.kpis.roughPlanned ?? 0,
      },
      lineUtilization: daily.kpis.lineUtilization || [],
      recommendations: {
        sequence: recommended.sequence,
        sequenceLabel: PLANNER_LABELS.RECOMMENDED_SEQUENCE,
        lines: lineRecommendations,
        batches: batchPreview.results.map((r) => ({
          packagingOrderId: r.packagingOrderId,
          recommendedBatchId: r.recommendedBatchId,
          riskLevel: r.risk?.level,
          status: r.status,
        })),
      },
      orders: daily.orders,
      ganttTasks: recommended.ganttTasks,
      timelineStart: recommended.timelineStart,
      timelineEnd: recommended.timelineEnd,
      lines: daily.lines,
      comparison: recommended.comparison,
      shadowPlanning: isShadowPlanningEnabled(),
      planningDraft: this.getDraftStatus(),
      scheduling: {
        engine: recommended.engine || null,
        solverStatus: recommended.solverStatus || null,
        schedulerDegraded: recommended.schedulerDegraded || false,
        schedulerMessage: recommended.schedulerMessage || null,
      },
      planningHorizon: recommended.planningHorizon || { startAnchor: anchor, horizonDays: horizon },
      operationPlan,
      executability: daily.executability || this.orderSource.getSummary(),
      lineScorecard: this.buildLineScorecard(recommended.comparison, sequenceOrders),
      planStability: this.planStability.getPpsMetrics(),
    };
  }

  getExceptions({ status = 'OPEN', date = null } = {}) {
    const stored = this.exceptions.list({ status: status || undefined });
    const planningStored = (this.provider.getPlanningExceptions?.() || []).map((ex) => ({
      ...ex,
      typeLabel: (ex.typeLabel || ex.type || '')
        .replace('TRIC Violation', 'Market Release Exception')
        .replace('RMSL Violation', 'Shelf-Life Risk Exception')
        .replace('Japan Sequence Violation', 'Sequence Check Exception'),
      source: ex.source || 'PLANNING',
    }));
    const daily = this.getDailyOrders({ date });
    const planningIssues = [];

    for (const order of daily.orders) {
      if ((order.riskScore || 0) >= 30 || order.rmslViolation || order.late) {
        planningIssues.push({
          exceptionId: `PLAN-${order.packagingOrder || order.packagingOrderId}`,
          type: order.rmslViolation ? 'RMSL_VIOLATION' : order.late ? 'LATE_DELIVERY' : 'PLANNING_RISK',
          typeLabel: order.rmslViolation
            ? 'Shelf-Life Risk Exception'
            : order.late
              ? 'Late Delivery Risk'
              : 'Planning Risk',
          packagingOrderId: order.packagingOrder || order.packagingOrderId,
          destinationCountry: order.destinationCountry,
          productionLine: order.productionLine,
          status: 'OPEN',
          severity: (order.riskScore || 0) >= 50 ? 'CRITICAL' : 'HIGH',
          riskScore: order.riskScore || 0,
          message: (order.issues || [])[0]?.message || 'Order at planning risk',
          plannedStartDate: order.plannedStartDate,
          plannedEndDate: order.plannedEndDate,
          source: 'SEQUENCING',
        });
      }
      for (const issue of order.issues || []) {
        if (issue.severity === 'HIGH' || issue.severity === 'CRITICAL') {
          planningIssues.push({
            exceptionId: `PLAN-ISS-${order.packagingOrder}-${issue.code}`,
            type: issue.code,
            typeLabel: this._plannerIssue(issue).message?.slice(0, 60) || PLANNER_LABELS.PLANNING_EXCEPTIONS,
            packagingOrderId: order.packagingOrder || order.packagingOrderId,
            destinationCountry: order.destinationCountry,
            status: 'OPEN',
            severity: issue.severity,
            message: this._plannerIssue(issue).message,
            source: 'SEQUENCING',
          });
        }
      }
    }

    const plannerStored = stored.map((ex) => ({
      ...ex,
      typeLabel: (ex.typeLabel || ex.type || '')
        .replace('TRIC Violation', 'Market Release Exception')
        .replace('RMSL Violation', 'Shelf-Life Risk Exception')
        .replace('Japan Sequence Violation', 'Sequence Check Exception'),
      source: ex.source || 'ALLOCATION',
    }));

    const combined = [...planningIssues, ...planningStored, ...plannerStored];
    const unique = [];
    const seen = new Set();
    for (const ex of combined) {
      const key = ex.exceptionId;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(ex);
      }
    }

    return {
      timestamp: new Date().toISOString(),
      label: PLANNER_LABELS.PLANNING_EXCEPTIONS,
      total: unique.length,
      open: unique.filter((e) => e.status === 'OPEN').length,
      exceptions: unique,
    };
  }

  getExecutabilityOverview() {
    return this.orderSource.getExecutabilityOverview();
  }

  getPlanStabilityMetrics(options = {}) {
    return this.planStability.getPpsMetrics(options);
  }

  recordPlanningContribution({
    userId = 'SYSTEM',
    userName = null,
    note = '',
    comparison = null,
    items = [],
    aiAssisted = false,
    horizonDays = null,
  } = {}) {
    const { PlanningImpactService } = require('./planningImpactService');
    return new PlanningImpactService().recordContribution({
      userId,
      userName,
      note,
      comparison,
      items,
      aiAssisted,
      horizonDays,
    });
  }

  buildLineScorecard(comparison, items = []) {
    const lines = {};
    for (const item of items) {
      const line = item.productionLine || 'UNASSIGNED';
      if (!lines[line]) {
        lines[line] = {
          lineId: line,
          orderCount: 0,
          lateOrders: 0,
          movedOrders: 0,
          utilizationPct: null,
        };
      }
      lines[line].orderCount += 1;
      if (item.late) lines[line].lateOrders += 1;
    }
    const movedIds = new Set((comparison?.moved || []).map((m) => m.packagingOrder));
    for (const line of Object.values(lines)) {
      line.movedOrders = (comparison?.moved || []).filter(
        (m) => m.toLine === line.lineId || m.fromLine === line.lineId,
      ).length;
    }
    if (comparison?.dimensions?.productionLine) {
      for (const [lineId, bucket] of Object.entries(comparison.dimensions.productionLine)) {
        if (!lines[lineId]) {
          lines[lineId] = { lineId, orderCount: 0, lateOrders: 0, movedOrders: 0 };
        }
        lines[lineId].label = bucket.label || lineId;
        lines[lineId].ordersMoved = bucket.ordersMoved || 0;
        lines[lineId].lateOrders = bucket.lateOrders || lines[lineId].lateOrders;
        lines[lineId].orderCount = bucket.orderCount || lines[lineId].orderCount;
      }
    }
    return {
      timestamp: new Date().toISOString(),
      lines: Object.values(lines).sort((a, b) => b.orderCount - a.orderCount),
      comparisonSummary: comparison?.summary || null,
      aggregates: comparison ? new (require('./planningImpactService').PlanningImpactService)()._extractAggregates(comparison) : null,
    };
  }
}

module.exports = { DailyPlanningService };
