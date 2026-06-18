const { generateId } = require('../utils/idGenerator');
const { PlanningAgent } = require('./planningAgent');
const { QAAgent } = require('./qaAgent');
const { SupplyChainAgent } = require('./supplyChainAgent');
const { ComplianceAgent } = require('./complianceAgent');

const STATES = {
  IDLE: 'IDLE',
  TRIGGERED: 'TRIGGERED',
  ROUTING: 'ROUTING',
  AGENT_RUNNING: 'AGENT_RUNNING',
  MERGING: 'MERGING',
  COMPLIANCE_GATE: 'COMPLIANCE_GATE',
  COMPLETED: 'COMPLETED',
};

class AgentOrchestrator {
  constructor(context = {}) {
    this.agents = {
      planning: new PlanningAgent(context.tools),
      qa: new QAAgent(context.tools),
      supplyChain: new SupplyChainAgent(context.tools),
      compliance: new ComplianceAgent(context.tools),
    };
    this.enabled = process.env.AGENTS_ENABLED !== 'false';
  }

  async run(trigger, context) {
    if (!this.enabled) {
      return { runId: null, status: 'DISABLED', recommendations: [] };
    }

    const { t = (key) => key, agentName = (id) => id } = context;
    const runId = generateId('RUN');
    const state = { runId, trigger, state: STATES.TRIGGERED, startedAt: new Date().toISOString() };

    const agentsToRun = this._route(trigger);
    state.state = STATES.AGENT_RUNNING;

    const outputs = await Promise.all(
      agentsToRun.map((name) => this.agents[name].run({ ...context, trigger }))
    );

    state.state = STATES.MERGING;
    let recommendations = outputs.flatMap((o) => o.recommendations || []);

    // Compliance gate: flag low confidence
    state.state = STATES.COMPLIANCE_GATE;
    recommendations = recommendations.map((r) => ({
      ...r,
      agent: agentName(r.agentId) || r.agent,
      status: r.confidence < 0.7 ? 'NEEDS_REVIEW' : 'PENDING_APPROVAL',
    }));

    state.state = STATES.COMPLETED;
    state.completedAt = new Date().toISOString();

    const dailySummary = outputs.find((o) => o.dailySummary)?.dailySummary || null;

    return {
      runId,
      trigger,
      state: state.state,
      agentsRun: agentsToRun,
      dailySummary,
      agentOutputs: outputs.map((o) => ({
        agentId: o.agentId,
        count: o.count,
        dailySummary: o.dailySummary || null,
      })),
      recommendations,
      totalRecommendations: recommendations.length,
      advisorNote: t('advisorNote.default'),
      locale: context.locale,
    };
  }

  _route(trigger) {
    const routes = {
      TWIN_RISK_THRESHOLD: ['planning', 'compliance'],
      SCHEDULED_DAILY: ['planning', 'qa', 'supplyChain', 'compliance'],
      MANUAL: ['planning', 'qa', 'supplyChain', 'compliance'],
      BATCH_RELEASED: ['qa'],
      INVENTORY_IMBALANCE: ['supplyChain', 'planning'],
      ORDER_BLOCKED: ['planning', 'compliance'],
      DEFAULT: ['planning'],
    };
    return routes[trigger] || routes.DEFAULT;
  }
}

module.exports = { AgentOrchestrator, STATES };
