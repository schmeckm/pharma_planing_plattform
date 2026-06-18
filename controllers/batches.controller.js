const dataService = require('../services/dataService');

const data = new dataService.DataService();

function getBatches(req, res, next) {
  try {
    const { materialNumber, qualityStatus } = req.query;
    res.json(data.getBatches({ materialNumber, qualityStatus }));
  } catch (err) {
    next(err);
  }
}

module.exports = { getBatches };
