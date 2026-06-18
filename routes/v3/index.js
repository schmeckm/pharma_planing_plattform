const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const intel = require('../../controllers/v3/intelligence.controller');
const autopilot = require('../../controllers/v3/autopilot.controller');

const router = express.Router();
router.use(authenticate);

// Digital Supply Chain Twin
router.get('/twin/simulate', authorize('whatif:run'), intel.twinSimulate);
router.post('/twin/simulate', authorize('whatif:run'), intel.twinSimulate);

// Predictive Risk
router.get('/predictions', authorize('orders:read'), intel.predictions);

// Global Optimization
router.post('/optimize', authorize('allocation:simulate'), intel.optimize);

// Multi-Agent Orchestration
router.post('/agents/run', authorize('agents:run'), intel.runAgents);
router.get('/agents/morning-briefing', authorize('orders:read'), intel.morningBriefing);
router.get('/agents/status', authorize('orders:read'), intel.agentsStatus);

// Agent recommendations (human approval required)
router.get('/recommendations', authorize('orders:read'), intel.agentRecommendations);
router.post('/recommendations/:recommendationId/approve', authorize('agents:run'), intel.approveRecommendation);
router.post('/recommendations/:recommendationId/dismiss', authorize('agents:run'), intel.dismissRecommendation);

// AI Copilot v3
router.post('/copilot/ask', authorize('copilot:use'), intel.copilotAsk);

// LLM + RAG learning
router.get('/llm/status', authorize('orders:read'), intel.llmStatus);
router.post('/llm/reindex', authorize('agents:run'), intel.llmReindex);

// Statistical ML prognosis (historical orders + forecasts)
router.get('/ml/prognosis', authorize('orders:read'), intel.mlPrognosis);

// Executive Cockpit
router.get('/executive/dashboard', authorize('orders:read'), intel.executiveDashboard);
router.get('/executive/kpis', authorize('orders:read'), intel.executiveKpis);
router.get('/executive/heatmap', authorize('orders:read'), intel.executiveHeatmap);
router.get('/executive/agent-recommendations', authorize('orders:read'), intel.agentRecommendations);

// Knowledge Graph
router.get('/graph/stats', authorize('orders:read'), intel.graphStats);

// Event bus (SAP Event Mesh / Kafka ready)
router.get('/events/log', authorize('orders:read'), intel.eventLog);

// Planning Autopilot (MVP 4.0 alpha — draft auto-execution)
router.get('/autopilot/status', authorize('orders:read'), autopilot.status);
router.get('/autopilot/runs', authorize('orders:read'), autopilot.runs);
router.post('/autopilot/run', authorize('jobs:create'), autopilot.run);
router.put('/autopilot/policy', authorize('jobs:create'), autopilot.updatePolicy);

module.exports = router;
