const { DailyPlanningService } = require('../services/dailyPlanningService');

const svc = new DailyPlanningService();

function activateDraft(req, res, next) {
  try {
    res.json(svc.activateDraft({
      draftScheduleId: req.body?.draftScheduleId || null,
      userId: req.headers['x-user-id'] || req.body?.userId || 'SYSTEM',
      userName: req.headers['x-user-name'] || req.body?.userName || null,
      horizonDays: req.body?.horizonDays ?? null,
    }));
  } catch (e) { next(e); }
}

function getDraftLatest(req, res, next) {
  try {
    res.json(svc.getDraftStatus({
      draftScheduleId: req.query.draftScheduleId || null,
    }));
  } catch (e) { next(e); }
}

module.exports = { activateDraft, getDraftLatest };
