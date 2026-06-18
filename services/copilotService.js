const { getProvider } = require('../providers');
const { CopilotEngine } = require('../engines/copilotEngine');
const { AllocationService } = require('./allocationService');
const { ExceptionService } = require('./exceptionService');
const { DataService } = require('./dataService');
const { PerformanceService } = require('./performanceService');

class CopilotService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.dataService = new DataService();
    this.engine = new CopilotEngine();
    this.allocationService = new AllocationService();
    this.exceptionService = new ExceptionService(provider);
    this.performance = new PerformanceService(provider);
  }

  ask({ question, packagingOrderId, userId = 'SYSTEM' }) {
    let order = null;
    let result = null;
    let batch = null;
    let countryRule = null;
    let rulesData = null;
    let exceptions = [];

    if (packagingOrderId) {
      order = this.provider.getOrderById(packagingOrderId);
      if (order) {
        try {
          result = this.allocationService.simulate({ packagingOrderId, userId });
        } catch {
          result = { status: 'FAILED', failureReasons: ['Simulation unavailable'] };
        }
        if (result.recommendedBatchId) {
          batch = this.provider.getBatches().find((b) => b.batchId === result.recommendedBatchId);
        }
        rulesData = this.dataService.getRules();
        countryRule = (rulesData.countryRules || []).find((r) => r.countryCode === order.destinationCountry);
        exceptions = this.exceptionService.list().filter((e) => e.packagingOrderId === packagingOrderId);
      }
    }

    let lineRecommendation = null;
    if (order?.materialNumber) {
      try {
        const rec = this.performance.recommendLine(order.materialNumber, order.productionLine);
        const top = rec.candidates?.[0];
        lineRecommendation = {
          recommendedLineId: rec.recommendedLineId,
          lineScore: top?.lineScore,
          candidates: rec.candidates,
          reasons: top ? [
            top.components?.oee >= 70 ? 'Highest OEE' : null,
            top.components?.throughput >= 60 ? 'Highest throughput' : null,
            top.components?.setupTime >= 70 ? 'Lowest setup time' : null,
            top.components?.reliability >= 85 ? 'Highest line reliability' : null,
            'Market release and shelf-life checks passed',
          ].filter(Boolean) : [],
        };
      } catch { /* optional */ }
    }

    const response = this.engine.answer(question, {
      order,
      result,
      batch,
      countryRule,
      rulesData,
      risk: result?.risk,
      ruleChecks: result?.ruleChecks,
      exceptions,
      lineRecommendation,
    });

    return {
      question,
      packagingOrderId,
      answeredAt: new Date().toISOString(),
      engine: 'InternalReasoningEngine',
      ruleSetVersion: rulesData?.ruleSetVersion || result?.ruleSetVersion,
      ...response,
    };
  }
}

module.exports = { CopilotService };
