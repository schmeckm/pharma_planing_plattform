const { PerformanceService } = require('../services/performanceService');
const svc = new PerformanceService();

function listLineScores(req, res, next) {
  try {
    res.json(svc.listLineScores(req.query.materialNumber || null));
  } catch (e) { next(e); }
}

function recommendLine(req, res, next) {
  try {
    const { materialNumber, preferredLine } = req.query;
    if (!materialNumber) {
      return res.status(400).json({ error: 'VALIDATION', message: 'materialNumber required' });
    }
    res.json(svc.recommendLine(materialNumber, preferredLine || null));
  } catch (e) { next(e); }
}

function listLineFactors(req, res, next) {
  try {
    res.json(svc.listLineFactors());
  } catch (e) { next(e); }
}

function updateLineFactor(req, res, next) {
  try {
    const { lineId } = req.params;
    const { performanceFactor, reason } = req.body || {};
    const userId = req.headers['x-user-id'] || req.body?.userId || 'SYSTEM';
    const updated = svc.updateLineFactor(lineId, { performanceFactor, reason, userId });
    res.json({ updated: true, line: updated });
  } catch (e) {
    if (e.code === 'VALIDATION') {
      return res.status(400).json({ error: 'VALIDATION', message: e.message });
    }
    if (e.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: e.message });
    }
    next(e);
  }
}

function getHistoricalAnalysis(req, res, next) {
  try {
    res.json(svc.getHistoricalAnalysis());
  } catch (e) { next(e); }
}

function getShiftHistory(req, res, next) {
  try {
    const windowDays = parseInt(req.query.windowDays || '365', 10);
    const limit = parseInt(req.query.limit || '200', 10);
    res.json(svc.getShiftHistory({ windowDays, limit }));
  } catch (e) { next(e); }
}

function applyDerivedFactors(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || 'SYSTEM';
    const horizon = req.body?.horizon === 'short' ? 'short' : 'long';
    res.json(svc.applyDerivedFactorsToLines({ horizon, userId }));
  } catch (e) { next(e); }
}

module.exports = {
  listLineScores,
  recommendLine,
  listLineFactors,
  updateLineFactor,
  getHistoricalAnalysis,
  getShiftHistory,
  applyDerivedFactors,
};
