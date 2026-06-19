const http = require('node:http');
const https = require('node:https');

/**
 * OR-Tools CP-SAT client for detailed packaging-line scheduling (/optimize).
 */
class OrtoolsDetailedOptimizer {
  constructor() {
    this.baseUrl = process.env.ORTOOLS_URL || 'http://127.0.0.1:8010';
    this.timeoutMs = parseInt(process.env.ORTOOLS_TIMEOUT_MS || '120000', 10);
  }

  get name() {
    return 'google-or-tools-detailed';
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

  _buildPayload({ orders, lines, calendars, startAnchor, horizonDays }) {
    return {
      horizonStart: startAnchor,
      horizonDays,
      maxTimeSeconds: parseFloat(process.env.ORTOOLS_MAX_TIME_SECONDS || '120'),
      lineBalanceWeight: parseInt(process.env.ORTOOLS_LINE_BALANCE_WEIGHT || '15', 10),
      numWorkers: parseInt(process.env.ORTOOLS_NUM_WORKERS || '8', 10),
      lines: lines.map((l) => ({
        lineId: l.lineId,
        capacityUnitsPerDay: l.capacityUnitsPerDay,
        performanceFactor: l.performanceFactor,
      })),
      calendars,
      orders: orders.map((o) => ({
        packagingOrderId: o.orderNumber,
        materialNumber: o.materialNumber,
        destinationCountry: o.country,
        quantity: o.quantity,
        priority: o.priority,
        requestedDeliveryDate: o.dueDate,
        preferredLine: o.packagingLine,
        bestLineId: o.assignedLine || o.packagingLine,
        durationHours: (o.productionDurationHours || 8) + (o.setupDurationHours || 0),
        productionLine: o.assignedLine || o.packagingLine,
      })),
    };
  }

  async optimize({ orders, lines, calendars, startAnchor, horizonDays }) {
    const payload = this._buildPayload({ orders, lines, calendars, startAnchor, horizonDays });
    const result = await this._request('POST', '/optimize', payload);
    return {
      engine: this.name,
      solverStatus: result.solverStatus || result.status,
      runtimeMs: result.runtimeMs,
      sequence: result.sequence || result.orders || [],
      score: result.score || {},
      ortoolsFallback: false,
    };
  }
}

module.exports = { OrtoolsDetailedOptimizer };
