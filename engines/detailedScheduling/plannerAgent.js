const { chat, getConfig } = require('../../services/llm/llmClient');

class PlannerAgent {
  async explainOrderBlock(context) {
    const { order, eligibility, exceptions } = context;
    const ruleBased = this._ruleBasedBlockExplanation(order, eligibility, exceptions);
    const cfg = getConfig();
    if (!cfg.configured || cfg.mode === 'rules') {
      return { source: 'rules', ...ruleBased };
    }
    try {
      const prompt = [
        {
          role: 'system',
          content: 'You are a pharmaceutical packaging APS planner. Explain blocking reasons and suggest mitigation in clear English. Be concise.',
        },
        {
          role: 'user',
          content: JSON.stringify({ order, checks: eligibility?.checks, exceptions }, null, 2),
        },
      ];
      const text = await chat(prompt, { maxTokens: 600 });
      return {
        source: 'llm',
        explanation: text,
        recommendedActions: ruleBased.recommendedActions,
      };
    } catch {
      return { source: 'rules', ...ruleBased };
    }
  }

  async explainSequence(scheduleResult) {
    const summary = scheduleResult.explanation || '';
    const ruleBased = {
      source: 'rules',
      explanation: summary,
      highlights: [
        'Bottleneck lines scheduled first',
        'Campaign grouping minimizes cleaning',
        'Setup matrix drives changeover duration',
      ],
    };
    const cfg = getConfig();
    if (!cfg.configured) return ruleBased;
    try {
      const prompt = [
        { role: 'system', content: 'Explain why this packaging schedule was built. Mention campaigns, bottlenecks, and setup.' },
        { role: 'user', content: JSON.stringify({ kpis: scheduleResult.kpis, orderCount: scheduleResult.scheduledOrders?.length }, null, 2) },
      ];
      const text = await chat(prompt, { maxTokens: 400 });
      return { source: 'llm', explanation: text, highlights: ruleBased.highlights };
    } catch {
      return ruleBased;
    }
  }

  _ruleBasedBlockExplanation(order, eligibility, exceptions) {
    const ex = exceptions?.[0];
    let explanation = `Order ${order?.orderNumber || 'unknown'} cannot be scheduled.`;
    const actions = [];

    if (ex?.type === 'Country Restriction') {
      explanation = `Order ${order.orderNumber} cannot be released because no approved batch exists for destination ${order.country}. ${ex.message}`;
      actions.push('Contact QA to extend country approvals on an eligible batch.');
      actions.push('Review TRIC matrix for alternate market release.');
    } else if (ex?.type === 'Missing Material') {
      explanation = `Insufficient ATP for material ${order.materialNumber} (qty ${order.quantity}).`;
      actions.push('Check bulk inventory and trigger replenishment.');
    } else if (ex?.type === 'Shelf Life Violation') {
      explanation = ex.message;
      actions.push('Select a fresher batch or renegotiate delivery date.');
    } else if (ex?.type === 'Missing QA Release') {
      explanation = ex.message;
      if (eligibility?.qaAction) {
        explanation += ` ${eligibility.qaAction.message}`;
        actions.push(`Prioritize inspection lot ${eligibility.qaAction.lotId}.`);
      }
    } else if (ex?.type === 'Line Qualification Missing') {
      explanation = ex.message;
      actions.push('Assign to a qualified line or update qualification matrix.');
    } else if (ex) {
      explanation = ex.message;
    }

    return { explanation, recommendedActions: actions };
  }
}

module.exports = { PlannerAgent };
