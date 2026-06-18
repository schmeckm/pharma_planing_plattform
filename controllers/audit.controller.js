const auditService = require('../services/auditService');

const audit = new auditService.AuditService();

function getAuditTrail(req, res, next) {
  try {
    const { packagingOrderId, batchId, status, limit } = req.query;
    const result = audit.getAuditTrail({
      packagingOrderId,
      batchId,
      status,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditTrail };
