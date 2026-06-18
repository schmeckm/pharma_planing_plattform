const { LineOptimizationService } = require('../lineOptimizationService');

/**
 * Transitional optimizer — wraps existing LineSequencingEngine.
 * Dev/small datasets only; replace with OrtoolsOptimizer in production.
 */
class HeuristicOptimizer {
  constructor(provider) {
    this.lineOpt = new LineOptimizationService(provider);
  }

  get name() {
    return 'heuristic-line-sequencer';
  }

  optimize({ startAnchor, persistScenario = false, horizonDays = null }) {
    this.lineOpt._refreshSequencer();
    const rough = this.lineOpt._roughOrders();
    const result = this.lineOpt.optimize({ startAnchor, persistScenario, horizonDays });

    return {
      engine: this.name,
      solverStatus: 'HEURISTIC',
      startAnchor,
      sequence: result.optimized,
      ganttTasks: result.ganttTasks,
      timelineStart: result.timelineStart,
      timelineEnd: result.timelineEnd,
      score: result.score,
      kpis: result.kpis,
      comparison: result.comparison,
      scenarioId: result.scenarioId,
      meta: { orderCount: rough.length, persistScenario },
    };
  }
}

module.exports = { HeuristicOptimizer };
