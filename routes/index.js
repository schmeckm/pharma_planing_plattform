const express = require('express');
const ordersController = require('../controllers/orders.controller');
const batchesController = require('../controllers/batches.controller');
const allocationController = require('../controllers/allocation.controller');
const auditController = require('../controllers/audit.controller');
const rulesController = require('../controllers/rules.controller');
const complianceController = require('../controllers/compliance.controller');
const lineOptimizationController = require('../controllers/lineOptimization.controller');
const planningController = require('../controllers/planning.controller');
const schedulerController = require('../controllers/scheduler.controller');
const performanceController = require('../controllers/performance.controller');
const settingsController = require('../controllers/settings.controller');
const detailedSchedulingController = require('../controllers/detailedScheduling.controller');
const adminDataController = require('../controllers/adminData.controller');
let registerBackendRoutes = null;
try {
  ({ registerBackendRoutes } = require('../backend/dist/bridge'));
} catch {
  registerBackendRoutes = null;
}

const router = express.Router();

router.get('/orders', ordersController.getOrders);
router.get('/dashboard', ordersController.getDashboard);
router.get('/batches', batchesController.getBatches);

router.post('/allocation/simulate', allocationController.simulate);
router.post('/allocation/execute', allocationController.execute);
router.post('/allocation/mass-simulate', allocationController.massSimulate);
router.post('/allocation/release', allocationController.release);
router.post('/allocation/mass-release', allocationController.massRelease);

router.get('/audit-trail', auditController.getAuditTrail);

router.get('/rules', rulesController.getRules);
router.put('/rules', rulesController.updateRules);
router.post('/rules/definitions', rulesController.createRuleDefinition);
router.put('/rules/definitions/:ruleId', rulesController.updateRuleDefinition);
router.delete('/rules/definitions/:ruleId', rulesController.deleteRuleDefinition);
router.get('/rules/integrations/:ruleId', rulesController.getRuleIntegration);
router.put('/rules/integrations/:ruleId', rulesController.saveRuleIntegration);
router.post('/rules/integrations/:ruleId/test', rulesController.testRuleIntegration);

router.get('/compliance/priorities', complianceController.priorities);
router.get('/compliance/explain/:packagingOrderId', complianceController.explain);

router.get('/line-optimization/orders', lineOptimizationController.getOrders);
router.get('/line-optimization/lines', lineOptimizationController.getLines);
router.post('/line-optimization/simulate', lineOptimizationController.simulate);
router.post('/line-optimization/optimize', lineOptimizationController.optimize);
router.post('/line-optimization/save-sequence', lineOptimizationController.saveSequence);

router.get('/planning/planner-dashboard', planningController.getPlannerDashboard);
router.get('/planning/daily-orders', planningController.getDailyOrders);
router.get('/planning/recommended-sequence', planningController.getRecommendedSequence);
router.post('/planning/optimize-sequence', planningController.optimizeSequence);
router.post('/planning/combined-calculation', planningController.combinedPlanning);
router.get('/planning/scheduling-status', planningController.getSchedulingStatus);
router.get('/planning/sap-operations', planningController.getSapOperationsStatus);
router.post('/planning/sap-operations/sync', planningController.syncSapOperations);
router.get('/settings/horizons', settingsController.getHorizons);
router.post('/planning/what-if', planningController.whatIf);
router.post('/planning/operations/what-if', planningController.operationsWhatIf);
router.get('/planning/horizon-rules', planningController.getPlanningHorizonRules);
router.post('/planning/horizon/evaluate', planningController.evaluatePlanningHorizon);
router.post('/planning/confirm-sequence', planningController.confirmSequence);
router.post('/planning/simulate-batch-assignment', planningController.simulateBatchAssignment);
router.get('/planning/exceptions', planningController.getExceptions);
router.get('/planning/confirmed-schedule', planningController.getConfirmedSchedule);

router.get('/scheduler/draft/latest', schedulerController.getDraftLatest);
router.post('/scheduler/activate-draft', schedulerController.activateDraft);

router.get('/performance/line-scores', performanceController.listLineScores);
router.get('/performance/recommend-line', performanceController.recommendLine);
router.get('/performance/line-factors', performanceController.listLineFactors);
router.put('/performance/line-factors/:lineId', performanceController.updateLineFactor);
router.get('/performance/historical-analysis', performanceController.getHistoricalAnalysis);
router.get('/performance/shift-history', performanceController.getShiftHistory);
router.post('/performance/apply-derived-factors', performanceController.applyDerivedFactors);

router.get('/planning/detailed-scheduling/master-data', detailedSchedulingController.getMasterData);
router.get('/planning/detailed-scheduling/dashboard', detailedSchedulingController.getDashboard);
router.post('/planning/detailed-scheduling/build', detailedSchedulingController.buildSchedule);
router.get('/planning/detailed-scheduling/schedule', detailedSchedulingController.getSchedule);
router.post('/planning/detailed-scheduling/what-if', detailedSchedulingController.runWhatIf);
router.post('/planning/detailed-scheduling/reschedule', detailedSchedulingController.rescheduleOrder);
router.post('/planning/detailed-scheduling/confirm', detailedSchedulingController.confirmSchedule);
router.get('/planning/detailed-scheduling/explain/order/:orderNumber', detailedSchedulingController.explainOrder);
router.get('/planning/detailed-scheduling/explain/schedule', detailedSchedulingController.explainSchedule);
router.get('/planning/detailed-scheduling/integration', detailedSchedulingController.getIntegrationCatalog);

if (registerBackendRoutes) {
  registerBackendRoutes(router);
} else {
  router.get('/admin/data/entities', adminDataController.listEntitiesMeta);
  router.get('/admin/data/:slug', adminDataController.listRecords);
  router.get('/admin/data/:slug/:id', adminDataController.getRecord);
  router.post('/admin/data/:slug', adminDataController.createRecord);
  router.put('/admin/data/:slug/:id', adminDataController.updateRecord);
  router.delete('/admin/data/:slug/:id', adminDataController.deleteRecord);
  adminDataController.registerEntityRoutes(router);
}

module.exports = router;
