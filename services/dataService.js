const { JsonRepository } = require('../utils/jsonRepository');
const { loadOrdersData } = require('../utils/ordersData');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { validateEffectiveWindow } = require('../utils/ruleEffectiveDate');
const { remainingShelfLifeMonths } = require('../utils/dateUtils');
const { ComplianceEngine } = require('../engines/complianceEngine');

class DataService {
  constructor(repository = new JsonRepository()) {
    this.repository = repository;
    this.compliance = new ComplianceEngine();
  }

  getOrdersData() {
    return loadOrdersData(this.repository);
  }

  updatePackagingOrder(packagingOrderId, patch) {
    const data = this.getOrdersData();
    const index = (data.packagingOrders || []).findIndex((o) => o.packagingOrderId === packagingOrderId);
    if (index === -1) throw new NotFoundError('PackagingOrder', packagingOrderId);

    data.packagingOrders[index] = { ...data.packagingOrders[index], ...patch };

    if (this.repository.read('orders')) {
      this.repository.write('orders', data);
    }
    this.repository.writeArray('packagingOrders', data.packagingOrders);

    return data.packagingOrders[index];
  }

  getPackagingOrders({ status, country } = {}) {
    const data = this.getOrdersData();
    const salesMap = Object.fromEntries(
      (data.salesOrders || []).map((s) => [s.salesOrderId, s])
    );

    return (data.packagingOrders || [])
      .filter((o) => (!status || o.status === status))
      .filter((o) => (!country || o.destinationCountry === country))
      .map((o) => ({ ...o, salesOrder: salesMap[o.salesOrderId] || null }));
  }

  getPackagingOrder(orderId) {
    const order = this.getPackagingOrders().find((o) => o.packagingOrderId === orderId);
    if (!order) throw new NotFoundError('PackagingOrder', orderId);
    return order;
  }

  getBatches({ materialNumber, qualityStatus } = {}) {
    const rules = this.getRules();
    const referenceDate = new Date();

    return this.repository.readArray('batches').filter((batch) => {
      if (materialNumber && batch.materialNumber !== materialNumber) return false;
      if (qualityStatus && batch.qualityStatus !== qualityStatus) return false;
      return true;
    }).map((batch) => {
      const rmsl = remainingShelfLifeMonths(batch.expiryDate, referenceDate);
      const compliantCountries = (rules.countryRules || [])
        .filter((cr) => cr.active !== false)
        .filter((cr) => {
          const rmslCheck = this.compliance.checkRmsl(
            batch, cr.countryCode, cr,
            { ruleId: 'RULE-003', ruleName: 'RMSL Validation' },
            referenceDate
          );
          const tricCheck = this.compliance.checkTric(
            batch, cr.countryCode, cr,
            { ruleId: 'RULE-002', ruleName: 'TRIC Validation' }
          );
          const tricOk = tricCheck.result === 'PASSED' || tricCheck.result === 'SKIPPED';
          return rmslCheck.result === 'PASSED' && tricOk;
        })
        .map((cr) => cr.countryCode);

      return {
        ...batch,
        remainingShelfLifeMonths: Math.round(rmsl * 10) / 10,
        rmslCompliantCountries: compliantCountries,
      };
    });
  }

  getAllBatchesRaw() {
    return this.repository.readArray('batches');
  }

  getRules(referenceDate = new Date()) {
    const baseRules = this.repository.read('rules') || { countryRules: [], ruleDefinitions: [], sequenceState: {} };
    const rulesV2 = this.repository.read('rulesV2');
    if (rulesV2?.rules?.length) {
      const { buildRuntimeRules } = require('../utils/rulesAdapter');
      return buildRuntimeRules({ baseRules, rulesV2, referenceDate });
    }
    return baseRules;
  }

  updateRules(updates) {
    // Always read the raw base rules.json — never persist the merged runtime
    // object (which includes rulesV2-derived enterpriseRules / rulesSource).
    const base = this.repository.read('rules') || {
      countryRules: [], ruleDefinitions: [], sequenceState: {},
    };
    const updated = { ...base, ...updates };

    if (updates.countryRules) {
      updated.countryRules = updates.countryRules.map((incoming) => {
        const existing = (base.countryRules || []).find((c) => c.countryCode === incoming.countryCode);
        return existing ? { ...existing, ...incoming } : incoming;
      });
    }

    if (updates.ruleDefinitions) {
      updated.ruleDefinitions = updates.ruleDefinitions.map((incoming) => {
        const existing = (base.ruleDefinitions || []).find((r) => r.ruleId === incoming.ruleId);
        return existing ? { ...existing, ...incoming } : incoming;
      });
    }

    this.repository.write('rules', updated);
    return updated;
  }

  updateCountryRule(countryCode, patch) {
    const base = this.repository.read('rules') || {
      countryRules: [], ruleDefinitions: [], sequenceState: {},
    };
    const index = (base.countryRules || []).findIndex((r) => r.countryCode === countryCode);
    if (index === -1) throw new NotFoundError('CountryRule', countryCode);
    base.countryRules[index] = { ...base.countryRules[index], ...patch };
    this.repository.write('rules', base);
    return base.countryRules[index];
  }

  getBaseRules() {
    return this.repository.read('rules') || {
      countryRules: [], ruleDefinitions: [], sequenceState: {},
    };
  }

  getRuleDefinitionsRaw() {
    return this.getBaseRules().ruleDefinitions || [];
  }

  _nextRuleId(definitions) {
    const nums = definitions
      .map((r) => /^RULE-(\d+)$/.exec(r.ruleId))
      .filter(Boolean)
      .map((m) => parseInt(m[1], 10));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `RULE-${String(next).padStart(3, '0')}`;
  }

  createRuleDefinition(payload) {
    const GATE_TYPES = ['COMPLIANCE', 'AVAILABILITY', 'MARKET_RULES', 'PRODUCTION', 'FIFO', 'OPTIMIZATION'];
    const base = this.getBaseRules();
    const definitions = [...(base.ruleDefinitions || [])];

    if (payload.ruleId && definitions.some((r) => r.ruleId === payload.ruleId)) {
      throw new ValidationError(`Rule ${payload.ruleId} already exists`);
    }
    if (!payload.ruleName?.trim()) throw new ValidationError('ruleName is required');
    if (!GATE_TYPES.includes(payload.ruleType)) {
      throw new ValidationError(`ruleType must be one of: ${GATE_TYPES.join(', ')}`);
    }

    validateEffectiveWindow(payload.effectiveFrom, payload.effectiveTo);

    const rule = {
      ruleId: payload.ruleId || this._nextRuleId(definitions),
      ruleName: payload.ruleName.trim(),
      ruleType: payload.ruleType,
      description: payload.description || '',
      priority: payload.priority ?? 99,
      active: payload.active !== false,
      effectiveFrom: payload.effectiveFrom || null,
      effectiveTo: payload.effectiveTo || null,
      parameters: payload.parameters || {},
      version: 1,
    };

    definitions.push(rule);
    this.repository.write('rules', { ...base, ruleDefinitions: definitions });
    return rule;
  }

  deleteRuleDefinition(ruleId) {
    const base = this.getBaseRules();
    const definitions = (base.ruleDefinitions || []).filter((r) => r.ruleId !== ruleId);
    if (definitions.length === (base.ruleDefinitions || []).length) {
      throw new NotFoundError('RuleDefinition', ruleId);
    }
    this.repository.write('rules', { ...base, ruleDefinitions: definitions });
    return { ruleId, deleted: true };
  }

  updateRuleDefinition(ruleId, patch) {
    const base = this.getBaseRules();
    const index = (base.ruleDefinitions || []).findIndex((r) => r.ruleId === ruleId);
    if (index === -1) throw new NotFoundError('RuleDefinition', ruleId);

    const merged = { ...base.ruleDefinitions[index], ...patch, ruleId };
    validateEffectiveWindow(merged.effectiveFrom, merged.effectiveTo);

    const ruleDefinitions = [...base.ruleDefinitions];
    ruleDefinitions[index] = merged;

    this.repository.write('rules', { ...base, ruleDefinitions });
    return merged;
  }

  getDashboardStats() {
    const orders = this.getPackagingOrders();
    const batches = this.getBatches();
    const rules = this.getRules();
    const audit = this.repository.readArray('auditTrail');
    const today = new Date().toISOString().slice(0, 10);

    const openOrders = orders.filter((o) => ['PLANNED', 'OPEN'].includes(o.status)).length;
    const allocatedOrders = orders.filter((o) => ['ALLOCATED', 'PARTIALLY_ALLOCATED'].includes(o.status)).length;
    const blockedOrders = orders.filter((o) => o.status === 'BLOCKED').length;

    const latestByOrder = new Map();
    for (const e of audit) {
      if (!['SIMULATED', 'SUCCESS', 'FAILED', 'RELEASED'].includes(e.status)) continue;
      const existing = latestByOrder.get(e.packagingOrderId);
      if (!existing || (e.timestamp || '') >= (existing.timestamp || '')) {
        latestByOrder.set(e.packagingOrderId, e);
      }
    }
    const simulatedOrders = [...latestByOrder.values()].filter((e) => e.status === 'SIMULATED').length;
    const allocationsToday = audit.filter(
      (e) => e.status === 'SUCCESS' && e.timestamp?.startsWith(today),
    ).length;
    const planningExceptions = blockedOrders
      + [...latestByOrder.values()].filter((e) => e.status === 'FAILED').length;

    const availableBatches = batches.filter(
      (b) => b.qualityStatus === 'RELEASED' && (b.availableQuantity ?? 0) > 0,
    ).length;
    const blockedBatches = batches.filter((b) => b.qualityStatus !== 'RELEASED').length;
    const averageRmsl = batches.length
      ? Math.round(
          (batches.reduce((sum, b) => sum + (b.remainingShelfLifeMonths || 0), 0) / batches.length) * 10,
        ) / 10
      : 0;

    const recent = audit.slice(-20);
    const successful = recent.filter((a) => a.status === 'SUCCESS').length;

    return {
      openOrders,
      simulatedOrders,
      allocationsToday,
      blockedOrders: planningExceptions,
      allocatedOrders,
      availableBatches,
      blockedBatches,
      averageRmsl,
      countriesConfigured: (rules.countryRules || []).length,
      recentAllocations: recent.length,
      successRate: recent.length ? Math.round((successful / recent.length) * 1000) / 10 : 0,
    };
  }
}

module.exports = { DataService };
