const fs = require('fs');
const path = require('path');
const {
  DetailedSchedulingEngine,
  WhatIfSimulator,
  PlannerAgent,
  MasterDataLoader,
} = require('../engines/detailedScheduling');
const { DraftScheduleService } = require('./draftScheduleService');
const { isShadowPlanningEnabled } = require('../utils/shadowPlanning');

let schedulingWsHub = null;

function setSchedulingWsHub(hub) {
  schedulingWsHub = hub;
}

class DetailedSchedulingService {
  constructor(dataDir = null) {
    this._dir = dataDir || process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
    this.engine = new DetailedSchedulingEngine(this._dir);
    this.whatIf = new WhatIfSimulator(this.engine);
    this.agent = new PlannerAgent();
    this.loader = new MasterDataLoader(this._dir);
    this.draftSchedules = new DraftScheduleService();
  }

  _readSchedules() {
    try {
      return JSON.parse(fs.readFileSync(path.join(this._dir, 'detailedSchedules.json'), 'utf-8'));
    } catch {
      return { schedules: [], activeScheduleId: null };
    }
  }

  _writeSchedules(data) {
    fs.writeFileSync(path.join(this._dir, 'detailedSchedules.json'), JSON.stringify(data, null, 2));
  }

  getMasterData() {
    const md = this.loader.loadAll();
    return {
      plants: md.plants,
      productionLines: md.productionLines,
      materials: md.materials,
      lineQualifications: md.lineQualifications,
      setupMatrix: md.setupMatrix,
      batchCount: md.batches.length,
      orderCount: md.productionOrders.length,
    };
  }

  getIntegrationCatalog() {
    return {
      description: 'Future SAP / MES integration endpoints (design stubs)',
      endpoints: [
        { system: 'SAP S/4HANA', method: 'POST', path: '/integration/sap/production-orders/import', purpose: 'Import process orders (AFKO/AFPO)' },
        { system: 'SAP Batch Management', method: 'GET', path: '/integration/sap/batches', purpose: 'Sync batch master & expiry' },
        { system: 'SAP QM', method: 'GET', path: '/integration/sap/inspection-lots', purpose: 'Inspection lot & usage decision' },
        { system: 'SAP EWM', method: 'GET', path: '/integration/sap/atp', purpose: 'Available-to-promise stock' },
        { system: 'SAP IBP', method: 'POST', path: '/integration/ibp/demand', purpose: 'Demand signal import' },
        { system: 'MES', method: 'POST', path: '/integration/mes/confirmations', purpose: 'Operation confirmations' },
        { system: 'LIMS', method: 'GET', path: '/integration/lims/results', purpose: 'QC release status' },
      ],
    };
  }

  async buildSchedule(options = {}) {
    const result = await this.engine.buildSchedule(options);
    const gantt = this.engine.toGanttPayload(result);
    const payload = { ...result, gantt };
    this._persistSchedule(payload);
    this._broadcast('SCHEDULE_BUILT', payload);
    return payload;
  }

  getActiveSchedule() {
    const store = this._readSchedules();
    const active = store.schedules.find((s) => s.scheduleId === store.activeScheduleId);
    return active || store.schedules[store.schedules.length - 1] || null;
  }

  async getDashboard() {
    const schedule = this.getActiveSchedule() || await this.buildSchedule();
    return {
      kpis: schedule.kpis,
      exceptions: schedule.exceptions.slice(0, 50),
      utilization: schedule.utilization,
      blockedOrders: schedule.blockedOrders,
      scheduledCount: schedule.scheduledOrders?.length || 0,
      scheduleId: schedule.scheduleId,
      timelineStart: schedule.startAnchor,
      timelineEnd: schedule.timelineEnd,
      granularity: schedule.granularity || 'hour',
      solver: schedule.solver || null,
    };
  }

  async runWhatIf(scenario) {
    const baseline = this.getActiveSchedule();
    if (!baseline) {
      throw new Error('No active schedule — run build first');
    }
    const baselineWithMd = { ...baseline, masterData: this.loader.loadAll() };
    const result = await this.whatIf.runScenario(baselineWithMd, scenario);
    this._broadcast('WHAT_IF_COMPLETE', result);
    return result;
  }

  confirmSchedule({
    label = 'Confirmed detailed schedule',
    userId = 'SYSTEM',
    scheduleId = null,
    draftScheduleId = null,
  } = {}) {
    const schedule = scheduleId
      ? this._readSchedules().schedules.find((s) => s.scheduleId === scheduleId)
      : this.getActiveSchedule();
    if (!schedule) throw new Error('No active schedule — run build first');

    if (!isShadowPlanningEnabled()) {
      return {
        confirmed: true,
        shadowPlanning: false,
        scheduleId: schedule.scheduleId,
        message: 'Shadow planning disabled — schedule remains in detailedSchedules.json only.',
      };
    }

    const result = this.draftSchedules.confirmDetailedSchedule({
      schedule,
      label,
      userId,
      draftScheduleId,
    });
    this._broadcast('SCHEDULE_CONFIRMED', result);
    return result;
  }

  rescheduleOrder(override) {
    const schedule = this.getActiveSchedule();
    if (!schedule) throw new Error('No active schedule — run build first');
    const result = this.engine.rescheduleOrder(schedule, override);
    if (result.success) {
      const orderNumber = override.orderNumber;
      schedule.scheduledOrders = (schedule.scheduledOrders || []).map((o) =>
        (o.orderNumber === orderNumber ? result.order : o),
      );
      schedule.ganttTasks = (schedule.ganttTasks || [])
        .filter((t) => t.orderNumber !== orderNumber && t.id !== `${orderNumber}-SETUP`)
        .concat(result.ganttTasks);
      schedule.gantt = this.engine.toGanttPayload(schedule);
      this._replaceActiveSchedule(schedule);
      this._broadcast('ORDER_RESCHEDULED', { ...result, schedule });
      return { ...result, schedule };
    }
    return result;
  }

  _replaceActiveSchedule(schedule) {
    const store = this._readSchedules();
    const idx = store.schedules.findIndex((s) => s.scheduleId === schedule.scheduleId);
    if (idx >= 0) {
      store.schedules[idx] = schedule;
    } else {
      store.schedules.push(schedule);
    }
    store.activeScheduleId = schedule.scheduleId;
    this._writeSchedules(store);
  }

  async explainBlockedOrder(orderNumber) {
    const md = this.loader.loadAll();
    const order = md.productionOrders.find((o) => o.orderNumber === orderNumber);
    if (!order) throw new Error(`Order ${orderNumber} not found`);
    const { EligibilityEngine } = require('../engines/detailedScheduling/eligibilityEngine');
    const eligibility = new EligibilityEngine(md).checkOrder(order, order.packagingLine);
    return this.agent.explainOrderBlock({
      order,
      eligibility,
      exceptions: eligibility.exceptions,
    });
  }

  async explainSchedule() {
    const schedule = this.getActiveSchedule();
    if (!schedule) return { explanation: 'No schedule available.' };
    return this.agent.explainSequence(schedule);
  }

  _persistSchedule(payload) {
    const store = this._readSchedules();
    store.schedules.push({
      scheduleId: payload.scheduleId,
      createdAt: payload.createdAt,
      kpis: payload.kpis,
      startAnchor: payload.startAnchor,
      timelineEnd: payload.timelineEnd,
      scheduledOrders: payload.scheduledOrders,
      blockedOrders: payload.blockedOrders,
      exceptions: payload.exceptions,
      ganttTasks: payload.ganttTasks,
      utilization: payload.utilization,
      explanation: payload.explanation,
      gantt: payload.gantt,
    });
    if (store.schedules.length > 20) store.schedules = store.schedules.slice(-20);
    store.activeScheduleId = payload.scheduleId;
    this._writeSchedules(store);
  }

  _broadcast(type, payload) {
    if (schedulingWsHub) {
      schedulingWsHub.broadcast({ type, payload, timestamp: new Date().toISOString() });
    }
  }
}

module.exports = { DetailedSchedulingService, setSchedulingWsHub };
