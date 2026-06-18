const { ControlTowerService } = require('../../services/controlTowerService');
const { parseControlTowerHorizon } = require('../../utils/planningHorizon');
const svc = new ControlTowerService();

function dashboard(req, res, next) {
  try {
    const horizon = parseControlTowerHorizon(req.query.horizon);
    res.json(svc.getUnifiedDashboard(horizon));
  } catch (err) { next(err); }
}

function inventory(req, res, next) {
  try { res.json(svc.getGlobalInventory()); } catch (err) { next(err); }
}

function demand(req, res, next) {
  try { res.json(svc.getMarketDemand()); } catch (err) { next(err); }
}

function allocation(req, res, next) {
  try { res.json(svc.getAllocationMonitor()); } catch (err) { next(err); }
}

function risk(req, res, next) {
  try {
    const horizon = parseControlTowerHorizon(req.query.horizon, 30);
    res.json(svc.getRiskControlCenter(horizon));
  } catch (err) { next(err); }
}

function executive(req, res, next) {
  try {
    const horizon = parseControlTowerHorizon(req.query.horizon);
    res.json(svc.getExecutiveDashboard(horizon));
  } catch (err) { next(err); }
}

function events(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    res.json(svc.getEvents(limit));
  } catch (err) { next(err); }
}

function twin(req, res, next) {
  try {
    const horizon = parseControlTowerHorizon(req.query.horizon);
    res.json(svc.getDigitalTwin(horizon));
  } catch (err) { next(err); }
}

function recommendations(req, res, next) {
  try { res.json(svc.getRecommendations()); } catch (err) { next(err); }
}

function planningImpact(req, res, next) {
  try {
    const { PlanningImpactService } = require('../../services/planningImpactService');
    const impactSvc = new PlanningImpactService();
    res.json(impactSvc.getPlanningImpact({
      groupBy: req.query.groupBy || 'productPortfolio',
      scope: req.query.scope || 'all',
      userId: req.user?.userId || req.headers['x-user-id'],
      horizonDays: req.query.horizonDays ? parseInt(req.query.horizonDays, 10) : null,
      sinceDays: req.query.sinceDays ? parseInt(req.query.sinceDays, 10) : 90,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
      mrpController: req.query.mrpController || null,
      productionLine: req.query.productionLine || null,
      productPortfolio: req.query.productPortfolio || null,
    }));
  } catch (err) { next(err); }
}

module.exports = { dashboard, inventory, demand, allocation, risk, executive, events, twin, recommendations, planningImpact };
