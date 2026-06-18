const { resolveShift, analyzeOrderMetrics, SHIFT_LABELS } = require('../engines/historicalOrderPerformanceEngine');
const { addDays, daysBetween } = require('../utils/dateUtils');

function resolveActualShift(order) {
  const actual = order.actualShiftId || order.shiftId || order.plannedShiftId;
  if (!actual) return { shiftId: 'UNKNOWN', shiftName: SHIFT_LABELS.UNKNOWN };
  return {
    shiftId: actual,
    shiftName: order.actualShiftName || order.shiftName || SHIFT_LABELS[actual] || actual,
  };
}

class ShiftHistoryService {
  static buildTimeline(orders = [], lines = [], options = {}) {
    const referenceDate = options.referenceDate || new Date().toISOString().slice(0, 10);
    const windowDays = options.windowDays ?? 365;
    const cutoff = addDays(referenceDate, -windowDays);

    const lineMap = Object.fromEntries(lines.map((l) => [l.lineId, l]));
    const completed = orders.filter(
      (o) => o.status === 'COMPLETED' && o.actualStartDate && o.actualEndDate,
    );

    const entries = [];
    for (const order of completed) {
      if (order.actualEndDate < cutoff) continue;
      const planned = resolveShift(order);
      const actual = resolveActualShift(order);
      const cap = lineMap[order.productionLine]?.capacityUnitsPerDay;
      const metrics = analyzeOrderMetrics(order, cap);
      entries.push({
        packagingOrderId: order.packagingOrderId,
        productionLine: order.productionLine,
        lineName: lineMap[order.productionLine]?.lineName || order.productionLine,
        materialNumber: order.materialNumber,
        quantity: order.quantity,
        plannedShiftId: planned.shiftId,
        plannedShiftName: planned.shiftName,
        actualShiftId: actual.shiftId,
        actualShiftName: actual.shiftName,
        shiftMatch: planned.shiftId === actual.shiftId,
        actualStartDate: order.actualStartDate,
        actualEndDate: order.actualEndDate,
        oee: metrics?.oee ?? null,
        performanceFactor: metrics?.performanceFactor ?? null,
        onTime: metrics?.onTime ?? null,
      });
    }

    entries.sort((a, b) => (b.actualEndDate || '').localeCompare(a.actualEndDate || ''));

    const byPeriodShift = ShiftHistoryService._aggregatePeriods(entries);
    const byLineShift = ShiftHistoryService._aggregateLineShift(entries);

    return {
      referenceDate,
      windowDays,
      totalEntries: entries.length,
      shiftMismatchCount: entries.filter((e) => !e.shiftMatch && e.plannedShiftId !== 'UNKNOWN').length,
      timeline: entries.slice(0, options.limit ?? 200),
      byPeriodShift,
      byLineShift,
    };
  }

  static _aggregatePeriods(entries) {
    const groups = {};
    for (const e of entries) {
      const period = (e.actualEndDate || '').slice(0, 7);
      if (!period) continue;
      const key = `${period}::${e.actualShiftId}::${e.productionLine}`;
      if (!groups[key]) {
        groups[key] = {
          period,
          shiftId: e.actualShiftId,
          shiftName: e.actualShiftName,
          lineId: e.productionLine,
          lineName: e.lineName,
          runs: 0,
          oeeSum: 0,
          qty: 0,
          onTime: 0,
        };
      }
      groups[key].runs += 1;
      groups[key].qty += e.quantity || 0;
      if (e.oee != null) groups[key].oeeSum += e.oee;
      if (e.onTime) groups[key].onTime += 1;
    }
    return Object.values(groups)
      .map((g) => ({
        ...g,
        averageOee: g.runs ? Math.round(g.oeeSum / g.runs) : null,
        onTimePercent: g.runs ? Math.round((g.onTime / g.runs) * 100) : null,
      }))
      .sort((a, b) => b.period.localeCompare(a.period));
  }

  static _aggregateLineShift(entries) {
    const groups = {};
    for (const e of entries) {
      const key = `${e.productionLine}::${e.actualShiftId}`;
      if (!groups[key]) {
        groups[key] = {
          lineId: e.productionLine,
          lineName: e.lineName,
          shiftId: e.actualShiftId,
          shiftName: e.actualShiftName,
          runs: 0,
          oeeSum: 0,
          mismatch: 0,
        };
      }
      groups[key].runs += 1;
      if (e.oee != null) groups[key].oeeSum += e.oee;
      if (!e.shiftMatch) groups[key].mismatch += 1;
    }
    return Object.values(groups).map((g) => ({
      ...g,
      averageOee: g.runs ? Math.round(g.oeeSum / g.runs) : null,
      shiftMismatchPercent: g.runs ? Math.round((g.mismatch / g.runs) * 100) : 0,
    }));
  }
}

module.exports = { ShiftHistoryService, resolveActualShift };
