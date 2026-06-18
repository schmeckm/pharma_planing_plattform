class WhatIfEngine {
  /**
   * Compare baseline vs scenario allocation results.
   */
  compare(baseline, scenario) {
    const comparison = {
      baselineStatus: baseline.status,
      scenarioStatus: scenario.status,
      batchChanged: baseline.recommendedBatchId !== scenario.recommendedBatchId,
      baselineBatch: baseline.recommendedBatchId,
      scenarioBatch: scenario.recommendedBatchId,
      impactAnalysis: [],
      riskAnalysis: [],
    };

    if (baseline.recommendedBatchId !== scenario.recommendedBatchId) {
      comparison.impactAnalysis.push({
        area: 'Batch Assignment',
        change: `${baseline.recommendedBatchId || 'none'} → ${scenario.recommendedBatchId || 'none'}`,
        impact: 'Batch selection changed under scenario parameters',
      });
    }

    if (baseline.status !== scenario.status) {
      comparison.impactAnalysis.push({
        area: 'Allocation Status',
        change: `${baseline.status} → ${scenario.status}`,
        impact: baseline.status === 'SIMULATED' && scenario.status === 'FAILED'
          ? 'Scenario parameters make allocation impossible'
          : 'Allocation feasibility changed',
      });
    }

    const baselineFails = baseline.failureReasons?.length || 0;
    const scenarioFails = scenario.failureReasons?.length || 0;
    if (scenarioFails > baselineFails) {
      comparison.riskAnalysis.push({
        risk: 'Increased compliance failures',
        detail: `${scenarioFails - baselineFails} additional rule violation(s) under scenario`,
      });
    } else if (scenarioFails < baselineFails) {
      comparison.riskAnalysis.push({
        risk: 'Reduced compliance failures',
        detail: `${baselineFails - scenarioFails} fewer rule violation(s) under scenario`,
      });
    }

    if (scenario.risk?.level === 'HIGH' && baseline.risk?.level !== 'HIGH') {
      comparison.riskAnalysis.push({
        risk: 'Elevated allocation risk',
        detail: `Risk increased from ${baseline.risk?.level || 'N/A'} to HIGH`,
      });
    }

    comparison.summary = this._buildSummary(comparison);
    return comparison;
  }

  _buildSummary(comparison) {
    if (comparison.batchChanged && comparison.scenarioStatus === 'SIMULATED') {
      return 'Scenario produces a different batch assignment with successful allocation.';
    }
    if (comparison.scenarioStatus === 'FAILED') {
      return 'Scenario parameters block allocation — review rule overrides.';
    }
    return 'Scenario has minimal impact on allocation outcome.';
  }

  applyScenarioOverrides(rulesData, overrides = {}) {
    const cloned = JSON.parse(JSON.stringify(rulesData));

    if (overrides.rmslThresholdMonths && overrides.countryCode) {
      const cr = (cloned.countryRules || []).find((r) => r.countryCode === overrides.countryCode);
      if (cr) cr.rmslThresholdMonths = overrides.rmslThresholdMonths;
    }

    if (overrides.allowBatchSplit !== undefined && overrides.countryCode) {
      const cr = (cloned.countryRules || []).find((r) => r.countryCode === overrides.countryCode);
      if (cr) cr.allowBatchSplit = overrides.allowBatchSplit;
    }

    if (overrides.orderSequence) {
      cloned._whatIfOrderSequence = overrides.orderSequence;
    }

    if (overrides.forcedBatchId) {
      cloned._whatIfForcedBatchId = overrides.forcedBatchId;
    }

    return cloned;
  }
}

module.exports = { WhatIfEngine };
