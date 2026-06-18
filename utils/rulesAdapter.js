const COUNTRY_NAMES = {
  DE: 'Germany',
  GB: 'United Kingdom',
  JP: 'Japan',
  CH: 'Switzerland',
  AT: 'Austria',
  US: 'United States',
};

/**
 * Filter enterprise rules effective on referenceDate.
 */
function filterEffectiveRules(rules, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  return (rules || []).filter((rule) => {
    if (rule.active === false) return false;
    const from = new Date(rule.effectiveFrom);
    const to = rule.effectiveTo ? new Date(rule.effectiveTo) : null;
    return from <= ref && (!to || to >= ref);
  });
}

function computeRuleSetVersion(effectiveRules, rulesV2) {
  const maxVer = effectiveRules.reduce((max, r) => Math.max(max, r.version || 1), 0);
  const auditCount = (rulesV2?.auditLog || []).length;
  return maxVer ? `2.${maxVer}.${auditCount}-enterprise` : '2.0.0-enterprise';
}

/**
 * Merge versioned rulesV2 enterprise rules into the runtime rules.json shape
 * consumed by RuleEngine / AllocationEngine.
 */
function buildRuntimeRules({ baseRules, rulesV2, referenceDate = new Date() }) {
  const effective = filterEffectiveRules(rulesV2?.rules, referenceDate);

  const countryMap = Object.fromEntries(
    (baseRules.countryRules || []).map((cr) => [cr.countryCode, { ...cr }]),
  );

  for (const rule of effective.filter((r) => r.category === 'COUNTRY')) {
    const code = rule.scope?.countryCode;
    if (!code) continue;
    const existing = countryMap[code] || {};
    countryMap[code] = {
      ...existing,
      countryCode: code,
      countryName: existing.countryName || COUNTRY_NAMES[code] || code,
      allowBatchSplit: rule.parameters?.allowBatchSplit ?? existing.allowBatchSplit ?? true,
      rmslThresholdMonths: rule.parameters?.rmslThresholdMonths ?? existing.rmslThresholdMonths ?? 12,
      requiresTric: rule.parameters?.requiresTric ?? existing.requiresTric ?? true,
      requiresContinuousSequence: rule.parameters?.requiresContinuousSequence ?? existing.requiresContinuousSequence ?? false,
      active: rule.active !== false,
      enterpriseRuleId: rule.ruleId,
      enterpriseVersion: rule.version,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
    };
  }

  for (const rule of effective.filter((r) => r.category === 'SEQUENCE')) {
    const code = rule.scope?.countryCode;
    if (code && countryMap[code]) {
      countryMap[code].requiresContinuousSequence = rule.parameters?.continuousSequence ?? true;
      countryMap[code].sequenceRuleId = rule.ruleId;
    }
  }

  const batchSplitGlobal = effective.find((r) => r.category === 'BATCH_SPLIT' && r.scope?.global);
  if (batchSplitGlobal) {
    const defaultAllow = batchSplitGlobal.parameters?.defaultAllowSplit ?? true;
    for (const code of Object.keys(countryMap)) {
      if (!countryMap[code].enterpriseRuleId) {
        countryMap[code].allowBatchSplit = defaultAllow;
      }
    }
  }

  return {
    ...baseRules,
    ruleSetVersion: computeRuleSetVersion(effective, rulesV2),
    countryRules: Object.values(countryMap),
    enterpriseRules: {
      effective: effective,
      customerRules: effective.filter((r) => r.category === 'CUSTOMER'),
      productRules: effective.filter((r) => r.category === 'PRODUCT'),
      marketRules: effective.filter((r) => r.category === 'MARKET'),
      rmslRules: effective.filter((r) => r.category === 'RMSL'),
      batchSplitRules: effective.filter((r) => r.category === 'BATCH_SPLIT'),
      sequenceRules: effective.filter((r) => r.category === 'SEQUENCE'),
    },
    rulesSource: 'rulesV2',
  };
}

module.exports = { buildRuntimeRules, filterEffectiveRules, computeRuleSetVersion };
