const { getHorizonSettings } = require('../utils/planningHorizon');

function getHorizons(req, res, next) {
  try {
    res.json({
      timestamp: new Date().toISOString(),
      modules: getHorizonSettings(),
    });
  } catch (e) { next(e); }
}

module.exports = { getHorizons };
