const dataService = require('../services/dataService');
const { RuleIntegrationService } = require('../services/ruleIntegrationService');

const data = new dataService.DataService();
const integrationService = new RuleIntegrationService();

function getRules(req, res, next) {
  try {
    const rules = data.getRules();
    const integrationIds = new Set(integrationService.listConfiguredRuleIds());
    const ruleDefinitions = (rules.ruleDefinitions || []).map((def) => ({
      ...def,
      hasIntegration: integrationIds.has(def.ruleId),
    }));
    res.json({
      countryRules: rules.countryRules || [],
      ruleDefinitions,
      sequenceState: rules.sequenceState || {},
    });
  } catch (err) {
    next(err);
  }
}

function updateRules(req, res, next) {
  try {
    const { countryCode, ruleId, countryRules, ruleDefinitions, ...rest } = req.body;

    if (ruleId) {
      const { active, priority, effectiveFrom, effectiveTo, ruleName, ruleType, description, parameters } = req.body;
      const updated = data.updateRuleDefinition(ruleId, {
        ...(active !== undefined && { active }),
        ...(priority !== undefined && { priority }),
        ...(effectiveFrom !== undefined && { effectiveFrom }),
        ...(effectiveTo !== undefined && { effectiveTo }),
        ...(ruleName !== undefined && { ruleName }),
        ...(ruleType !== undefined && { ruleType }),
        ...(description !== undefined && { description }),
        ...(parameters !== undefined && { parameters }),
      });
      return res.json(updated);
    }

    if (countryCode) {
      const { allowBatchSplit, rmslThresholdMonths, requiresTric, requiresContinuousSequence, active } = req.body;
      const updated = data.updateCountryRule(countryCode, {
        ...(allowBatchSplit !== undefined && { allowBatchSplit }),
        ...(rmslThresholdMonths !== undefined && { rmslThresholdMonths }),
        ...(requiresTric !== undefined && { requiresTric }),
        ...(requiresContinuousSequence !== undefined && { requiresContinuousSequence }),
        ...(active !== undefined && { active }),
      });
      return res.json(updated);
    }

    const updated = data.updateRules({ countryRules, ruleDefinitions, ...rest });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function createRuleDefinition(req, res, next) {
  try {
    const created = data.createRuleDefinition(req.body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

function updateRuleDefinition(req, res, next) {
  try {
    const updated = data.updateRuleDefinition(req.params.ruleId, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function deleteRuleDefinition(req, res, next) {
  try {
    const result = data.deleteRuleDefinition(req.params.ruleId);
    if (integrationService.hasIntegration(req.params.ruleId)) {
      integrationService.deleteConfig(req.params.ruleId);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function getRuleIntegration(req, res, next) {
  try {
    const config = integrationService.getConfig(req.params.ruleId);
    if (!config) {
      return res.status(404).json({ message: `No integration config for ${req.params.ruleId}` });
    }
    res.json(config);
  } catch (err) {
    next(err);
  }
}

function saveRuleIntegration(req, res, next) {
  try {
    const saved = integrationService.saveConfig(req.params.ruleId, req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
}

async function testRuleIntegration(req, res, next) {
  try {
    const result = await integrationService.testConnection(req.params.ruleId, req.body.context || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRules,
  updateRules,
  createRuleDefinition,
  updateRuleDefinition,
  deleteRuleDefinition,
  getRuleIntegration,
  saveRuleIntegration,
  testRuleIntegration,
};
