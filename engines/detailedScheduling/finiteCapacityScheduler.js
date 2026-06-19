const { addDays } = require('../../utils/dateUtils');

const DAY_START_HOUR = 6;

/**
 * Hour-level finite capacity scheduler.
 * Tracks load per line per absolute hour index from anchor (day 06:00).
 */
class FiniteCapacityScheduler {
  constructor(masterData, { hourGranularity = true } = {}) {
    this.md = masterData;
    this.hourGranularity = hourGranularity;
    this.lineLoad = {};
    this.lineState = {};
    this.anchorDate = null;
    this.maintenanceBlocks = this._buildMaintenanceMap();
  }

  _buildMaintenanceMap() {
    const map = {};
    for (const cal of this.md.lineCalendars || []) {
      const lineId = cal.lineId;
      if (!map[lineId]) map[lineId] = { hoursPerDay: 16, maintenanceByDate: {} };
      const hoursPerDay = cal.shiftPattern
        ? cal.shiftPattern.shifts * cal.shiftPattern.hoursPerShift
        : (cal.availableHours || 112) / 7;
      map[lineId].hoursPerDay = hoursPerDay;
      for (const m of cal.plannedMaintenance || []) {
        map[lineId].maintenanceByDate[m.date] = (map[lineId].maintenanceByDate[m.date] || 0) + (m.hours || 8);
      }
    }
    return map;
  }

  _lineMeta(lineId) {
    const line = this.md.lineById[lineId];
    const cal = this.maintenanceBlocks[lineId] || { hoursPerDay: 16, maintenanceByDate: {} };
    const perf = line?.performanceFactor || 1;
    return {
      hoursPerDay: Math.max(1, cal.hoursPerDay * perf),
      maintenanceByDate: cal.maintenanceByDate || {},
    };
  }

  _dateFromHourIndex(anchorDate, hourIndex) {
    const base = new Date(`${anchorDate}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00`);
    const dt = new Date(base.getTime() + hourIndex * 3600000);
    const date = dt.toISOString().slice(0, 10);
    const hour = dt.getHours();
    const time = `${String(hour).padStart(2, '0')}:00`;
    return { date, dateTime: `${date}T${time}:00`, hourIndex };
  }

  _hourIndexFromDate(anchorDate, dateStr, hour = DAY_START_HOUR) {
    const base = new Date(`${anchorDate}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00`);
    const dt = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
    return Math.max(0, Math.floor((dt - base) / 3600000));
  }

  _capacityForHour(lineId, anchorDate, hourIndex) {
    const { date } = this._dateFromHourIndex(anchorDate, hourIndex);
    const meta = this._lineMeta(lineId);
    const dailyCap = meta.hoursPerDay;
    const maint = meta.maintenanceByDate[date] || 0;
    const effectiveDaily = Math.max(0, dailyCap - maint);
    if (effectiveDaily <= 0) return 0;

    const dayStartIdx = this._hourIndexFromDate(anchorDate, date);
    const hourInDay = hourIndex - dayStartIdx;
    if (hourInDay < 0 || hourInDay >= Math.ceil(dailyCap)) return 0;

    const slotHours = Math.min(1, effectiveDaily / Math.ceil(dailyCap));
    const used = (this.lineLoad[lineId] || {})[hourIndex] || 0;
    return Math.max(0, slotHours - used);
  }

  _addHourLoad(lineId, hourIndex, hours) {
    if (!this.lineLoad[lineId]) this.lineLoad[lineId] = {};
    this.lineLoad[lineId][hourIndex] = (this.lineLoad[lineId][hourIndex] || 0) + hours;
  }

  findEarliestSlot(lineId, durationHours, setupHours, startAnchor) {
    this.anchorDate = startAnchor || this.anchorDate || new Date().toISOString().slice(0, 10);
    const totalNeeded = durationHours + setupHours;
    let hourIdx = this._hourIndexFromDate(this.anchorDate, startAnchor || this.anchorDate);
    let safety = 0;
    const maxHours = 24 * 365;

    while (safety < maxHours) {
      if (this._canPlace(lineId, hourIdx, totalNeeded)) {
        this._place(lineId, hourIdx, totalNeeded);
        const start = this._dateFromHourIndex(this.anchorDate, hourIdx);
        const end = this._dateFromHourIndex(this.anchorDate, hourIdx + Math.ceil(totalNeeded) - 1);
        return {
          startDate: start.date,
          endDate: end.date,
          scheduledStartDateTime: start.dateTime,
          scheduledEndDateTime: end.dateTime,
          setupHours,
          startHourIndex: hourIdx,
          durationHours: totalNeeded,
        };
      }
      hourIdx += 1;
      safety += 1;
    }

    const fallbackDate = addDays(this.anchorDate, Math.floor(hourIdx / 24));
    return {
      startDate: fallbackDate,
      endDate: addDays(fallbackDate, Math.ceil(durationHours / 16)),
      scheduledStartDateTime: `${fallbackDate}T06:00:00`,
      scheduledEndDateTime: `${fallbackDate}T22:00:00`,
      setupHours,
      overload: true,
    };
  }

  _canPlace(lineId, startHourIdx, totalHours) {
    for (let h = 0; h < Math.ceil(totalHours); h += 1) {
      if (this._capacityForHour(lineId, this.anchorDate, startHourIdx + h) < Math.min(1, totalHours - h)) {
        return false;
      }
    }
    return true;
  }

  _place(lineId, startHourIdx, totalHours) {
    let remaining = totalHours;
    let idx = startHourIdx;
    while (remaining > 0) {
      const chunk = Math.min(1, remaining);
      this._addHourLoad(lineId, idx, chunk);
      remaining -= chunk;
      idx += 1;
    }
  }

  scheduleOrder(order, lineId, setupHours, startAnchor) {
    this.anchorDate = startAnchor || order.plannedStartDate || new Date().toISOString().slice(0, 10);
    const slot = this.findEarliestSlot(
      lineId,
      order.productionDurationHours,
      setupHours,
      startAnchor || order.plannedStartDate,
    );

    this.lineState[lineId] = { lastColor: order.colorFamily, lastOrder: order.orderNumber };

    return {
      ...order,
      assignedLine: lineId,
      setupHours,
      scheduledStartDate: slot.startDate,
      scheduledEndDate: slot.endDate,
      scheduledStartDateTime: slot.scheduledStartDateTime,
      scheduledEndDateTime: slot.scheduledEndDateTime,
      startHourIndex: slot.startHourIndex,
      capacityOverload: !!slot.overload,
    };
  }

  getUtilization() {
    const result = [];
    for (const lineId of Object.keys(this.lineLoad)) {
      const meta = this._lineMeta(lineId);
      let peak = 0;
      let totalUsed = 0;
      let totalCap = 0;
      const byDate = {};

      for (const [hourIdx, used] of Object.entries(this.lineLoad[lineId])) {
        totalUsed += used;
        const { date } = this._dateFromHourIndex(this.anchorDate || '2026-09-01', Number(hourIdx));
        if (!byDate[date]) byDate[date] = { used: 0, cap: meta.hoursPerDay };
        byDate[date].used += used;
      }

      for (const d of Object.keys(byDate)) {
        const maint = meta.maintenanceByDate[d] || 0;
        const cap = Math.max(0, meta.hoursPerDay - maint);
        totalCap += cap;
        peak = Math.max(peak, cap > 0 ? (byDate[d].used / cap) * 100 : 0);
      }

      result.push({
        lineId,
        peakUtilizationPercent: Math.round(peak * 10) / 10,
        avgUtilizationPercent: totalCap > 0 ? Math.round((totalUsed / totalCap) * 1000) / 10 : 0,
        granularity: 'hour',
      });
    }
    return result;
  }
}

module.exports = { FiniteCapacityScheduler, DAY_START_HOUR };
