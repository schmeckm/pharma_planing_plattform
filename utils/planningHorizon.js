const { addDays } = require('./dateUtils');

const MIN_HORIZON_DAYS = 7;
const MAX_HORIZON_DAYS = 365;

function parseHorizonDays(value, fallback = null) {
  const envDefault = parseInt(process.env.SCHEDULING_HORIZON_DAYS || '14', 10);
  const base = Number.isFinite(fallback) ? fallback : envDefault;
  if (value == null || value === '') return base;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return base;
  return Math.min(MAX_HORIZON_DAYS, Math.max(MIN_HORIZON_DAYS, n));
}

function getDefaultHorizonDays() {
  return parseInt(process.env.SCHEDULING_HORIZON_DAYS || '14', 10);
}

function parseControlTowerHorizonOptions() {
  const raw = process.env.CONTROL_TOWER_HORIZON_OPTIONS || '7,30,90';
  return raw
    .split(',')
    .map((part) => parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= MAX_HORIZON_DAYS);
}

function getControlTowerHorizonDefault() {
  const options = parseControlTowerHorizonOptions();
  const envDefault = parseInt(process.env.CONTROL_TOWER_HORIZON_DEFAULT || '7', 10);
  if (options.includes(envDefault)) return envDefault;
  return options[0] || 7;
}

function parseControlTowerHorizon(value, fallback = null) {
  const base = fallback ?? getControlTowerHorizonDefault();
  if (value == null || value === '') return base;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return base;
  return Math.min(MAX_HORIZON_DAYS, Math.max(1, n));
}

function getPerformanceShortDays() {
  return parseInt(process.env.PERFORMANCE_SHORT_HORIZON_DAYS || '30', 10);
}

function getPerformanceLongDays() {
  return parseInt(process.env.PERFORMANCE_LONG_HORIZON_DAYS || '365', 10);
}

function getPerformanceLongThreshold() {
  return parseInt(process.env.PERFORMANCE_HORIZON_LONG_THRESHOLD || '14', 10);
}

/** Kurzfrist vs. langfrist OEE/Leistungsfaktor (sequencing vs. capacity). */
function resolvePerformanceHorizonMode(horizonDays = null) {
  const days = horizonDays != null ? horizonDays : getDefaultHorizonDays();
  return days > getPerformanceLongThreshold() ? 'long' : 'short';
}

/** Heuristik: max. Platzierungsversuche pro Linie = Planungshorizont in Tagen. */
function getHeuristicPlacementAttempts(horizonDays = null) {
  return parseHorizonDays(horizonDays);
}

/** Gantt axis: planning start + horizon (extends if orders end later). */
function resolveGanttTimeline({ startAnchor, horizonDays, orderEndDates = [] } = {}) {
  const start = startAnchor || '2026-09-01';
  const days = parseHorizonDays(horizonDays);
  let end = addDays(start, days - 1);
  for (const d of orderEndDates) {
    if (d && String(d).slice(0, 10) > end) end = String(d).slice(0, 10);
  }
  return { timelineStart: start, timelineEnd: end };
}

function getHorizonSettings() {
  const controlTowerOptions = parseControlTowerHorizonOptions();
  const schedulingDefault = getDefaultHorizonDays();
  const performanceThreshold = getPerformanceLongThreshold();
  return {
    scheduling: {
      defaultDays: schedulingDefault,
      minDays: MIN_HORIZON_DAYS,
      maxDays: MAX_HORIZON_DAYS,
      envVar: 'SCHEDULING_HORIZON_DAYS',
    },
    controlTower: {
      defaultDays: getControlTowerHorizonDefault(),
      options: controlTowerOptions,
      envVars: {
        default: 'CONTROL_TOWER_HORIZON_DEFAULT',
        options: 'CONTROL_TOWER_HORIZON_OPTIONS',
      },
    },
    performance: {
      shortDays: getPerformanceShortDays(),
      longDays: getPerformanceLongDays(),
      longThresholdDays: performanceThreshold,
      modeForSchedulingDefault: resolvePerformanceHorizonMode(schedulingDefault),
      envVars: {
        short: 'PERFORMANCE_SHORT_HORIZON_DAYS',
        long: 'PERFORMANCE_LONG_HORIZON_DAYS',
        threshold: 'PERFORMANCE_HORIZON_LONG_THRESHOLD',
      },
    },
    heuristic: {
      placementAttemptsFrom: 'schedulingHorizonDays',
      defaultPlacementAttempts: getHeuristicPlacementAttempts(),
    },
  };
}

module.exports = {
  parseHorizonDays,
  getDefaultHorizonDays,
  parseControlTowerHorizon,
  parseControlTowerHorizonOptions,
  getControlTowerHorizonDefault,
  getPerformanceShortDays,
  getPerformanceLongDays,
  getPerformanceLongThreshold,
  resolvePerformanceHorizonMode,
  getHeuristicPlacementAttempts,
  resolveGanttTimeline,
  getHorizonSettings,
  MIN_HORIZON_DAYS,
  MAX_HORIZON_DAYS,
};
