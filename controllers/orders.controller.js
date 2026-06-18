const dataService = require('../services/dataService');

const data = new dataService.DataService();

function getOrders(req, res, next) {
  try {
    const { status, country } = req.query;
    res.json(data.getPackagingOrders({ status, country }));
  } catch (err) {
    next(err);
  }
}

function getDashboard(req, res, next) {
  try {
    res.json(data.getDashboardStats());
  } catch (err) {
    next(err);
  }
}

module.exports = { getOrders, getDashboard };
