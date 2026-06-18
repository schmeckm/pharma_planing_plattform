const { WhatIfService } = require('../../services/whatIfService');
const svc = new WhatIfService();

function simulate(req, res, next) {
  try {
    res.json(svc.simulate({ ...req.body, userId: req.user.userId }));
  } catch (err) { next(err); }
}

function listScenarios(req, res, next) {
  try {
    res.json(svc.listScenarios());
  } catch (err) { next(err); }
}

module.exports = { simulate, listScenarios };
