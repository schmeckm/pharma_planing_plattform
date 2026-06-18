const fs = require('fs');
const path = require('path');
const { addDays, daysBetween } = require('../utils/dateUtils');
const { SapOperationsImportService } = require('../services/sapOperationsImportService');
const { OrtoolsOperationOptimizer } = require('../services/scheduling/ortoolsOperationOptimizer');

const HOURS_PER_DAY = parseInt(process.env.PLANNING_HOURS_PER_DAY || '8', 10) * 2;

/**
 * Multi-operation planning: routing expansion, bottleneck-first scheduling,
 * work-center capacity (hard) separate from OEE/performanceFactor (throughput).
 */
class OperationPlanningEngine {
  constructor(dataDir = null) {
    this._dir = dataDir || process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
    this._sapImport = new SapOperationsImportService(this._dir);
    this._opOptimizer = new OrtoolsOperationOptimizer();
  }

  _read(name) {
    try {
      return JSON.parse(fs.readFileSync(path.join(this._dir, `${name}.json`), 'utf-8'));
    } catch {
      return { items: [] };
    }
  }

  loadWorkCenters() {
    return this._read('workCenters').items || [];
  }

  loadRoutings() {
    return this._read('operationRoutings');
  }

  _routingForOrder(order) {
    const routings = this.loadRoutings();
    const material = order.material || order.materialNumber || '';
    for (const [prefix, steps] of Object.entries(routings.byMaterialPrefix || {})) {
      if (material.startsWith(prefix)) return steps;
    }
    return routings.default || [];
  }

  _hoursToDays(hours, workCenter) {
    const perf = workCenter?.performanceFactor || 1;
    const adjusted = hours / Math.max(0.5, Math.min(1.5, perf));
    return Math.max(1, Math.ceil(adjusted / HOURS_PER_DAY));
  }

  expandOrderOperations(order) {
    const packagingLine = order.productionLine || order.preferredLine || 'PACK_LINE_01';
    const totalHours = order.durationHours || 16;
    const steps = this._routingForOrder(order);
    const poId = order.packagingOrder || order.packagingOrderId;

    return steps.map((step) => {
      const wcId = (step.workCenterId || '').replace('{{packagingLine}}', packagingLine);
      const hours = Math.max(1, Math.round(totalHours * (step.durationShare || 0.33)));
      return {
        operationId: `${poId}-OP${step.operationNo}`,
        packagingOrder: poId,
        packagingOrderId: poId,
        operationNo: step.operationNo,
        operationName: step.operationName,
        workCenterId: wcId,
        isBottleneck: !!step.isBottleneck,
        durationHours: hours,
        durationDays: null,
        plannedStartDate: null,
        plannedEndDate: null,
        destinationCountry: order.destinationCountry,
        priority: order.priority,
        quantity: order.quantity,
        materialNumber: order.material || order.materialNumber,
      };
    });
  }

  /**
   * Phase 5 — SAP import + OR-Tools finite scheduling across all work centers.
   */
  async buildOperationSchedule(orders, { startAnchor = null, horizonDays = 14 } = {}) {
    const workCenters = this.loadWorkCenters();
    const wcMap = Object.fromEntries(workCenters.map((w) => [w.workCenterId, w]));
    const anchor = startAnchor || orders[0]?.plannedStartDate || '2026-09-01';
    const imported = this._sapImport.importForOrders(orders);

    const enrichedOrders = imported.orders.map((order) => {
      const ops = (order.operations || []).map((op) => ({
        ...op,
        requestedDeliveryDate: op.requestedDeliveryDate || order.requestedDeliveryDate,
        priority: op.priority || order.priority,
      }));
      return { ...order, operations: ops };
    });

    const allOperations = enrichedOrders.flatMap((o) => o.operations);
    const solverMode = process.env.OPERATIONS_SOLVER || 'ortools';
    let solverMeta = {
      phase: 5,
      routingSource: imported.summary,
      solverEngine: 'heuristic-bottleneck',
      solverStatus: 'HEURISTIC',
      ortoolsFallback: false,
    };

    let scheduledOps = allOperations;

    if (solverMode === 'ortools' && allOperations.length > 0) {
      try {
        const result = await this._opOptimizer.optimize({
          operations: allOperations,
          workCenters,
          startAnchor: anchor,
          horizonDays,
        });
        if (result.operations?.length) {
          scheduledOps = result.operations;
          solverMeta = {
            phase: 5,
            routingSource: imported.summary,
            solverEngine: result.engine,
            solverStatus: result.solverStatus,
            ortoolsFallback: false,
            runtimeMs: result.runtimeMs,
            score: result.score,
          };
        }
      } catch (err) {
        if (process.env.OPERATIONS_ORTOOLS_REQUIRED === 'true') throw err;
        const heuristic = this._scheduleImportedHeuristic(enrichedOrders, { startAnchor: anchor, wcMap });
        scheduledOps = heuristic.operations;
        solverMeta = {
          phase: 5,
          routingSource: imported.summary,
          solverEngine: 'heuristic-bottleneck',
          solverStatus: 'FALLBACK',
          ortoolsFallback: true,
          ortoolsError: err.message,
        };
      }
    } else {
      const heuristic = this._scheduleImportedHeuristic(enrichedOrders, { startAnchor: anchor, wcMap });
      scheduledOps = heuristic.operations;
    }

    const opById = Object.fromEntries(scheduledOps.map((o) => [o.operationId, o]));
    for (const order of enrichedOrders) {
      order.operations = (order.operations || []).map((op) => opById[op.operationId] || op);
      const bottleneckOp = order.operations.find((o) => o.isBottleneck);
      order.bottleneckWorkCenter = bottleneckOp?.workCenterId || null;
      order.bottleneckStart = bottleneckOp?.plannedStartDate;
      order.bottleneckEnd = bottleneckOp?.plannedEndDate;
    }

    return {
      operations: scheduledOps,
      orders: enrichedOrders,
      workCenters,
      bottleneckWorkCenters: workCenters.filter((w) => w.isBottleneck).map((w) => w.workCenterId),
      solverMeta,
    };
  }

  _scheduleImportedHeuristic(orders, { startAnchor, wcMap }) {
    const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const sorted = [...orders].sort((a, b) => {
      const pa = priorityRank[a.priority] ?? 2;
      const pb = priorityRank[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return (a.requestedDeliveryDate || '').localeCompare(b.requestedDeliveryDate || '');
    });

    const bottleneckTimeline = {};
    const allOperations = [];

    for (const order of sorted) {
      const ops = order.operations || [];
      const packagingLine = order.productionLine || order.preferredLine;
      const packOp = ops.find((o) => o.workCenterId === packagingLine) || ops[ops.length - 1];
      const packStart = order.plannedStartDate || startAnchor || '2026-09-01';
      const packEnd = order.plannedEndDate || packStart;
      const packDays = Math.max(1, daysBetween(packStart, packEnd) + 1);

      if (packOp) {
        packOp.plannedStartDate = packStart;
        packOp.plannedEndDate = packEnd;
        packOp.durationDays = packDays;
      }

      const beforePack = ops.filter((o) => packOp && o.operationNo < packOp.operationNo)
        .sort((a, b) => b.operationNo - a.operationNo);
      let cursor = packStart;

      for (const op of beforePack) {
        const wc = wcMap[op.workCenterId] || {};
        const days = this._hoursToDays(op.durationHours || 8, wc);
        op.durationDays = days;

        if (op.isBottleneck) {
          const wcId = op.workCenterId;
          if (!bottleneckTimeline[wcId]) bottleneckTimeline[wcId] = [];
          let start = addDays(cursor, -days);
          const conflict = this._findOverlap(bottleneckTimeline[wcId], start, addDays(start, days - 1));
          if (conflict) start = addDays(conflict.end, 1);
          op.plannedStartDate = start;
          op.plannedEndDate = addDays(start, days - 1);
          bottleneckTimeline[wcId].push({ start: op.plannedStartDate, end: op.plannedEndDate, order: order.packagingOrder });
          cursor = start;
        } else {
          op.plannedEndDate = addDays(cursor, -1);
          op.plannedStartDate = addDays(op.plannedEndDate, -(days - 1));
          cursor = op.plannedStartDate;
        }
      }

      for (const op of ops) {
        if (op.plannedStartDate) continue;
        const wc = wcMap[op.workCenterId] || {};
        const days = this._hoursToDays(op.durationHours || 8, wc);
        op.durationDays = days;
        op.plannedStartDate = packStart;
        op.plannedEndDate = addDays(packStart, days - 1);
      }

      allOperations.push(...ops);
    }

    return { operations: allOperations, orders: sorted };
  }

  /**
   * Bottleneck-first: schedule FILL (bottleneck) slots in priority order on shared WC,
   * then chain upstream/downstream ops; packaging op anchors to PO plan from line optimizer.
   */
  scheduleOperations(orders, { startAnchor = null } = {}) {
    const workCenters = this.loadWorkCenters();
    const wcMap = Object.fromEntries(workCenters.map((w) => [w.workCenterId, w]));
    const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };

    const sorted = [...orders].sort((a, b) => {
      const pa = priorityRank[a.priority] ?? 2;
      const pb = priorityRank[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return (a.requestedDeliveryDate || '').localeCompare(b.requestedDeliveryDate || '');
    });

    const bottleneckTimeline = {};
    const allOperations = [];

    for (const order of sorted) {
      const ops = this.expandOrderOperations(order);
      const packagingLine = order.productionLine || order.preferredLine;
      const packOp = ops.find((o) => o.workCenterId === packagingLine) || ops[ops.length - 1];
      const packStart = order.plannedStartDate || startAnchor || '2026-09-01';
      const packEnd = order.plannedEndDate || packStart;
      const packDays = Math.max(1, daysBetween(packStart, packEnd) + 1);

      packOp.plannedStartDate = packStart;
      packOp.plannedEndDate = packEnd;
      packOp.durationDays = packDays;
      packOp.durationHours = order.durationHours
        ? Math.round((order.durationHours || 16) * 0.4)
        : packDays * HOURS_PER_DAY;

      const beforePack = ops.filter((o) => o.operationNo < packOp.operationNo).sort((a, b) => b.operationNo - a.operationNo);
      let cursor = packStart;

      for (const op of beforePack) {
        const wc = wcMap[op.workCenterId] || {};
        const days = this._hoursToDays(op.durationHours || 8, wc);
        op.durationDays = days;

        if (op.isBottleneck) {
          const wcId = op.workCenterId;
          if (!bottleneckTimeline[wcId]) bottleneckTimeline[wcId] = [];
          let start = addDays(cursor, -days);
          const conflict = this._findOverlap(bottleneckTimeline[wcId], start, addDays(start, days - 1));
          if (conflict) {
            start = addDays(conflict.end, 1);
          }
          op.plannedStartDate = start;
          op.plannedEndDate = addDays(start, days - 1);
          bottleneckTimeline[wcId].push({ start: op.plannedStartDate, end: op.plannedEndDate, order: order.packagingOrder });
          cursor = start;
        } else {
          op.plannedEndDate = addDays(cursor, -1);
          op.plannedStartDate = addDays(op.plannedEndDate, -(days - 1));
          cursor = op.plannedStartDate;
        }
      }

      for (const op of ops) {
        if (op.plannedStartDate) continue;
        const wc = wcMap[op.workCenterId] || {};
        const days = this._hoursToDays(op.durationHours || 8, wc);
        op.durationDays = days;
        op.plannedStartDate = packStart;
        op.plannedEndDate = addDays(packStart, days - 1);
      }

      const bottleneckOp = ops.find((o) => o.isBottleneck);
      if (bottleneckOp && packOp.plannedStartDate < addDays(bottleneckOp.plannedEndDate, 1)) {
        order.operationCapacityConflict = true;
        bottleneckOp.capacityConflict = true;
      }

      order.operations = ops;
      order.bottleneckWorkCenter = bottleneckOp?.workCenterId || null;
      order.bottleneckStart = bottleneckOp?.plannedStartDate;
      order.bottleneckEnd = bottleneckOp?.plannedEndDate;
      allOperations.push(...ops);
    }

    return {
      operations: allOperations,
      orders: sorted,
      workCenters,
      bottleneckWorkCenters: workCenters.filter((w) => w.isBottleneck).map((w) => w.workCenterId),
    };
  }

  _findOverlap(slots, start, end) {
    for (const s of slots) {
      if (start <= s.end && end >= s.start) return s;
    }
    return null;
  }

  buildWorkCenterCapacity(operations, { horizonDays = 14, startDate = null } = {}) {
    const workCenters = this.loadWorkCenters();
    const anchor = startDate || operations[0]?.plannedStartDate || '2026-09-01';
    const heatmap = [];
    const alerts = [];

    for (let d = 0; d < horizonDays; d++) {
      const date = addDays(anchor, d);
      for (const wc of workCenters) {
        const dayOps = operations.filter(
          (o) => o.workCenterId === wc.workCenterId
            && date >= o.plannedStartDate
            && date <= (o.plannedEndDate || o.plannedStartDate),
        );
        const usedHours = dayOps.reduce((s, o) => {
          const span = Math.max(1, daysBetween(o.plannedStartDate, o.plannedEndDate || o.plannedStartDate) + 1);
          return s + (o.durationHours || HOURS_PER_DAY) / span;
        }, 0);
        const maxHours = wc.capacityHoursPerDay || HOURS_PER_DAY;
        const utilizationPercent = Math.min(100, Math.round((usedHours / maxHours) * 1000) / 10);
        const status = utilizationPercent > 90
          ? 'BOTTLENECK'
          : utilizationPercent > 75
            ? 'HIGH'
            : 'OK';

        heatmap.push({
          date,
          workCenterId: wc.workCenterId,
          workCenterName: wc.workCenterName,
          isBottleneck: !!wc.isBottleneck,
          usedHours: Math.round(usedHours * 10) / 10,
          maxHours,
          utilizationPercent,
          status,
          operationCount: dayOps.length,
        });

        if (status === 'BOTTLENECK' && wc.isBottleneck) {
          alerts.push({
            severity: 'HIGH',
            workCenterId: wc.workCenterId,
            workCenterName: wc.workCenterName,
            date,
            utilizationPercent,
            message: `Bottleneck ${wc.workCenterName} at ${utilizationPercent}% on ${date}`,
          });
        }
      }
    }

    const wcSummary = workCenters.map((wc) => {
      const cells = heatmap.filter((h) => h.workCenterId === wc.workCenterId);
      const avg = cells.length
        ? Math.round(cells.reduce((s, c) => s + c.utilizationPercent, 0) / cells.length * 10) / 10
        : 0;
      const peak = cells.length ? Math.max(...cells.map((c) => c.utilizationPercent)) : 0;
      return {
        workCenterId: wc.workCenterId,
        workCenterName: wc.workCenterName,
        isBottleneck: !!wc.isBottleneck,
        avgUtilizationPercent: avg,
        peakUtilizationPercent: peak,
      };
    });

    return {
      horizonDays,
      startDate: anchor,
      heatmap,
      workCenterUtilization: wcSummary,
      bottlenecks: heatmap.filter((h) => h.status === 'BOTTLENECK'),
      alerts: alerts.slice(0, 20),
      summary: {
        peakUtilization: Math.max(...heatmap.map((h) => h.utilizationPercent), 0),
        bottleneckDays: heatmap.filter((h) => h.status === 'BOTTLENECK').length,
        bottleneckAlerts: alerts.length,
      },
    };
  }

  toOperationGanttTasks(operations, timelineStart, timelineEnd) {
    const totalDays = Math.max(1, daysBetween(timelineStart, timelineEnd) + 1);
    return operations.map((op) => {
      const startOffset = daysBetween(timelineStart, op.plannedStartDate);
      const duration = Math.max(1, daysBetween(op.plannedStartDate, op.plannedEndDate) + 1);
      return {
        id: op.operationId,
        packagingOrderId: op.packagingOrder,
        operationNo: op.operationNo,
        operationName: op.operationName,
        name: `Op ${op.operationNo} · ${op.packagingOrder}`,
        workCenterId: op.workCenterId,
        productionLine: op.workCenterId,
        isBottleneck: op.isBottleneck,
        start: op.plannedStartDate,
        end: op.plannedEndDate,
        startOffset,
        duration,
        leftPercent: Math.round((startOffset / totalDays) * 1000) / 10,
        widthPercent: Math.round((duration / totalDays) * 1000) / 10,
        destinationCountry: op.destinationCountry,
        priority: op.priority,
        durationHours: op.durationHours,
      };
    });
  }

  workCentersAsSwimlanes() {
    return this.loadWorkCenters()
      .filter((w) => w.active !== false)
      .sort((a, b) => {
        if (a.isBottleneck && !b.isBottleneck) return -1;
        if (!a.isBottleneck && b.isBottleneck) return 1;
        return (a.workCenterId || '').localeCompare(b.workCenterId || '');
      })
      .map((w) => ({
        lineId: w.workCenterId,
        lineName: w.isBottleneck ? `⦿ ${w.workCenterName}` : w.workCenterName,
        isBottleneck: !!w.isBottleneck,
      }));
  }
}

module.exports = { OperationPlanningEngine };
