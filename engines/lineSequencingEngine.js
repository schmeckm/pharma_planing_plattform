const { addDays, daysBetween } = require('../utils/dateUtils');
const { CapacityEngine } = require('./capacityEngine');
const { SequenceValidationEngine } = require('./sequenceValidationEngine');
const { FifoEngine } = require('./fifoEngine');
const { HistoricalPerformanceEngine } = require('./historicalPerformanceEngine');
const { getHeuristicPlacementAttempts } = require('../utils/planningHorizon');

const PRIORITY_WEIGHT = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const MAX_ORDER_DURATION_HOURS = parseInt(process.env.MAX_ORDER_DURATION_HOURS || '720', 10);

class LineSequencingEngine {
  constructor(historicalPerformance = []) {
    this.capacity = new CapacityEngine();
    this.validator = new SequenceValidationEngine();
    this.fifo = new FifoEngine();
    this.performance = HistoricalPerformanceEngine.fromRepository(historicalPerformance);
  }

  _isoDate(iso) {
    return iso?.slice(0, 10) || iso;
  }

  _hoursToDays(hours) {
    return Math.max(1, Math.ceil((hours || 8) / 8));
  }

  /** Prefer rough-planned duration; cap throughput-derived estimates (bad qty data). */
  _resolveDurationHours(raw, material, lineId, hoursPerDay) {
    let hours = raw.durationHours;
    if (hours == null && raw.quantity) {
      const breakdown = this.performance.estimateRunBreakdown(material, lineId, raw.quantity);
      hours = breakdown?.totalHours;
    }
    if (hours == null) hours = hoursPerDay;
    return Math.min(MAX_ORDER_DURATION_HOURS, Math.max(1, hours));
  }

  _dateInWeek(dateStr, weekStart) {
    if (!weekStart) return true;
    const diff = daysBetween(weekStart, dateStr);
    return diff >= 0 && diff < 7;
  }

  _hoursPerDay(lineId, calendars, dateStr) {
    const cal = (calendars || []).find((c) => c.lineId === lineId && this._dateInWeek(dateStr, c.weekStarting));
    const shifts = cal?.shiftPattern?.shifts;
    const hoursPerShift = cal?.shiftPattern?.hoursPerShift;
    if (typeof shifts === 'number' && typeof hoursPerShift === 'number' && shifts > 0 && hoursPerShift > 0) {
      return shifts * hoursPerShift;
    }
    return 8;
  }

  _enrichOrder(raw, batch, validation, lineId, startDate, endDate, { calendars = [], durationHours = null } = {}) {
    const rmsl = validation?.rmslForecast;
    const deliveryCp = rmsl?.checkpoints?.find((c) => c.checkpoint === 'CUSTOMER_DELIVERY');
    const startCp = rmsl?.checkpoints?.find((c) => c.checkpoint === 'PACKAGING_START');
    const endCp = rmsl?.checkpoints?.find((c) => c.checkpoint === 'PACKAGING_END');
    const material = raw.material || raw.materialNumber;

    const computedHours = durationHours ?? raw.durationHours ?? null;
    const perf = this.performance.expectedPerformance(material, lineId, computedHours || 8);
    const breakdown = raw.quantity
      ? this.performance.estimateRunBreakdown(material, lineId, raw.quantity)
      : null;
    const effectiveThroughputPerHour = breakdown?.effectiveThroughputPerHour ?? null;
    const estimatedRunHours = breakdown?.totalHours ?? null;

    return {
      packagingOrder: raw.packagingOrder,
      packagingOrderId: raw.packagingOrder,
      salesOrder: raw.salesOrder,
      material: raw.material,
      destinationCountry: raw.destinationCountry,
      quantity: raw.quantity,
      priority: raw.priority,
      productionLine: lineId,
      plannedStartDate: startDate,
      plannedEndDate: endDate,
      roughPlannedStart: raw.roughPlannedStart,
      roughPlannedEnd: raw.roughPlannedEnd,
      requestedDeliveryDate: raw.requestedDeliveryDate,
      durationHours: computedHours,
      allocationStatus: validation?.valid ? 'VALID' : 'AT_RISK',
      riskScore: validation?.riskScore || 0,
      recommendedBatchId: validation?.recommendedBatchId || batch?.batchId,
      rmslAtStart: startCp?.rmslMonths,
      rmslAtEnd: endCp?.rmslMonths,
      rmslAtDelivery: deliveryCp?.rmslMonths,
      rmslAtDeliveryPct: deliveryCp?.percentOfThreshold,
      rmslViolation: rmsl ? !rmsl.overallPassed : false,
      late: endDate > raw.requestedDeliveryDate,
      expectedCompletion: endDate,
      expectedOee: perf.expectedOee,
      expectedThroughput: perf.expectedThroughput,
      expectedYield: perf.expectedYield,
      lineReliability: perf.lineReliability,
      lineScore: perf.lineScore,
      adjustedLineScore: perf.adjustedLineScore,
      performanceFactor: perf.performanceFactor,
      lineScoreComponents: perf.lineScoreComponents,
      effectiveThroughputPerHour,
      estimatedRunHours,
      estimatedSetupHours: breakdown?.setupHours ?? null,
      estimatedRuntimeHours: breakdown?.runtimeHours ?? null,
      estimatedDowntimeHours: breakdown?.downtimeHours ?? null,
      estimatedTeardownHours: breakdown?.teardownHours ?? null,
      issues: validation?.issues || [],
      planningStatus: 'OPTIMIZED',
    };
  }

  _selectLine(raw, lines) {
    const material = raw.material || raw.materialNumber;
    const recommendation = this.performance.recommendLine(material, lines, {
      preferredLine: raw.preferredLine || raw.productionLine,
    });
    const preferred = raw.preferredLine && lines.find((l) => l.lineId === raw.preferredLine);
    if (preferred && recommendation.candidates.find((c) => c.lineId === preferred.lineId)?.lineScore >= 50) {
      return preferred.lineId;
    }
    return recommendation.recommendedLineId || lines[0]?.lineId;
  }

  _pickBatch(order, batches) {
    const material = order.material || order.materialNumber;
    const candidates = this.fifo.selectCandidates(batches, material)
      .filter((b) => b.qualityStatus === 'RELEASED')
      .filter((b) => !order.destinationCountry || (b.approvedCountries || []).includes(order.destinationCountry));
    return candidates[0] || null;
  }

  /**
   * Auto-optimize: sort by priority + delivery, pack lines sequentially.
   */
  optimize(roughOrders, lines, calendars, batches, rulesData, startAnchor = '2026-09-01', horizonDays = null) {
    this.performance.setLineFactors(lines);
    const placementAttempts = getHeuristicPlacementAttempts(horizonDays);
    const sorted = [...roughOrders].sort((a, b) => {
      const pw = (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
      if (pw !== 0) return pw;
      return new Date(a.requestedDeliveryDate) - new Date(b.requestedDeliveryDate);
    });

    const lineCursors = Object.fromEntries(lines.map((l) => [l.lineId, startAnchor]));
    const lineSchedules = Object.fromEntries(lines.map((l) => [l.lineId, []]));
    const enriched = [];

    for (const raw of sorted) {
      const material = raw.material || raw.materialNumber;
      const lineRanking = this.performance.recommendLine(material, lines, {
        preferredLine: raw.preferredLine,
      }).candidates;

      let placed = false;
      let placedLineId = lineRanking[0]?.lineId || lines[0]?.lineId;

      for (const candidate of lineRanking) {
        if (placed) break;
        const lineId = candidate.lineId;
        let cursor = lineCursors[lineId];

        for (let attempt = 0; attempt < placementAttempts && !placed; attempt++) {
          const startDate = cursor;
          const hoursPerDay = this._hoursPerDay(lineId, calendars, startDate);
          const durationHours = this._resolveDurationHours(raw, material, lineId, hoursPerDay);
          const durationDays = Math.max(1, Math.ceil(durationHours / hoursPerDay));
          const endDate = addDays(startDate, durationDays - 1);
          const slot = this.capacity.checkLineSlot(
            lineId, startDate, endDate, calendars, lines, lineSchedules[lineId],
          );

          if (slot.feasible) {
            const batch = this._pickBatch(raw, batches);
            const orderForVal = {
              ...raw,
              packagingOrderId: raw.packagingOrder,
              materialNumber: material,
              plannedStartDate: startDate,
              plannedEndDate: endDate,
              durationHours,
            };
            const validation = batch
              ? this.validator.validateOrderPlacement(orderForVal, batch, rulesData, { batches })
              : { valid: false, issues: [{ code: 'NO_BATCH', severity: 'HIGH', message: 'No eligible batch' }], riskScore: 100 };

            const item = this._enrichOrder(raw, batch, validation, lineId, startDate, endDate, {
              calendars,
              durationHours,
            });
            lineSchedules[lineId].push(item);
            enriched.push(item);
            lineCursors[lineId] = addDays(endDate, 1);
            placedLineId = lineId;
            placed = true;
          } else {
            cursor = addDays(cursor, 1);
          }
        }
      }

      if (!placed) {
        enriched.push({
          ...raw,
          packagingOrderId: raw.packagingOrder,
          productionLine: placedLineId,
          allocationStatus: 'UNPLACED',
          riskScore: 100,
          planningStatus: 'FAILED',
          issues: [{ code: 'CAPACITY', severity: 'HIGH', message: 'Could not place on any line within horizon' }],
        });
      }
    }

    for (const lineId of Object.keys(lineSchedules)) {
      const jpVal = this.validator.validateJapanSequence(lineSchedules[lineId], batches, rulesData);
      if (!jpVal.valid) {
        for (const issue of jpVal.issues) {
          const order = enriched.find((e) => e.packagingOrder === issue.packagingOrder);
          if (order) {
            order.issues = [...(order.issues || []), issue];
            order.jpSequenceIssue = true;
            order.riskScore = (order.riskScore || 0) + 25;
          }
        }
      }
    }

    const score = this._scoreSchedule(enriched);
    return {
      optimized: enriched,
      lineSchedules,
      score,
      kpis: this._kpis(roughOrders, enriched, lines, calendars, horizonDays),
    };
  }

  /**
   * Simulate user-defined sequence (from Gantt drag-drop).
   */
  simulateSequence(sequenceItems, roughMap, lines, calendars, batches, rulesData, horizonDays = null) {
    this.performance.setLineFactors(lines);
    const byLine = {};
    for (const item of sequenceItems) {
      const lineId = item.productionLine;
      if (!byLine[lineId]) byLine[lineId] = [];
      byLine[lineId].push(item);
    }

    const enriched = [];
    for (const lineId of Object.keys(byLine)) {
      const sorted = byLine[lineId].sort(
        (a, b) => new Date(a.plannedStartDate) - new Date(b.plannedStartDate)
      );
      for (const item of sorted) {
        const raw = roughMap[item.packagingOrder || item.packagingOrderId] || item;
        const batch = item.recommendedBatchId
          ? batches.find((b) => b.batchId === item.recommendedBatchId)
          : this._pickBatch(raw, batches);

        const hoursPerDay = this._hoursPerDay(lineId, calendars, item.plannedStartDate);
        const days = Math.max(1, daysBetween(item.plannedStartDate, item.plannedEndDate) + 1);
        const durationHours = raw.durationHours
          ?? this._resolveDurationHours(raw, raw.material || raw.materialNumber, lineId, days * hoursPerDay);
        const orderForVal = {
          ...raw,
          packagingOrderId: raw.packagingOrder || raw.packagingOrderId,
          materialNumber: raw.material || raw.materialNumber,
          plannedStartDate: item.plannedStartDate,
          plannedEndDate: item.plannedEndDate,
          durationHours,
        };
        const validation = batch
          ? this.validator.validateOrderPlacement(orderForVal, batch, rulesData, { batches })
          : { valid: false, issues: [], riskScore: 50 };

        enriched.push(this._enrichOrder(
          raw, batch, validation, lineId, item.plannedStartDate, item.plannedEndDate, { calendars, durationHours }
        ));
      }

      const jpVal = this.validator.validateJapanSequence(enriched.filter((e) => e.productionLine === lineId), batches, rulesData);
      if (!jpVal.valid) {
        for (const issue of jpVal.issues) {
          const order = enriched.find((e) => e.packagingOrder === issue.packagingOrder);
          if (order) {
            order.jpSequenceIssue = true;
            order.issues = [...(order.issues || []), issue];
          }
        }
      }
    }

    return {
      simulated: enriched,
      score: this._scoreSchedule(enriched),
      kpis: this._kpis(Object.values(roughMap), enriched, lines, calendars, horizonDays),
    };
  }

  _scoreSchedule(orders) {
    return {
      lateOrders: orders.filter((o) => o.late).length,
      rmslViolations: orders.filter((o) => o.rmslViolation).length,
      fifoDeviations: orders.filter((o) => o.issues?.some((i) => i.code === 'FIFO_DEVIATION')).length,
      jpSequenceIssues: orders.filter((o) => o.jpSequenceIssue).length,
      highRisk: orders.filter((o) => (o.riskScore || 0) >= 30).length,
      totalRisk: orders.reduce((s, o) => s + (o.riskScore || 0), 0),
    };
  }

  _kpis(roughOrders, scheduled, lines, calendars, horizonDays = null) {
    const utilDays = getHeuristicPlacementAttempts(horizonDays);
    const util = this.capacity.lineUtilization(scheduled, lines, calendars, utilDays);
    return {
      openOrders: scheduled.length,
      openRoughPlanned: roughOrders.filter((o) => o.planningStatus === 'ROUGH').length,
      optimizedOrders: scheduled.filter((o) => o.planningStatus === 'OPTIMIZED').length,
      highRiskOrders: scheduled.filter((o) => (o.riskScore || 0) >= 30).length,
      lateOrders: scheduled.filter((o) => o.late).length,
      rmslRiskOrders: scheduled.filter((o) => o.rmslViolation).length,
      jpSequenceIssues: scheduled.filter((o) => o.jpSequenceIssue).length,
      lineUtilization: util.lineUtilization,
      peakUtilization: util.summary.peakUtilization,
    };
  }

  toGanttTasks(orders, timelineStart, timelineEnd) {
    const totalDays = Math.max(1, daysBetween(timelineStart, timelineEnd) + 1);
    return orders.map((o) => {
      const startOffset = daysBetween(timelineStart, o.plannedStartDate);
      const duration = Math.max(1, daysBetween(o.plannedStartDate, o.plannedEndDate) + 1);
      return {
        id: o.packagingOrder || o.packagingOrderId,
        name: `${o.packagingOrder || o.packagingOrderId} (${o.destinationCountry})`,
        productionLine: o.productionLine,
        start: o.plannedStartDate,
        end: o.plannedEndDate,
        startOffset,
        duration,
        leftPercent: Math.round((startOffset / totalDays) * 1000) / 10,
        widthPercent: Math.round((duration / totalDays) * 1000) / 10,
        destinationCountry: o.destinationCountry,
        allocationStatus: o.allocationStatus,
        riskScore: o.riskScore,
        recommendedBatchId: o.recommendedBatchId,
        rmslAtStart: o.rmslAtStart,
        rmslAtEnd: o.rmslAtEnd,
        rmslAtDelivery: o.rmslAtDelivery,
        priority: o.priority,
        expectedOee: o.expectedOee,
        lineScore: o.lineScore,
        adjustedLineScore: o.adjustedLineScore,
        performanceFactor: o.performanceFactor,
        lineReliability: o.lineReliability,
      };
    });
  }
}

module.exports = { LineSequencingEngine };
