/**
 * Historical Performance Repository — material × line performance metrics.
 * Line Score weights (enterprise spec):
 *   30% OEE | 25% Throughput | 20% Reliability | 15% Yield | 10% Setup Time
 *
 * Performance Factor (Leistungsfaktor) per line — operator/shift skill, current
 * line condition, ramp-up, degradation. Applied multiplicatively to throughput,
 * NOT folded into OEE so it stays independently auditable and editable.
 */
const LINE_SCORE_WEIGHTS = {
  oee: .3,
  throughput: .25,
  reliability: .2,
  yield: .15,
  setupTime: .1,
};

const PERFORMANCE_FACTOR_MIN = 0.5;
const PERFORMANCE_FACTOR_MAX = 1.5;
const PERFORMANCE_FACTOR_DEFAULT = 1.0;

function clampPerformanceFactor(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return PERFORMANCE_FACTOR_DEFAULT;
  return Math.min(PERFORMANCE_FACTOR_MAX, Math.max(PERFORMANCE_FACTOR_MIN, n));
}

class HistoricalPerformanceEngine {
  constructor(records = []) {
    this.records = records;
    this.lineFactors = {};
  }

  static fromRepository(data) {
    return new HistoricalPerformanceEngine(data?.items || data || []);
  }

  /**
   * Register per-line performance factors from production line master data.
   * Accepts an array of line objects (uses lineId + performanceFactor) or a
   * plain map { lineId: factor }.
   */
  setLineFactors(lines) {
    this.lineFactors = {};
    if (!lines) return this;
    if (Array.isArray(lines)) {
      for (const l of lines) {
        if (!l?.lineId) continue;
        this.lineFactors[l.lineId] = clampPerformanceFactor(
          l.performanceFactor ?? PERFORMANCE_FACTOR_DEFAULT,
        );
      }
    } else if (typeof lines === 'object') {
      for (const [lineId, factor] of Object.entries(lines)) {
        this.lineFactors[lineId] = clampPerformanceFactor(factor);
      }
    }
    return this;
  }

  getLineFactor(lineId) {
    return this.lineFactors[lineId] ?? PERFORMANCE_FACTOR_DEFAULT;
  }

  find(materialNumber, lineId) {
    return this.records.find(
      (r) => r.materialNumber === materialNumber && r.lineId === lineId,
    ) || null;
  }

  forMaterial(materialNumber) {
    return this.records.filter((r) => r.materialNumber === materialNumber);
  }

  /**
   * Weighted line score 0–100 (historical, factor-independent).
   * Setup time is inverted (lower setup = higher score).
   */
  calculateLineScore(record) {
    if (!record) return { lineScore: 0, components: {} };

    const setupNorm = Math.max(0, 100 - Math.min(record.averageSetupMinutes || 0, 180) / 1.8);
    const throughputNorm = Math.min(100, ((record.averageThroughput || 0) / 600) * 100);

    const components = {
      oee: Math.min(100, record.averageOee || 0),
      throughput: Math.round(throughputNorm * 10) / 10,
      reliability: Math.min(100, record.reliability || 0),
      yield: Math.min(100, record.averageYield || 0),
      setupTime: Math.round(setupNorm * 10) / 10,
    };

    const lineScore = Math.round(
      components.oee * LINE_SCORE_WEIGHTS.oee
      + components.throughput * LINE_SCORE_WEIGHTS.throughput
      + components.reliability * LINE_SCORE_WEIGHTS.reliability
      + components.yield * LINE_SCORE_WEIGHTS.yield
      + components.setupTime * LINE_SCORE_WEIGHTS.setupTime,
    );

    return { lineScore, components, weights: LINE_SCORE_WEIGHTS };
  }

  /**
   * Recommend production line — ranks by adjustedLineScore (lineScore × performanceFactor).
   * lineScore stays the audited historical value; the factor reflects current line condition.
   */
  recommendLine(materialNumber, lines = [], options = {}) {
    const candidates = lines.map((line) => {
      const record = this.find(materialNumber, line.lineId);
      const { lineScore, components } = this.calculateLineScore(record);
      const performanceFactor = clampPerformanceFactor(
        line.performanceFactor ?? this.getLineFactor(line.lineId),
      );
      const adjustedLineScore = Math.round(lineScore * performanceFactor);
      return {
        lineId: line.lineId,
        lineName: line.lineName || record?.lineName,
        lineScore,
        performanceFactor,
        adjustedLineScore,
        components,
        record,
        preferred: options.preferredLine === line.lineId,
      };
    }).sort((a, b) => b.adjustedLineScore - a.adjustedLineScore);

    return {
      recommendedLineId: candidates[0]?.lineId || lines[0]?.lineId,
      candidates,
    };
  }

  /**
   * Expected production metrics for a sequenced order — factor-adjusted.
   */
  expectedPerformance(materialNumber, lineId, durationHours = 8) {
    const record = this.find(materialNumber, lineId);
    const { lineScore, components } = this.calculateLineScore(record);
    const performanceFactor = this.getLineFactor(lineId);

    const hours = durationHours || 8;
    const adjustedThroughput = record
      ? (record.averageThroughput || 0) * performanceFactor
      : null;
    const expectedThroughput = adjustedThroughput == null
      ? null
      : Math.round(adjustedThroughput * hours);

    return {
      expectedOee: record?.averageOee ?? null,
      expectedThroughput,
      expectedYield: record?.averageYield ?? null,
      expectedSetupMinutes: record?.averageSetupMinutes ?? null,
      expectedDowntimeMinutes: record?.averageDowntimeMinutes ?? null,
      lineReliability: record?.reliability ?? null,
      onTimeDeliveryPercent: record?.onTimeDeliveryPercent ?? null,
      lineScore,
      adjustedLineScore: Math.round(lineScore * performanceFactor),
      performanceFactor,
      lineScoreComponents: components,
      historicalRuns: record?.runs ?? 0,
    };
  }

  /**
   * Convert a performance record into an "effective" throughput estimate (units/hour).
   * Baseline model: throughput × OEE × yield × performanceFactor.
   * OEE×yield is capped to [0.2, 1.2] to absorb dirty data; performanceFactor
   * is clamped separately in [0.5, 1.5] and stays auditable.
   */
  effectiveThroughputPerHour(materialNumber, lineId, { includeOee = true, includeYield = true, includePerformanceFactor = true } = {}) {
    const r = this.find(materialNumber, lineId);
    if (!r) return null;

    const base = Math.max(0, r.averageThroughput || 0);
    if (!base) return null;

    const oee = includeOee ? (r.averageOee ?? 100) / 100 : 1;
    const yld = includeYield ? (r.averageYield ?? 100) / 100 : 1;
    const qualityFactor = Math.min(1.2, Math.max(0.2, oee * yld));

    const perf = includePerformanceFactor ? this.getLineFactor(lineId) : 1;

    return base * qualityFactor * perf;
  }

  /**
   * Estimate runtime hours for producing a quantity on a line (units/hour model).
   * Adds setup + downtime if available. Setup/downtime are NOT scaled by the
   * performance factor (they are fixed-cost activities, not run-rate driven).
   */
  estimateRunHours(materialNumber, lineId, quantity, opts = {}) {
    const r = this.find(materialNumber, lineId);
    const eff = this.effectiveThroughputPerHour(materialNumber, lineId, opts);
    if (!eff || !quantity) return null;

    const run = quantity / Math.max(1, eff);
    const setup = (r?.averageSetupMinutes || 0) / 60;
    const down = (r?.averageDowntimeMinutes || 0) / 60;
    return run + setup + down;
  }

  /**
   * Same as estimateRunHours, but returns breakdown for UI/debugging — incl.
   * the applied performance factor so planners can trace the calculation.
   */
  estimateRunBreakdown(materialNumber, lineId, quantity, opts = {}) {
    const r = this.find(materialNumber, lineId);
    const eff = this.effectiveThroughputPerHour(materialNumber, lineId, opts);
    if (!eff || !quantity) return null;

    const runtimeHours = quantity / Math.max(1, eff);
    const setupHours = (r?.averageSetupMinutes || 0) / 60;
    const downtimeHours = (r?.averageDowntimeMinutes || 0) / 60;
    const teardownHours = (r?.averageTeardownMinutes || 0) / 60;

    const totalHours = runtimeHours + setupHours + downtimeHours + teardownHours;
    return {
      effectiveThroughputPerHour: eff,
      performanceFactor: this.getLineFactor(lineId),
      setupHours,
      runtimeHours,
      downtimeHours,
      teardownHours,
      totalHours,
    };
  }

  listAll() {
    return this.records.map((r) => ({
      ...r,
      ...this.calculateLineScore(r),
      performanceFactor: this.getLineFactor(r.lineId),
      adjustedLineScore: Math.round(
        this.calculateLineScore(r).lineScore * this.getLineFactor(r.lineId),
      ),
      effectiveThroughputPerHour: this.effectiveThroughputPerHour(r.materialNumber, r.lineId),
    }));
  }
}

module.exports = {
  HistoricalPerformanceEngine,
  LINE_SCORE_WEIGHTS,
  PERFORMANCE_FACTOR_MIN,
  PERFORMANCE_FACTOR_MAX,
  PERFORMANCE_FACTOR_DEFAULT,
  clampPerformanceFactor,
};
