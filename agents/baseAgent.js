const { generateId } = require('../utils/idGenerator');

class BaseAgent {
  constructor(name, tools = {}) {
    this.name = name;
    this.tools = tools;
  }

  async run(context) {
    throw new Error(`${this.name}: run() not implemented`);
  }

  createRecommendation({ type, targetId, action, rationale, confidence, evidence, approverRole, packagingOrderId, impact, t, agentName }) {
    const conf = confidence ?? 0.8;
    const priority = conf >= 0.85 ? 'HIGH' : conf >= 0.75 ? 'MEDIUM' : 'LOW';
    const displayAgent = agentName || this.name.replace(/-agent$/, '').replace(/-/g, ' ');
    return {
      recommendationId: generateId('REC'),
      agentId: this.name,
      agent: displayAgent,
      type,
      targetId,
      packagingOrderId: packagingOrderId || (String(targetId || '').startsWith('FG-') ? targetId : null),
      action,
      rationale,
      impact: impact || null,
      confidence: conf,
      priority,
      evidence: evidence || [],
      requiresApproval: true,
      approverRole: approverRole || 'PLANNER',
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
    };
  }
}

module.exports = { BaseAgent };
