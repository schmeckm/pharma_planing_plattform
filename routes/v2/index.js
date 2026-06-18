const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const rulesCtrl = require('../../controllers/v2/rules.controller');
const exceptionsCtrl = require('../../controllers/v2/exceptions.controller');
const whatIfCtrl = require('../../controllers/v2/whatIf.controller');
const jobsCtrl = require('../../controllers/v2/jobs.controller');
const copilotCtrl = require('../../controllers/v2/copilot.controller');
const authCtrl = require('../../controllers/v2/auth.controller');
const providerCtrl = require('../../controllers/v2/provider.controller');

const router = express.Router();
router.use(authenticate);

// Auth
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authCtrl.me);
router.get('/auth/users', authorize('users:manage'), authCtrl.listUsers);
router.get('/auth/features', authorize('users:manage'), authCtrl.getFeatures);
router.get('/auth/features/role-defaults/:role', authorize('users:manage'), authCtrl.getRoleDefaults);
router.put('/auth/users/:userId/features', authorize('users:manage'), authCtrl.updateUserFeatures);

// Rule Management v2
router.get('/rules', authorize('rules:read'), rulesCtrl.listRules);
router.get('/rules/export', authorize('rules:read'), rulesCtrl.exportRules);
router.get('/rules/:ruleId', authorize('rules:read'), rulesCtrl.getRule);
router.post('/rules', authorize('rules:write'), rulesCtrl.createRule);
router.put('/rules/:ruleId', authorize('rules:write'), rulesCtrl.updateRule);

// Exceptions
router.get('/exceptions', authorize('exceptions:read'), exceptionsCtrl.list);
router.get('/exceptions/:exceptionId', authorize('exceptions:read'), exceptionsCtrl.getById);
router.post('/exceptions/:exceptionId/comments', authorize('exceptions:comment'), exceptionsCtrl.addComment);
router.post('/exceptions/:exceptionId/escalate', authorize('exceptions:escalate'), exceptionsCtrl.escalate);
router.post('/exceptions/:exceptionId/resolve', authorize('exceptions:resolve'), exceptionsCtrl.resolve);
router.post('/exceptions/:exceptionId/review', authorize('exceptions:read'), exceptionsCtrl.review);

// What-If
router.post('/what-if/simulate', authorize('whatif:run'), whatIfCtrl.simulate);
router.get('/what-if/scenarios', authorize('whatif:run'), whatIfCtrl.listScenarios);

// Mass Allocation Jobs
router.post('/jobs/mass-allocation', authorize('jobs:create'), jobsCtrl.createJob);
router.get('/jobs', authorize('jobs:read'), jobsCtrl.listJobs);
router.get('/jobs/:jobId', authorize('jobs:read'), jobsCtrl.getJob);
router.post('/jobs/:jobId/cancel', authorize('jobs:create'), jobsCtrl.cancelJob);

// Copilot
router.post('/copilot/ask', authorize('copilot:use'), copilotCtrl.ask);

// Data provider (SAP integration prep)
router.get('/provider', authorize('rules:read'), providerCtrl.getInfo);

module.exports = router;
