const { DetailedSchedulingEngine } = require('./detailedSchedulingEngine');
const { EU_COUNTRIES } = require('./masterDataLoader');

class WhatIfSimulator {
  constructor(engine = new DetailedSchedulingEngine()) {
    this.engine = engine;
  }

  async runScenario(baseline, scenario) {
    const modified = this._applyScenario(baseline.masterData, scenario);
    const result = await this.engine.buildSchedule({ masterDataOverride: modified, horizonDays: scenario.horizonDays || 28 });
    const comparison = this._compare(baseline, result, scenario);
    return {
      scenarioId: scenario.scenarioId || `WI-${Date.now()}`,
      label: scenario.label || 'What-if scenario',
      scenario,
      result,
      comparison,
    };
  }

  _applyScenario(md, scenario) {
    const clone = JSON.parse(JSON.stringify(md));
    if (scenario.lineFailure) {
      const failed = scenario.lineFailure;
      clone.productionLines = clone.productionLines.filter((l) => l.lineId !== failed);
      clone.lineQualifications = clone.lineQualifications.filter((q) => q.lineId !== failed);
    }
    if (scenario.batchRelease) {
      const { batchId } = scenario.batchRelease;
      const batch = clone.batches.find((b) => b.batchId === batchId);
      if (batch) {
        batch.qualityStatus = 'RELEASED';
        if (scenario.batchRelease.addCountries) {
          batch.approvedCountries = [...new Set([...(batch.approvedCountries || []), ...scenario.batchRelease.addCountries])];
        }
      }
    }
    if (scenario.oeeDrop) {
      for (const q of clone.lineQualifications) {
        if (!scenario.oeeDrop.lineId || q.lineId === scenario.oeeDrop.lineId) {
          q.defaultOee = scenario.oeeDrop.toOee;
        }
      }
    }
    clone.euCountries = EU_COUNTRIES;
    return clone;
  }

  _compare(baseline, scenarioResult, scenario) {
    const bKpi = baseline.kpis || {};
    const sKpi = scenarioResult.kpis || {};
    return {
      summary: `${scenario.label}: ${sKpi.scheduledOrders - bKpi.scheduledOrders} schedule delta, ${sKpi.blockedOrders - bKpi.blockedOrders} blocked delta`,
      deltas: {
        scheduleAdherence: (sKpi.scheduleAdherence || 0) - (bKpi.scheduleAdherence || 0),
        otif: (sKpi.otif || 0) - (bKpi.otif || 0),
        capacityUtilization: (sKpi.capacityUtilization || 0) - (bKpi.capacityUtilization || 0),
        totalSetupHours: (sKpi.totalSetupHours || 0) - (bKpi.totalSetupHours || 0),
        blockedOrders: (sKpi.blockedOrders || 0) - (bKpi.blockedOrders || 0),
      },
      baselineKpis: bKpi,
      scenarioKpis: sKpi,
    };
  }
}

module.exports = { WhatIfSimulator };
