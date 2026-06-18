const fs = require('fs');
const path = require('node:path');
const { getProvider } = require('../providers');
const { LineSequencingEngine } = require('../engines/lineSequencingEngine');
const { ScheduleImpactEngine } = require('../engines/scheduleImpactEngine');
const { AllocationService } = require('./allocationService');
const { PerformanceService } = require('./performanceService');
const { generateId } = require('../utils/idGenerator');
const { isShadowPlanningEnabled } = require('../utils/shadowPlanning');
const { DraftScheduleService } = require('./draftScheduleService');
const {
  getDefaultHorizonDays,
  resolvePerformanceHorizonMode,
  resolveGanttTimeline,
  parseHorizonDays,
} = require('../utils/planningHorizon');

class LineOptimizationService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.performance = new PerformanceService(provider);
    this.sequencer = new LineSequencingEngine(this.performance.getPerformanceRecords());
    this.impact = new ScheduleImpactEngine();
    this.allocation = new AllocationService();
    this.draftSchedules = new DraftScheduleService(provider);
  }

  _refreshSequencer() {
    this.performance.refreshFromHistory();
    this.sequencer = new LineSequencingEngine(this.performance.getPerformanceRecords());
  }

  _historicalPerformance() {
    return this.performance.getPerformanceRecords();
  }

  _dir() {
    return process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
  }

  _read(name) {
    try {
      return JSON.parse(fs.readFileSync(path.join(this._dir(), `${name}.json`), 'utf-8'));
    } catch {
      return name === 'optimizedSchedule' ? { items: [] } : { items: [] };
    }
  }

  _write(name, data) {
    fs.writeFileSync(path.join(this._dir(), `${name}.json`), JSON.stringify(data, null, 2));
  }

  _roughOrders() {
    return this._read('roughPlannedOrders').items || [];
  }

  _lines(horizonDays = null) {
    const days = horizonDays != null ? horizonDays : getDefaultHorizonDays();
    return this.performance.getLinesForHorizon(resolvePerformanceHorizonMode(days));
  }

  _calendars() {
    return this._read('lineCalendars').items || [];
  }

  _rules() {
    return this.provider.getRules();
  }

  _batches() {
    return this.provider.getBatches();
  }

  _roughMap() {
    return Object.fromEntries(this._roughOrders().map((o) => [o.packagingOrder, o]));
  }

  _timelineForOrders(orders, startAnchor, horizonDays) {
    const anchor = startAnchor || orders.reduce(
      (min, o) => (o.plannedStartDate && o.plannedStartDate < min ? o.plannedStartDate : min),
      orders[0]?.plannedStartDate || '2026-09-01',
    );
    const ends = orders.map((o) => o.plannedEndDate || o.plannedStartDate).filter(Boolean);
    return resolveGanttTimeline({
      startAnchor: anchor,
      horizonDays: parseHorizonDays(horizonDays),
      orderEndDates: ends,
    });
  }

  getOrders({ startAnchor = null, horizonDays = null } = {}) {
    const rough = this._roughOrders();
    const optimized = this._read('optimizedSchedule');
    const scheduleItems = optimized.items?.length ? optimized.items : null;

    const base = scheduleItems || rough.map((r) => ({
      ...r,
      packagingOrderId: r.packagingOrder,
      productionLine: r.preferredLine,
      plannedStartDate: r.roughPlannedStart?.slice(0, 10),
      plannedEndDate: r.roughPlannedEnd?.slice(0, 10),
      planningStatus: 'ROUGH',
      allocationStatus: 'PLANNED',
    }));

    const enriched = this.sequencer.simulateSequence(
      base.map((o) => ({
        packagingOrder: o.packagingOrder || o.packagingOrderId,
        productionLine: o.productionLine || o.preferredLine,
        plannedStartDate: o.plannedStartDate,
        plannedEndDate: o.plannedEndDate,
        recommendedBatchId: o.recommendedBatchId,
      })),
      this._roughMap(),
      this._lines(),
      this._calendars(),
      this._batches(),
      this._rules()
    );

    const { timelineStart, timelineEnd } = this._timelineForOrders(
      enriched.simulated,
      startAnchor,
      horizonDays,
    );

    return {
      timestamp: new Date().toISOString(),
      orders: enriched.simulated,
      ganttTasks: this.sequencer.toGanttTasks(enriched.simulated, timelineStart, timelineEnd),
      timelineStart,
      timelineEnd,
      kpis: enriched.kpis,
    };
  }

  getLines() {
    return {
      timestamp: new Date().toISOString(),
      lines: this._lines(),
      calendars: this._calendars(),
    };
  }

  simulate({
    sequence,
    compareToBaseline = true,
    persistScenario = true,
    horizonDays = null,
    startAnchor = null,
  } = {}) {
    this._refreshSequencer();
    const roughMap = this._roughMap();
    const baselineOrders = this.getOrders().orders;
    const planningHorizon = horizonDays ?? getDefaultHorizonDays();

    const result = this.sequencer.simulateSequence(
      sequence,
      roughMap,
      this._lines(planningHorizon),
      this._calendars(),
      this._batches(),
      this._rules(),
      planningHorizon,
    );

    const comparison = compareToBaseline
      ? this.impact.compare(baselineOrders, result.simulated)
      : null;

    const scenario = {
      scenarioId: generateId('SCN'),
      type: 'SIMULATE',
      sequence,
      result: result.simulated,
      score: result.score,
      kpis: result.kpis,
      comparison,
      createdAt: new Date().toISOString(),
    };

    const { timelineStart, timelineEnd } = this._timelineForOrders(
      result.simulated,
      startAnchor || sequence[0]?.plannedStartDate,
      planningHorizon,
    );

    scenario.ganttTasks = this.sequencer.toGanttTasks(result.simulated, timelineStart, timelineEnd);
    scenario.timelineStart = timelineStart;
    scenario.timelineEnd = timelineEnd;

    if (persistScenario) this._appendScenario(scenario);
    return scenario;
  }

  optimize({ startAnchor = '2026-09-01', persistScenario = true, horizonDays = null } = {}) {
    this._refreshSequencer();
    const rough = this._roughOrders();
    const baseline = this.getOrders().orders;
    const planningHorizon = horizonDays ?? getDefaultHorizonDays();

    const result = this.sequencer.optimize(
      rough,
      this._lines(planningHorizon),
      this._calendars(),
      this._batches(),
      this._rules(),
      startAnchor,
      planningHorizon,
    );

    const comparison = this.impact.compare(
      baseline,
      result.optimized.filter((o) => o.planningStatus === 'OPTIMIZED')
    );

    const { timelineStart, timelineEnd } = this._timelineForOrders(
      result.optimized,
      startAnchor,
      planningHorizon,
    );

    const scenario = {
      scenarioId: generateId('SCN'),
      type: 'OPTIMIZE',
      optimized: result.optimized,
      ganttTasks: this.sequencer.toGanttTasks(result.optimized, timelineStart, timelineEnd),
      timelineStart,
      timelineEnd,
      score: result.score,
      kpis: result.kpis,
      comparison,
      planningHorizon: {
        horizonDays: planningHorizon,
        performanceMode: resolvePerformanceHorizonMode(planningHorizon),
      },
      createdAt: new Date().toISOString(),
    };

    if (persistScenario) this._appendScenario(scenario);
    return scenario;
  }

  saveSequence({ sequence, label = 'Plant optimized sequence', userId = 'SYSTEM' }) {
    const sim = this.simulate({ sequence, compareToBaseline: true, persistScenario: false });

    if (isShadowPlanningEnabled()) {
      return this.draftSchedules.saveDraftFromSimulation({
        sim,
        label,
        userId: userId || 'SYSTEM',
      });
    }

    const schedule = {
      scheduleId: generateId('SCH'),
      plantId: '1000',
      label,
      status: 'SAVED',
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
        this.provider.updateOrder(poId, {
          plannedStartDate: item.plannedStartDate,
          plannedEndDate: item.plannedEndDate,
          productionLine: item.productionLine,
        });
      } catch { /* rough-only orders may not exist in orders.json */ }
    }

    return {
      saved: true,
      scheduleId: schedule.scheduleId,
      itemCount: schedule.items.length,
      comparison: sim.comparison,
      kpis: sim.kpis,
    };
  }

  _appendScenario(scenario) {
    const data = this._read('sequenceScenarios');
    const slim = {
      scenarioId: scenario.scenarioId,
      type: scenario.type,
      score: scenario.score,
      kpis: scenario.kpis,
      timelineStart: scenario.timelineStart,
      timelineEnd: scenario.timelineEnd,
      itemCount: (scenario.optimized || scenario.result || []).length,
      createdAt: scenario.createdAt,
    };
    data.items = [slim, ...(data.items || [])].slice(0, 20);
    this._write('sequenceScenarios', data);
  }
}

module.exports = { LineOptimizationService };
