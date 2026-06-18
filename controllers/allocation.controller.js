const allocationService = require('../services/allocationService');

const allocation = new allocationService.AllocationService();

function simulate(req, res, next) {
  try {
    const { packagingOrderId, userId } = req.body;
    const result = allocation.simulate({ packagingOrderId, userId });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function execute(req, res, next) {
  try {
    const { packagingOrderId, batchId, userId, force } = req.body;
    const result = allocation.execute({ packagingOrderId, batchId, userId, force });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function massSimulate(req, res, next) {
  try {
    const { packagingOrderIds, destinationCountry, statusFilter, userId } = req.body;
    const result = allocation.massSimulate({
      packagingOrderIds,
      destinationCountry,
      statusFilter,
      userId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function release(req, res, next) {
  try {
    const { packagingOrderId, userId } = req.body;
    const result = allocation.release({ packagingOrderId, userId });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function massRelease(req, res, next) {
  try {
    const { packagingOrderIds, userId } = req.body;
    const result = allocation.massRelease({ packagingOrderIds, userId });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { simulate, execute, massSimulate, release, massRelease };
