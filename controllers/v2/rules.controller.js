const { RuleManagementService } = require('../../services/ruleManagementService');
const svc = new RuleManagementService();

function listRules(req, res, next) {
  try {
    const { category } = req.query;
    res.json(svc.listRules({ category }));
  } catch (err) { next(err); }
}

function getRule(req, res, next) {
  try {
    res.json(svc.getRule(req.params.ruleId));
  } catch (err) { next(err); }
}

function createRule(req, res, next) {
  try {
    res.status(201).json(svc.createRule(req.body, req.user.userId));
  } catch (err) { next(err); }
}

function updateRule(req, res, next) {
  try {
    res.json(svc.updateRule(req.params.ruleId, req.body, req.user.userId));
  } catch (err) { next(err); }
}

function exportRules(req, res, next) {
  try {
    const data = svc.exportRules(req.query.format);
    res.setHeader('Content-Disposition', 'attachment; filename=rules-export.json');
    res.json(data);
  } catch (err) { next(err); }
}

module.exports = { listRules, getRule, createRule, updateRule, exportRules };
