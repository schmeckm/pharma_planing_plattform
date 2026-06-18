const { addDays, daysBetween, todayISO } = require('../utils/dateUtils');

const MAX_AVAILABILITY_SPAN_DAYS = parseInt(process.env.MAX_AVAILABILITY_SPAN_DAYS || '366', 10);

class CapacityPlanningEngine {
  _effectiveCapacity(line, maxUnits) {
    const factor = line?.performanceFactor ?? 1;
    const clamped = Math.min(1.5, Math.max(0.5, Number(factor) || 1));
    return Math.round(maxUnits * clamped);
  }

  buildHeatmap(orders, lines, calendars, horizonDays = 14) {
    const startDate = todayISO();
    const heatmap = [];
    const lineMap = Object.fromEntries(lines.map((l) => [l.lineId, l]));

    for (let d = 0; d < horizonDays; d++) {
      const date = addDays(startDate, d);
      for (const line of lines) {
        const cal = calendars.find((c) => c.lineId === line.lineId && this._dateInWeek(date, c.weekStarting));
        const maintenance = (cal?.plannedMaintenance || []).some((m) => m.date === date);
        const baseMax = cal?.maxUnitsPerDay || line.capacityUnitsPerDay || 8000;
        const maxUnits = this._effectiveCapacity(line, baseMax);

        const dayOrders = orders.filter(
          (o) => o.productionLine === line.lineId
            && o.status === 'OPEN'
            && date >= o.plannedStartDate
            && date <= (o.plannedEndDate || o.plannedStartDate)
        );
        const allocatedUnits = dayOrders.reduce((s, o) => {
          const span = Math.max(1, daysBetween(o.plannedStartDate, o.plannedEndDate || o.plannedStartDate) + 1);
          return s + Math.ceil(o.quantity / span);
        }, 0);

        const utilizationPercent = maintenance
          ? 0
          : Math.min(100, Math.round((allocatedUnits / maxUnits) * 1000) / 10);

        heatmap.push({
          date,
          lineId: line.lineId,
          lineName: line.lineName,
          allocatedUnits,
          maxUnits,
          utilizationPercent,
          maintenance,
          status: maintenance ? 'MAINTENANCE' : utilizationPercent > 90 ? 'BOTTLENECK' : utilizationPercent > 75 ? 'HIGH' : 'OK',
        });
      }
    }

    const bottlenecks = heatmap.filter((h) => h.status === 'BOTTLENECK');
    const lineUtilization = lines.map((line) => {
      const cells = heatmap.filter((h) => h.lineId === line.lineId && !h.maintenance);
      const avg = cells.length
        ? Math.round(cells.reduce((s, c) => s + c.utilizationPercent, 0) / cells.length * 10) / 10
        : 0;
      return { lineId: line.lineId, lineName: line.lineName, avgUtilizationPercent: avg };
    });

    return {
      horizonDays,
      startDate,
      heatmap,
      lineUtilization,
      bottlenecks,
      summary: {
        peakUtilization: Math.max(...heatmap.map((h) => h.utilizationPercent), 0),
        maintenanceDays: heatmap.filter((h) => h.maintenance).length,
        bottleneckDays: bottlenecks.length,
      },
    };
  }

  _dateInWeek(dateStr, weekStart) {
    if (!weekStart) return true;
    const diff = daysBetween(weekStart, dateStr);
    return diff >= 0 && diff < 7;
  }

  checkLineAvailability(lineId, startDate, endDate, calendars, lines) {
    const line = lines.find((l) => l.lineId === lineId);
    if (!line) return { available: false, reason: 'Line not found' };

    const spanDays = daysBetween(startDate, endDate) + 1;
    if (spanDays > MAX_AVAILABILITY_SPAN_DAYS) {
      return {
        lineId,
        available: false,
        conflicts: [{ reason: `Slot span ${spanDays} days exceeds ${MAX_AVAILABILITY_SPAN_DAYS}-day limit` }],
        capacityUnitsPerDay: this._effectiveCapacity(line, line.capacityUnitsPerDay),
        performanceFactor: line.performanceFactor ?? 1,
      };
    }

    let d = startDate;
    const conflicts = [];
    while (d <= endDate) {
      const cal = calendars.find((c) => c.lineId === lineId && this._dateInWeek(d, c.weekStarting));
      const maint = (cal?.plannedMaintenance || []).find((m) => m.date === d);
      if (maint) conflicts.push({ date: d, reason: maint.reason });
      d = addDays(d, 1);
    }

    return {
      lineId,
      available: conflicts.length === 0,
      conflicts,
      capacityUnitsPerDay: this._effectiveCapacity(line, line.capacityUnitsPerDay),
      performanceFactor: line.performanceFactor ?? 1,
    };
  }
}

module.exports = { CapacityPlanningEngine };
