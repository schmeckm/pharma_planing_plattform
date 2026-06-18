const { ComplianceExplainService } = require('../services/complianceExplainService');
const svc = new ComplianceExplainService();

function explain(req, res, next) {
  try {
    const result = svc.explain(req.params.packagingOrderId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (err) { next(err); }
}

function priorities(_req, res) {
  res.json({
    executionStrategy: 'COMPLIANCE_FIRST',
    executionPriority: [
      { order: 1, phase: 'COMPLIANCE', description: 'ATP, quality stock, inspection lot, reserved inventory, TRIC, RMSL' },
      { order: 2, phase: 'MARKET_RULES', description: 'Country sequencing, batch split, market-specific rules' },
      { order: 3, phase: 'FIFO', description: 'Oldest compliant batch among survivors' },
      { order: 4, phase: 'OPTIMIZATION', description: 'RMSL margin and service level optimization' },
    ],
    gmpRequirements: [
      'ATP checks', 'Reserved inventory checks', 'Quality stock checks',
      'Inspection lot integration', 'FG-SO packing system mapping',
      'Explainable decisions', 'Full audit trail', 'Rule versioning',
    ],
  });
}

module.exports = { explain, priorities };
