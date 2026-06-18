const fs = require('fs');
const path = require('path');
const { RESULT } = require('../engines/complianceEngine');
const { NotFoundError, ValidationError } = require('../utils/errors');

const DEFAULT_INTEGRATION = {
  enabled: false,
  runtimeMode: 'mock',
  provider: 'rest',
  description: '',
  rest: {
    baseUrl: '',
    path: '',
    method: 'GET',
    headers: {},
    query: {},
    timeoutMs: 8000,
    passCondition: {
      type: 'jsonPath',
      path: 'passed',
      operator: '===',
      value: true,
    },
  },
  sap: {
    baseUrl: '',
    odataService: '',
    entitySet: '',
    filter: '',
    timeoutMs: 8000,
    passCondition: {
      type: 'jsonPath',
      path: 'd.results[0].AvailableQty',
      operator: '>=',
      value: '{{order.quantity}}',
    },
  },
  mockResponse: { passed: true },
};

function getByPath(obj, dotPath) {
  if (!dotPath) return obj;
  return dotPath.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    const arrayMatch = /^(.+)\[(\d+)\]$/.exec(key);
    if (arrayMatch) {
      const [, name, idx] = arrayMatch;
      return acc[name]?.[Number(idx)];
    }
    return acc[key];
  }, obj);
}

function interpolateTemplate(value, ctx) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const trimmed = expr.trim();
    if (trimmed.startsWith('env.')) {
      const envKey = trimmed.slice(4);
      return process.env[envKey] || '';
    }
    const resolved = getByPath(ctx, trimmed);
    return resolved == null ? '' : String(resolved);
  });
}

function deepInterpolate(input, ctx) {
  if (Array.isArray(input)) return input.map((v) => deepInterpolate(v, ctx));
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, deepInterpolate(v, ctx)]),
    );
  }
  return interpolateTemplate(input, ctx);
}

function compareValues(left, operator, right) {
  const numLeft = Number(left);
  const numRight = Number(right);
  const useNumeric = !Number.isNaN(numLeft) && !Number.isNaN(numRight)
    && String(left).trim() !== '' && String(right).trim() !== '';

  const l = useNumeric ? numLeft : left;
  const r = useNumeric ? numRight : right;

  switch (operator) {
    case '===': return l === r;
    case '!==': return l !== r;
    case '>': return l > r;
    case '>=': return l >= r;
    case '<': return l < r;
    case '<=': return l <= r;
    default: throw new ValidationError(`Unsupported passCondition operator: ${operator}`);
  }
}

function evaluatePassCondition(condition, responseBody, ctx) {
  if (!condition) return true;
  const resolved = deepInterpolate(condition, { ...ctx, response: responseBody });
  const actual = getByPath(responseBody, resolved.path);
  const expected = resolved.value;
  return compareValues(actual, resolved.operator || '===', expected);
}

class RuleIntegrationService {
  constructor(dataDir = process.env.HAP_DATA_DIR || path.join(__dirname, '..', 'data')) {
    this.integrationsDir = path.join(dataDir, 'rule-integrations');
    if (!fs.existsSync(this.integrationsDir)) {
      fs.mkdirSync(this.integrationsDir, { recursive: true });
    }
  }

  _filePath(ruleId) {
    return path.join(this.integrationsDir, `${ruleId}.json`);
  }

  listConfiguredRuleIds() {
    if (!fs.existsSync(this.integrationsDir)) return [];
    return fs.readdirSync(this.integrationsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  }

  hasIntegration(ruleId) {
    return fs.existsSync(this._filePath(ruleId));
  }

  getConfig(ruleId) {
    const filePath = this._filePath(ruleId);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  }

  saveConfig(ruleId, payload) {
    const config = {
      ...DEFAULT_INTEGRATION,
      ...payload,
      ruleId,
    };
    if (!['rest', 'sap'].includes(config.provider)) {
      throw new ValidationError('provider must be rest or sap');
    }
    fs.writeFileSync(this._filePath(ruleId), `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
    return config;
  }

  deleteConfig(ruleId) {
    const filePath = this._filePath(ruleId);
    if (!fs.existsSync(filePath)) throw new NotFoundError('RuleIntegration', ruleId);
    fs.unlinkSync(filePath);
    return { ruleId, deleted: true };
  }

  buildRequest(config, ctx) {
    const provider = config.provider === 'sap' ? config.sap : config.rest;
    const baseUrl = interpolateTemplate(provider.baseUrl || '', ctx).replace(/\/$/, '');
    let url = baseUrl;

    if (config.provider === 'rest') {
      const restPath = interpolateTemplate(provider.path || '', ctx);
      url = `${baseUrl}${restPath.startsWith('/') ? '' : '/'}${restPath}`;
      const query = deepInterpolate(provider.query || {}, ctx);
      const qs = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== '' && v != null),
      ).toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    } else {
      const service = interpolateTemplate(provider.odataService || '', ctx);
      const entity = interpolateTemplate(provider.entitySet || '', ctx);
      const filter = interpolateTemplate(provider.filter || '', ctx);
      url = `${baseUrl}/${service}/${entity}`;
      if (filter) url += `?$filter=${encodeURIComponent(filter)}`;
    }

    const headers = deepInterpolate(provider.headers || {}, ctx);
    return {
      url,
      method: (provider.method || 'GET').toUpperCase(),
      headers,
      timeoutMs: provider.timeoutMs || 8000,
    };
  }

  evaluateSync(config, ctx, ruleDef) {
    const phase = ruleDef.ruleType || 'COMPLIANCE';
    if (!config?.enabled) return null;

    const request = this.buildRequest(config, ctx);
    let responseBody = config.mockResponse || { passed: true };

    if (config.runtimeMode === 'live' && process.env.HAP_INTEGRATION_LIVE === 'true') {
      return {
        ruleId: ruleDef.ruleId,
        ruleName: ruleDef.ruleName,
        phase,
        result: RESULT.SKIPPED,
        message: `Live integration configured (${config.provider}) — enable async prefetch or use Test Connection`,
        integration: { provider: config.provider, url: request.url, mode: 'live-deferred' },
      };
    }

    const passed = evaluatePassCondition(
      config.provider === 'sap' ? config.sap?.passCondition : config.rest?.passCondition,
      responseBody,
      ctx,
    );

    return {
      ruleId: ruleDef.ruleId,
      ruleName: ruleDef.ruleName,
      phase,
      result: passed ? RESULT.PASSED : RESULT.FAILED,
      message: passed
        ? `${ruleDef.ruleName}: external check passed (${config.provider}, ${config.runtimeMode})`
        : `${ruleDef.ruleName}: external check failed (${config.provider}, ${config.runtimeMode})`,
      integration: {
        provider: config.provider,
        url: request.url,
        method: request.method,
        mode: config.runtimeMode,
      },
    };
  }

  async testConnection(ruleId, ctx = {}) {
    const config = this.getConfig(ruleId);
    if (!config) throw new NotFoundError('RuleIntegration', ruleId);

    const request = this.buildRequest(config, ctx);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const res = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        signal: controller.signal,
      });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }

      const passed = evaluatePassCondition(
        config.provider === 'sap' ? config.sap?.passCondition : config.rest?.passCondition,
        body,
        ctx,
      );

      return {
        ruleId,
        ok: res.ok,
        status: res.status,
        url: request.url,
        passed,
        responsePreview: body,
      };
    } catch (err) {
      return {
        ruleId,
        ok: false,
        url: request.url,
        passed: false,
        error: err.message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { RuleIntegrationService, DEFAULT_INTEGRATION };
