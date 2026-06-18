const { DailyPlanningService } = require('../services/dailyPlanningService');
const { getHorizonSettings, getDefaultHorizonDays, MIN_HORIZON_DAYS, MAX_HORIZON_DAYS } = require('../utils/planningHorizon');
const svc = new DailyPlanningService();

async function getDailyOrders(req, res, next) {
  try {
    res.json(svc.getDailyOrders({ date: req.query.date || null }));
  } catch (e) { next(e); }
}

async function getRecommendedSequence(req, res, next) {
  try {
    const forceRefresh = req.query.refresh === 'true' || req.query.forceRefresh === 'true';
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const result = await svc.getRecommendedSequence({
      startAnchor: req.query.startAnchor || null,
      horizonDays: parseHorizonDays(req.query.horizonDays),
      forceRefresh,
    });
    res.json(result);
  } catch (e) { next(e); }
}

async function optimizeSequence(req, res, next) {
  try {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const result = await svc.optimizeSequence({
      startAnchor: req.body?.startAnchor || req.query?.startAnchor || null,
      horizonDays: parseHorizonDays(req.body?.horizonDays ?? req.query?.horizonDays),
    });
    res.json(result);
  } catch (e) { next(e); }
}

async function whatIf(req, res, next) {
  try {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    res.json(await svc.whatIf({
      sequence: req.body.sequence,
      compareToBaseline: req.body.compareToBaseline !== false,
      horizonDays: parseHorizonDays(req.body?.horizonDays),
    }));
  } catch (e) { next(e); }
}

async function getSapOperationsStatus(req, res, next) {
  try {
    const { SapOperationsImportService } = require('../services/sapOperationsImportService');
    res.json(new SapOperationsImportService().getStatus());
  } catch (e) { next(e); }
}

async function syncSapOperations(req, res, next) {
  try {
    const { SapOperationsImportService } = require('../services/sapOperationsImportService');
    res.json(new SapOperationsImportService().syncFromSapMock());
  } catch (e) { next(e); }
}

async function confirmSequence(req, res, next) {
  try {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    res.json(svc.confirmSequence({
      sequence: req.body.sequence,
      label: req.body.label,
      draftScheduleId: req.body.draftScheduleId || null,
      userId: req.headers['x-user-id'] || req.body.userId || 'SYSTEM',
      userName: req.headers['x-user-name'] || req.body?.userName || null,
      horizonDays: parseHorizonDays(req.body?.horizonDays),
    }));
  } catch (e) { next(e); }
}

async function simulateBatchAssignment(req, res, next) {
  try {
    res.json(svc.simulateBatchAssignment({
      packagingOrderIds: req.body.packagingOrderIds,
      sequence: req.body.sequence,
      userId: req.headers['x-user-id'] || req.body.userId || 'SYSTEM',
    }));
  } catch (e) { next(e); }
}

async function getExceptions(req, res, next) {
  try {
    res.json(svc.getExceptions({
      status: req.query.status || 'OPEN',
      date: req.query.date || null,
    }));
  } catch (e) { next(e); }
}

async function getConfirmedSchedule(req, res, next) {
  try {
    res.json(svc.getConfirmedSchedule());
  } catch (e) { next(e); }
}

async function getPlannerDashboard(req, res, next) {
  try {
    const { parseHorizonDays } = require('../utils/planningHorizon');
    res.json(await svc.getPlannerDashboard({
      date: req.query.date || null,
      startAnchor: req.query.startAnchor || null,
      horizonDays: parseHorizonDays(req.query.horizonDays),
    }));
  } catch (e) { next(e); }
}

async function getSchedulingStatus(req, res, next) {
  try {
    const { SchedulingService } = require('../services/schedulingService');
    const { SapOperationsImportService } = require('../services/sapOperationsImportService');
    const { OrtoolsOperationOptimizer } = require('../services/scheduling/ortoolsOperationOptimizer');
    const status = await new SchedulingService().getOptimizerStatus();
    const operations = {
      phase: 5,
      solver: process.env.OPERATIONS_SOLVER || 'ortools',
      required: process.env.OPERATIONS_ORTOOLS_REQUIRED === 'true',
      sap: new SapOperationsImportService().getStatus(),
    };
    if (operations.solver === 'ortools') {
      operations.sidecar = await OrtoolsOperationOptimizer.ping();
    }
    res.json({
      ...status,
      operations,
      horizonDaysDefault: getDefaultHorizonDays(),
      horizonDaysMin: MIN_HORIZON_DAYS,
      horizonDaysMax: MAX_HORIZON_DAYS,
      horizonModules: getHorizonSettings(),
    });
  } catch (e) { next(e); }
}

function combinedPlanning(req, res, next) {
  try {
    const { SchedulingService } = require('../services/schedulingService');
    const { parseHorizonDays } = require('../utils/planningHorizon');
    const svc = new SchedulingService();
    res.json(svc.runCombinedPlanning({
      startAnchor: req.body?.startAnchor || req.query?.startAnchor || null,
      packagingOrderIds: req.body?.packagingOrderIds || [],
      horizonDays: parseHorizonDays(req.body?.horizonDays ?? req.query?.horizonDays),
    }));
  } catch (e) { next(e); }
}

module.exports = {
  getDailyOrders,
  getRecommendedSequence,
  optimizeSequence,
  whatIf,
  confirmSequence,
  simulateBatchAssignment,
  getExceptions,
  getConfirmedSchedule,
  getPlannerDashboard,
  getSchedulingStatus,
  combinedPlanning,
  getSapOperationsStatus,
  syncSapOperations,
};
