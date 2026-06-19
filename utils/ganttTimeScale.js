const { daysBetween } = require('./dateUtils');

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const SHIFT_HOURS = 8;

function parseInstant(str, defaultHour = DAY_START_HOUR) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.includes('T')) return new Date(s);
  return new Date(`${s.slice(0, 10)}T${String(defaultHour).padStart(2, '0')}:00:00`);
}

function resolveTaskStart(task) {
  if (task.plannedStartDateTime) return task.plannedStartDateTime;
  if (task.start && String(task.start).includes('T')) return task.start;
  const date = task.start || task.plannedStartDate;
  if (!date) return null;
  return `${String(date).slice(0, 10)}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00`;
}

function resolveTaskEnd(task) {
  if (task.plannedEndDateTime) return task.plannedEndDateTime;
  if (task.end && String(task.end).includes('T')) return task.end;
  const start = resolveTaskStart(task);
  if (task.durationHours != null && start) {
    const s = parseInstant(start);
    s.setTime(s.getTime() + Number(task.durationHours) * 3600000);
    const date = s.toISOString().slice(0, 10);
    const h = String(s.getHours()).padStart(2, '0');
    const m = String(s.getMinutes()).padStart(2, '0');
    return `${date}T${h}:${m}:00`;
  }
  const endDate = task.end || task.plannedEndDate || task.plannedStartDate;
  if (!endDate) return start;
  return `${String(endDate).slice(0, 10)}T${String(DAY_END_HOUR).padStart(2, '0')}:00:00`;
}

function timelineWindow(timelineStart, timelineEnd, granularity = 'day') {
  const startDt = parseInstant(timelineStart, DAY_START_HOUR);
  const endDay = String(timelineEnd || timelineStart).slice(0, 10);
  const endDt = parseInstant(endDay, DAY_END_HOUR);

  if (granularity === 'day') {
    const totalDays = Math.max(1, daysBetween(timelineStart, endDay) + 1);
    return { granularity, timelineStartDt: startDt, timelineEndDt: endDt, totalUnits: totalDays, hoursPerUnit: 24 };
  }

  const totalHours = Math.max(1, Math.ceil((endDt.getTime() - startDt.getTime()) / 3600000));
  if (granularity === 'shift') {
    return {
      granularity,
      timelineStartDt: startDt,
      timelineEndDt: endDt,
      totalUnits: Math.max(1, Math.ceil(totalHours / SHIFT_HOURS)),
      hoursPerUnit: SHIFT_HOURS,
    };
  }

  return {
    granularity,
    timelineStartDt: startDt,
    timelineEndDt: endDt,
    totalUnits: totalHours,
    hoursPerUnit: 1,
  };
}

function taskOffsetUnits(task, window) {
  const start = resolveTaskStart(task);
  if (!start) return 0;
  const hours = (parseInstant(start).getTime() - window.timelineStartDt.getTime()) / 3600000;
  if (window.granularity === 'day') return Math.max(0, Math.floor(hours / 24));
  if (window.granularity === 'shift') return Math.max(0, Math.floor(hours / SHIFT_HOURS));
  return Math.max(0, Math.floor(hours));
}

function taskDurationUnits(task, window) {
  const start = resolveTaskStart(task);
  const end = resolveTaskEnd(task);
  if (!start || !end) return 1;
  const hours = Math.max(
    window.hoursPerUnit,
    (parseInstant(end).getTime() - parseInstant(start).getTime()) / 3600000,
  );
  if (window.granularity === 'day') {
    return Math.max(1, daysBetween(start.slice(0, 10), end.slice(0, 10)) + 1);
  }
  if (window.granularity === 'shift') return Math.max(1, Math.ceil(hours / SHIFT_HOURS));
  return Math.max(1, Math.ceil(hours));
}

function computeBarMetrics(task, timelineStart, timelineEnd, granularity = 'day') {
  const window = timelineWindow(timelineStart, timelineEnd, granularity);
  const offset = taskOffsetUnits(task, window);
  const duration = taskDurationUnits(task, window);
  return {
    leftPercent: Math.round((offset / window.totalUnits) * 1000) / 10,
    widthPercent: Math.max(granularity === 'hour' ? 0.8 : 4, Math.round((duration / window.totalUnits) * 1000) / 10),
    granularity,
  };
}

function toGanttPayloadWithGranularity(scheduleResult, granularity = 'hour') {
  const lines = [...new Set(scheduleResult.ganttTasks.map((t) => t.lineId))].map((lineId) => ({
    lineId,
    lineName: lineId,
  }));
  const start = scheduleResult.startAnchor;
  const end = scheduleResult.timelineEnd;
  const hasDateTime = scheduleResult.ganttTasks.some(
    (t) => t.plannedStartDateTime || t.plannedEndDateTime,
  );
  const effectiveGranularity = hasDateTime ? granularity : 'day';

  const tasks = scheduleResult.ganttTasks.map((t) => {
    const metrics = computeBarMetrics(t, start, end, effectiveGranularity);
    return { ...t, id: t.id, ...metrics };
  });

  return {
    lines,
    tasks,
    timelineStart: start,
    timelineEnd: end,
    granularity: effectiveGranularity,
    hasDateTime,
  };
}

module.exports = {
  computeBarMetrics,
  toGanttPayloadWithGranularity,
  timelineWindow,
  DAY_START_HOUR,
};
