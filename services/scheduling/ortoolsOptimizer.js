const http = require('node:http');
const https = require('node:https');
const { enrichOrdersForSolver } = require('./schedulingPayloadEnricher');

/**
 * OR-Tools sidecar client — POST /optimize to Python CP-SAT service.
 */
class OrtoolsOptimizer {
  constructor(provider, fallbackOptimizer, lineOpt) {
    this.provider = provider;
    this.fallback = fallbackOptimizer;
    this.lineOpt = lineOpt;
    this.baseUrl = process.env.ORTOOLS_URL || 'http://127.0.0.1:8010';
    this.timeoutMs = parseInt(process.env.ORTOOLS_TIMEOUT_MS || '60000', 10);
  }

  get name() {
    return 'google-or-tools';
  }

  _roughOrders() {
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const dir = process.env.HAP_DATA_DIR || path.join(__dirname, '../../data');
      const data = JSON.parse(fs.readFileSync(path.join(dir, 'roughPlannedOrders.json'), 'utf-8'));
      return data.items || [];
    } catch {
      return [];
    }
  }

  _buildPayload({ startAnchor, horizonDays, constraintItems, priorityScores, lines, calendars, combinedPlanningItems = [] }) {
    const byId = Object.fromEntries(constraintItems.map((c) => [c.packagingOrderId, c]));
    const scoreById = Object.fromEntries(priorityScores.map((p) => [p.packagingOrderId, p.priorityScore]));
    const rough = this._roughOrders();
    const open = this.provider.getOrders().filter((o) => o.status === 'OPEN' || o.status === 'PLANNED');
    const source = rough.length ? rough : open;

    const performanceRecords = this.lineOpt?.performance?.getPerformanceRecords?.()
      || this.lineOpt?.sequencer?.performance?.records
      || [];

    const enriched = enrichOrdersForSolver({
      orders: source.map((raw) => ({
        ...raw,
        packagingOrderId: raw.packagingOrder || raw.packagingOrderId,
      })),
      lines,
      performanceRecords,
    });

    return {
      horizonStart: startAnchor,
      horizonDays,
      maxTimeSeconds: parseFloat(process.env.ORTOOLS_MAX_TIME_SECONDS || '120'),
      lineScoreWeight: parseInt(process.env.ORTOOLS_LINE_SCORE_WEIGHT || '8', 10),
      lineBalanceWeight: parseInt(process.env.ORTOOLS_LINE_BALANCE_WEIGHT || '15', 10),
      numWorkers: parseInt(process.env.ORTOOLS_NUM_WORKERS || '8', 10),
      lines,
      calendars,
      orders: enriched.map((order) => {
        const id = order.packagingOrderId;
        const c = byId[id] || {};
        return {
          packagingOrderId: id,
          materialNumber: order.materialNumber,
          destinationCountry: order.destinationCountry,
          quantity: order.quantity,
          priority: order.priority,
          requestedDeliveryDate: order.requestedDeliveryDate,
          preferredLine: order.preferredLine,
          bestLineId: order.bestLineId,
          durationHours: order.durationHours,
          lineScores: order.lineScores || {},
          expectedOee: order.expectedOee,
          performanceFactor: order.performanceFactor,
          adjustedLineScore: order.adjustedLineScore,
          eligibleBatchIds: c.recommendedBatchId ? [c.recommendedBatchId] : [],
          hardConstraints: c.hardConstraints || {},
          eligible: c.eligible !== false,
          priorityScore: scoreById[id] ?? 50,
          planningWindow: combinedPlanningItems.find((p) => p.packagingOrderId === id) || null,
        };
      }),
    };
  }

  _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const payload = body ? JSON.stringify(body) : null;
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {},
          timeout: this.timeoutMs,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`OR-Tools HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(new Error(`OR-Tools invalid JSON: ${err.message}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`OR-Tools timeout after ${this.timeoutMs}ms`));
      });
      if (payload) req.write(payload);
      req.end();
    });
  }

  static async ping(baseUrl = process.env.ORTOOLS_URL || 'http://127.0.0.1:8010', timeoutMs = 3000) {
    const client = new OrtoolsOptimizer({}, { optimize: () => ({}) }, null);
    client.baseUrl = baseUrl;
    client.timeoutMs = timeoutMs;
    try {
      const health = await client._request('GET', '/health');
      return { reachable: true, ...health, url: baseUrl };
    } catch (err) {
      return { reachable: false, url: baseUrl, error: err.message };
    }
  }

  async optimize(context) {
    const {
      startAnchor,
      horizonDays = 90,
      constraintItems = [],
      priorityScores = [],
      lines = [],
      calendars = [],
      persistScenario = false,
      combinedPlanningItems = [],
    } = context;

    const payload = this._buildPayload({
      startAnchor,
      horizonDays,
      constraintItems,
      priorityScores,
      lines,
      calendars,
      combinedPlanningItems,
    });

    try {
      const response = await this._request('POST', '/optimize', payload);
      const sequence = response.sequence || [];
      const { resolveGanttTimeline, parseHorizonDays } = require('../../utils/planningHorizon');
      const { timelineStart, timelineEnd } = resolveGanttTimeline({
        startAnchor: response.timelineStart || startAnchor,
        horizonDays: parseHorizonDays(horizonDays),
        orderEndDates: sequence.map((o) => o.plannedEndDate || o.plannedStartDate),
      });
      const ganttTasks = response.ganttTasks?.length
        ? response.ganttTasks
        : this.lineOpt.sequencer.toGanttTasks(sequence, timelineStart, timelineEnd);

      return {
        engine: this.name,
        solverStatus: response.solverStatus || 'UNKNOWN',
        startAnchor,
        sequence,
        ganttTasks,
        timelineStart,
        timelineEnd,
        score: response.score || {},
        kpis: {
          ...(response.kpis || {}),
          solverEngine: 'google-or-tools-cp-sat',
          enrichedWithLineScores: true,
        },
        comparison: response.comparison || null,
        scenarioId: response.scenarioId || null,
        meta: {
          orderCount: payload.orders.length,
          persistScenario,
          runtimeMs: response.runtimeMs,
          sidecar: this.baseUrl,
        },
      };
    } catch (err) {
      if (process.env.ORTOOLS_REQUIRED === 'true') throw err;
      const fallback = this.fallback.optimize({ startAnchor, persistScenario });
      return {
        ...fallback,
        meta: {
          ...fallback.meta,
          ortoolsFallback: true,
          ortoolsError: err.message,
        },
      };
    }
  }
}

module.exports = { OrtoolsOptimizer };
