const { generateId } = require('../../utils/idGenerator');
const { MasterDataLoader } = require('./masterDataLoader');
const { EligibilityEngine, EXCEPTION_TYPES } = require('./eligibilityEngine');
const { PriorityEngine } = require('./priorityEngine');
const { SetupOptimizationEngine } = require('./setupOptimizationEngine');
const { FiniteCapacityScheduler } = require('./finiteCapacityScheduler');
const { MultiLineEngine } = require('./multiLineEngine');
const { KpiCalculator } = require('./kpiCalculator');
const { OrtoolsDetailedOptimizer } = require('./ortoolsDetailedOptimizer');
const { PlanningHorizonEngine } = require('../planningHorizonEngine');

class DetailedSchedulingEngine {
  constructor(dataDir = null) {
    this.loader = new MasterDataLoader(dataDir);
    this.kpiCalc = new KpiCalculator();
    this.horizonEngine = new PlanningHorizonEngine();
  }

  async buildSchedule(options = {}) {
    const solver = options.solver || process.env.DETAILED_SCHEDULING_SOLVER || 'heuristic';
    if (solver === 'ortools') {
      return this._buildScheduleWithOrtools(options);
    }
    return this._buildScheduleHeuristic(options);
  }

  _prepareBuildContext(options = {}) {
    const masterData = options.masterDataOverride || this.loader.loadAll();
    const eligibility = new EligibilityEngine(masterData);
    const priority = new PriorityEngine();
    const setupOpt = new SetupOptimizationEngine(masterData.setupMatrix);
    const multiLine = new MultiLineEngine(masterData, setupOpt);
    const horizonDays = options.horizonDays || 28;
    const startAnchor = options.startAnchor
      || masterData.productionOrders[0]?.plannedStartDate
      || new Date().toISOString().slice(0, 10);

    let orders = priority.sortOrders(masterData.productionOrders);
    orders = setupOpt.campaignSort(orders);

    const bottleneckLines = new Set(
      masterData.lineQualifications.filter((q) => q.isBottleneck).map((q) => q.lineId),
    );
    orders = this._bottleneckFirst(orders, masterData, bottleneckLines);

    return {
      masterData,
      eligibility,
      setupOpt,
      multiLine,
      horizonDays,
      startAnchor,
      orders,
    };
  }

  _buildScheduleHeuristic(options = {}) {
    const ctx = this._prepareBuildContext(options);
    const scheduler = new FiniteCapacityScheduler(ctx.masterData);
    return this._finalizeSchedule(
      this._scheduleOrders(ctx, scheduler, {}),
      ctx,
      scheduler,
      { solverEngine: 'heuristic-finite-capacity', solverStatus: 'HEURISTIC' },
    );
  }

  async _buildScheduleWithOrtools(options = {}) {
    const ctx = this._prepareBuildContext(options);
    const scheduler = new FiniteCapacityScheduler(ctx.masterData);
    let solverMeta = {
      solverEngine: 'google-or-tools-detailed',
      solverStatus: 'OPTIMAL',
      ortoolsFallback: false,
    };

    const eligible = [];
    const blockedOrders = [];
    const exceptions = [];

    for (const order of ctx.orders) {
      const lineId = ctx.multiLine.selectBestLine(order, scheduler.lineState) || order.packagingLine;
      const eligibilityResult = ctx.eligibility.checkOrder(order, lineId);
      if (!eligibilityResult.eligible) {
        blockedOrders.push({
          ...order,
          assignedLine: lineId,
          blockReason: eligibilityResult.exceptions[0]?.type,
          recommendedBatch: eligibilityResult.recommendedBatch,
          qaAction: eligibilityResult.qaAction,
        });
        exceptions.push(...eligibilityResult.exceptions);
        continue;
      }
      eligible.push({ order, lineId, eligibilityResult });
    }

    let ortoolsSequence = null;
    try {
      const optimizer = new OrtoolsDetailedOptimizer();
      const result = await optimizer.optimize({
        orders: eligible.map((e) => ({ ...e.order, assignedLine: e.lineId })),
        lines: ctx.masterData.productionLines,
        calendars: ctx.masterData.lineCalendars,
        startAnchor: ctx.startAnchor,
        horizonDays: ctx.horizonDays,
      });
      ortoolsSequence = Object.fromEntries(
        (result.sequence || []).map((item) => [
          item.packagingOrderId || item.orderNumber,
          item,
        ]),
      );
      solverMeta = {
        solverEngine: result.engine,
        solverStatus: result.solverStatus,
        ortoolsFallback: false,
        runtimeMs: result.runtimeMs,
        score: result.score,
      };
    } catch (err) {
      if (process.env.DETAILED_SCHEDULING_ORTOOLS_REQUIRED === 'true') throw err;
      solverMeta = {
        solverEngine: 'heuristic-finite-capacity',
        solverStatus: 'FALLBACK',
        ortoolsFallback: true,
        ortoolsError: err.message,
      };
    }

    const orderedEligible = [...eligible].sort((a, b) => {
      const sa = ortoolsSequence?.[a.order.orderNumber]?.plannedStartDate || a.order.dueDate || '9999';
      const sb = ortoolsSequence?.[b.order.orderNumber]?.plannedStartDate || b.order.dueDate || '9999';
      return sa.localeCompare(sb);
    });

    const partial = this._scheduleOrders(
      { ...ctx, orders: orderedEligible.map((e) => e.order) },
      scheduler,
      {
        lineResolver: (order) => {
          const seqItem = ortoolsSequence?.[order.orderNumber];
          const match = eligible.find((e) => e.order.orderNumber === order.orderNumber);
          return seqItem?.productionLine || seqItem?.bestLineId || match?.lineId || order.packagingLine;
        },
        startHintResolver: (order) => (
          ortoolsSequence?.[order.orderNumber]?.plannedStartDate || ctx.startAnchor
        ),
        eligibilityByOrder: Object.fromEntries(
          eligible.map((e) => [e.order.orderNumber, e.eligibilityResult]),
        ),
        preBlocked: { blockedOrders, exceptions },
      },
    );

    return this._finalizeSchedule(partial, ctx, scheduler, solverMeta);
  }

  _scheduleOrders(ctx, scheduler, {
    lineResolver = null,
    startHintResolver = null,
    eligibilityByOrder = null,
    preBlocked = null,
  } = {}) {
    const scheduledOrders = [];
    const blockedOrders = preBlocked?.blockedOrders ? [...preBlocked.blockedOrders] : [];
    const exceptions = preBlocked?.exceptions ? [...preBlocked.exceptions] : [];
    const ganttTasks = [];
    const lineSequences = {};

    for (const order of ctx.orders) {
      const lineId = lineResolver
        ? lineResolver(order)
        : ctx.multiLine.selectBestLine(order, scheduler.lineState) || order.packagingLine;

      let eligibilityResult = eligibilityByOrder?.[order.orderNumber];
      if (!eligibilityResult) {
        eligibilityResult = ctx.eligibility.checkOrder(order, lineId);
      }

      if (!eligibilityResult.eligible) {
        blockedOrders.push({
          ...order,
          assignedLine: lineId,
          blockReason: eligibilityResult.exceptions[0]?.type,
          recommendedBatch: eligibilityResult.recommendedBatch,
          qaAction: eligibilityResult.qaAction,
        });
        exceptions.push(...eligibilityResult.exceptions);
        continue;
      }

      const lastColor = scheduler.lineState[lineId]?.lastColor || 'Clear';
      const setupHours = ctx.setupOpt.setupMinutes(lastColor, order.colorFamily) / 60;
      const slotStart = startHintResolver ? startHintResolver(order) : ctx.startAnchor;
      const scheduled = scheduler.scheduleOrder(order, lineId, setupHours, slotStart);
      scheduled.recommendedBatch = eligibilityResult.recommendedBatch;

      if (scheduled.capacityOverload) {
        exceptions.push({
          exceptionId: generateId('EXC-DS'),
          type: EXCEPTION_TYPES.CAPACITY_OVERLOAD,
          orderNumber: order.orderNumber,
          severity: 'MEDIUM',
          message: `Order ${order.orderNumber} pushed due to capacity on ${lineId}`,
          createdAt: new Date().toISOString(),
          status: 'OPEN',
        });
      }

      scheduledOrders.push(scheduled);
      if (!lineSequences[lineId]) lineSequences[lineId] = [];
      lineSequences[lineId].push(scheduled);

      ganttTasks.push(this._toGanttTask(scheduled, 'PRODUCTION'));
      ganttTasks.push(this._toGanttTask(scheduled, 'SETUP', setupHours));
    }

    const annotated = this.horizonEngine.annotateScheduleItems(scheduledOrders, {
      anchorDate: ctx.startAnchor,
      materialByNumber: ctx.masterData?.materialByNumber || {},
    });

    for (let i = 0; i < annotated.length; i += 1) {
      scheduledOrders[i] = annotated[i];
    }

    for (const [lineId, seq] of Object.entries(lineSequences)) {
      lineSequences[lineId] = ctx.setupOpt.optimizeSequence(seq);
    }

    return { scheduledOrders, blockedOrders, exceptions, ganttTasks, lineSequences };
  }

  _finalizeSchedule(partial, ctx, scheduler, solverMeta) {
    const utilization = scheduler.getUtilization();
    const timelineEnd = this._timelineEnd(partial.scheduledOrders, ctx.startAnchor, ctx.horizonDays);

    const scheduleResult = {
      scheduleId: generateId('DSCH'),
      createdAt: new Date().toISOString(),
      startAnchor: ctx.startAnchor,
      timelineEnd,
      horizonDays: ctx.horizonDays,
      scheduledOrders: partial.scheduledOrders,
      blockedOrders: partial.blockedOrders,
      exceptions: partial.exceptions,
      ganttTasks: partial.ganttTasks,
      lineSequences: partial.lineSequences,
      utilization,
      granularity: 'hour',
      solver: solverMeta,
      masterData: {
        lineCount: ctx.masterData.productionLines.length,
        orderCount: ctx.masterData.productionOrders.length,
      },
    };

    scheduleResult.kpis = this.kpiCalc.calculate(scheduleResult);
    scheduleResult.explanation = this._buildExplanation(scheduleResult);
    return scheduleResult;
  }

  _bottleneckFirst(orders, masterData, bottleneckLines) {
    const onBn = [];
    const rest = [];
    for (const o of orders) {
      const line = o.packagingLine;
      const qual = masterData.qualificationByLine[line];
      if (qual?.isBottleneck || bottleneckLines.has(line)) onBn.push(o);
      else rest.push(o);
    }
    return [...onBn, ...rest];
  }

  _toGanttTask(order, type, setupHours = 0) {
    if (type === 'SETUP') {
      return {
        id: `${order.orderNumber}-SETUP`,
        orderNumber: order.orderNumber,
        lineId: order.assignedLine,
        productionLine: order.assignedLine,
        type: 'SETUP',
        start: order.scheduledStartDateTime || order.scheduledStartDate,
        end: order.scheduledStartDateTime || order.scheduledStartDate,
        plannedStartDate: order.scheduledStartDate,
        plannedEndDate: order.scheduledStartDate,
        plannedStartDateTime: order.scheduledStartDateTime,
        plannedEndDateTime: order.scheduledStartDateTime,
        durationHours: setupHours,
        label: `Setup · ${order.orderNumber}`,
        colorFamily: order.colorFamily,
      };
    }
    return {
      id: order.orderNumber,
      orderNumber: order.orderNumber,
      lineId: order.assignedLine,
      productionLine: order.assignedLine,
      type: 'PRODUCTION',
      start: order.scheduledStartDateTime || order.scheduledStartDate,
      end: order.scheduledEndDateTime || order.scheduledEndDate,
      plannedStartDate: order.scheduledStartDate,
      plannedEndDate: order.scheduledEndDate,
      plannedStartDateTime: order.scheduledStartDateTime,
      plannedEndDateTime: order.scheduledEndDateTime,
      durationHours: order.productionDurationHours,
      label: `${order.orderNumber} · ${order.materialDescription}`,
      country: order.country,
      priority: order.priority,
      campaignGroup: order.campaignGroup,
      colorFamily: order.colorFamily,
      recommendedBatch: order.recommendedBatch,
    };
  }

  _timelineEnd(orders, start, horizonDays) {
    const { addDays } = require('../../utils/dateUtils');
    if (!orders.length) return addDays(start, horizonDays);
    const max = orders.reduce((m, o) => (o.scheduledEndDate > m ? o.scheduledEndDate : m), start);
    return max;
  }

  _buildExplanation(result) {
    const lines = [];
    lines.push(`Scheduled ${result.scheduledOrders.length} orders, blocked ${result.blockedOrders.length}.`);
    if (result.kpis.totalSetupHours) {
      lines.push(`Total setup time ${result.kpis.totalSetupHours} h after campaign grouping.`);
    }
    if (result.exceptions.length) {
      const types = [...new Set(result.exceptions.map((e) => e.type))];
      lines.push(`Exceptions: ${types.join(', ')}.`);
    }
    return lines.join(' ');
  }

  rescheduleOrder(schedule, override) {
    const masterData = this.loader.loadAll();
    const order = masterData.productionOrders.find((o) => o.orderNumber === override.orderNumber);
    if (!order) throw new Error(`Order ${override.orderNumber} not found`);

    const materialMeta = masterData.materialByNumber[order.materialNumber];
    const ctx = this.horizonEngine.buildContext(order, materialMeta);
    const moveCheck = this.horizonEngine.canAutoMove(ctx, {
      anchorDate: schedule.startAnchor,
      targetDate: override.plannedStartDate,
      isManualOverride: override.manualOverride !== false,
    });

    if (!moveCheck.allowed) {
      const exc = this.horizonEngine.buildHorizonViolationException(order, moveCheck.horizon, {
        anchorDate: schedule.startAnchor,
        attemptedAction: 'move',
      });
      return {
        success: false,
        exceptions: [exc],
        horizon: moveCheck.horizon,
      };
    }

    const setupOpt = new SetupOptimizationEngine(masterData.setupMatrix);
    const scheduler = new FiniteCapacityScheduler(masterData);
    const eligibility = new EligibilityEngine(masterData);
    const lineId = override.lineId || order.packagingLine;

    const check = eligibility.checkOrder(order, lineId);
    if (!check.eligible) {
      return { success: false, exceptions: check.exceptions };
    }

    const setupHours = setupOpt.setupMinutes('Clear', order.colorFamily) / 60;
    const startAnchor = override.plannedStartDateTime || override.plannedStartDate;
    const scheduled = scheduler.scheduleOrder(
      order,
      lineId,
      setupHours,
      startAnchor,
    );
    scheduled.recommendedBatch = check.recommendedBatch;
    const annotated = this.horizonEngine.annotateOrder(
      scheduled,
      materialMeta,
      {
        anchorDate: override.plannedStartDate || schedule.startAnchor,
        targetDate: scheduled.scheduledStartDate,
      },
    );

    return {
      success: true,
      order: annotated,
      ganttTasks: [
        this._toGanttTask(annotated, 'PRODUCTION'),
        this._toGanttTask(annotated, 'SETUP', setupHours),
      ],
      horizon: annotated.planningHorizonMeta,
    };
  }

  toGanttPayload(scheduleResult) {
    const { toGanttPayloadWithGranularity } = require('../../utils/ganttTimeScale');
    return toGanttPayloadWithGranularity(scheduleResult, 'hour');
  }
}

module.exports = { DetailedSchedulingEngine };
