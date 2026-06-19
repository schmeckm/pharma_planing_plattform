const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const ctrl = require('../../controllers/v4/controlTower.controller');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', authorize('orders:read'), ctrl.dashboard);
router.get('/inventory', authorize('batches:read'), ctrl.inventory);
router.get('/demand', authorize('orders:read'), ctrl.demand);
router.get('/allocation', authorize('orders:read'), ctrl.allocation);
router.get('/risk', authorize('orders:read'), ctrl.risk);
router.get('/executive', authorize('orders:read'), ctrl.executive);
router.get('/events', authorize('orders:read'), ctrl.events);
router.get('/twin', authorize('whatif:run'), ctrl.twin);
router.get('/recommendations', authorize('orders:read'), ctrl.recommendations);
router.get('/planning-impact', authorize('orders:read'), ctrl.planningImpact);
router.get('/plan-stability', authorize('orders:read'), ctrl.planStability);

module.exports = router;
