const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const planning = require('../../controllers/v5/planning.controller');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', authorize('orders:read'), planning.dashboard);
router.get('/timeline', authorize('orders:read'), planning.timeline);
router.get('/gantt', authorize('orders:read'), planning.gantt);
router.get('/capacity', authorize('orders:read'), planning.capacity);
router.get('/rmsl-risk', authorize('orders:read'), planning.rmslRisk);
router.get('/market-delivery', authorize('orders:read'), planning.marketDelivery);
router.get('/sequencing', authorize('orders:read'), planning.sequencing);
router.get('/twin', authorize('whatif:run'), planning.twin);
router.get('/orders/:packagingOrderId/rmsl', authorize('orders:read'), planning.orderRmsl);
router.post('/what-if', authorize('whatif:run'), planning.whatIf);

module.exports = router;
