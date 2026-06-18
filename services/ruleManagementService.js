const { getProvider } = require('../providers');
const { generateId } = require('../utils/idGenerator');
const { NotFoundError, ValidationError } = require('../utils/errors');

const RULE_CATEGORIES = ['COUNTRY', 'CUSTOMER', 'PRODUCT', 'MARKET', 'SEQUENCE', 'RMSL', 'BATCH_SPLIT'];

class RuleManagementService {
  constructor(provider = getProvider()) {
    this.provider = provider;
  }

  listRules(filters = {}) {
    const data = this.provider.getRules(filters);
    return {
      rules: data.rules || [],
      categories: RULE_CATEGORIES,
      auditLog: (data.auditLog || []).slice(-50).reverse(),
    };
  }

  getRule(ruleId) {
    const rule = this.provider.getRuleById(ruleId);
    if (!rule) throw new NotFoundError('Rule', ruleId);
    const versions = this.provider.getRuleVersions(ruleId);
    return { rule, versions };
  }

  createRule(payload, userId) {
    const rule = {
      ruleId: payload.ruleId || generateId('RULE'),
      category: payload.category,
      name: payload.name,
      scope: payload.scope || {},
      parameters: payload.parameters || {},
      version: 1,
      effectiveFrom: payload.effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: payload.effectiveTo || null,
      active: payload.active !== false,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    if (!RULE_CATEGORIES.includes(rule.category)) {
      throw new ValidationError(`Invalid category. Must be one of: ${RULE_CATEGORIES.join(', ')}`);
    }

    this.provider.saveRule(rule);
    this.provider.appendRuleAudit?.({
      action: 'RULE_CREATED',
      ruleId: rule.ruleId,
      userId,
      snapshot: rule,
    });
    return rule;
  }

  updateRule(ruleId, payload, userId) {
    const existing = this.provider.getRuleById(ruleId);
    if (!existing) throw new NotFoundError('Rule', ruleId);

    const newVersion = (existing.version || 1) + 1;
    const versionRecord = {
      ruleId,
      version: newVersion,
      previousVersion: existing.version,
      snapshot: { ...existing },
      effectiveFrom: payload.effectiveFrom || new Date().toISOString().slice(0, 10),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      changeNotes: payload.changeNotes || 'Rule updated',
    };

    this.provider.saveRuleVersion(ruleId, versionRecord);

    const updated = {
      ...existing,
      ...payload,
      ruleId,
      version: newVersion,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    };
    delete updated.changeNotes;

    this.provider.saveRule(updated);
    this.provider.appendRuleAudit?.({
      action: 'RULE_UPDATED',
      ruleId,
      version: newVersion,
      userId,
    });
    return updated;
  }

  exportRules(format = 'json') {
    const data = this.provider.getRules();
    const exportData = {
      exportedAt: new Date().toISOString(),
      format,
      rules: data.rules || [],
      versions: data.versions || [],
    };
    return exportData;
  }

  getEffectiveRules(referenceDate = new Date()) {
    const data = this.provider.getRules({ activeOnly: true });
    const ref = new Date(referenceDate);
    return (data.rules || []).filter((rule) => {
      const from = new Date(rule.effectiveFrom);
      const to = rule.effectiveTo ? new Date(rule.effectiveTo) : null;
      return from <= ref && (!to || to >= ref);
    });
  }
}

module.exports = { RuleManagementService, RULE_CATEGORIES };
