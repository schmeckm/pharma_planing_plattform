const { getProvider } = require('../providers');
const { generateId } = require('../utils/idGenerator');
const { WhatIfEngine } = require('../engines/whatIfEngine');
const { RiskEngine } = require('../engines/riskEngine');
const { AllocationService } = require('./allocationService');
const { DataService } = require('./dataService');

class WhatIfService {
  constructor(provider = getProvider()) {
    this.provider = provider;
    this.whatIfEngine = new WhatIfEngine();
    this.riskEngine = new RiskEngine();
    this.allocationService = new AllocationService();
    this.dataService = new DataService();
  }

  simulate({ packagingOrderId, overrides = {}, userId = 'SYSTEM' }) {
    const order = this.provider.getOrderById(packagingOrderId);
    if (!order) throw new Error(`Order ${packagingOrderId} not found`);

    const baseline = this.allocationService.simulate({ packagingOrderId, userId });

    const rulesData = this.dataService.getRules();
    const scenarioRules = this.whatIfEngine.applyScenarioOverrides(rulesData, {
      ...overrides,
      countryCode: overrides.countryCode || order.destinationCountry,
    });

    // Temporarily apply overrides via forced batch or re-simulation logic
    let scenario;
    if (overrides.forcedBatchId) {
      scenario = this.allocationService.simulate({
        packagingOrderId,
        userId,
      });
      // Re-evaluate with forced batch through execute path simulation
      const batchResult = this._simulateWithOverrides(packagingOrderId, scenarioRules, overrides, userId);
      scenario = batchResult;
    } else {
      scenario = this._simulateWithOverrides(packagingOrderId, scenarioRules, overrides, userId);
    }

    const comparison = this.whatIfEngine.compare(
      { ...baseline, risk: baseline.risk },
      { ...scenario, risk: scenario.risk }
    );

    const scenarioRecord = {
      scenarioId: generateId('WIF'),
      packagingOrderId,
      overrides,
      baseline,
      scenario,
      comparison,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    this.provider.saveWhatIfScenario(scenarioRecord);
    return scenarioRecord;
  }

  _simulateWithOverrides(packagingOrderId, rulesData, overrides, userId) {
    if (overrides.forcedBatchId) {
      return this.allocationService.execute({
        packagingOrderId,
        batchId: overrides.forcedBatchId,
        userId,
        force: true,
      });
    }
    return this.allocationService.simulate({ packagingOrderId, userId });
  }

  listScenarios() {
    return this.provider.getWhatIfScenarios();
  }
}

module.exports = { WhatIfService };
