/**
 * Statistical ML prognosis — linear regression, exponential smoothing, risk scoring.
 * No external ML SDK; trained on completed orders + demand forecasts.
 */
const { addDays, daysBetween } = require('../utils/dateUtils');
const { resolveShift, analyzeOrderMetrics } = require('./historicalOrderPerformanceEngine');

function weekKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function linearRegression(points) {
  if (!points.length) return { slope: 0, intercept: 0, r2: 0 };
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const ssTot = sumYY - (sumY * sumY) / n;
  const ssRes = points.reduce((s, p) => {
    const pred = intercept + slope * p.x;
    return s + (p.y - pred) ** 2;
  }, 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { slope, intercept, r2: Math.round(r2 * 1000) / 1000 };
}

function ema(values, alpha = 0.35) {
  if (!values.length) return null;
  return values.reduce((prev, v, i) => (i === 0 ? v : alpha * v + (1 - alpha) * prev));
}

class MlPrognosisEngine {
  static predict(context = {}) {
    const {
      orders = [],
      batches = [],
      forecasts = [],
      lines = [],
      shiftAnalysis = null,
      horizons = [7, 30, 90],
      referenceDate = new Date().toISOString().slice(0, 10),
    } = context;

    const completed = orders.filter(
      (o) => o.status === 'COMPLETED' && o.actualEndDate,
    );
    const open = orders.filter((o) => o.status === 'OPEN' || o.status === 'PLANNED');

    const demandByMaterial = MlPrognosisEngine._demandRegression(completed, open, horizons, referenceDate);
    const oeeByLineShift = MlPrognosisEngine._oeeForecast(completed, lines, shiftAnalysis, horizons);
    const riskScores = MlPrognosisEngine._riskProbabilities(completed, open, batches, horizons, referenceDate);
    const forecastReconciliation = MlPrognosisEngine._reconcileForecasts(forecasts, demandByMaterial, horizons);
    const capacityOutlook = MlPrognosisEngine._capacityOutlook(completed, lines, horizons, referenceDate);
    const onTimeRate = completed.length
      ? completed.filter((o) => (o.actualEndDate || o.plannedEndDate) <= o.requestedDeliveryDate).length / completed.length
      : 0.85;

    return {
      engine: 'statistical-ml-v1',
      modelType: 'linear-regression + exponential-smoothing',
      referenceDate,
      trainedOn: {
        completedOrders: completed.length,
        openOrders: open.length,
        forecastRecords: forecasts.length,
        productionLines: lines.length,
      },
      methodology: {
        onTimeRate: Math.round(onTimeRate * 1000) / 1000,
        modules: [
          {
            id: 'demand',
            title: 'Nachfrage-Prognose',
            method: 'Lineare Regression auf wöchentlichen Abgangsmengen pro Material (KW aus actualEndDate)',
            formula: 'projectedQty = intercept + slope × (historischeWochen + horizonWochen − 1)',
            thresholds: 'Trend UP/DOWN wenn slope > ±5; Konfidenz = 0.5 + R² × 0.45 (max 0.95)',
          },
          {
            id: 'oee',
            title: 'OEE-Prognose',
            method: 'Exponential Moving Average (α=0.35) über die letzten 12 abgeschlossene Runs pro Linie × Schicht',
            formula: 'projectedOee = EMA(last 12) + drift (−1 bei T+30, −2 bei T+90), gekappt 50–100 %',
          },
          {
            id: 'risk',
            title: 'Auftrags-Risiko',
            method: 'Heuristische Wahrscheinlichkeiten aus Pünktlichkeitsrate, Chargen-Verfügbarkeit und Lieferdringlichkeit',
            formula: 'delayProb = (1 − onTimeRate) + batchStress×0.3 + urgency; overall = delay×0.6 + rmsl×0.4',
            thresholds: 'Tier HIGH ≥ 0.7, MEDIUM ≥ 0.4',
          },
          {
            id: 'capacity',
            title: 'Kapazitäts-Ausblick',
            method: 'Verhältnis abgeschlossene Menge im Horizont zu theoretischer Linienkapazität (capacityUnitsPerDay × Tage)',
            thresholds: 'bottleneckLikely wenn Auslastung > 85 %',
          },
          {
            id: 'reconciliation',
            title: 'SAP vs. ML',
            method: 'Vergleich SAP-Forecast-Summe mit ML-Wochenprognose × 4 (T+30); ALIGNED wenn Δ ≤ 15 %',
          },
        ],
      },
      horizons: horizons.map((h) => ({
        horizonDays: h,
        demandForecasts: demandByMaterial.filter((d) => d.horizonDays === h),
        oeeForecasts: oeeByLineShift.filter((d) => d.horizonDays === h),
        riskProbabilities: riskScores.filter((r) => r.horizonDays === h),
        capacityOutlook: capacityOutlook.find((c) => c.horizonDays === h) || null,
      })),
      forecastReconciliation,
      advisorNote:
        'Statistical ML from historical packaging orders. HIGH-risk items still require planner approval.',
    };
  }

  static _demandRegression(completed, open, horizons, referenceDate) {
    const byMatWeek = {};
    for (const o of completed) {
      const wk = weekKey(o.actualEndDate || o.plannedEndDate);
      if (!wk || !o.materialNumber) continue;
      const key = `${o.materialNumber}::${wk}`;
      byMatWeek[key] = (byMatWeek[key] || 0) + (o.quantity || 0);
    }

    const materials = [...new Set([
      ...completed.map((o) => o.materialNumber),
      ...open.map((o) => o.materialNumber),
    ].filter(Boolean))];

    const results = [];
    for (const materialNumber of materials) {
      const weeks = Object.keys(byMatWeek)
        .filter((k) => k.startsWith(`${materialNumber}::`))
        .sort();
      const points = weeks.map((k, i) => ({
        x: i,
        y: byMatWeek[k],
      }));
      const reg = linearRegression(points);
      const lastQty = points.length ? points[points.length - 1].y : 0;
      const openQty = open
        .filter((o) => o.materialNumber === materialNumber)
        .reduce((s, o) => s + (o.quantity || 0), 0);

      for (const h of horizons) {
        const weeksAhead = Math.max(1, Math.round(h / 7));
        const projected = Math.max(
          0,
          Math.round(reg.intercept + reg.slope * (points.length + weeksAhead - 1)),
        );
        const trend = reg.slope > 5 ? 'UP' : reg.slope < -5 ? 'DOWN' : 'STABLE';
        results.push({
          horizonDays: h,
          materialNumber,
          historicalWeeks: points.length,
          lastWeeklyQuantity: lastQty,
          openOrderQuantity: openQty,
          projectedWeeklyQuantity: projected,
          trend,
          confidence: Math.min(0.95, 0.5 + reg.r2 * 0.45),
          modelR2: reg.r2,
        });
      }
    }
    return results.sort((a, b) => b.openOrderQuantity - a.openOrderQuantity).slice(0, 50);
  }

  static _oeeForecast(completed, lines, shiftAnalysis, horizons) {
    const lineMap = Object.fromEntries(lines.map((l) => [l.lineId, l]));
    const groups = {};

    for (const o of completed) {
      const { shiftId } = resolveShift(o);
      const key = `${o.productionLine}::${shiftId}`;
      const cap = lineMap[o.productionLine]?.capacityUnitsPerDay;
      const m = analyzeOrderMetrics(o, cap);
      if (!m) continue;
      if (!groups[key]) {
        groups[key] = {
          lineId: o.productionLine,
          shiftId,
          oeeSeries: [],
        };
      }
      groups[key].oeeSeries.push(m.oee);
    }

    const shiftRows = shiftAnalysis?.byLineShift || [];
    const results = [];
    for (const g of Object.values(groups)) {
      const sorted = [...g.oeeSeries].sort((a, b) => a - b);
      const historicalOee = sorted.length
        ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length)
        : null;
      const smoothed = ema(g.oeeSeries.slice(-12));
      const shiftRow = shiftRows.find(
        (r) => r.lineId === g.lineId && r.shiftId === g.shiftId,
      );

      for (const h of horizons) {
        const drift = h <= 7 ? 0 : h <= 30 ? -1 : -2;
        results.push({
          horizonDays: h,
          lineId: g.lineId,
          shiftId: g.shiftId,
          historicalOee: shiftRow?.averageOee ?? historicalOee,
          projectedOee: smoothed != null ? Math.max(50, Math.min(100, Math.round(smoothed + drift))) : null,
          runs: g.oeeSeries.length,
          confidence: Math.min(0.92, 0.55 + g.oeeSeries.length * 0.02),
        });
      }
    }
    return results;
  }

  static _riskProbabilities(completed, open, batches, horizons, referenceDate) {
    const onTimeRate = completed.length
      ? completed.filter((o) => (o.actualEndDate || o.plannedEndDate) <= o.requestedDeliveryDate).length / completed.length
      : 0.85;

    const results = [];
    for (const order of open) {
      const eligible = batches.filter(
        (b) => b.materialNumber === order.materialNumber && b.qualityStatus === 'RELEASED',
      );
      const batchStress = eligible.length === 0 ? 0.9 : eligible.length === 1 ? 0.55 : 0.25;
      const deliveryDays = order.requestedDeliveryDate
        ? daysBetween(referenceDate, order.requestedDeliveryDate)
        : 30;

      for (const h of horizons) {
        const urgency = deliveryDays <= h ? 0.35 : 0.1;
        const delayProb = Math.min(0.95, Math.max(0.05, (1 - onTimeRate) + batchStress * 0.3 + urgency));
        const rmslProb = batchStress * 0.4;
        const overall = Math.min(0.98, delayProb * 0.6 + rmslProb * 0.4);
        results.push({
          horizonDays: h,
          packagingOrderId: order.packagingOrderId,
          materialNumber: order.materialNumber,
          destinationCountry: order.destinationCountry,
          delayProbability: Math.round(delayProb * 1000) / 1000,
          rmslViolationProbability: Math.round(rmslProb * 1000) / 1000,
          overallRiskProbability: Math.round(overall * 1000) / 1000,
          suggestedTier: overall >= 0.7 ? 'HIGH' : overall >= 0.4 ? 'MEDIUM' : 'LOW',
          confidence: Math.min(0.88, 0.45 + completed.length * 0.001),
        });
      }
    }
    return results.sort((a, b) => b.overallRiskProbability - a.overallRiskProbability).slice(0, 100);
  }

  static _reconcileForecasts(forecasts, demandForecasts, horizons) {
    const byMat = {};
    for (const f of forecasts) {
      const key = `${f.materialNumber}::${f.marketId || f.market || 'ALL'}`;
      byMat[key] = (byMat[key] || 0) + (f.forecastQuantity || 0);
    }
    return Object.entries(byMat).map(([key, sapForecast]) => {
      const [materialNumber] = key.split('::');
      const ml = demandForecasts.find((d) => d.materialNumber === materialNumber && d.horizonDays === 30);
      const mlQty = ml?.projectedWeeklyQuantity ? ml.projectedWeeklyQuantity * 4 : null;
      const delta = mlQty != null && sapForecast ? Math.round(((mlQty - sapForecast) / sapForecast) * 100) : null;
      return {
        materialNumber,
        sapForecastQuantity: sapForecast,
        mlProjectedMonthlyQuantity: mlQty,
        deltaPercent: delta,
        alignment: delta == null ? 'UNKNOWN' : Math.abs(delta) <= 15 ? 'ALIGNED' : delta > 0 ? 'ML_HIGHER' : 'ML_LOWER',
      };
    }).slice(0, 30);
  }

  static _capacityOutlook(completed, lines, horizons, referenceDate) {
    return horizons.map((h) => {
      const recent = completed.filter((o) => {
        const end = o.actualEndDate;
        if (!end) return false;
        return daysBetween(end, referenceDate) <= Math.min(h, 90);
      });
      const totalQty = recent.reduce((s, o) => s + (o.quantity || 0), 0);
      const lineCapacity = lines.reduce((s, l) => s + (l.capacityUnitsPerDay || 8000) * h, 0);
      const utilization = lineCapacity > 0 ? Math.round((totalQty / lineCapacity) * 1000) / 10 : 0;
      return {
        horizonDays: h,
        recentCompletedQuantity: totalQty,
        theoreticalCapacity: lineCapacity,
        projectedUtilizationPercent: Math.min(150, utilization),
        bottleneckLikely: utilization > 85,
      };
    });
  }
}

module.exports = { MlPrognosisEngine, linearRegression, ema };
