/** Gantt time scale — day / shift (8h) / hour positioning (anchor 06:00). */

import { daysBetween } from '@/utils/dateHelpers';

export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 22;
export const SHIFT_HOURS = 8;

export const GRANULARITY_OPTIONS = [
  { label: 'Day', value: 'day' },
  { label: 'Shift (8h)', value: 'shift' },
  { label: 'Hour', value: 'hour' },
];

/**
 * Parse date (YYYY-MM-DD) or datetime to Date (local interpretation via ISO slice).
 */
export function parseGanttInstant(str, defaultHour = DAY_START_HOUR) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.includes('T')) return new Date(s);
  return new Date(`${s.slice(0, 10)}T${String(defaultHour).padStart(2, '0')}:00:00`);
}

export function toDateOnly(dt) {
  if (!dt) return '';
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toISOString().slice(0, 10);
}

export function toDateTimeLocal(dt) {
  if (!dt) return '';
  const d = dt instanceof Date ? dt : new Date(dt);
  const date = d.toISOString().slice(0, 10);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${date}T${h}:${m}:00`;
}

export function hoursBetween(fromStr, toStr) {
  const a = parseGanttInstant(fromStr, DAY_START_HOUR);
  const b = parseGanttInstant(toStr, DAY_START_HOUR);
  if (!a || !b) return 0;
  return (b.getTime() - a.getTime()) / 3600000;
}

export function resolveTaskStart(task) {
  if (task.plannedStartDateTime) return task.plannedStartDateTime;
  if (task.start?.includes?.('T')) return task.start;
  const date = task.start || task.plannedStartDate;
  if (!date) return null;
  return `${String(date).slice(0, 10)}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00`;
}

export function resolveTaskEnd(task) {
  if (task.plannedEndDateTime) return task.plannedEndDateTime;
  if (task.end?.includes?.('T')) return task.end;
  const start = resolveTaskStart(task);
  if (task.durationHours != null && start) {
    const s = parseGanttInstant(start);
    s.setTime(s.getTime() + Number(task.durationHours) * 3600000);
    return toDateTimeLocal(s);
  }
  const endDate = task.end || task.plannedEndDate || task.start || task.plannedStartDate;
  if (!endDate) return start;
  const day = String(endDate).slice(0, 10);
  return `${day}T${String(DAY_END_HOUR).padStart(2, '0')}:00:00`;
}

export function timelineWindow(timelineStart, timelineEnd, granularity = 'day') {
  const startDt = parseGanttInstant(timelineStart, DAY_START_HOUR);
  const endDay = String(timelineEnd || timelineStart).slice(0, 10);
  const endDt = parseGanttInstant(endDay, DAY_END_HOUR);

  if (granularity === 'day') {
    const totalDays = Math.max(1, daysBetween(timelineStart, endDay) + 1);
    return {
      granularity,
      timelineStartDt: startDt,
      timelineEndDt: endDt,
      totalUnits: totalDays,
      unitLabel: 'd',
      hoursPerUnit: 24,
    };
  }

  const totalHours = Math.max(1, Math.ceil((endDt.getTime() - startDt.getTime()) / 3600000));
  if (granularity === 'shift') {
    return {
      granularity,
      timelineStartDt: startDt,
      timelineEndDt: endDt,
      totalUnits: Math.max(1, Math.ceil(totalHours / SHIFT_HOURS)),
      unitLabel: 'shift',
      hoursPerUnit: SHIFT_HOURS,
    };
  }

  return {
    granularity,
    timelineStartDt: startDt,
    timelineEndDt: endDt,
    totalUnits: totalHours,
    unitLabel: 'h',
    hoursPerUnit: 1,
  };
}

export function taskOffsetUnits(task, window) {
  const start = resolveTaskStart(task);
  if (!start || !window.timelineStartDt) return 0;
  const hours = (parseGanttInstant(start).getTime() - window.timelineStartDt.getTime()) / 3600000;
  if (window.granularity === 'day') {
    return Math.max(0, Math.floor(hours / 24));
  }
  if (window.granularity === 'shift') {
    return Math.max(0, Math.floor(hours / SHIFT_HOURS));
  }
  return Math.max(0, Math.floor(hours));
}

export function taskDurationUnits(task, window) {
  const start = resolveTaskStart(task);
  const end = resolveTaskEnd(task);
  if (!start || !end) return 1;
  const hours = Math.max(
    window.granularity === 'hour' ? 1 : window.hoursPerUnit,
    (parseGanttInstant(end).getTime() - parseGanttInstant(start).getTime()) / 3600000,
  );
  if (window.granularity === 'day') {
    return Math.max(1, daysBetween(toDateOnly(start), toDateOnly(end)) + 1);
  }
  if (window.granularity === 'shift') {
    return Math.max(1, Math.ceil(hours / SHIFT_HOURS));
  }
  return Math.max(1, Math.ceil(hours));
}

export function computeBarMetrics(task, timelineStart, timelineEnd, granularity = 'day') {
  const window = timelineWindow(timelineStart, timelineEnd, granularity);
  const offset = taskOffsetUnits(task, window);
  const duration = taskDurationUnits(task, window);
  return {
    leftPercent: Math.round((offset / window.totalUnits) * 1000) / 10,
    widthPercent: Math.max(
      granularity === 'hour' ? 0.8 : 4,
      Math.round((duration / window.totalUnits) * 1000) / 10,
    ),
    offsetUnits: offset,
    durationUnits: duration,
    totalUnits: window.totalUnits,
    granularity,
  };
}

export function buildTimelineTicks(timelineStart, timelineEnd, granularity = 'day', maxTicks = 24) {
  const window = timelineWindow(timelineStart, timelineEnd, granularity);
  const ticks = [];
  const step = Math.max(1, Math.ceil(window.totalUnits / maxTicks));

  for (let i = 0; i <= window.totalUnits; i += step) {
    const dt = new Date(window.timelineStartDt.getTime());
    if (granularity === 'day') {
      dt.setDate(dt.getDate() + i);
      ticks.push({
        index: i,
        leftPercent: Math.round((i / window.totalUnits) * 1000) / 10,
        label: dt.toISOString().slice(0, 10),
      });
    } else if (granularity === 'shift') {
      dt.setTime(dt.getTime() + i * SHIFT_HOURS * 3600000);
      ticks.push({
        index: i,
        leftPercent: Math.round((i / window.totalUnits) * 1000) / 10,
        label: `${toDateOnly(dt)} ${String(dt.getHours()).padStart(2, '0')}:00`,
      });
    } else {
      dt.setTime(dt.getTime() + i * 3600000);
      ticks.push({
        index: i,
        leftPercent: Math.round((i / window.totalUnits) * 1000) / 10,
        label: `${toDateOnly(dt)} ${String(dt.getHours()).padStart(2, '0')}:00`,
      });
    }
  }
  return ticks;
}

export function offsetToDateTime(timelineStart, unitOffset, granularity = 'day') {
  const startDt = parseGanttInstant(timelineStart, DAY_START_HOUR);
  const dt = new Date(startDt.getTime());
  if (granularity === 'day') {
    dt.setDate(dt.getDate() + unitOffset);
  } else if (granularity === 'shift') {
    dt.setTime(dt.getTime() + unitOffset * SHIFT_HOURS * 3600000);
  } else {
    dt.setTime(dt.getTime() + unitOffset * 3600000);
  }
  return {
    plannedStartDate: toDateOnly(dt),
    plannedStartDateTime: toDateTimeLocal(dt),
  };
}

export function tasksHaveDateTime(tasks) {
  return (tasks || []).some(
    (t) => t.plannedStartDateTime || t.plannedEndDateTime
      || (t.start && String(t.start).includes('T')),
  );
}
