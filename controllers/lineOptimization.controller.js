const { LineOptimizationService } = require('../services/lineOptimizationService');
const svc = new LineOptimizationService();

function getOrders(req, res, next) {
  try { res.json(svc.getOrders()); } catch (e) { next(e); }
}

function getLines(req, res, next) {
  try { res.json(svc.getLines()); } catch (e) { next(e); }
}

function simulate(req, res, next) {
  try { res.json(svc.simulate(req.body)); } catch (e) { next(e); }
}

function optimize(req, res, next) {
  try { res.json(svc.optimize(req.body)); } catch (e) { next(e); }
}

function saveSequence(req, res, next) {
  try {
    res.json(svc.saveSequence({
      ...req.body,
      userId: req.user?.userId || req.headers['x-user-id'],
    }));
  } catch (e) { next(e); }
}

module.exports = { getOrders, getLines, simulate, optimize, saveSequence };
