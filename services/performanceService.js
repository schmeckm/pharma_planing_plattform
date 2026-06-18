const {
  HistoricalPerformanceEngine,
  PERFORMANCE_FACTOR_MIN,
  PERFORMANCE_FACTOR_MAX,
  PERFORMANCE_FACTOR_DEFAULT,
  clampPerformanceFactor,
} = require('../engines/historicalPerformanceEngine');
const {
  HistoricalOrderPerformanceEngine,
} = require('../engines/historicalOrderPerformanceEngine');
const { ShiftHistoryService } = require('./shiftHistoryService');
const { addDays } = require('../utils/dateUtils');
const { getProvider } = require('../providers');
const {
  getPerformanceShortDays,
  getPerformanceLongDays,
} = require('../utils/planningHorizon');

const PLANNING_ANCHOR = '2026-09-01';

class PerformanceService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this._analysisCache = null;
    this.engine = HistoricalPerformanceEngine.fromRepository([]);
  }

  _referenceDate() {
    return addDays(PLANNING_ANCHOR, -1);
  }

  analyzeHistoricalOrders(options = {}) {
    const orders = this.provider.getOrders?.() || [];
    const lines = this.provider.getProductionLines?.() || [];
    return HistoricalOrderPerformanceEngine.analyze(orders, lines, {
      referenceDate: options.referenceDate || this._referenceDate(),
      shortDays: options.shortDays ?? getPerformanceShortDays(),
      longDays: options.longDays ?? getPerformanceLongDays(),
    });
  }

  refreshFromHistory() {
    const analysis = this.analyzeHistoricalOrders();
    this._analysisCache = analysis;

    const staticRecords = this.provider.getHistoricalPerformance?.()?.items || [];
    const derived = analysis.historicalPerformanceRecords;
    const merged = derived.length ? derived : staticRecords;

    this.engine = HistoricalPerformanceEngine.fromRepository(merged);
    this._refreshLineFactors();
    return analysis;
  }

  getAnalysis() {
    if (!this._analysisCache) this.refreshFromHistory();
    return this._analysisCache;
  }

  /**
   * Lines enriched with horizon-specific derived Leistungsfaktor from history.
   * @param {'short'|'long'} horizon — short = sequencing / daily; long = capacity / program
   */
  getLinesForHorizon(horizon = 'short') {
    const lines = this.provider.getProductionLines?.() || [];
    const analysis = this.getAnalysis();
    const byLine = Object.fromEntries(analysis.byLine.map((b) => [b.lineId, b]));

    return lines.map((line) => {
      const derived = byLine[line.lineId];
      const factor = horizon === 'long'
        ? derived?.longTermFactor
        : derived?.shortTermFactor;
      const oee = horizon === 'long'
        ? derived?.longTermOee
        : derived?.shortTermOee;
      return {
        ...line,
        performanceFactor: clampPerformanceFactor(factor ?? line.performanceFactor ?? PERFORMANCE_FACTOR_DEFAULT),
        derivedPerformanceFactor: factor ?? null,
        derivedOee: oee ?? null,
        performanceFactorSource: derived?.historicalRunsLong ? 'HISTORICAL_ORDERS' : 'MANUAL',
        performanceFactorReason: derived
          ? `Abgeleitet aus ${horizon === 'long' ? derived.historicalRunsLong : derived.historicalRunsShort} abgeschlossenen Aufträgen (OEE ${oee ?? '—'}%)`
          : line.performanceFactorReason,
      };
    });
  }

  getPerformanceRecords() {
    this.getAnalysis();
    return this.engine.records;
  }

  _refreshLineFactors(lines = null) {
    const enriched = lines || this.getLinesForHorizon('short');
    this.engine.setLineFactors(enriched);
    return enriched;
  }

  listLineScores(materialNumber = null) {
    this._refreshLineFactors();
    const records = materialNumber
      ? this.engine.forMaterial(materialNumber)
      : this.engine.records;
    return {
      timestamp: new Date().toISOString(),
      materialNumber,
      items: records.map((r) => {
        const score = this.engine.calculateLineScore(r);
        const performanceFactor = this.engine.getLineFactor(r.lineId);
        return {
          ...r,
          ...score,
          performanceFactor,
          adjustedLineScore: Math.round(score.lineScore * performanceFactor),
          effectiveThroughputPerHour: this.engine.effectiveThroughputPerHour(r.materialNumber, r.lineId),
        };
      }),
    };
  }

  recommendLine(materialNumber, preferredLine = null) {
    const lines = this.getLinesForHorizon('short');
    this.engine.setLineFactors(lines);
    return this.engine.recommendLine(materialNumber, lines, { preferredLine });
  }

  listLineFactors() {
    const analysis = this.getAnalysis();
    const lines = this._refreshLineFactors();
    const byLine = Object.fromEntries(analysis.byLine.map((b) => [b.lineId, b]));
    return {
      timestamp: new Date().toISOString(),
      bounds: {
        min: PERFORMANCE_FACTOR_MIN,
        max: PERFORMANCE_FACTOR_MAX,
        default: PERFORMANCE_FACTOR_DEFAULT,
      },
      horizons: analysis.horizons,
      completedOrderCount: analysis.completedOrderCount,
      items: lines.map((l) => {
        const derived = byLine[l.lineId];
        return {
          lineId: l.lineId,
          lineName: l.lineName,
          plantId: l.plantId,
          active: l.active !== false,
          performanceFactor: clampPerformanceFactor(
            l.performanceFactor ?? PERFORMANCE_FACTOR_DEFAULT,
          ),
          performanceFactorReason: l.performanceFactorReason || null,
          performanceFactorUpdatedAt: l.performanceFactorUpdatedAt || null,
          performanceFactorUpdatedBy: l.performanceFactorUpdatedBy || null,
          derivedShortTermFactor: derived?.shortTermFactor ?? null,
          derivedLongTermFactor: derived?.longTermFactor ?? null,
          derivedShortTermOee: derived?.shortTermOee ?? null,
          derivedLongTermOee: derived?.longTermOee ?? null,
          historicalRunsShort: derived?.historicalRunsShort ?? 0,
          historicalRunsLong: derived?.historicalRunsLong ?? 0,
        };
      }),
    };
  }

  getHistoricalAnalysis() {
    const analysis = this.getAnalysis();
    const strip = (rows = []) => rows.map(({ metrics, ...rest }) => rest);
    return {
      timestamp: new Date().toISOString(),
      referenceDate: analysis.referenceDate,
      horizons: analysis.horizons,
      completedOrderCount: analysis.completedOrderCount,
      byLine: analysis.byLine,
      byMaterialLine: strip(analysis.byMaterialLine),
      byMaterialLineShift: strip(analysis.byMaterialLineShift),
      byLineShift: strip(analysis.byLineShift),
    };
  }

  getShiftHistory(options = {}) {
    const orders = this.provider.getOrders?.() || [];
    const lines = this.provider.getProductionLines?.() || [];
    return ShiftHistoryService.buildTimeline(orders, lines, {
      referenceDate: options.referenceDate || this._referenceDate(),
      windowDays: options.windowDays ?? 365,
      limit: options.limit ?? 200,
    });
  }

  applyDerivedFactorsToLines({ horizon = 'long', userId = 'SYSTEM' } = {}) {
    const analysis = this.getAnalysis();
    const useLong = horizon === 'long';
    const updates = [];

    for (const row of analysis.byLine) {
      const factor = useLong ? row.longTermFactor : row.shortTermFactor;
      const oee = useLong ? row.longTermOee : row.shortTermOee;
      const runs = useLong ? row.historicalRunsLong : row.historicalRunsShort;
      if (!runs || factor == null) continue;

      const updated = this.updateLineFactor(row.lineId, {
        performanceFactor: factor,
        reason: `Aus ${runs} historischen Aufträgen (${useLong ? 'Langfrist' : 'Kurzfrist'}, OEE ${oee ?? '—'}%)`,
        userId,
      });
      updates.push(updated);
    }

    this.refreshFromHistory();
    return {
      applied: updates.length,
      horizon,
      lines: updates,
    };
  }

  /**
   * Update a line's performance factor and append an audit entry.
   * Returns the updated line. Throws for unknown line or invalid factor.
   */
  updateLineFactor(lineId, { performanceFactor, reason = null, userId = 'SYSTEM' } = {}) {
    if (!lineId) {
      const err = new Error('lineId required');
      err.code = 'VALIDATION';
      throw err;
    }

    const existing = this.provider.getProductionLineById?.(lineId);
    if (!existing) {
      const err = new Error(`Production line not found: ${lineId}`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    const numeric = Number(performanceFactor);
    if (!Number.isFinite(numeric)) {
      const err = new Error('performanceFactor must be a finite number');
      err.code = 'VALIDATION';
      throw err;
    }
    if (numeric < PERFORMANCE_FACTOR_MIN || numeric > PERFORMANCE_FACTOR_MAX) {
      const err = new Error(
        `performanceFactor must be within [${PERFORMANCE_FACTOR_MIN}, ${PERFORMANCE_FACTOR_MAX}]`,
      );
      err.code = 'VALIDATION';
      throw err;
    }

    const previous = clampPerformanceFactor(
      existing.performanceFactor ?? PERFORMANCE_FACTOR_DEFAULT,
    );
    const next = clampPerformanceFactor(numeric);
    const timestamp = new Date().toISOString();

    const updated = this.provider.updateProductionLine(lineId, {
      performanceFactor: next,
      performanceFactorReason: reason,
      performanceFactorUpdatedAt: timestamp,
      performanceFactorUpdatedBy: userId,
    });

    if (this.provider.appendAudit) {
      this.provider.appendAudit({
        timestamp,
        userId,
        action: 'LINE_PERFORMANCE_FACTOR_UPDATED',
        lineId,
        previousFactor: previous,
        newFactor: next,
        reason,
      });
    }

    this._refreshLineFactors();
    return {
      ...updated,
      previousFactor: previous,
      delta: Math.round((next - previous) * 1000) / 1000,
    };
  }
}

module.exports = { PerformanceService };
