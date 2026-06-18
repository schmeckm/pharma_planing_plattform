const { BaseAgent } = require('./baseAgent');

class ComplianceAgent extends BaseAgent {
  constructor(tools) {
    super('compliance-agent', tools);
  }

  async run(context) {
    const { predictions, t = (key, params) => key } = context;
    const recommendations = [];

    const h7 = predictions?.horizons?.find((h) => h.horizonDays === 7);
    if (h7) {
      for (const v of h7.rmslViolations.filter((v) => v.severity === 'HIGH')) {
        recommendations.push(
          this.createRecommendation({
            type: 'COMPLIANCE_ALERT',
            targetId: v.packagingOrderId,
            action: t('compliance.rmslAlert', {
              country: v.country,
              threshold: v.threshold,
            }),
            rationale: t('compliance.predictiveForecast'),
            confidence: 0.91,
            evidence: ['RULE-003', `predict:T+7:${v.packagingOrderId}`],
            approverRole: 'PLANNER',
          }),
        );
      }
    }

    return { agentId: this.name, recommendations, count: recommendations.length };
  }
}

module.exports = { ComplianceAgent };
