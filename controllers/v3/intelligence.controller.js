const { IntelligenceService } = require('../../services/intelligenceService');
const { resolveLocaleFromRequest } = require('../../utils/agentLocale');
const svc = new IntelligenceService();

function twinSimulate(req, res, next) {
  try {
    const horizon = parseInt(req.query.horizon || req.body.horizonDays || '7', 10);
    res.json(svc.simulateTwin(horizon));
  } catch (err) { next(err); }
}

function predictions(req, res, next) {
  try {
    const horizons = req.query.horizons
      ? req.query.horizons.split(',').map(Number)
      : [7, 30, 90];
    res.json(svc.getPredictions(horizons));
  } catch (err) { next(err); }
}

function optimize(req, res, next) {
  try {
    res.json(svc.optimizeGlobal(req.body.objectives));
  } catch (err) { next(err); }
}

function runAgents(req, res, next) {
  const locale = resolveLocaleFromRequest(req);
  const llmEnrich = req.body.llmEnrich;
  svc.runAgents(
    req.body.trigger || 'SCHEDULED_DAILY',
    req.body.horizonDays || 7,
    locale,
    { llmEnrich: llmEnrich === false ? false : undefined },
  )
    .then((result) => res.json(result))
    .catch(next);
}

function morningBriefing(req, res, next) {
  const horizon = parseInt(req.query.horizonDays || '7', 10);
  const locale = resolveLocaleFromRequest(req);
  const llmExplain = req.query.llmEnrich !== 'false';
  svc.getDailyPlanningSummary(horizon, locale, { llmExplain })
    .then((result) => res.json(result))
    .catch(next);
}

function agentsStatus(req, res, next) {
  try {
    const locale = resolveLocaleFromRequest(req);
    res.json(svc.getAgentsStatus(locale));
  } catch (err) { next(err); }
}

function copilotAsk(req, res, next) {
  const locale = resolveLocaleFromRequest(req);
  svc.askCopilotV3(req.body.question, req.body.packagingOrderId, locale)
    .then((result) => res.json(result))
    .catch(next);
}

function executiveDashboard(req, res, next) {
  try {
    const horizon = parseInt(req.query.horizon || '7', 10);
    const locale = resolveLocaleFromRequest(req);
    res.json(svc.getExecutiveDashboard(horizon, locale));
  } catch (err) { next(err); }
}

function executiveKpis(req, res, next) {
  try {
    const horizon = parseInt(req.query.horizon || '7', 10);
    res.json(svc.getExecutiveKpis(horizon));
  } catch (err) { next(err); }
}

function executiveHeatmap(req, res, next) {
  try {
    const horizon = parseInt(req.query.horizon || '7', 10);
    res.json(svc.getExecutiveHeatmap(horizon));
  } catch (err) { next(err); }
}

function agentRecommendations(req, res, next) {
  try {
    const locale = resolveLocaleFromRequest(req);
    res.json(svc.getAgentRecommendations(req.query.status || null, locale));
  } catch (err) { next(err); }
}

function approveRecommendation(req, res, next) {
  try {
    const updated = svc.approveRecommendation(
      req.params.recommendationId,
      req.headers['x-user-id'] || 'SYSTEM',
    );
    if (!updated) return res.status(404).json({ error: 'NOT_FOUND', message: 'Recommendation not found' });
    res.json(updated);
  } catch (err) { next(err); }
}

function dismissRecommendation(req, res, next) {
  try {
    const updated = svc.dismissRecommendation(
      req.params.recommendationId,
      req.headers['x-user-id'] || 'SYSTEM',
      req.body.reason || '',
    );
    if (!updated) return res.status(404).json({ error: 'NOT_FOUND', message: 'Recommendation not found' });
    res.json(updated);
  } catch (err) { next(err); }
}

function graphStats(req, res, next) {
  try {
    res.json(svc.getGraphStats());
  } catch (err) { next(err); }
}

function eventLog(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    res.json(svc.getEventLog(limit));
  } catch (err) { next(err); }
}

function llmStatus(req, res, next) {
  try {
    res.json(svc.getLlmStatus());
  } catch (err) { next(err); }
}

function llmReindex(req, res, next) {
  svc.reindexLearning(req.body || {})
    .then((result) => res.json(result))
    .catch(next);
}

function mlPrognosis(req, res, next) {
  try {
    const horizons = req.query.horizons
      ? req.query.horizons.split(',').map(Number)
      : [7, 30, 90];
    res.json(svc.getMlPrognosis(horizons));
  } catch (err) { next(err); }
}

module.exports = {
  twinSimulate,
  predictions,
  optimize,
  runAgents,
  morningBriefing,
  agentsStatus,
  copilotAsk,
  executiveDashboard,
  executiveKpis,
  executiveHeatmap,
  agentRecommendations,
  approveRecommendation,
  dismissRecommendation,
  graphStats,
  eventLog,
  llmStatus,
  llmReindex,
  mlPrognosis,
};
