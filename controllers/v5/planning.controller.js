const { TimePlanningService } = require('../../services/timePlanningService');
const svc = new TimePlanningService();

function timeline(req, res, next) {
  try { res.json(svc.getTimeline(req.query.lineId)); } catch (e) { next(e); }
}

function gantt(req, res, next) {
  try { res.json(svc.getGantt(req.query.lineId || 'PACK_LINE_01')); } catch (e) { next(e); }
}

function capacity(req, res, next) {
  try {
    res.json(svc.getCapacityDashboard(parseInt(req.query.horizon || '14', 10)));
  } catch (e) { next(e); }
}

function rmslRisk(req, res, next) {
  try { res.json(svc.getRmslRiskDashboard()); } catch (e) { next(e); }
}

function marketDelivery(req, res, next) {
  try { res.json(svc.getMarketDeliveryRisk()); } catch (e) { next(e); }
}

function sequencing(req, res, next) {
  try { res.json(svc.getSequencing(req.query.lineId || 'PACK_LINE_01')); } catch (e) { next(e); }
}

function twin(req, res, next) {
  try {
    res.json(svc.getDigitalTwin(parseInt(req.query.horizon || '7', 10)));
  } catch (e) { next(e); }
}

function whatIf(req, res, next) {
  try { res.json(svc.simulateWhatIf(req.body)); } catch (e) { next(e); }
}

function orderRmsl(req, res, next) {
  try {
    res.json(svc.evaluateOrderRmsl(req.params.packagingOrderId, req.query.batchId));
  } catch (e) { next(e); }
}

function dashboard(req, res, next) {
  try {
    const lineId = req.query.lineId || 'PACK_LINE_01';
    const horizon = parseInt(req.query.horizon || '7', 10);
    res.json({
      timestamp: new Date().toISOString(),
      timeline: svc.getTimeline(lineId),
      gantt: svc.getGantt(lineId),
      capacity: svc.getCapacityDashboard(14),
      rmslRisk: svc.getRmslRiskDashboard(),
      marketDelivery: svc.getMarketDeliveryRisk(),
      sequencing: svc.getSequencing(lineId),
      digitalTwin: svc.getDigitalTwin(horizon),
    });
  } catch (e) { next(e); }
}

module.exports = {
  timeline, gantt, capacity, rmslRisk, marketDelivery, sequencing, twin, whatIf, orderRmsl, dashboard,
};
