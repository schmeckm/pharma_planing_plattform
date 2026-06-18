const http = require('node:http');
const https = require('node:https');

/**
 * Phase 5 — OR-Tools multi work-center operation scheduling client.
 */
class OrtoolsOperationOptimizer {
  constructor() {
    this.baseUrl = process.env.ORTOOLS_URL || 'http://127.0.0.1:8010';
    this.timeoutMs = parseInt(process.env.ORTOOLS_TIMEOUT_MS || '60000', 10);
  }

  get name() {
    return 'google-or-tools-operations';
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
              reject(new Error(`OR-Tools operations HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(new Error(`OR-Tools operations invalid JSON: ${err.message}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`OR-Tools operations timeout after ${this.timeoutMs}ms`));
      });
      if (payload) req.write(payload);
      req.end();
    });
  }

  static async ping(baseUrl = process.env.ORTOOLS_URL || 'http://127.0.0.1:8010', timeoutMs = 3000) {
    const client = new OrtoolsOperationOptimizer();
    client.baseUrl = baseUrl;
    client.timeoutMs = timeoutMs;
    try {
      const health = await client._request('GET', '/health');
      return { reachable: true, ...health, url: baseUrl };
    } catch (err) {
      return { reachable: false, url: baseUrl, error: err.message };
    }
  }

  _buildPayload({ operations, workCenters, startAnchor, horizonDays }) {
    const hoursPerDay = parseInt(process.env.PLANNING_HOURS_PER_DAY || '8', 10) * 2;
    return {
      horizonStart: startAnchor,
      horizonDays,
      maxTimeSeconds: parseFloat(process.env.ORTOOLS_MAX_TIME_SECONDS || '120'),
      lineBalanceWeight: parseInt(process.env.ORTOOLS_LINE_BALANCE_WEIGHT || '15', 10),
      numWorkers: parseInt(process.env.ORTOOLS_NUM_WORKERS || '8', 10),
      hoursPerDay,
      workCenters: workCenters.map((wc) => ({
        workCenterId: wc.workCenterId,
        performanceFactor: wc.performanceFactor,
        capacityHoursPerDay: wc.capacityHoursPerDay,
      })),
      operations: operations.map((op) => ({
        operationId: op.operationId,
        packagingOrderId: op.packagingOrderId || op.packagingOrder,
        operationNo: op.operationNo,
        workCenterId: op.workCenterId,
        durationHours: op.durationHours,
        durationDays: op.durationDays,
        requestedDeliveryDate: op.requestedDeliveryDate,
        priorityScore: op.priorityScore ?? (op.priority === 'HIGH' ? 80 : op.priority === 'MEDIUM' ? 50 : 30),
        performanceFactor: op.performanceFactor,
      })),
    };
  }

  async optimize({ operations, workCenters, startAnchor, horizonDays }) {
    const payload = this._buildPayload({ operations, workCenters, startAnchor, horizonDays });
    const response = await this._request('POST', '/optimize-operations', payload);
    return {
      engine: this.name,
      solverStatus: response.solverStatus || 'UNKNOWN',
      operations: response.operations || [],
      timelineStart: response.timelineStart || startAnchor,
      timelineEnd: response.timelineEnd || startAnchor,
      score: response.score || {},
      runtimeMs: response.runtimeMs,
      phase: response.phase || 5,
    };
  }
}

module.exports = { OrtoolsOperationOptimizer };
