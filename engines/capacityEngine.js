const { CapacityPlanningEngine } = require('./capacityPlanningEngine');

/** Capacity checks for line optimization (wraps capacity planning engine). */
class CapacityEngine {
  constructor() {
    this.planner = new CapacityPlanningEngine();
  }

  checkLineSlot(lineId, startDate, endDate, calendars, lines, existingOrders = []) {
    const availability = this.planner.checkLineAvailability(lineId, startDate, endDate, calendars, lines);
    const overlaps = existingOrders.filter(
      (o) => o.productionLine === lineId
        && o.plannedStartDate <= endDate
        && (o.plannedEndDate || o.plannedStartDate) >= startDate
    );
    return {
      ...availability,
      overlapCount: overlaps.length,
      feasible: availability.available && overlaps.length === 0,
    };
  }

  lineUtilization(orders, lines, calendars, horizonDays = 14) {
    return this.planner.buildHeatmap(orders, lines, calendars, horizonDays);
  }
}

module.exports = { CapacityEngine };
